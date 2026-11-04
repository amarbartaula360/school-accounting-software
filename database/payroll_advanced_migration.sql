-- Advanced configurable monthly payroll heads and advance categories
-- Run once after payroll_staff_migration.sql on the production accounting database.
CREATE TABLE IF NOT EXISTS payroll_salary_heads (
  id BIGSERIAL PRIMARY KEY,
  organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  head_code VARCHAR(40) NOT NULL,
  head_name VARCHAR(120) NOT NULL,
  head_type VARCHAR(20) NOT NULL CHECK (head_type IN ('earning','deduction','tax')),
  calculation_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK (calculation_type IN ('fixed','percentage')),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  percentage_base VARCHAR(20) NOT NULL DEFAULT 'basic' CHECK (percentage_base IN ('basic','gross')),
  is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, head_code)
);
CREATE INDEX IF NOT EXISTS idx_payroll_salary_heads_org ON payroll_salary_heads(organization_id,is_active,head_type);

ALTER TABLE payroll_advances
  ADD COLUMN IF NOT EXISTS advance_type VARCHAR(40) NOT NULL DEFAULT 'salary_advance',
  ADD COLUMN IF NOT EXISTS installment_count INTEGER,
  ADD COLUMN IF NOT EXISTS start_period_bs VARCHAR(7);

ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS total_other_earnings NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_tax NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE payroll_items
  ADD COLUMN IF NOT EXISTS other_earnings NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Default editable heads. Admin may add, rename, disable or change values later.
INSERT INTO payroll_salary_heads(organization_id,head_code,head_name,head_type,calculation_type,amount,percentage_base,is_taxable,display_order)
SELECT o.id,v.code,v.name,v.type,v.calc,v.amount,v.base,v.taxable,v.ord
FROM organizations o
CROSS JOIN (VALUES
 ('HOUSE_RENT','घरभाडा भत्ता','earning','fixed',0,'basic',TRUE,10),
 ('TRAVEL','यातायात भत्ता','earning','fixed',0,'basic',TRUE,20),
 ('DASHAIN','चाडपर्व खर्च','earning','fixed',0,'basic',TRUE,30),
 ('BONUS','बोनस','earning','fixed',0,'basic',TRUE,40),
 ('SSF_EMPLOYEE','कर्मचारी SSF कट्टी','deduction','percentage',0,'basic',FALSE,50),
 ('PF','सञ्चय कोष कट्टी','deduction','percentage',0,'basic',FALSE,60),
 ('INCOME_TAX','आयकर','tax','fixed',0,'gross',FALSE,70),
 ('OTHER_TAX','अन्य कर','tax','fixed',0,'gross',FALSE,80),
 ('INSURANCE','बीमा कट्टी','deduction','fixed',0,'basic',FALSE,90),
 ('OTHER_DEDUCTION','अन्य कट्टी','deduction','fixed',0,'basic',FALSE,100)
) AS v(code,name,type,calc,amount,base,taxable,ord)
WHERE NOT EXISTS (SELECT 1 FROM payroll_salary_heads h WHERE h.organization_id=o.id AND h.head_code=v.code);

-- Bank transfer and demo-data support.
ALTER TABLE payroll_staff
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_payroll_staff_demo ON payroll_staff(organization_id,is_demo);
CREATE INDEX IF NOT EXISTS idx_payroll_items_org_run ON payroll_items(organization_id,payroll_run_id);
