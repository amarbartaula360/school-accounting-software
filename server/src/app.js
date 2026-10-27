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
  const { organizationId, studentId, feeMonth, dueDate = null, items } = req.body;
  if (
    !isValidOrganizationId(organizationId) || !isValidOrganizationId(studentId) ||
    typeof feeMonth !== 'string' || !/^\d{4}-\d{2}-01$/.test(feeMonth) || !isValidDate(feeMonth) ||
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
       WHERE organization_id = $1 AND student_id = $2 AND fee_month = $3::date`,
      [Number(organizationId), Number(studentId), feeMonth]
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


app.listen(port, () => {
  console.log(`Accounting API listening on port ${port}`);
});
