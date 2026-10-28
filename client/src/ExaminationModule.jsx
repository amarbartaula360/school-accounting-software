import React, { useCallback, useEffect, useMemo, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import {
  Activity, Archive, BadgeCheck, BookOpen, CalendarDays, CheckCircle2,
  ClipboardCheck, Download, FileBadge, FileCheck2, FileClock, FileText,
  GraduationCap, History, Languages, LockKeyhole, Plus, Printer, RefreshCw,
  Save, Search, Settings2, ShieldCheck, Users, XCircle
} from 'lucide-react';

const GRADES = [4, 5, 6, 7, 8, 9, 10];
const BS_MONTHS = ['वैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज', 'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत'];
const TYPES = ['written', 'internal', 'practical', 'project', 'continuous', 'presentation', 'portfolio', 'oral', 'other'];
const ROLE_LABELS = { admin: 'Administrator', principal: 'Principal', exam_coordinator: 'Exam Coordinator', teacher: 'Teacher' };

function normalizeDigits(value) {
  const devanagari = '०१२३४५६७८९';
  return String(value ?? '').replace(/[०-९]/g, d => String(devanagari.indexOf(d)));
}
function toNepaliDigits(value) {
  const devanagari = '०१२३४५६७८९';
  return String(value ?? '').replace(/[0-9]/g, d => devanagari[Number(d)]);
}
function toBS(ad) {
  if (!ad) return '';
  try { return new NepaliDate(new Date(`${String(ad).slice(0, 10)}T12:00:00`)).format('YYYY-MM-DD'); }
  catch { return ''; }
}
function fromBS(input) {
  const n = normalizeDigits(input).trim().replaceAll('/', '-');
  const match = n.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return '';
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 32) return '';
  try {
    const adDate = new NepaliDate(y, m - 1, d).toJsDate();
    if (!(adDate instanceof Date) || Number.isNaN(adDate.getTime())) return '';
    const ad = `${adDate.getFullYear()}-${String(adDate.getMonth() + 1).padStart(2, '0')}-${String(adDate.getDate()).padStart(2, '0')}`;
    return toBS(ad) === `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` ? ad : '';
  } catch { return ''; }
}
function todayBS() {
  const d = new Date();
  const ad = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return toBS(ad);
}
function gradeModel(grade) {
  if (Number(grade) <= 5) return 'learning_achievement';
  if (Number(grade) <= 8) return 'subject_assessment';
  return 'formal_marksheet';
}
function gradeModelLabel(model, language) {
  const map = {
    learning_achievement: ['सिकाइ उपलब्धि प्रतिवेदन', 'Learning achievement report'],
    subject_assessment: ['विषयगत मूल्याङ्कन', 'Subject-wise assessment'],
    formal_marksheet: ['औपचारिक मार्कसिट', 'Formal marksheet']
  };
  return map[model]?.[language === 'ne' ? 0 : 1] || model;
}
function gradeFromClass(value) {
  const raw = normalizeDigits(String(value || '').trim().toLowerCase());
  if (!raw) return null;
  const numeric = raw.match(/(?:^|\D)(10|[4-9])(?:\D|$)/);
  if (numeric) return Number(numeric[1]);
  const normalized = raw
    .replace(/^(class|grade)\s*/, '')
    .replace(/^कक्षा\s*/, '')
    .trim();
  const namedGrades = {
    four: 4, fourth: 4, चार: 4,
    five: 5, fifth: 5, पाँच: 5, पांच: 5,
    six: 6, sixth: 6, छ: 6, छह: 6,
    seven: 7, seventh: 7, सात: 7,
    eight: 8, eighth: 8, आठ: 8,
    nine: 9, ninth: 9, नौ: 9,
    ten: 10, tenth: 10, दश: 10, दस: 10
  };
  return namedGrades[normalized] ?? namedGrades[raw] ?? null;
}
function fmtMoney(value) {
  if (value === null || value === undefined || value === '') return '—';
  return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
function statusLabel(status, lang) {
  const labels = {
    draft: ['मस्यौदा', 'Draft'], in_review: ['समीक्षामा', 'In review'],
    approved: ['स्वीकृत', 'Approved'], locked: ['लक गरिएको', 'Locked'], published: ['प्रकाशित', 'Published']
  };
  return labels[status]?.[lang === 'ne' ? 0 : 1] || status;
}

const words = {
  ne: {
    title: 'परीक्षा तथा प्रगति प्रतिवेदन', subtitle: 'कक्षा ४–१० · नेपाली/English · आधिकारिक नियम कन्फिगर गर्न मिल्ने',
    dashboard: 'ड्यासबोर्ड', years: 'शैक्षिक सत्र', curriculum: 'विषय तथा सिकाइ उपलब्धि', exams: 'परीक्षा तथा सेटअप', marks: 'अङ्क प्रविष्टि', reports: 'मार्कसिट / प्रगति प्रतिवेदन', grading: 'ग्रेडिङ नियम', access: 'भूमिका / Audit',
    activeStudents: 'सक्रिय विद्यार्थी', academicYears: 'शैक्षिक सत्र', totalExams: 'परीक्षा संख्या', published: 'प्रकाशित नतिजा', verifiedRules: 'प्रमाणित ग्रेड नियम',
    officialRules: 'CDC / CEHRD का लागू हुने दस्तावेज जाँच्नुहोस्। ग्रेड, GPA, pass mark तथा कक्षा ४–५ का उपलब्धि स्तर यहाँ पूर्वनिर्धारित गरिएको छैन; लागू guideline बाट Admin ले कन्फिगर गर्नुपर्छ।',
    createYear: 'शैक्षिक सत्र थप्नुहोस्', yearName: 'सत्रको नाम', startDate: 'सुरु मिति (वि.सं.)', endDate: 'अन्तिम मिति (वि.सं.)', save: 'सेभ गर्नुहोस्', activate: 'सक्रिय बनाउनुहोस्', active: 'सक्रिय', inactive: 'निष्क्रिय',
    addSubject: 'विषय थप्नुहोस्', grade: 'कक्षा', code: 'कोड', nameEn: 'विषयको नाम (English)', nameNe: 'विषयको नाम (नेपाली)', practical: 'प्रयोगात्मक छ', addCompetency: 'सिकाइ उपलब्धि थप्नुहोस्', compCode: 'उपलब्धि कोड', compEn: 'Competency (English)', compNe: 'सिकाइ उपलब्धि (नेपाली)', source: 'आधिकारिक स्रोत / Guideline', sourceClause: 'दफा / पृष्ठ', sourceReference: 'स्रोतको विस्तृत सन्दर्भ',
    addLevel: 'उपलब्धि स्तर थप्नुहोस्', levelCode: 'स्तर कोड', levelEn: 'स्तर (English)', levelNe: 'स्तर (नेपाली)', descriptionEn: 'विवरण (English)', descriptionNe: 'विवरण (नेपाली)', officialVerified: 'आधिकारिक निर्देशिकाबाट जाँचिएको',
    createExam: 'परीक्षा सिर्जना गर्नुहोस्', selectYear: 'शैक्षिक सत्र छान्नुहोस्', className: 'कक्षाको नाम', section: 'सेक्सन', examNameEn: 'परीक्षाको नाम (English)', examNameNe: 'परीक्षाको नाम (नेपाली)', examType: 'परीक्षाको प्रकार', examDate: 'परीक्षा मिति (वि.सं.)', model: 'मूल्याङ्कन नमुना',
    chooseExam: 'परीक्षा छान्नुहोस्', noExam: 'पहिले परीक्षा सिर्जना गर्नुहोस्।', configureSubject: 'परीक्षामा विषय जोड्नुहोस्', subject: 'विषय', fullMarks: 'पूर्णाङ्क (यदि लागू हुन्छ)', passMarks: 'उत्तीर्णाङ्क (यदि लागू हुन्छ)', creditHours: 'Credit Hours (यदि लागू हुन्छ)', addComponent: 'मूल्याङ्कन भाग थप्नुहोस्', componentCode: 'Component कोड', componentEn: 'नाम (English)', componentNe: 'नाम (नेपाली)', componentType: 'भागको प्रकार', maxMarks: 'अधिकतम अङ्क (खाली = वर्णनात्मक)', componentPassMarks: 'भागको उत्तीर्णाङ्क (यदि लागू हुन्छ)',
    roster: 'विद्यार्थी सूची', selectSubject: 'विषय छान्नुहोस्', selectComponent: 'मूल्याङ्कन भाग छान्नुहोस्', marksObtained: 'प्राप्ताङ्क', absent: 'अनुपस्थित', note: 'शिक्षक टिप्पणी', saveMarks: 'अङ्क सेभ गर्नुहोस्', lockedNote: 'यो परीक्षा locked/published भइसकेको छ। अङ्क सम्पादन बन्द छ।',
    student: 'विद्यार्थी', competency: 'सिकाइ उपलब्धि', achievement: 'उपलब्धि स्तर', observation: 'अवलोकन / प्रमाण', nextSteps: 'अर्को सिकाइ योजना', saveCompetency: 'उपलब्धि सेभ गर्नुहोस्',
    progress: 'विद्यार्थी प्रगति विवरण', strengths: 'सबलीय पक्ष', improvement: 'सुधार गर्नुपर्ने पक्ष', teacherComments: 'शिक्षकको टिप्पणी', recommendations: 'अभिभावक/आगामी सिकाइ सिफारिस', parentFeedback: 'अभिभावकको प्रतिक्रिया', attendancePresent: 'उपस्थित दिन', attendanceTotal: 'कुल विद्यालय खुलेका दिन', saveProgress: 'प्रगति प्रतिवेदन सेभ गर्नुहोस्',
    printStandard: 'मानक मार्कसिट प्रिन्ट / PDF', printProgress: 'विस्तृत प्रगति रिपोर्ट प्रिन्ट / PDF', printBulk: 'कक्षाका सबै रिपोर्ट प्रिन्ट', selectStudent: 'विद्यार्थी छान्नुहोस्', preview: 'प्रतिवेदन पूर्वावलोकन', noStudents: 'यस कक्षा/सेक्सनमा सक्रिय विद्यार्थी छैनन्।',
    gradingRules: 'ग्रेड सीमा कन्फिगर गर्नुहोस्', minPct: 'न्यूनतम %', maxPct: 'अधिकतम %', letterGrade: 'Letter Grade / स्तर', gradePoint: 'Grade Point', verified: 'स्रोत प्रमाणित', saveRule: 'ग्रेड नियम सेभ', gpaPolicy: 'GPA / उत्तीर्ण नीति', gpaMethod: 'GPA गणना विधि', gpaMax: 'अधिकतम GPA', passRule: 'समग्र उत्तीर्ण नियम', promotionRule: 'कक्षा उन्नति नियम', savePolicy: 'नीति सेभ', notConfigured: 'नियम कन्फिगर गरिएको छैन',
    sendReview: 'समीक्षामा पठाउनुहोस्', approve: 'नतिजा स्वीकृत', lock: 'नतिजा Lock', publish: 'नतिजा प्रकाशित', draftAgain: 'मस्यौदामा फर्काउनुहोस्', history: 'परिवर्तन इतिहास', roles: 'भूमिका व्यवस्थापन', userEmail: 'शिक्षक/प्रयोगकर्ताको Email', role: 'भूमिका', assignRole: 'भूमिका दिनुहोस्', deactivate: 'निष्क्रिय',
    loading: 'लोड हुँदैछ…', refresh: 'Refresh', search: 'खोज्नुहोस्…', saved: 'सेभ भयो।', error: 'समस्या', noRules: 'ग्रेड नियम छैनन्। ग्रेड/GPA गणना गर्नुअघि आधिकारिक निर्देशिकाअनुसार Admin ले rule थपेर प्रमाणित गर्नुपर्छ।', noLevels: 'कक्षा अनुसार achievement level कन्फिगर गरिएको छैन।', printHint: 'Print dialog मा “Save as PDF” छानेर PDF बनाउन सक्नुहुन्छ।',
    sourceLabel: 'आधिकारिक सन्दर्भ', select: 'छान्नुहोस्', all: 'सबै', noRecords: 'रेकर्ड छैन।', draft: 'मस्यौदा', formal: 'औपचारिक',
    examInfo: 'परीक्षा जानकारी', examStatus: 'नतिजा स्थिति', currentUser: 'प्रयोगकर्ता', permissionHint: 'भूमिका DB मा तोकिएको हुनुपर्छ।', noPrintExam: 'प्रिन्ट गर्न परीक्षा छान्नुहोस्।', gradeNotConfigured: 'ग्रेड नियम उपलब्ध/प्रमाणित नभएकाले ग्रेड देखाइएन।', overallStatus: 'समग्र नतिजा', percent: 'प्रतिशत', total: 'जम्मा',
    sourceWarning: 'यो module ले CDC/CEHRD दस्तावेजका शीर्षक/प्रकाशन पुष्टि गरेको छ; PDF का सबै दफा यस runtime मा पूर्ण रूपमा पढेर cross-check गर्न सकिएको छैन। त्यसैले numeric rules default गरिएको छैन।',
  },
  en: {
    title: 'Examination & Student Progress', subtitle: 'Grades 4–10 · Nepali/English · Configurable official rules',
    dashboard: 'Dashboard', years: 'Academic Years', curriculum: 'Subjects & Competencies', exams: 'Exams & Setup', marks: 'Marks Entry', reports: 'Marksheet / Progress Report', grading: 'Grading Rules', access: 'Roles / Audit',
    activeStudents: 'Active Students', academicYears: 'Academic Years', totalExams: 'Examinations', published: 'Published Results', verifiedRules: 'Verified Grade Rules',
    officialRules: 'Check the applicable CDC / CEHRD documents. Grade bands, GPA, pass marks and Grades 4–5 achievement levels are not preset; an administrator must configure them from the applicable guideline.',
    createYear: 'Add Academic Year', yearName: 'Year Name', startDate: 'Start Date (B.S.)', endDate: 'End Date (B.S.)', save: 'Save', activate: 'Set Active', active: 'Active', inactive: 'Inactive',
    addSubject: 'Add Subject', grade: 'Grade', code: 'Code', nameEn: 'Subject Name (English)', nameNe: 'Subject Name (Nepali)', practical: 'Has practical component', addCompetency: 'Add Competency / Outcome', compCode: 'Competency Code', compEn: 'Competency (English)', compNe: 'Learning Outcome (Nepali)', source: 'Official Source / Guideline', sourceClause: 'Clause / Page', sourceReference: 'Detailed Source Reference',
    addLevel: 'Add Achievement Level', levelCode: 'Level Code', levelEn: 'Level (English)', levelNe: 'Level (Nepali)', descriptionEn: 'Description (English)', descriptionNe: 'Description (Nepali)', officialVerified: 'Verified against official guideline',
    createExam: 'Create Exam', selectYear: 'Select Academic Year', className: 'Class Name', section: 'Section', examNameEn: 'Exam Name (English)', examNameNe: 'Exam Name (Nepali)', examType: 'Exam Type', examDate: 'Exam Date (B.S.)', model: 'Assessment Model',
    chooseExam: 'Select Exam', noExam: 'Create an exam first.', configureSubject: 'Add Subject to Exam', subject: 'Subject', fullMarks: 'Full Marks (if applicable)', passMarks: 'Pass Marks (if applicable)', creditHours: 'Credit Hours (if applicable)', addComponent: 'Add Assessment Component', componentCode: 'Component Code', componentEn: 'Name (English)', componentNe: 'Name (Nepali)', componentType: 'Component Type', maxMarks: 'Maximum Marks (blank = descriptive)', componentPassMarks: 'Component Pass Marks (if applicable)',
    roster: 'Student Roster', selectSubject: 'Select Subject', selectComponent: 'Select Component', marksObtained: 'Marks Obtained', absent: 'Absent', note: 'Teacher Note', saveMarks: 'Save Marks', lockedNote: 'This exam is locked/published. Marks editing is disabled.',
    student: 'Student', competency: 'Competency / Outcome', achievement: 'Achievement Level', observation: 'Observation / Evidence', nextSteps: 'Next Learning Steps', saveCompetency: 'Save Competency Result',
    progress: 'Student Progress Details', strengths: 'Strengths', improvement: 'Areas for Improvement', teacherComments: 'Teacher Comments', recommendations: 'Parent / Follow-up Recommendations', parentFeedback: 'Parent Feedback', attendancePresent: 'Days Present', attendanceTotal: 'Total School Days', saveProgress: 'Save Progress Report',
    printStandard: 'Print Standard Marksheet / PDF', printProgress: 'Print Detailed Progress Report / PDF', printBulk: 'Print All Class Reports', selectStudent: 'Select Student', preview: 'Report Preview', noStudents: 'No active students in this grade.',
    gradingRules: 'Configure Grade Boundaries', minPct: 'Minimum %', maxPct: 'Maximum %', letterGrade: 'Letter Grade / Level', gradePoint: 'Grade Point', verified: 'Source verified', saveRule: 'Save Grading Rule', gpaPolicy: 'GPA / Pass Policy', gpaMethod: 'GPA Calculation Method', gpaMax: 'Maximum GPA', passRule: 'Overall Pass Rule', promotionRule: 'Promotion Rule', savePolicy: 'Save Policy', notConfigured: 'Not configured',
    sendReview: 'Submit for Review', approve: 'Approve Results', lock: 'Lock Results', publish: 'Publish Results', draftAgain: 'Return to Draft', history: 'Change History', roles: 'Role Management', userEmail: 'Teacher / User Email', role: 'Role', assignRole: 'Assign Role', deactivate: 'Deactivate',
    loading: 'Loading…', refresh: 'Refresh', search: 'Search…', saved: 'Saved.', error: 'Error', noRules: 'No grading rules. Admin must add and verify official rules before grades/GPA can be calculated.', noLevels: 'Achievement levels are not configured for this grade.',
    printHint: 'Choose “Save as PDF” in the print dialog to save a PDF.', sourceLabel: 'Official Reference', select: 'Select', all: 'All', noRecords: 'No records.', draft: 'Draft', formal: 'Formal',
    examInfo: 'Exam Information', examStatus: 'Result Status', currentUser: 'User', permissionHint: 'A role must be assigned in the database.', noPrintExam: 'Select an exam before printing.', gradeNotConfigured: 'Grade not displayed: no matching verified grade rule.', overallStatus: 'Overall Result', percent: 'Percentage', total: 'Total',
    sourceWarning: 'This implementation verifies the official CDC/CEHRD document listings, but the complete clause text was not fully available for cross-check in this runtime. Numeric rules are therefore not preset.',
  }
};

export default function ExaminationModule({ apiBaseUrl, organizationId = 1, user }) {
  const [lang, setLang] = useState('ne');
  const t = (key) => words[lang]?.[key] ?? words.en[key] ?? key;
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [years, setYears] = useState([]);
  const [students, setStudents] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [levels, setLevels] = useState([]);
  const [rules, setRules] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [exams, setExams] = useState([]);
  const [roles, setRoles] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedExamId, setSelectedExamId] = useState('');
  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedExamSubjectId, setSelectedExamSubjectId] = useState('');
  const [selectedComponentId, setSelectedComponentId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedPrintStudentId, setSelectedPrintStudentId] = useState('');
  const [printMode, setPrintMode] = useState(null);
  const [printBulk, setPrintBulk] = useState(false);
  const [auditRows, setAuditRows] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [reportSettings, setReportSettings] = useState({});
  const [markValues, setMarkValues] = useState({});
  const [absentValues, setAbsentValues] = useState({});
  const [noteValues, setNoteValues] = useState({});

  const [yearForm, setYearForm] = useState({ yearName: '२०८३', startDateBs: '२०८३-०१-०१', endDateBs: '२०८३-१२-३०' });
  const [subjectForm, setSubjectForm] = useState({ grade: 4, subjectCode: '', nameEn: '', nameNe: '', isPractical: false });
  const [competencyForm, setCompetencyForm] = useState({ grade: 4, subjectId: '', competencyCode: '', descriptionEn: '', descriptionNe: '', sourceGuideline: '', sourceReference: '' });
  const [levelForm, setLevelForm] = useState({ grade: 4, levelCode: '', nameEn: '', nameNe: '', descriptionEn: '', descriptionNe: '', sourceGuideline: '', isOfficiallyVerified: false, displayOrder: 1 });
  const [examForm, setExamForm] = useState({ academicYearId: '', grade: 4, examNameEn: '', examNameNe: '', examType: 'terminal', examDateBs: todayBS() });
  const [scheduleForm, setScheduleForm] = useState({ examSubjectId: '', examDateBs: todayBS(), startTime: '09:00', endTime: '10:00', roomOrVenue: '', invigilator: '' });
  const [examSubjectForm, setExamSubjectForm] = useState({ subjectId: '', fullMarks: '', passMarks: '', creditHours: '' });
  const [componentForm, setComponentForm] = useState({ examSubjectId: '', componentCode: '', nameEn: '', nameNe: '', componentType: 'continuous', maxMarks: '', passMarks: '', displayOrder: 1 });
  const [ruleForm, setRuleForm] = useState({ grade: 9, academicYearId: '', minPercentage: '', maxPercentage: '', letterGrade: '', gradePoint: '', descriptionEn: '', descriptionNe: '', sourceGuideline: '', sourceClause: '', isVerified: false });
  const [policyForm, setPolicyForm] = useState({ grade: 9, academicYearId: '', gpaMethod: 'not_configured', gpaMax: '', overallPassRule: '', promotionRule: '', sourceGuideline: '', sourceClause: '', isVerified: false });
  const [roleForm, setRoleForm] = useState({ userEmail: '', role: 'teacher' });
  const [reportSettingsForm, setReportSettingsForm] = useState({ schoolNameEn: '', schoolNameNe: '', addressEn: '', addressNe: '', contactPhone: '', contactEmail: '', logoUrl: '' });
  const [competencyResultForm, setCompetencyResultForm] = useState({ subjectId: '', competencyId: '', achievementLevelId: '', observationEn: '', observationNe: '', evidenceNote: '', nextStepsEn: '', nextStepsNe: '' });
  const [progressForm, setProgressForm] = useState({ strengthsEn: '', strengthsNe: '', improvementAreasEn: '', improvementAreasNe: '', teacherCommentsEn: '', teacherCommentsNe: '', recommendationsEn: '', recommendationsNe: '', parentFeedback: '', attendancePresent: '', attendanceTotal: '' });

  const api = useCallback(async (path, options = {}) => {
    const url = new URL(`${apiBaseUrl}${path}`);
    if (path.startsWith('/api/exams') && !url.searchParams.has('organizationId')) url.searchParams.set('organizationId', String(organizationId));
    const headers = { 'X-User-Email': String(user?.email || '').toLowerCase(), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) };
    const body = options.body ? JSON.stringify({ organizationId, ...options.body }) : undefined;
    const response = await fetch(url.toString(), { ...options, headers, body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  }, [apiBaseUrl, organizationId, user?.email]);

  const refreshBase = useCallback(async () => {
    setLoading(true); setError('');
    const jobs = [
      ['years', api('/api/exams/academic-years')],
      ['students', api(`/api/fee/students?organizationId=${organizationId}`)],
      ['subjects', api('/api/exams/subjects')],
      ['competencies', api('/api/exams/competencies')],
      ['levels', api('/api/exams/achievement-levels')],
      ['rules', api('/api/exams/grading-rules')],
      ['policies', api('/api/exams/grading-policies')],
      ['exams', api('/api/exams')],
      ['summary', api('/api/exams/summary')],
      ['roles', api('/api/exams/roles')],
      ['reportSettings', api('/api/exams/report-settings')]
    ];
    const result = await Promise.allSettled(jobs.map(x => x[1]));
    const map = {};
    result.forEach((r, i) => { if (r.status === 'fulfilled') map[jobs[i][0]] = r.value; });
    if (map.years) setYears(map.years);
    if (map.students) setStudents(Array.isArray(map.students) ? map.students : []);
    if (map.subjects) setSubjects(map.subjects);
    if (map.competencies) setCompetencies(map.competencies);
    if (map.levels) setLevels(map.levels);
    if (map.rules) setRules(map.rules);
    if (map.policies) setPolicies(map.policies);
    if (map.exams) setExams(map.exams);
    if (map.summary) setSummary(map.summary);
    if (map.roles) setRoles(map.roles);
    if (map.reportSettings) setReportSettings(map.reportSettings);
    const failed = result.find(r => r.status === 'rejected');
    if (failed) setError(failed.reason?.message || 'Could not load module data.');
    setLoading(false);
  }, [api, organizationId]);

  const refreshDetails = useCallback(async (id = selectedExamId) => {
    if (!id) { setDetails(null); return; }
    setDetailsLoading(true); setError('');
    try {
      const data = await api(`/api/exams/${id}/details`);
      setDetails(data);
      if (!data.students?.some(s => String(s.id) === String(selectedStudentId))) setSelectedStudentId(data.students?.[0] ? String(data.students[0].id) : '');
      if (!data.students?.some(s => String(s.id) === String(selectedPrintStudentId))) setSelectedPrintStudentId(data.students?.[0] ? String(data.students[0].id) : '');
      if (!data.subjects?.some(s => String(s.id) === String(selectedExamSubjectId))) setSelectedExamSubjectId(data.subjects?.[0] ? String(data.subjects[0].id) : '');
    } catch (e) { setError(e.message); setDetails(null); }
    finally { setDetailsLoading(false); }
  }, [api, selectedExamId, selectedStudentId, selectedPrintStudentId, selectedExamSubjectId]);

  useEffect(() => { refreshBase(); }, [refreshBase]);
  useEffect(() => {
    if (selectedExamId) refreshDetails(selectedExamId);
    else setDetails(null);
  }, [selectedExamId, refreshDetails]);
  useEffect(() => {
    if (!selectedExamId) { setAuditRows([]); setReportHistory([]); return; }
    api(`/api/exams/${selectedExamId}/history`).then(setAuditRows).catch(() => setAuditRows([]));
    api(`/api/exams/${selectedExamId}/print-history`).then(setReportHistory).catch(() => setReportHistory([]));
  }, [api, selectedExamId, details?.exam?.status]);
  useEffect(() => {
    if (details?.subjects?.length && !details.subjects.some(s => String(s.id) === String(selectedExamSubjectId))) setSelectedExamSubjectId(String(details.subjects[0].id));
    if (details?.subjects?.length && !details.subjects.some(s => String(s.id) === String(componentForm.examSubjectId))) setComponentForm(v => ({ ...v, examSubjectId: String(details.subjects[0].id) }));
  }, [details?.subjects, selectedExamSubjectId, componentForm.examSubjectId]);
  useEffect(() => {
    if (!details?.subjects?.length) {
      if (scheduleForm.examSubjectId) setScheduleForm(f => ({ ...f, examSubjectId: '' }));
      return;
    }
    if (!details.subjects.some(s => String(s.id) === String(scheduleForm.examSubjectId))) {
      setScheduleForm(f => ({ ...f, examSubjectId: String(details.subjects[0].id) }));
    }
  }, [details?.subjects, scheduleForm.examSubjectId]);
  useEffect(() => {
    if (!scheduleForm.examSubjectId) return;
    const row = (details?.schedule || []).find(r => String(r.exam_subject_id) === String(scheduleForm.examSubjectId));
    if (row) {
      setScheduleForm(f => ({ ...f, examDateBs: row.exam_date_bs || toBS(row.exam_date) || todayBS(), startTime: String(row.start_time || '').slice(0,5), endTime: String(row.end_time || '').slice(0,5), roomOrVenue: row.room_or_venue || '', invigilator: row.invigilator || '' }));
    } else {
      setScheduleForm(f => ({ ...f, examDateBs: todayBS(), startTime: '09:00', endTime: '10:00', roomOrVenue: '', invigilator: '' }));
    }
  }, [details?.schedule, scheduleForm.examSubjectId]);
  useEffect(() => {
    const first = details?.components?.find(c => String(c.exam_subject_id) === String(selectedExamSubjectId));
    if (first && !details.components.some(c => String(c.id) === String(selectedComponentId) && String(c.exam_subject_id) === String(selectedExamSubjectId))) setSelectedComponentId(String(first.id));
  }, [details?.components, selectedExamSubjectId, selectedComponentId]);
  useEffect(() => {
    setReportSettingsForm({
      schoolNameEn: reportSettings.school_name_en || '', schoolNameNe: reportSettings.school_name_ne || '',
      addressEn: reportSettings.address_en || '', addressNe: reportSettings.address_ne || '',
      contactPhone: reportSettings.contact_phone || '', contactEmail: reportSettings.contact_email || '',
      logoUrl: reportSettings.logo_url || ''
    });
  }, [reportSettings]);
  useEffect(() => {
    if (!printMode) return undefined;
    const timer = setTimeout(() => window.print(), 350);
    const clear = () => setPrintMode(null);
    window.addEventListener('afterprint', clear);
    return () => { clearTimeout(timer); window.removeEventListener('afterprint', clear); };
  }, [printMode]);
  useEffect(() => {
    const year = years.find(y => y.is_active) || years[0];
    if (year && !examForm.academicYearId) setExamForm(v => ({ ...v, academicYearId: String(year.id) }));
  }, [years, examForm.academicYearId]);
  useEffect(() => {
    setCompetencyForm(v => ({ ...v, grade: Number(subjectForm.grade), subjectId: '' }));
  }, [subjectForm.grade]);

  const notify = (message) => { setNotice(message); setError(''); window.setTimeout(() => setNotice(''), 4500); };
  const run = async (fn, successMessage = t('saved'), refresh = true) => {
    setBusy(true); setError(''); setNotice('');
    try { await fn(); if (refresh) await refreshBase(); notify(successMessage); }
    catch (e) { setError(e.message || 'Request failed.'); }
    finally { setBusy(false); }
  };
  const isGradeWideExam = (exam) => !exam.section && String(exam.class_name || '').trim().toLowerCase() === `grade ${Number(exam.grade)}`;
  const displayExams = useMemo(() => {
    const grouped = new Map();
    for (const exam of exams) {
      const key = [exam.academic_year_id || exam.year_name, exam.grade, exam.exam_name_en, exam.exam_type, exam.exam_date_bs || exam.exam_date || '', exam.status].join('|');
      const previous = grouped.get(key);
      const priority = (item) => isGradeWideExam(item) ? 2 : 1;
      if (!previous || priority(exam) > priority(previous) || (priority(exam) === priority(previous) && Number(exam.id) > Number(previous.id))) {
        grouped.set(key, exam);
      }
    }
    return [...grouped.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) || Number(b.id) - Number(a.id));
  }, [exams]);
  const selectedExam = details?.exam || exams.find(e => String(e.id) === String(selectedExamId)) || null;
  const editable = ['draft', 'in_review'].includes(selectedExam?.status);
  const selectedExamSubject = details?.subjects?.find(s => String(s.id) === String(selectedExamSubjectId)) || null;
  const components = details?.components?.filter(c => String(c.exam_subject_id) === String(selectedExamSubjectId)) || [];
  const selectedComponent = components.find(c => String(c.id) === String(selectedComponentId)) || components[0] || null;
  const selectedStudent = details?.students?.find(s => String(s.id) === String(selectedStudentId)) || null;
  const selectedPrintStudent = details?.students?.find(s => String(s.id) === String(selectedPrintStudentId)) || null;
  const gradeSubjects = subjects.filter(s => Number(s.grade) === Number(examForm.grade));
  const competencySubjects = subjects.filter(s => Number(s.grade) === Number(competencyForm.grade));
  // Examinations are grade-wide: class names and sections are student-level details, not exam setup fields.
  const canEdit = ['admin', 'exam_coordinator', 'teacher'].includes(roles.find(r => r.user_email?.toLowerCase() === user?.email?.toLowerCase() && r.is_active)?.role);
  const isAdmin = roles.find(r => r.user_email?.toLowerCase() === user?.email?.toLowerCase() && r.is_active)?.role === 'admin';

  const addYear = () => run(async () => {
    const startDate = fromBS(yearForm.startDateBs), endDate = fromBS(yearForm.endDateBs);
    if (!startDate || !endDate) throw new Error('वि.सं. सुरु/अन्तिम मिति मिलेन। YYYY-MM-DD प्रयोग गर्नुहोस्।');
    await api('/api/exams/academic-years', { method: 'POST', body: { yearName: normalizeDigits(yearForm.yearName), startDate, endDate } });
  }, lang === 'ne' ? 'शैक्षिक सत्र थपियो।' : 'Academic year added.');

  const activateYear = (id) => run(async () => { await api(`/api/exams/academic-years/${id}/activate`, { method: 'PUT', body: {} }); }, lang === 'ne' ? 'शैक्षिक सत्र सक्रिय भयो।' : 'Academic year activated.');
  const addSubject = (e) => { e.preventDefault(); run(async () => { await api('/api/exams/subjects', { method: 'POST', body: subjectForm }); setSubjectForm(v => ({ ...v, subjectCode: '', nameEn: '', nameNe: '', isPractical: false })); }, lang === 'ne' ? 'विषय थपियो।' : 'Subject added.'); };
  const addCompetency = (e) => { e.preventDefault(); run(async () => { await api('/api/exams/competencies', { method: 'POST', body: competencyForm }); setCompetencyForm(v => ({ ...v, competencyCode: '', descriptionEn: '', descriptionNe: '', sourceGuideline: '', sourceReference: '' })); }, lang === 'ne' ? 'सिकाइ उपलब्धि थपियो।' : 'Competency added.'); };
  const addLevel = (e) => { e.preventDefault(); run(async () => { await api('/api/exams/achievement-levels', { method: 'POST', body: levelForm }); setLevelForm(v => ({ ...v, levelCode: '', nameEn: '', nameNe: '', descriptionEn: '', descriptionNe: '', sourceGuideline: '', isOfficiallyVerified: false })); }, lang === 'ne' ? 'उपलब्धि स्तर थपियो।' : 'Achievement level added.'); };
  const createExam = (e) => { e.preventDefault(); run(async () => {
    const examDate = examForm.examDateBs ? fromBS(examForm.examDateBs) : null;
    if (examForm.examDateBs && !examDate) throw new Error(lang === 'ne' ? 'परीक्षा मिति वि.सं. मा मिलेन।' : 'Invalid Bikram Sambat exam date.');
    const model = gradeModel(examForm.grade);
    const created = await api('/api/exams', { method: 'POST', body: { ...examForm, grade: Number(examForm.grade), className: `Grade ${Number(examForm.grade)}`, section: '', examDate, examDateBs: examForm.examDateBs, assessmentModel: model } });
    setSelectedExamId(String(created.id)); setTab('exams'); setExamSubjectForm(v => ({ ...v, subjectId: '' }));
  }, lang === 'ne' ? 'परीक्षा सिर्जना भयो।' : 'Exam created.'); };
  const addExamSubject = (e) => { e.preventDefault(); if (!selectedExamId) return; run(async () => {
    await api(`/api/exams/${selectedExamId}/subjects`, { method: 'POST', body: { subjectId: Number(examSubjectForm.subjectId), fullMarks: examSubjectForm.fullMarks, passMarks: examSubjectForm.passMarks, creditHours: examSubjectForm.creditHours, displayOrder: (details?.subjects?.length || 0) + 1 } });
    setExamSubjectForm({ subjectId: '', fullMarks: '', passMarks: '', creditHours: '' }); await refreshDetails(selectedExamId);
  }, lang === 'ne' ? 'परीक्षामा विषय थपियो।' : 'Subject linked to exam.', false); };
  const addComponent = (e) => { e.preventDefault(); if (!selectedExamId || !componentForm.examSubjectId) return; run(async () => {
    await api(`/api/exams/${selectedExamId}/subjects/${componentForm.examSubjectId}/components`, { method: 'POST', body: { ...componentForm, maxMarks: componentForm.maxMarks === '' ? null : Number(componentForm.maxMarks), passMarks: componentForm.passMarks === '' ? null : Number(componentForm.passMarks), displayOrder: (details?.components?.filter(c => String(c.exam_subject_id) === String(componentForm.examSubjectId)).length || 0) + 1 } });
    setComponentForm(v => ({ ...v, componentCode: '', nameEn: '', nameNe: '', maxMarks: '', passMarks: '' })); await refreshDetails(selectedExamId);
  }, lang === 'ne' ? 'मूल्याङ्कन भाग थपियो।' : 'Component added.', false); };

  const saveSchedule = (e) => { e.preventDefault(); run(async () => {
    if (!selectedExamId || !scheduleForm.examSubjectId) throw new Error(lang === 'ne' ? 'परीक्षा र विषय छान्नुहोस्।' : 'Choose an exam and subject.');
    const examDate = fromBS(scheduleForm.examDateBs);
    if (scheduleForm.examDateBs && !examDate) throw new Error(lang === 'ne' ? 'परीक्षा मिति वि.सं. मा अमान्य छ।' : 'Invalid B.S. examination date.');
    await api(`/api/exams/${selectedExamId}/schedule`, { method: 'PUT', body: { examSubjectId: Number(scheduleForm.examSubjectId), examDate, examDateBs: scheduleForm.examDateBs, startTime: scheduleForm.startTime, endTime: scheduleForm.endTime, roomOrVenue: scheduleForm.roomOrVenue, invigilator: scheduleForm.invigilator } });
    await refreshDetails(selectedExamId);
  }, lang === 'ne' ? 'परीक्षा तालिका सुरक्षित भयो।' : 'Examination schedule saved.', false); };

  const changeExamStatus = (status) => run(async () => { await api(`/api/exams/${selectedExamId}/status`, { method: 'POST', body: { status } }); await refreshDetails(selectedExamId); }, lang === 'ne' ? 'परीक्षा स्थिति परिवर्तन भयो।' : 'Exam status updated.', false);

  const saveMarks = () => run(async () => {
    if (!selectedExamId || !selectedComponent) throw new Error('परीक्षा र component छान्नुहोस्।');
    const payload = (details?.students || []).map(st => {
      const key = `${selectedComponent.id}:${st.id}`;
      const raw = markValues[key] ?? existingMark(selectedComponent.id, st.id)?.marks_obtained ?? '';
      const absent = absentValues[key] ?? Boolean(existingMark(selectedComponent.id, st.id)?.is_absent);
      const teacherNote = noteValues[key] ?? existingMark(selectedComponent.id, st.id)?.teacher_note ?? '';
      return { componentId: Number(selectedComponent.id), studentId: Number(st.id), marksObtained: absent || raw === '' ? null : Number(raw), isAbsent: Boolean(absent), teacherNote };
    }).filter(m => m.marksObtained !== null || m.isAbsent || m.teacherNote);
    if (!payload.length) throw new Error('सेभ गर्न अङ्क/अनुपस्थिति/टिप्पणी भर्नुहोस्।');
    await api(`/api/exams/${selectedExamId}/marks`, { method: 'POST', body: { marks: payload } });
    setMarkValues({}); setAbsentValues({}); setNoteValues({}); await refreshDetails(selectedExamId);
  }, lang === 'ne' ? 'अङ्क सुरक्षित भयो।' : 'Marks saved.', false);

  const saveCompetency = (e) => { e.preventDefault(); run(async () => {
    if (!selectedExamId || !selectedStudentId || !competencyResultForm.subjectId || !competencyResultForm.competencyId) throw new Error('परीक्षा, विद्यार्थी, विषय र competency छान्नुहोस्।');
    await api(`/api/exams/${selectedExamId}/competency-results`, { method: 'POST', body: { studentId: Number(selectedStudentId), subjectId: Number(competencyResultForm.subjectId), competencyId: Number(competencyResultForm.competencyId), achievementLevelId: competencyResultForm.achievementLevelId ? Number(competencyResultForm.achievementLevelId) : null, observationEn: competencyResultForm.observationEn, observationNe: competencyResultForm.observationNe, evidenceNote: competencyResultForm.evidenceNote, nextStepsEn: competencyResultForm.nextStepsEn, nextStepsNe: competencyResultForm.nextStepsNe } });
    await refreshDetails(selectedExamId);
  }, lang === 'ne' ? 'सिकाइ उपलब्धि सुरक्षित भयो।' : 'Competency result saved.', false); };

  const saveProgress = (e) => { e.preventDefault(); run(async () => {
    if (!selectedExamId || !selectedStudentId) throw new Error('परीक्षा र विद्यार्थी छान्नुहोस्।');
    await api(`/api/exams/${selectedExamId}/progress-reports`, { method: 'POST', body: { studentId: Number(selectedStudentId), ...progressForm } });
    await refreshDetails(selectedExamId);
  }, lang === 'ne' ? 'प्रगति प्रतिवेदन सुरक्षित भयो।' : 'Progress report saved.', false); };
  const saveGradeRule = (e) => { e.preventDefault(); run(async () => { await api('/api/exams/grading-rules', { method: 'POST', body: { ...ruleForm, grade: Number(ruleForm.grade), academicYearId: ruleForm.academicYearId ? Number(ruleForm.academicYearId) : null, minPercentage: Number(ruleForm.minPercentage), maxPercentage: Number(ruleForm.maxPercentage), gradePoint: ruleForm.gradePoint === '' ? null : Number(ruleForm.gradePoint) } }); setRuleForm(v => ({ ...v, minPercentage: '', maxPercentage: '', letterGrade: '', gradePoint: '', descriptionEn: '', descriptionNe: '', sourceClause: '', isVerified: false })); }, lang === 'ne' ? 'ग्रेड नियम सुरक्षित भयो।' : 'Grading rule saved.'); };
  const savePolicy = (e) => { e.preventDefault(); run(async () => { await api('/api/exams/grading-policies', { method: 'PUT', body: { ...policyForm, grade: Number(policyForm.grade), academicYearId: policyForm.academicYearId ? Number(policyForm.academicYearId) : null, gpaMax: policyForm.gpaMax === '' ? null : Number(policyForm.gpaMax) } }); }, lang === 'ne' ? 'GPA नीति सुरक्षित भयो।' : 'GPA policy saved.'); };
  const assignRole = (e) => { e.preventDefault(); run(async () => { await api('/api/exams/roles', { method: 'POST', body: roleForm }); setRoleForm({ userEmail: '', role: 'teacher' }); }, lang === 'ne' ? 'भूमिका तोकियो।' : 'Role assigned.'); };
  const deactivateRole = (id) => run(async () => { await api(`/api/exams/roles/${id}/deactivate`, { method: 'PUT', body: {} }); }, lang === 'ne' ? 'भूमिका निष्क्रिय भयो।' : 'Role deactivated.');
  const deactivateSubject = (id) => run(async () => { await api(`/api/exams/subjects/${id}/deactivate`, { method: 'PUT', body: {} }); }, lang === 'ne' ? 'विषय निष्क्रिय गरियो।' : 'Subject deactivated.');
  const deactivateCompetency = (id) => run(async () => { await api(`/api/exams/competencies/${id}/deactivate`, { method: 'PUT', body: {} }); }, lang === 'ne' ? 'सिकाइ उपलब्धि निष्क्रिय गरियो।' : 'Competency deactivated.');
  const deactivateLevel = (id) => run(async () => { await api(`/api/exams/achievement-levels/${id}/deactivate`, { method: 'PUT', body: {} }); }, lang === 'ne' ? 'उपलब्धि स्तर निष्क्रिय गरियो।' : 'Achievement level deactivated.');
  const deactivateGradeRule = (id) => run(async () => { await api(`/api/exams/grading-rules/${id}/deactivate`, { method: 'PUT', body: {} }); }, lang === 'ne' ? 'ग्रेड नियम निष्क्रिय गरियो। पुरानो नतिजाको इतिहास कायम छ।' : 'Grading rule deactivated; historical records are retained.');
  const saveReportSettings = (e) => { e.preventDefault(); run(async () => { const updated = await api('/api/exams/report-settings', { method: 'PUT', body: reportSettingsForm }); setReportSettings(updated); }, lang === 'ne' ? 'विद्यालयको प्रतिवेदन विवरण सुरक्षित भयो।' : 'School report settings saved.'); };

  function existingMark(componentId, studentId) {
    return details?.marks?.find(m => String(m.component_id) === String(componentId) && String(m.student_id) === String(studentId));
  }
  function getSubjectComponents(subjectId) { return details?.components?.filter(c => String(c.exam_subject_id) === String(subjectId)) || []; }
  function getStudentSubjectResult(studentId, examSubject) {
    const comps = getSubjectComponents(examSubject.id);
    const numeric = comps.filter(c => c.max_marks !== null && c.max_marks !== undefined);
    if (!numeric.length) return { total: null, full: examSubject.full_marks, pct: null, complete: false, components: comps, gradeRule: null, passed: null };
    let total = 0, complete = true;
    for (const c of numeric) {
      const mark = existingMark(c.id, studentId);
      if (!mark || (mark.marks_obtained === null && !mark.is_absent)) complete = false;
      total += mark && mark.marks_obtained !== null && !mark.is_absent ? Number(mark.marks_obtained) : 0;
    }
    const configuredFull = Number(examSubject.full_marks || numeric.reduce((s, c) => s + Number(c.max_marks || 0), 0));
    const pct = complete && configuredFull > 0 ? total / configuredFull * 100 : null;
    const rulesForGrade = (details?.gradingRules || []).filter(r => r.is_verified && r.is_active && (r.academic_year_id == null || String(r.academic_year_id) === String(details.exam.academic_year_id)));
    const gradeRule = pct === null ? null : rulesForGrade.find(r => pct >= Number(r.min_percentage) && pct <= Number(r.max_percentage)) || null;
    const componentPassConfigured = numeric.filter(c => c.pass_marks !== null && c.pass_marks !== undefined && c.pass_marks !== '');
    const componentPass = componentPassConfigured.every(c => {
      const mark = existingMark(c.id, studentId);
      return mark && !mark.is_absent && mark.marks_obtained !== null && Number(mark.marks_obtained) >= Number(c.pass_marks);
    });
    const subjectPassConfigured = examSubject.pass_marks !== null && examSubject.pass_marks !== undefined;
    const passed = complete && (subjectPassConfigured || componentPassConfigured.length > 0)
      ? ((!subjectPassConfigured || total >= Number(examSubject.pass_marks)) && componentPass)
      : null;
    return { total: complete ? total : null, full: configuredFull || null, pct, complete, components: comps, gradeRule, passed };
  }
  function studentTotals(studentId) {
    const perSubject = (details?.subjects || []).map(s => ({ subject: s, result: getStudentSubjectResult(studentId, s) }));
    const numeric = perSubject.filter(x => x.result.total !== null);
    const allComplete = numeric.length > 0 && numeric.length === perSubject.length && perSubject.every(x => x.result.complete);
    const pct = allComplete && perSubject.every(x => Number(x.result.full) > 0) ? perSubject.reduce((s, x) => s + x.result.total, 0) / perSubject.reduce((s, x) => s + Number(x.result.full), 0) * 100 : null;
    const policy = details?.gradingPolicy;
    let gpa = null;
    if (allComplete && policy?.is_verified && policy.gpa_method !== 'not_configured') {
      const points = perSubject.map(x => x.result.gradeRule?.grade_point == null ? null : Number(x.result.gradeRule.grade_point));
      if (points.every(p => p !== null)) {
        if (policy.gpa_method === 'arithmetic_mean') gpa = points.reduce((s, p) => s + p, 0) / points.length;
        else if (policy.gpa_method === 'weighted_by_credit' && perSubject.every(x => Number(x.subject.credit_hours) > 0)) {
          const denominator = perSubject.reduce((s, x) => s + Number(x.subject.credit_hours), 0);
          gpa = perSubject.reduce((s, x) => s + Number(x.subject.credit_hours) * Number(x.result.gradeRule.grade_point), 0) / denominator;
        }
        if (gpa !== null && policy.gpa_max) gpa = Math.min(gpa, Number(policy.gpa_max));
      }
    }
    const allPassConfigured = perSubject.length > 0 && perSubject.every(x => x.subject.pass_marks !== null && x.subject.pass_marks !== undefined);
    const overallPass = allComplete && allPassConfigured ? perSubject.every(x => x.result.passed) : null;
    return { perSubject, total: allComplete ? perSubject.reduce((s, x) => s + x.result.total, 0) : null, full: allComplete ? perSubject.reduce((s, x) => s + Number(x.result.full || 0), 0) : null, pct, gpa, overallPass };
  }

  const currentRole = roles.find(r => r.user_email?.toLowerCase() === user?.email?.toLowerCase() && r.is_active)?.role || 'unassigned';
  useEffect(() => {
    if (!details || !selectedStudentId) return;
    const r = (details.progressReports || []).find(x => String(x.student_id) === String(selectedStudentId));
    const attendance = (details.attendanceSummary || []).find(x => String(x.student_id) === String(selectedStudentId));
    setProgressForm({
      strengthsEn:r?.strengths_en||'', strengthsNe:r?.strengths_ne||'',
      improvementAreasEn:r?.improvement_areas_en||'', improvementAreasNe:r?.improvement_areas_ne||'',
      teacherCommentsEn:r?.teacher_comments_en||'', teacherCommentsNe:r?.teacher_comments_ne||'',
      recommendationsEn:r?.recommendations_en||'', recommendationsNe:r?.recommendations_ne||'',
      parentFeedback:r?.parent_feedback||'',
      attendancePresent:r?.attendance_present ?? attendance?.present_count ?? '',
      attendanceTotal:r?.attendance_total ?? attendance?.recorded_days ?? ''
    });
  }, [details?.progressReports, details?.attendanceSummary, selectedStudentId]);

  const selectedLevelList = levels.filter(l => Number(l.grade) === Number(selectedExam?.grade));
  const selectedCompetencies = competencies.filter(c => Number(c.grade) === Number(selectedExam?.grade) && String(c.subject_id) === String(competencyResultForm.subjectId));

  const field = (label, control, hint = '') => <label className="ex-field"><span>{label}</span>{control}{hint && <small>{hint}</small>}</label>;
  const input = (value, onChange, options = {}) => <input className="ex-input" value={value ?? ''} onChange={e => onChange(e.target.value)} {...options} />;
  const select = (value, onChange, opts, placeholder = t('select'), disabled = false) => <select className="ex-input" value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)}><option value="">{placeholder}</option>{opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>;
  const panel = (heading, subtitle, children, extra = null) => <section className="ex-panel"><div className="ex-panel-head"><div><h2>{heading}</h2>{subtitle && <p>{subtitle}</p>}</div>{extra}</div>{children}</section>;
  const actionBtn = (label, onClick, variant = 'primary', disabled = false, icon = null) => <button type="button" className={`ex-btn ex-btn-${variant}`} disabled={disabled || busy} onClick={onClick}>{icon}{label}</button>;
  const submitBtn = (label, icon = <Save size={15} />) => <button className="ex-btn ex-btn-primary" disabled={busy} type="submit">{icon}{busy ? t('loading') : label}</button>;
  const statusBadge = (status) => <span className={`ex-badge ex-status-${status}`}>{statusLabel(status, lang)}</span>;
  const studentLabel = s => `${s.student_name} · ${s.reg_no || s.admission_no || '—'} · ${s.class_name}-${s.section || '—'} / ${s.roll_number || '—'}`;
  const attendanceForStudent = studentId => {
    const report = (details?.progressReports || []).find(r => String(r.student_id) === String(studentId));
    const recorded = (details?.attendanceSummary || []).find(r => String(r.student_id) === String(studentId));
    return {
      present: report?.attendance_present ?? recorded?.present_count ?? null,
      total: report?.attendance_total ?? recorded?.recorded_days ?? null,
      absent: recorded?.absent_count ?? null,
      late: recorded?.late_count ?? null,
      leave: recorded?.leave_count ?? null,
      basedOnRecords: report?.attendance_total == null && recorded?.recorded_days != null
    };
  };

  const printStudentRows = useMemo(() => {
    if (!details) return [];
    if (printMode?.studentId) return details.students.filter(s => String(s.id) === String(printMode.studentId));
    return printMode ? details.students : [];
  }, [details, printMode]);

  const schoolPrintHeader = (reportTitle) => {
    const name = lang === 'ne'
      ? (reportSettings.school_name_ne || reportSettings.school_name_en || 'विद्यालयको नाम')
      : (reportSettings.school_name_en || reportSettings.school_name_ne || 'School Name');
    const address = lang === 'ne'
      ? (reportSettings.address_ne || reportSettings.address_en || '')
      : (reportSettings.address_en || reportSettings.address_ne || '');
    const contacts = [reportSettings.contact_phone, reportSettings.contact_email].filter(Boolean).join(' · ');
    return <div className="exam-print-head">
      <div className="exam-school-logo">{reportSettings.logo_url ? <img src={reportSettings.logo_url} alt="School logo" /> : <span>{String(reportSettings.school_name_en || reportSettings.school_name_ne || 'S').trim().slice(0, 2).toUpperCase()}</span>}</div>
      <div><h1>{name}</h1>{address && <p>{address}</p>}{contacts && <p>{contacts}</p>}<h2>{reportTitle}</h2></div>
    </div>;
  };

  const standardPrint = student => {
    const totals = studentTotals(student.id);
    const isLearning = Number(details.exam.grade) <= 5;
    return <article className="exam-print-page" key={`standard-${student.id}`}>
      {schoolPrintHeader(lang === 'ne' ? 'विद्यार्थीको मानक मूल्याङ्कन प्रतिवेदन' : 'Student Assessment Report')}
      <div className="exam-print-meta">
        <div><b>{lang === 'ne' ? 'विद्यार्थीको नाम' : 'Student Name'}:</b> {student.student_name}</div>
        <div><b>Reg No:</b> {student.reg_no || student.admission_no || '—'}</div>
        <div><b>{lang === 'ne' ? 'कक्षा/सेक्सन' : 'Class/Section'}:</b> {student.class_name}-{student.section || '—'}</div>
        <div><b>{lang === 'ne' ? 'रोल नं.' : 'Roll No.'}:</b> {student.roll_number || '—'}</div>
        <div><b>{lang === 'ne' ? 'शैक्षिक सत्र' : 'Academic Year'}:</b> {details.exam.year_name}</div>
        <div><b>{lang === 'ne' ? 'परीक्षा' : 'Examination'}:</b> {lang === 'ne' ? details.exam.exam_name_ne : details.exam.exam_name_en}</div>
        <div><b>{lang === 'ne' ? 'परीक्षा मिति (वि.सं.)' : 'Exam Date (B.S.)'}:</b> {details.exam.exam_date_bs || toBS(details.exam.exam_date) || '—'}</div>
        <div><b>{lang === 'ne' ? 'परिणाम अवस्था' : 'Result Status'}:</b> {statusLabel(details.exam.status, lang)}</div>
      </div>
      {isLearning ? <>
        <h3>{lang === 'ne' ? 'विषयगत सिकाइ उपलब्धि' : 'Subject-wise Learning Achievement'}</h3>
        <table className="exam-print-table"><thead><tr><th>{lang === 'ne' ? 'विषय' : 'Subject'}</th><th>{lang === 'ne' ? 'सिकाइ उपलब्धि' : 'Competency / Outcome'}</th><th>{lang === 'ne' ? 'उपलब्धि स्तर' : 'Achievement Level'}</th><th>{lang === 'ne' ? 'अवलोकन' : 'Observation'}</th></tr></thead><tbody>
          {(details.subjects || []).map(s => {
            const records = (details.competencyResults || []).filter(r => String(r.student_id) === String(student.id) && String(r.subject_id) === String(s.subject_id));
            return (
              <React.Fragment key={s.id}>
                {records.length ? records.map(r => <tr key={r.id}><td>{lang === 'ne' ? s.subject_name_ne : s.subject_name_en}</td><td>{lang === 'ne' ? r.competency_ne : r.competency_en}</td><td>{lang === 'ne' ? (r.level_name_ne || t('notConfigured')) : (r.level_name_en || t('notConfigured'))}</td><td>{lang === 'ne' ? r.observation_ne : r.observation_en}</td></tr>) : <tr><td>{lang === 'ne' ? s.subject_name_ne : s.subject_name_en}</td><td colSpan="3">{lang === 'ne' ? 'अझै उपलब्धि रेकर्ड गरिएको छैन।' : 'No competency record entered.'}</td></tr>}
              </React.Fragment>
            );
          })}
        </tbody></table>
      </> : <>
        <h3>{lang === 'ne' ? 'विषयगत नतिजा' : 'Subject-wise Results'}</h3>
        <table className="exam-print-table"><thead><tr><th>{lang === 'ne' ? 'विषय' : 'Subject'}</th><th>{lang === 'ne' ? 'पूर्णाङ्क' : 'Full Marks'}</th><th>{lang === 'ne' ? 'प्राप्ताङ्क' : 'Obtained'}</th><th>%</th><th>{lang === 'ne' ? 'ग्रेड' : 'Grade'}</th><th>{lang === 'ne' ? 'स्थिति' : 'Status'}</th></tr></thead><tbody>
          {totals.perSubject.map(({ subject, result }) => <tr key={subject.id}><td>{lang === 'ne' ? subject.subject_name_ne : subject.subject_name_en}</td><td>{result.full ?? '—'}</td><td>{result.total ?? '—'}</td><td>{result.pct == null ? '—' : result.pct.toFixed(2)}</td><td>{result.gradeRule?.letter_grade || '—'}</td><td>{result.passed == null ? t('notConfigured') : result.passed ? (lang === 'ne' ? 'उत्तीर्ण' : 'Pass') : (lang === 'ne' ? 'अनुत्तीर्ण' : 'Not pass')}</td></tr>)}
        </tbody></table>
        <div className="exam-print-totals"><span>{t('total')}: {totals.total ?? '—'} / {totals.full ?? '—'}</span><span>{t('percent')}: {totals.pct == null ? '—' : `${totals.pct.toFixed(2)}%`}</span><span>GPA: {totals.gpa == null ? '—' : totals.gpa.toFixed(2)}</span><span>{t('overallStatus')}: {totals.overallPass == null ? t('notConfigured') : totals.overallPass ? 'Pass' : 'Not pass'}</span></div>
      </>}
      <div className="exam-print-attendance"><b>{lang === 'ne' ? 'अभिभावक' : 'Guardian'}:</b> {student.guardian_name || '—'} · {student.guardian_phone || '—'}　 <b>{lang === 'ne' ? 'उपस्थिति (उपस्थित/रेकर्ड दिन)' : 'Attendance (present/recorded days)'}:</b> {attendanceForStudent(student.id).present ?? '—'} / {attendanceForStudent(student.id).total ?? '—'}</div>
      <div className="exam-signatures"><div>{lang === 'ne' ? 'कक्षा शिक्षकको हस्ताक्षर' : 'Class Teacher Signature'}</div><div>{lang === 'ne' ? 'प्रधानाध्यापकको हस्ताक्षर' : 'Principal Signature'}</div><div>{lang === 'ne' ? 'विद्यालयको छाप' : 'School Seal'}</div></div>
      <p className="exam-print-foot">{t('sourceWarning')}</p>
    </article>;
  };

  const progressPrint = student => {
    const report = details.progressReports.find(r => String(r.student_id) === String(student.id)) || {};
    const competenciesForStudent = details.competencyResults.filter(r => String(r.student_id) === String(student.id));
    return <article className="exam-print-page" key={`progress-${student.id}`}>
      {schoolPrintHeader(lang === 'ne' ? 'विस्तृत विद्यार्थी सिकाइ तथा प्रगति प्रतिवेदन' : 'Detailed Student Learning Progress Report')}
      <div className="exam-print-meta">
        <div><b>{t('student')}:</b> {student.student_name}</div><div><b>Reg No:</b> {student.reg_no || student.admission_no || '—'}</div><div><b>{t('grade')}:</b> {student.class_name}-{student.section || '—'}</div><div><b>{t('yearName')}:</b> {details.exam.year_name}</div><div><b>{t('examInfo')}:</b> {lang === 'ne' ? details.exam.exam_name_ne : details.exam.exam_name_en}</div><div><b>{lang === 'ne' ? 'अभिभावक' : 'Guardian'}:</b> {student.guardian_name || '—'} · {student.guardian_phone || '—'}</div>
      </div>
      <h3>{lang === 'ne' ? 'विषयगत उपलब्धि तथा प्रमाण' : 'Subject Competencies and Evidence'}</h3>
      <table className="exam-print-table"><thead><tr><th>{t('subject')}</th><th>{t('competency')}</th><th>{t('achievement')}</th><th>{t('observation')}</th><th>{t('nextSteps')}</th></tr></thead><tbody>
        {competenciesForStudent.map(r => <tr key={r.id}><td>{lang === 'ne' ? r.subject_name_ne : r.subject_name_en}</td><td>{lang === 'ne' ? r.competency_ne : r.competency_en}</td><td>{lang === 'ne' ? (r.level_name_ne || t('notConfigured')) : (r.level_name_en || t('notConfigured'))}</td><td>{lang === 'ne' ? r.observation_ne : r.observation_en}<br />{r.evidence_note || ''}</td><td>{lang === 'ne' ? r.next_steps_ne : r.next_steps_en}</td></tr>)}
        {!competenciesForStudent.length && <tr><td colSpan="5">{lang === 'ne' ? 'सिकाइ उपलब्धि अझै प्रविष्ट गरिएको छैन।' : 'No competencies entered yet.'}</td></tr>}
      </tbody></table>
      <div className="exam-report-box"><b>{t('strengths')}</b><p>{(lang === 'ne' ? report.strengths_ne : report.strengths_en) || '—'}</p></div>
      <div className="exam-report-box"><b>{t('improvement')}</b><p>{(lang === 'ne' ? report.improvement_areas_ne : report.improvement_areas_en) || '—'}</p></div>
      <div className="exam-report-box"><b>{t('teacherComments')}</b><p>{(lang === 'ne' ? report.teacher_comments_ne : report.teacher_comments_en) || '—'}</p></div>
      <div className="exam-report-box"><b>{t('recommendations')}</b><p>{(lang === 'ne' ? report.recommendations_ne : report.recommendations_en) || '—'}</p></div>
      <div className="exam-report-box"><b>{t('parentFeedback')}</b><p>{report.parent_feedback || '—'}</p></div>
      <div className="exam-print-attendance"><b>{lang === 'ne' ? 'उपस्थिति (उपस्थित/रेकर्ड दिन)' : 'Attendance (present/recorded days)'}:</b> {attendanceForStudent(student.id).present ?? '—'} / {attendanceForStudent(student.id).total ?? '—'}{attendanceForStudent(student.id).basedOnRecords ? ` · ${lang === 'ne' ? 'दैनिक उपस्थिति रेकर्डबाट' : 'from daily attendance records'}` : ''}</div>
      <div className="exam-signatures"><div>{lang === 'ne' ? 'कक्षा शिक्षकको हस्ताक्षर' : 'Class Teacher Signature'}</div><div>{lang === 'ne' ? 'अभिभावकको हस्ताक्षर' : 'Parent Signature'}</div><div>{lang === 'ne' ? 'प्रधानाध्यापकको हस्ताक्षर / छाप' : 'Principal Signature / Seal'}</div></div>
      <p className="exam-print-foot">{t('sourceWarning')}</p>
    </article>;
  };

  const startPrint = async (type, studentId = null) => {
    if (!details) { setError(t('noPrintExam')); return; }
    if (studentId && !details.students.some(s => String(s.id) === String(studentId))) { setError(t('noStudents')); return; }
    const reportType = type === 'standard'
      ? (studentId ? 'standard_marksheet' : 'bulk_marksheet')
      : (studentId ? 'progress_report' : 'bulk_progress_report');
    setBusy(true); setError('');
    try {
      await api(`/api/exams/${selectedExamId}/print-history`, { method: 'POST', body: { reportType, studentId: studentId ? Number(studentId) : null } });
      const history = await api(`/api/exams/${selectedExamId}/print-history`);
      setReportHistory(Array.isArray(history) ? history : []);
      setPrintMode({ type, studentId });
    } catch (e) {
      setError(e.message || (lang === 'ne' ? 'प्रतिवेदन इतिहास सुरक्षित भएन।' : 'Could not log report generation.'));
    } finally { setBusy(false); }
  };

  const navItems = [
    ['dashboard', t('dashboard'), <Activity size={16} />], ['years', t('years'), <CalendarDays size={16} />],
    ['curriculum', t('curriculum'), <BookOpen size={16} />], ['exams', t('exams'), <FileText size={16} />],
    ['marks', t('marks'), <ClipboardCheck size={16} />], ['reports', t('reports'), <FileBadge size={16} />],
    ['grading', t('grading'), <Settings2 size={16} />], ['access', t('access'), <ShieldCheck size={16} />]
  ];

  return <div className="exam-module">
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700&family=Noto+Sans:wght@400;500;600;700&display=swap');
      .exam-module{font-family:'Noto Sans Devanagari','Noto Sans',Arial,sans-serif;color:#172033;--brand:#4338ca;--line:#e3e8f2;--muted:#667085;}
      .exam-top{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;margin-bottom:18px}.exam-top h1{font-size:25px;margin:0 0 6px;font-weight:800;letter-spacing:-.02em}.exam-top p{margin:0;color:var(--muted);font-size:13px;line-height:1.7}.exam-lang{display:flex;padding:4px;gap:4px;border:1px solid var(--line);background:#fff;border-radius:12px}.exam-lang button{border:0;border-radius:8px;padding:9px 13px;background:transparent;color:#344054;font-weight:700;cursor:pointer}.exam-lang button.active{background:#eef2ff;color:#3730a3}
      .exam-tabs{display:flex;gap:7px;overflow-x:auto;padding:5px 0 13px;margin-bottom:14px}.exam-tab{display:inline-flex;align-items:center;gap:7px;white-space:nowrap;border:1px solid var(--line);background:white;border-radius:10px;padding:10px 13px;font-size:12px;font-weight:700;color:#475467;cursor:pointer}.exam-tab.active{color:#fff;background:#3730a3;border-color:#3730a3}.exam-panel{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 2px 8px rgba(16,24,40,.03)}.ex-panel-head{display:flex;gap:16px;align-items:start;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap}.ex-panel-head h2{font-size:16px;line-height:1.45;margin:0 0 4px;font-weight:800}.ex-panel-head p{color:var(--muted);font-size:12px;line-height:1.6;margin:0}.ex-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.ex-grid-3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.ex-field{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:700;color:#344054;min-width:0}.ex-field small{font-size:11px;font-weight:400;color:#667085;line-height:1.5}.ex-input{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;background:#fff;border-radius:9px;padding:10px 11px;font:inherit;font-weight:500;color:#101828;min-height:40px}.ex-input:focus{outline:2px solid #c7d2fe;border-color:#6366f1}.ex-input:disabled{background:#f2f4f7;color:#98a2b3}.ex-check{display:flex;gap:8px;align-items:center;font-size:12px;color:#344054;font-weight:600}.ex-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.ex-btn{border:1px solid transparent;border-radius:9px;padding:10px 13px;font:inherit;font-weight:700;font-size:12px;display:inline-flex;gap:7px;align-items:center;justify-content:center;cursor:pointer}.ex-btn:disabled{opacity:.48;cursor:not-allowed}.ex-btn-primary{background:#4338ca;color:white}.ex-btn-secondary{background:white;color:#344054;border-color:#d0d5dd}.ex-btn-danger{background:#fff1f2;color:#be123c;border-color:#fecdd3}.ex-btn-green{background:#ecfdf3;color:#027a48;border-color:#abefc6}.ex-alert{border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.6;margin-bottom:12px}.ex-alert-error{background:#fff1f0;border:1px solid #fecdca;color:#b42318}.ex-alert-ok{background:#ecfdf3;border:1px solid #abefc6;color:#027a48}.ex-alert-info{background:#eff8ff;border:1px solid #b2ddff;color:#175cd3}.ex-muted{color:#667085;font-size:12px;line-height:1.7}.ex-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:16px}.ex-kpi{background:white;border:1px solid var(--line);border-radius:14px;padding:15px;min-width:0}.ex-kpi span{font-size:11px;color:#667085;font-weight:700;display:block}.ex-kpi strong{font-size:25px;font-weight:800;display:block;margin-top:7px;overflow-wrap:anywhere}.ex-kpi small{font-size:10px;color:#98a2b3;display:block;margin-top:5px}.ex-table-wrap{width:100%;overflow:auto;border:1px solid var(--line);border-radius:10px}.ex-table{border-collapse:collapse;width:100%;min-width:700px;font-size:12px}.ex-table th{background:#f8fafc;color:#475467;text-align:left;font-weight:800;font-size:11px;white-space:nowrap}.ex-table th,.ex-table td{padding:10px 11px;border-bottom:1px solid #eaecf0;vertical-align:top}.ex-table tr:last-child td{border-bottom:0}.ex-table td small{display:block;color:#667085;margin-top:3px;line-height:1.5}.ex-empty{text-align:center;color:#667085;padding:22px!important}.ex-badge{display:inline-flex;border-radius:999px;padding:5px 8px;font-size:10px;font-weight:800;white-space:nowrap;background:#f2f4f7;color:#344054}.ex-status-draft{background:#f2f4f7;color:#475467}.ex-status-in_review{background:#eff8ff;color:#175cd3}.ex-status-approved{background:#ecfdf3;color:#027a48}.ex-status-locked{background:#fffaeb;color:#b54708}.ex-status-published{background:#eef4ff;color:#3538cd}.ex-list{display:grid;gap:9px}.ex-list-item{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;border:1px solid var(--line);border-radius:10px}.ex-list-item strong{font-size:12px;display:block}.ex-list-item small{color:#667085;font-size:11px;display:block;margin-top:4px;line-height:1.6}.ex-hint{font-size:11px;line-height:1.65;color:#667085;margin:10px 0 0}.ex-sticky{position:sticky;top:0;z-index:2;background:#fff;padding:10px 0}.ex-report-box{border:1px solid #d0d5dd;border-radius:8px;padding:10px 12px;margin:8px 0}.ex-report-box p{margin:5px 0 0;white-space:pre-wrap;line-height:1.55}.exam-print-root{display:none}.exam-print-page{font-family:'Noto Sans Devanagari','Noto Sans',Arial,sans-serif;color:#111;page-break-after:always;break-after:page;padding:5mm;min-height:245mm;box-sizing:border-box}.exam-print-page:last-child{page-break-after:auto;break-after:auto}.exam-print-head{display:flex;align-items:center;gap:15px;justify-content:center;text-align:center;border-bottom:2px solid #222;padding-bottom:10px;margin-bottom:12px}.exam-school-logo{border:2px solid #333;border-radius:50%;width:54px;height:54px;display:grid;place-items:center;font-size:18px;font-weight:800;flex-shrink:0;overflow:hidden}.exam-school-logo img{width:100%;height:100%;object-fit:contain;border-radius:50%}.exam-print-head h1{font-size:18px;margin:0 0 3px}.exam-print-head p{font-size:10px;margin:0 0 5px}.exam-print-head h2{font-size:14px;margin:4px 0 0}.exam-print-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 14px;font-size:10.5px;margin-bottom:14px}.exam-print-table{width:100%;border-collapse:collapse;font-size:10px;margin:8px 0 13px}.exam-print-table thead{display:table-header-group}.exam-print-table th,.exam-print-table td{border:1px solid #444;padding:6px 7px;vertical-align:top;overflow-wrap:anywhere}.exam-print-table th{background:#f1f1f1!important;text-align:left}.exam-print-page h3{font-size:12px;margin:12px 0 6px}.exam-print-totals{display:flex;gap:16px;flex-wrap:wrap;justify-content:space-between;border:1px solid #444;padding:10px;font-size:11px;font-weight:700}.exam-print-attendance{border-top:1px solid #aaa;padding-top:8px;font-size:10px;margin-top:12px}.exam-signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:35px;text-align:center;font-size:10px}.exam-signatures div{border-top:1px solid #444;padding-top:7px}.exam-print-foot{margin-top:14px;font-size:8px;color:#555;line-height:1.4}.ex-footnote{font-size:10px;color:#667085;line-height:1.6;margin-top:12px}.ex-link{color:#3730a3;text-decoration:underline;overflow-wrap:anywhere}.ex-subtitle{font-size:12px;color:#667085;line-height:1.65;margin:0 0 12px}.ex-two-col{display:grid;grid-template-columns: minmax(260px,.8fr) minmax(0,1.2fr);gap:16px}.ex-data-chip{display:inline-flex;border-radius:7px;padding:4px 7px;background:#f2f4f7;color:#475467;font-size:10px;font-weight:700}.ex-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.ex-mark-input{max-width:95px;min-width:75px}.ex-tick{width:17px;height:17px}.ex-table tr:hover td{background:#fcfcfd}.ex-role-callout{background:#fffaeb;border:1px solid #fedf89;border-radius:10px;padding:11px;color:#93370d;font-size:11px;line-height:1.6;margin-bottom:12px}
      @media screen {
        .exam-module{color:#eef3ff;--brand:#ff4fa3;--line:#292747;--muted:#94a5c2;background:transparent;color-scheme:dark;}
        .exam-module .exam-top h1{color:#f6f8ff;}
        .exam-module .exam-top p,.exam-module .ex-muted,.exam-module .ex-hint,.exam-module .ex-subtitle,.exam-module .ex-footnote{color:#94a5c2;}
        .exam-module .exam-lang{background:#101827;border-color:#292747;}
        .exam-module .exam-lang button{color:#b9c7df;}
        .exam-module .exam-lang button.active{background:rgba(255,79,163,.14);color:#ff6ab3;border:1px solid rgba(255,79,163,.28);}
        .exam-module .exam-tabs{scrollbar-color:#4e416e #0b1120;}
        .exam-module .exam-tab{background:#101827;border-color:#292747;color:#b8c5dd;}
        .exam-module .exam-tab.active{background:linear-gradient(135deg,#5a2d83,#302353);border-color:#9e54c5;color:#fff;box-shadow:0 6px 18px rgba(124,58,237,.15);}
        .exam-module .exam-panel,.exam-module .ex-panel{background:linear-gradient(145deg,#111827 0%,#0b1120 100%);border-color:#292747;color:#edf3ff;box-shadow:0 12px 32px rgba(0,0,0,.16);}
        .exam-module .ex-panel-head h2{color:#f2f6ff;}
        .exam-module .ex-panel-head p{color:#91a2c0;}
        .exam-module .ex-field{color:#c8d3e8;}
        .exam-module .ex-field small{color:#8294b4;}
        .exam-module .ex-input{background:#090f1d;color:#f4f7ff;border-color:#2c3152;}
        .exam-module .ex-input:focus{outline:2px solid rgba(34,199,255,.2);border-color:#32bde7;}
        .exam-module .ex-input:disabled{background:#131b2b;color:#7485a4;border-color:#252b43;}
        .exam-module .ex-check{color:#c4d0e7;}
        .exam-module .ex-btn-primary{background:linear-gradient(135deg,#146a91,#3b2b73);border-color:rgba(34,199,255,.28);color:#fff;}
        .exam-module .ex-btn-secondary{background:#141b2b;color:#d5def0;border-color:#333655;}
        .exam-module .ex-btn-danger{background:rgba(255,94,112,.11);color:#ff8592;border-color:rgba(255,94,112,.3);}
        .exam-module .ex-btn-green{background:rgba(21,217,162,.12);color:#4ce8bc;border-color:rgba(21,217,162,.28);}
        .exam-module .ex-alert-error{background:rgba(255,94,112,.10);border-color:rgba(255,94,112,.28);color:#ffc0c8;}
        .exam-module .ex-alert-ok{background:rgba(21,217,162,.09);border-color:rgba(21,217,162,.25);color:#7cebd0;}
        .exam-module .ex-alert-info{background:rgba(34,199,255,.08);border-color:rgba(34,199,255,.25);color:#9ce7ff;}
        .exam-module .ex-kpi{background:linear-gradient(145deg,#141b2c,#0d1422);border-color:#292747;color:#f1f5ff;}
        .exam-module .ex-kpi span{color:#9aabc8;}
        .exam-module .ex-kpi strong{color:#f6f8ff;}
        .exam-module .ex-kpi small{color:#7f91b0;}
        .exam-module .ex-table-wrap{border-color:#292747;background:#0b1120;}
        .exam-module .ex-table th{background:linear-gradient(110deg,#211b46,#141a2d);color:#ff68b1;}
        .exam-module .ex-table th,.exam-module .ex-table td{border-color:#202940;}
        .exam-module .ex-table td{color:#d0daed;}
        .exam-module .ex-table td small{color:#8c9fbe;}
        .exam-module .ex-table tr:hover td{background:#17172d;}
        .exam-module .ex-empty{color:#91a2c0;}
        .exam-module .ex-badge{background:#24243c;color:#cbd5ed;border:1px solid #373251;}
        .exam-module .ex-status-draft{background:rgba(148,163,184,.12);color:#c5cfe2;}
        .exam-module .ex-status-in_review{background:rgba(34,199,255,.12);color:#5bd5ff;}
        .exam-module .ex-status-approved{background:rgba(21,217,162,.12);color:#50e2b8;}
        .exam-module .ex-status-locked{background:rgba(255,176,32,.13);color:#ffca68;}
        .exam-module .ex-status-published{background:rgba(255,79,163,.13);color:#ff79ba;}
        .exam-module .ex-list-item{background:#0d1422;border-color:#292747;}
        .exam-module .ex-list-item strong{color:#edf3ff;}
        .exam-module .ex-list-item small{color:#91a2c0;}
        .exam-module .ex-sticky{background:#0b1120;}
        .exam-module .ex-report-box{border-color:#2c3151;background:#0d1422;color:#dbe5f6;}
        .exam-module .ex-data-chip{background:rgba(34,199,255,.1);border:1px solid rgba(34,199,255,.2);color:#80dfff;}
        .exam-module .ex-link{color:#ff71b8;}
        .exam-module .ex-role-callout{background:rgba(255,176,32,.1);border-color:rgba(255,176,32,.28);color:#ffd17b;}
        .exam-module input,.exam-module select,.exam-module textarea{color-scheme:dark;}
      }
      @media(max-width:1100px){.ex-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.ex-grid-3{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:700px){.exam-top h1{font-size:21px}.ex-panel,.exam-panel{padding:14px}.ex-grid,.ex-grid-3,.ex-two-col{grid-template-columns:1fr}.ex-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}.ex-kpi strong{font-size:21px}.exam-print-meta{grid-template-columns:1fr}}
      @page{size:A4 portrait;margin:10mm}
      @media print{body *{visibility:hidden!important}.exam-print-root,.exam-print-root *{visibility:visible!important}.exam-print-root{display:block!important;position:absolute;left:0;top:0;width:100%;background:#fff;color:#111}.exam-print-page{min-height:0;padding:0;margin:0;font-size:10pt;break-after:page;page-break-after:always}.exam-print-page:last-child{break-after:auto;page-break-after:auto}.exam-print-table tr{break-inside:avoid;page-break-inside:avoid}.exam-print-page h1,.exam-print-page h2,.exam-print-page h3,.exam-print-page p,.exam-print-page td,.exam-print-page th{color:#111!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    `}</style>
    <div className="exam-ui">
      <div className="exam-top">
        <div><h1><GraduationCap size={25} style={{ verticalAlign: 'middle', marginRight: 7 }} />{t('title')}</h1><p>{t('subtitle')}</p><p>{t('currentUser')}: <b>{user?.email || '—'}</b> · Role: <b>{ROLE_LABELS[currentRole] || currentRole}</b></p></div>
        <div className="exam-lang"><button className={lang === 'ne' ? 'active' : ''} onClick={() => setLang('ne')}>नेपाली</button><button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button></div>
      </div>
      {error && <div className="ex-alert ex-alert-error"><b>{t('error')}:</b> {error}</div>}
      {notice && <div className="ex-alert ex-alert-ok"><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />{notice}</div>}
      {loading && <div className="ex-alert ex-alert-info">{t('loading')}</div>}
      <div className="exam-top"><p className="ex-subtitle" style={{ maxWidth: 850 }}>{t('officialRules')}<br /><span className="ex-badge">{lang === 'ne' ? 'आधिकारिक नियम कन्फिगर गर्नुपर्ने' : 'Official rules need configuration'}</span></p><button type="button" className="ex-btn ex-btn-secondary" onClick={refreshBase}><RefreshCw size={15} />{t('refresh')}</button></div>
      <div className="exam-tabs">{navItems.map(([id, label, icon]) => <button type="button" key={id} className={`exam-tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>{icon}{label}</button>)}</div>

      {tab === 'dashboard' && <>
        <div className="ex-kpis">
          <div className="ex-kpi"><span>{t('activeStudents')}</span><strong>{summary.activeStudents ?? '—'}</strong><small>Existing student records · Grades 4–10</small></div>
          <div className="ex-kpi"><span>{t('academicYears')}</span><strong>{summary.academicYears ?? years.length}</strong><small>{years.find(y => y.is_active)?.year_name || (lang === 'ne' ? 'सक्रिय सत्र छैन' : 'No active year')}</small></div>
          <div className="ex-kpi"><span>{t('totalExams')}</span><strong>{Object.values(summary.exams || {}).reduce((s,n) => s + Number(n), 0)}</strong><small>{lang === 'ne' ? 'सबै स्थिति' : 'All statuses'}</small></div>
          <div className="ex-kpi"><span>{t('published')}</span><strong>{summary.exams?.published || 0}</strong><small>{lang === 'ne' ? 'प्रकाशित नतिजा मात्र' : 'Published only'}</small></div>
          <div className="ex-kpi"><span>{t('verifiedRules')}</span><strong>{summary.verifiedGradingRules ?? 0}</strong><small>{lang === 'ne' ? 'नियम/दफा प्रमाणित' : 'Verified grading bands'}</small></div>
        </div>
        {panel(t('exams'), lang === 'ne' ? 'कक्षा ४–५ मा competency-first; ६–८ मा configurable subject-wise assessment; ९–१० मा formal marksheet template।' : 'Competency-first for 4–5; configurable subject assessment for 6–8; formal marksheet for 9–10.', <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('examInfo')}</th><th>{t('grade')}</th><th>{t('academicYears')}</th><th>{t('model')}</th><th>{t('examStatus')}</th><th /></tr></thead><tbody>{displayExams.map(e => <tr key={e.id}><td><b>{lang === 'ne' ? e.exam_name_ne : e.exam_name_en}</b><small>{e.exam_date_bs || toBS(e.exam_date) || '—'}</small></td><td>{e.grade}</td><td>{e.year_name}</td><td>{gradeModelLabel(e.assessment_model,lang)}</td><td>{statusBadge(e.status)}</td><td>{actionBtn(t('chooseExam'), () => { setSelectedExamId(String(e.id)); setTab('exams'); })}</td></tr>)}{!displayExams.length && <tr><td colSpan="6" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
        {panel(t('officialRules'), t('sourceWarning'), <div className="ex-list"><div><a className="ex-link" href="https://moecdc.gov.np/content/647/letter-grading-directory--2083/" target="_blank" rel="noreferrer">CDC — लेटर ग्रेडिङ निर्देशिका, २०८३</a></div><div><a className="ex-link" href="https://moecdc.gov.np/content/646/guide-to-student-assessment-in-basic-level/" target="_blank" rel="noreferrer">CDC — कक्षा ४–५ विद्यार्थी मूल्याङ्कन मार्गदर्शन, २०८३</a></div><div><a className="ex-link" href="https://moecdc.gov.np/content/608/facilitation-manual-for-conducting-projects-and-experiments/" target="_blank" rel="noreferrer">CDC — आन्तरिक मूल्याङ्कन, परियोजना तथा प्रयोगात्मक कार्य, २०८२ (कक्षा ४–८)</a></div><div><a className="ex-link" href="https://moecdc.gov.np/content/21/internal-assessment-standards-for-student-legacy--2080/" target="_blank" rel="noreferrer">CDC — विद्यार्थी सिकाइका लागि आन्तरिक मूल्याङ्कन मापदण्ड, २०८० (कक्षा ९–१२)</a></div><div><a className="ex-link" href="https://www.cehrd.gov.np/content/13339/13339-student-assessment_trm_g4-5/" target="_blank" rel="noreferrer">CEHRD — कक्षा ४–५ विद्यार्थी मूल्याङ्कन स्रोत सामग्री</a></div></div>)}
      </>}

      {tab === 'years' && <div className="ex-two-col">
        {panel(t('createYear'), lang === 'ne' ? 'मिति वि.सं. मा राख्नुहोस्; database मा AD मिति सुरक्षित हुन्छ।' : 'Enter B.S. dates; AD dates are stored in the database.', <form onSubmit={e => { e.preventDefault(); addYear(); }} className="ex-grid">
          {field(t('yearName'), input(yearForm.yearName, v => setYearForm(f => ({...f, yearName:v})), { required: true, placeholder: '२०८३/०८४' }))}
          {field(t('startDate'), input(yearForm.startDateBs, v => setYearForm(f => ({...f,startDateBs:v})), {required:true, placeholder:'२०८३-०१-०१'}), `${fromBS(yearForm.startDateBs) || '—'} AD`)}
          {field(t('endDate'), input(yearForm.endDateBs, v => setYearForm(f => ({...f,endDateBs:v})), {required:true, placeholder:'२०८३-१२-३०'}), `${fromBS(yearForm.endDateBs) || '—'} AD`)}
          <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('createYear'), <Plus size={15} />)}</div>
        </form>)}
        {panel(t('years'), '', <div className="ex-list">{years.map(y => <div className="ex-list-item" key={y.id}><div><strong>{y.year_name} {y.is_active && <span className="ex-badge">{t('active')}</span>}</strong><small>{toBS(y.start_date)} — {toBS(y.end_date)} · AD {String(y.start_date).slice(0,10)} — {String(y.end_date).slice(0,10)}</small></div>{!y.is_active && actionBtn(t('activate'), () => activateYear(y.id), 'secondary')}</div>)}{!years.length && <p className="ex-empty">{t('noRecords')}</p>}</div>)}
      </div>}

      {tab === 'curriculum' && <>
        <div className="ex-two-col">
          {panel(t('addSubject'), lang === 'ne' ? 'कक्षा अनुसार विषय थप्नुहोस्। अनिवार्य/वैकल्पिक तथा प्रयोगात्मक अवस्था school setup अनुसार राख्नुहोस्।' : 'Add subjects by grade; configure mandatory/optional/practical details per school curriculum.', <form onSubmit={addSubject} className="ex-grid">
            {field(t('grade'), select(subjectForm.grade, v => { const g=Number(v); setSubjectForm(f=>({...f,grade:g})); }, GRADES.map(g=>({value:g,label:`${lang==='ne'?'कक्षा':'Grade'} ${g}`})), t('select')))}
            {field(t('code'), input(subjectForm.subjectCode,v=>setSubjectForm(f=>({...f,subjectCode:v})),{required:true}))}
            {field(t('nameEn'), input(subjectForm.nameEn,v=>setSubjectForm(f=>({...f,nameEn:v})),{required:true}))}
            {field(t('nameNe'), input(subjectForm.nameNe,v=>setSubjectForm(f=>({...f,nameNe:v})),{required:true}))}
            <label className="ex-check"><input type="checkbox" checked={subjectForm.isPractical} onChange={e=>setSubjectForm(f=>({...f,isPractical:e.target.checked}))}/>{t('practical')}</label>
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('addSubject'),<Plus size={15}/>)}</div>
          </form>)}
          {panel(t('subjects'), `${subjects.length} subjects`, <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('grade')}</th><th>{t('code')}</th><th>{t('nameEn')}</th><th>{t('nameNe')}</th><th>{t('practical')}</th><th /></tr></thead><tbody>{subjects.map(s=><tr key={s.id}><td>{s.grade}</td><td>{s.subject_code}</td><td>{s.name_en}</td><td>{s.name_ne}</td><td>{s.is_practical ? '✓' : '—'}</td><td>{['admin','exam_coordinator'].includes(currentRole)&&actionBtn(t('deactivate'),()=>deactivateSubject(s.id),'danger')}</td></tr>)}{!subjects.length&&<tr><td colSpan="6" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
        </div>
        <div className="ex-two-col">
          {panel(t('addCompetency'), lang === 'ne' ? 'विषयगत learning outcome को bilingual विवरण र official source record गर्नुहोस्।' : 'Record bilingual curriculum outcomes and their official source.', <form onSubmit={addCompetency} className="ex-grid">
            {field(t('grade'),select(competencyForm.grade,v=>setCompetencyForm(f=>({...f,grade:Number(v),subjectId:''})),GRADES.map(g=>({value:g,label:String(g)}))))}
            {field(t('subject'),select(competencyForm.subjectId,v=>setCompetencyForm(f=>({...f,subjectId:v})),competencySubjects.map(s=>({value:s.id,label:`${s.subject_code} · ${lang==='ne'?s.name_ne:s.name_en}`}))))}
            {field(t('compCode'),input(competencyForm.competencyCode,v=>setCompetencyForm(f=>({...f,competencyCode:v})),{required:true}))}
            {field(t('compEn'),input(competencyForm.descriptionEn,v=>setCompetencyForm(f=>({...f,descriptionEn:v})),{required:true}))}
            {field(t('compNe'),input(competencyForm.descriptionNe,v=>setCompetencyForm(f=>({...f,descriptionNe:v})),{required:true}))}
            {field(t('source'),input(competencyForm.sourceGuideline,v=>setCompetencyForm(f=>({...f,sourceGuideline:v})),{placeholder:'CDC / curriculum document'}))}
            {field(t('sourceReference'),input(competencyForm.sourceReference,v=>setCompetencyForm(f=>({...f,sourceReference:v})),{placeholder:'Page / learning standard'}))}
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('addCompetency'),<Plus size={15}/>)}</div>
          </form>)}
          {panel(t('addLevel'), lang === 'ne' ? 'कक्षा ४–५ का उपलब्धि स्तर स्कूल/आधिकारिक मार्गदर्शनअनुसार कन्फिगर गर्नुहोस्; कुनै level स्वतः बनाइएको छैन।' : 'Configure achievement levels only after checking the applicable guide; no levels are pre-seeded.', <form onSubmit={addLevel} className="ex-grid">
            {field(t('grade'),select(levelForm.grade,v=>setLevelForm(f=>({...f,grade:Number(v)})),GRADES.map(g=>({value:g,label:String(g)}))))}
            {field(t('levelCode'),input(levelForm.levelCode,v=>setLevelForm(f=>({...f,levelCode:v})),{required:true}))}
            {field(t('levelEn'),input(levelForm.nameEn,v=>setLevelForm(f=>({...f,nameEn:v})),{required:true}))}
            {field(t('levelNe'),input(levelForm.nameNe,v=>setLevelForm(f=>({...f,nameNe:v})),{required:true}))}
            {field(t('descriptionEn'),input(levelForm.descriptionEn,v=>setLevelForm(f=>({...f,descriptionEn:v})),{}))}
            {field(t('descriptionNe'),input(levelForm.descriptionNe,v=>setLevelForm(f=>({...f,descriptionNe:v})),{}))}
            {field(t('source'),input(levelForm.sourceGuideline,v=>setLevelForm(f=>({...f,sourceGuideline:v})),{}))}
            <label className="ex-check"><input type="checkbox" checked={levelForm.isOfficiallyVerified} onChange={e=>setLevelForm(f=>({...f,isOfficiallyVerified:e.target.checked}))}/>{t('officialVerified')}</label>
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('addLevel'),<Plus size={15}/>)}</div>
          </form>)}
        </div>
        {panel(t('curriculum'), `${competencies.length} outcomes · ${levels.length} achievement levels`, <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('grade')}</th><th>{t('subject')}</th><th>{t('compCode')}</th><th>{t('competency')}</th><th>{t('source')}</th><th /></tr></thead><tbody>{competencies.map(c=><tr key={c.id}><td>{c.grade}</td><td>{lang==='ne'?c.subject_name_ne:c.subject_name_en}</td><td>{c.competency_code}</td><td>{lang==='ne'?c.description_ne:c.description_en}</td><td>{c.source_guideline||'—'}<small>{c.source_reference||''}</small></td><td>{['admin','exam_coordinator'].includes(currentRole)&&actionBtn(t('deactivate'),()=>deactivateCompetency(c.id),'danger')}</td></tr>)}{!competencies.length&&<tr><td colSpan="6" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
        {panel(lang==='ne'?'उपलब्धि स्तर सूची':'Achievement Levels',`${levels.length} configured levels`,<div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('grade')}</th><th>{t('levelCode')}</th><th>{t('levelEn')}</th><th>{t('levelNe')}</th><th>{t('source')}</th><th>{t('officialVerified')}</th><th /></tr></thead><tbody>{levels.map(l=><tr key={l.id}><td>{l.grade}</td><td>{l.level_code}</td><td>{l.name_en}</td><td>{l.name_ne}</td><td>{l.source_guideline||'—'}</td><td>{l.is_officially_verified?'✓':'—'}</td><td>{['admin','exam_coordinator'].includes(currentRole)&&actionBtn(t('deactivate'),()=>deactivateLevel(l.id),'danger')}</td></tr>)}{!levels.length&&<tr><td colSpan="7" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
      </>}

      {tab === 'exams' && <>
        <div className="ex-two-col">
          {panel(t('createExam'), lang === 'ne' ? 'कक्षा ४–५ को template सिकाइ उपलब्धि केन्द्रित हुन्छ; ६–८ विषयगत र ९–१० औपचारिक मार्कसिट template हो।' : 'Template is grade-specific. Grading thresholds are not assumed.', <form onSubmit={createExam} className="ex-grid">
            {field(t('selectYear'),select(examForm.academicYearId,v=>setExamForm(f=>({...f,academicYearId:v})),years.map(y=>({value:y.id,label:y.year_name})),t('select')))}
            {field(t('grade'),select(examForm.grade,v=>setExamForm(f=>({...f,grade:Number(v)})),GRADES.map(g=>({value:g,label:`${lang==='ne'?'कक्षा':'Grade'} ${g}`}))))}
            {field(t('examNameEn'),input(examForm.examNameEn,v=>setExamForm(f=>({...f,examNameEn:v})),{required:true}))}
            {field(t('examNameNe'),input(examForm.examNameNe,v=>setExamForm(f=>({...f,examNameNe:v})),{required:true}))}
            {field(t('examType'),select(examForm.examType,v=>setExamForm(f=>({...f,examType:v})),[{value:'unit',label:'Unit Test'},{value:'terminal',label:'Terminal'},{value:'annual',label:'Annual'},{value:'final',label:'Final'},{value:'practical',label:'Practical'},{value:'other',label:'Other'}]))}
            {field(t('examDate'),input(examForm.examDateBs,v=>setExamForm(f=>({...f,examDateBs:v})),{placeholder:'२०८३-०८-१२'}),`AD: ${fromBS(examForm.examDateBs)||'—'}`)}
            <div style={{gridColumn:'1/-1'}}><span className="ex-data-chip">{t('model')}: {gradeModelLabel(gradeModel(examForm.grade),lang)}</span></div>
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('createExam'),<Plus size={15}/>)}</div>
          </form>)}
          {panel(t('chooseExam'), '', <div className="ex-list">{displayExams.map(e=><div className="ex-list-item" key={e.id} style={{borderColor:String(e.id)===String(selectedExamId)?'#818cf8':undefined,background:String(e.id)===String(selectedExamId)?'rgba(255,79,163,.12)':'#101827'}}><div><strong>{lang==='ne'?e.exam_name_ne:e.exam_name_en}</strong><small>{e.year_name} · {lang==='ne'?'कक्षा':'Grade'} {e.grade} · {gradeModelLabel(e.assessment_model,lang)}</small><div style={{marginTop:6}}>{statusBadge(e.status)}</div></div>{actionBtn(t('chooseExam'),()=>{setSelectedExamId(String(e.id));setTab('exams');},'secondary')}</div>)}{!displayExams.length&&<p className="ex-empty">{t('noRecords')}</p>}</div>)}
        </div>
        {selectedExam && panel(`${t('examInfo')}: ${lang==='ne'?selectedExam.exam_name_ne:selectedExam.exam_name_en}`, `${selectedExam.year_name} · Grade ${selectedExam.grade} · ${gradeModelLabel(selectedExam.assessment_model,lang)}`, <>
          <div className="ex-inline" style={{marginBottom:12}}>{statusBadge(selectedExam.status)}<span className="ex-muted">{t('currentUser')}: {user?.email} · {ROLE_LABELS[currentRole]||currentRole}</span></div>
          <div className="ex-actions">
            {selectedExam.status==='draft'&&actionBtn(t('sendReview'),()=>changeExamStatus('in_review'),'primary',!isAdmin&&currentRole!=='exam_coordinator'&&currentRole!=='teacher',<FileClock size={15}/>) }
            {selectedExam.status==='in_review'&&actionBtn(t('draftAgain'),()=>changeExamStatus('draft'),'secondary',!isAdmin&&currentRole!=='exam_coordinator')}
            {selectedExam.status==='in_review'&&actionBtn(t('approve'),()=>changeExamStatus('approved'),'green',!isAdmin&&currentRole!=='principal'&&currentRole!=='exam_coordinator',<BadgeCheck size={15}/>) }
            {selectedExam.status==='approved'&&actionBtn(t('draftAgain'),()=>changeExamStatus('draft'),'secondary',!isAdmin&&currentRole!=='exam_coordinator')}
            {selectedExam.status==='approved'&&actionBtn(t('lock'),()=>changeExamStatus('locked'),'danger',!isAdmin&&currentRole!=='principal'&&currentRole!=='exam_coordinator',<LockKeyhole size={15}/>) }
            {selectedExam.status==='locked'&&actionBtn(t('publish'),()=>changeExamStatus('published'),'primary',!isAdmin&&currentRole!=='principal',<FileCheck2 size={15}/>) }
            <span className="ex-hint">{t('lockedNote')}</span>
          </div>
          <div className="ex-two-col" style={{marginTop:18}}>
            {panel(t('configureSubject'), '', <form onSubmit={addExamSubject} className="ex-grid">
              {field(t('subject'),select(examSubjectForm.subjectId,v=>setExamSubjectForm(f=>({...f,subjectId:v})),gradeSubjects.filter(s=>!(details?.subjects||[]).some(es=>String(es.subject_id)===String(s.id))).map(s=>({value:s.id,label:`${s.subject_code} · ${lang==='ne'?s.name_ne:s.name_en}`}))))}
              {field(t('fullMarks'),input(examSubjectForm.fullMarks,v=>setExamSubjectForm(f=>({...f,fullMarks:v})),{type:'number',min:0,step:'0.01'}))}
              {field(t('passMarks'),input(examSubjectForm.passMarks,v=>setExamSubjectForm(f=>({...f,passMarks:v})),{type:'number',min:0,step:'0.01'}))}
              {field(t('creditHours'),input(examSubjectForm.creditHours,v=>setExamSubjectForm(f=>({...f,creditHours:v})),{type:'number',min:0,step:'0.01'}))}
              <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('configureSubject'),<Plus size={15}/>)}</div>
            </form>)}
            {panel(t('addComponent'), lang==='ne'?'Internal, written, practical, project, continuous अथवा descriptive component। सबै full/pass marks Admin ले लागू guideline अनुसार राख्नुहोस्।':'Use applicable written, internal, practical, project, continuous or descriptive components. Configure marks only from the applicable rule.', <form onSubmit={addComponent} className="ex-grid">
              {field(t('subject'),select(componentForm.examSubjectId,v=>setComponentForm(f=>({...f,examSubjectId:v})),(details?.subjects||[]).map(s=>({value:s.id,label:lang==='ne'?s.subject_name_ne:s.subject_name_en}))))}
              {field(t('componentCode'),input(componentForm.componentCode,v=>setComponentForm(f=>({...f,componentCode:v})),{required:true}))}
              {field(t('componentEn'),input(componentForm.nameEn,v=>setComponentForm(f=>({...f,nameEn:v})),{required:true}))}
              {field(t('componentNe'),input(componentForm.nameNe,v=>setComponentForm(f=>({...f,nameNe:v})),{required:true}))}
              {field(t('componentType'),select(componentForm.componentType,v=>setComponentForm(f=>({...f,componentType:v})),TYPES.map(x=>({value:x,label:x}))))}
              {field(t('maxMarks'),input(componentForm.maxMarks,v=>setComponentForm(f=>({...f,maxMarks:v})),{type:'number',min:0,step:'0.01'}))}
              {field(t('componentPassMarks'),input(componentForm.passMarks,v=>setComponentForm(f=>({...f,passMarks:v})),{type:'number',min:0,step:'0.01'}))}
              <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('addComponent'),<Plus size={15}/>)}</div>
            </form>)}
          </div>
          {panel(t('configureSubject'), `${(details?.subjects||[]).length} subjects · ${(details?.components||[]).length} components`, <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('subject')}</th><th>{t('fullMarks')}</th><th>{t('passMarks')}</th><th>{t('componentType')}</th><th>{t('componentEn')} / {t('maxMarks')}</th></tr></thead><tbody>{(details?.subjects||[]).map(s=>{const cs=getSubjectComponents(s.id);return <React.Fragment key={s.id}><tr><td><b>{lang==='ne'?s.subject_name_ne:s.subject_name_en}</b><small>{s.subject_code}</small></td><td>{s.full_marks??'—'}</td><td>{s.pass_marks??'—'}</td><td colSpan="2">{cs.length} components</td></tr>{cs.map(c=><tr key={c.id}><td>↳ {c.component_code}</td><td colSpan="2">{c.component_type}</td><td>{lang==='ne'?c.name_ne:c.name_en}</td><td>{c.max_marks??t('notConfigured')}<small>{lang==='ne'?'उत्तीर्णाङ्क':'Pass'}: {c.pass_marks??'—'}</small></td></tr>)}</React.Fragment>})}{!(details?.subjects||[]).length&&<tr><td colSpan="5" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
          {panel(lang==='ne'?'परीक्षा तालिका':'Exam Schedule',lang==='ne'?'वि.सं. मिति, समय, कक्ष र निरीक्षक/सुपरीवेक्षक राख्नुहोस्।':'Configure B.S. date, time, room and invigilator.', <>
            <form onSubmit={saveSchedule} className="ex-grid-3">
              {field(t('subject'),select(scheduleForm.examSubjectId,v=>setScheduleForm(f=>({...f,examSubjectId:v})),(details?.subjects||[]).map(s=>({value:s.id,label:lang==='ne'?s.subject_name_ne:s.subject_name_en}))))}
              {field(lang==='ne'?'परीक्षा मिति (वि.सं.)':'Exam Date (B.S.)',input(scheduleForm.examDateBs,v=>setScheduleForm(f=>({...f,examDateBs:v})),{placeholder:'२०८३-०८-१२',required:true}),`AD: ${fromBS(scheduleForm.examDateBs)||'—'}`)}
              {field(lang==='ne'?'सुरु समय':'Start Time',input(scheduleForm.startTime,v=>setScheduleForm(f=>({...f,startTime:v})),{type:'time',required:true}))}
              {field(lang==='ne'?'समाप्त समय':'End Time',input(scheduleForm.endTime,v=>setScheduleForm(f=>({...f,endTime:v})),{type:'time',required:true}))}
              {field(lang==='ne'?'कक्ष/स्थान':'Room / Venue',input(scheduleForm.roomOrVenue,v=>setScheduleForm(f=>({...f,roomOrVenue:v}))))}
              {field(lang==='ne'?'निरीक्षक':'Invigilator',input(scheduleForm.invigilator,v=>setScheduleForm(f=>({...f,invigilator:v}))))}
              <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(lang==='ne'?'तालिका सुरक्षित गर्नुहोस्':'Save Schedule',<CalendarDays size={15}/>)}</div>
            </form>
            <div className="ex-table-wrap" style={{marginTop:14}}><table className="ex-table"><thead><tr><th>{t('subject')}</th><th>{lang==='ne'?'मिति (वि.सं.)':'Date (B.S.)'}</th><th>{lang==='ne'?'समय':'Time'}</th><th>{lang==='ne'?'कक्ष':'Room'}</th><th>{lang==='ne'?'निरीक्षक':'Invigilator'}</th></tr></thead><tbody>{(details?.schedule||[]).map(r=><tr key={r.id}><td>{lang==='ne'?r.subject_name_ne:r.subject_name_en}</td><td>{r.exam_date_bs||toBS(r.exam_date)||'—'}</td><td>{`${String(r.start_time||'').slice(0,5)||'—'} – ${String(r.end_time||'').slice(0,5)||'—'}`}</td><td>{r.room_or_venue||'—'}</td><td>{r.invigilator||'—'}</td></tr>)}{!(details?.schedule||[]).length&&<tr><td colSpan="5" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>
          </>)}
          {panel(t('history'), '', <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>Time</th><th>Actor</th><th>Role</th><th>Action</th><th>Change</th></tr></thead><tbody>{auditRows.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.actor_email||'—'}</td><td>{r.actor_role||'—'}</td><td>{r.action}</td><td><small>{r.old_value?JSON.stringify(r.old_value):'—'}</small><small>{r.new_value?JSON.stringify(r.new_value):r.note||'—'}</small></td></tr>)}{!auditRows.length&&<tr><td colSpan="5" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
        </>)}
      </>}

      {tab === 'marks' && <>
        {!selectedExam ? panel(t('chooseExam'),t('noExam'), <div>{select(selectedExamId,v=>setSelectedExamId(v),displayExams.map(e=>({value:e.id,label:`${e.year_name} · Grade ${e.grade} · ${lang==='ne'?e.exam_name_ne:e.exam_name_en}`})))}</div>) : <>
          {panel(t('marks'), `${selectedExam.year_name} · Grade ${selectedExam.grade} · ${statusLabel(selectedExam.status,lang)}`, <>
            {!editable&&<div className="ex-alert ex-alert-info">{t('lockedNote')}</div>}
            <div className="ex-grid-3">
              {field(t('subject'),select(selectedExamSubjectId,v=>{setSelectedExamSubjectId(v);setSelectedComponentId('');},(details?.subjects||[]).map(s=>({value:s.id,label:lang==='ne'?s.subject_name_ne:s.subject_name_en}))))}
              {field(t('selectComponent'),select(selectedComponentId,v=>setSelectedComponentId(v),components.map(c=>({value:c.id,label:`${lang==='ne'?c.name_ne:c.name_en} · ${c.max_marks??t('notConfigured')}`}))))}
              <div className="ex-muted" style={{alignSelf:'end'}}>{t('roster')}: {details?.students?.length||0}</div>
            </div>
            {selectedComponent&&<><p className="ex-hint">{selectedComponent.max_marks==null?(lang==='ne'?'यो descriptive component हो; अङ्क होइन, शिक्षक टिप्पणी राख्नुहोस्।':'Descriptive component; enter teacher notes instead of marks.'): `${t('maxMarks')}: ${selectedComponent.max_marks}`}</p>
              <div className="ex-table-wrap" style={{marginTop:12}}><table className="ex-table"><thead><tr><th>Reg No / Roll</th><th>{t('student')}</th><th>{t('marksObtained')}</th><th>{t('absent')}</th><th>{t('note')}</th></tr></thead><tbody>{(details?.students||[]).map(st=>{const key=`${selectedComponent.id}:${st.id}`, prev=existingMark(selectedComponent.id,st.id);return <tr key={st.id}><td>{st.reg_no||st.admission_no}<small>{st.roll_number}</small></td><td>{st.student_name}<small>{st.guardian_name||'—'} · {st.guardian_phone||'—'}</small></td><td><input className="ex-input ex-mark-input" type="number" step="0.01" min="0" max={selectedComponent.max_marks||undefined} disabled={!editable||selectedComponent.max_marks==null||(absentValues[key]??prev?.is_absent)} value={markValues[key] ?? (prev?.marks_obtained??'')} onChange={e=>setMarkValues(v=>({...v,[key]:e.target.value}))}/></td><td><input className="ex-tick" type="checkbox" disabled={!editable} checked={absentValues[key]??Boolean(prev?.is_absent)} onChange={e=>setAbsentValues(v=>({...v,[key]:e.target.checked}))}/></td><td><input className="ex-input" disabled={!editable} value={noteValues[key]??prev?.teacher_note??''} onChange={e=>setNoteValues(v=>({...v,[key]:e.target.value}))}/></td></tr>})}{!details?.students?.length&&<tr><td colSpan="5" className="ex-empty">{t('noStudents')}</td></tr>}</tbody></table></div>
              <div className="ex-actions">{submitBtn(t('saveMarks'))}</div></>}
          </>)}
        </>}
      </>}

      {tab === 'reports' && <>
        {panel(t('reports'), t('printHint'), <div className="ex-grid-3">
          {field(t('chooseExam'),select(selectedExamId,v=>setSelectedExamId(v),displayExams.map(e=>({value:e.id,label:`${e.year_name} · Grade ${e.grade} · ${lang==='ne'?e.exam_name_ne:e.exam_name_en}`}))))}
          {field(t('selectStudent'),select(selectedPrintStudentId,v=>setSelectedPrintStudentId(v),(details?.students||[]).map(s=>({value:s.id,label:studentLabel(s)}))))}
          <div className="ex-muted" style={{alignSelf:'end'}}>{details?.students?.length||0} students · {details?.exam?statusLabel(details.exam.status,lang):'—'}</div>
        </div>)}
        {selectedExam&&details&&<>
          {panel(t('preview'), '', <>
            {selectedPrintStudent&&<div className="ex-list-item"><div><strong>{selectedPrintStudent.student_name}</strong><small>{selectedPrintStudent.reg_no||selectedPrintStudent.admission_no} · {selectedPrintStudent.class_name}-{selectedPrintStudent.section} / {selectedPrintStudent.roll_number}</small></div><div className="ex-actions" style={{margin:0}}>{actionBtn(t('printStandard'),()=>startPrint('standard',selectedPrintStudent.id),'primary',false,<Printer size={15}/>)}{actionBtn(t('printProgress'),()=>startPrint('progress',selectedPrintStudent.id),'secondary',false,<FileText size={15}/>)}</div></div>}
            <div className="ex-actions">{actionBtn(t('printBulk'),()=>startPrint('standard',null),'primary',!details.students.length,<Users size={15}/>)}{actionBtn(t('printProgress')+' · '+t('all'),()=>startPrint('progress',null),'secondary',!details.students.length,<Download size={15}/>)}</div>
            <p className="ex-hint">{t('printHint')} · {lang==='ne'?'प्रकाशित नभएको report मा draft/review स्थिति पनि छापिन्छ।':'Draft/review status is printed when results are not published.'}</p>
            {selectedPrintStudent&&<div className="exam-report-preview" style={{border:'1px solid var(--line)',borderRadius:10,padding:14,marginTop:14}}>{schoolPrintHeader(lang==='ne'?selectedExam.exam_name_ne:selectedExam.exam_name_en)}<div className="ex-grid"><p><b>{t('student')}:</b> {selectedPrintStudent.student_name}</p><p><b>Reg No:</b> {selectedPrintStudent.reg_no||selectedPrintStudent.admission_no}</p><p><b>{t('grade')}:</b> {selectedPrintStudent.class_name}-{selectedPrintStudent.section}</p><p><b>{t('examStatus')}:</b> {statusLabel(selectedExam.status,lang)}</p></div><div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('subject')}</th><th>{t('fullMarks')}</th><th>{t('marksObtained')}</th><th>%</th><th>{t('letterGrade')}</th></tr></thead><tbody>{studentTotals(selectedPrintStudent.id).perSubject.map(x=><tr key={x.subject.id}><td>{lang==='ne'?x.subject.subject_name_ne:x.subject.subject_name_en}</td><td>{x.result.full??'—'}</td><td>{x.result.total??'—'}</td><td>{x.result.pct==null?'—':x.result.pct.toFixed(2)}</td><td>{x.result.gradeRule?.letter_grade||'—'}</td></tr>)}</tbody></table></div><div className="ex-actions">{actionBtn(t('printStandard'),()=>startPrint('standard',selectedPrintStudent.id),'secondary',false,<Printer size={15}/>)}</div></div>}
          </>)}
          {panel(lang==='ne'?'प्रतिवेदन प्रिन्ट इतिहास':'Report Generation History',lang==='ne'?'कसले, कहिले र कुन प्रकारको रिपोर्ट प्रिन्ट/PDF का लागि तयार गर्‍यो भन्ने audit record।':'Audit log of who generated each print/PDF report.', <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{lang==='ne'?'मिति/समय':'Generated At'}</th><th>{lang==='ne'?'प्रतिवेदन':'Report Type'}</th><th>{lang==='ne'?'विद्यार्थी संख्या':'Students'}</th><th>{lang==='ne'?'स्थिति':'Exam Status'}</th><th>{lang==='ne'?'प्रयोगकर्ता':'User'}</th><th>{lang==='ne'?'पुनः प्रिन्ट':'Reprint'}</th></tr></thead><tbody>{reportHistory.map(r=><tr key={r.id}><td>{new Date(r.generated_at).toLocaleString()}</td><td>{r.report_type}</td><td>{r.students_count}</td><td>{r.exam_status||'—'}</td><td>{r.generated_by_email||'—'}</td><td>{actionBtn(lang==='ne'?'पुनः प्रिन्ट':'Reprint',()=>startPrint(r.report_type.includes('progress')?'progress':'standard',r.student_id||null),'secondary',!details,<Printer size={14}/>)}</td></tr>)}{!reportHistory.length&&<tr><td colSpan="6" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
          {panel(t('progress'), '', <form onSubmit={saveProgress} className="ex-grid-3">
            {field(t('selectStudent'),select(selectedStudentId,v=>{setSelectedStudentId(v);const r=details.progressReports.find(x=>String(x.student_id)===String(v));const a=(details.attendanceSummary||[]).find(x=>String(x.student_id)===String(v));setProgressForm({strengthsEn:r?.strengths_en||'',strengthsNe:r?.strengths_ne||'',improvementAreasEn:r?.improvement_areas_en||'',improvementAreasNe:r?.improvement_areas_ne||'',teacherCommentsEn:r?.teacher_comments_en||'',teacherCommentsNe:r?.teacher_comments_ne||'',recommendationsEn:r?.recommendations_en||'',recommendationsNe:r?.recommendations_ne||'',parentFeedback:r?.parent_feedback||'',attendancePresent:r?.attendance_present??a?.present_count??'',attendanceTotal:r?.attendance_total??a?.recorded_days??''});},details.students.map(s=>({value:s.id,label:studentLabel(s)}))))}
            {field(t('strengths')+' (English)',input(progressForm.strengthsEn,v=>setProgressForm(f=>({...f,strengthsEn:v}))))}
            {field(t('strengths')+' (नेपाली)',input(progressForm.strengthsNe,v=>setProgressForm(f=>({...f,strengthsNe:v}))))}
            {field(t('improvement')+' (English)',input(progressForm.improvementAreasEn,v=>setProgressForm(f=>({...f,improvementAreasEn:v}))))}
            {field(t('improvement')+' (नेपाली)',input(progressForm.improvementAreasNe,v=>setProgressForm(f=>({...f,improvementAreasNe:v}))))}
            {field(t('teacherComments')+' (English)',input(progressForm.teacherCommentsEn,v=>setProgressForm(f=>({...f,teacherCommentsEn:v}))))}
            {field(t('teacherComments')+' (नेपाली)',input(progressForm.teacherCommentsNe,v=>setProgressForm(f=>({...f,teacherCommentsNe:v}))))}
            {field(t('recommendations')+' (English)',input(progressForm.recommendationsEn,v=>setProgressForm(f=>({...f,recommendationsEn:v}))))}
            {field(t('recommendations')+' (नेपाली)',input(progressForm.recommendationsNe,v=>setProgressForm(f=>({...f,recommendationsNe:v}))))}
            {field(t('parentFeedback'),input(progressForm.parentFeedback,v=>setProgressForm(f=>({...f,parentFeedback:v}))))}
            {field(t('attendancePresent'),input(progressForm.attendancePresent,v=>setProgressForm(f=>({...f,attendancePresent:v})),{type:'number',min:0,step:1}))}
            {field(t('attendanceTotal'),input(progressForm.attendanceTotal,v=>setProgressForm(f=>({...f,attendanceTotal:v})),{type:'number',min:0,step:1}),lang==='ne'?'खाली छोडेमा वार्षिक अवधिका दैनिक attendance records बाट recorded days लिइन्छ।':'If left blank, recorded school-attendance days in this academic year are used.')}
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('saveProgress'))}</div>
          </form>)}
          {Number(selectedExam.grade)<=5&&panel(t('competency'),t('noLevels'),<form onSubmit={saveCompetency} className="ex-grid-3">
            {field(t('selectStudent'),select(selectedStudentId,v=>setSelectedStudentId(v),details.students.map(s=>({value:s.id,label:studentLabel(s)}))))}
            {field(t('subject'),select(competencyResultForm.subjectId,v=>setCompetencyResultForm(f=>({...f,subjectId:v,competencyId:''})),(details.subjects||[]).map(s=>({value:s.subject_id,label:lang==='ne'?s.subject_name_ne:s.subject_name_en}))))}
            {field(t('competency'),select(competencyResultForm.competencyId,v=>setCompetencyResultForm(f=>({...f,competencyId:v})),competencies.filter(c=>String(c.subject_id)===String(competencyResultForm.subjectId)).map(c=>({value:c.id,label:`${c.competency_code} · ${lang==='ne'?c.description_ne:c.description_en}`}))))}
            {field(t('achievement'),select(competencyResultForm.achievementLevelId,v=>setCompetencyResultForm(f=>({...f,achievementLevelId:v})),selectedLevelList.map(l=>({value:l.id,label:`${l.level_code} · ${lang==='ne'?l.name_ne:l.name_en}`})),t('notConfigured')))}
            {field(t('observation')+' (English)',input(competencyResultForm.observationEn,v=>setCompetencyResultForm(f=>({...f,observationEn:v}))))}
            {field(t('observation')+' (नेपाली)',input(competencyResultForm.observationNe,v=>setCompetencyResultForm(f=>({...f,observationNe:v}))))}
            {field('Evidence',input(competencyResultForm.evidenceNote,v=>setCompetencyResultForm(f=>({...f,evidenceNote:v}))))}
            {field(t('nextSteps')+' (English)',input(competencyResultForm.nextStepsEn,v=>setCompetencyResultForm(f=>({...f,nextStepsEn:v}))))}
            {field(t('nextSteps')+' (नेपाली)',input(competencyResultForm.nextStepsNe,v=>setCompetencyResultForm(f=>({...f,nextStepsNe:v}))))}
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('saveCompetency'))}</div>
          </form>)}
        </>}
      </>}

      {tab === 'grading' && <>
        <div className="ex-two-col">
          {panel(t('gradingRules'), t('noRules'), <form onSubmit={saveGradeRule} className="ex-grid">
            {field(t('grade'),select(ruleForm.grade,v=>setRuleForm(f=>({...f,grade:Number(v)})),GRADES.map(g=>({value:g,label:String(g)}))))}
            {field(t('academicYears'),select(ruleForm.academicYearId,v=>setRuleForm(f=>({...f,academicYearId:v})),years.map(y=>({value:y.id,label:y.year_name})),t('all')))}
            {field(t('minPct'),input(ruleForm.minPercentage,v=>setRuleForm(f=>({...f,minPercentage:v})),{type:'number',min:0,max:100,step:'0.001',required:true}))}
            {field(t('maxPct'),input(ruleForm.maxPercentage,v=>setRuleForm(f=>({...f,maxPercentage:v})),{type:'number',min:0,max:100,step:'0.001',required:true}))}
            {field(t('letterGrade'),input(ruleForm.letterGrade,v=>setRuleForm(f=>({...f,letterGrade:v})),{required:true}))}
            {field(t('gradePoint'),input(ruleForm.gradePoint,v=>setRuleForm(f=>({...f,gradePoint:v})),{type:'number',min:0,step:'0.001'}))}
            {field(t('descriptionEn'),input(ruleForm.descriptionEn,v=>setRuleForm(f=>({...f,descriptionEn:v}))))}
            {field(t('descriptionNe'),input(ruleForm.descriptionNe,v=>setRuleForm(f=>({...f,descriptionNe:v}))))}
            {field(t('source'),input(ruleForm.sourceGuideline,v=>setRuleForm(f=>({...f,sourceGuideline:v})),{required:true}))}
            {field(t('sourceClause'),input(ruleForm.sourceClause,v=>setRuleForm(f=>({...f,sourceClause:v})),{required:ruleForm.isVerified}))}
            <label className="ex-check" style={{gridColumn:'1/-1'}}><input type="checkbox" checked={ruleForm.isVerified} onChange={e=>setRuleForm(f=>({...f,isVerified:e.target.checked}))}/>{t('verified')}</label>
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('saveRule'))}</div>
            <p className="ex-hint" style={{gridColumn:'1/-1'}}>{t('sourceWarning')}</p>
          </form>)}
          {panel(t('gpaPolicy'), t('notConfigured'), <form onSubmit={savePolicy} className="ex-grid">
            {field(t('grade'),select(policyForm.grade,v=>setPolicyForm(f=>({...f,grade:Number(v)})),GRADES.map(g=>({value:g,label:String(g)}))))}
            {field(t('academicYears'),select(policyForm.academicYearId,v=>setPolicyForm(f=>({...f,academicYearId:v})),years.map(y=>({value:y.id,label:y.year_name})),t('all')))}
            {field(t('gpaMethod'),select(policyForm.gpaMethod,v=>setPolicyForm(f=>({...f,gpaMethod:v})),[{value:'not_configured',label:t('notConfigured')},{value:'arithmetic_mean',label:'Arithmetic mean'},{value:'weighted_by_credit',label:'Weighted by credit hours'},{value:'configured_other',label:'Other (admin configured)'}]))}
            {field(t('gpaMax'),input(policyForm.gpaMax,v=>setPolicyForm(f=>({...f,gpaMax:v})),{type:'number',min:0,step:'0.001'}))}
            {field(t('passRule'),input(policyForm.overallPassRule,v=>setPolicyForm(f=>({...f,overallPassRule:v}))))}
            {field(t('promotionRule'),input(policyForm.promotionRule,v=>setPolicyForm(f=>({...f,promotionRule:v}))))}
            {field(t('source'),input(policyForm.sourceGuideline,v=>setPolicyForm(f=>({...f,sourceGuideline:v})),{required:policyForm.gpaMethod!=='not_configured'}))}
            {field(t('sourceClause'),input(policyForm.sourceClause,v=>setPolicyForm(f=>({...f,sourceClause:v})),{required:policyForm.gpaMethod!=='not_configured'}))}
            <label className="ex-check" style={{gridColumn:'1/-1'}}><input type="checkbox" checked={policyForm.isVerified} onChange={e=>setPolicyForm(f=>({...f,isVerified:e.target.checked}))}/>{t('verified')}</label>
            <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(t('savePolicy'))}</div>
          </form>)}
        </div>
        {panel(t('gradingRules'), `${rules.length} rules`, <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('grade')}</th><th>{t('academicYears')}</th><th>{t('minPct')}–{t('maxPct')}</th><th>{t('letterGrade')}</th><th>{t('gradePoint')}</th><th>{t('source')}</th><th>{t('verified')}</th><th /></tr></thead><tbody>{rules.map(r=><tr key={r.id}><td>{r.grade}</td><td>{years.find(y=>String(y.id)===String(r.academic_year_id))?.year_name||'All / General'}</td><td>{r.min_percentage}–{r.max_percentage}</td><td>{r.letter_grade}</td><td>{r.grade_point??'—'}</td><td>{r.source_guideline}<small>{r.source_clause||''}</small></td><td>{r.is_verified?'✓':'—'}</td><td>{['admin','exam_coordinator'].includes(currentRole)&&actionBtn(t('deactivate'),()=>deactivateGradeRule(r.id),'danger')}</td></tr>)}{!rules.length&&<tr><td colSpan="8" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
        {panel(t('gpaPolicy'), '', <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('grade')}</th><th>{t('academicYears')}</th><th>{t('gpaMethod')}</th><th>{t('gpaMax')}</th><th>{t('passRule')}</th><th>{t('verified')}</th></tr></thead><tbody>{policies.map(p=><tr key={p.id}><td>{p.grade}</td><td>{years.find(y=>String(y.id)===String(p.academic_year_id))?.year_name||'All / General'}</td><td>{p.gpa_method}</td><td>{p.gpa_max??'—'}</td><td>{p.overall_pass_rule||'—'}<small>{p.promotion_rule||''}</small></td><td>{p.is_verified?'✓':'—'}</td></tr>)}{!policies.length&&<tr><td colSpan="6" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
      </>}

      {tab === 'access' && <>
        {isAdmin && panel(lang==='ne'?'विद्यालयको विवरण / प्रतिवेदन सेटिङ':'School Identity & Report Settings',lang==='ne'?'मानक मार्कसिट र प्रगति प्रतिवेदनमा देखिने विद्यालयको वास्तविक नाम, ठेगाना, सम्पर्क र लोगो यहाँ सेट गर्नुहोस्।':'Configure the real school identity shown on printed marksheets and progress reports.', <form onSubmit={saveReportSettings} className="ex-grid-3">
          {field(lang==='ne'?'विद्यालयको नाम (English)':'School Name (English)',input(reportSettingsForm.schoolNameEn,v=>setReportSettingsForm(f=>({...f,schoolNameEn:v})),{maxLength:200}))}
          {field(lang==='ne'?'विद्यालयको नाम (नेपाली)':'School Name (Nepali)',input(reportSettingsForm.schoolNameNe,v=>setReportSettingsForm(f=>({...f,schoolNameNe:v})),{maxLength:200}))}
          {field(lang==='ne'?'ठेगाना (English)':'Address (English)',input(reportSettingsForm.addressEn,v=>setReportSettingsForm(f=>({...f,addressEn:v}))))}
          {field(lang==='ne'?'ठेगाना (नेपाली)':'Address (Nepali)',input(reportSettingsForm.addressNe,v=>setReportSettingsForm(f=>({...f,addressNe:v}))))}
          {field(lang==='ne'?'फोन':'Phone',input(reportSettingsForm.contactPhone,v=>setReportSettingsForm(f=>({...f,contactPhone:v})),{maxLength:60}))}
          {field('Email',input(reportSettingsForm.contactEmail,v=>setReportSettingsForm(f=>({...f,contactEmail:v})),{type:'email'}))}
          {field(lang==='ne'?'विद्यालय लोगोको HTTPS URL':'School logo HTTPS URL',input(reportSettingsForm.logoUrl,v=>setReportSettingsForm(f=>({...f,logoUrl:v})),{type:'url',placeholder:'https://...'}),lang==='ne'?'छवि सार्वजनिक रूपमा उपलब्ध HTTPS URL मा हुनुपर्छ।':'Use a publicly reachable HTTPS image URL.')}
          <div className="ex-actions" style={{gridColumn:'1/-1'}}>{submitBtn(lang==='ne'?'प्रतिवेदन सेटिङ सुरक्षित गर्नुहोस्':'Save Report Settings',<Save size={15}/>)}</div>
        </form>)}
        <div className="ex-role-callout">{lang==='ne'?'महत्त्वपूर्ण: हालको app मा demo login छ। यो role mapping module भित्रको access control हो; production मा वास्तविक server-side authentication/session verification थपेपछि मात्र पूर्ण सुरक्षा दाबी गर्न मिल्छ।':'Important: current app uses demo login. This DB role mapping is module-level access control; full production security requires real server-side authentication/session verification.'}</div>
        {panel(t('roles'), '', <>
          {isAdmin&&<form onSubmit={assignRole} className="ex-grid-3" style={{marginBottom:14}}>{field(t('userEmail'),input(roleForm.userEmail,v=>setRoleForm(f=>({...f,userEmail:v})),{type:'email',required:true}))}{field(t('role'),select(roleForm.role,v=>setRoleForm(f=>({...f,role:v})),Object.entries(ROLE_LABELS).map(([value,label])=>({value,label}))))}<div className="ex-actions" style={{alignSelf:'end'}}>{submitBtn(t('assignRole'),<ShieldCheck size={15}/>)}</div></form>}
          {!isAdmin&&<p className="ex-hint">Admin role needed to edit access assignments.</p>}
          <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>{t('userEmail')}</th><th>{t('role')}</th><th>Status</th><th>Assigned By</th><th /></tr></thead><tbody>{roles.map(r=><tr key={r.id}><td>{r.user_email}</td><td>{ROLE_LABELS[r.role]||r.role}</td><td>{r.is_active?'Active':'Inactive'}</td><td>{r.assigned_by_email||'—'}</td><td>{isAdmin&&r.is_active&&r.user_email.toLowerCase()!==String(user?.email||'').toLowerCase()&&actionBtn(t('deactivate'),()=>deactivateRole(r.id),'danger')}</td></tr>)}{!roles.length&&<tr><td colSpan="5" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>
        </>)}
        {panel(t('history'), selectedExam ? `${selectedExam.exam_name_en} · ${auditRows.length} events` : 'Select an exam to see history', <div className="ex-table-wrap"><table className="ex-table"><thead><tr><th>Time</th><th>Student ID</th><th>Actor</th><th>Role</th><th>Action</th></tr></thead><tbody>{auditRows.map(r=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.student_id||'—'}</td><td>{r.actor_email||'—'}</td><td>{r.actor_role||'—'}</td><td>{r.action}</td></tr>)}{!auditRows.length&&<tr><td colSpan="5" className="ex-empty">{t('noRecords')}</td></tr>}</tbody></table></div>)}
      </>}
      <p className="ex-footnote">{t('sourceWarning')}</p>
    </div>
    <div className="exam-print-root" aria-hidden={!printMode}>
      {printMode && printStudentRows.map(student => printMode.type === 'progress' ? progressPrint(student) : standardPrint(student))}
    </div>
  </div>;
}
