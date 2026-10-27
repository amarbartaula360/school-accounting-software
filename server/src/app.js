
 // Create and post a balanced journal voucher with automatic voucher number
app.post('/api/journal-entries', async (req, res) => {
  const {
    organizationId,
    entryDate,
    voucherNumber,
    description,
    lines
  } = req.body;

  if (
    !isValidOrganizationId(organizationId) ||
    typeof description !== 'string' ||
    !description.trim() ||
    !Array.isArray(lines) ||
    lines.length < 2
  ) {
    return res.status(400).json({
      message: 'Organization, description and at least two lines are required'
    });
  }

  if (entryDate && !isValidDate(entryDate)) {
    return res.status(400).json({
      message: 'entryDate must be a valid date in YYYY-MM-DD format'
    });
  }

  // Voucher number is generated automatically.
  // Do not accept a user-supplied number here.
  if (voucherNumber != null && typeof voucherNumber !== 'string') {
    return res.status(400).json({
      message: 'Invalid voucherNumber'
    });
  }

  let totalDebit = 0;
  let totalCredit = 0;
  const accountIds = [];

  for (const line of lines) {
    const accountId = Number(line?.accountId);
    const debit = Number(line?.debit ?? 0);
    const credit = Number(line?.credit ?? 0);

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
        message: 'Each line needs a valid account and either debit or credit, with amounts to two decimal places'
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
        message: 'An account is invalid, inactive or belongs to another organization'
      });
    }

    const date = entryDate || new Date().toISOString().slice(0, 10);

    // First create the entry so the database gives it a unique ID.
    const inserted = await client.query(
      `INSERT INTO journal_entries
         (organization_id, entry_date, voucher_number, description, status)
       VALUES ($1, $2, NULL, $3, 'posted')
       RETURNING *`,
      [Number(organizationId), date, description.trim()]
    );

    const initialEntry = inserted.rows[0];

    // Example: JV-20261027-000123
    const datePart = date.replace(/-/g, '');
    const generatedVoucherNumber =
      `JV-${datePart}-${String(initialEntry.id).padStart(6, '0')}`;

    const updated = await client.query(
      `UPDATE journal_entries
       SET voucher_number = $1
       WHERE id = $2
       RETURNING *`,
      [generatedVoucherNumber, initialEntry.id]
    );

    const entry = updated.rows[0];

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

    return res.status(201).json({
      ok: true,
      message: 'Journal entry and voucher created successfully',
      entry,
      voucherNumber: generatedVoucherNumber,
      totalDebit: totalDebit / 100,
      totalCredit: totalCredit / 100
    });
  } catch (err) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Rollback failed:', rollbackErr);
      }
    }

    // Log the real database error for diagnosis in Render.
    console.error('Journal entry save failed:', err);

    return res.status(500).json({
      message: 'Could not save journal entry'
    });
  } finally {
    client?.release();
  }
});
