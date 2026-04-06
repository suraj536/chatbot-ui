-- ==============================
-- ✅ REQUIRED EXTENSIONS (ADD THIS ON TOP)
-- ==============================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

--------------- PROFILES ---------------

-- TABLE --

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,

    bio TEXT NOT NULL DEFAULT '' CHECK (char_length(bio) <= 500),
    has_onboarded BOOLEAN NOT NULL DEFAULT FALSE,
    image_url TEXT NOT NULL DEFAULT '' CHECK (char_length(image_url) <= 1000),
    image_path TEXT NOT NULL DEFAULT '' CHECK (char_length(image_path) <= 1000),
    profile_context TEXT NOT NULL DEFAULT '' CHECK (char_length(profile_context) <= 1500),
    display_name TEXT NOT NULL DEFAULT '' CHECK (char_length(display_name) <= 100),
    use_azure_openai BOOLEAN NOT NULL DEFAULT FALSE,
    username TEXT NOT NULL UNIQUE CHECK (char_length(username) >= 3 AND char_length(username) <= 25),

    anthropic_api_key TEXT CHECK (char_length(anthropic_api_key) <= 1000),
    azure_openai_35_turbo_id TEXT CHECK (char_length(azure_openai_35_turbo_id) <= 1000),
    azure_openai_45_turbo_id TEXT CHECK (char_length(azure_openai_45_turbo_id) <= 1000),
    azure_openai_45_vision_id TEXT CHECK (char_length(azure_openai_45_vision_id) <= 1000),
    azure_openai_api_key TEXT CHECK (char_length(azure_openai_api_key) <= 1000),
    azure_openai_endpoint TEXT CHECK (char_length(azure_openai_endpoint) <= 1000),
    google_gemini_api_key TEXT CHECK (char_length(google_gemini_api_key) <= 1000),
    mistral_api_key TEXT CHECK (char_length(mistral_api_key) <= 1000),
    openai_api_key TEXT CHECK (char_length(openai_api_key) <= 1000),
    openai_organization_id TEXT CHECK (char_length(openai_organization_id) <= 1000),
    perplexity_api_key TEXT CHECK (char_length(perplexity_api_key) <= 1000)
);

-- INDEX (safe)

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles (user_id);

-- RLS --

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to own profiles" ON profiles;

CREATE POLICY "Allow full access to own profiles"
ON profiles
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- FUNCTIONS --

CREATE OR REPLACE FUNCTION delete_old_profile_image()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  status INT;
  content TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT INTO status, content
      result.status, result.content
    FROM public.delete_storage_object_from_bucket('profile_images', OLD.image_path) AS result;

    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

-- TRIGGERS (safe)

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ================================================================
-- FIX: create_profile_and_workspace
-- CHANGE: workspace insert now uses:
--   ON CONFLICT (user_id) WHERE is_home DO NOTHING
-- This uses the partial unique index idx_unique_home_workspace_per_user
-- and prevents duplicate home workspaces from being created,
-- which caused the "Cannot coerce result to single JSON object" error
-- ================================================================

CREATE OR REPLACE FUNCTION create_profile_and_workspace() 
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    random_username TEXT;
BEGIN
    random_username := 'user' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);

    INSERT INTO public.profiles(
        user_id, anthropic_api_key, azure_openai_35_turbo_id, azure_openai_45_turbo_id, 
        azure_openai_45_vision_id, azure_openai_api_key, azure_openai_endpoint, 
        google_gemini_api_key, has_onboarded, image_url, image_path, mistral_api_key, 
        display_name, bio, openai_api_key, openai_organization_id, perplexity_api_key, 
        profile_context, use_azure_openai, username
    )
    VALUES(
        NEW.id,'','','','','','','',
        FALSE,'','','','','','','','','',FALSE,random_username
    )
    ON CONFLICT (user_id) DO NOTHING;

    -- ✅ FIXED: was "ON CONFLICT DO NOTHING" (no target = didn't prevent duplicates)
    -- Now references the partial unique index so only one home workspace is ever created
    INSERT INTO public.workspaces(
        user_id, is_home, name, default_context_length, default_model, 
        default_prompt, default_temperature, description, embeddings_provider, 
        include_profile_context, include_workspace_instructions, instructions
    )
    VALUES(
        NEW.id, TRUE, 'Home', 4096, 'gpt-4-turbo-preview',
        'You are a friendly, helpful AI assistant.',
        0.5, 'My home workspace.', 'openai', TRUE, TRUE, ''
    )
    ON CONFLICT (user_id) WHERE is_home DO NOTHING;

    RETURN NEW;
END;
$$;

-- TRIGGER

DROP TRIGGER IF EXISTS create_profile_and_workspace_trigger ON auth.users;

CREATE TRIGGER create_profile_and_workspace_trigger
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_and_workspace();

DROP TRIGGER IF EXISTS delete_old_profile_image ON profiles;

CREATE TRIGGER delete_old_profile_image
AFTER DELETE ON profiles
FOR EACH ROW
EXECUTE FUNCTION delete_old_profile_image();

-- STORAGE (safe)

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile_images', 'profile_images', true)
ON CONFLICT (id) DO NOTHING;

-- STORAGE POLICIES (safe)

DROP POLICY IF EXISTS "Allow public read access on profile images" ON storage.objects;
CREATE POLICY "Allow public read access on profile images"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile_images');

DROP POLICY IF EXISTS "Allow authenticated insert access to own profile images" ON storage.objects;
CREATE POLICY "Allow authenticated insert access to own profile images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'profile_images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated update access to own profile images" ON storage.objects;
CREATE POLICY "Allow authenticated update access to own profile images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'profile_images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Allow authenticated delete access to own profile images" ON storage.objects;
CREATE POLICY "Allow authenticated delete access to own profile images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'profile_images' AND (storage.foldername(name))[1] = auth.uid()::text);