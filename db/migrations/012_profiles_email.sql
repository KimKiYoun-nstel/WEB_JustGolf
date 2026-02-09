-- 012_profiles_email.sql
-- Add email column to profiles for manager search functionality

-- 1. Add email column to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

COMMENT ON COLUMN profiles.email IS '사용자 이메일 (auth.users에서 동기화)';

-- 2. Create function to sync email from auth.users to profiles
CREATE OR REPLACE FUNCTION sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  -- On user creation, create profile with email
  INSERT INTO profiles (id, nickname, email, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nickname', NEW.email),
    NEW.email,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger on auth.users to sync email to profiles
DROP TRIGGER IF EXISTS trigger_sync_profile_email ON auth.users;

CREATE TRIGGER trigger_sync_profile_email
AFTER INSERT OR UPDATE OF email ON auth.users
FOR EACH ROW
EXECUTE FUNCTION sync_profile_email();

-- 4. Backfill existing profiles with email from auth.users
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id
AND profiles.email IS NULL;

-- Migration complete
-- This enables email/nickname search in admin/tournaments/[id]/manager-setup
