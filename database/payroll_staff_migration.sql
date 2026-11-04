-- Payroll & Staff module
-- Run once against the existing accounting database.
CREATE TABLE IF NOT EXISTS payroll_staff (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  employee_code VARCHAR(40) NOT NULL,
  full_name VARCHAR(180) NOT NULL,
  photo_url TEXT,
  designation VARCHAR(120),
  department VARCHAR(120),
  phone VARCHAR(40),
  email VARCHAR(180),
  address TEXT,
  join_date DATE,
  employment_type VARCHAR(30) NOT NULL DEFAULT 'permanent',
  basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (basic_salary >= 0),
  allowances NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (allowances >= 0),
  bank_name VARCHAR(120),
  bank_account_name VARCHAR(180),
  bank_account_number VARCHAR(80),
  pan_number VARCHAR(40),
  device_user_id VARCHAR(80),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, employee_code)
);
CREATE INDEX IF NOT EXISTS idx_payroll_staff_org_active ON payroll_staff(organization_id,is_active);

CREATE TABLE IF NOT EXISTS payroll_attendance (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES payroll_staff(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  work_minutes INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  overtime_minutes INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'present',
  source VARCHAR(30) NOT NULL DEFAULT 'manual',
  device_record_id VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, staff_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_payroll_attendance_org_date ON payroll_attendance(organization_id,attendance_date);

CREATE TABLE IF NOT EXISTS payroll_advances (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES payroll_staff(id) ON DELETE CASCADE,
  advance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  recovered_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (recovered_amount >= 0),
  installment_amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (installment_amount >= 0),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_bs VARCHAR(7) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_basic NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_allowances NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_overtime NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_advance NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_net NUMERIC(14,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, period_bs)
);
CREATE TABLE IF NOT EXISTS payroll_items (
  id BIGSERIAL PRIMARY KEY,
  payroll_run_id BIGINT NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES payroll_staff(id),
  basic_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(14,2) NOT NULL DEFAULT 0,
  overtime_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  absent_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  other_deductions NUMERIC(14,2) NOT NULL DEFAULT 0,
  advance_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(14,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(20),
  payment_reference VARCHAR(120),
  paid_at TIMESTAMPTZ,
  UNIQUE (payroll_run_id, staff_id)
);
CREATE TABLE IF NOT EXISTS payroll_device_settings (
  organization_id BIGINT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  device_name VARCHAR(120),
  device_ip INET,
  device_port INTEGER NOT NULL DEFAULT 4370,
  device_type VARCHAR(60),
  sync_secret_hash TEXT,
  last_sync_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
