import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://school-accounting-frontend.onrender.com',
  'https://amarbartaula.com.np',
  'https://www.amarbartaula.com.np',
  process.env.CLIENT_ORIGIN
].filter(Boolean);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

function isValidOrganizationId(value) {
  return /^\d+$/.test(String(value ?? '')) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;
}

function isValidDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function validMoney(value) {
  return Number.isFinite(value) &&
    value >= 0 &&
    value <= 999999999999.99 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'Accounting Software API' });
});

// Database check
app.get('/api/db-check', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS database_time');
    res.json({
      ok: true,
      message: 'Database connected successfully',
      databaseTime: result.rows[0].database_time
    });
  } catch (err) {
    console.error('Database check failed:', err.message);
    res.status(500).json({ ok: false, message: 'Database connection failed' });
  }
});

// Organizations
app.get('/api/organizations', async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, module_type
       FROM organizations
       ORDER BY id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Organizations error:', err.message);
    res.status(500).json({ message: 'Could not load organizations' });
  }
});

// Accounts and groups; ledger balances are calculated from posted journal entries.
app.get('/api/accounts', async (req, res) => {
  try {
    const { organizationId } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }

    const result = await pool.query(
      `WITH account_balances AS (
         SELECT
           l.account_id,
           SUM(l.debit) AS total_debit,
           SUM(l.credit) AS total_credit
         FROM journal_lines l
         INNER JOIN journal_entries j ON j.id = l.journal_entry_id
         WHERE j.organization_id = $1
           AND j.status = 'posted'
         GROUP BY l.account_id
       )
       SELECT
         a.id,
         a.organization_id,
         a.code AS account_code,
         a.name AS account_name,
         a.account_type,
         a.parent_id,
         parent.name AS parent_name,
         a.is_group,
         a.is_active,
         CASE
           WHEN a.is_group THEN 0
           WHEN LOWER(a.account_type) IN ('liability', 'equity', 'income')
             THEN COALESCE(b.total_credit, 0) - COALESCE(b.total_debit, 0)
           ELSE COALESCE(b.total_debit, 0) - COALESCE(b.total_credit, 0)
         END::numeric(14,2) AS balance
       FROM accounts a
       LEFT JOIN accounts parent
         ON parent.id = a.parent_id
        AND parent.organization_id = a.organization_id
       LEFT JOIN account_balances b ON b.account_id = a.id
       WHERE a.organization_id = $1
       ORDER BY a.is_group DESC, a.code, a.id`,
      [Number(organizationId)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Accounts error:', err.message);
    res.status(500).json({ message: 'Could not load accounts' });
  }
});

// Create account group or ledger account
app.post('/api/accounts', async (req, res) => {
  try {
    const {
      organizationId,
      accountCode,
      accountName,
      accountType,
      isGroup = false,
      parentId = null
    } = req.body;

    const allowedTypes = ['asset', 'liability', 'equity', 'income', 'expense'];
    const groupFlag = isGroup === true;

    if (
      !isValidOrganizationId(organizationId) ||
      typeof accountCode !== 'string' || !accountCode.trim() ||
      typeof accountName !== 'string' || !accountName.trim() ||
      typeof accountType !== 'string' ||
      !allowedTypes.includes(accountType.toLowerCase())
    ) {
      return res.status(400).json({
        message: 'Valid organization, account code, account name and account type are required'
      });
    }

    let normalizedParentId = null;
    if (!groupFlag) {
      if (!isValidOrganizationId(parentId)) {
        return res.status(400).json({ message: 'Ledger बनाउन Under Group छान्नुहोस्।' });
      }
      normalizedParentId = Number(parentId);
      const parent = await pool.query(
        `SELECT id
         FROM accounts
         WHERE id = $1
           AND organization_id = $2
           AND is_group = TRUE
           AND is_active = TRUE`,
        [normalizedParentId, Number(organizationId)]
      );
      if (parent.rowCount === 0) {
        return res.status(400).json({ message: 'चयन गरिएको Under Group भेटिएन।' });
      }
    }

    const result = await pool.query(
      `INSERT INTO accounts
         (organization_id, code, name, account_type, parent_id, is_group)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING
         id, organization_id, code AS account_code,
         name AS account_name, account_type, parent_id, is_group, is_active`,
      [
        Number(organizationId),
        accountCode.trim(),
        accountName.trim(),
        accountType.toLowerCase(),
        normalizedParentId,
        groupFlag
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'This account code already exists for this organization' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Organization or parent group not found' });
    }
    if (err.code === '42703') {
      return res.status(500).json({
        message: 'Database मा is_group column छैन। पहिले accounts_groups_migration.sql चलाउनुहोस्।'
      });
    }
    console.error('Create account error:', err.message);
    return res.status(500).json({ message: 'Could not create account' });
  }
});

// Calculate the next serial number preview.
// Actual serial is generated again inside the POST transaction to avoid duplicates.
app.get('/api/next-voucher-number', async (req, res) => {
  try {
    const { organizationId, entryDate } = req.query;
    if (!isValidOrganizationId(organizationId) || !isValidDate(entryDate)) {
      return res.status(400).json({ message: 'Valid organizationId and entryDate are required' });
    }

    const actualDate = entryDate || new Date().toISOString().slice(0, 10);
    const financialYear = await pool.query(
      `SELECT id
       FROM financial_years
       WHERE organization_id = $1
         AND start_date <= $2::date
         AND end_date >= $2::date
         AND is_closed = FALSE
       ORDER BY start_date DESC
       LIMIT 1`,
      [Number(organizationId), actualDate]
    );
    if (financialYear.rowCount === 0) {
      return res.status(400).json({ message: 'यो मितिका लागि खुला आर्थिक वर्ष भेटिएन।' });
    }

    const sequence = await pool.query(
      `SELECT COALESCE(
         MAX(SUBSTRING(voucher_number FROM '^JV-([0-9]{1,5})$')::integer), 0
       ) + 1 AS next_serial
       FROM journal_entries
       WHERE organization_id = $1
         AND voucher_number ~ '^JV-[0-9]{1,5}$'`,
      [Number(organizationId)]
    );

    return res.json({
      voucherNumber: `JV-${String(sequence.rows[0].next_serial).padStart(4, '0')}`,
      financialYearId: financialYear.rows[0].id
    });
  } catch (err) {
    console.error('Next voucher number error:', err.message);
    return res.status(500).json({ message: 'Could not generate next voucher number' });
  }
});

// Create and post a balanced journal entry.
app.post('/api/journal-entries', async (req, res) => {
  const { organizationId, entryDate, description, lines } = req.body;

  if (
    !isValidOrganizationId(organizationId) ||
    typeof description !== 'string' || !description.trim() ||
    !Array.isArray(lines) || lines.length < 2
  ) {
    return res.status(400).json({
      message: 'Organization, description and at least two journal lines are required'
    });
  }
  if (entryDate && !isValidDate(entryDate)) {
    return res.status(400).json({ message: 'entryDate must be in YYYY-MM-DD format' });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const accountIds = [];

  for (const line of lines) {
    const accountId = Number(line.accountId);
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    if (
      !Number.isSafeInteger(accountId) || accountId <= 0 ||
      !validMoney(debit) || !validMoney(credit) ||
      (debit > 0 && credit > 0) || (debit === 0 && credit === 0)
    ) {
      return res.status(400).json({
        message: 'Each line needs a valid ledger account and either debit or credit with up to two decimal places'
      });
    }

    totalDebit += Math.round(debit * 100);
    totalCredit += Math.round(credit * 100);
    accountIds.push(accountId);
  }

  if (totalDebit !== totalCredit || totalDebit === 0) {
    return res.status(400).json({
      message: 'Total debit must equal total credit',
      totalDebit: totalDebit / 100,
      totalCredit: totalCredit / 100
    });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    const org = await client.query(
      'SELECT id FROM organizations WHERE id = $1',
      [Number(organizationId)]
    );
    if (org.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Organization not found' });
    }

    const uniqueAccountIds = [...new Set(accountIds)];
    const accountResult = await client.query(
      `SELECT id
       FROM accounts
       WHERE organization_id = $1
         AND is_active = TRUE
         AND is_group = FALSE
         AND id = ANY($2::bigint[])
       FOR SHARE`,
      [Number(organizationId), uniqueAccountIds]
    );
    if (accountResult.rowCount !== uniqueAccountIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'An account is invalid, inactive, a group, or belongs to another organization' });
    }

    const actualEntryDate = entryDate || new Date().toISOString().slice(0, 10);
    const fy = await client.query(
      `SELECT id
       FROM financial_years
       WHERE organization_id = $1
         AND start_date <= $2::date
         AND end_date >= $2::date
         AND is_closed = FALSE
       ORDER BY start_date DESC
       LIMIT 1`,
      [Number(organizationId), actualEntryDate]
    );
    if (fy.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'यो मितिका लागि खुला आर्थिक वर्ष भेटिएन।' });
    }
    const financialYearId = fy.rows[0].id;

    // Serialize number generation for this organization. Preview may be stale,
    // but the server-generated number is authoritative.
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [Number(organizationId)]);
    const seq = await client.query(
      `SELECT COALESCE(
         MAX(SUBSTRING(voucher_number FROM '^JV-([0-9]{1,5})$')::integer), 0
       ) + 1 AS next_serial
       FROM journal_entries
       WHERE organization_id = $1
         AND voucher_number ~ '^JV-[0-9]{1,5}$'`,
      [Number(organizationId)]
    );
    const voucherNumber = `JV-${String(seq.rows[0].next_serial).padStart(4, '0')}`;

    const entryResult = await client.query(
      `INSERT INTO journal_entries
         (organization_id, financial_year_id, entry_date, voucher_number, voucher_type, description, status)
       VALUES ($1, $2, $3, $4, 'journal', $5, 'posted')
       RETURNING *`,
      [Number(organizationId), financialYearId, actualEntryDate, voucherNumber, description.trim()]
    );
    const entry = entryResult.rows[0];

    for (const line of lines) {
      await client.query(
        `INSERT INTO journal_lines
           (journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [entry.id, Number(line.accountId), Number(line.debit ?? 0), Number(line.credit ?? 0)]
      );
    }

    await client.query('COMMIT');
    return res.status(201).json({
      ok: true,
      message: 'Journal entry posted successfully',
      entry,
      totalDebit: totalDebit / 100,
      totalCredit: totalCredit / 100
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); }
      catch (rollbackErr) { console.error('Rollback failed:', rollbackErr.message); }
    }
    console.error('Journal entry save error:', err.message);
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Database reference error. Check organization, financial year and account IDs.' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Duplicate voucher or account reference; reload and try again.' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ message: 'Database validation failed. Check voucher type and required fields.' });
    }
    if (err.code === '42703') {
      return res.status(500).json({ message: 'Database schema is not updated. Run accounts_groups_migration.sql in DBeaver.' });
    }
    return res.status(500).json({ message: 'Could not save journal entry' });
  } finally {
    client?.release();
  }
});

// Journal register: aggregate debit/credit lines per voucher and sort serial vouchers numerically.
app.get('/api/journal-entries', async (req, res) => {
  try {
    const { organizationId, from, to } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }
    if (!isValidDate(from) || !isValidDate(to) || (from && to && from > to)) {
      return res.status(400).json({ message: 'Valid date range is required' });
    }

    const result = await pool.query(
      `SELECT
         j.id,
         j.organization_id,
         j.financial_year_id,
         j.entry_date,
         j.voucher_number,
         j.voucher_type,
         j.description,
         j.status,
         j.created_at,
         COALESCE(SUM(l.debit), 0)::numeric(14,2) AS total_debit,
         COALESCE(SUM(l.credit), 0)::numeric(14,2) AS total_credit
       FROM journal_entries j
       LEFT JOIN journal_lines l ON l.journal_entry_id = j.id
       WHERE j.organization_id = $1
         AND ($2::date IS NULL OR j.entry_date >= $2::date)
         AND ($3::date IS NULL OR j.entry_date <= $3::date)
       GROUP BY j.id
       ORDER BY
         CASE WHEN j.voucher_number ~ '^JV-[0-9]{1,5}$' THEN 1 ELSE 0 END,
         CASE WHEN j.voucher_number ~ '^JV-[0-9]{1,5}$'
              THEN SUBSTRING(j.voucher_number FROM '^JV-([0-9]{1,5})$')::integer
              ELSE NULL END ASC,
         j.id ASC`,
      [Number(organizationId), from || null, to || null]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Journal register error:', err.message);
    return res.status(500).json({ message: 'Could not load journal register' });
  }
});

// General ledger: account-wise posted journal transactions
app.get('/api/ledger', async (req, res) => {
  try {
    const { organizationId, accountId, from, to } = req.query;
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(accountId)) {
      return res.status(400).json({ message: 'Valid organizationId and accountId are required' });
    }
    if (!isValidDate(from) || !isValidDate(to) || (from && to && from > to)) {
      return res.status(400).json({ message: 'Valid date range is required' });
    }

    const result = await pool.query(
      `WITH account_entries AS (
         SELECT
           j.id AS journal_entry_id,
           j.entry_date,
           j.voucher_number,
           j.voucher_type,
           j.description,
           a.id AS account_id,
           a.code AS account_code,
           a.name AS account_name,
           a.account_type,
           SUM(l.debit)::numeric(14,2) AS debit,
           SUM(l.credit)::numeric(14,2) AS credit
         FROM journal_lines l
         INNER JOIN journal_entries j ON j.id = l.journal_entry_id
         INNER JOIN accounts a ON a.id = l.account_id
         WHERE j.organization_id = $1
           AND a.organization_id = $1
           AND l.account_id = $2
           AND j.status = 'posted'
           AND ($3::date IS NULL OR j.entry_date >= $3::date)
           AND ($4::date IS NULL OR j.entry_date <= $4::date)
         GROUP BY j.id, j.entry_date, j.voucher_number,
                  j.voucher_type, j.description,
                  a.id, a.code, a.name, a.account_type
       )
       SELECT *,
         SUM(debit - credit) OVER (
           PARTITION BY account_id
           ORDER BY entry_date, journal_entry_id
           ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
         )::numeric(14,2) AS running_balance
       FROM account_entries
       ORDER BY entry_date, journal_entry_id`,
      [Number(organizationId), Number(accountId), from || null, to || null]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('General ledger error:', err.message);
    return res.status(500).json({ message: 'Could not load general ledger' });
  }
});

// Trial Balance: every active ledger account, with balances calculated from posted entries.
app.get('/api/reports/trial-balance', async (req, res) => {
  try {
    const { organizationId, from, to } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }
    if (!isValidDate(from) || !isValidDate(to) || (from && to && from > to)) {
      return res.status(400).json({ message: 'Valid date range is required' });
    }

    const result = await pool.query(
      `WITH account_totals AS (
         SELECT
           l.account_id,
           SUM(l.debit)::numeric(14,2) AS total_debit,
           SUM(l.credit)::numeric(14,2) AS total_credit
         FROM journal_lines l
         INNER JOIN journal_entries j ON j.id = l.journal_entry_id
         WHERE j.organization_id = $1
           AND j.status = 'posted'
           AND ($2::date IS NULL OR j.entry_date >= $2::date)
           AND ($3::date IS NULL OR j.entry_date <= $3::date)
         GROUP BY l.account_id
       )
       SELECT
         a.id AS account_id,
         a.code AS account_code,
         a.name AS account_name,
         a.account_type,
         a.parent_id,
         parent.name AS parent_name,
         COALESCE(t.total_debit, 0)::numeric(14,2) AS total_debit,
         COALESCE(t.total_credit, 0)::numeric(14,2) AS total_credit,
         GREATEST(COALESCE(t.total_debit, 0) - COALESCE(t.total_credit, 0), 0)::numeric(14,2) AS debit_balance,
         GREATEST(COALESCE(t.total_credit, 0) - COALESCE(t.total_debit, 0), 0)::numeric(14,2) AS credit_balance
       FROM accounts a
       LEFT JOIN accounts parent ON parent.id = a.parent_id AND parent.organization_id = a.organization_id
       LEFT JOIN account_totals t ON t.account_id = a.id
       WHERE a.organization_id = $1
         AND a.is_active = TRUE
         AND a.is_group = FALSE
       ORDER BY a.code, a.id`,
      [Number(organizationId), from || null, to || null]
    );

    const totals = result.rows.reduce((acc, row) => {
      acc.debit += Number(row.debit_balance || 0);
      acc.credit += Number(row.credit_balance || 0);
      return acc;
    }, { debit: 0, credit: 0 });

    return res.json({
      organizationId: Number(organizationId),
      accounts: result.rows,
      totals: {
        debit: Number(totals.debit.toFixed(2)),
        credit: Number(totals.credit.toFixed(2))
      }
    });
  } catch (err) {
    console.error('Trial balance error:', err.message);
    if (err.code === '42703') {
      return res.status(500).json({ message: 'Database मा is_group column छैन। पहिले accounts_groups_migration.sql चलाउनुहोस्।' });
    }
    return res.status(500).json({ message: 'Could not generate trial balance' });
  }
});

// ---------------- Student Fees module ----------------
// Billing is tracked in fee tables; income is recognized only when a receipt is posted.
// Each saved receipt and its balanced accounting journal entry are committed atomically.

app.get('/api/fee/students', async (req, res) => {
  try {
    const { organizationId, search = '' } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }
    const result = await pool.query(
      `SELECT id, organization_id, reg_no, admission_no, student_name, class_name, section,
              roll_number, dob_bs, gender, address, photo_url, guardian_name, guardian_phone, is_active, created_at
       FROM public.fee_students
       WHERE organization_id = $1
         AND ($2::text = '' OR COALESCE(NULLIF(reg_no, ''), admission_no) ILIKE '%' || $2 || '%'
              OR student_name ILIKE '%' || $2 || '%'
              OR class_name ILIKE '%' || $2 || '%'
              OR section ILIKE '%' || $2 || '%'
              OR roll_number ILIKE '%' || $2 || '%')
       ORDER BY class_name, section, roll_number, student_name`,
      [Number(organizationId), String(search)]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Fee students list error:', err.message);
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Student Fee tables are not installed. Run student_fee_module_migration.sql in DBeaver.' });
    }
    if (err.code === '42703') {
      return res.status(500).json({ message: 'fee_students मा reg_no column छैन। Updated student_fee_module_migration.sql चलाउनुहोस्।' });
    }
    return res.status(500).json({ message: 'Could not load students' });
  }
});

app.post('/api/fee/students', async (req, res) => {
  try {
    const {
      organizationId, regNo, admissionNo, studentName, className, section,
      rollNumber, guardianName = '', guardianPhone = '', dobBs = '', gender = '', address = '', photoUrl = ''
    } = req.body;
    const normalizedRegNo = String(regNo ?? admissionNo ?? '').trim();
    if (
      !isValidOrganizationId(organizationId) ||
      !normalizedRegNo ||
      typeof studentName !== 'string' || !studentName.trim() ||
      typeof className !== 'string' || !className.trim() ||
      typeof section !== 'string' || !section.trim() ||
      (typeof rollNumber !== 'string' && typeof rollNumber !== 'number') ||
      !String(rollNumber).trim()
    ) {
      return res.status(400).json({ message: 'Reg No, student name, class, section and roll number are required.' });
    }
    const result = await pool.query(
      `INSERT INTO public.fee_students
         (organization_id, reg_no, admission_no, student_name, class_name, section,
          roll_number, guardian_name, guardian_phone, dob_bs, gender, address, photo_url)
       VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [Number(organizationId), normalizedRegNo, studentName.trim(), className.trim(),
       section.trim(), String(rollNumber).trim(), String(guardianName || '').trim() || null,
       String(guardianPhone || '').trim() || null, String(dobBs || '').trim() || null,
       String(gender || '').trim().toLowerCase() || null, String(address || '').trim() || null,
       String(photoUrl || '').trim() || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'यो Reg No वा Class/Section/Roll No पहिले नै दर्ता छ।' });
    }
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Student Fee tables are not installed. Run student_fee_module_migration.sql in DBeaver.' });
    }
    if (err.code === '42703') {
      return res.status(500).json({ message: 'fee_students मा reg_no column छैन। Updated student_fee_module_migration.sql चलाउनुहोस्।' });
    }
    console.error('Create fee student error:', err.message);
    return res.status(500).json({ message: 'Could not save student' });
  }
});

// Bulk Excel import: valid rows are saved, duplicate/invalid rows are skipped with row-level feedback.
app.post('/api/fee/students/import', async (req, res) => {
  const { organizationId, students } = req.body || {};
  if (!isValidOrganizationId(organizationId)) {
    return res.status(400).json({ message: 'Valid organizationId is required' });
  }
  if (!Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: 'Import गर्न कम्तीमा एउटा विद्यार्थी record आवश्यक छ।' });
  }
  if (students.length > 1000) {
    return res.status(413).json({ message: 'एकपटकमा बढीमा 1,000 विद्यार्थी मात्र import गर्न सकिन्छ।' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    let imported = 0;
    let skipped = 0;
    const errors = [];

    for (let index = 0; index < students.length; index += 1) {
      const row = students[index] || {};
      const rowNumber = Number(row.rowNumber) || (index + 2);
      const regNo = String(row.regNo ?? row.reg_no ?? row.admissionNo ?? row.admission_no ?? '').trim();
      const studentName = String(row.studentName ?? row.student_name ?? row.name ?? '').trim();
      const className = String(row.className ?? row.class_name ?? row.class ?? '').trim();
      const section = String(row.section ?? '').trim();
      const rollNumber = String(row.rollNumber ?? row.roll_number ?? row.rollNo ?? '').trim();
      const guardianName = String(row.guardianName ?? row.guardian_name ?? row.parentName ?? '').trim();
      const guardianPhone = String(row.guardianPhone ?? row.guardian_phone ?? row.parentPhone ?? '').trim();
      const dobBs = String(row.dobBs ?? row.dob_bs ?? row.dob ?? '').trim();
      const gender = String(row.gender ?? '').trim().toLowerCase();
      const address = String(row.address ?? '').trim();
      const photoUrl = String(row.photoUrl ?? row.photo_url ?? '').trim();

      const missing = [];
      if (!regNo) missing.push('Reg No');
      if (!studentName) missing.push('Student Name');
      if (!className) missing.push('Class');
      if (!section) missing.push('Section');
      if (!rollNumber) missing.push('Roll Number');
      if (missing.length) {
        skipped += 1;
        errors.push({ rowNumber, regNo, message: `आवश्यक विवरण छैन: ${missing.join(', ')}` });
        continue;
      }

      const result = await client.query(
        `INSERT INTO public.fee_students
           (organization_id, reg_no, admission_no, student_name, class_name, section,
            roll_number, guardian_name, guardian_phone, dob_bs, gender, address, photo_url)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT DO NOTHING
         RETURNING id, reg_no, student_name`,
        [Number(organizationId), regNo, studentName, className, section, rollNumber,
         guardianName || null, guardianPhone || null, dobBs || null, gender || null, address || null, photoUrl || null]
      );
      if (result.rowCount) {
        imported += 1;
      } else {
        skipped += 1;
        errors.push({ rowNumber, regNo, message: 'Duplicate Reg No वा Class/Section/Roll No भएकाले skip गरियो।' });
      }
    }

    await client.query('COMMIT');
    return res.status(201).json({ total: students.length, imported, skipped, errors });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* preserve original error */ }
    }
    console.error('Bulk student import error:', err.message);
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Student Fee tables छैनन्। student_fee_module_migration.sql चलाउनुहोस्।' });
    }
    if (err.code === '42703') {
      return res.status(500).json({ message: 'fee_students मा reg_no column छैन। Updated student_fee_module_migration.sql चलाउनुहोस्।' });
    }
    return res.status(500).json({ message: 'Excel विद्यार्थी import असफल भयो; कुनै partial import save गरिएको छैन।' });
  } finally {
    client?.release();
  }
});

// Student profile APIs for demographics, transport, attendance, discipline and teacher remarks.
app.get('/api/fee/students/:studentId/profile', async (req, res) => {
  try {
    const { organizationId } = req.query;
    const studentId = Number(req.params.studentId);
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId)) return res.status(400).json({ message: 'Valid organizationId and studentId are required.' });
    const studentResult = await pool.query(
      `SELECT id, organization_id, reg_no, admission_no, student_name, class_name, section, roll_number,
              dob_bs, gender, address, photo_url, guardian_name, guardian_phone, is_active, created_at
       FROM public.fee_students WHERE id = $1 AND organization_id = $2`,
      [studentId, Number(organizationId)]
    );
    if (!studentResult.rowCount) return res.status(404).json({ message: 'Student not found.' });
    const [transportResult, attendanceSummaryResult, attendanceRecentResult, disciplineResult, remarksResult] = await Promise.all([
      pool.query('SELECT * FROM public.fee_student_transport WHERE organization_id = $1 AND student_id = $2', [Number(organizationId), studentId]),
      pool.query(`SELECT COUNT(*)::int AS total_marked,
        COUNT(*) FILTER (WHERE status = 'present')::int AS present_days,
        COUNT(*) FILTER (WHERE status = 'absent')::int AS absent_days,
        COUNT(*) FILTER (WHERE status = 'late')::int AS late_days,
        COUNT(*) FILTER (WHERE status = 'leave')::int AS leave_days,
        COALESCE(ROUND(100.0 * COUNT(*) FILTER (WHERE status IN ('present','late')) / NULLIF(COUNT(*),0), 1), 0)::numeric AS attendance_percent
        FROM public.fee_student_attendance WHERE organization_id = $1 AND student_id = $2`, [Number(organizationId), studentId]),
      pool.query('SELECT id, attendance_date, status FROM public.fee_student_attendance WHERE organization_id = $1 AND student_id = $2 ORDER BY attendance_date DESC, id DESC LIMIT 20', [Number(organizationId), studentId]),
      pool.query('SELECT id, incident_date, category, title, description, action_report, created_at FROM public.fee_student_discipline_logs WHERE organization_id = $1 AND student_id = $2 ORDER BY incident_date DESC, id DESC LIMIT 200', [Number(organizationId), studentId]),
      pool.query('SELECT id, remark_date, terminal_remarks, academic_feedback, parent_communication, created_at FROM public.fee_student_teacher_remarks WHERE organization_id = $1 AND student_id = $2 ORDER BY remark_date DESC, id DESC LIMIT 200', [Number(organizationId), studentId])
    ]);
    return res.json({ student: studentResult.rows[0], transport: transportResult.rows[0] || null,
      attendanceSummary: attendanceSummaryResult.rows[0], attendanceRecent: attendanceRecentResult.rows,
      disciplineLogs: disciplineResult.rows, teacherRemarks: remarksResult.rows });
  } catch (err) {
    console.error('Student profile load error:', err.message);
    if (err.code === '42P01') return res.status(500).json({ message: 'Profile support tables छैनन्। Updated student_fee_module_migration.sql चलाउनुहोस्।' });
    if (err.code === '42703') return res.status(500).json({ message: 'Student profile columns छैनन्। Updated student_fee_module_migration.sql चलाउनुहोस्।' });
    return res.status(500).json({ message: 'Could not load student profile.' });
  }
});

app.patch('/api/fee/students/:studentId/profile', async (req, res) => {
  try {
    const { organizationId, studentName, className, section, rollNumber, guardianName, guardianPhone, dobBs, gender, address, photoUrl } = req.body || {};
    const studentId = Number(req.params.studentId);
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId) || !String(studentName || '').trim() || !String(className || '').trim() || !String(section || '').trim() || !String(rollNumber || '').trim()) return res.status(400).json({ message: 'Student name, class, section and roll number are required.' });
    if (gender && !['male','female','other'].includes(String(gender).toLowerCase())) return res.status(400).json({ message: 'Gender male, female or other हुनुपर्छ।' });
    const result = await pool.query(
      `UPDATE public.fee_students SET student_name=$1, class_name=$2, section=$3, roll_number=$4,
       guardian_name=$5, guardian_phone=$6, dob_bs=$7, gender=$8, address=$9, photo_url=$10
       WHERE id=$11 AND organization_id=$12
       RETURNING id, reg_no, admission_no, student_name, class_name, section, roll_number, dob_bs, gender, address, photo_url, guardian_name, guardian_phone, is_active, created_at`,
      [String(studentName).trim(), String(className).trim(), String(section).trim(), String(rollNumber).trim(),
       String(guardianName || '').trim() || null, String(guardianPhone || '').trim() || null,
       String(dobBs || '').trim() || null, String(gender || '').trim().toLowerCase() || null,
       String(address || '').trim() || null, String(photoUrl || '').trim() || null, studentId, Number(organizationId)]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Student not found.' });
    return res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'यो Class/Section/Roll Number अर्को विद्यार्थीले प्रयोग गरिरहेको छ।' });
    console.error('Student profile update error:', err.message);
    return res.status(500).json({ message: 'Could not update student profile.' });
  }
});

app.put('/api/fee/students/:studentId/transport', async (req, res) => {
  try {
    const { organizationId, busRouteNo = '', stopName = '', driverContact = '', pickupTime = '', dropTime = '', busFee = 0 } = req.body || {};
    const studentId = Number(req.params.studentId), amount = Number(busFee || 0);
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId) || !Number.isFinite(amount) || amount < 0 || !validMoney(amount)) return res.status(400).json({ message: 'Valid student, organization and bus fee required.' });
    const student = await pool.query('SELECT id FROM public.fee_students WHERE id=$1 AND organization_id=$2', [studentId, Number(organizationId)]);
    if (!student.rowCount) return res.status(404).json({ message: 'Student not found.' });
    const result = await pool.query(
      `INSERT INTO public.fee_student_transport (organization_id, student_id, bus_route_no, stop_name, driver_contact, pickup_time, drop_time, bus_fee, updated_at)
       VALUES ($1,$2,$3,$4,$5,NULLIF($6,'')::time,NULLIF($7,'')::time,$8,NOW())
       ON CONFLICT (organization_id, student_id) DO UPDATE SET bus_route_no=EXCLUDED.bus_route_no, stop_name=EXCLUDED.stop_name,
       driver_contact=EXCLUDED.driver_contact, pickup_time=EXCLUDED.pickup_time, drop_time=EXCLUDED.drop_time, bus_fee=EXCLUDED.bus_fee, updated_at=NOW()
       RETURNING *`,
      [Number(organizationId), studentId, String(busRouteNo).trim() || null, String(stopName).trim() || null, String(driverContact).trim() || null, String(pickupTime).trim(), String(dropTime).trim(), amount]
    );
    return res.json(result.rows[0]);
  } catch (err) { console.error('Transport save error:', err.message); return res.status(500).json({ message: 'Could not save transport info.' }); }
});

app.post('/api/fee/students/:studentId/discipline', async (req, res) => {
  try {
    const { organizationId, incidentDate, category = 'negative', title, description = '', actionReport = '' } = req.body || {};
    const studentId = Number(req.params.studentId);
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId) || !isValidDate(incidentDate) || !incidentDate || !['positive','negative'].includes(category) || !String(title || '').trim()) return res.status(400).json({ message: 'Valid date, title and positive/negative category required.' });
    const result = await pool.query(
      `INSERT INTO public.fee_student_discipline_logs (organization_id, student_id, incident_date, category, title, description, action_report)
       SELECT $1, s.id, $3::date, $4, $5, NULLIF(BTRIM($6), ''), NULLIF(BTRIM($7), '') FROM public.fee_students s WHERE s.id=$2 AND s.organization_id=$1 RETURNING *`,
      [Number(organizationId), studentId, incidentDate, category, String(title).trim(), String(description), String(actionReport)]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Student not found.' });
    return res.status(201).json(result.rows[0]);
  } catch (err) { console.error('Discipline log save error:', err.message); return res.status(500).json({ message: 'Could not save discipline log.' }); }
});

app.post('/api/fee/students/:studentId/remarks', async (req, res) => {
  try {
    const { organizationId, remarkDate, terminalRemarks = '', academicFeedback = '', parentCommunication = '' } = req.body || {};
    const studentId = Number(req.params.studentId);
    const values = [String(terminalRemarks).trim(), String(academicFeedback).trim(), String(parentCommunication).trim()];
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId) || !isValidDate(remarkDate) || !remarkDate || !values.some(Boolean)) return res.status(400).json({ message: 'मिति र कम्तीमा एउटा remark/feedback/parent communication आवश्यक छ।' });
    const result = await pool.query(
      `INSERT INTO public.fee_student_teacher_remarks (organization_id, student_id, remark_date, terminal_remarks, academic_feedback, parent_communication)
       SELECT $1, s.id, $3::date, NULLIF($4,''), NULLIF($5,''), NULLIF($6,'') FROM public.fee_students s WHERE s.id=$2 AND s.organization_id=$1 RETURNING *`,
      [Number(organizationId), studentId, remarkDate, ...values]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Student not found.' });
    return res.status(201).json(result.rows[0]);
  } catch (err) { console.error('Teacher remark save error:', err.message); return res.status(500).json({ message: 'Could not save teacher remark.' }); }
});

app.post('/api/fee/students/:studentId/attendance', async (req, res) => {
  try {
    const { organizationId, attendanceDate, status } = req.body || {};
    const studentId = Number(req.params.studentId);
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId) || !isValidDate(attendanceDate) || !attendanceDate || !['present','absent','late','leave'].includes(status)) return res.status(400).json({ message: 'Valid attendance date and status required.' });
    const result = await pool.query(
      `INSERT INTO public.fee_student_attendance (organization_id, student_id, attendance_date, status)
       SELECT $1, s.id, $3::date, $4 FROM public.fee_students s WHERE s.id=$2 AND s.organization_id=$1
       ON CONFLICT (organization_id, student_id, attendance_date) DO UPDATE SET status=EXCLUDED.status, updated_at=NOW() RETURNING *`,
      [Number(organizationId), studentId, attendanceDate, status]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Student not found.' });
    return res.status(201).json(result.rows[0]);
  } catch (err) { console.error('Attendance save error:', err.message); return res.status(500).json({ message: 'Could not save student attendance.' }); }
});

app.get('/api/fee/titles', async (req, res) => {
  try {
    const { organizationId } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }
    const result = await pool.query(
      `SELECT ft.id, ft.organization_id, ft.title_code, ft.title,
              ft.income_account_id, a.code AS income_account_code,
              a.name AS income_account_name, ft.default_amount,
              ft.is_monthly, ft.is_active, ft.created_at
       FROM public.fee_titles ft
       INNER JOIN public.accounts a ON a.id = ft.income_account_id
       WHERE ft.organization_id = $1
       ORDER BY ft.is_active DESC, ft.title`,
      [Number(organizationId)]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Fee titles list error:', err.message);
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Student Fee tables are not installed. Run student_fee_module_migration.sql in DBeaver.' });
    }
    return res.status(500).json({ message: 'Could not load fee titles' });
  }
});

app.post('/api/fee/titles', async (req, res) => {
  try {
    const { organizationId, titleCode, title, incomeAccountId, defaultAmount, isMonthly = true } = req.body;
    const amount = Number(defaultAmount);
    if (
      !isValidOrganizationId(organizationId) ||
      typeof titleCode !== 'string' || !titleCode.trim() ||
      typeof title !== 'string' || !title.trim() ||
      !isValidOrganizationId(incomeAccountId) ||
      !Number.isFinite(amount) || amount < 0 || !validMoney(amount)
    ) {
      return res.status(400).json({ message: 'Fee code, fee title, income ledger and valid amount are required.' });
    }
    const account = await pool.query(
      `SELECT id FROM public.accounts
       WHERE id = $1 AND organization_id = $2
         AND LOWER(account_type) = 'income'
         AND COALESCE(is_active, TRUE) = TRUE
         AND COALESCE(is_group, FALSE) = FALSE`,
      [Number(incomeAccountId), Number(organizationId)]
    );
    if (account.rowCount === 0) {
      return res.status(400).json({ message: 'Income type को active Ledger account छान्नुहोस्।' });
    }
    const result = await pool.query(
      `INSERT INTO public.fee_titles
         (organization_id, title_code, title, income_account_id, default_amount, is_monthly)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [Number(organizationId), titleCode.trim(), title.trim(), Number(incomeAccountId), amount, Boolean(isMonthly)]
    );
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ message: 'यो Fee Code पहिले नै प्रयोग भएको छ।' });
    }
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Student Fee tables are not installed. Run student_fee_module_migration.sql in DBeaver.' });
    }
    console.error('Create fee title error:', err.message);
    return res.status(500).json({ message: 'Could not save fee title' });
  }
});

app.get('/api/fee/bills', async (req, res) => {
  try {
    const { organizationId, studentId, month } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }
    if (month && !/^\d{4}-\d{2}$/.test(String(month))) {
      return res.status(400).json({ message: 'month must be YYYY-MM format' });
    }
    const result = await pool.query(
      `WITH received_by_bill AS (
         SELECT r.bill_id, SUM(r.total_amount)::numeric(14,2) AS total_received
         FROM public.fee_receipts r
         WHERE r.organization_id = $1
         GROUP BY r.bill_id
       )
       SELECT b.id, b.organization_id, b.student_id, b.bill_number, b.fee_month,
              b.bill_date, b.due_date, b.total_amount, b.status, b.created_at,
              s.reg_no, s.admission_no, s.student_name, s.class_name, s.section, s.roll_number,
              COALESCE(r.total_received, 0)::numeric(14,2) AS total_received,
              GREATEST(b.total_amount - COALESCE(r.total_received, 0), 0)::numeric(14,2) AS balance_due
       FROM public.fee_bills b
       INNER JOIN public.fee_students s ON s.id = b.student_id
       LEFT JOIN received_by_bill r ON r.bill_id = b.id
       WHERE b.organization_id = $1
         AND ($2::bigint IS NULL OR b.student_id = $2::bigint)
         AND ($3::text IS NULL OR TO_CHAR(b.fee_month, 'YYYY-MM') = $3)
         AND b.status <> 'cancelled'
       ORDER BY b.fee_month DESC, s.class_name, s.section, s.roll_number, b.id DESC`,
      [Number(organizationId), isValidOrganizationId(studentId) ? Number(studentId) : null, month || null]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Fee bills list error:', err.message);
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Student Fee tables are not installed. Run student_fee_module_migration.sql in DBeaver.' });
    }
    return res.status(500).json({ message: 'Could not load fee bills' });
  }
});

app.post('/api/fee/bills', async (req, res) => {
  const { organizationId, studentId, feeMonth, feeMonthEnd = feeMonth, dueDate = null, items } = req.body;
  if (
    !isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId) ||
    typeof feeMonth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(feeMonth) || !isValidDate(feeMonth) ||
    typeof feeMonthEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(feeMonthEnd) || !isValidDate(feeMonthEnd) || feeMonthEnd < feeMonth ||
    !isValidDate(dueDate) || !Array.isArray(items) || !items.length
  ) {
    return res.status(400).json({ message: 'Student, billing month and at least one fee title with amount are required.' });
  }
  const selected = [];
  const seenTitles = new Set();
  for (const item of items) {
    const feeTitleId = Number(item.feeTitleId);
    const amount = Number(item.amount);
    if (!isValidOrganizationId(feeTitleId) || !Number.isFinite(amount) || amount <= 0 || !validMoney(amount) || seenTitles.has(feeTitleId)) {
      return res.status(400).json({ message: 'Each selected fee title must have a unique title and amount greater than zero.' });
    }
    seenTitles.add(feeTitleId);
    selected.push({ feeTitleId, amount });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, 3)', [Number(organizationId)]);

    const student = await client.query(
      `SELECT id FROM public.fee_students
       WHERE id = $1 AND organization_id = $2 AND is_active = TRUE`,
      [Number(studentId), Number(organizationId)]
    );
    if (!student.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'सक्रिय विद्यार्थी भेटिएन।' });
    }

    const titles = await client.query(
      `SELECT ft.id, ft.title, ft.income_account_id
       FROM public.fee_titles ft
       INNER JOIN public.accounts a ON a.id = ft.income_account_id
       WHERE ft.organization_id = $1 AND ft.is_active = TRUE
         AND ft.id = ANY($2::bigint[])
         AND a.organization_id = $1
         AND LOWER(a.account_type) = 'income'
         AND COALESCE(a.is_group, FALSE) = FALSE
         AND COALESCE(a.is_active, TRUE) = TRUE`,
      [Number(organizationId), selected.map(x => x.feeTitleId)]
    );
    if (titles.rowCount !== selected.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'कुनै Fee Title वा Income Ledger inactive/अमान्य छ।' });
    }

    const existing = await client.query(
      `SELECT id FROM public.fee_bills
       WHERE organization_id = $1 AND student_id = $2 AND fee_month BETWEEN $3::date AND $4::date`,
      [Number(organizationId), Number(studentId), feeMonth, feeMonthEnd]
    );
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: 'यो विद्यार्थीका लागि यो महिनाको bill पहिले नै बनाइएको छ।' });
    }

    const seq = await client.query(
      `SELECT COALESCE(MAX(SUBSTRING(bill_number FROM '^FB-([0-9]{1,8})$')::integer), 0) + 1 AS next_serial
       FROM public.fee_bills WHERE organization_id = $1 AND bill_number ~ '^FB-[0-9]{1,8}$'`,
      [Number(organizationId)]
    );
    const billNumber = `FB-${String(seq.rows[0].next_serial).padStart(5, '0')}`;
    const totalAmount = selected.reduce((sum, item) => sum + Math.round(item.amount * 100), 0) / 100;
    const billResult = await client.query(
      `INSERT INTO public.fee_bills
         (organization_id, student_id, bill_number, fee_month, bill_date, due_date, total_amount, status)
       VALUES ($1, $2, $3, $4::date, CURRENT_DATE, $5::date, $6, 'unpaid')
       RETURNING *`,
      [Number(organizationId), Number(studentId), billNumber, feeMonth, dueDate || null, totalAmount]
    );
    const bill = billResult.rows[0];
    const titleMap = new Map(titles.rows.map(t => [Number(t.id), t]));
    for (const item of selected) {
      const title = titleMap.get(item.feeTitleId);
      await client.query(
        `INSERT INTO public.fee_bill_lines (bill_id, fee_title_id, income_account_id, title_name, amount)
         VALUES ($1, $2, $3, $4, $5)`,
        [bill.id, title.id, title.income_account_id, title.title, item.amount]
      );
    }
    await client.query('COMMIT');
    return res.status(201).json({ ok: true, bill: { ...bill, total_amount: totalAmount } });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Bill rollback failed:', rollbackErr.message); }
    }
    if (err.code === '23505') {
      return res.status(409).json({ message: 'यो महिनाको विद्यार्थी Bill पहिले नै छ।' });
    }
    console.error('Create fee bill error:', err.message);
    return res.status(500).json({ message: 'Could not generate monthly bill' });
  } finally {
    client?.release();
  }
});


// Generate monthly bills for every active student in one transaction.
// Existing bills for the selected BS month are skipped (never duplicated).
app.post('/api/fee/bills/bulk', async (req, res) => {
  const { organizationId, feeMonth, feeMonthEnd = feeMonth, dueDate = null, items } = req.body;
  if (
    !isValidOrganizationId(organizationId) ||
    typeof feeMonth !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(feeMonth) || !isValidDate(feeMonth) ||
    typeof feeMonthEnd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(feeMonthEnd) || !isValidDate(feeMonthEnd) || feeMonthEnd < feeMonth ||
    !isValidDate(dueDate) || !Array.isArray(items) || !items.length
  ) {
    return res.status(400).json({ message: 'नेपाली महिना, due date र कम्तीमा एउटा Fee Title/रकम आवश्यक छ।' });
  }

  const selected = [];
  const seenTitles = new Set();
  for (const item of items) {
    const feeTitleId = Number(item.feeTitleId);
    const amount = Number(item.amount);
    if (!isValidOrganizationId(feeTitleId) || !Number.isFinite(amount) || amount <= 0 || !validMoney(amount) || seenTitles.has(feeTitleId)) {
      return res.status(400).json({ message: 'हरेक Fee Title फरक र रकम शून्यभन्दा बढी हुनुपर्छ।' });
    }
    seenTitles.add(feeTitleId);
    selected.push({ feeTitleId, amount });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, 3)', [Number(organizationId)]);

    const titles = await client.query(
      `SELECT ft.id, ft.title, ft.income_account_id
       FROM public.fee_titles ft
       INNER JOIN public.accounts a ON a.id = ft.income_account_id
       WHERE ft.organization_id = $1 AND ft.is_active = TRUE
         AND ft.id = ANY($2::bigint[])
         AND a.organization_id = $1
         AND LOWER(a.account_type) = 'income'
         AND COALESCE(a.is_group, FALSE) = FALSE
         AND COALESCE(a.is_active, TRUE) = TRUE`,
      [Number(organizationId), selected.map(x => x.feeTitleId)]
    );
    if (titles.rowCount !== selected.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'कुनै Fee Title वा Income Ledger inactive/अमान्य छ।' });
    }

    const activeCountResult = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM public.fee_students
       WHERE organization_id = $1 AND is_active = TRUE`,
      [Number(organizationId)]
    );
    const activeStudentCount = Number(activeCountResult.rows[0]?.count || 0);
    if (!activeStudentCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'यस विद्यालयमा सक्रिय विद्यार्थी छैनन्।' });
    }

    const pendingStudents = await client.query(
      `SELECT s.id
       FROM public.fee_students s
       WHERE s.organization_id = $1 AND s.is_active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM public.fee_bills b
           WHERE b.organization_id = $1
             AND b.student_id = s.id
             AND b.fee_month BETWEEN $2::date AND $3::date
         )
       ORDER BY s.class_name, s.section, s.roll_number, s.id
       FOR UPDATE OF s`,
      [Number(organizationId), feeMonth, feeMonthEnd]
    );

    const skippedCount = activeStudentCount - pendingStudents.rowCount;
    if (!pendingStudents.rowCount) {
      await client.query('COMMIT');
      return res.status(200).json({
        ok: true, feeMonth, activeStudentCount, createdCount: 0, skippedCount,
        totalPerStudent: 0, totalBilledAmount: 0,
        message: 'यस नेपाली महिनाका लागि सबै सक्रिय विद्यार्थीको bill पहिल्यै बनेको छ।'
      });
    }

    const serialResult = await client.query(
      `SELECT COALESCE(MAX(SUBSTRING(bill_number FROM '^FB-([0-9]{1,8})$')::integer), 0) + 1 AS next_serial
       FROM public.fee_bills
       WHERE organization_id = $1 AND bill_number ~ '^FB-[0-9]{1,8}$'`,
      [Number(organizationId)]
    );
    const nextSerial = Number(serialResult.rows[0].next_serial);
    const totalAmountCents = selected.reduce((sum, item) => sum + Math.round(item.amount * 100), 0);
    const totalAmount = totalAmountCents / 100;
    if (!Number.isFinite(totalAmount) || totalAmount <= 0 || !validMoney(totalAmount)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'कुल मासिक शुल्क रकम सही छैन।' });
    }

    const insertedBills = await client.query(
      `INSERT INTO public.fee_bills
         (organization_id, student_id, bill_number, fee_month, bill_date, due_date, total_amount, status)
       SELECT $1, s.id,
              'FB-' || CASE
                WHEN LENGTH(($4::bigint + requested.ord - 1)::text) < 5
                  THEN LPAD(($4::bigint + requested.ord - 1)::text, 5, '0')
                ELSE ($4::bigint + requested.ord - 1)::text
              END,
              $2::date, CURRENT_DATE, $3::date, $5::numeric, 'unpaid'
       FROM UNNEST($6::bigint[]) WITH ORDINALITY AS requested(student_id, ord)
       INNER JOIN public.fee_students s
         ON s.id = requested.student_id
        AND s.organization_id = $1
        AND s.is_active = TRUE
       ORDER BY requested.ord
       RETURNING id, student_id, bill_number`,
      [Number(organizationId), feeMonth, dueDate || null, nextSerial, totalAmount, pendingStudents.rows.map(row => Number(row.id))]
    );

    const titleById = new Map(titles.rows.map(title => [Number(title.id), title]));
    const lineBillIds = [];
    const lineTitleIds = [];
    const lineIncomeAccountIds = [];
    const lineTitles = [];
    const lineAmounts = [];
    for (const bill of insertedBills.rows) {
      for (const item of selected) {
        const title = titleById.get(item.feeTitleId);
        lineBillIds.push(Number(bill.id));
        lineTitleIds.push(Number(title.id));
        lineIncomeAccountIds.push(Number(title.income_account_id));
        lineTitles.push(title.title);
        lineAmounts.push(item.amount);
      }
    }

    await client.query(
      `INSERT INTO public.fee_bill_lines
         (bill_id, fee_title_id, income_account_id, title_name, amount)
       SELECT lines.bill_id, lines.fee_title_id, lines.income_account_id, lines.title_name, lines.amount
       FROM UNNEST($1::bigint[], $2::bigint[], $3::integer[], $4::text[], $5::numeric[])
         AS lines(bill_id, fee_title_id, income_account_id, title_name, amount)`,
      [lineBillIds, lineTitleIds, lineIncomeAccountIds, lineTitles, lineAmounts]
    );

    await client.query('COMMIT');
    return res.status(201).json({
      ok: true,
      feeMonth,
      activeStudentCount,
      createdCount: insertedBills.rowCount,
      skippedCount,
      totalPerStudent: totalAmount,
      totalBilledAmount: Math.round(totalAmount * insertedBills.rowCount * 100) / 100,
      firstBillNumber: insertedBills.rows[0]?.bill_number ?? null,
      lastBillNumber: insertedBills.rows[insertedBills.rows.length - 1]?.bill_number ?? null
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Bulk bill rollback failed:', rollbackErr.message); }
    }
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Bill number वा विद्यार्थी/महिनाको duplicate भेटियो। कृपया reload गरी पुनः जाँच्नुहोस्।' });
    }
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Student Fee tables उपलब्ध छैनन्। Migration जाँच गर्नुहोस्।' });
    }
    console.error('Bulk fee bill error:', err.message);
    return res.status(500).json({ message: 'सबै सक्रिय विद्यार्थीको मासिक bill बनाउन सकिएन।' });
  } finally {
    client?.release();
  }
});

app.get('/api/fee/next-receipt-number', async (req, res) => {
  try {
    const { organizationId } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }
    const seq = await pool.query(
      `SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM '^SR-([0-9]{1,8})$')::integer), 0) + 1 AS next_serial
       FROM public.fee_receipts WHERE organization_id = $1 AND receipt_number ~ '^SR-[0-9]{1,8}$'`,
      [Number(organizationId)]
    );
    return res.json({ receiptNumber: `SR-${String(seq.rows[0].next_serial).padStart(5, '0')}` });
  } catch (err) {
    console.error('Next fee receipt number error:', err.message);
    return res.status(500).json({ message: 'Could not generate receipt preview' });
  }
});

app.post('/api/fee/receipts', async (req, res) => {
  const {
    organizationId, billId, receiptDate, paymentMethod, paymentAccountId,
    amount, notes = ''
  } = req.body;
  const receiptAmount = Number(amount);
  if (
    !isValidOrganizationId(organizationId) || !isValidOrganizationId(billId) ||
    !isValidOrganizationId(paymentAccountId) || !isValidDate(receiptDate) ||
    !['cash', 'bank'].includes(String(paymentMethod).toLowerCase()) ||
    !Number.isFinite(receiptAmount) || receiptAmount <= 0 || !validMoney(receiptAmount)
  ) {
    return res.status(400).json({ message: 'Bill, receipt date, Cash/Bank account and valid amount are required.' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::int, 4)', [Number(organizationId)]);

    const billResult = await client.query(
      `SELECT b.*, s.reg_no, s.admission_no, s.student_name, s.class_name, s.section, s.roll_number
       FROM public.fee_bills b
       INNER JOIN public.fee_students s ON s.id = b.student_id
       WHERE b.id = $1 AND b.organization_id = $2 AND s.organization_id = $2
         AND b.status <> 'cancelled'
       FOR UPDATE OF b`,
      [Number(billId), Number(organizationId)]
    );
    if (!billResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Fee bill भेटिएन वा cancel भएको छ।' });
    }
    const bill = billResult.rows[0];

    const accountResult = await client.query(
      `SELECT id, code, name FROM public.accounts
       WHERE id = $1 AND organization_id = $2 AND LOWER(account_type) = 'asset'
         AND COALESCE(is_group, FALSE) = FALSE AND COALESCE(is_active, TRUE) = TRUE`,
      [Number(paymentAccountId), Number(organizationId)]
    );
    if (!accountResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cash वा Bank को active Asset Ledger छान्नुहोस्।' });
    }

    const lineResult = await client.query(
      `SELECT bl.id AS bill_line_id, bl.title_name, bl.income_account_id, bl.amount::numeric(14,2) AS billed,
              COALESCE(p.paid, 0)::numeric(14,2) AS paid,
              ia.name AS income_account_name
       FROM public.fee_bill_lines bl
       LEFT JOIN (
         SELECT bill_line_id, SUM(amount)::numeric(14,2) AS paid
         FROM public.fee_receipt_lines GROUP BY bill_line_id
       ) p ON p.bill_line_id = bl.id
       INNER JOIN public.accounts ia ON ia.id = bl.income_account_id
       WHERE bl.bill_id = $1
       ORDER BY bl.id`,
      [Number(billId)]
    );
    if (!lineResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'यो bill मा fee line छैन।' });
    }

    const billReceivedResult = await client.query(
      'SELECT COALESCE(SUM(total_amount), 0)::numeric(14,2) AS received FROM public.fee_receipts WHERE bill_id = $1',
      [Number(billId)]
    );
    const previousReceived = Number(billReceivedResult.rows[0].received || 0);
    const currentBalance = Number((Number(bill.total_amount) - previousReceived).toFixed(2));
    if (receiptAmount > currentBalance + 0.0001) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: `Receipt amount bill balance भन्दा बढी भयो। बाँकी रकम Rs. ${currentBalance.toFixed(2)} हो।` });
    }

    const fyDate = receiptDate || new Date().toISOString().slice(0, 10);
    const fy = await client.query(
      `SELECT id FROM public.financial_years
       WHERE organization_id = $1 AND start_date <= $2::date AND end_date >= $2::date
         AND is_closed = FALSE ORDER BY start_date DESC LIMIT 1`,
      [Number(organizationId), fyDate]
    );
    if (!fy.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Receipt date का लागि खुला आर्थिक वर्ष भेटिएन।' });
    }

    const seq = await client.query(
      `SELECT COALESCE(MAX(SUBSTRING(receipt_number FROM '^SR-([0-9]{1,8})$')::integer), 0) + 1 AS next_serial
       FROM public.fee_receipts WHERE organization_id = $1 AND receipt_number ~ '^SR-[0-9]{1,8}$'`,
      [Number(organizationId)]
    );
    const receiptNumber = `SR-${String(seq.rows[0].next_serial).padStart(5, '0')}`;

    // Allocate the collection across billed items in order so each receipt credits the correct income ledgers.
    let amountLeftCents = Math.round(receiptAmount * 100);
    const allocations = [];
    for (const row of lineResult.rows) {
      if (amountLeftCents <= 0) break;
      const lineRemainingCents = Math.max(0, Math.round((Number(row.billed) - Number(row.paid)) * 100));
      const allocatedCents = Math.min(amountLeftCents, lineRemainingCents);
      if (allocatedCents > 0) {
        allocations.push({
          billLineId: Number(row.bill_line_id),
          incomeAccountId: Number(row.income_account_id),
          amount: allocatedCents / 100
        });
        amountLeftCents -= allocatedCents;
      }
    }
    if (amountLeftCents > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Bill line बाँकी रकमसँग receipt amount मिलेन।' });
    }

    const incomeTotals = new Map();
    for (const allocation of allocations) {
      incomeTotals.set(
        allocation.incomeAccountId,
        Math.round(((incomeTotals.get(allocation.incomeAccountId) || 0) + allocation.amount) * 100) / 100
      );
    }
    const journalLines = [
      { accountId: Number(paymentAccountId), debit: receiptAmount, credit: 0 },
      ...Array.from(incomeTotals.entries()).map(([accountId, credit]) => ({ accountId, debit: 0, credit }))
    ];
    const creditCents = journalLines.reduce((sum, l) => sum + Math.round(l.credit * 100), 0);
    if (creditCents !== Math.round(receiptAmount * 100)) {
      await client.query('ROLLBACK');
      return res.status(500).json({ message: 'Receipt accounting total does not balance. Nothing was saved.' });
    }

    const description = `Student fee receipt ${receiptNumber} - ${bill.student_name} (${bill.reg_no || bill.admission_no})`;
    const entryResult = await client.query(
      `INSERT INTO public.journal_entries
         (organization_id, financial_year_id, entry_date, voucher_number, voucher_type, description, status)
       VALUES ($1, $2, $3::date, $4, 'receipt', $5, 'posted')
       RETURNING id, voucher_number, entry_date, voucher_type, description, status`,
      [Number(organizationId), fy.rows[0].id, fyDate, receiptNumber, description]
    );
    const entry = entryResult.rows[0];
    for (const line of journalLines) {
      await client.query(
        `INSERT INTO public.journal_lines (journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [entry.id, line.accountId, line.debit, line.credit]
      );
    }

    const receiptResult = await client.query(
      `INSERT INTO public.fee_receipts
         (organization_id, student_id, bill_id, receipt_number, receipt_date, payment_method,
          payment_account_id, total_amount, journal_entry_id, notes)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10)
       RETURNING *`,
      [Number(organizationId), bill.student_id, Number(billId), receiptNumber, fyDate,
       String(paymentMethod).toLowerCase(), Number(paymentAccountId), receiptAmount, entry.id,
       String(notes || '').trim() || null]
    );
    const receipt = receiptResult.rows[0];
    for (const allocation of allocations) {
      await client.query(
        `INSERT INTO public.fee_receipt_lines (receipt_id, bill_line_id, amount)
         VALUES ($1, $2, $3)`,
        [receipt.id, allocation.billLineId, allocation.amount]
      );
    }

    const newTotalReceived = Number((previousReceived + receiptAmount).toFixed(2));
    const newStatus = newTotalReceived >= Number(bill.total_amount) - 0.005 ? 'paid' : 'partially_paid';
    await client.query('UPDATE public.fee_bills SET status = $1 WHERE id = $2', [newStatus, Number(billId)]);
    await client.query('COMMIT');

    return res.status(201).json({
      ok: true,
      message: 'Receipt saved and income posted to accounting ledger.',
      receipt: {
        ...receipt,
        journal_entry_id: entry.id,
        voucher_number: entry.voucher_number,
        student_name: bill.student_name,
        reg_no: bill.reg_no || bill.admission_no,
        admission_no: bill.admission_no,
        class_name: bill.class_name,
        section: bill.section,
        roll_number: bill.roll_number,
        bill_number: bill.bill_number,
        payment_account_name: accountResult.rows[0].name,
        status: newStatus
      },
      allocations
    });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (rollbackErr) { console.error('Receipt rollback failed:', rollbackErr.message); }
    }
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Database reference error. Verify the student, bill, account and financial year.' });
    }
    if (err.code === '23505') {
      return res.status(409).json({ message: 'Receipt number already used. Refresh and try again.' });
    }
    if (err.code === '23514') {
      return res.status(400).json({ message: 'Receipt or journal entry did not pass a database constraint. Nothing was saved.' });
    }
    console.error('Student fee receipt error:', err.message);
    return res.status(500).json({ message: 'Could not save receipt. No receipt should be assumed issued until success is shown.' });
  } finally {
    client?.release();
  }
});

app.get('/api/fee/receipts', async (req, res) => {
  try {
    const { organizationId, studentId } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required' });
    }
    const result = await pool.query(
      `SELECT r.id, r.organization_id, r.student_id, r.bill_id, r.receipt_number,
              r.receipt_date, r.payment_method, r.payment_account_id,
              pa.name AS payment_account_name, r.total_amount, r.journal_entry_id,
              r.notes, r.created_at, b.bill_number,
              s.reg_no, s.admission_no, s.student_name, s.class_name, s.section, s.roll_number
       FROM public.fee_receipts r
       INNER JOIN public.fee_students s ON s.id = r.student_id
       INNER JOIN public.fee_bills b ON b.id = r.bill_id
       INNER JOIN public.accounts pa ON pa.id = r.payment_account_id
       WHERE r.organization_id = $1
         AND ($2::bigint IS NULL OR r.student_id = $2::bigint)
       ORDER BY r.receipt_date DESC, r.id DESC LIMIT 500`,
      [Number(organizationId), isValidOrganizationId(studentId) ? Number(studentId) : null]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('Fee receipts list error:', err.message);
    return res.status(500).json({ message: 'Could not load receipts' });
  }
});

// Fee management dashboard: date-scoped collection, billing, parent contacts and current outstanding.
app.get('/api/fee/dashboard', async (req, res) => {
  try {
    const { organizationId, startDate, endDate, granularity = 'day' } = req.query;
    if (!isValidOrganizationId(organizationId) || !isValidDate(startDate) || !startDate || !isValidDate(endDate) || !endDate || String(startDate) > String(endDate)) {
      return res.status(400).json({ message: 'Valid organizationId and startDate/endDate (YYYY-MM-DD) are required; startDate must not exceed endDate.' });
    }
    const orgId = Number(organizationId);
    const groupBy = granularity === 'month' ? 'month' : 'day';
    const [summaryResult, paymentsResult, trendResult, outstandingResult, classResult] = await Promise.all([
      pool.query(
        `WITH paid_by_bill AS (
           SELECT bill_id, SUM(total_amount)::numeric(14,2) AS received
           FROM public.fee_receipts WHERE organization_id = $1 GROUP BY bill_id
         ), balances AS (
           SELECT b.student_id, b.due_date,
                  GREATEST(b.total_amount - COALESCE(p.received, 0), 0)::numeric(14,2) AS balance_due
           FROM public.fee_bills b
           LEFT JOIN paid_by_bill p ON p.bill_id = b.id
           WHERE b.organization_id = $1 AND b.status <> 'cancelled'
         )
         SELECT
           (SELECT COUNT(*)::int FROM public.fee_students s WHERE s.organization_id = $1 AND s.is_active = TRUE) AS active_students,
           (SELECT COUNT(*)::int FROM public.fee_bills b WHERE b.organization_id = $1 AND b.status <> 'cancelled' AND b.bill_date BETWEEN $2::date AND $3::date) AS bills_in_period,
           (SELECT COALESCE(SUM(b.total_amount), 0)::numeric(14,2) FROM public.fee_bills b WHERE b.organization_id = $1 AND b.status <> 'cancelled' AND b.bill_date BETWEEN $2::date AND $3::date) AS billed_amount,
           (SELECT COUNT(*)::int FROM public.fee_receipts r WHERE r.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date) AS receipt_count,
           (SELECT COALESCE(SUM(r.total_amount), 0)::numeric(14,2) FROM public.fee_receipts r WHERE r.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date) AS collected_amount,
           (SELECT COUNT(DISTINCT r.student_id)::int FROM public.fee_receipts r WHERE r.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date) AS students_paid,
           (SELECT COUNT(DISTINCT b.student_id)::int FROM balances b WHERE b.balance_due > 0) AS students_with_due,
           (SELECT COALESCE(SUM(b.balance_due), 0)::numeric(14,2) FROM balances b WHERE b.balance_due > 0) AS outstanding_amount,
           (SELECT COUNT(DISTINCT b.student_id)::int FROM balances b WHERE b.balance_due > 0 AND b.due_date < CURRENT_DATE) AS overdue_students,
           (SELECT COALESCE(SUM(b.balance_due), 0)::numeric(14,2) FROM balances b WHERE b.balance_due > 0 AND b.due_date < CURRENT_DATE) AS overdue_amount,
           (SELECT COALESCE(SUM(r.total_amount), 0)::numeric(14,2) FROM public.fee_receipts r WHERE r.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date AND r.payment_method = 'cash') AS cash_collected,
           (SELECT COALESCE(SUM(r.total_amount), 0)::numeric(14,2) FROM public.fee_receipts r WHERE r.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date AND r.payment_method = 'bank') AS bank_collected`,
        [orgId, startDate, endDate]
      ),
      pool.query(
        `SELECT r.id, r.organization_id, r.student_id, r.bill_id, r.receipt_number,
                r.receipt_date, r.payment_method, r.payment_account_id,
                pa.name AS payment_account_name, r.total_amount, r.journal_entry_id,
                r.notes, r.created_at, b.bill_number,
                s.reg_no, s.admission_no, s.student_name, s.class_name, s.section, s.roll_number,
                s.guardian_name, s.guardian_phone, s.address
         FROM public.fee_receipts r
         JOIN public.fee_students s ON s.id = r.student_id
         JOIN public.fee_bills b ON b.id = r.bill_id
         JOIN public.accounts pa ON pa.id = r.payment_account_id
         WHERE r.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date
         ORDER BY r.receipt_date DESC, r.id DESC LIMIT 500`,
        [orgId, startDate, endDate]
      ),
      pool.query(
        `SELECT CASE WHEN $4::text = 'month' THEN TO_CHAR(r.receipt_date, 'YYYY-MM') ELSE TO_CHAR(r.receipt_date, 'YYYY-MM-DD') END AS period_key,
                COUNT(*)::int AS receipt_count, SUM(r.total_amount)::numeric(14,2) AS amount
         FROM public.fee_receipts r
         WHERE r.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date
         GROUP BY period_key ORDER BY period_key`,
        [orgId, startDate, endDate, groupBy]
      ),
      pool.query(
        `WITH paid_by_bill AS (
           SELECT bill_id, SUM(total_amount)::numeric(14,2) AS received
           FROM public.fee_receipts WHERE organization_id = $1 GROUP BY bill_id
         ), due_rows AS (
           SELECT b.student_id, b.due_date,
                  GREATEST(b.total_amount - COALESCE(p.received, 0), 0)::numeric(14,2) AS balance_due
           FROM public.fee_bills b LEFT JOIN paid_by_bill p ON p.bill_id = b.id
           WHERE b.organization_id = $1 AND b.status <> 'cancelled'
         )
         SELECT s.id AS student_id, s.reg_no, s.admission_no, s.student_name, s.class_name, s.section, s.roll_number,
                s.guardian_name, s.guardian_phone, s.address,
                SUM(d.balance_due)::numeric(14,2) AS outstanding_amount,
                COALESCE(SUM(CASE WHEN d.due_date < CURRENT_DATE THEN d.balance_due ELSE 0 END), 0)::numeric(14,2) AS overdue_amount,
                MIN(d.due_date) FILTER (WHERE d.balance_due > 0) AS oldest_due_date,
                COUNT(*) FILTER (WHERE d.balance_due > 0)::int AS due_bill_count
         FROM due_rows d JOIN public.fee_students s ON s.id = d.student_id
         WHERE s.organization_id = $1
         GROUP BY s.id, s.reg_no, s.admission_no, s.student_name, s.class_name, s.section, s.roll_number, s.guardian_name, s.guardian_phone, s.address
         HAVING SUM(d.balance_due) > 0
         ORDER BY SUM(d.balance_due) DESC, s.class_name, s.student_name LIMIT 200`,
        [orgId]
      ),
      pool.query(
        `WITH billed AS (
           SELECT s.class_name, s.section, SUM(b.total_amount)::numeric(14,2) AS billed_amount
           FROM public.fee_bills b JOIN public.fee_students s ON s.id = b.student_id
           WHERE b.organization_id = $1 AND s.organization_id = $1 AND b.status <> 'cancelled' AND b.bill_date BETWEEN $2::date AND $3::date
           GROUP BY s.class_name, s.section
         ), paid AS (
           SELECT s.class_name, s.section, SUM(r.total_amount)::numeric(14,2) AS collected_amount, COUNT(*)::int AS receipt_count
           FROM public.fee_receipts r JOIN public.fee_students s ON s.id = r.student_id
           WHERE r.organization_id = $1 AND s.organization_id = $1 AND r.receipt_date BETWEEN $2::date AND $3::date
           GROUP BY s.class_name, s.section
         )
         SELECT COALESCE(b.class_name, p.class_name) AS class_name,
                COALESCE(b.section, p.section) AS section,
                COALESCE(b.billed_amount, 0)::numeric(14,2) AS billed_amount,
                COALESCE(p.collected_amount, 0)::numeric(14,2) AS collected_amount,
                COALESCE(p.receipt_count, 0)::int AS receipt_count
         FROM billed b FULL OUTER JOIN paid p ON p.class_name = b.class_name AND p.section = b.section
         ORDER BY collected_amount DESC, class_name, section`,
        [orgId, startDate, endDate]
      )
    ]);
    return res.json({
      range: { startDate, endDate, granularity: groupBy },
      summary: summaryResult.rows[0] || {},
      payments: paymentsResult.rows,
      trend: trendResult.rows,
      outstanding: outstandingResult.rows,
      classSummary: classResult.rows
    });
  } catch (err) {
    console.error('Fee dashboard error:', err.message);
    if (err.code === '42P01') return res.status(500).json({ message: 'Student Fee tables are not installed. Run student_fee_module_migration.sql in DBeaver.' });
    return res.status(500).json({ message: 'Could not load fee management dashboard' });
  }
});

app.get('/api/fee/student-ledger', async (req, res) => {
  try {
    const { organizationId, studentId } = req.query;
    if (!isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId)) {
      return res.status(400).json({ message: 'Valid organizationId and studentId are required' });
    }
    const studentResult = await pool.query(
      `SELECT id, reg_no, admission_no, student_name, class_name, section, roll_number, guardian_name, guardian_phone
       FROM public.fee_students WHERE id = $1 AND organization_id = $2`,
      [Number(studentId), Number(organizationId)]
    );
    if (!studentResult.rowCount) return res.status(404).json({ message: 'Student not found' });

    const events = await pool.query(
      `SELECT entry_date, entry_type, reference, description, billed, received
       FROM (
         SELECT b.bill_date AS entry_date, 'BILL'::text AS entry_type, b.bill_number AS reference,
                'Monthly fee bill - ' || TO_CHAR(b.fee_month, 'YYYY-MM') AS description,
                b.total_amount::numeric(14,2) AS billed, 0::numeric(14,2) AS received,
                b.id AS sort_id
         FROM public.fee_bills b
         WHERE b.organization_id = $1 AND b.student_id = $2 AND b.status <> 'cancelled'
         UNION ALL
         SELECT r.receipt_date AS entry_date, 'RECEIPT'::text AS entry_type, r.receipt_number AS reference,
                'Fee received (' || UPPER(r.payment_method) || ')' AS description,
                0::numeric(14,2) AS billed, r.total_amount::numeric(14,2) AS received,
                r.id AS sort_id
         FROM public.fee_receipts r
         WHERE r.organization_id = $1 AND r.student_id = $2
       ) ledger
       ORDER BY entry_date, CASE WHEN entry_type = 'BILL' THEN 0 ELSE 1 END, sort_id`,
      [Number(organizationId), Number(studentId)]
    );
    let balanceCents = 0;
    const rows = events.rows.map(row => {
      balanceCents += Math.round((Number(row.billed) - Number(row.received)) * 100);
      return { ...row, running_balance: balanceCents / 100 };
    });
    const totals = rows.reduce((sum, row) => {
      sum.billed += Number(row.billed || 0);
      sum.received += Number(row.received || 0);
      return sum;
    }, { billed: 0, received: 0 });
    return res.json({
      student: studentResult.rows[0],
      rows,
      totals: {
        billed: Number(totals.billed.toFixed(2)),
        received: Number(totals.received.toFixed(2)),
        balance: Number((totals.billed - totals.received).toFixed(2))
      }
    });
  } catch (err) {
    console.error('Student fee ledger error:', err.message);
    return res.status(500).json({ message: 'Could not load student fee ledger' });
  }
});


// ---------------- Examination, marksheet and student progress reports ----------------
// The module reuses public.fee_students; it never creates duplicate student master data.
// All official grading ranges and pass rules are administrator-configured. No rules are seeded.

function examModelForGrade(grade) {
  if (grade <= 5) return 'learning_achievement';
  if (grade <= 8) return 'subject_assessment';
  return 'formal_marksheet';
}

function examEmail(req) {
  return String(req.get('x-user-email') || '').trim().toLowerCase();
}

async function examRoleGuard(req, res, next) {
  try {
    const email = examEmail(req);
    const organizationId = req.query.organizationId || req.body?.organizationId || 1;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required.' });
    }
    if (!email || !email.includes('@')) {
      return res.status(401).json({ message: 'Sign in to an assigned examination-system account.' });
    }
    const roleResult = await pool.query(
      `SELECT role FROM public.exam_role_assignments
       WHERE organization_id = $1 AND LOWER(user_email) = $2 AND is_active = TRUE`,
      [Number(organizationId), email]
    );
    if (!roleResult.rowCount) {
      return res.status(403).json({ message: 'Examination module access छैन। Admin ले तपाईंको email मा role assign गर्नुपर्छ।' });
    }
    const role = roleResult.rows[0].role;
    const path = req.path;
    let allowed;
    if (path === '/roles' && req.method !== 'GET') allowed = ['admin'];
    else if (path === '/report-settings' && req.method !== 'GET') allowed = ['admin'];
    else if (path === '/roles' && req.method === 'GET') allowed = ['admin', 'principal', 'exam_coordinator', 'teacher'];
    else if (/\/print-history$/.test(path)) allowed = ['admin', 'principal', 'exam_coordinator', 'teacher'];
    else if (/\/status$/.test(path)) allowed = ['admin', 'principal', 'exam_coordinator', 'teacher'];
    else if (/\/(marks|competency-results|progress-reports)$/.test(path)) allowed = ['admin', 'exam_coordinator', 'teacher'];
    else if (req.method === 'GET') allowed = ['admin', 'principal', 'exam_coordinator', 'teacher'];
    else allowed = ['admin', 'exam_coordinator'];
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: `यो कार्यका लागि अनुमति छैन। Assigned role: ${role}` });
    }
    req.examActor = { email, role, organizationId: Number(organizationId) };
    return next();
  } catch (err) {
    console.error('Exam role guard error:', err.message);
    if (err.code === '42P01') {
      return res.status(500).json({ message: 'Examination tables छैनन्। पहिले database/examination_module_migration.sql चलाउनुहोस्।' });
    }
    return res.status(500).json({ message: 'Could not verify examination access.' });
  }
}

async function writeExamHistory(client, { organizationId, examId = null, studentId = null, actor, action, oldValue = null, newValue = null, note = null }) {
  await client.query(
    `INSERT INTO public.exam_result_history
       (organization_id, exam_id, student_id, actor_email, actor_role, action, old_value, new_value, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9)`,
    [organizationId, examId, studentId, actor?.email || null, actor?.role || null, action,
      oldValue == null ? null : JSON.stringify(oldValue), newValue == null ? null : JSON.stringify(newValue), note]
  );
}

// Grade-wide examination helper. Existing student data stores class names as Four/Five/etc.;
// exam rows use the compatibility label "Grade N" because exam_exams.class_name is NOT NULL.
const studentGradeSql = (column) => `CASE LOWER(TRIM(COALESCE(${column}, '')))
  WHEN '4' THEN 4 WHEN 'four' THEN 4 WHEN 'fourth' THEN 4 WHEN 'class four' THEN 4 WHEN 'grade four' THEN 4 WHEN 'class 4' THEN 4 WHEN 'grade 4' THEN 4 WHEN 'कक्षा ४' THEN 4
  WHEN '5' THEN 5 WHEN 'five' THEN 5 WHEN 'fifth' THEN 5 WHEN 'class five' THEN 5 WHEN 'grade five' THEN 5 WHEN 'class 5' THEN 5 WHEN 'grade 5' THEN 5 WHEN 'कक्षा ५' THEN 5
  WHEN '6' THEN 6 WHEN 'six' THEN 6 WHEN 'sixth' THEN 6 WHEN 'class six' THEN 6 WHEN 'grade six' THEN 6 WHEN 'class 6' THEN 6 WHEN 'grade 6' THEN 6 WHEN 'कक्षा ६' THEN 6
  WHEN '7' THEN 7 WHEN 'seven' THEN 7 WHEN 'seventh' THEN 7 WHEN 'class seven' THEN 7 WHEN 'grade seven' THEN 7 WHEN 'class 7' THEN 7 WHEN 'grade 7' THEN 7 WHEN 'कक्षा ७' THEN 7
  WHEN '8' THEN 8 WHEN 'eight' THEN 8 WHEN 'eighth' THEN 8 WHEN 'class eight' THEN 8 WHEN 'grade eight' THEN 8 WHEN 'class 8' THEN 8 WHEN 'grade 8' THEN 8 WHEN 'कक्षा ८' THEN 8
  WHEN '9' THEN 9 WHEN 'nine' THEN 9 WHEN 'ninth' THEN 9 WHEN 'class nine' THEN 9 WHEN 'grade nine' THEN 9 WHEN 'class 9' THEN 9 WHEN 'grade 9' THEN 9 WHEN 'कक्षा ९' THEN 9
  WHEN '10' THEN 10 WHEN 'ten' THEN 10 WHEN 'tenth' THEN 10 WHEN 'class ten' THEN 10 WHEN 'grade ten' THEN 10 WHEN 'class 10' THEN 10 WHEN 'grade 10' THEN 10 WHEN 'कक्षा १०' THEN 10
  ELSE NULL END`;

async function fetchExamDetails(organizationId, examId) {
  const examResult = await pool.query(
    `SELECT e.*, ay.year_name
     FROM public.exam_exams e
     JOIN public.exam_academic_years ay ON ay.id = e.academic_year_id
     WHERE e.id = $1 AND e.organization_id = $2`,
    [examId, organizationId]
  );
  if (!examResult.rowCount) return null;
  const exam = examResult.rows[0];
  const [subjectResult, componentResult, rosterResult, marksResult, competencyResult, progressResult, gradingResult, policyResult, levelResult, scheduleResult, attendanceResult] = await Promise.all([
    pool.query(
      `SELECT ees.*, s.subject_code, s.name_en AS subject_name_en, s.name_ne AS subject_name_ne, s.is_practical
       FROM public.exam_exam_subjects ees
       JOIN public.exam_subjects s ON s.id = ees.subject_id
       WHERE ees.exam_id = $1 AND ees.organization_id = $2
       ORDER BY ees.display_order, s.name_en`, [examId, organizationId]),
    pool.query(
      `SELECT c.*, ees.subject_id
       FROM public.exam_assessment_components c
       JOIN public.exam_exam_subjects ees ON ees.id = c.exam_subject_id
       WHERE ees.exam_id = $1 AND c.organization_id = $2
       ORDER BY c.display_order, c.id`, [examId, organizationId]),
    pool.query(
      `SELECT id, organization_id, reg_no, admission_no, student_name, class_name, section, roll_number,
              guardian_name, guardian_phone, dob_bs, gender, address, photo_url
       FROM public.fee_students
       WHERE organization_id = $1 AND is_active = TRUE
         AND (${studentGradeSql('class_name')}) = $2
       ORDER BY CASE WHEN roll_number ~ '^[0-9]+$' THEN roll_number::int END NULLS LAST, roll_number, student_name`,
      [organizationId, Number(exam.grade)]),
    pool.query(
      `SELECT m.*, c.exam_subject_id, c.component_code, c.name_en AS component_name_en, c.name_ne AS component_name_ne,
              c.component_type, c.max_marks, ees.subject_id
       FROM public.exam_marks m
       JOIN public.exam_assessment_components c ON c.id = m.component_id
       JOIN public.exam_exam_subjects ees ON ees.id = c.exam_subject_id
       WHERE ees.exam_id = $1 AND m.organization_id = $2`, [examId, organizationId]),
    pool.query(
      `SELECT cr.*, s.name_en AS subject_name_en, s.name_ne AS subject_name_ne,
              c.competency_code, c.description_en AS competency_en, c.description_ne AS competency_ne,
              al.level_code, al.name_en AS level_name_en, al.name_ne AS level_name_ne
       FROM public.exam_competency_results cr
       JOIN public.exam_subjects s ON s.id = cr.subject_id
       JOIN public.exam_competencies c ON c.id = cr.competency_id
       LEFT JOIN public.exam_achievement_levels al ON al.id = cr.achievement_level_id
       WHERE cr.exam_id = $1 AND cr.organization_id = $2`, [examId, organizationId]),
    pool.query(
      `SELECT * FROM public.exam_progress_reports WHERE exam_id = $1 AND organization_id = $2`, [examId, organizationId]),
    pool.query(
      `SELECT * FROM public.exam_grading_rules
       WHERE organization_id = $1 AND grade = $2 AND is_active = TRUE
         AND (academic_year_id = $3 OR academic_year_id IS NULL)
       ORDER BY CASE WHEN academic_year_id = $3 THEN 0 ELSE 1 END, min_percentage`, [organizationId, exam.grade, exam.academic_year_id]),
    pool.query(
      `SELECT * FROM public.exam_grading_policies
       WHERE organization_id = $1 AND grade = $2
         AND (academic_year_id = $3 OR academic_year_id IS NULL)
       ORDER BY academic_year_id NULLS LAST LIMIT 1`, [organizationId, exam.grade, exam.academic_year_id]),
    pool.query(
      `SELECT * FROM public.exam_achievement_levels
       WHERE organization_id = $1 AND grade = $2 AND is_active = TRUE
       ORDER BY display_order, name_en`, [organizationId, exam.grade]),
    pool.query(
      `SELECT sch.*, ees.subject_id, s.name_en AS subject_name_en, s.name_ne AS subject_name_ne
       FROM public.exam_assessment_schedule sch
       JOIN public.exam_exam_subjects ees ON ees.id=sch.exam_subject_id
       JOIN public.exam_subjects s ON s.id=ees.subject_id
       WHERE sch.exam_id=$1 AND sch.organization_id=$2 ORDER BY sch.exam_date, sch.start_time`, [examId, organizationId]),
    pool.query(
      `SELECT a.student_id,
              COUNT(*) FILTER (WHERE a.status='present')::int AS present_count,
              COUNT(*) FILTER (WHERE a.status='absent')::int AS absent_count,
              COUNT(*) FILTER (WHERE a.status='late')::int AS late_count,
              COUNT(*) FILTER (WHERE a.status='leave')::int AS leave_count,
              COUNT(*)::int AS recorded_days
       FROM public.fee_student_attendance a
       JOIN public.fee_students st ON st.id=a.student_id AND st.organization_id=a.organization_id
       JOIN public.exam_academic_years ay ON ay.id=$2 AND ay.organization_id=$1
       WHERE a.organization_id=$1 AND st.is_active=TRUE
         AND (${studentGradeSql('st.class_name')})=$3
         AND a.attendance_date BETWEEN ay.start_date AND ay.end_date
       GROUP BY a.student_id`, [organizationId, exam.academic_year_id, Number(exam.grade)])
  ]);
  return {
    exam,
    subjects: subjectResult.rows,
    components: componentResult.rows,
    students: rosterResult.rows,
    marks: marksResult.rows,
    competencyResults: competencyResult.rows,
    progressReports: progressResult.rows,
    gradingRules: gradingResult.rows,
    gradingPolicy: policyResult.rows[0] || null,
    achievementLevels: levelResult.rows,
    schedule: scheduleResult.rows,
    attendanceSummary: attendanceResult.rows
  };
}

app.use('/api/exams', examRoleGuard);

app.get('/api/exams/summary', async (req, res) => {
  try {
    const orgId = req.examActor.organizationId;
    const [exams, studentCount, yearCount, rulesCount] = await Promise.all([
      pool.query(`SELECT status, COUNT(*)::int AS count FROM public.exam_exams WHERE organization_id=$1 GROUP BY status`, [orgId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM public.fee_students WHERE organization_id=$1 AND is_active=TRUE AND (${studentGradeSql('class_name')}) BETWEEN 4 AND 10`, [orgId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM public.exam_academic_years WHERE organization_id=$1`, [orgId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM public.exam_grading_rules WHERE organization_id=$1 AND is_active=TRUE AND is_verified=TRUE`, [orgId])
    ]);
    const byStatus = Object.fromEntries(exams.rows.map(r => [r.status, Number(r.count)]));
    res.json({ exams: byStatus, activeStudents: Number(studentCount.rows[0]?.count || 0), academicYears: Number(yearCount.rows[0]?.count || 0), verifiedGradingRules: Number(rulesCount.rows[0]?.count || 0) });
  } catch (err) { console.error('Exam summary error:', err.message); res.status(500).json({ message: 'Could not load examination dashboard.' }); }
});

app.get('/api/exams/academic-years', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM public.exam_academic_years WHERE organization_id=$1 ORDER BY start_date DESC, id DESC`, [req.examActor.organizationId]);
    res.json(result.rows);
  } catch (err) { console.error('Exam years list error:', err.message); res.status(500).json({ message: 'Could not load academic years.' }); }
});

app.post('/api/exams/academic-years', async (req, res) => {
  try {
    const { yearName, startDate, endDate } = req.body || {};
    if (!String(yearName || '').trim() || !isValidDate(startDate) || !isValidDate(endDate) || !startDate || !endDate || endDate < startDate) return res.status(400).json({ message: 'Year name and valid start/end dates are required.' });
    const result = await pool.query(
      `INSERT INTO public.exam_academic_years (organization_id, year_name, start_date, end_date, created_by_email)
       VALUES ($1,$2,$3::date,$4::date,$5) RETURNING *`,
      [req.examActor.organizationId, String(yearName).trim(), startDate, endDate, req.examActor.email]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'यो academic year पहिले नै छ।' });
    console.error('Exam year create error:', err.message); res.status(500).json({ message: 'Could not create academic year.' });
  }
});

app.put('/api/exams/academic-years/:yearId/activate', async (req, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.examActor.organizationId, yearId = Number(req.params.yearId);
    if (!isValidOrganizationId(yearId)) return res.status(400).json({ message: 'Valid academic year ID required.' });
    await client.query('BEGIN');
    const check = await client.query('SELECT * FROM public.exam_academic_years WHERE id=$1 AND organization_id=$2 FOR UPDATE', [yearId, orgId]);
    if (!check.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Academic year not found.' }); }
    await client.query('UPDATE public.exam_academic_years SET is_active=FALSE, updated_at=NOW() WHERE organization_id=$1', [orgId]);
    const updated = await client.query('UPDATE public.exam_academic_years SET is_active=TRUE, updated_at=NOW() WHERE id=$1 AND organization_id=$2 RETURNING *', [yearId, orgId]);
    await client.query('COMMIT'); res.json(updated.rows[0]);
  } catch (err) { await client.query('ROLLBACK').catch(() => {}); console.error('Activate year error:', err.message); res.status(500).json({ message: 'Could not activate academic year.' }); }
  finally { client.release(); }
});

app.get('/api/exams/subjects', async (req, res) => {
  try {
    const orgId = req.examActor.organizationId;
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const result = await pool.query(
      `SELECT * FROM public.exam_subjects WHERE organization_id=$1 AND is_active=TRUE
       AND ($2::smallint IS NULL OR grade=$2) ORDER BY grade, name_en`, [orgId, grade]);
    res.json(result.rows);
  } catch (err) { console.error('Exam subjects list error:', err.message); res.status(500).json({ message: 'Could not load exam subjects.' }); }
});

app.post('/api/exams/subjects', async (req, res) => {
  try {
    const { grade, subjectCode, nameEn, nameNe, isPractical = false } = req.body || {};
    const gradeNum = Number(grade);
    if (!Number.isInteger(gradeNum) || gradeNum < 4 || gradeNum > 10 || !String(subjectCode || '').trim() || !String(nameEn || '').trim() || !String(nameNe || '').trim()) return res.status(400).json({ message: 'Grade 4–10, subject code and both subject names are required.' });
    const result = await pool.query(
      `INSERT INTO public.exam_subjects (organization_id, grade, subject_code, name_en, name_ne, is_practical)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.examActor.organizationId, gradeNum, String(subjectCode).trim(), String(nameEn).trim(), String(nameNe).trim(), Boolean(isPractical)]);
    res.status(201).json(result.rows[0]);
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'यो subject code पहिले नै दर्ता छ।' }); console.error('Exam subject create error:', err.message); res.status(500).json({ message: 'Could not create subject.' }); }
});

app.get('/api/exams/competencies', async (req, res) => {
  try {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const subjectId = req.query.subjectId ? Number(req.query.subjectId) : null;
    const result = await pool.query(
      `SELECT c.*, s.name_en AS subject_name_en, s.name_ne AS subject_name_ne
       FROM public.exam_competencies c JOIN public.exam_subjects s ON s.id=c.subject_id
       WHERE c.organization_id=$1 AND c.is_active=TRUE AND ($2::smallint IS NULL OR c.grade=$2)
         AND ($3::bigint IS NULL OR c.subject_id=$3) ORDER BY c.grade, s.name_en, c.competency_code`,
      [req.examActor.organizationId, grade, subjectId]);
    res.json(result.rows);
  } catch (err) { console.error('Exam competencies list error:', err.message); res.status(500).json({ message: 'Could not load competencies.' }); }
});

app.post('/api/exams/competencies', async (req, res) => {
  try {
    const { grade, subjectId, competencyCode, descriptionEn, descriptionNe, sourceGuideline = '', sourceReference = '' } = req.body || {};
    const g = Number(grade), sid = Number(subjectId);
    if (!Number.isInteger(g) || g < 4 || g > 10 || !isValidOrganizationId(sid) || !String(competencyCode || '').trim() || !String(descriptionEn || '').trim() || !String(descriptionNe || '').trim()) return res.status(400).json({ message: 'Grade, subject, competency code and English/Nepali descriptions are required.' });
    const subject = await pool.query('SELECT id FROM public.exam_subjects WHERE id=$1 AND organization_id=$2 AND grade=$3 AND is_active=TRUE', [sid, req.examActor.organizationId, g]);
    if (!subject.rowCount) return res.status(400).json({ message: 'Subject does not match selected grade.' });
    const result = await pool.query(
      `INSERT INTO public.exam_competencies (organization_id, grade, subject_id, competency_code, description_en, description_ne, source_guideline, source_reference, created_by_email)
       VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),NULLIF($8,''),$9) RETURNING *`,
      [req.examActor.organizationId, g, sid, String(competencyCode).trim(), String(descriptionEn).trim(), String(descriptionNe).trim(), String(sourceGuideline).trim(), String(sourceReference).trim(), req.examActor.email]);
    res.status(201).json(result.rows[0]);
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'यो competency code पहिले नै छ।' }); console.error('Create competency error:', err.message); res.status(500).json({ message: 'Could not create competency.' }); }
});

app.get('/api/exams/achievement-levels', async (req, res) => {
  try {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const result = await pool.query(`SELECT * FROM public.exam_achievement_levels WHERE organization_id=$1 AND is_active=TRUE AND ($2::smallint IS NULL OR grade=$2) ORDER BY grade, display_order, name_en`, [req.examActor.organizationId, grade]);
    res.json(result.rows);
  } catch (err) { console.error('Achievement levels list error:', err.message); res.status(500).json({ message: 'Could not load achievement levels.' }); }
});

app.post('/api/exams/achievement-levels', async (req, res) => {
  try {
    const { grade, levelCode, nameEn, nameNe, descriptionEn = '', descriptionNe = '', sourceGuideline = '', isOfficiallyVerified = false, displayOrder = 1 } = req.body || {};
    const g = Number(grade);
    if (!Number.isInteger(g) || g < 4 || g > 10 || !String(levelCode || '').trim() || !String(nameEn || '').trim() || !String(nameNe || '').trim()) return res.status(400).json({ message: 'Grade and both achievement-level names are required.' });
    if (isOfficiallyVerified && !String(sourceGuideline).trim()) return res.status(400).json({ message: 'Verified official level requires a source guideline.' });
    const result = await pool.query(
      `INSERT INTO public.exam_achievement_levels (organization_id, grade, level_code, name_en, name_ne, description_en, description_ne, source_guideline, is_officially_verified, display_order)
       VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),$9,$10) RETURNING *`,
      [req.examActor.organizationId, g, String(levelCode).trim(), String(nameEn).trim(), String(nameNe).trim(), String(descriptionEn), String(descriptionNe), String(sourceGuideline).trim(), Boolean(isOfficiallyVerified), Number(displayOrder) || 1]);
    res.status(201).json(result.rows[0]);
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'यो achievement level code पहिले नै छ।' }); console.error('Achievement level create error:', err.message); res.status(500).json({ message: 'Could not create achievement level.' }); }
});

app.get('/api/exams/grading-rules', async (req, res) => {
  try {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const yearId = req.query.academicYearId ? Number(req.query.academicYearId) : null;
    const result = await pool.query(
      `SELECT * FROM public.exam_grading_rules WHERE organization_id=$1 AND is_active=TRUE
       AND ($2::smallint IS NULL OR grade=$2) AND ($3::bigint IS NULL OR academic_year_id=$3 OR academic_year_id IS NULL)
       ORDER BY grade, academic_year_id NULLS LAST, min_percentage`, [req.examActor.organizationId, grade, yearId]);
    res.json(result.rows);
  } catch (err) { console.error('Grading rules list error:', err.message); res.status(500).json({ message: 'Could not load grading rules.' }); }
});

app.post('/api/exams/grading-rules', async (req, res) => {
  try {
    const { grade, academicYearId = null, minPercentage, maxPercentage, letterGrade, gradePoint = null, descriptionEn = '', descriptionNe = '', sourceGuideline, sourceClause = '', isVerified = false } = req.body || {};
    const g = Number(grade), min = Number(minPercentage), max = Number(maxPercentage);
    if (!Number.isInteger(g) || g < 4 || g > 10 || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || max < min || !String(letterGrade || '').trim() || !String(sourceGuideline || '').trim()) return res.status(400).json({ message: 'Grade, valid percentage band, grade label and official/source guideline are required.' });
    if (academicYearId) {
      if (!isValidOrganizationId(Number(academicYearId))) return res.status(400).json({ message: 'Valid academic year required.' });
      const yearCheck = await pool.query('SELECT id FROM public.exam_academic_years WHERE id=$1 AND organization_id=$2', [Number(academicYearId), req.examActor.organizationId]);
      if (!yearCheck.rowCount) return res.status(400).json({ message: 'Academic year does not belong to this organization.' });
    }
    if (gradePoint !== null && gradePoint !== '' && (!Number.isFinite(Number(gradePoint)) || Number(gradePoint) < 0)) return res.status(400).json({ message: 'Grade point must be a non-negative number or blank.' });
    const overlap = await pool.query(
      `SELECT id, letter_grade FROM public.exam_grading_rules
       WHERE organization_id=$1 AND grade=$2 AND is_active=TRUE AND academic_year_id IS NOT DISTINCT FROM $3::bigint
         AND NOT ($5::numeric < min_percentage OR $4::numeric > max_percentage)`,
      [req.examActor.organizationId, g, academicYearId ? Number(academicYearId) : null, min, max]);
    if (overlap.rowCount) return res.status(409).json({ message: `यो percentage band पहिलेको ${overlap.rows[0].letter_grade} rule सँग overlap हुन्छ।` });
    if (isVerified && !String(sourceClause || '').trim()) return res.status(400).json({ message: 'Verified rule का लागि source clause/section पनि राख्नुहोस्।' });
    const result = await pool.query(
      `INSERT INTO public.exam_grading_rules (organization_id, academic_year_id, grade, min_percentage, max_percentage, letter_grade, grade_point, description_en, description_ne, source_guideline, source_clause, is_verified, created_by_email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NULLIF($8,''),NULLIF($9,''),$10,NULLIF($11,''),$12,$13) RETURNING *`,
      [req.examActor.organizationId, academicYearId ? Number(academicYearId) : null, g, min, max, String(letterGrade).trim(), gradePoint === null || gradePoint === '' ? null : Number(gradePoint), String(descriptionEn), String(descriptionNe), String(sourceGuideline).trim(), String(sourceClause).trim(), Boolean(isVerified), req.examActor.email]);
    res.status(201).json(result.rows[0]);
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'यो grade rule पहिले नै छ।' }); console.error('Create grading rule error:', err.message); res.status(500).json({ message: 'Could not save grading rule.' }); }
});

async function deactivateExamConfiguration(req, res, tableName, idParam, actionName) {
  if (!['admin', 'exam_coordinator'].includes(req.examActor.role)) return res.status(403).json({ message: 'Admin or exam coordinator role required.' });
  const allowedTables = new Set(['exam_subjects', 'exam_competencies', 'exam_achievement_levels', 'exam_grading_rules']);
  if (!allowedTables.has(tableName)) return res.status(400).json({ message: 'Unsupported configuration type.' });
  const id = Number(req.params[idParam]);
  if (!isValidOrganizationId(id)) return res.status(400).json({ message: 'Valid configuration ID required.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const prior = await client.query(`SELECT * FROM public.${tableName} WHERE id=$1 AND organization_id=$2 FOR UPDATE`, [id, req.examActor.organizationId]);
    if (!prior.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Configuration record not found.' }); }
    const updated = await client.query(`UPDATE public.${tableName} SET is_active=FALSE WHERE id=$1 AND organization_id=$2 RETURNING *`, [id, req.examActor.organizationId]);
    await client.query(`INSERT INTO public.exam_result_history (organization_id, actor_email, actor_role, action, old_value, new_value) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`, [req.examActor.organizationId, req.examActor.email, req.examActor.role, actionName, JSON.stringify(prior.rows[0]), JSON.stringify(updated.rows[0])]);
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`Deactivate ${tableName} error:`, err.message);
    res.status(500).json({ message: 'Could not deactivate configuration. No changes were committed.' });
  } finally { client.release(); }
}

app.put('/api/exams/subjects/:subjectId/deactivate', (req, res) => deactivateExamConfiguration(req, res, 'exam_subjects', 'subjectId', 'subject_deactivated'));
app.put('/api/exams/competencies/:competencyId/deactivate', (req, res) => deactivateExamConfiguration(req, res, 'exam_competencies', 'competencyId', 'competency_deactivated'));
app.put('/api/exams/achievement-levels/:levelId/deactivate', (req, res) => deactivateExamConfiguration(req, res, 'exam_achievement_levels', 'levelId', 'achievement_level_deactivated'));
app.put('/api/exams/grading-rules/:ruleId/deactivate', (req, res) => deactivateExamConfiguration(req, res, 'exam_grading_rules', 'ruleId', 'grading_rule_deactivated'));

app.get('/api/exams/grading-policies', async (req, res) => {
  try {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const yearId = req.query.academicYearId ? Number(req.query.academicYearId) : null;
    const result = await pool.query(
      `SELECT * FROM public.exam_grading_policies WHERE organization_id=$1
       AND ($2::smallint IS NULL OR grade=$2) AND ($3::bigint IS NULL OR academic_year_id=$3 OR academic_year_id IS NULL)
       ORDER BY grade, academic_year_id NULLS LAST`, [req.examActor.organizationId, grade, yearId]);
    res.json(result.rows);
  } catch (err) { console.error('Grading policies list error:', err.message); res.status(500).json({ message: 'Could not load grading policies.' }); }
});

app.put('/api/exams/grading-policies', async (req, res) => {
  try {
    const { grade, academicYearId = null, gpaMethod = 'not_configured', gpaMax = null, overallPassRule = '', promotionRule = '', sourceGuideline = '', sourceClause = '', isVerified = false } = req.body || {};
    const g = Number(grade), allowedMethods = ['not_configured','arithmetic_mean','weighted_by_credit','configured_other'];
    const yearId = academicYearId ? Number(academicYearId) : null;
    const maxGpa = gpaMax === null || gpaMax === '' ? null : Number(gpaMax);
    if (!Number.isInteger(g) || g < 4 || g > 10 || !allowedMethods.includes(gpaMethod)) return res.status(400).json({ message: 'Valid grade and GPA method required.' });
    if (maxGpa !== null && (!Number.isFinite(maxGpa) || maxGpa <= 0)) return res.status(400).json({ message: 'Maximum GPA must be a positive number.' });
    if (gpaMethod !== 'not_configured' && (maxGpa === null || !String(sourceGuideline).trim() || !String(sourceClause).trim())) return res.status(400).json({ message: 'GPA method प्रयोग गर्न maximum GPA र source reference/clause पूरा गर्नुहोस्।' });
    if (isVerified && (!String(sourceGuideline).trim() || !String(sourceClause).trim())) return res.status(400).json({ message: 'Verified grading policy requires official source and clause.' });
    if (yearId !== null) {
      if (!isValidOrganizationId(yearId)) return res.status(400).json({ message: 'Valid academic year required.' });
      const yearCheck = await pool.query('SELECT id FROM public.exam_academic_years WHERE id=$1 AND organization_id=$2', [yearId, req.examActor.organizationId]);
      if (!yearCheck.rowCount) return res.status(400).json({ message: 'Academic year does not belong to this organization.' });
    }
    const values = [gpaMethod, maxGpa, String(overallPassRule), String(promotionRule), String(sourceGuideline), String(sourceClause), Boolean(isVerified), req.examActor.email];
    let result;
    if (yearId !== null) {
      result = await pool.query(
        `INSERT INTO public.exam_grading_policies (organization_id, academic_year_id, grade, gpa_method, gpa_max, overall_pass_rule, promotion_rule, source_guideline, source_clause, is_verified, updated_by_email, updated_at)
         VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),$10,$11,NOW())
         ON CONFLICT (organization_id, academic_year_id, grade) DO UPDATE SET gpa_method=EXCLUDED.gpa_method, gpa_max=EXCLUDED.gpa_max, overall_pass_rule=EXCLUDED.overall_pass_rule, promotion_rule=EXCLUDED.promotion_rule, source_guideline=EXCLUDED.source_guideline, source_clause=EXCLUDED.source_clause, is_verified=EXCLUDED.is_verified, updated_by_email=EXCLUDED.updated_by_email, updated_at=NOW()
         RETURNING *`, [req.examActor.organizationId, yearId, g, ...values.slice(0, 8)]);
    } else {
      const prior = await pool.query('SELECT id FROM public.exam_grading_policies WHERE organization_id=$1 AND academic_year_id IS NULL AND grade=$2 ORDER BY id LIMIT 1', [req.examActor.organizationId, g]);
      if (prior.rowCount) {
        result = await pool.query(
          `UPDATE public.exam_grading_policies SET gpa_method=$1, gpa_max=$2, overall_pass_rule=NULLIF($3,''), promotion_rule=NULLIF($4,''), source_guideline=NULLIF($5,''), source_clause=NULLIF($6,''), is_verified=$7, updated_by_email=$8, updated_at=NOW() WHERE id=$9 RETURNING *`, [...values, prior.rows[0].id]);
      } else {
        result = await pool.query(
          `INSERT INTO public.exam_grading_policies (organization_id, academic_year_id, grade, gpa_method, gpa_max, overall_pass_rule, promotion_rule, source_guideline, source_clause, is_verified, updated_by_email, updated_at)
           VALUES ($1,NULL,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),$9,$10,NOW()) RETURNING *`,
          [req.examActor.organizationId, g, ...values]);
      }
    }
    res.json(result.rows[0]);
  } catch (err) { console.error('Grading policy save error:', err.message); res.status(500).json({ message: 'Could not save grading policy.' }); }
});

app.get('/api/exams', async (req, res) => {
  try {
    const grade = req.query.grade ? Number(req.query.grade) : null;
    const result = await pool.query(
      `SELECT e.*, ay.year_name FROM public.exam_exams e
       JOIN public.exam_academic_years ay ON ay.id=e.academic_year_id
       WHERE e.organization_id=$1 AND ($2::smallint IS NULL OR e.grade=$2)
       ORDER BY e.created_at DESC, e.id DESC`, [req.examActor.organizationId, grade]);
    res.json(result.rows);
  } catch (err) { console.error('Exam list error:', err.message); res.status(500).json({ message: 'Could not load exams.' }); }
});

app.post('/api/exams', async (req, res) => {
  try {
    const { academicYearId, grade, examNameEn, examNameNe, examType = 'terminal', examDate = null, examDateBs = '' } = req.body || {};
    const g = Number(grade), yearId = Number(academicYearId), orgId = req.examActor.organizationId;
    if (!isValidOrganizationId(yearId) || !Number.isInteger(g) || g < 4 || g > 10 || !String(examNameEn || '').trim() || !String(examNameNe || '').trim() || !['terminal','unit','annual','final','practical','other'].includes(examType) || (examDate && !isValidDate(examDate))) {
      return res.status(400).json({ message: 'Academic year, grade, exam names and valid date/type are required.' });
    }
    const model = examModelForGrade(g);
    const yearCheck = await pool.query('SELECT id FROM public.exam_academic_years WHERE id=$1 AND organization_id=$2', [yearId, orgId]);
    if (!yearCheck.rowCount) return res.status(400).json({ message: 'Academic year not found.' });
    const students = await pool.query(
      `SELECT COUNT(*)::int AS n FROM public.fee_students
       WHERE organization_id=$1 AND is_active=TRUE AND (${studentGradeSql('class_name')})=$2`,
      [orgId, g]);
    if (!Number(students.rows[0]?.n || 0)) return res.status(400).json({ message: 'यस कक्षामा सक्रिय विद्यार्थी भेटिएनन्। विद्यार्थीको class_name कक्षा ४–१० सँग मिल्ने गरी जाँच्नुहोस्।' });

    // Prevent duplicate grade-wide draft exams with the same name/type/year.
    const compatibilityClassName = `Grade ${g}`;
    const existing = await pool.query(
      `SELECT id FROM public.exam_exams
       WHERE organization_id=$1 AND academic_year_id=$2 AND grade=$3
         AND class_name=$4 AND section IS NULL
         AND LOWER(TRIM(exam_name_en))=LOWER(TRIM($5))
         AND exam_type=$6 AND status='draft'
       LIMIT 1`,
      [orgId, yearId, g, compatibilityClassName, String(examNameEn).trim(), examType]);
    if (existing.rowCount) return res.status(409).json({ message: 'यस कक्षा र शैक्षिक सत्रमा यही नाम/प्रकारको Draft Exam पहिले नै छ। पुरानो परीक्षा छानेर प्रयोग गर्नुहोस्।' });

    const result = await pool.query(
      `INSERT INTO public.exam_exams (organization_id, academic_year_id, grade, class_name, section, exam_name_en, exam_name_ne, exam_type, assessment_model, exam_date, exam_date_bs, created_by_email)
       VALUES ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9::date,NULLIF($10,''),$11) RETURNING *`,
      [orgId, yearId, g, compatibilityClassName, String(examNameEn).trim(), String(examNameNe).trim(), examType, model, examDate || null, String(examDateBs).trim(), req.examActor.email]);
    await pool.query(`INSERT INTO public.exam_result_history (organization_id, exam_id, actor_email, actor_role, action, new_value) VALUES ($1,$2,$3,$4,'exam_created',$5::jsonb)`, [orgId, result.rows[0].id, req.examActor.email, req.examActor.role, JSON.stringify(result.rows[0])]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error('Create exam error:', err.message); res.status(500).json({ message: 'Could not create examination.' }); }
});

app.post('/api/exams/:examId/subjects', async (req, res) => {
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId);
    const { subjectId, fullMarks = null, passMarks = null, creditHours = null, displayOrder = 1 } = req.body || {};
    if (!isValidOrganizationId(examId) || !isValidOrganizationId(subjectId)) return res.status(400).json({ message: 'Valid exam and subject required.' });
    const exam = await pool.query('SELECT grade,status FROM public.exam_exams WHERE id=$1 AND organization_id=$2', [examId, orgId]);
    if (!exam.rowCount) return res.status(404).json({ message: 'Exam not found.' });
    if (!['draft','in_review'].includes(exam.rows[0].status)) return res.status(409).json({ message: 'Approved/locked/published exam cannot be modified.' });
    const subj = await pool.query('SELECT id FROM public.exam_subjects WHERE id=$1 AND organization_id=$2 AND grade=$3 AND is_active=TRUE', [Number(subjectId), orgId, exam.rows[0].grade]);
    if (!subj.rowCount) return res.status(400).json({ message: 'Subject must be active and match the exam grade.' });
    const full = fullMarks === null || fullMarks === '' ? null : Number(fullMarks), pass = passMarks === null || passMarks === '' ? null : Number(passMarks), credits = creditHours === null || creditHours === '' ? null : Number(creditHours);
    if ((full !== null && (!validMoney(full) || full <= 0)) || (pass !== null && (!validMoney(pass) || pass < 0 || (full !== null && pass > full))) || (credits !== null && (!Number.isFinite(credits) || credits <= 0))) return res.status(400).json({ message: 'Full marks, pass marks or credit hours are invalid.' });
    const result = await pool.query(
      `INSERT INTO public.exam_exam_subjects (organization_id, exam_id, subject_id, full_marks, pass_marks, credit_hours, display_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, examId, Number(subjectId), full, pass, credits, Number(displayOrder) || 1]);
    res.status(201).json(result.rows[0]);
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'यो subject exam मा पहिल्यै छ।' }); console.error('Exam subject setup error:', err.message); res.status(500).json({ message: 'Could not configure exam subject.' }); }
});

app.post('/api/exams/:examId/subjects/:examSubjectId/components', async (req, res) => {
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId), examSubjectId = Number(req.params.examSubjectId);
    const { componentCode, nameEn, nameNe, componentType = 'other', maxMarks = null, passMarks = null, displayOrder = 1 } = req.body || {};
    const types = ['written','internal','practical','project','continuous','presentation','portfolio','oral','other'];
    if (!isValidOrganizationId(examId) || !isValidOrganizationId(examSubjectId) || !String(componentCode || '').trim() || !String(nameEn || '').trim() || !String(nameNe || '').trim() || !types.includes(componentType)) return res.status(400).json({ message: 'Component code, bilingual name and valid component type are required.' });
    const link = await pool.query(`SELECT e.status, ees.full_marks FROM public.exam_exams e JOIN public.exam_exam_subjects ees ON ees.exam_id=e.id WHERE e.id=$1 AND ees.id=$2 AND e.organization_id=$3`, [examId, examSubjectId, orgId]);
    if (!link.rowCount) return res.status(404).json({ message: 'Exam subject not found.' });
    if (!['draft','in_review'].includes(link.rows[0].status)) return res.status(409).json({ message: 'Approved/locked/published exam cannot be modified.' });
    const max = maxMarks === null || maxMarks === '' ? null : Number(maxMarks);
    const pass = passMarks === null || passMarks === '' ? null : Number(passMarks);
    if (max !== null && (!validMoney(max) || max <= 0)) return res.status(400).json({ message: 'Maximum marks must be a positive amount or blank for descriptive assessment.' });
    if (pass !== null && (!validMoney(pass) || pass < 0 || max === null || pass > max)) return res.status(400).json({ message: 'Component pass marks must be non-negative and not exceed a configured maximum.' });
    if (max !== null && link.rows[0].full_marks !== null) {
      const total = await pool.query('SELECT COALESCE(SUM(max_marks),0) AS n FROM public.exam_assessment_components WHERE exam_subject_id=$1', [examSubjectId]);
      if (Number(total.rows[0].n) + max > Number(link.rows[0].full_marks) + 0.001) return res.status(400).json({ message: 'Component maximum total exceeds configured subject full marks.' });
    }
    const result = await pool.query(
      `INSERT INTO public.exam_assessment_components (organization_id, exam_subject_id, component_code, name_en, name_ne, component_type, max_marks, pass_marks, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [orgId, examSubjectId, String(componentCode).trim(), String(nameEn).trim(), String(nameNe).trim(), componentType, max, pass, Number(displayOrder) || 1]);
    res.status(201).json(result.rows[0]);
  } catch (err) { if (err.code === '23505') return res.status(409).json({ message: 'यो component code पहिले नै छ।' }); console.error('Component setup error:', err.message); res.status(500).json({ message: 'Could not save component.' }); }
});

app.get('/api/exams/:examId/details', async (req, res) => {
  try {
    const id = Number(req.params.examId);
    if (!isValidOrganizationId(id)) return res.status(400).json({ message: 'Valid exam ID required.' });
    const details = await fetchExamDetails(req.examActor.organizationId, id);
    if (!details) return res.status(404).json({ message: 'Exam not found.' });
    res.json(details);
  } catch (err) { console.error('Exam details error:', err.message); res.status(500).json({ message: 'Could not load exam details.' }); }
});

app.post('/api/exams/:examId/marks', async (req, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId);
    const marks = req.body?.marks;
    if (!isValidOrganizationId(examId) || !Array.isArray(marks) || !marks.length || marks.length > 2000) return res.status(400).json({ message: 'Exam ID र 1–2000 marks entries आवश्यक छन्।' });
    await client.query('BEGIN');
    const examResult = await client.query('SELECT * FROM public.exam_exams WHERE id=$1 AND organization_id=$2 FOR UPDATE', [examId, orgId]);
    if (!examResult.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found.' }); }
    const exam = examResult.rows[0];
    if (!['draft','in_review'].includes(exam.status)) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Approved, locked or published result cannot be edited.' }); }
    let saved = 0;
    for (const item of marks) {
      const componentId = Number(item.componentId), studentId = Number(item.studentId);
      const absent = Boolean(item.isAbsent);
      const rawMark = item.marksObtained;
      const mark = rawMark === '' || rawMark === null || rawMark === undefined ? null : Number(rawMark);
      if (!isValidOrganizationId(componentId) || !isValidOrganizationId(studentId) || (!absent && mark !== null && (!validMoney(mark) || mark < 0))) throw Object.assign(new Error('Invalid student/component/marks value.'), { status: 400 });
      if (absent && mark !== null) throw Object.assign(new Error('Absent student cannot have obtained marks.'), { status: 400 });
      const context = await client.query(
        `SELECT c.id AS component_id, c.max_marks, c.name_en, ees.id AS exam_subject_id, s.id AS student_id, s.class_name, s.section
         FROM public.exam_assessment_components c JOIN public.exam_exam_subjects ees ON ees.id=c.exam_subject_id
         JOIN public.exam_exams e ON e.id=ees.exam_id
         JOIN public.fee_students s ON s.id=$3
         WHERE c.id=$1 AND e.id=$2 AND e.organization_id=$4 AND c.organization_id=$4
           AND s.organization_id=$4 AND s.is_active=TRUE AND (${studentGradeSql('s.class_name')})=e.grade`,
        [componentId, examId, studentId, orgId]);
      if (!context.rowCount) throw Object.assign(new Error('Student or component does not belong to this exam/class.'), { status: 400 });
      const c = context.rows[0];
      if (mark !== null && c.max_marks === null) throw Object.assign(new Error(`Component “${c.name_en}” is descriptive only; numerical marks are not configured.`), { status: 400 });
      if (mark !== null && mark > Number(c.max_marks)) throw Object.assign(new Error(`Marks exceed maximum for ${c.name_en}.`), { status: 400 });
      const prior = await client.query('SELECT marks_obtained, is_absent, teacher_note FROM public.exam_marks WHERE component_id=$1 AND student_id=$2 AND organization_id=$3', [componentId, studentId, orgId]);
      const updated = await client.query(
        `INSERT INTO public.exam_marks (organization_id, component_id, student_id, marks_obtained, is_absent, teacher_note, updated_by_email, updated_at)
         VALUES ($1,$2,$3,$4,$5,NULLIF($6,''),$7,NOW())
         ON CONFLICT (component_id, student_id) DO UPDATE SET marks_obtained=EXCLUDED.marks_obtained, is_absent=EXCLUDED.is_absent, teacher_note=EXCLUDED.teacher_note, updated_by_email=EXCLUDED.updated_by_email, updated_at=NOW()
         RETURNING *`,
        [orgId, componentId, studentId, mark, absent, String(item.teacherNote || '').trim(), req.examActor.email]);
      await writeExamHistory(client, { organizationId: orgId, examId, studentId, actor: req.examActor, action: 'marks_saved', oldValue: prior.rows[0] || null, newValue: updated.rows[0] });
      saved += 1;
    }
    await client.query('COMMIT');
    res.json({ ok: true, saved, message: `${saved} marks records saved.` });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Exam marks save error:', err.message);
    res.status(err.status || 500).json({ message: err.status ? err.message : 'Could not save marks. No changes were committed.' });
  } finally { client.release(); }
});

app.post('/api/exams/:examId/competency-results', async (req, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId);
    const { studentId, subjectId, competencyId, achievementLevelId = null, observationEn = '', observationNe = '', evidenceNote = '', nextStepsEn = '', nextStepsNe = '' } = req.body || {};
    const sid = Number(studentId), subid = Number(subjectId), cid = Number(competencyId), levelId = achievementLevelId ? Number(achievementLevelId) : null;
    if (![examId, sid, subid, cid].every(isValidOrganizationId) || (levelId !== null && !isValidOrganizationId(levelId))) return res.status(400).json({ message: 'Valid exam, student, subject and competency are required.' });
    await client.query('BEGIN');
    const exam = await client.query('SELECT * FROM public.exam_exams WHERE id=$1 AND organization_id=$2 FOR UPDATE', [examId, orgId]);
    if (!exam.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found.' }); }
    if (!['draft','in_review'].includes(exam.rows[0].status)) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Approved, locked or published result cannot be edited.' }); }
    const valid = await client.query(
      `SELECT s.id FROM public.fee_students s JOIN public.exam_exams e ON e.id=$2
       JOIN public.exam_exam_subjects ees ON ees.exam_id=e.id AND ees.subject_id=$3
       JOIN public.exam_competencies c ON c.id=$4 AND c.subject_id=ees.subject_id AND c.grade=e.grade
       WHERE s.id=$1 AND s.organization_id=$5 AND e.organization_id=$5 AND s.is_active=TRUE AND (${studentGradeSql('s.class_name')})=e.grade`,
      [sid, examId, subid, cid, orgId]);
    if (!valid.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Student, subject and competency must match the selected exam.' }); }
    if (levelId !== null) {
      const l = await client.query('SELECT id FROM public.exam_achievement_levels WHERE id=$1 AND organization_id=$2 AND grade=$3 AND is_active=TRUE', [levelId, orgId, exam.rows[0].grade]);
      if (!l.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Achievement level is not configured for this grade.' }); }
    }
    const prior = await client.query('SELECT * FROM public.exam_competency_results WHERE exam_id=$1 AND competency_id=$2 AND student_id=$3', [examId, cid, sid]);
    const result = await client.query(
      `INSERT INTO public.exam_competency_results (organization_id, exam_id, subject_id, competency_id, student_id, achievement_level_id, observation_en, observation_ne, evidence_note, next_steps_en, next_steps_ne, updated_by_email, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),$12,NOW())
       ON CONFLICT (exam_id, competency_id, student_id) DO UPDATE SET achievement_level_id=EXCLUDED.achievement_level_id, observation_en=EXCLUDED.observation_en, observation_ne=EXCLUDED.observation_ne, evidence_note=EXCLUDED.evidence_note, next_steps_en=EXCLUDED.next_steps_en, next_steps_ne=EXCLUDED.next_steps_ne, updated_by_email=EXCLUDED.updated_by_email, updated_at=NOW()
       RETURNING *`,
      [orgId, examId, subid, cid, sid, levelId, String(observationEn), String(observationNe), String(evidenceNote), String(nextStepsEn), String(nextStepsNe), req.examActor.email]);
    await writeExamHistory(client, { organizationId: orgId, examId, studentId: sid, actor: req.examActor, action: 'competency_result_saved', oldValue: prior.rows[0] || null, newValue: result.rows[0] });
    await client.query('COMMIT'); res.status(201).json(result.rows[0]);
  } catch (err) { await client.query('ROLLBACK').catch(() => {}); console.error('Competency result save error:', err.message); res.status(500).json({ message: 'Could not save competency result. No changes were committed.' }); }
  finally { client.release(); }
});

app.post('/api/exams/:examId/progress-reports', async (req, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId);
    const body = req.body || {}, studentId = Number(body.studentId);
    if (!isValidOrganizationId(examId) || !isValidOrganizationId(studentId)) return res.status(400).json({ message: 'Exam and student are required.' });
    await client.query('BEGIN');
    const exam = await client.query('SELECT * FROM public.exam_exams WHERE id=$1 AND organization_id=$2 FOR UPDATE', [examId, orgId]);
    if (!exam.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found.' }); }
    if (!['draft','in_review'].includes(exam.rows[0].status)) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Approved, locked or published progress reports cannot be edited.' }); }
    const student = await client.query(`SELECT id FROM public.fee_students WHERE id=$1 AND organization_id=$2 AND is_active=TRUE AND (${studentGradeSql('class_name')})=$3`, [studentId, orgId, Number(exam.rows[0].grade)]);
    if (!student.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Student does not belong to this exam class.' }); }
    const fields = ['strengthsEn','strengthsNe','improvementAreasEn','improvementAreasNe','teacherCommentsEn','teacherCommentsNe','recommendationsEn','recommendationsNe','parentFeedback'];
    const text = fields.map(k => String(body[k] || '').trim());
    const present = body.attendancePresent === '' || body.attendancePresent == null ? null : Number(body.attendancePresent);
    const total = body.attendanceTotal === '' || body.attendanceTotal == null ? null : Number(body.attendanceTotal);
    if ((present !== null && (!Number.isInteger(present) || present < 0)) || (total !== null && (!Number.isInteger(total) || total < 0)) || (present !== null && total !== null && present > total)) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Attendance counts are invalid.' }); }
    const prior = await client.query('SELECT * FROM public.exam_progress_reports WHERE exam_id=$1 AND student_id=$2', [examId, studentId]);
    const result = await client.query(
      `INSERT INTO public.exam_progress_reports (organization_id, exam_id, student_id, strengths_en, strengths_ne, improvement_areas_en, improvement_areas_ne, teacher_comments_en, teacher_comments_ne, recommendations_en, recommendations_ne, parent_feedback, attendance_present, attendance_total, updated_by_email, updated_at)
       VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),NULLIF($12,''),$13,$14,$15,NOW())
       ON CONFLICT (exam_id, student_id) DO UPDATE SET strengths_en=EXCLUDED.strengths_en, strengths_ne=EXCLUDED.strengths_ne, improvement_areas_en=EXCLUDED.improvement_areas_en, improvement_areas_ne=EXCLUDED.improvement_areas_ne, teacher_comments_en=EXCLUDED.teacher_comments_en, teacher_comments_ne=EXCLUDED.teacher_comments_ne, recommendations_en=EXCLUDED.recommendations_en, recommendations_ne=EXCLUDED.recommendations_ne, parent_feedback=EXCLUDED.parent_feedback, attendance_present=EXCLUDED.attendance_present, attendance_total=EXCLUDED.attendance_total, updated_by_email=EXCLUDED.updated_by_email, updated_at=NOW()
       RETURNING *`, [orgId, examId, studentId, ...text, present, total, req.examActor.email]);
    await writeExamHistory(client, { organizationId: orgId, examId, studentId, actor: req.examActor, action: 'progress_report_saved', oldValue: prior.rows[0] || null, newValue: result.rows[0] });
    await client.query('COMMIT'); res.status(201).json(result.rows[0]);
  } catch (err) { await client.query('ROLLBACK').catch(() => {}); console.error('Progress report save error:', err.message); res.status(500).json({ message: 'Could not save progress report. No changes were committed.' }); }
  finally { client.release(); }
});

app.put('/api/exams/:examId/schedule', async (req, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId);
    const { examSubjectId, examDate = null, examDateBs = '', startTime = '', endTime = '', roomOrVenue = '', invigilator = '' } = req.body || {};
    const subjectId = Number(examSubjectId);
    if (!isValidOrganizationId(examId) || !isValidOrganizationId(subjectId) || (examDate && !isValidDate(examDate))) return res.status(400).json({ message: 'Valid exam, subject and date are required.' });
    if (startTime && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(startTime)) return res.status(400).json({ message: 'Invalid start time.' });
    if (endTime && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(endTime)) return res.status(400).json({ message: 'Invalid end time.' });
    if (startTime && endTime && endTime <= startTime) return res.status(400).json({ message: 'End time must be later than start time.' });
    await client.query('BEGIN');
    const exam = await client.query('SELECT status FROM public.exam_exams WHERE id=$1 AND organization_id=$2 FOR UPDATE', [examId, orgId]);
    if (!exam.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found.' }); }
    if (!['draft','in_review'].includes(exam.rows[0].status)) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Approved/locked/published schedule cannot be modified.' }); }
    const subject = await client.query('SELECT id FROM public.exam_exam_subjects WHERE id=$1 AND exam_id=$2 AND organization_id=$3', [subjectId, examId, orgId]);
    if (!subject.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Subject is not part of this exam.' }); }
    const prior = await client.query('SELECT * FROM public.exam_assessment_schedule WHERE exam_id=$1 AND exam_subject_id=$2', [examId, subjectId]);
    const result = await client.query(
      `INSERT INTO public.exam_assessment_schedule (organization_id, exam_id, exam_subject_id, exam_date, exam_date_bs, start_time, end_time, room_or_venue, invigilator, updated_by_email, updated_at)
       VALUES ($1,$2,$3,$4::date,NULLIF($5,''),NULLIF($6,'')::time,NULLIF($7,'')::time,NULLIF($8,''),NULLIF($9,''),$10,NOW())
       ON CONFLICT (exam_id, exam_subject_id) DO UPDATE SET exam_date=EXCLUDED.exam_date, exam_date_bs=EXCLUDED.exam_date_bs, start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time, room_or_venue=EXCLUDED.room_or_venue, invigilator=EXCLUDED.invigilator, updated_by_email=EXCLUDED.updated_by_email, updated_at=NOW()
       RETURNING *`, [orgId, examId, subjectId, examDate || null, String(examDateBs), String(startTime), String(endTime), String(roomOrVenue), String(invigilator), req.examActor.email]);
    await writeExamHistory(client, { organizationId: orgId, examId, actor: req.examActor, action: 'exam_schedule_saved', oldValue: prior.rows[0] || null, newValue: result.rows[0] });
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Exam schedule save error:', err.message);
    res.status(500).json({ message: 'Could not save examination schedule. No changes were committed.' });
  } finally { client.release(); }
});

app.post('/api/exams/:examId/print-history', async (req, res) => {
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId);
    const reportType = String(req.body?.reportType || '');
    const studentId = req.body?.studentId ? Number(req.body.studentId) : null;
    const allowedTypes = ['standard_marksheet','progress_report','bulk_marksheet','bulk_progress_report'];
    if (!isValidOrganizationId(examId) || !allowedTypes.includes(reportType)) return res.status(400).json({ message: 'Valid exam and report type required.' });
    const exam = await pool.query('SELECT id, grade, class_name, section, status, exam_name_en, exam_name_ne, academic_year_id FROM public.exam_exams WHERE id=$1 AND organization_id=$2', [examId, orgId]);
    if (!exam.rowCount) return res.status(404).json({ message: 'Exam not found.' });
    let count = 0, student = null;
    if (studentId) {
      const result = await pool.query(`SELECT id, student_name, reg_no, admission_no, class_name, section, roll_number FROM public.fee_students WHERE id=$1 AND organization_id=$2 AND (${studentGradeSql('class_name')})=$3`, [studentId, orgId, Number(exam.rows[0].grade)]);
      if (!result.rowCount) return res.status(400).json({ message: 'Student does not belong to this exam.' });
      student = result.rows[0]; count = 1;
    } else {
      const result = await pool.query(`SELECT COUNT(*)::int AS n FROM public.fee_students WHERE organization_id=$1 AND is_active=TRUE AND (${studentGradeSql('class_name')})=$2`, [orgId, Number(exam.rows[0].grade)]);
      count = Number(result.rows[0]?.n || 0);
    }
    const snapshot = { exam: exam.rows[0], student, reportType, studentsCount: count, generatedBy: req.examActor.email };
    const result = await pool.query(
      `INSERT INTO public.exam_report_history (organization_id, exam_id, student_id, report_type, students_count, exam_status, generated_by_email, snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) RETURNING *`,
      [orgId, examId, studentId, reportType, count, exam.rows[0].status, req.examActor.email, JSON.stringify(snapshot)]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error('Report print history error:', err.message); res.status(500).json({ message: 'Could not record report history.' }); }
});

app.get('/api/exams/:examId/print-history', async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    const result = await pool.query(
      `SELECT id, exam_id, student_id, report_type, students_count, exam_status, generated_by_email, generated_at, snapshot
       FROM public.exam_report_history WHERE organization_id=$1 AND exam_id=$2 ORDER BY generated_at DESC LIMIT 500`,
      [req.examActor.organizationId, examId]);
    res.json(result.rows);
  } catch (err) { console.error('Report print history list error:', err.message); res.status(500).json({ message: 'Could not load report history.' }); }
});

app.post('/api/exams/:examId/status', async (req, res) => {
  const client = await pool.connect();
  try {
    const orgId = req.examActor.organizationId, examId = Number(req.params.examId), target = String(req.body?.status || '');
    const transitions = {
      draft: ['in_review'],
      in_review: ['draft','approved'],
      approved: ['draft','locked'],
      locked: ['published'],
      published: []
    };
    if (!isValidOrganizationId(examId) || !Object.hasOwn(transitions, target)) return res.status(400).json({ message: 'Valid target status required.' });
    if (target === 'in_review' && !['admin','exam_coordinator','teacher'].includes(req.examActor.role)) return res.status(403).json({ message: 'Only assigned teachers/coordinators can submit for review.' });
    if (target === 'draft' && !['admin','exam_coordinator'].includes(req.examActor.role)) return res.status(403).json({ message: 'Only admin/coordinator can return an exam to draft.' });
    if (target === 'approved' && !['admin','principal','exam_coordinator'].includes(req.examActor.role)) return res.status(403).json({ message: 'Only authorized reviewers can approve.' });
    if (target === 'published' && !['admin','principal'].includes(req.examActor.role)) return res.status(403).json({ message: 'Only admin/principal can publish results.' });
    await client.query('BEGIN');
    const before = await client.query('SELECT * FROM public.exam_exams WHERE id=$1 AND organization_id=$2 FOR UPDATE', [examId, orgId]);
    if (!before.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Exam not found.' }); }
    const old = before.rows[0];
    if (!transitions[old.status]?.includes(target)) { await client.query('ROLLBACK'); return res.status(409).json({ message: `Status ${old.status} बाट ${target} मा जान मिल्दैन।` }); }
    if (target === 'in_review') {
      const component = await client.query('SELECT COUNT(*)::int AS n FROM public.exam_exam_subjects WHERE exam_id=$1', [examId]);
      if (!component.rows[0].n) { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Review मा पठाउनु अघि कम्तीमा एउटा subject configure गर्नुहोस्।' }); }
    }
    const updated = await client.query(
      `UPDATE public.exam_exams SET status=$3, updated_at=NOW(),
        approved_by_email=CASE WHEN $3='approved' THEN $4 ELSE approved_by_email END,
        published_by_email=CASE WHEN $3='published' THEN $4 ELSE published_by_email END,
        published_at=CASE WHEN $3='published' THEN NOW() ELSE published_at END
       WHERE id=$1 AND organization_id=$2 RETURNING *`, [examId, orgId, target, req.examActor.email]);
    await writeExamHistory(client, { organizationId: orgId, examId, actor: req.examActor, action: `status_${target}`, oldValue: { status: old.status }, newValue: { status: target } });
    await client.query('COMMIT'); res.json(updated.rows[0]);
  } catch (err) { await client.query('ROLLBACK').catch(() => {}); console.error('Exam status transition error:', err.message); res.status(500).json({ message: 'Could not update exam result status.' }); }
  finally { client.release(); }
});

app.get('/api/exams/:examId/history', async (req, res) => {
  try {
    const examId = Number(req.params.examId);
    const result = await pool.query(
      `SELECT id, exam_id, student_id, actor_email, actor_role, action, old_value, new_value, note, created_at
       FROM public.exam_result_history WHERE organization_id=$1 AND exam_id=$2 ORDER BY created_at DESC LIMIT 500`,
      [req.examActor.organizationId, examId]);
    res.json(result.rows);
  } catch (err) { console.error('Exam history error:', err.message); res.status(500).json({ message: 'Could not load result history.' }); }
});

app.get('/api/exams/report-settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.exam_report_settings WHERE organization_id=$1', [req.examActor.organizationId]);
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error('Exam report settings read error:', err.message);
    res.status(500).json({ message: 'Could not load school report settings.' });
  }
});

app.put('/api/exams/report-settings', async (req, res) => {
  if (req.examActor.role !== 'admin') return res.status(403).json({ message: 'Admin role required.' });
  const body = req.body || {};
  const nameEn = String(body.schoolNameEn || '').trim();
  const nameNe = String(body.schoolNameNe || '').trim();
  const addressEn = String(body.addressEn || '').trim();
  const addressNe = String(body.addressNe || '').trim();
  const phone = String(body.contactPhone || '').trim();
  const email = String(body.contactEmail || '').trim().toLowerCase();
  const logoUrl = String(body.logoUrl || '').trim();
  if (!nameEn && !nameNe) return res.status(400).json({ message: 'Enter the school name in Nepali or English.' });
  if (nameEn.length > 200 || nameNe.length > 200 || phone.length > 60 || (email && !/^\S+@\S+\.\S+$/.test(email))) return res.status(400).json({ message: 'School details contain an invalid email or overly long field.' });
  if (logoUrl && !/^https?:\/\//i.test(logoUrl)) return res.status(400).json({ message: 'Logo URL must start with http:// or https://.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO public.exam_report_settings (organization_id, school_name_en, school_name_ne, address_en, address_ne, contact_phone, contact_email, logo_url, updated_by_email, updated_at)
       VALUES ($1,NULLIF($2,''),NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),$9,NOW())
       ON CONFLICT (organization_id) DO UPDATE SET school_name_en=EXCLUDED.school_name_en, school_name_ne=EXCLUDED.school_name_ne, address_en=EXCLUDED.address_en, address_ne=EXCLUDED.address_ne, contact_phone=EXCLUDED.contact_phone, contact_email=EXCLUDED.contact_email, logo_url=EXCLUDED.logo_url, updated_by_email=EXCLUDED.updated_by_email, updated_at=NOW()
       RETURNING *`, [req.examActor.organizationId, nameEn, nameNe, addressEn, addressNe, phone, email, logoUrl, req.examActor.email]);
    await client.query(`INSERT INTO public.exam_result_history (organization_id, actor_email, actor_role, action, new_value) VALUES ($1,$2,$3,'report_settings_updated',$4::jsonb)`, [req.examActor.organizationId, req.examActor.email, req.examActor.role, JSON.stringify(result.rows[0])]);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Exam report settings save error:', err.message);
    res.status(500).json({ message: 'Could not save school report settings. No changes were committed.' });
  } finally { client.release(); }
});

app.get('/api/exams/roles', async (req, res) => {
  try {
    if (req.examActor.role !== 'admin') {
      const own = await pool.query(`SELECT id, organization_id, user_email, role, is_active, assigned_by_email, created_at FROM public.exam_role_assignments WHERE organization_id=$1 AND LOWER(user_email)=$2`, [req.examActor.organizationId, req.examActor.email]);
      return res.json(own.rows);
    }
    const result = await pool.query(`SELECT id, organization_id, user_email, role, is_active, assigned_by_email, created_at FROM public.exam_role_assignments WHERE organization_id=$1 ORDER BY user_email`, [req.examActor.organizationId]);
    res.json(result.rows);
  } catch (err) { console.error('Exam roles list error:', err.message); res.status(500).json({ message: 'Could not load role assignments.' }); }
});

app.post('/api/exams/roles', async (req, res) => {
  try {
    if (req.examActor.role !== 'admin') return res.status(403).json({ message: 'Admin role required.' });
    const email = String(req.body?.userEmail || '').trim().toLowerCase(), role = String(req.body?.role || '');
    if (!/^\S+@\S+\.\S+$/.test(email) || !['admin','principal','exam_coordinator','teacher'].includes(role)) return res.status(400).json({ message: 'Valid email and role required.' });
    const result = await pool.query(
      `INSERT INTO public.exam_role_assignments (organization_id, user_email, role, is_active, assigned_by_email)
       VALUES ($1,$2,$3,TRUE,$4) ON CONFLICT (organization_id, user_email) DO UPDATE SET role=EXCLUDED.role, is_active=TRUE, assigned_by_email=EXCLUDED.assigned_by_email RETURNING *`,
      [req.examActor.organizationId, email, role, req.examActor.email]);
    res.status(201).json(result.rows[0]);
  } catch (err) { console.error('Exam role assign error:', err.message); res.status(500).json({ message: 'Could not assign role.' }); }
});

app.put('/api/exams/roles/:roleId/deactivate', async (req, res) => {
  try {
    if (req.examActor.role !== 'admin') return res.status(403).json({ message: 'Admin role required.' });
    const result = await pool.query(`UPDATE public.exam_role_assignments SET is_active=FALSE WHERE id=$1 AND organization_id=$2 RETURNING *`, [Number(req.params.roleId), req.examActor.organizationId]);
    if (!result.rowCount) return res.status(404).json({ message: 'Role assignment not found.' });
    res.json(result.rows[0]);
  } catch (err) { console.error('Deactivate role error:', err.message); res.status(500).json({ message: 'Could not deactivate role.' }); }
});


app.listen(port, () => {
  console.log(`Accounting API listening on port ${port}`);
});
