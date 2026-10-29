/*
Paste these routes into the existing server/src/app.js BEFORE app.listen(...).
They reuse the existing Express `app`, PostgreSQL `pool`, and `isValidOrganizationId`
from the current backend. Do not replace your entire app.js with this snippet.
*/

function normalizeIdCardUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  let parsed;
  try { parsed = new URL(raw); } catch { return ''; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return '';
  if ((parsed.hostname === 'drive.google.com' || parsed.hostname === 'www.drive.google.com') && parsed.pathname.includes('/folders/')) return '';
  return raw;
}

function normalizeIdCardBsDate(value) {
  const raw = String(value || '').trim().replaceAll('/', '-');
  if (!raw) return '';
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(raw)) return null;
  return raw;
}

app.get('/api/id-cards/students', async (req, res) => {
  try {
    const { organizationId } = req.query;
    if (!isValidOrganizationId(organizationId)) {
      return res.status(400).json({ message: 'Valid organizationId is required.' });
    }
    const result = await pool.query(
      `SELECT id, organization_id, reg_no, student_name, class_name,
              section, roll_number, dob_bs, gender, address, photo_url,
              id_card_valid_upto_bs, guardian_name, guardian_phone, is_active, created_at
       FROM public.fee_students
       WHERE organization_id = $1 AND is_active = TRUE
       ORDER BY class_name, section, roll_number, student_name`,
      [Number(organizationId)]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('ID card student list error:', err.message);
    if (err.code === '42703') return res.status(500).json({ message: 'ID card column उपलब्ध छैन। database/id_card_migration.sql DBeaver मा चलाउनुहोस्।' });
    return res.status(500).json({ message: 'Could not load ID card student list.' });
  }
});

app.put('/api/id-cards/students/:studentId', async (req, res) => {
  try {
    const { organizationId, photoUrl = '', validUptoBs = '' } = req.body || {};
    const studentId = Number(req.params.studentId);
    if (!isValidOrganizationId(organizationId) || !Number.isSafeInteger(studentId) || studentId < 1) {
      return res.status(400).json({ message: 'Valid organizationId and studentId are required.' });
    }
    const rawPhoto = String(photoUrl || '').trim();
    const normalizedPhoto = rawPhoto ? normalizeIdCardUrl(rawPhoto) : '';
    if (rawPhoto && !normalizedPhoto) return res.status(400).json({ message: 'Photo URL मान्य http/https link हुनुपर्छ। Drive folder link होइन, फोटोको file-sharing link राख्नुहोस्।' });
    const rawValidUpto = String(validUptoBs || '').trim();
    const normalizedValidUpto = normalizeIdCardBsDate(rawValidUpto);
    if (rawValidUpto && normalizedValidUpto === null) return res.status(400).json({ message: 'Valid Upto मिति वि.सं. YYYY-MM-DD ढाँचामा राख्नुहोस्।' });
    const result = await pool.query(
      `UPDATE public.fee_students
       SET photo_url = $1,
           id_card_valid_upto_bs = NULLIF($2, '')
       WHERE id = $3 AND organization_id = $4 AND is_active = TRUE
       RETURNING id, reg_no, student_name, class_name, section,
                 roll_number, dob_bs, photo_url, id_card_valid_upto_bs`,
      [normalizedPhoto || null, normalizedValidUpto || '', studentId, Number(organizationId)]
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Active student not found.' });
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('ID card update error:', err.message);
    if (err.code === '42703') return res.status(500).json({ message: 'ID card column उपलब्ध छैन। database/id_card_migration.sql DBeaver मा चलाउनुहोस्।' });
    return res.status(500).json({ message: 'Could not save ID card details.' });
  }
});

app.post('/api/id-cards/photo-links/import', async (req, res) => {
  const { organizationId, entries } = req.body || {};
  if (!isValidOrganizationId(organizationId)) return res.status(400).json({ message: 'Valid organizationId is required.' });
  if (!Array.isArray(entries) || entries.length === 0) return res.status(400).json({ message: 'Photo mapping file मा rows चाहिन्छ।' });
  if (entries.length > 3000) return res.status(413).json({ message: 'एक पटकमा बढीमा 3,000 photo mappings import गर्न सकिन्छ।' });

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    let saved = 0;
    let skipped = 0;
    const errors = [];
    for (let i = 0; i < entries.length; i += 1) {
      const row = entries[i] || {};
      const rowNumber = Number(row.rowNumber) || i + 2;
      const regNo = String(row.regNo ?? row.reg_no ?? '').trim();
      const photoRaw = String(row.photoUrl ?? row.photo_url ?? '').trim();
      const photoUrl = normalizeIdCardUrl(photoRaw);
      const validRaw = String(row.validUptoBs ?? row.valid_upto_bs ?? '').trim();
      const validUptoBs = normalizeIdCardBsDate(validRaw);
      if (!regNo || !photoUrl || (validRaw && validUptoBs === null)) {
        skipped += 1;
        errors.push({ rowNumber, regNo, message: !regNo ? 'Reg No खाली छ।' : !photoUrl ? 'Valid photo file-sharing URL चाहिन्छ; Drive folder link स्वीकार हुँदैन।' : 'Valid Upto (BS) YYYY-MM-DD ढाँचामा हुनुपर्छ।' });
        continue;
      }
      const match = await client.query(
        `SELECT id FROM public.fee_students
         WHERE organization_id = $1 AND is_active = TRUE
           AND NULLIF(BTRIM(reg_no), '') = $2
         ORDER BY id LIMIT 2`,
        [Number(organizationId), regNo]
      );
      if (match.rowCount !== 1) {
        skipped += 1;
        errors.push({ rowNumber, regNo, message: match.rowCount === 0 ? 'यो Reg No भएको सक्रिय विद्यार्थी भेटिएन।' : 'यो Reg No दोहोरिएको छ; पहिले duplicate Reg No सच्याउनुहोस्।' });
        continue;
      }
      await client.query(
        `UPDATE public.fee_students
         SET photo_url = $1,
             id_card_valid_upto_bs = CASE WHEN $2 = '' THEN id_card_valid_upto_bs ELSE $2 END
         WHERE id = $3 AND organization_id = $4`,
        [photoUrl, validUptoBs || '', Number(match.rows[0].id), Number(organizationId)]
      );
      saved += 1;
    }
    await client.query('COMMIT');
    return res.json({ total: entries.length, saved, skipped, errors });
  } catch (err) {
    if (client) { try { await client.query('ROLLBACK'); } catch { /* preserve original error */ } }
    console.error('ID card photo mapping import error:', err.message);
    if (err.code === '42703') return res.status(500).json({ message: 'ID card column उपलब्ध छैन। database/id_card_migration.sql DBeaver मा चलाउनुहोस्।' });
    return res.status(500).json({ message: 'Photo mapping import असफल भयो; transaction rollback गरिएको छ।' });
  } finally {
    client?.release();
  }
});
