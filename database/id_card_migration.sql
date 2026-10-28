-- Student ID card support. Does not delete students or any accounting records.
-- Run this once on the same PostgreSQL database used by the API, after backup.
ALTER TABLE public.fee_students
  ADD COLUMN IF NOT EXISTS id_card_valid_upto_bs VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_fee_students_id_card_lookup
  ON public.fee_students (organization_id, class_name, section, reg_no);
