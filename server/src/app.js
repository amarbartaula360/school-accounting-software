import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Allow local frontend ports and configured production frontend
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://school-accounting-frontend.onrender.com',
  'https://amarbartaula.com.np',
  'https://www.amarbartaula.com.np',
  process.env.CLIENT_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json({ limit: '1mb' }));

// Validate organization ID
function isValidOrganizationId(value) {
  return /^\d+$/.test(String(value ?? '')) &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;
}

// Validate dates in YYYY-MM-DD format
function isValidDate(value) {
  if (!value) return true;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    app: 'Accounting Software API'
  });
});

// Database check
app.get('/api/db-check', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT NOW() AS database_time'
    );

    res.json({
      ok: true,
      message: 'Database connected successfully',
      databaseTime: result.rows[0].database_time
    });
  } catch (err) {
    console.error('Database check failed:', err.message);

    res.status(500).json({
      ok: false,
      message: 'Database connection failed'
    });
  }
});

// List organizations
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

    res.status(500).json({
      message: 'Could not load organizations'
    });
  }
});

// List accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const { organizationId } = req.query;

    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({
        message: 'Valid organizationId is required'
      });
    }

    const result = await pool.query(
      `SELECT
         id,
         organization_id,
         code AS account_code,
         name AS account_name,
         account_type,
         parent_id,
         is_active
       FROM accounts
       WHERE organization_id = $1
       ORDER BY code`,
      [Number(organizationId)]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Accounts error:', err.message);

    res.status(500).json({
      message: 'Could not load accounts'
    });
  }
});

// Create an account
app.post('/api/accounts', async (req, res) => {
  try {
    const {
      organizationId,
      accountCode,
      accountName,
      accountType
    } = req.body;

    const allowedTypes = [
      'asset',
      'liability',
      'equity',
      'income',
      'expense'
    ];

    if (
      !isValidOrganizationId(organizationId) ||
      typeof accountCode !== 'string' ||
      !accountCode.trim() ||
      typeof accountName !== 'string' ||
      !accountName.trim() ||
      typeof accountType !== 'string' ||
      !allowedTypes.includes(accountType.toLowerCase())
    ) {
      return res.status(400).json({
        message:
          'Valid organization, account code, account name and account type are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO accounts
         (organization_id, code, name, account_type)
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         organization_id,
         code AS account_code,
         name AS account_name,
         account_type,
         parent_id,
         is_active`,
      [
        Number(organizationId),
        accountCode.trim(),
        accountName.trim(),
        accountType.toLowerCase()
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        message:
          'This account code already exists for this organization'
      });
    }

    if (err.code === '23503') {
      return res.status(400).json({
        message: 'Organization not found'
      });
    }

    console.error('Create account error:', err.message);

    res.status(500).json({
      message: 'Could not create account'
    });
  }
});

// Create and post a balanced journal entry
app.post('/api/journal-entries', async (req, res) => {
  const {
    organizationId,
    entryDate,
    voucherNumber,
    description,
    lines
  } = req.body;

  // Validate required fields
  if (
    !isValidOrganizationId(organizationId) ||
    typeof description !== 'string' ||
    !description.trim() ||
    !Array.isArray(lines) ||
    lines.length < 2
  ) {
    return res.status(400).json({
      message:
        'Organization, description and at least two journal lines are required'
    });
  }

  // Voucher number is required by the database
  if (
    typeof voucherNumber !== 'string' ||
    !voucherNumber.trim() ||
    voucherNumber.trim().length > 50
  ) {
    return res.status(400).json({
      message:
        'Voucher Number is required and must not exceed 50 characters'
    });
  }

  if (entryDate && !isValidDate(entryDate)) {
    return res.status(400).json({
      message: 'entryDate must be in YYYY-MM-DD format'
    });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const accountIds = [];

  // Validate journal lines and calculate totals
  for (const line of lines) {
    const accountId = Number(line.accountId);
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);

    if (
      !Number.isSafeInteger(accountId) ||
      accountId <= 0 ||
      !Number.isFinite(debit) ||
      !Number.isFinite(credit) ||
      debit < 0 ||
      credit < 0 ||
      (debit > 0 && credit > 0) ||
      (debit === 0 && credit === 0) ||
      Math.max(debit, credit) > 999999999999.99 ||
      !Number.isInteger(debit * 100) ||
      !Number.isInteger(credit * 100)
    ) {
      return res.status(400).json({
        message:
          'Each line needs a valid account and either debit or credit, with amounts to two decimal places'
      });
    }

    totalDebit += Math.round(debit * 100);
    totalCredit += Math.round(credit * 100);

    accountIds.push(accountId);
  }

  // Debit and credit must balance
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

    // Confirm organization exists
    const organization = await client.query(
      `SELECT id
       FROM organizations
       WHERE id = $1`,
      [Number(organizationId)]
    );

    if (organization.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        message: 'Organization not found'
      });
    }

    // Confirm all selected accounts are active and belong to organization
    const uniqueAccountIds = [...new Set(accountIds)];

    const accounts = await client.query(
      `SELECT id
       FROM accounts
       WHERE organization_id = $1
         AND is_active = TRUE
         AND id = ANY($2::bigint[])
       FOR SHARE`,
      [Number(organizationId), uniqueAccountIds]
    );

    if (accounts.rowCount !== uniqueAccountIds.length) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        message:
          'An account is invalid, inactive or belongs to another organization'
      });
    }

    const actualEntryDate =
      entryDate || new Date().toISOString().slice(0, 10);

    // Find the open financial year matching the entry date
    const financialYearResult = await client.query(
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

    if (financialYearResult.rowCount === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        message:
          'यो मितिका लागि खुला आर्थिक वर्ष भेटिएन।'
      });
    }

    const financialYearId =
      financialYearResult.rows[0].id;

    const actualVoucherNumber = voucherNumber.trim();

    // Journal voucher type
    const voucherType = 'Journal';

    // Save journal header, including all required columns
    const entryResult = await client.query(
      `INSERT INTO journal_entries
         (
           organization_id,
           financial_year_id,
           voucher_number,
           voucher_type,
           entry_date,
           description,
           status
         )
       VALUES ($1, $2, $3, $4, $5, $6, 'posted')
       RETURNING *`,
      [
        Number(organizationId),
        financialYearId,
        actualVoucherNumber,
        voucherType,
        actualEntryDate,
        description.trim()
      ]
    );

    const entry = entryResult.rows[0];

    // Save debit and credit lines
    for (const line of lines) {
      await client.query(
        `INSERT INTO journal_lines
           (journal_entry_id, account_id, debit, credit)
         VALUES ($1, $2, $3, $4)`,
        [
          entry.id,
          Number(line.accountId),
          Number(line.debit ?? 0),
          Number(line.credit ?? 0)
        ]
      );
    }

    // Commit only after header and all lines are saved
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
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error(
          'Rollback failed:',
          rollbackErr.message
        );
      }
    }

    console.error('Journal entry save error:', err.message);

    if (err.code === '23503') {
      return res.status(400).json({
        message:
          'Database reference error. Check the organization, financial year and account IDs.'
      });
    }

    if (err.code === '23505') {
      return res.status(409).json({
        message:
          'This voucher number may already exist. Please check the voucher number.'
      });
    }

    return res.status(500).json({
      message:
        err.message || 'Could not save journal entry'
    });
  } finally {
    client?.release();
  }
});

// Journal register
app.get('/api/journal-entries', async (req, res) => {
  try {
    const { organizationId, from, to } = req.query;

    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({
        message: 'Valid organizationId is required'
      });
    }

    if (
      !isValidDate(from) ||
      !isValidDate(to) ||
      (from && to && from > to)
    ) {
      return res.status(400).json({
        message: 'Valid date range is required'
      });
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
         COALESCE(
           SUM(l.debit), 0
         )::numeric(14,2) AS total_debit,
         COALESCE(
           SUM(l.credit), 0
         )::numeric(14,2) AS total_credit
       FROM journal_entries j
       LEFT JOIN journal_lines l
         ON l.journal_entry_id = j.id
       WHERE j.organization_id = $1
         AND ($2::date IS NULL OR j.entry_date >= $2::date)
         AND ($3::date IS NULL OR j.entry_date <= $3::date)
       GROUP BY j.id
       ORDER BY j.entry_date DESC, j.id DESC`,
      [
        Number(organizationId),
        from || null,
        to || null
      ]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Journal register error:', err.message);

    res.status(500).json({
      message: 'Could not load journal register'
    });
  }
});

// Trial balance: posted entries only
app.get('/api/reports/trial-balance', async (req, res) => {
  try {
    const { organizationId, from, to } = req.query;

    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({
        message: 'Valid organizationId is required'
      });
    }

    if (
      !isValidDate(from) ||
      !isValidDate(to) ||
      (from && to && from > to)
    ) {
      return res.status(400).json({
        message: 'Valid date range is required'
      });
    }

    const result = await pool.query(
      `WITH account_totals AS (
         SELECT
           l.account_id,
           SUM(l.debit) AS total_debit,
           SUM(l.credit) AS total_credit
         FROM journal_lines l
         INNER JOIN journal_entries j
           ON j.id = l.journal_entry_id
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
         COALESCE(
           t.total_debit, 0
         )::numeric(14,2) AS total_debit,
         COALESCE(
           t.total_credit, 0
         )::numeric(14,2) AS total_credit
       FROM accounts a
       LEFT JOIN account_totals t
         ON t.account_id = a.id
       WHERE a.organization_id = $1
         AND a.is_active = TRUE
       ORDER BY a.code`,
      [
        Number(organizationId),
        from || null,
        to || null
      ]
    );

    const totals = result.rows.reduce(
      (sum, row) => {
        sum.debit += Number(row.total_debit);
        sum.credit += Number(row.total_credit);

        return sum;
      },
      {
        debit: 0,
        credit: 0
      }
    );

    res.json({
      organizationId: Number(organizationId),
      accounts: result.rows,
      totals: {
        debit: Number(totals.debit.toFixed(2)),
        credit: Number(totals.credit.toFixed(2))
      }
    });
  } catch (err) {
    console.error('Trial balance error:', err.message);

    res.status(500).json({
      message: 'Could not generate trial balance'
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(
    `Accounting API listening on port ${port}`
  );
});