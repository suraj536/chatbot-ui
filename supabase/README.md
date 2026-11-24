# Supabase Setup & Storage Deletion Configuration

## Configuring `service_role_key` for Automated Storage Cleanup

The PostgreSQL function `delete_storage_object` is triggered when files or profiles are deleted to clean up associated storage files in Supabase Storage via HTTP requests.

To avoid storing credentials in migration scripts, the function reads the secret dynamically using either **Supabase Vault** (recommended) or a **database setting**.

### Option 1: Supabase Vault (Recommended for Production & Cloud Supabase)

Run the following SQL in your Supabase SQL editor:

```sql
-- Store your Supabase service_role key securely in the Vault
SELECT vault.create_secret(
  'YOUR_SUPABASE_SERVICE_ROLE_KEY',
  'service_role_key',
  'Service role key used by delete_storage_object function'
);
```

To update or rotate the secret later:
```sql
SELECT vault.update_secret(
  (SELECT id FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
  'NEW_SUPABASE_SERVICE_ROLE_KEY'
);
```

---

### Option 2: Database Setting (Alternative for Local / Self-Hosted Supabase)

If Supabase Vault is not enabled in your environment, you can configure database-level settings in the SQL editor:

```sql
-- Set the service role key
ALTER DATABASE postgres SET app.settings.service_role_key = 'YOUR_SUPABASE_SERVICE_ROLE_KEY';

-- (Optional) If using remote Supabase rather than local Docker Kong:
-- ALTER DATABASE postgres SET app.settings.project_url = 'https://<your-project-ref>.supabase.co';
```

After setting database-level parameters, reconnect or restart your database connection pool for the setting to take effect.
