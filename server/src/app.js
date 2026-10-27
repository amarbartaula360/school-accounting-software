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

app.listen(port, () => {
  console.log(`Accounting API listening on port ${port}`);
});
