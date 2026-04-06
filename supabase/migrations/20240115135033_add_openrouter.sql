DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'profiles' 
        AND column_name = 'openrouter_api_key'
    ) THEN
        ALTER TABLE profiles
        ADD COLUMN openrouter_api_key TEXT 
        CHECK (char_length(openrouter_api_key) <= 1000);
    END IF;
END $$;