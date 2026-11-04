-- Public holiday calendar for Payroll & Attendance.
-- Run once in the ONLINE Neon neondb database, schema public.
CREATE TABLE IF NOT EXISTS payroll_holidays (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  holiday_name VARCHAR(200) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_holidays_org_date_unique UNIQUE (organization_id, holiday_date)
);
CREATE INDEX IF NOT EXISTS idx_payroll_holidays_org_date
  ON payroll_holidays (organization_id, holiday_date);
