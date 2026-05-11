-- Migration: 20260511000001_sync_fastapi_users_to_supabase.sql
-- Syncs the public "user" table (used by FastAPI) to the Supabase auth.users table.

CREATE OR REPLACE FUNCTION sync_user_to_auth_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO auth.users (
        id,
        aud,
        role,
        email,
        raw_user_meta_data,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id::uuid,
        'authenticated',
        'authenticated',
        NEW.email,
        jsonb_build_object('full_name', NEW.name, 'avatar_url', NEW.image),
        NEW."createdAt",
        NEW."updatedAt"
    )
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = EXCLUDED.updated_at;
    
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_user_to_auth_users ON public."user";
CREATE TRIGGER trg_sync_user_to_auth_users
    AFTER INSERT OR UPDATE ON public."user"
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_to_auth_users();

-- Backfill existing users from the public "user" table
INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    raw_user_meta_data,
    created_at,
    updated_at
)
SELECT 
    id::uuid,
    'authenticated',
    'authenticated',
    email,
    jsonb_build_object('full_name', name, 'avatar_url', image),
    "createdAt",
    "updatedAt"
FROM public."user"
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
    updated_at = EXCLUDED.updated_at;
