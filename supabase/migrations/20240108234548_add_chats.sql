--------------- CHATS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    
    assistant_id UUID REFERENCES assistants(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    sharing TEXT NOT NULL DEFAULT 'private',

    context_length INT NOT NULL,
    embeddings_provider TEXT NOT NULL CHECK (char_length(embeddings_provider) <= 1000),
    include_profile_context BOOLEAN NOT NULL,
    include_workspace_instructions BOOLEAN NOT NULL,
    model TEXT NOT NULL CHECK (char_length(model) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 200),
    prompt TEXT NOT NULL CHECK (char_length(prompt) <= 100000),
    temperature REAL NOT NULL
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats (user_id);
CREATE INDEX IF NOT EXISTS idx_chats_workspace_id ON chats (workspace_id);

-- RLS --

ALTER TABLE chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own chats" ON chats;
CREATE POLICY "Allow full access to own chats"
ON chats
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow view access to non-private chats" ON chats;
CREATE POLICY "Allow view access to non-private chats"
ON chats FOR SELECT
USING (sharing <> 'private');

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_chats_updated_at ON chats;

CREATE TRIGGER update_chats_updated_at
BEFORE UPDATE ON chats 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();


--------------- CHAT FILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS chat_files (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,

    PRIMARY KEY(chat_id, file_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS idx_chat_files_chat_id ON chat_files (chat_id);

-- RLS --

ALTER TABLE chat_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own chat_files" ON chat_files;
CREATE POLICY "Allow full access to own chat_files"
ON chat_files
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_chat_files_updated_at ON chat_files;

CREATE TRIGGER update_chat_files_updated_at
BEFORE UPDATE ON chat_files 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();