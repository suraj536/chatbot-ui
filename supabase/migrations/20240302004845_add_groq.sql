-- ALTER TABLE --

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS groq_api_key TEXT 
CHECK (char_length(groq_api_key) <= 1000);