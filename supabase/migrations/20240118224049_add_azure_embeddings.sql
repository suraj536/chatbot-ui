ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS azure_openai_embeddings_id TEXT 
CHECK (char_length(azure_openai_embeddings_id) <= 1000);