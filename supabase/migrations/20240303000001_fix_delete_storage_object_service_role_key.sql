-- Replace delete_storage_object to read service_role_key dynamically from Supabase Vault
-- or database setting instead of a hardcoded placeholder string.

CREATE OR REPLACE FUNCTION delete_storage_object(
    bucket TEXT, 
    object TEXT, 
    OUT status INT, 
    OUT content TEXT
)
RETURNS RECORD
LANGUAGE 'plpgsql'
SECURITY DEFINER
AS $$
DECLARE
  project_url TEXT := coalesce(
    nullif(current_setting('app.settings.project_url', true), ''),
    'http://supabase_kong_chatbotui:8000'
  );
  service_role_key TEXT;
  url TEXT;
BEGIN
  -- 1. Try to read service_role_key from Supabase Vault (vault.decrypted_secrets)
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_role_key := NULL;
  END;

  -- 2. Fallback: check custom database setting app.settings.service_role_key
  IF service_role_key IS NULL OR service_role_key = '' THEN
    service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- 3. Guard against unconfigured or default placeholder key
  IF service_role_key IS NULL OR service_role_key = '' OR service_role_key = 'REPLACE_WITH_YOUR_SERVICE_ROLE_KEY' THEN
    RAISE WARNING 'delete_storage_object aborted: service_role_key is not configured in vault.decrypted_secrets or app.settings.service_role_key';
    status := 500;
    content := '{"error": "service_role_key is not configured in vault.decrypted_secrets or app.settings.service_role_key"}';
    RETURN;
  END IF;

  url := project_url || '/storage/v1/object/' || bucket || '/' || object;

  SELECT INTO status, content
    result.status::INT, result.content::TEXT
  FROM extensions.http((
    'DELETE',
    url,
    ARRAY[extensions.http_header('authorization','Bearer ' || service_role_key)],
    NULL,
    NULL
  )::extensions.http_request) AS result;
END;
$$;
