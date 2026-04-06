
--------------- MESSAGES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    content TEXT NOT NULL CHECK (char_length(content) <= 1000000),
    image_paths TEXT[] NOT NULL,
    model TEXT NOT NULL CHECK (char_length(model) <= 1000),
    role TEXT NOT NULL CHECK (char_length(role) <= 1000),
    sequence_number INT NOT NULL,

    CONSTRAINT check_image_paths_length 
    CHECK (array_length(image_paths, 1) <= 16)
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages (chat_id);

-- RLS --

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own messages" ON messages;
CREATE POLICY "Allow full access to own messages"
ON messages
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow view access to messages for non-private chats" ON messages;
CREATE POLICY "Allow view access to messages for non-private chats"
ON messages FOR SELECT
USING (
    chat_id IN (
        SELECT id FROM chats WHERE sharing <> 'private'
    )
);

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION delete_old_message_images()
RETURNS TRIGGER
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
  image_path TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    FOREACH image_path IN ARRAY OLD.image_paths
    LOOP
      SELECT INTO status, content
        result.status, result.content
      FROM public.delete_storage_object_from_bucket('message_images', image_path) AS result;

      IF status <> 200 THEN
        RAISE WARNING 'Could not delete message image: % %', status, content;
      END IF;
    END LOOP;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION delete_messages_including_and_after(
    p_user_id UUID, 
    p_chat_id UUID, 
    p_sequence_number INT
)
RETURNS VOID AS $$
BEGIN
    DELETE FROM messages 
    WHERE user_id = p_user_id 
    AND chat_id = p_chat_id 
    AND sequence_number >= p_sequence_number;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS (SAFE + FIXED)

DROP TRIGGER IF EXISTS update_messages_updated_at_trigger ON messages;

CREATE TRIGGER update_messages_updated_at_trigger
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS delete_old_message_images_trigger ON messages;

CREATE TRIGGER delete_old_message_images_trigger
AFTER DELETE ON messages
FOR EACH ROW
EXECUTE PROCEDURE delete_old_message_images();

-- STORAGE (safe)

INSERT INTO storage.buckets (id, name, public)
VALUES ('message_images', 'message_images', false)
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES (safe)

DROP POLICY IF EXISTS "Allow read access to own message images" ON storage.objects;
CREATE POLICY "Allow read access to own message images"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'message_images' AND 
    (
        (storage.foldername(name))[1] = auth.uid()::text OR
        (
            EXISTS (
                SELECT 1 FROM chats 
                WHERE id = (
                    SELECT chat_id 
                    FROM messages 
                    WHERE id = (storage.foldername(name))[2]::uuid
                ) 
                AND sharing <> 'private'
            )
        )
    )
);

DROP POLICY IF EXISTS "Allow insert access to own message images" ON storage.objects;
CREATE POLICY "Allow insert access to own message images"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'message_images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow update access to own message images" ON storage.objects;
CREATE POLICY "Allow update access to own message images"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'message_images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Allow delete access to own message images" ON storage.objects;
CREATE POLICY "Allow delete access to own message images"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'message_images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);


--------------- MESSAGE FILE ITEMS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS message_file_items (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_item_id UUID NOT NULL REFERENCES file_items(id) ON DELETE CASCADE,

    PRIMARY KEY(message_id, file_item_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS idx_message_file_items_message_id 
ON message_file_items (message_id);

-- RLS --

ALTER TABLE message_file_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own message_file_items" ON message_file_items;
CREATE POLICY "Allow full access to own message_file_items"
ON message_file_items
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- TRIGGERS (SAFE + FIXED)

DROP TRIGGER IF EXISTS update_message_file_items_updated_at_trigger ON message_file_items;

CREATE TRIGGER update_message_file_items_updated_at_trigger
BEFORE UPDATE ON message_file_items 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();