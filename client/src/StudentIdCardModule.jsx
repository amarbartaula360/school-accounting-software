import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CreditCard, Search, RefreshCw, Printer, Upload, Save, Link2,
  CheckCircle2, AlertCircle, Users, FileSpreadsheet, Download
} from 'lucide-react';

const DEFAULT_SCHOOL_NAME = 'United English Boarding School';
const DEFAULT_SCHOOL_ADDRESS = 'Manahari-08, Makwanpur';
const DEVANAGARI_DIGITS = '०१२३४५६७८९';

function englishDigits(value) {
  return String(value ?? '').replace(/[०-९]/g, d => String(DEVANAGARI_DIGITS.indexOf(d))).trim();
}

function displayBsDate(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  return raw.replace(/[0-9]/g, d => DEVANAGARI_DIGITS[Number(d)]);
}

/** Convert a Drive share URL to a URL more suitable for an img src. The file must be shared as "Anyone with the link - Viewer". */
function normalizeDrivePhotoUrl(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.hostname === 'drive.google.com' || url.hostname === 'www.drive.google.com') {
      const filePath = url.pathname.match(/\/file\/d\/([^/]+)/);
      const id = filePath?.[1] || url.searchParams.get('id');
      if (id && !url.pathname.includes('/folders/')) {
        return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;
      }
    }
    return raw;
  } catch {
    return raw;
  }
}

function initials(studentName) {
  return String(studentName || '?')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();
}

function getRegNo(student) {
  return String(student?.reg_no || student?.regNo || student?.admission_no || student?.admissionNo || '').trim();
}

function StudentPhoto({ src, studentName, className = '' }) {
  const [failedUrl, setFailedUrl] = useState('');
  const safeSrc = normalizeDrivePhotoUrl(src);
  useEffect(() => setFailedUrl(''), [safeSrc]);
  if (!safeSrc || failedUrl === safeSrc) {
    return <div className={`id-photo-fallback ${className}`} aria-label="Student photo unavailable">{initials(studentName)}</div>;
  }
  return <img className={className} src={safeSrc} alt={`${studentName || 'Student'} photo`} crossOrigin="anonymous" onError={() => setFailedUrl(safeSrc)} />;
}

function IdCardFace({ student, schoolName, schoolAddress, schoolPhone, logoUrl }) {
  const regNo = getRegNo(student);
  return (
    <article className="id-card-face">
      <div className="id-card-header">
        <div className="id-school-logo">
          {logoUrl ? <img src={logoUrl} alt="School logo" onError={event => { event.currentTarget.style.display = 'none'; }} /> : <span>UE</span>}
        </div>
        <div className="id-school-copy">
          <div className="id-school-name">{schoolName || DEFAULT_SCHOOL_NAME}</div>
          <div className="id-school-address">{schoolAddress || DEFAULT_SCHOOL_ADDRESS}</div>
          {schoolPhone ? <div className="id-school-phone">{schoolPhone}</div> : null}
        </div>
        <div className="id-type-pill">STUDENT ID</div>
      </div>
      <div className="id-card-body">
        <StudentPhoto src={student.photo_url} studentName={student.student_name} className="id-student-photo" />
        <div className="id-student-details">
          <div className="id-student-name">{student.student_name || 'Student Name'}</div>
          <div className="id-data-line"><span>Reg No.</span><strong>{regNo || '—'}</strong></div>
          <div className="id-data-pair">
            <div><span>Class / Section</span><strong>{student.class_name || '—'} / {student.section || '—'}</strong></div>
            <div><span>Date of Birth (B.S.)</span><strong>{displayBsDate(student.dob_bs)}</strong></div>
          </div>
          <div className="id-data-line"><span>Valid Upto (B.S.)</span><strong>{displayBsDate(student.id_card_valid_upto_bs)}</strong></div>
        </div>
      </div>
      <div className="id-card-footer"><span>IF FOUND, PLEASE RETURN TO SCHOOL</span><span>AUTHORISED ID</span></div>
    </article>
  );
}

function chunks(list, size) {
  const output = [];
  for (let i = 0; i < list.length; i += size) output.push(list.slice(i, i + size));
  return output;
}

function normalizedHeader(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueFromRow(row, aliases) {
  const keys = Object.keys(row);
  const matched = keys.find(key => aliases.includes(normalizedHeader(key)));
  return matched ? String(row[matched] ?? '').trim() : '';
}

export default function StudentIdCardModule({ apiBaseUrl, organizationId = 1, schoolName: initialSchoolName = DEFAULT_SCHOOL_NAME }) {
  const [students, setStudents] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [schoolName, setSchoolName] = useState(initialSchoolName);
  const [schoolAddress, setSchoolAddress] = useState(DEFAULT_SCHOOL_ADDRESS);
  const [schoolPhone, setSchoolPhone] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState(null);
  const [mappingErrors, setMappingErrors] = useState([]);
  const [importPreview, setImportPreview] = useState([]);

  async function loadStudents() {
    setLoading(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/id-cards/students?organizationId=${encodeURIComponent(organizationId)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'विद्यार्थी विवरण लोड भएन।');
      if (!Array.isArray(data)) throw new Error('API बाट विद्यार्थी सूची आएन।');
      const normalized = data.map(student => ({
        ...student,
        photo_url: student.photo_url || '',
        id_card_valid_upto_bs: student.id_card_valid_upto_bs || '',
        _originalPhotoUrl: student.photo_url || '',
        _originalValidUpto: student.id_card_valid_upto_bs || ''
      }));
      setStudents(normalized);
      setSelectedIds(old => old.filter(id => normalized.some(s => Number(s.id) === Number(id))));
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'विद्यार्थी सूची लोड भएन।' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStudents(); }, [apiBaseUrl, organizationId]);

  const grades = useMemo(() => [...new Set(students.map(s => String(s.class_name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [students]);
  const sections = useMemo(() => {
    const base = gradeFilter === 'all' ? students : students.filter(s => String(s.class_name || '').trim() === gradeFilter);
    return [...new Set(base.map(s => String(s.section || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [students, gradeFilter]);
  const filteredStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return students.filter(s => {
      if (gradeFilter !== 'all' && String(s.class_name || '').trim() !== gradeFilter) return false;
      if (sectionFilter !== 'all' && String(s.section || '').trim() !== sectionFilter) return false;
      if (needle && ![getRegNo(s), s.student_name, s.class_name, s.section, s.roll_number, s.guardian_name].some(v => String(v || '').toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [students, search, gradeFilter, sectionFilter]);
  const selectedStudents = useMemo(() => students.filter(s => selectedIds.includes(Number(s.id))), [students, selectedIds]);
  const dirtyCount = students.filter(s => s.photo_url !== s._originalPhotoUrl || s.id_card_valid_upto_bs !== s._originalValidUpto).length;
  const photoCount = filteredStudents.filter(s => Boolean(s.photo_url)).length;

  function updateStudent(studentId, patch) {
    setStudents(old => old.map(s => Number(s.id) === Number(studentId) ? { ...s, ...patch } : s));
  }
  function toggleSelected(id) {
    setSelectedIds(old => old.includes(Number(id)) ? old.filter(value => value !== Number(id)) : [...old, Number(id)]);
  }
  function selectAllVisible() {
    const visibleIds = filteredStudents.map(s => Number(s.id));
    setSelectedIds(old => [...new Set([...old, ...visibleIds])]);
  }
  function clearSelection() { setSelectedIds([]); }

  async function saveSelected() {
    if (!selectedStudents.length) {
      setNotice({ type: 'error', text: 'पहिले अपडेट गर्नुपर्ने विद्यार्थी चयन गर्नुहोस्।' });
      return;
    }
    setSaving(true);
    setNotice(null);
    const errors = [];
    let saved = 0;
    for (const student of selectedStudents) {
      const photoUrl = normalizeDrivePhotoUrl(student.photo_url);
      const validUptoBs = englishDigits(student.id_card_valid_upto_bs).replaceAll('/', '-');
      if (validUptoBs && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(validUptoBs)) {
        errors.push(`${getRegNo(student)}: Valid Upto मिति YYYY-MM-DD वि.सं. ढाँचामा राख्नुहोस्।`);
        continue;
      }
      try {
        const response = await fetch(`${apiBaseUrl}/api/id-cards/students/${student.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationId, photoUrl, validUptoBs })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || 'सेभ भएन।');
        setStudents(old => old.map(s => Number(s.id) === Number(student.id) ? {
          ...s, photo_url: result.photo_url || '', id_card_valid_upto_bs: result.id_card_valid_upto_bs || '',
          _originalPhotoUrl: result.photo_url || '', _originalValidUpto: result.id_card_valid_upto_bs || ''
        } : s));
        saved += 1;
      } catch (error) {
        errors.push(`${getRegNo(student)}: ${error.message}`);
      }
    }
    setSaving(false);
    if (errors.length) {
      setMappingErrors(errors.slice(0, 12));
      setNotice({ type: 'error', text: `${saved} विद्यार्थीको ID विवरण सेभ भयो; ${errors.length} मा समस्या आयो।` });
    } else {
      setMappingErrors([]);
      setNotice({ type: 'success', text: `${saved} विद्यार्थीको ID Card विवरण सेभ भयो।` });
    }
  }

  async function readMappingFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice(null);
    setMappingErrors([]);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const dataRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      const entries = dataRows.map((row, index) => ({
        rowNumber: index + 2,
        regNo: valueFromRow(row, ['regno', 'registrationno', 'studentid', 'admissionno']),
        photoUrl: normalizeDrivePhotoUrl(valueFromRow(row, ['photourl', 'drivelink', 'googledrivelink', 'photolink', 'imageurl', 'photo'])),
        validUptoBs: englishDigits(valueFromRow(row, ['validuptobs', 'validupto', 'expirydate', 'validity'])).replaceAll('/', '-')
      })).filter(row => row.regNo || row.photoUrl || row.validUptoBs);
      setImportPreview(entries);
      if (!entries.length) setNotice({ type: 'error', text: 'फाइलमा Reg No, Photo URL र वैकल्पिक Valid Upto (BS) column भेटिएन।' });
      else setNotice({ type: 'success', text: `${entries.length} वटा mapping row पढियो। Save Mapping थिचेर Reg No अनुसार मिलाउनुहोस्।` });
    } catch (error) {
      setNotice({ type: 'error', text: `फाइल पढ्न सकिएन: ${error.message}` });
    } finally {
      event.target.value = '';
    }
  }

  async function importMapping() {
    if (!importPreview.length) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/id-cards/photo-links/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, entries: importPreview })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || 'Photo mapping import असफल भयो।');
      const errors = Array.isArray(result.errors) ? result.errors.map(row => `Row ${row.rowNumber} / ${row.regNo || '—'}: ${row.message}`) : [];
      setMappingErrors(errors.slice(0, 12));
      setNotice({ type: errors.length ? 'error' : 'success', text: `${result.saved || 0} मिलान सेभ भयो, ${result.skipped || 0} skip भयो।` });
      setImportPreview([]);
      await loadStudents();
    } catch (error) {
      setNotice({ type: 'error', text: error.message || 'Photo mapping import असफल भयो।' });
    } finally {
      setSaving(false);
    }
  }

  function downloadTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Reg No', 'Photo URL', 'Valid Upto (BS)'],
      ['UEBS-0001', 'https://drive.google.com/file/d/FILE_ID/view?usp=sharing', '२०८३-१२-३०']
    ]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'ID Card Photos');
    XLSX.writeFile(book, 'student_id_card_photo_mapping.xlsx');
  }

  function printSelected() {
    if (!selectedStudents.length) {
      setNotice({ type: 'error', text: 'प्रिन्ट गर्न पहिले विद्यार्थी चयन गर्नुहोस्।' });
      return;
    }
    const missing = selectedStudents.filter(s => !normalizeDrivePhotoUrl(s.photo_url));
    if (missing.length) {
      setNotice({ type: 'error', text: `${missing.length} विद्यार्थीको फोटो लिंक छैन। प्रिन्ट अघि photo URL राख्नुहोस्।` });
      return;
    }
    setPrinting(true);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => setPrinting(false), 800);
    }, 150);
  }

  const sheets = useMemo(() => chunks(selectedStudents, 10), [selectedStudents]);

  return (
    <div className="student-id-cards">
      <style>{`
        .student-id-cards{color:#e5edff;font-family:'Noto Sans Devanagari','Noto Sans',Inter,Arial,sans-serif}
        .student-id-cards *{box-sizing:border-box}
        .id-page-title{font-size:27px;line-height:1.25;font-weight:850;margin:0;color:#f6f8ff}
        .id-subtitle{margin:8px 0 0;color:#93a4c5;font-size:13px}
        .id-panel{background:linear-gradient(145deg,#111a2d,#0b1120);border:1px solid #26324c;border-radius:16px;padding:18px;margin-top:16px;box-shadow:0 12px 32px rgba(0,0,0,.14)}
        .id-panel-title{display:flex;align-items:center;gap:9px;color:#f3f6ff;font-size:15px;font-weight:800;margin:0 0 14px}
        .id-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .id-field{display:flex;flex-direction:column;gap:6px;min-width:0}
        .id-field label{font-size:11px;color:#9caccc;font-weight:700;letter-spacing:.02em}
        .id-field input,.id-field select{width:100%;border:1px solid #34415c;border-radius:9px;background:#0a1020;color:#f1f5ff;padding:10px 11px;font-size:12px;min-width:0}
        .id-help{color:#95a5c4;font-size:11px;line-height:1.65;margin:10px 0 0}
        .id-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
        .id-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #34415c;border-radius:9px;background:#172139;color:#e8efff;padding:10px 13px;font-size:12px;font-weight:800;cursor:pointer}
        .id-button.primary{background:linear-gradient(115deg,#6c3cdf,#a03df0);border-color:#8b50ec;color:white}
        .id-button.cyan{background:#082d40;border-color:#14566c;color:#79e1ff}
        .id-button:disabled{opacity:.45;cursor:not-allowed}
        .id-notice{display:flex;gap:9px;align-items:flex-start;padding:11px 13px;border-radius:10px;font-size:12px;margin-top:14px;line-height:1.55}
        .id-notice.success{background:#092e29;border:1px solid #166354;color:#a6f3db}
        .id-notice.error{background:#361a2a;border:1px solid #87405e;color:#ffc1d6}
        .id-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:16px}
        .id-stat{padding:13px 15px;border-radius:13px;background:linear-gradient(130deg,#121c30,#0b1120);border:1px solid #27334c}
        .id-stat-label{font-size:11px;color:#93a4c5}.id-stat-value{font-size:22px;font-weight:850;color:#f6f8ff;margin-top:4px}
        .id-table-wrap{overflow:auto;border:1px solid #28334b;border-radius:12px;margin-top:14px}
        .id-student-table{border-collapse:collapse;width:100%;min-width:970px;font-size:12px}
        .id-student-table th{background:#211b46;color:#ff79bc;text-align:left;padding:12px;border-bottom:1px solid #3c326a;white-space:nowrap}
        .id-student-table td{padding:10px 12px;border-bottom:1px solid #202a3d;color:#d9e3f7;vertical-align:middle}
        .id-student-table tr:last-child td{border-bottom:0}
        .id-student-table input{width:100%;min-width:135px;background:#080e1b;border:1px solid #33415c;border-radius:7px;color:#f1f5ff;padding:8px;font-size:11px}
        .id-avatar-small{width:34px;height:42px;object-fit:cover;border-radius:5px;border:1px solid #42516f}
        .id-photo-fallback{display:grid;place-items:center;background:linear-gradient(135deg,#743bdb,#ec4e9a);color:white;font-weight:850;overflow:hidden}
        .id-mapping-preview{max-height:180px;overflow:auto;margin-top:10px;border:1px solid #33415c;border-radius:8px}
        .id-mapping-preview table{border-collapse:collapse;width:100%;font-size:11px}.id-mapping-preview th,.id-mapping-preview td{padding:8px;border-bottom:1px solid #25314a;text-align:left}.id-mapping-preview th{position:sticky;top:0;background:#211b46;color:#ff79bc}
        .id-card-preview-grid{display:flex;flex-wrap:wrap;gap:14px;margin-top:16px}
        .id-card-face{width:320px;height:202px;border-radius:10px;overflow:hidden;position:relative;color:#fff;background:radial-gradient(circle at 100% 0%,rgba(137,83,255,.42),transparent 38%),linear-gradient(120deg,#0a1834 0%,#123763 60%,#0d2044 100%);border:1px solid #3f6b9b;box-shadow:0 10px 25px rgba(0,0,0,.2);padding:10px;display:flex;flex-direction:column;break-inside:avoid;page-break-inside:avoid}
        .id-card-header{display:flex;align-items:center;gap:8px;min-height:43px;padding-bottom:7px;border-bottom:1px solid rgba(150,211,255,.35)}
        .id-school-logo{width:34px;height:34px;flex:0 0 34px;border-radius:50%;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(255,255,255,.65);background:#f5f8ff;color:#18305e;font-size:10px;font-weight:900}
        .id-school-logo img{width:100%;height:100%;object-fit:contain}
        .id-school-copy{min-width:0;flex:1}.id-school-name{font-size:11px;font-weight:900;line-height:1.2;max-height:27px;overflow:hidden}.id-school-address,.id-school-phone{font-size:7px;color:#c1d6f2;line-height:1.35;margin-top:2px}
        .id-type-pill{font-size:6px;font-weight:900;letter-spacing:.08em;color:#c7f4ff;border:1px solid #3e9ebd;border-radius:20px;padding:4px 5px;white-space:nowrap}
        .id-card-body{display:flex;gap:10px;flex:1;padding-top:8px;min-height:0}
        .id-student-photo{width:76px;height:94px;object-fit:cover;object-position:center top;border:2px solid #d7edff;border-radius:5px;background:#fff;flex:0 0 76px}
        .id-card-body .id-photo-fallback{width:76px;height:94px;flex:0 0 76px;border:2px solid #d7edff;border-radius:5px;font-size:24px}
        .id-student-details{flex:1;min-width:0}.id-student-name{font-weight:900;font-size:13px;line-height:1.25;margin-bottom:6px;overflow-wrap:anywhere}.id-data-line{display:flex;justify-content:space-between;gap:6px;border-bottom:1px solid rgba(156,202,245,.19);padding:3px 0;font-size:8px}.id-data-line span,.id-data-pair span{color:#a9c2e4}.id-data-line strong,.id-data-pair strong{font-size:8px;color:#fff;text-align:right;overflow-wrap:anywhere}.id-data-pair{display:grid;grid-template-columns:1fr 1fr;gap:7px;border-bottom:1px solid rgba(156,202,245,.19);padding:4px 0}.id-data-pair>div{display:flex;flex-direction:column;gap:3px;min-width:0}.id-data-pair strong{text-align:left}
        .id-card-footer{display:flex;justify-content:space-between;gap:5px;font-size:6px;font-weight:800;letter-spacing:.03em;color:#9cc9f6;padding-top:5px;border-top:1px solid rgba(156,202,245,.2)}
        .id-print-root{display:none}
        @media(max-width:1000px){.id-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.id-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:580px){.id-grid{grid-template-columns:1fr}.id-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.id-page-title{font-size:22px}.id-panel{padding:13px}}
        @page{size:A4 portrait;margin:7mm}
        @media print{
          body *{visibility:hidden!important}
          .id-print-root,.id-print-root *{visibility:visible!important}
          .id-print-root{display:block!important;position:fixed!important;left:0!important;top:0!important;width:196mm!important;background:white!important;color:#111!important;z-index:999999!important}
          .id-print-sheet{width:196mm;height:283mm;display:grid;grid-template-columns:85.6mm 85.6mm;grid-auto-rows:54mm;gap:3mm;justify-content:space-around;align-content:start;page-break-after:always;break-after:page;overflow:hidden}
          .id-print-sheet:last-child{page-break-after:auto;break-after:auto}
          .id-print-root .id-card-face{width:85.6mm!important;height:54mm!important;border-radius:1.5mm!important;box-shadow:none!important;padding:2.2mm!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;border:0.25mm solid #31547a!important}
          .id-print-root .id-card-header{min-height:11mm!important;gap:1.5mm!important;padding-bottom:1.3mm!important}
          .id-print-root .id-school-logo{width:8mm!important;height:8mm!important;flex-basis:8mm!important;font-size:7pt!important}
          .id-print-root .id-school-copy{min-width:0!important}.id-print-root .id-school-name{font-size:7.2pt!important;max-height:9mm!important}.id-print-root .id-school-address,.id-print-root .id-school-phone{font-size:4.7pt!important}.id-print-root .id-type-pill{font-size:4.5pt!important;padding:1mm!important}
          .id-print-root .id-card-body{gap:2mm!important;padding-top:1.5mm!important}.id-print-root .id-student-photo,.id-print-root .id-card-body .id-photo-fallback{width:20mm!important;height:25mm!important;flex-basis:20mm!important;border-width:.4mm!important;font-size:15pt!important}
          .id-print-root .id-student-name{font-size:8pt!important;margin-bottom:1mm!important}.id-print-root .id-data-line{font-size:5pt!important;padding:.65mm 0!important;gap:1mm!important}.id-print-root .id-data-line strong,.id-print-root .id-data-pair strong{font-size:5.1pt!important}.id-print-root .id-data-pair{gap:1.2mm!important;padding:.7mm 0!important}.id-print-root .id-data-pair span{font-size:4.6pt!important}.id-print-root .id-card-footer{font-size:4.4pt!important;padding-top:1mm!important}
          .student-id-cards > :not(.id-print-root){display:none!important}
        }
      `}</style>

      <div className="id-page-heading">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 46, height: 46, display: 'grid', placeItems: 'center', borderRadius: 13, background: 'linear-gradient(135deg,#743bdb,#ed4e9b)', boxShadow: '0 8px 22px #0004' }}><CreditCard size={23} /></div>
          <div><h1 className="id-page-title">विद्यार्थी परिचयपत्र / Student ID Cards</h1><p className="id-subtitle">Reg No अनुसार फोटो मिलान · Google Drive photo links · CR80 standard size (85.6 × 54 mm)</p></div>
        </div>
      </div>

      <div className="id-stats">
        <div className="id-stat"><div className="id-stat-label">कुल विद्यार्थी / Students</div><div className="id-stat-value">{students.length}</div></div>
        <div className="id-stat"><div className="id-stat-label">फोटो भएका / Photos linked</div><div className="id-stat-value" style={{ color: '#69dcff' }}>{students.filter(s => s.photo_url).length}</div></div>
        <div className="id-stat"><div className="id-stat-label">छानिएका / Selected</div><div className="id-stat-value" style={{ color: '#ff79bc' }}>{selectedIds.length}</div></div>
        <div className="id-stat"><div className="id-stat-label">बदल्न बाँकी / Unsaved changes</div><div className="id-stat-value" style={{ color: dirtyCount ? '#ffcd75' : '#85f0c2' }}>{dirtyCount}</div></div>
      </div>

      <section className="id-panel">
        <h2 className="id-panel-title"><CreditCard size={18} color="#ff79bc" /> परिचयपत्रको विवरण / Card Settings</h2>
        <div className="id-grid">
          <div className="id-field"><label>विद्यालयको नाम / School Name</label><input value={schoolName} onChange={e => setSchoolName(e.target.value)} /></div>
          <div className="id-field"><label>ठेगाना / Address</label><input value={schoolAddress} onChange={e => setSchoolAddress(e.target.value)} /></div>
          <div className="id-field"><label>सम्पर्क / Contact (optional)</label><input value={schoolPhone} onChange={e => setSchoolPhone(e.target.value)} placeholder="Phone number" /></div>
          <div className="id-field"><label>विद्यालय लोगोको URL (optional)</label><input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
        </div>
        <p className="id-help">विद्यालयको नाम, ठेगाना, सम्पर्क र लोगो अहिले यस screen/print session मा लागू हुन्छन्। स्थायी school settings चाहिँदैन भने SQL मा परिवर्तन आवश्यक छैन।</p>
      </section>

      <section className="id-panel">
        <h2 className="id-panel-title"><Link2 size={18} color="#69dcff" /> Google Drive फोटो लिंक र Reg No मिलान / Photo Mapping</h2>
        <p className="id-help" style={{ marginTop: 0 }}>Google Drive मा फोटोको फाइल नाम Reg No जस्तै राख्नुहोस् (उदाहरण: <strong>UEBS-0001.jpg</strong>)। प्रत्येक फोटोको share link लाई spreadsheet मा राखेर Reg No अनुसार import गर्नुहोस्। Drive फोटोमा “Anyone with the link — Viewer” हुनुपर्छ। केवल folder link दिएर browser ले Drive का फाइल स्वतः सूचीबद्ध गर्न सक्दैन; तलको mapping sheet प्रयोग गर्नुहोस्।</p>
        <div className="id-actions" style={{ marginTop: 12 }}>
          <button type="button" className="id-button cyan" onClick={downloadTemplate}><Download size={15} /> Mapping Template डाउनलोड</button>
          <label className="id-button" style={{ cursor: 'pointer' }}><Upload size={15} /> CSV / Excel Mapping Import<input type="file" accept=".csv,.xlsx,.xls" onChange={readMappingFile} style={{ display: 'none' }} /></label>
          {importPreview.length > 0 && <button type="button" className="id-button primary" onClick={importMapping} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : `Save Mapping (${importPreview.length})`}</button>}
        </div>
        {importPreview.length > 0 && <div className="id-mapping-preview"><table><thead><tr><th>Row</th><th>Reg No</th><th>Photo link</th><th>Valid Upto (BS)</th></tr></thead><tbody>{importPreview.slice(0, 20).map((row, index) => <tr key={`${row.rowNumber}-${index}`}><td>{row.rowNumber}</td><td>{row.regNo || '—'}</td><td style={{ maxWidth: 260, overflowWrap: 'anywhere' }}>{row.photoUrl || '—'}</td><td>{row.validUptoBs || '—'}</td></tr>)}</tbody></table></div>}
        <p className="id-help">Spreadsheet columns: <strong>Reg No</strong>, <strong>Photo URL</strong>, <strong>Valid Upto (BS)</strong> (optional). Mapping Reg No बाट existing student record मा save हुन्छ; नयाँ विद्यार्थी बनाउँदैन।</p>
      </section>

      {notice && <div className={`id-notice ${notice.type}`}><span>{notice.type === 'success' ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}</span><span>{notice.text}</span></div>}
      {mappingErrors.length > 0 && <div className="id-notice error"><AlertCircle size={17} /><div>{mappingErrors.map((error, index) => <div key={index}>{error}</div>)}</div></div>}

      <section className="id-panel">
        <h2 className="id-panel-title"><Users size={18} color="#a98cff" /> विद्यार्थी सूची / Student List</h2>
        <div className="id-grid">
          <div className="id-field"><label>खोज्नुहोस् / Search Reg No, Name, Guardian</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Reg No or student name" /></div>
          <div className="id-field"><label>कक्षा / Class</label><select value={gradeFilter} onChange={e => { setGradeFilter(e.target.value); setSectionFilter('all'); }}><option value="all">सबै कक्षा / All grades</option>{grades.map(grade => <option key={grade} value={grade}>{grade}</option>)}</select></div>
          <div className="id-field"><label>Section</label><select value={sectionFilter} onChange={e => setSectionFilter(e.target.value)}><option value="all">सबै Section / All</option>{sections.map(section => <option key={section} value={section}>{section}</option>)}</select></div>
          <div className="id-field"><label>डेटा व्यवस्थापन</label><div className="id-actions"><button type="button" className="id-button" onClick={loadStudents} disabled={loading}><RefreshCw size={14} /> Refresh</button><button type="button" className="id-button" onClick={selectAllVisible}>Select all visible</button><button type="button" className="id-button" onClick={clearSelection}>Clear</button></div></div>
        </div>
        <div className="id-actions" style={{ marginTop: 14 }}>
          <button type="button" className="id-button primary" onClick={saveSelected} disabled={saving || !selectedIds.length}><Save size={15} /> {saving ? 'Saving…' : `Selected विद्यार्थी सेभ (${selectedIds.length})`}</button>
          <button type="button" className="id-button cyan" onClick={printSelected} disabled={printing || !selectedIds.length}><Printer size={15} /> चयन गरिएका कार्ड प्रिन्ट ({selectedIds.length})</button>
          <span className="id-help" style={{ margin: 0 }}>सुची: {filteredStudents.length} विद्यार्थी · फोटो लिंक: {photoCount}</span>
        </div>
        <div className="id-table-wrap">
          <table className="id-student-table"><thead><tr><th><input type="checkbox" aria-label="Select visible students" checked={filteredStudents.length > 0 && filteredStudents.every(s => selectedIds.includes(Number(s.id)))} onChange={e => e.target.checked ? selectAllVisible() : setSelectedIds(old => old.filter(id => !filteredStudents.some(s => Number(s.id) === id)))} /></th><th>Photo</th><th>Reg No</th><th>Student Name</th><th>Class</th><th>Section</th><th>DOB (B.S.)</th><th>Google Drive / Photo URL</th><th>Valid Upto (B.S.)</th></tr></thead>
            <tbody>{filteredStudents.map(student => <tr key={student.id}>
              <td><input type="checkbox" checked={selectedIds.includes(Number(student.id))} onChange={() => toggleSelected(Number(student.id))} aria-label={`Select ${student.student_name}`} /></td>
              <td>{student.photo_url ? <StudentPhoto src={student.photo_url} studentName={student.student_name} className="id-avatar-small" /> : <div className="id-avatar-small id-photo-fallback">{initials(student.student_name)}</div>}</td>
              <td style={{ whiteSpace: 'nowrap', fontWeight: 800 }}>{getRegNo(student) || '—'}</td>
              <td style={{ minWidth: 160 }}>{student.student_name}</td><td>{student.class_name || '—'}</td><td>{student.section || '—'}</td><td>{displayBsDate(student.dob_bs)}</td>
              <td style={{ minWidth: 240 }}><input value={student.photo_url} onChange={e => updateStudent(student.id, { photo_url: e.target.value })} placeholder="Paste Google Drive file sharing URL" /></td>
              <td><input value={student.id_card_valid_upto_bs} onChange={e => updateStudent(student.id, { id_card_valid_upto_bs: e.target.value })} placeholder="२०८३-१२-३०" /></td>
            </tr>)}
            {!filteredStudents.length && <tr><td colSpan="9" style={{ textAlign: 'center', padding: 25 }}>{loading ? 'विद्यार्थी विवरण लोड हुँदैछ…' : 'विद्यार्थी भेटिएन।'}</td></tr>}
            </tbody></table>
        </div>
        <p className="id-help">मिति वि.सं. मा <strong>YYYY-MM-DD</strong> ढाँचामा राख्नुहोस् (उदाहरण: २०८३-१२-३०)। कार्डको भौतिक आकार CR80 / ID-1: <strong>85.6 × 54 mm</strong>, Landscape हो। प्रिन्ट गर्दा Browser dialog मा background graphics चालू गर्नुहोस् र Scale 100%/Actual Size राख्नुहोस्।</p>
      </section>

      <section className="id-panel">
        <h2 className="id-panel-title"><CreditCard size={18} color="#ff79bc" /> कार्ड पूर्वावलोकन / Preview</h2>
        <div className="id-card-preview-grid">{selectedStudents.slice(0, 6).map(student => <div key={student.id}><IdCardFace student={student} schoolName={schoolName} schoolAddress={schoolAddress} schoolPhone={schoolPhone} logoUrl={logoUrl} /></div>)}</div>
        {!selectedStudents.length && <p className="id-help">पूर्वावलोकन हेर्न माथिको सूचीबाट विद्यार्थी चयन गर्नुहोस्।</p>}
        {selectedStudents.length > 6 && <p className="id-help">पहिलो ६ कार्डको पूर्वावलोकन देखाइएको छ; प्रिन्टमा सबै {selectedStudents.length} चयन गरिएका कार्ड समावेश हुनेछन्।</p>}
      </section>

      <div className="id-print-root" aria-hidden="true">
        {sheets.map((sheet, sheetIndex) => <div className="id-print-sheet" key={sheetIndex}>{sheet.map(student => <IdCardFace key={student.id} student={student} schoolName={schoolName} schoolAddress={schoolAddress} schoolPhone={schoolPhone} logoUrl={logoUrl} />)}</div>)}
      </div>
    </div>
  );
}
