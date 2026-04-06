--------------- WORKSPACES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    sharing TEXT NOT NULL DEFAULT 'private',

    default_context_length INTEGER NOT NULL,
    default_model TEXT NOT NULL CHECK (char_length(default_model) <= 1000),
    default_prompt TEXT NOT NULL CHECK (char_length(default_prompt) <= 100000),
    default_temperature REAL NOT NULL,
    description TEXT NOT NULL CHECK (char_length(description) <= 500),
    embeddings_provider TEXT NOT NULL CHECK (char_length(embeddings_provider) <= 1000),
    include_profile_context BOOLEAN NOT NULL,
    include_workspace_instructions BOOLEAN NOT NULL,
    instructions TEXT NOT NULL CHECK (char_length(instructions) <= 1500),
    is_home BOOLEAN NOT NULL DEFAULT FALSE,
    name TEXT NOT NULL CHECK (char_length(name) <= 100)
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces (user_id);

-- RLS --

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own workspaces" ON workspaces;
CREATE POLICY "Allow full access to own workspaces"
ON workspaces
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow view access to non-private workspaces" ON workspaces;
CREATE POLICY "Allow view access to non-private workspaces"
ON workspaces
FOR SELECT
USING (sharing <> 'private');

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION prevent_home_field_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_home IS DISTINCT FROM OLD.is_home THEN
    RAISE EXCEPTION 'Updating the home field of workspace is not allowed.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_home_workspace_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_home THEN
    RAISE EXCEPTION 'Home workspace deletion is not allowed.';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;
CREATE TRIGGER update_workspaces_updated_at
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS prevent_update_of_home_field ON workspaces;
CREATE TRIGGER prevent_update_of_home_field
BEFORE UPDATE ON workspaces
FOR EACH ROW
EXECUTE FUNCTION prevent_home_field_update();

-- UNIQUE INDEX (safe)
-- This partial unique index is what makes ON CONFLICT (user_id) WHERE is_home work

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_home_workspace_per_user 
ON workspaces(user_id) 
WHERE is_home;

-- ================================================================
-- FIX: Remove duplicate home workspaces already in the database
-- Keeps the OLDEST home workspace per user, deletes the rest
-- This is safe to run multiple times
-- ================================================================

DELETE FROM workspaces
WHERE is_home = TRUE
  AND id NOT IN (
    SELECT DISTINCT ON (user_id) id
    FROM workspaces
    WHERE is_home = TRUE
    ORDER BY user_id, created_at ASC
  );