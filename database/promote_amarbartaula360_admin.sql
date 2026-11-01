-- Promote one existing staff login to Admin.
-- Run this once against the production PostgreSQL database after taking a backup.
-- The script aborts unless exactly one account matches; no other users are changed.

BEGIN;

DO $$
DECLARE
  matched_count INTEGER;
  updated_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO matched_count
    FROM public.app_users
   WHERE LOWER(email) = LOWER('amarbartaula360@gmail.com');

  IF matched_count <> 1 THEN
    RAISE EXCEPTION
      'Expected exactly one matching app_users account; found %',
      matched_count;
  END IF;

  UPDATE public.app_users
     SET role = 'admin',
         permissions = ARRAY['*']::TEXT[],
         is_active = TRUE,
         updated_at = NOW()
   WHERE LOWER(email) = LOWER('amarbartaula360@gmail.com');

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 1 THEN
    RAISE EXCEPTION
      'Expected to promote exactly one account; updated %',
      updated_count;
  END IF;
END $$;

COMMIT;
