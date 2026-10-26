
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173'
}));
app.use(express.json({ limit: '1mb' }));

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
      'SELECT current_database() AS database, NOW() AS server_time'
    );

    res.json({
      ok: true,
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ ok: false, message: 'Database error' });
  }
});

// List School and Business
app.get('/api/organizations', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, module_type FROM organizations ORDER BY id'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Could not load organizations' });
  }
});

// List accounts
app.get('/api/accounts', async (req, res) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId || !/^\d+$/.test(organizationId)) {
      return res.status(400).json({
        message: 'Valid organizationId is required'
      });
    }

    const result = await pool.query(
      `SELECT id, organization_id, account_code, account_name,
              account_type, is_active
       FROM accounts
       WHERE organization_id = $1
       ORDER BY account_code`,
      [organizationId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Could not load accounts' });
  }
});

// Create an account
app.post('/api/accounts', async (req, res) => {
  try {
    const {
      organizationId, accountCode, accountName, accountType
    } = req.body;

    const allowedTypes = [
      'asset', 'liability', 'equity', 'income', 'expense'
    ];

    if (
      !Number.isSafeInteger(Number(organizationId)) ||
      Number(organizationId) <= 0 ||
      typeof accountCode !== 'string' ||
      !accountCode.trim() ||
      typeof accountName !== 'string' ||
      !accountName.trim() ||
      !allowedTypes.includes(accountType)
    ) {
      return res.status(400).json({
        message: 'Valid organization, code, name and account type are required'
      });
    }

    const result = await pool.query(
      `INSERT INTO accounts
         (organization_id, account_code, account_name, account_type)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        Number(organizationId),
        accountCode.trim(),
        accountName.trim(),
        accountType
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({
        message: 'This account code already exists for this organization'
      });
    }
    if (err.code === '23503') {
      return res.status(400).json({ message: 'Organization not found' });
    }

    console.error(err.message);
    res.status(500).json({ message: 'Could not create account' });
  }
});

// Create and post a balanced journal voucher
app.post('/api/journal-entries', async (req, res) => {
  const {
    organizationId, entryDate, voucherNumber, description, lines
  } = req.body;

  if (
    !Number.isSafeInteger(Number(organizationId)) ||
    Number(organizationId) <= 0 ||
    typeof description !== 'string' ||
    !description.trim() ||
    !Array.isArray(lines) ||
    lines.length < 2
  ) {
    return res.status(400).json({
      message: 'Organization, description and at least two lines are required'
    });
  }

  if (entryDate && !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return res.status(400).json({
      message: 'entryDate must use YYYY-MM-DD format'
    });
  }

  if (
    voucherNumber != null &&
    (typeof voucherNumber !== 'string' || voucherNumber.length > 50)
  ) {
    return res.status(400).json({ message: 'Invalid voucherNumber' });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const accountIds = [];

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
      Math.max(debit, credit) > 999999999999.99
    ) {
      return res.status(400).json({
        message: 'Each line needs a valid account and either debit or credit'
      });
    }

    // Convert to paisa to avoid ordinary floating-point comparison errors.
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

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const organization = await client.query(
      'SELECT id FROM organizations WHERE id = $1',
      [Number(organizationId)]
    );

    if (organization.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Organization not found' });
    }

    const uniqueAccountIds = [...new Set(accountIds)];

    const accounts = await client.query(
      `SELECT id FROM accounts
       WHERE organization_id = $1
         AND is_active = TRUE
         AND id = ANY($2::bigint[])
       FOR SHARE`,
      [Number(organizationId), uniqueAccountIds]
    );

    if (accounts.rowCount !== uniqueAccountIds.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        message: 'An account is invalid, inactive or belongs to another organization'
      });
    }

    const entryResult = await client.query(
      `INSERT INTO journal_entries
         (organization_id, entry_date, voucher_number, description, status)
       VALUES ($1, $2, $3, $4, 'posted')
       RETURNING *`,
      [
        Number(organizationId),
        entryDate || new Date().toISOString().slice(0, 10),
        voucherNumber?.trim() || null,
        description.trim()
      ]
    );

    const entry = entryResult.rows[0];

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

    await client.query('COMMIT');

    res.status(201).json({
      ok: true,
      message: 'Journal entry posted successfully',
      entry,
      totalDebit: totalDebit / 100,
      totalCredit: totalCredit / 100
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err.message);
    res.status(500).json({ message: 'Could not save journal entry' });
  } finally {
    client.release();
  }
});

// Journal register
app.get('/api/journal-entries', async (req, res) => {
  try {
    const { organizationId, from, to } = req.query;

    if (!organizationId || !/^\d+$/.test(organizationId)) {
      return res.status(400).json({
        message: 'Valid organizationId is required'
      });
    }

    const result = await pool.query(
      `SELECT
         j.id, j.organization_id, j.entry_date, j.voucher_number,
         j.description, j.status, j.created_at,
         COALESCE(SUM(l.debit), 0)::numeric(14,2) AS total_debit,
         COALESCE(SUM(l.credit), 0)::numeric(14,2) AS total_credit
       FROM journal_entries j
       LEFT JOIN journal_lines l ON l.journal_entry_id = j.id
       WHERE j.organization_id = $1
         AND ($2::date IS NULL OR j.entry_date >= $2::date)
         AND ($3::date IS NULL OR j.entry_date <= $3::date)
       GROUP BY j.id
       ORDER BY j.entry_date DESC, j.id DESC`,
      [organizationId, from || null, to || null]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Could not load journal register' });
  }
});

// Trial Balance: posted entries only
app.get('/api/reports/trial-balance', async (req, res) => {
  try {
    const { organizationId, from, to } = req.query;

    if (!organizationId || !/^\d+$/.test(organizationId)) {
      return res.status(400).json({
        message: 'Valid organizationId is required'
      });
    }

    const result = await pool.query(
      `SELECT
         a.id AS account_id,
         a.account_code,
         a.account_name,
         a.account_type,
         COALESCE(SUM(l.debit), 0)::numeric(14,2) AS total_debit,
         COALESCE(SUM(l.credit), 0)::numeric(14,2) AS total_credit
       FROM accounts a
       LEFT JOIN journal_lines l ON l.account_id = a.id
       LEFT JOIN journal_entries j
         ON j.id = l.journal_entry_id
        AND j.organization_id = a.organization_id
        AND j.status = 'posted'
        AND ($2::date IS NULL OR j.entry_date >= $2::date)
        AND ($3::date IS NULL OR j.entry_date <= $3::date)
       WHERE a.organization_id = $1
         AND a.is_active = TRUE
       GROUP BY a.id
       ORDER BY a.account_code`,
      [organizationId, from || null, to || null]
    );

    const totals = result.rows.reduce((sum, row) => {
      sum.debit += Number(row.total_debit);
      sum.credit += Number(row.total_credit);
      return sum;
    }, { debit: 0, credit: 0 });

    res.json({
      organizationId: Number(organizationId),
      accounts: result.rows,
      totals: {
        debit: Number(totals.debit.toFixed(2)),
        credit: Number(totals.credit.toFixed(2))
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Could not generate trial balance' });
  }
});

app.listen(port, () => {
  console.log(`Accounting API listening at http://localhost:${port}`);
});
