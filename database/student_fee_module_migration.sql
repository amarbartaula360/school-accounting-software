-- Student Fee module migration for the existing school accounting PostgreSQL database.
-- Run once in DBeaver against the SAME database used by the Render backend.
-- This script does not delete or rewrite existing student/accounting records.

CREATE TABLE IF NOT EXISTS public.fee_students (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  admission_no VARCHAR(50) NOT NULL,
  student_name VARCHAR(200) NOT NULL,
  class_name VARCHAR(50) NOT NULL,
  section VARCHAR(30) NOT NULL,
  roll_number VARCHAR(30) NOT NULL,
  guardian_name VARCHAR(200),
  guardian_phone VARCHAR(40),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fee_students_admission UNIQUE (organization_id, admission_no),
  CONSTRAINT uq_fee_students_class_roll UNIQUE (organization_id, class_name, section, roll_number)
);

CREATE TABLE IF NOT EXISTS public.fee_titles (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  title_code VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  income_account_id INTEGER NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  default_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (default_amount >= 0),
  is_monthly BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fee_titles_code UNIQUE (organization_id, title_code)
);

CREATE TABLE IF NOT EXISTS public.fee_bills (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  student_id BIGINT NOT NULL REFERENCES public.fee_students(id) ON DELETE RESTRICT,
  bill_number VARCHAR(30) NOT NULL,
  fee_month DATE NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  status VARCHAR(20) NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fee_bills_number UNIQUE (organization_id, bill_number),
  CONSTRAINT uq_fee_bills_student_month UNIQUE (organization_id, student_id, fee_month)
);

CREATE TABLE IF NOT EXISTS public.fee_bill_lines (
  id BIGSERIAL PRIMARY KEY,
  bill_id BIGINT NOT NULL REFERENCES public.fee_bills(id) ON DELETE CASCADE,
  fee_title_id BIGINT NOT NULL REFERENCES public.fee_titles(id) ON DELETE RESTRICT,
  income_account_id INTEGER NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  title_name VARCHAR(200) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fee_receipts (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  student_id BIGINT NOT NULL REFERENCES public.fee_students(id) ON DELETE RESTRICT,
  bill_id BIGINT NOT NULL REFERENCES public.fee_bills(id) ON DELETE RESTRICT,
  receipt_number VARCHAR(30) NOT NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method VARCHAR(10) NOT NULL CHECK (payment_method IN ('cash', 'bank')),
  payment_account_id INTEGER NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  total_amount NUMERIC(14,2) NOT NULL CHECK (total_amount > 0),
  journal_entry_id INTEGER NOT NULL UNIQUE REFERENCES public.journal_entries(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_fee_receipts_number UNIQUE (organization_id, receipt_number)
);

CREATE TABLE IF NOT EXISTS public.fee_receipt_lines (
  id BIGSERIAL PRIMARY KEY,
  receipt_id BIGINT NOT NULL REFERENCES public.fee_receipts(id) ON DELETE CASCADE,
  bill_line_id BIGINT NOT NULL REFERENCES public.fee_bill_lines(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_students_org_class
  ON public.fee_students (organization_id, class_name, section, roll_number);
CREATE INDEX IF NOT EXISTS idx_fee_titles_org_active
  ON public.fee_titles (organization_id, is_active, title);
CREATE INDEX IF NOT EXISTS idx_fee_bills_org_student_month
  ON public.fee_bills (organization_id, student_id, fee_month);
CREATE INDEX IF NOT EXISTS idx_fee_bill_lines_bill
  ON public.fee_bill_lines (bill_id, id);
CREATE INDEX IF NOT EXISTS idx_fee_receipts_org_student_date
  ON public.fee_receipts (organization_id, student_id, receipt_date, id);
CREATE INDEX IF NOT EXISTS idx_fee_receipt_lines_bill_line
  ON public.fee_receipt_lines (bill_line_id, receipt_id);

-- Review the new tables after execution:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'fee_%' ORDER BY table_name;
