-- One-time promotion of the existing user to organization administrator.
-- Review the matched row before running in production and take a database backup.
BEGIN;

DO $$
DECLARE
  matched_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO matched_count
  FROM app_users
  WHERE LOWER(email) = LOWER('amarbartaula360@gmail.com');

  IF matched_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one user for amarbartaula360@gmail.com, found %; no changes made.',
      matched_count;
  END IF;

  UPDATE app_users
  SET role = 'admin',
      permissions = ARRAY['*']::text[],
      is_active = TRUE,
      updated_at = NOW()
  WHERE LOWER(email) = LOWER('amarbartaula360@gmail.com');
END $$;

-- Verify the resulting role and status before committing.
SELECT id, organization_id, full_name, email, role, is_active, permissions
FROM app_users
WHERE LOWER(email) = LOWER('amarbartaula360@gmail.com');

COMMIT;
