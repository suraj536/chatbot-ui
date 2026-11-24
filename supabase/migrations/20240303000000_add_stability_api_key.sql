-- ALTER TABLE --

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stability_api_key TEXT 
CHECK (char_length(stability_api_key) <= 1000);
