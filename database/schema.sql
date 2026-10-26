-- Initial PostgreSQL schema outline.
-- Apply only after creating accounting_db. This is a foundation, not a complete audited schema.

CREATE TABLE IF NOT EXISTS organizations (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  pan_number TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS financial_years (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (organization_id, name),
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS accounts (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  code VARCHAR(30) NOT NULL,
  name TEXT NOT NULL,
  account_type VARCHAR(20) NOT NULL CHECK
    (account_type IN ('asset','liability','equity','income','expense')),
  parent_id BIGINT REFERENCES accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (organization_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  financial_year_id BIGINT NOT NULL REFERENCES financial_years(id),
  voucher_number VARCHAR(40) NOT NULL,
  voucher_type VARCHAR(20) NOT NULL CHECK
    (voucher_type IN ('journal','receipt','payment','sales','purchase','contra')),
  entry_date DATE NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK
    (status IN ('draft','posted','reversed')),
  created_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, financial_year_id, voucher_number)
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id BIGSERIAL PRIMARY KEY,
  journal_entry_id BIGINT NOT NULL REFERENCES journal_entries(id) ON DELETE RESTRICT,
  account_id BIGINT NOT NULL REFERENCES accounts(id),
  description TEXT,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0)),
  CHECK (debit > 0 OR credit > 0)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account
  ON journal_lines(account_id);

-- Important: enforce balanced vouchers in a database transaction / posting service
-- before changing journal_entries.status to 'posted'. Do not rely only on the UI.
