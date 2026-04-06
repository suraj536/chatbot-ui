--------------- PRESETS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS presets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES folders(id) ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    sharing TEXT NOT NULL DEFAULT 'private',

    context_length INT NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    embeddings_provider TEXT NOT NULL CHECK (char_length(embeddings_provider) <= 1000),
    include_profile_context BOOLEAN NOT NULL,
    include_workspace_instructions BOOLEAN NOT NULL,
    model TEXT NOT NULL CHECK (char_length(model) <= 1000),
    name TEXT NOT NULL CHECK (char_length(name) <= 100),
    prompt TEXT NOT NULL CHECK (char_length(prompt) <= 100000),
    temperature REAL NOT NULL
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS presets_user_id_idx ON presets(user_id);

-- RLS --

ALTER TABLE presets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own presets" ON presets;
CREATE POLICY "Allow full access to own presets"
ON presets
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow view access to non-private presets" ON presets;
CREATE POLICY "Allow view access to non-private presets"
ON presets
FOR SELECT
USING (sharing <> 'private');

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_presets_updated_at ON presets;

CREATE TRIGGER update_presets_updated_at
BEFORE UPDATE ON presets 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();


--------------- PRESET WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS preset_workspaces (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    preset_id UUID NOT NULL REFERENCES presets(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

    PRIMARY KEY(preset_id, workspace_id),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS preset_workspaces_user_id_idx ON preset_workspaces(user_id);
CREATE INDEX IF NOT EXISTS preset_workspaces_preset_id_idx ON preset_workspaces(preset_id);
CREATE INDEX IF NOT EXISTS preset_workspaces_workspace_id_idx ON preset_workspaces(workspace_id);

-- RLS --

ALTER TABLE preset_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own preset_workspaces" ON preset_workspaces;
CREATE POLICY "Allow full access to own preset_workspaces"
ON preset_workspaces
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_preset_workspaces_updated_at ON preset_workspaces;

CREATE TRIGGER update_preset_workspaces_updated_at
BEFORE UPDATE ON preset_workspaces 
FOR EACH ROW 
EXECUTE PROCEDURE update_updated_at_column();