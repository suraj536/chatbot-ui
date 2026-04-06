--------------- FILE ITEMS ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS file_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  file_id UUID NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ,

  sharing TEXT NOT NULL DEFAULT 'private',

  content TEXT NOT NULL,
  local_embedding vector(384),
  openai_embedding vector(1536),
  tokens INT NOT NULL
);

-- INDEXES (safe)

CREATE INDEX IF NOT EXISTS file_items_file_id_idx ON file_items(file_id);

CREATE INDEX IF NOT EXISTS file_items_embedding_idx 
ON file_items USING hnsw (openai_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS file_items_local_embedding_idx 
ON file_items USING hnsw (local_embedding vector_cosine_ops);

-- RLS --

ALTER TABLE file_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own file items" ON file_items;
CREATE POLICY "Allow full access to own file items"
ON file_items
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow view access to non-private file items" ON file_items;
CREATE POLICY "Allow view access to non-private file items"
ON file_items
FOR SELECT
USING (
  file_id IN (
    SELECT id FROM files WHERE sharing <> 'private'
  )
);

-- TRIGGERS (safe + fixed name)

DROP TRIGGER IF EXISTS update_file_items_updated_at ON file_items;

CREATE TRIGGER update_file_items_updated_at
BEFORE UPDATE ON file_items
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- FUNCTIONS (safe)

CREATE OR REPLACE FUNCTION match_file_items_local (
  query_embedding vector(384),
  match_count int DEFAULT null,
  file_ids UUID[] DEFAULT null
)
RETURNS TABLE (
  id UUID,
  file_id UUID,
  content TEXT,
  tokens INT,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    file_id,
    content,
    tokens,
    1 - (file_items.local_embedding <=> query_embedding) AS similarity
  FROM file_items
  WHERE (file_ids IS NULL OR file_id = ANY(file_ids))
  ORDER BY file_items.local_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_file_items_openai (
  query_embedding vector(1536),
  match_count int DEFAULT null,
  file_ids UUID[] DEFAULT null
)
RETURNS TABLE (
  id UUID,
  file_id UUID,
  content TEXT,
  tokens INT,
  similarity float
)
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    id,
    file_id,
    content,
    tokens,
    1 - (file_items.openai_embedding <=> query_embedding) AS similarity
  FROM file_items
  WHERE (file_ids IS NULL OR file_id = ANY(file_ids))
  ORDER BY file_items.openai_embedding <=> query_embedding
  LIMIT match_count;
END;
$$;