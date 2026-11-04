-- Payroll Attendance: Leave and Field Visit request / approval workflow
-- Run this once in the ONLINE Neon database (neondb), schema public.
CREATE TABLE IF NOT EXISTS payroll_attendance_requests (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL,
  staff_id BIGINT NOT NULL REFERENCES payroll_staff(id) ON DELETE CASCADE,
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('leave','field_visit')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT,
  decided_by VARCHAR(150),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payroll_attendance_requests_date_check CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_payroll_attendance_requests_org_status
  ON payroll_attendance_requests (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payroll_attendance_requests_staff_dates
  ON payroll_attendance_requests (organization_id, staff_id, start_date, end_date);
