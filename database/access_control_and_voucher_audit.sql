-- Safe additive migration: per-user login/access control + voucher edit audit.
-- BACK UP the database before running. Does not delete existing users, vouchers, students, or accounting rows.

CREATE TABLE IF NOT EXISTS public.app_users (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  full_name VARCHAR(180) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(30) NOT NULL CHECK (role IN ('admin','principal','accountant','cashier','exam_coordinator','teacher','viewer')),
  permissions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_org_email_lower
  ON public.app_users (organization_id, LOWER(email));
CREATE INDEX IF NOT EXISTS idx_app_users_org_active
  ON public.app_users (organization_id, is_active, role);

CREATE TABLE IF NOT EXISTS public.journal_entry_audit (
  id BIGSERIAL PRIMARY KEY,
  organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  journal_entry_id BIGINT REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  actor_user_id BIGINT REFERENCES public.app_users(id) ON DELETE SET NULL,
  actor_email VARCHAR(254),
  action VARCHAR(40) NOT NULL,
  old_value JSONB,
  new_value JSONB,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_entry_audit_org_entry_time
  ON public.journal_entry_audit (organization_id, journal_entry_id, created_at DESC);
