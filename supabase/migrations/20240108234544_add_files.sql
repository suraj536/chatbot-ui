--------------- FILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    sharing TEXT NOT NULL DEFAULT 'private',

    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    file_path TEXT NOT NULL CHECK (char_length(file_path) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    size INT NOT NULL,
    tokens INT NOT NULL,
    type TEXT NOT NULL CHECK (char_length(type) <= 100)
);

-- INDEX (safe)

CREATE INDEX IF NOT EXISTS files_user_id_idx ON files(user_id);

-- RLS --

ALTER TABLE files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own files" ON files;
CREATE POLICY "Allow full access to own files"
ON files
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow view access to non-private files" ON files;
CREATE POLICY "Allow view access to non-private files"
ON files FOR SELECT
USING (sharing <> 'private');

-- FUNCTION (fixed logic)

CREATE OR REPLACE FUNCTION delete_old_file()
RETURNS TRIGGER
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT INTO status, content
      result.status, result.content
    FROM public.delete_storage_object_from_bucket('files', OLD.file_path) AS result;

    IF status <> 200 THEN
      RAISE WARNING 'Could not delete file: % %', status, content;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_files_updated_at ON files;
CREATE TRIGGER update_files_updated_at
BEFORE UPDATE ON files
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS delete_old_file ON files;
CREATE TRIGGER delete_old_file
BEFORE DELETE ON files
FOR EACH ROW
EXECUTE PROCEDURE delete_old_file();

-- STORAGE (safe)

INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', false)
ON CONFLICT (id) DO NOTHING;

-- FUNCTION

CREATE OR REPLACE FUNCTION public.non_private_file_exists(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM files
        WHERE (id::text = (storage.foldername(p_name))[2]) 
        AND sharing <> 'private'
    );
$$;

-- STORAGE POLICIES (safe)

DROP POLICY IF EXISTS "Allow public read access on non-private files" ON storage.objects;
CREATE POLICY "Allow public read access on non-private files"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'files' AND public.non_private_file_exists(name));

DROP POLICY IF EXISTS "Allow authenticated insert access to own file" ON storage.objects;
CREATE POLICY "Allow authenticated insert access to own file"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated update access to own file" ON storage.objects;
CREATE POLICY "Allow authenticated update access to own file"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated delete access to own file" ON storage.objects;
CREATE POLICY "Allow authenticated delete access to own file"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'files' AND (storage.foldername(name))[1] = auth.uid()::text);


--------------- FILE WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS file_workspaces (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(file_id, workspace_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS file_workspaces_user_id_idx ON file_workspaces(user_id);
CREATE INDEX IF NOT EXISTS file_workspaces_file_id_idx ON file_workspaces(file_id);
CREATE INDEX IF NOT EXISTS file_workspaces_workspace_id_idx ON file_workspaces(workspace_id);

-- RLS --

ALTER TABLE file_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own file_workspaces" ON file_workspaces;
CREATE POLICY "Allow full access to own file_workspaces"
ON file_workspaces
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_file_workspaces_updated_at ON file_workspaces;

CREATE TRIGGER update_file_workspaces_updated_at
BEFORE UPDATE ON file_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();