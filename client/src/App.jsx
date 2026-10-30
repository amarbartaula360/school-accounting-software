import { useEffect, useState } from 'react';
import UserAccessModule from './UserAccessModule.jsx';
import { apiFetch, AUTH_TOKEN_KEY } from './api.js';
import NepaliDate from 'nepali-date-converter';
import ExaminationModule from './ExaminationModule.jsx';
import StudentIdCardModule from './StudentIdCardModule.jsx';
import PortfolioDashboard from './PortfolioDashboard.jsx';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard, BookOpen, ReceiptText, GraduationCap, Utensils,
  Package, Users, Landmark, ChartNoAxesCombined, Settings, Search,
  Bell, ArrowUpRight, ArrowDownRight, Wallet, CreditCard, TrendingUp,
  Menu, ChevronDown, Plus, Trash2, RefreshCw, Printer, FileText,
  LogIn, LogOut, CalendarDays, AlertCircle, CheckCircle2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.DEV
  ? 'http://localhost:4000'
  : 'https://school-accounting-software.onrender.com';
const ORGANIZATION_ID = 1;
const navigation = [
  { title: 'मुख्य पृष्ठ' },
  { label: 'Dashboard', icon: LayoutDashboard },
  { title: 'लेखा व्यवस्थापन / Accounting' },
  { label: 'Chart of Accounts', icon: BookOpen },
  { label: 'Journal Vouchers', icon: ReceiptText },
  { label: 'Financial Reports', icon: ChartNoAxesCombined },
  { title: 'अन्य मोड्युल / Other Modules' },
  { label: 'Cash & Bank', icon: Landmark },
  { label: 'Student Fees', icon: GraduationCap },
  { label: 'Student ID Cards', icon: CreditCard },
  { label: 'Examination & Marksheet', icon: FileText },
  { label: 'Payroll & Staff', icon: Users },
  { label: 'Hostel & Canteen', icon: Utensils },
  { label: 'Purchases & Inventory', icon: Package },
{ label: 'Sales & Receipts', icon: CreditCard },
{ label: 'User Management', icon: Users }];

const money = value =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

function getTodayAD() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toBS(dateString) {
  if (!dateString) return '';
  try {
    return new NepaliDate(new Date(`${dateString}T12:00:00`))
      .format('YYYY-MM-DD');
  } catch {
    return '';
  }
}

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

function normalizeDateDigits(value) {
  return String(value ?? '').replace(/[०-९]/g, digit => String(DEVANAGARI_DIGITS.indexOf(digit)));
}

function toNepaliDigits(value) {
  return String(value ?? '').replace(/[0-9]/g, digit => DEVANAGARI_DIGITS[Number(digit)]);
}

// Accept a Bikram Sambat date (YYYY-MM-DD) and convert it to the AD date
// used internally by the API. Both English and Devanagari digits are accepted.
function fromBS(dateString) {
  const normalized = normalizeDateDigits(dateString).trim().replaceAll('/', '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return '';

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 32) return '';

  try {
    const bs = new NepaliDate(year, month - 1, day);
    const jsDate = bs.toJsDate();
    if (!(jsDate instanceof Date) || Number.isNaN(jsDate.getTime())) return '';
    const ad = `${jsDate.getFullYear()}-${String(jsDate.getMonth() + 1).padStart(2, '0')}-${String(jsDate.getDate()).padStart(2, '0')}`;
    const expectedBS = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return toBS(ad) === expectedBS ? ad : '';
  } catch {
    return '';
  }
}

const BS_MONTH_NAMES = [
  'वैशाख', 'जेठ', 'असार', 'साउन', 'भदौ', 'असोज',
  'कात्तिक', 'मंसिर', 'पुस', 'माघ', 'फागुन', 'चैत'
];

function formatBSMonth(value) {
  const normalized = normalizeDateDigits(value).trim().replaceAll('/', '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return '';
  const month = Number(match[2]);
  if (month < 1 || month > 12) return '';
  return `${BS_MONTH_NAMES[month - 1]} ${toNepaliDigits(match[1])}`;
}

function formatBSDateLabel(adDate) {
  const bsDate = toBS(String(adDate ?? '').slice(0, 10));
  const match = normalizeDateDigits(bsDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '—';
  return `${toNepaliDigits(match[3])} ${BS_MONTH_NAMES[Number(match[2]) - 1]} ${toNepaliDigits(match[1])}`;
}

function getBSMonthRange(value) {
  const normalized = normalizeDateDigits(value).trim().replaceAll('/', '-');
  const match = normalized.match(/^(\d{4})-(\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = fromBS(`${year}-${String(month).padStart(2, '0')}-01`);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextStart = fromBS(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
  if (!start || !nextStart) return null;
  const endDate = new Date(`${nextStart}T00:00:00.000Z`);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return { start, end: endDate.toISOString().slice(0, 10) };
}

function normalizeAccount(account) {
  return {
    id: Number(account.id),
    code: account.account_code ?? account.code ?? '',
    name: account.account_name ?? account.name ?? '',
    type: String(
      account.account_type ?? account.type ?? 'unknown'
    ).toLowerCase(),
    category: account.category ?? account.account_category ?? '',
    parentId: account.parent_id == null ? '' : Number(account.parent_id),
    parentName: account.parent_name ?? account.parentName ?? '',
    isGroup: Boolean(account.is_group ?? account.isGroup ?? false),
    isActive: account.is_active ?? account.isActive ?? true,
    balance: Number(account.balance ?? 0)
  };
}

function LoginSystem({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function login(event) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          email: email.trim(),
          password
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.token || !data.user) {
        throw new Error(data.message || 'Login हुन सकेन।');
      }

      sessionStorage.setItem(AUTH_TOKEN_KEY, data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || 'Login गर्दा समस्या आयो।');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.loginPage}>
      <form onSubmit={login} style={styles.loginCard}>
        <div style={styles.loginHeaderIcon}>
          <Landmark size={32} color="#ff4fa3" />
        </div>

        <h1 style={styles.loginTitle}>LedgerPro</h1>
        <p style={styles.loginSubtitle}>United English Boarding School</p>
        <p style={styles.loginSubText}>
          विद्यालय लेखा व्यवस्थापन प्रणाली
        </p>

        <label style={styles.label}>
          इमेल / Email
          <input
            style={styles.input}
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
          />
        </label>

               <label style={styles.label}>
          पासवर्ड / Password
          <input
            style={styles.input}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button
          style={styles.primaryButton}
          type="submit"
          disabled={loading}
        >
          <LogIn size={17} />
          {loading ? 'Login हुँदैछ...' : 'Login गर्नुहोस्'}
        </button>
      </form>
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, user, onLogout }) {
  return (
    <>
      {open && (
        <div
          style={styles.mobileOverlay}
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        style={{
          ...styles.sidebar,
          ...(open ? styles.sidebarOpen : {})
        }}
      >
        <div style={styles.brand}>
          <div style={styles.brandIconBox}>
            <Landmark size={22} color="#fff" />
          </div>

          <div>
            <strong
              style={{
                fontSize: '16px',
                letterSpacing: '-0.02em',
                color: '#f8fafc'
              }}
            >
              LedgerPro
            </strong>

            <small
              style={{
                display: 'block',
                color: '#94a3b8',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.05em'
              }}
            >
              SCHOOL FINANCE
            </small>
          </div>
        </div>

        <div style={styles.workspace}>
          <div style={styles.workspaceIcon}>UE</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <strong
              style={{
                display: 'block',
                color: '#f1f5f9',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              United English
            </strong>

            <small
              style={{
                display: 'block',
                color: '#94a3b8',
                fontSize: '11px'
              }}
            >
              School Accounting
            </small>
          </div>

          <ChevronDown size={14} color="#64748b" />
        </div>

        <nav style={styles.navScroll}>
          {navigation.filter(item => item.label !== 'User Management' || user?.role === 'admin').map((item, index) =>
            item.title ? (
              <div
                key={`${item.title}-${index}`}
                style={styles.navTitle}
              >
                {item.title}
              </div>
            ) : (
              <button
                key={item.label}
                onClick={() => {
                  setActive(item.label);
                  setOpen(false);
                }}
                style={{
                  ...styles.navButton,
                  ...(active === item.label
                    ? styles.navActive
                    : {})
                }}
              >
                <item.icon size={17} />
                <span>{item.label}</span>
              </button>
            )
          )}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '12px' }}>
          <div style={styles.userCard}>
            <div style={styles.avatar}>
              {user?.name?.[0] || 'U'}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <strong
                style={{
                  display: 'block',
                  color: '#e2e8f0',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {user?.name || 'User'}
              </strong>

              <small
                style={{
                  display: 'block',
                  color: '#94a3b8',
                  fontSize: '11px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}
              >
                {user?.email}
              </small>
            </div>

            <button
              title="Logout"
              style={styles.logoutButton}
              onClick={onLogout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
function Dashboard({ accounts, transactions, loading, onReload, error }) {
  const todayAD = getTodayAD();
  const todayBS = toBS(todayAD);

  const totalIncome = accounts
    .filter(a => a.type.includes('income'))
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const totalExpenses = accounts
    .filter(a => a.type.includes('expense'))
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const cashBank = accounts
    .filter(a => /cash|bank/i.test(`${a.name} ${a.type}`))
    .reduce((sum, a) => sum + Number(a.balance || 0), 0);

  const todayTransactions = transactions.filter(t => t.date === todayAD);

  return (
    <div>
      <div style={styles.pageHeading}>
        <div>
          <div style={styles.eyebrow}>
            <CalendarDays size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: '-2px' }} />
            आजको मिति / Today: {todayBS} वि.सं.
          </div>
          <h1 style={styles.h1}>नमस्कार, स्वागत छ! 👋</h1>
          <p style={styles.subtitle}>United English Boarding School को आर्थिक अवस्था र कारोबारको सारांश।</p>
        </div>
        <button style={styles.secondaryButton} onClick={onReload}>
          <RefreshCw size={15} /> Refresh Data
        </button>
      </div>

      {error && <Notice type="error" message={error} />}
      {loading && <Notice message="Accounts लोड हुँदैछन्..." />}

      <div style={styles.metricsGrid}>
        <Metric
          title="कुल आम्दानी / Total Income"
          value={money(totalIncome)}
          note="आम्दानी खाताहरूको उपलब्ध balance"
          icon={<TrendingUp size={20} />}
          color="#15d9a2"
          bg="rgba(21,217,162,0.14)"
        />
        <Metric
          title="कुल खर्च / Total Expenses"
          value={money(totalExpenses)}
          note="खर्च खाताहरूको उपलब्ध balance"
          icon={<ArrowDownRight size={20} />}
          color="#ff5e70"
          bg="rgba(255,94,112,0.14)"
        />
        <Metric
          title="नगद तथा बैंक / Cash & Bank"
          value={money(cashBank)}
          note="नगद तथा बैंक खाताहरूको उपलब्ध balance"
          icon={<Wallet size={20} />}
          color="#ff4fa3"
          bg="#eef2ff"
        />
        <Metric
          title="खाता संख्या / Accounts"
          value={accounts.length.toLocaleString('en-IN')}
          note="लोड भएका खाताहरू"
          icon={<BookOpen size={20} />}
          color="#ffb020"
          bg="rgba(255,176,32,0.15)"
        />
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeading}>
          <div>
            <h2 style={styles.panelTitle}>आजका कारोबार / Today's Transactions</h2>
            <p style={styles.panelDesc}>मिति: {todayBS} वि.सं. ({todayAD} AD)</p>
          </div>
          <span style={styles.countBadge}>
            {todayTransactions.length} entries
          </span>
        </div>

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>मिति / Date</th>
                <th>भौचर नं.</th>
                <th>विवरण / Description</th>
                <th>प्रकार / Type</th>
                <th>रकम / Amount</th>
              </tr>
            </thead>
            <tbody>
              {todayTransactions.map((t, i) => (
                <tr key={`${t.ref || 'entry'}-${i}`}>
                  <td><span style={styles.dateBadge}>{toBS(t.date)} BS</span></td>
                  <td><strong style={{ color: '#ff5aa9' }}>{t.ref || '-'}</strong></td>
                  <td>{t.description}</td>
                  <td><span style={styles.typeBadge}>{t.category || 'Journal Voucher'}</span></td>
                  <td><strong style={{ color: '#f4f7ff' }}>{t.amount || money(t.debit || t.credit)}</strong></td>
                </tr>
              ))}
              {!todayTransactions.length && (
                <tr>
                  <td colSpan="5" style={styles.emptyCell}>
                    आजको कारोबारको सूची उपलब्ध छैन। Voucher save भएपछि यहाँ देखा पर्नेछ।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ title, value, note, icon, color, bg }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTop}>
        <span style={styles.metricTitleText}>{title}</span>
        <div style={{
          ...styles.metricIcon,
          color,
          background: bg
        }}>
          {icon}
        </div>
      </div>
      <div style={styles.metricValue}>{value}</div>
      <small style={styles.metricNote}>{note}</small>
    </div>
  );
}

function Notice({ message, type = 'info' }) {
  return (
    <div style={{
      ...styles.notice,
      ...(type === 'error' ? styles.errorNotice : styles.infoNotice)
    }}>
      {type === 'error'
        ? <AlertCircle size={18} color="#dc2626" />
        : <CheckCircle2 size={18} color="#059669" />}
      <span style={{ fontWeight: 500 }}>{message}</span>
    </div>
  );
}

function JournalVoucher({ accounts, onVoucherSaved }) {
  const [entryDate, setEntryDate] = useState(getTodayAD());
  const [bsDate, setBsDate] = useState(toBS(getTodayAD()));

  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherNumberLoading, setVoucherNumberLoading] = useState(false);
  const [voucherNumberError, setVoucherNumberError] = useState('');

  const [description, setDescription] = useState('');
  const [rows, setRows] = useState([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' }
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [journalEntries, setJournalEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [registerError, setRegisterError] = useState('');

  const totalDebit = rows.reduce(
    (sum, r) => sum + (Number(r.debit) || 0),
    0
  );

  const totalCredit = rows.reduce(
    (sum, r) => sum + (Number(r.credit) || 0),
    0
  );

  const validRows = rows.filter(r =>
    r.accountId &&
    (
      (Number(r.debit) || 0) > 0 ||
      (Number(r.credit) || 0) > 0
    )
  );

  const balanced =
    totalDebit > 0 &&
    Math.abs(totalDebit - totalCredit) < 0.005;

  // Only actual ledger accounts can be posted in a journal voucher.
  const ledgerAccounts = accounts.filter(
    account => !account.isGroup && account.isActive !== false
  );

  async function loadNextVoucherNumber(date = entryDate) {
    setVoucherNumberLoading(true);
    setVoucherNumberError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/next-voucher-number?organizationId=${ORGANIZATION_ID}&entryDate=${encodeURIComponent(date)}`
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'अर्को भौचर नम्बर ल्याउन सकिएन।');
      }

      setVoucherNumber(data.voucherNumber || '');
    } catch (e) {
      console.error('Voucher number preview error:', e);
      setVoucherNumber('');
      setVoucherNumberError(e.message || 'भौचर नम्बर लोड गर्न सकिएन।');
    } finally {
      setVoucherNumberLoading(false);
    }
  }

  // Preview updates for the selected entry date. Backend generates the final serial on save.
  useEffect(() => {
    loadNextVoucherNumber(entryDate);
  }, [entryDate]);

  async function loadJournalEntries() {
    setLoadingEntries(true);
    setRegisterError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/journal-entries?organizationId=${ORGANIZATION_ID}`
      );

      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(
          data.message || 'Journal entries load गर्न सकिएन।'
        );
      }

      if (!Array.isArray(data)) {
        throw new Error('Journal register बाट सही data आएन।');
      }

      setJournalEntries(data);
    } catch (e) {
      console.error('Journal register loading error:', e);
      setRegisterError(
        e.message || 'Journal entries load गर्दा समस्या आयो।'
      );
    } finally {
      setLoadingEntries(false);
    }
  }

  useEffect(() => {
    loadJournalEntries();
  }, []);

  function changeDate(value) {
    setBsDate(value);
    setError('');
    setSuccess('');

    const match = value.trim().match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

    if (!match) {
      setError('मिति YYYY-MM-DD ढाँचामा लेख्नुहोस्।');
      return;
    }

    try {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);

      const bs = new NepaliDate(year, month, day);
      const jsDate = bs.toJsDate();

      if (
        !(jsDate instanceof Date) ||
        Number.isNaN(jsDate.getTime())
      ) {
        throw new Error('मिति परिवर्तन भएन।');
      }

      setEntryDate(
        `${jsDate.getFullYear()}-${String(
          jsDate.getMonth() + 1
        ).padStart(2, '0')}-${String(
          jsDate.getDate()
        ).padStart(2, '0')}`
      );
    } catch (e) {
      setError(
        'यो मिति convert हुन सकेन। मिति र converter version जाँच्नुहोस्।'
      );
    }
  }

  function updateRow(index, field, value) {
    setRows(current =>
      current.map((row, i) => {
        if (i !== index) return row;

        const updated = { ...row, [field]: value };

        if (field === 'debit' && Number(value) > 0) {
          updated.credit = '';
        }

        if (field === 'credit' && Number(value) > 0) {
          updated.debit = '';
        }

        return updated;
      })
    );
  }

  function addRow() {
    setRows(current => [
      ...current,
      { accountId: '', debit: '', credit: '' }
    ]);
  }

  function removeRow(index) {
    setRows(current => current.filter((_, i) => i !== index));
  }

  async function saveVoucher(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!voucherNumber.trim()) {
      setError('Voucher Number भर्नुहोस्।');
      return;
    }

    if (!description.trim()) {
      setError('विवरण / Narration भर्नुहोस्।');
      return;
    }

    if (validRows.length < 2) {
      setError('कम्तीमा दुईवटा valid account entries आवश्यक छन्।');
      return;
    }

    if (
      validRows.some(
        r =>
          Number(r.debit || 0) > 0 &&
          Number(r.credit || 0) > 0
      )
    ) {
      setError(
        'एउटै row मा Debit र Credit दुवै राख्न मिल्दैन।'
      );
      return;
    }

    if (!balanced) {
      setError('कुल Debit र कुल Credit बराबर हुनुपर्छ।');
      return;
    }

    if (
      validRows.some(
        r => !ledgerAccounts.some(a => a.id === Number(r.accountId))
      )
    ) {
      setError('कुनै account भेटिएन। Accounts पुनः load गर्नुहोस्।');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/journal-entries`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            organizationId: ORGANIZATION_ID,
            entryDate,
            voucherNumber: voucherNumber.trim(),
            description: description.trim(),
            lines: validRows.map(r => ({
              accountId: Number(r.accountId),
              debit: Number(r.debit) || 0,
              credit: Number(r.credit) || 0
            }))
          })
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
          data.error ||
          `Voucher save भएन (HTTP ${response.status})`
        );
      }

      const savedVoucherNumber = data.entry?.voucher_number || voucherNumber.trim();
      await loadJournalEntries();

      onVoucherSaved?.({
        date: entryDate,
        ref: savedVoucherNumber,
        description: description.trim(),
        category: 'Journal Voucher',
        method: 'Journal',
        amount: money(totalDebit),
        positive: true
      });

      setSuccess(`Journal Voucher ${savedVoucherNumber} सफलतापूर्वक सुरक्षित भयो!`);
      setDescription('');
      setRows([
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' }
      ]);
      await loadNextVoucherNumber(entryDate);
    } catch (e) {
      console.error('Journal voucher save error:', e);
      setError(
        e.message || 'Journal Voucher save गर्दा समस्या आयो।'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={styles.pageHeading}>
        <div>
          <div style={styles.eyebrow}>
            लेखा व्यवस्थापन / Accounting
          </div>
          <h1 style={styles.h1}>Journal Voucher Entry</h1>
          <p style={styles.subtitle}>
            दोहोरो लेखा प्रणाली (Double-entry) अनुसार भौचर प्रविष्टि गर्नुहोस्।
          </p>
        </div>
      </div>

      <section style={styles.panel}>
        <form onSubmit={saveVoucher}>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Voucher No. / भौचर नं.
              <input
                style={styles.input}
                value={voucherNumberLoading ? 'भौचर नम्बर लोड हुँदैछ...' : voucherNumber}
                readOnly
                required
                aria-label="Automatically generated voucher number"
              />
              <small style={{ color: '#64748b', fontSize: '11px' }}>
                भौचर नम्बर स्वतः क्रमअनुसार बनाइन्छ।
              </small>
              {voucherNumberError && <small style={styles.error}>{voucherNumberError}</small>}
            </label>

            <label style={styles.label}>
              Date / नेपाली मिति (वि.सं.)
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...styles.input, paddingLeft: '36px' }}
                  type="text"
                  value={bsDate}
                  onChange={e => changeDate(e.target.value)}
                  placeholder="2083-07-10"
                  pattern="[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}"
                  required
                />
                <CalendarDays size={18} color="#64748b" style={{ position: 'absolute', left: '10px', top: '12px' }} />
              </div>
              <small style={{ color: '#64748b', fontSize: '11px' }}>AD date equivalent: {entryDate}</small>
            </label>
          </div>

          <label style={styles.label}>
            Narration / कारोबारको विवरण
            <input
              style={styles.input}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="कारोबारको स्पष्ट विवरण यहाँ लेख्नुहोस्..."
              required
            />
          </label>

          <div style={{ ...styles.panelHeading, marginTop: '24px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#1e293b' }}>Entry Details / खाता पङ्क्तिहरू</h3>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                हरेक row मा उपयुक्त Account छान्नुहोस् र Debit वा Credit रकम प्रविष्ट गर्नुहोस्।
              </p>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={addRow}
            >
              <Plus size={15} /> Add Row
            </button>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '50px' }}>S.N.</th>
                  <th>Account Head / खाताको नाम</th>
                  <th style={{ width: '180px' }}>Debit / डेबिट (Rs.)</th>
                  <th style={{ width: '180px' }}>Credit / क्रेडिट (Rs.)</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 600, color: '#64748b' }}>{index + 1}</td>

                    <td>
                      <select
                        style={styles.selectInput}
                        value={row.accountId}
                        onChange={e =>
                          updateRow(
                            index,
                            'accountId',
                            e.target.value
                          )
                        }
                      >
                        <option value="">-- खाता छान्नुहोस् --</option>
                        {ledgerAccounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                    </td>

                    <td>
                      <input
                        style={styles.input}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.debit}
                        onChange={e =>
                          updateRow(index, 'debit', e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </td>

                    <td>
                      <input
                        style={styles.input}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.credit}
                        onChange={e =>
                          updateRow(index, 'credit', e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        style={rows.length <= 2 ? styles.disabledDangerButton : styles.dangerButton}
                        disabled={rows.length <= 2}
                        onClick={() => removeRow(index)}
                        title="Remove row"
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <th colSpan="2" style={{ textAlign: 'right', paddingRight: '16px' }}>Total / जम्मा:</th>
                  <th style={{ color: '#0f172a', fontSize: '14px' }}>{money(totalDebit)}</th>
                  <th style={{ color: '#0f172a', fontSize: '14px' }}>{money(totalCredit)}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div
            style={{
              ...styles.balanceStatus,
              color: balanced ? '#065f46' : '#92400e',
              background: balanced ? '#ecfdf5' : '#fffbeb',
              borderColor: balanced ? '#a7f3d0' : '#fde68a'
            }}
          >
            {balanced
              ? <CheckCircle2 size={18} color="#059669" />
              : <AlertCircle size={18} color="#d97706" />}

            <span>
              {balanced
                ? 'मापदण्ड मिल्दोजुल्दो छ: Debit र Credit बराबर छन् (Balanced)।'
                : 'सन्तुलन मिलेको छैन: कुल Debit र कुल Credit रकम बराबर हुनुपर्छ।'}
            </span>
          </div>

          {error && <Notice type="error" message={error} />}
          {success && <Notice type="success" message={success} />}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              type="submit"
              style={{
                ...styles.primaryButton,
                opacity: (saving || !balanced) ? 0.6 : 1,
                cursor: (saving || !balanced) ? 'not-allowed' : 'pointer'
              }}
              disabled={saving || !balanced}
            >
              {saving ? 'सुरक्षित गर्दै...' : 'Save Voucher / भौचर सुरक्षित गर्नुहोस्'}
            </button>
          </div>
        </form>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeading}>
          <div>
            <h2 style={styles.panelTitle}>Saved Journal Vouchers / सुरक्षित भौचरहरूको सूची</h2>
            <p style={styles.panelDesc}>
              डेटाबेसमा हालसम्म रेकर्ड गरिएका भौचरहरूको विवरण।
            </p>
          </div>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={loadJournalEntries}
            disabled={loadingEntries}
          >
            <RefreshCw size={15} />
            {loadingEntries ? 'Loading...' : 'Reload List'}
          </button>
        </div>

        {loadingEntries && (
          <Notice message="Saved journal entries load हुँदैछन्..." />
        )}

        {registerError && (
          <Notice type="error" message={registerError} />
        )}

        {!loadingEntries && !registerError && (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Voucher No.</th>
                  <th>Type</th>
                  <th>Description / विवरण</th>
                  <th>Debit (Rs.)</th>
                  <th>Credit (Rs.)</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {journalEntries.map(entry => (
                  <tr key={entry.id}>
                    <td>
                      <span style={styles.dateBadge}>{toBS(String(entry.entry_date || '').slice(0, 10)) || '-' } BS</span>
                      <small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>
                        {String(entry.entry_date || '').slice(0, 10)} AD
                      </small>
                    </td>
                    <td><strong>{entry.voucher_number}</strong></td>
                    <td><span style={styles.typeBadge}>{entry.voucher_type}</span></td>
                    <td>{entry.description}</td>
                    <td>{money(Number(entry.total_debit) || 0)}</td>
                    <td>{money(Number(entry.total_credit) || 0)}</td>
                    <td>
                      <span style={styles.statusBadge}>
                        {entry.status || 'Posted'}
                      </span>
                    </td>
                  </tr>
                ))}

                {journalEntries.length === 0 && (
                  <tr>
                    <td colSpan="7" style={styles.emptyCell}>
                      अहिलेसम्म कुनै Journal Voucher रेकर्ड गरिएको छैन।
                    </td>
                  </tr>
                )}
              </tbody>

              {journalEntries.length > 0 && (
                <tfoot>
                  <tr>
                    <th colSpan="4" style={{ textAlign: 'right' }}>Total / जम्मा:</th>
                    <th>
                      {money(
                        journalEntries.reduce(
                          (sum, entry) =>
                            sum + (Number(entry.total_debit) || 0),
                          0
                        )
                      )}
                    </th>
                    <th>
                      {money(
                        journalEntries.reduce(
                          (sum, entry) =>
                            sum + (Number(entry.total_credit) || 0),
                          0
                        )
                      )}
                    </th>
                    <th></th>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ChartOfAccounts({ accounts, loading, error, onReload }) {
  const [query, setQuery] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountType, setAccountType] = useState('asset');
  const [isGroup, setIsGroup] = useState(true);
  const [parentId, setParentId] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);
  const [formNotice, setFormNotice] = useState({ type: '', message: '' });

  const groups = accounts.filter(a => a.isGroup && a.isActive !== false);
  const filtered = accounts.filter(a =>
    `${a.code} ${a.name} ${a.type} ${a.parentName} ${a.isGroup ? 'group समूह' : 'ledger लेजर'}`
      .toLowerCase()
      .includes(query.toLowerCase())
  );

  async function createAccount(e) {
    e.preventDefault();
    setFormNotice({ type: '', message: '' });

    if (!accountCode.trim() || !accountName.trim()) {
      setFormNotice({ type: 'error', message: 'Account Code र Account Name दुवै भर्नुहोस्।' });
      return;
    }

    if (!isGroup && !parentId) {
      setFormNotice({ type: 'error', message: 'Ledger बनाउन Under Group छान्नुहोस्।' });
      return;
    }

    setSavingAccount(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          accountCode: accountCode.trim(),
          accountName: accountName.trim(),
          accountType,
          isGroup,
          parentId: isGroup ? null : Number(parentId)
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || 'Account बनाउन सकिएन।');
      }

      setFormNotice({
        type: 'success',
        message: isGroup
          ? 'Account Group सफलतापूर्वक बन्यो।'
          : 'Ledger सफलतापूर्वक बन्यो। यो Journal Voucher को account list मा उपलब्ध हुनेछ।'
      });
      setAccountCode('');
      setAccountName('');
      setParentId('');
      await onReload?.();
    } catch (e) {
      console.error('Create account error:', e);
      setFormNotice({ type: 'error', message: e.message || 'Account बनाउन समस्या आयो।' });
    } finally {
      setSavingAccount(false);
    }
  }

  return (
    <div>
      <div style={styles.pageHeading}>
        <div>
          <div style={styles.eyebrow}>Accounting / लेखा व्यवस्थापन</div>
          <h1 style={styles.h1}>Chart of Accounts</h1>
          <p style={styles.subtitle}>पहिले Group बनाउनुहोस्, त्यसपछि सो Group अन्तर्गत Ledger खाता बनाउनुहोस्।</p>
        </div>
        <button style={styles.secondaryButton} onClick={onReload} type="button">
          <RefreshCw size={15} /> Reload Accounts
        </button>
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeading}>
          <div>
            <h2 style={styles.panelTitle}>Create Account Group / Ledger</h2>
            <p style={styles.panelDesc}>बनाएको Ledger स्वतः Journal Voucher को account selection मा आउँछ।</p>
          </div>
        </div>

        <form onSubmit={createAccount}>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Account Type / खाता बनाउने प्रकार
              <select
                style={styles.selectInput}
                value={isGroup ? 'group' : 'ledger'}
                onChange={e => {
                  const groupMode = e.target.value === 'group';
                  setIsGroup(groupMode);
                  setParentId('');
                  setFormNotice({ type: '', message: '' });
                }}
              >
                <option value="group">Account Group / समूह</option>
                <option value="ledger">Ledger Account / लेजर खाता</option>
              </select>
            </label>

            <label style={styles.label}>
              Account Code / खाता कोड
              <input
                style={styles.input}
                value={accountCode}
                onChange={e => setAccountCode(e.target.value)}
                maxLength={30}
                placeholder="जस्तै: 1000"
                required
              />
            </label>

            <label style={styles.label}>
              Account Name / खाताको नाम
              <input
                style={styles.input}
                value={accountName}
                onChange={e => setAccountName(e.target.value)}
                maxLength={150}
                placeholder="जस्तै: Current Assets"
                required
              />
            </label>

            <label style={styles.label}>
              Account Category / खाता वर्ग
              <select
                style={styles.selectInput}
                value={accountType}
                onChange={e => setAccountType(e.target.value)}
                required
              >
                <option value="asset">Asset / सम्पत्ति</option>
                <option value="liability">Liability / दायित्व</option>
                <option value="equity">Equity / पूँजी</option>
                <option value="income">Income / आम्दानी</option>
                <option value="expense">Expense / खर्च</option>
              </select>
            </label>

            {!isGroup && (
              <label style={styles.label}>
                Under Group / कुन समूह अन्तर्गत?
                <select
                  style={styles.selectInput}
                  value={parentId}
                  onChange={e => setParentId(e.target.value)}
                  required
                >
                  <option value="">-- Group छान्नुहोस् --</option>
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.code} - {group.name}
                    </option>
                  ))}
                </select>
                {groups.length === 0 && (
                  <small style={styles.error}>पहिले कम्तीमा एउटा Account Group बनाउनुहोस्।</small>
                )}
              </label>
            )}
          </div>

          {formNotice.message && (
            <Notice
              type={formNotice.type === 'error' ? 'error' : 'info'}
              message={formNotice.message}
            />
          )}

          <button
            type="submit"
            style={{ ...styles.primaryButton, opacity: savingAccount ? 0.65 : 1 }}
            disabled={savingAccount || (!isGroup && groups.length === 0)}
          >
            <Plus size={16} />
            {savingAccount ? 'Saving...' : isGroup ? 'Create Group / समूह बनाउनुहोस्' : 'Create Ledger / लेजर बनाउनुहोस्'}
          </button>
        </form>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHeading}>
          <div>
            <h2 style={styles.panelTitle}>Accounts List / खाताहरूको सूची</h2>
            <p style={styles.panelDesc}>Group र त्यसअन्तर्गतका Ledger खाताहरू हेर्नुहोस्।</p>
          </div>
        </div>

        <div style={{ marginBottom: '16px', maxWidth: '400px' }}>
          <input
            style={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="खाता कोड, नाम वा समूहद्वारा खोज्नुहोस्..."
          />
        </div>

        {loading && <Notice message="Accounts लोड हुँदैछन्..." />}
        {error && <Notice type="error" message={error} />}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Code</th>
                <th>Account Name / खाताको नाम</th>
                <th>Under Group / समूह</th>
                <th style={{ width: '160px' }}>Account Type</th>
                <th style={{ width: '180px', textAlign: 'right' }}>Balance / मौज्दात</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td><strong style={{ color: '#4f46e5' }}>{a.code}</strong></td>
                  <td>
                    <span style={{ fontWeight: 500, color: '#1e293b' }}>
                      {a.isGroup ? '▸ ' : '↳ '}{a.name}
                    </span>
                  </td>
                  <td>{a.isGroup ? '—' : (a.parentName || '—')}</td>
                  <td>
                    <span style={styles.typeBadge}>
                      {a.isGroup ? 'Group' : a.type}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {money(a.balance)}
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="5" style={styles.emptyCell}>
                    तपाईंले खोज्नुभएको खाता फेला परेन।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FinancialReports({ accounts }) {
  const [report, setReport] = useState('trial');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [ledgerRows, setLedgerRows] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState('');
  const [trialAccounts, setTrialAccounts] = useState([]);
  const [trialTotals, setTrialTotals] = useState({ debit: 0, credit: 0 });
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialError, setTrialError] = useState('');

  const ledgerAccounts = accounts.filter(a => !a.isGroup && a.isActive !== false);
  const income = ledgerAccounts.filter(a => /income/i.test(a.type));
  const expenses = ledgerAccounts.filter(a => /expense/i.test(a.type));

  const totalIncome = income.reduce(
    (sum, a) => sum + Number(a.balance || 0), 0
  );
  const totalExpenses = expenses.reduce(
    (sum, a) => sum + Number(a.balance || 0), 0
  );

  useEffect(() => {
    if (report !== 'trial') return undefined;
    let cancelled = false;

    async function loadTrialBalance() {
      setTrialLoading(true);
      setTrialError('');
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/reports/trial-balance?organizationId=${ORGANIZATION_ID}`
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || 'Trial Balance load गर्न सकिएन।');
        }
        if (!Array.isArray(data.accounts)) {
          throw new Error('Trial Balance API बाट सही data आएन।');
        }
        if (!cancelled) {
          setTrialAccounts(data.accounts);
          setTrialTotals(data.totals || { debit: 0, credit: 0 });
        }
      } catch (err) {
        if (!cancelled) {
          setTrialAccounts([]);
          setTrialTotals({ debit: 0, credit: 0 });
          setTrialError(err.message || 'Trial Balance लोड गर्दा समस्या आयो।');
        }
      } finally {
        if (!cancelled) setTrialLoading(false);
      }
    }

    loadTrialBalance();
    return () => { cancelled = true; };
  }, [report]);

  useEffect(() => {
    if (report !== 'ledger' || !selectedAccountId) {
      setLedgerRows([]);
      setLedgerError('');
      setLedgerLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function loadLedger() {
      setLedgerLoading(true);
      setLedgerError('');

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/ledger?organizationId=${ORGANIZATION_ID}&accountId=${encodeURIComponent(selectedAccountId)}`
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.message || 'Ledger load गर्न सकिएन।');
        }
        if (!Array.isArray(data)) {
          throw new Error('Ledger API बाट सही data आएन।');
        }

        if (!cancelled) setLedgerRows(data);
      } catch (err) {
        if (!cancelled) {
          setLedgerRows([]);
          setLedgerError(err.message || 'Ledger load गर्दा समस्या आयो।');
        }
      } finally {
        if (!cancelled) setLedgerLoading(false);
      }
    }

    loadLedger();

    return () => {
      cancelled = true;
    };
  }, [report, selectedAccountId]);

  function printReport() {
    window.print();
  }

  return (
    <div>
      <div style={styles.pageHeading}>
        <div>
          <div style={styles.eyebrow}>Reports / प्रतिवेदन</div>
          <h1 style={styles.h1}>Financial Reports</h1>
          <p style={styles.subtitle}>विद्यालयको वित्तीय तथा लेखा परीक्षण प्रतिवेदनहरू।</p>
        </div>
        <button style={styles.primaryButton} onClick={printReport}>
          <Printer size={15} /> Print Report
        </button>
      </div>

      <div style={styles.reportTabs}>
        {[
          ['trial', 'Trial Balance'],
          ['income', 'Income & Expenditure'],
          ['ledger', 'Account Ledger']
        ].map(([key, label]) => (
          <button
            key={key}
            style={{
              ...styles.reportTab,
              ...(report === key ? styles.reportTabActive : {})
            }}
            onClick={() => setReport(key)}
          >
            <FileText size={16} /> {label}
          </button>
        ))}
      </div>

      <section style={styles.panel}>
        <h2 style={{ ...styles.panelTitle, marginBottom: '16px' }}>
          {report === 'trial'
            ? 'Trial Balance / परीक्षण सन्तुलन'
            : report === 'income'
              ? 'Income & Expenditure / आम्दानी तथा खर्च विवरण'
              : 'Account Ledger / खाता बही विवरण'}
        </h2>

        {report === 'trial' && (
          <>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              Posted Journal Entries बाट खाताअनुसार Trial Balance गणना गरिएको छ।
            </p>
            {trialLoading && <Notice message="Trial Balance लोड हुँदैछ..." />}
            {trialError && <Notice type="error" message={trialError} />}
            {!trialLoading && !trialError && (
              <>
                <div style={styles.metricsGrid}>
                  <Metric
                    title="Total Debit Balance / कुल डेबिट"
                    value={money(trialTotals.debit)}
                    note="Ledger खाताहरूको डेबिट मौज्दात"
                    icon={<ArrowDownRight size={20} />}
                    color="#ff4fa3"
                    bg="#eef2ff"
                  />
                  <Metric
                    title="Total Credit Balance / कुल क्रेडिट"
                    value={money(trialTotals.credit)}
                    note="Ledger खाताहरूको क्रेडिट मौज्दात"
                    icon={<TrendingUp size={20} />}
                    color="#059669"
                    bg="#ecfdf5"
                  />
                </div>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Account Name</th>
                        <th>Under Group</th>
                        <th>Total Debit</th>
                        <th>Total Credit</th>
                        <th>Debit Balance</th>
                        <th>Credit Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialAccounts.map(a => (
                        <tr key={a.account_id}>
                          <td><strong>{a.account_code}</strong></td>
                          <td>{a.account_name}</td>
                          <td>{a.parent_name || '—'}</td>
                          <td>{money(a.total_debit)}</td>
                          <td>{money(a.total_credit)}</td>
                          <td>{money(a.debit_balance)}</td>
                          <td>{money(a.credit_balance)}</td>
                        </tr>
                      ))}
                      {trialAccounts.length === 0 && (
                        <tr>
                          <td colSpan="7" style={styles.emptyCell}>
                            Posted Journal Entries भएका Ledger खाताहरू भेटिएनन्।
                          </td>
                        </tr>
                      )}
                    </tbody>
                    {trialAccounts.length > 0 && (
                      <tfoot>
                        <tr>
                          <th colSpan="5" style={{ textAlign: 'right' }}>Total / जम्मा:</th>
                          <th>{money(trialTotals.debit)}</th>
                          <th>{money(trialTotals.credit)}</th>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </>
        )}

        {report === 'income' && (
          <>
            <div style={styles.metricsGrid}>
              <Metric
                title="Total Income / कुल आम्दानी"
                value={money(totalIncome)}
                note="उपलब्ध आम्दानी खाताहरू"
                icon={<TrendingUp size={20} />}
                color="#059669"
                bg="#ecfdf5"
              />
              <Metric
                title="Total Expenses / कुल खर्च"
                value={money(totalExpenses)}
                note="उपलब्ध खर्च खाताहरू"
                icon={<ArrowDownRight size={20} />}
                color="#dc2626"
                bg="#fef2f2"
              />
              <Metric
                title="Net Balance / बचत वा घाटा"
                value={money(totalIncome - totalExpenses)}
                note="आम्दानी - खर्च"
                icon={<ChartNoAxesCombined size={20} />}
                color="#ff4fa3"
                bg="#eef2ff"
              />
            </div>

            <h3 style={{ fontSize: '15px', color: '#1e293b', margin: '20px 0 10px' }}>आम्दानी खाताहरू (Income Accounts)</h3>
            <ReportAccountTable accounts={income} />

            <h3 style={{ fontSize: '15px', color: '#1e293b', margin: '24px 0 10px' }}>खर्च खाताहरू (Expense Accounts)</h3>
            <ReportAccountTable accounts={expenses} />
          </>
        )}

        {report === 'ledger' && (
          <>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '16px' }}>
              Journal Voucher बाट पोस्ट भएका विस्तृत कारोबार हेर्न तलबाट खाता छान्नुहोस्।
            </p>

            <div style={{ maxWidth: '400px', marginBottom: '20px' }}>
              <label style={styles.label}>
                Account Selection / खाता छान्नुहोस्
                <select
                  style={styles.selectInput}
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                >
                  <option value="">-- खाता छान्नुहोस् --</option>
                  {ledgerAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {ledgerLoading && <Notice message="Ledger लोड हुँदैछ..." />}
            {ledgerError && <Notice type="error" message={ledgerError} />}

            {!ledgerLoading && !ledgerError && selectedAccountId && (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Voucher No.</th>
                      <th>Description / विवरण</th>
                      <th>Debit</th>
                      <th>Credit</th>
                      <th style={{ textAlign: 'right' }}>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((row, index) => {
                      const balance = Number(row.running_balance) || 0;
                      return (
                        <tr key={`${row.journal_entry_id}-${index}`}>
                          <td>
                            <span style={styles.dateBadge}>{toBS(String(row.entry_date || '').slice(0, 10)) || '-'} BS</span>
                            <small style={{ display: 'block', color: '#64748b', marginTop: 4 }}>
                              {String(row.entry_date || '').slice(0, 10)} AD
                            </small>
                          </td>
                          <td><strong>{row.voucher_number}</strong></td>
                          <td>{row.description}</td>
                          <td>{money(Number(row.debit) || 0)}</td>
                          <td>{money(Number(row.credit) || 0)}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {money(Math.abs(balance))}
                            {balance > 0 ? ' Dr' : balance < 0 ? ' Cr' : ''}
                          </td>
                        </tr>
                      );
                    })}
                    {ledgerRows.length === 0 && (
                      <tr>
                        <td colSpan="6" style={styles.emptyCell}>
                          यस खातामा कुनै posted transaction भेटिएन।
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {ledgerRows.length > 0 && (
                    <tfoot>
                      <tr>
                        <th colSpan="3" style={{ textAlign: 'right' }}>Total / जम्मा:</th>
                        <th>{money(ledgerRows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0))}</th>
                        <th>{money(ledgerRows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0))}</th>
                        <th style={{ textAlign: 'right' }}>
                          {(() => {
                            const finalBalance = Number(ledgerRows[ledgerRows.length - 1].running_balance) || 0;
                            return `${money(Math.abs(finalBalance))}${finalBalance > 0 ? ' Dr' : finalBalance < 0 ? ' Cr' : ''}`;
                          })()}
                        </th>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {!selectedAccountId && (
              <Notice message="कृपया Ledger प्रतिवेदन हेर्न माथिको ड्रपडाउनबाट एउटा Account छान्नुहोस्।" />
            )}
          </>
        )}
      </section>
    </div>
  );
}

function ReportAccountTable({ accounts }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ width: '120px' }}>Code</th>
            <th>Account / खाताको नाम</th>
            <th style={{ width: '180px', textAlign: 'right' }}>Balance / मौज्दात</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <td><strong>{a.code}</strong></td>
              <td>{a.name}</td>
              <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(a.balance)}</td>
            </tr>
          ))}
          {!accounts.length && (
            <tr><td colSpan="3" style={styles.emptyCell}>
              कुनै data उपलब्ध छैन।
            </td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDateAD(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function printStudentReceipt(receipt) {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const win = window.open('', '_blank', 'width=800,height=900');
  if (!win) {
    window.alert('Receipt print गर्न browser मा pop-up अनुमति दिनुहोस्।');
    return;
  }
  const dateAD = formatDateAD(receipt.receipt_date);
  const dateBS = toBS(dateAD);
  win.document.write(`<!doctype html><html><head><title>Receipt ${escapeHtml(receipt.receipt_number)}</title>
    <meta charset="utf-8"><style>
    body{font-family:Arial,sans-serif;color:#111827;padding:28px;max-width:760px;margin:auto}
    .top{text-align:center;border-bottom:2px solid #111827;padding-bottom:14px;margin-bottom:18px}
    h1{font-size:23px;margin:0 0 6px}.muted{color:#475569;font-size:12px}
    .row{display:flex;justify-content:space-between;gap:16px;margin:8px 0}
    table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border:1px solid #cbd5e1;padding:10px;text-align:left}
    .amount{text-align:right}.paid{text-align:right;font-size:20px;font-weight:bold;margin-top:24px}
    .foot{display:flex;justify-content:space-between;margin-top:70px}.signature{border-top:1px solid #475569;width:180px;text-align:center;padding-top:8px;font-size:12px}
    @media print{button{display:none}body{padding:0}}
    </style></head><body>
    <div class="top"><h1>United English Boarding School</h1><div>Student Fee Receipt / विद्यार्थी शुल्क रसिद</div></div>
    <div class="row"><span><b>Receipt No:</b> ${escapeHtml(receipt.receipt_number)}</span><span><b>Date (BS):</b> ${escapeHtml(dateBS)}</span></div>
    <div class="row"><span><b>Date (AD):</b> ${escapeHtml(dateAD)}</span><span><b>Bill No:</b> ${escapeHtml(receipt.bill_number)}</span></div>
    <div class="row"><span><b>Student:</b> ${escapeHtml(receipt.student_name)}</span><span><b>Reg No:</b> ${escapeHtml(receipt.reg_no || receipt.admission_no)}</span></div>
    <div class="row"><span><b>Class/Section:</b> ${escapeHtml(receipt.class_name)} / ${escapeHtml(receipt.section)}</span><span><b>Roll No:</b> ${escapeHtml(receipt.roll_number)}</span></div>
    <table><thead><tr><th>Payment Details</th><th>Mode</th><th>Paid To</th><th class="amount">Amount</th></tr></thead>
    <tbody><tr><td>Student fee collection</td><td>${escapeHtml(String(receipt.payment_method || '').toUpperCase())}</td><td>${escapeHtml(receipt.payment_account_name)}</td><td class="amount">${money(receipt.total_amount)}</td></tr></tbody></table>
    <div class="paid">Received: ${money(receipt.total_amount)}</div>
    ${receipt.notes ? `<p><b>Remarks:</b> ${escapeHtml(receipt.notes)}</p>` : ''}
    <div class="foot"><div class="signature">Student / Guardian</div><div class="signature">Authorized Signature</div></div>
    <p class="muted" style="text-align:center;margin-top:30px">This receipt is generated by the school accounting system.</p>
    <script>window.onload=()=>window.print();</script></body></html>`);
  win.document.close();
}

function StudentFees({ accounts, onRefreshAccounts }) {
  const [tab, setTab] = useState('Students');
  const [students, setStudents] = useState([]);
  const [feeTitles, setFeeTitles] = useState([]);
  const [bills, setBills] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [ledger, setLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastReceipt, setLastReceipt] = useState(null);

  const [regNo, setRegNo] = useState('');
  const [studentName, setStudentName] = useState('');
  const [className, setClassName] = useState('');
  const [section, setSection] = useState('A');
  const [rollNumber, setRollNumber] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');

  const [titleCode, setTitleCode] = useState('TUITION');
  const [titleName, setTitleName] = useState('Tuition Fee');
  const [incomeAccountId, setIncomeAccountId] = useState('');
  const [defaultAmount, setDefaultAmount] = useState('');
  const [isMonthly, setIsMonthly] = useState(true);

  const [billStudentId, setBillStudentId] = useState('');
  const [billMonthBS, setBillMonthBS] = useState(() => (toBS(getTodayAD()) || '2083-01-01').slice(0, 7));
  const [billDueDateBS, setBillDueDateBS] = useState('');
  const [selectedBillItems, setSelectedBillItems] = useState([]);
  const [selectedBillFilterMonth, setSelectedBillFilterMonth] = useState('');

  const [receiptBillId, setReceiptBillId] = useState('');
  const [receiptDate, setReceiptDate] = useState(getTodayAD());
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptNumberPreview, setReceiptNumberPreview] = useState('');

  const [ledgerStudentId, setLedgerStudentId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentImportRows, setStudentImportRows] = useState([]);
  const [studentImportFileName, setStudentImportFileName] = useState('');
  const [studentImportError, setStudentImportError] = useState('');
  const [studentImportSummary, setStudentImportSummary] = useState(null);
  const [studentImporting, setStudentImporting] = useState(false);
  const [dobBs, setDobBs] = useState('');
  const [gender, setGender] = useState('');
  const [address, setAddress] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [profileStudentId, setProfileStudentId] = useState('');
  const [profileData, setProfileData] = useState(null);
  const [profileTab, setProfileTab] = useState('Profile Summary');
  const [profileForm, setProfileForm] = useState({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [transportForm, setTransportForm] = useState({ busRouteNo: '', stopName: '', driverContact: '', pickupTime: '', dropTime: '', busFee: '' });
  const [disciplineForm, setDisciplineForm] = useState({ incidentDate: getTodayAD(), category: 'positive', title: '', description: '', actionReport: '' });
  const [remarkForm, setRemarkForm] = useState({ remarkDate: getTodayAD(), terminalRemarks: '', academicFeedback: '', parentCommunication: '' });
  const [feeDashboardPeriod, setFeeDashboardPeriod] = useState('daily');
  const [feeDashboardFrom, setFeeDashboardFrom] = useState(getTodayAD());
  const [feeDashboardTo, setFeeDashboardTo] = useState(getTodayAD());
  const [feeDashboardFromBS, setFeeDashboardFromBS] = useState(toNepaliDigits(toBS(getTodayAD())));
  const [feeDashboardToBS, setFeeDashboardToBS] = useState(toNepaliDigits(toBS(getTodayAD())));
  const [feeDashboardData, setFeeDashboardData] = useState(null);
  const [feeDashboardLoading, setFeeDashboardLoading] = useState(false);
  const [feeDashboardError, setFeeDashboardError] = useState('');
  const [feeDashboardPaymentSearch, setFeeDashboardPaymentSearch] = useState('');
  const [feeDashboardOutstandingSearch, setFeeDashboardOutstandingSearch] = useState('');
  const [feeDashboardClass, setFeeDashboardClass] = useState('');
  const [feeDashboardPaymentMode, setFeeDashboardPaymentMode] = useState('');
  const [feeDashboardRefreshKey, setFeeDashboardRefreshKey] = useState(0);

  async function request(path, options = {}) {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || data.error || `Request failed (${response.status})`);
    return data;
  }

  async function reloadAll() {
    setLoading(true);
    setError('');
    try {
      const [studentData, titleData, billData, receiptData] = await Promise.all([
        request(`/api/fee/students?organizationId=${ORGANIZATION_ID}`),
        request(`/api/fee/titles?organizationId=${ORGANIZATION_ID}`),
        request(`/api/fee/bills?organizationId=${ORGANIZATION_ID}`),
        request(`/api/fee/receipts?organizationId=${ORGANIZATION_ID}`)
      ]);
      setStudents(Array.isArray(studentData) ? studentData : []);
      setFeeTitles(Array.isArray(titleData) ? titleData : []);
      setBills(Array.isArray(billData) ? billData : []);
      setReceipts(Array.isArray(receiptData) ? receiptData : []);
      setBillStudentId(current => current || (studentData[0] ? String(studentData[0].id) : ''));
      setLedgerStudentId(current => current || (studentData[0] ? String(studentData[0].id) : ''));
      setIncomeAccountId(current => current || String((accounts.find(a => a.type === 'income' && !a.isGroup && a.isActive !== false) || {}).id || ''));
      setPaymentAccountId(current => current || String((accounts.find(a => a.type === 'asset' && !a.isGroup && a.isActive !== false) || {}).id || ''));
    } catch (e) {
      setError(`${e.message}. Student Fee tables तयार छन् कि जाँच गर्नुहोस्; आवश्यक भए student_fee_module_migration.sql चलाउनुहोस्।`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reloadAll(); }, []);

  // Preselect active monthly fee titles using their default rates. The user can
  // still uncheck a title or edit its amount before generating a batch.
  useEffect(() => {
    if (!feeTitles.length) return;
    setSelectedBillItems(current => {
      if (current.length) return current;
      return feeTitles
        .filter(title => title.is_active !== false && title.is_monthly && Number(title.default_amount) > 0)
        .map(title => ({ feeTitleId: Number(title.id), amount: String(title.default_amount) }));
    });
  }, [feeTitles]);

  const incomeAccounts = accounts.filter(a => a.type === 'income' && !a.isGroup && a.isActive !== false);
  const assetAccounts = accounts.filter(a => a.type === 'asset' && !a.isGroup && a.isActive !== false);
  const matchingPaymentAccounts = assetAccounts.filter(a => paymentMethod === 'cash'
    ? /cash|petty|नगद/i.test(`${a.code} ${a.name}`)
    : /bank|बैंक|saving|current/i.test(`${a.code} ${a.name}`));
  const displayedPaymentAccounts = matchingPaymentAccounts.length ? matchingPaymentAccounts : assetAccounts;
  const activeStudents = students.filter(s => s.is_active !== false);
  const billStudent = students.find(s => String(s.id) === String(billStudentId));
  const selectedBill = bills.find(b => String(b.id) === String(receiptBillId));
  const outstandingBills = bills.filter(b => Number(b.balance_due) > 0 && b.status !== 'cancelled');
  const filteredStudents = students.filter(s => !studentSearch ||
    `${(s.reg_no || s.admission_no)} ${s.student_name} ${s.class_name} ${s.section} ${s.roll_number}`
      .toLowerCase().includes(studentSearch.toLowerCase()));
  const selectedBillTotal = selectedBillItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const todayBSMonth = (toBS(getTodayAD()) || '2083-01-01').slice(0, 7);
  const currentBSYear = Number(todayBSMonth.slice(0, 4)) || 2083;
  const bsYearOptions = Array.from({ length: 16 }, (_, index) => currentBSYear - 10 + index);
  const normalizedBillMonthBS = normalizeDateDigits(billMonthBS).trim();
  const [billMonthYearPart = String(currentBSYear), billMonthNumberPart = '01'] = normalizedBillMonthBS.split('-');
  const billMonthRange = getBSMonthRange(normalizedBillMonthBS);
  const billMonthAD = billMonthRange?.start || '';
  const filteredBills = bills.filter(b => {
    if (!selectedBillFilterMonth) return true;
    return (toBS(String(b.fee_month).slice(0, 10)) || '').slice(0, 7) === selectedBillFilterMonth;
  });

  const feeDashboardPayments = (feeDashboardData?.payments || []).filter(payment => {
    const searchText = `${payment.receipt_number || ''} ${payment.student_name || ''} ${payment.reg_no || payment.admission_no || ''} ${payment.guardian_name || ''} ${payment.guardian_phone || ''}`.toLowerCase();
    const matchesSearch = !feeDashboardPaymentSearch || searchText.includes(feeDashboardPaymentSearch.toLowerCase());
    const matchesClass = !feeDashboardClass || `${payment.class_name}-${payment.section}` === feeDashboardClass;
    const matchesMode = !feeDashboardPaymentMode || payment.payment_method === feeDashboardPaymentMode;
    return matchesSearch && matchesClass && matchesMode;
  });
  const feeDashboardOutstanding = (feeDashboardData?.outstanding || []).filter(student => {
    const searchText = `${student.student_name || ''} ${student.reg_no || student.admission_no || ''} ${student.guardian_name || ''} ${student.guardian_phone || ''} ${student.class_name || ''} ${student.section || ''}`.toLowerCase();
    const matchesSearch = !feeDashboardOutstandingSearch || searchText.includes(feeDashboardOutstandingSearch.toLowerCase());
    const matchesClass = !feeDashboardClass || `${student.class_name}-${student.section}` === feeDashboardClass;
    return matchesSearch && matchesClass;
  });
  const feeDashboardClassOptions = Array.from(new Set([
    ...(feeDashboardData?.classSummary || []).map(row => `${row.class_name}-${row.section}`),
    ...(feeDashboardData?.outstanding || []).map(row => `${row.class_name}-${row.section}`)
  ])).filter(Boolean).sort();

  useEffect(() => {
    if (incomeAccounts.length && !incomeAccounts.some(a => String(a.id) === String(incomeAccountId))) {
      setIncomeAccountId(String(incomeAccounts[0].id));
    }
  }, [accounts]);

  useEffect(() => {
    if (displayedPaymentAccounts.length && !displayedPaymentAccounts.some(a => String(a.id) === String(paymentAccountId))) {
      setPaymentAccountId(String(displayedPaymentAccounts[0].id));
    }
  }, [paymentMethod, accounts]);

  useEffect(() => {
    if (!receiptBillId && outstandingBills.length) {
      setReceiptBillId(String(outstandingBills[0].id));
      setReceiptAmount(String(outstandingBills[0].balance_due));
    }
  }, [bills]);

  useEffect(() => {
    if (tab !== 'Receive Fee') return;
    let cancelled = false;
    request(`/api/fee/next-receipt-number?organizationId=${ORGANIZATION_ID}`)
      .then(data => { if (!cancelled) setReceiptNumberPreview(data.receiptNumber || ''); })
      .catch(() => { if (!cancelled) setReceiptNumberPreview('Server ले save गर्दा generate गर्नेछ'); });
    return () => { cancelled = true; };
  }, [tab, receipts.length]);

  useEffect(() => {
    if (tab !== 'Fee Dashboard') return;
    const startDate = fromBS(feeDashboardFromBS);
    const endDate = fromBS(feeDashboardToBS);
    // While a user is typing a BS date, do not send the previous/partial value to the API.
    if (!startDate || !endDate) {
      setFeeDashboardData(null);
      setFeeDashboardLoading(false);
      setFeeDashboardError('कृपया सुरु र अन्तिम मिति वि.सं. मा YYYY-MM-DD ढाँचामा पूरा लेख्नुहोस्।');
      return;
    }
    if (startDate > endDate) {
      setFeeDashboardError('सुरु मिति अन्तिम मितिभन्दा पछाडि हुन मिल्दैन।');
      setFeeDashboardData(null);
      return;
    }
    let cancelled = false;
    const daySpan = (new Date(`${endDate}T00:00:00Z`) - new Date(`${startDate}T00:00:00Z`)) / 86400000;
    const granularity = daySpan > 45 ? 'month' : 'day';
    setFeeDashboardLoading(true);
    setFeeDashboardError('');
    setFeeDashboardData(null);
    request(`/api/fee/dashboard?organizationId=${ORGANIZATION_ID}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&granularity=${granularity}`)
      .then(data => { if (!cancelled) setFeeDashboardData(data); })
      .catch(err => { if (!cancelled) setFeeDashboardError(err.message || 'Fee Dashboard load भएन।'); })
      .finally(() => { if (!cancelled) setFeeDashboardLoading(false); });
    return () => { cancelled = true; };
  }, [tab, feeDashboardFrom, feeDashboardTo, feeDashboardFromBS, feeDashboardToBS, feeDashboardRefreshKey]);

  async function loadStudentLedger(studentId = ledgerStudentId) {
    if (!studentId) {
      setLedger(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await request(`/api/fee/student-ledger?organizationId=${ORGANIZATION_ID}&studentId=${encodeURIComponent(studentId)}`);
      setLedger(data);
    } catch (e) {
      setError(e.message);
      setLedger(null);
    } finally {
      setLoading(false);
    }
  }

  function normalizeExcelHeader(value) {
    return String(value ?? '').toLowerCase().trim().replace(/[^a-z0-9\u0900-\u097f]/g, '');
  }

  function downloadStudentExcelTemplate() {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Reg No', 'Student Name', 'Class', 'Section', 'Roll Number', 'DOB (BS)', 'Gender', 'Address', 'Guardian Name', 'Guardian Phone', 'Photo URL']
    ]);
    sheet['!cols'] = [{ wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 30 }, { wch: 26 }, { wch: 18 }, { wch: 36 }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Students');
    XLSX.writeFile(workbook, 'student_import_template.xlsx');
  }

  async function handleStudentExcelSelect(event) {
    const file = event.target.files?.[0];
    setStudentImportError('');
    setStudentImportSummary(null);
    setStudentImportRows([]);
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error('Excel फाइलमा worksheet भेटिएन।');
      const sheetRows = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '', raw: false });
      if (!sheetRows.length) throw new Error('Excel sheet खाली छ।');

      const aliases = {
        regNo: ['regno', 'registrationno', 'registrationnumber', 'regnumber', 'studentregno', 'admissionno', 'admissionnumber', 'studentid', 'दर्तानम्बर', 'रजिष्ट्रेसननम्बर'],
        studentName: ['studentname', 'name', 'fullname', 'pupilname', 'विद्यार्थीकोनाम', 'विद्यार्थीकोपूरानाम'],
        className: ['class', 'classname', 'grade', 'कक्षा'],
        section: ['section', 'सेक्सन'],
        rollNumber: ['roll', 'rollno', 'rollnumber', 'rolnumber', 'रोलनम्बर', 'रोल'],
        dobBs: ['dobbs', 'dateofbirthbs', 'birthdatebs', 'dateofbirth', 'जन्ममिति', 'जन्ममितिविसं'],
        gender: ['gender', 'sex', 'लिङ्ग', 'लिंग'],
        address: ['address', 'permanentaddress', 'ठेगाना'],
        guardianName: ['guardianname', 'parentname', 'fathername', 'mothername', 'अभिभावककोनाम'],
        guardianPhone: ['guardianphone', 'parentphone', 'phone', 'contact', 'mobile', 'फोन', 'मोबाइल'],
        photoUrl: ['photourl', 'imageurl', 'photo', 'तस्बिरलिङ्क']
      };
      const normalizedKeys = Object.keys(sheetRows[0]).map(key => [key, normalizeExcelHeader(key)]);
      const foundHeaders = new Set(normalizedKeys.map(([, key]) => key));
      const requiredHeaders = [
        ['regNo', 'Reg No'], ['studentName', 'Student Name'], ['className', 'Class'],
        ['section', 'Section'], ['rollNumber', 'Roll Number']
      ];
      const missingHeaders = requiredHeaders.filter(([field]) => !aliases[field].some(alias => foundHeaders.has(normalizeExcelHeader(alias))));
      if (missingHeaders.length) {
        throw new Error(`यी आवश्यक column header भेटिएनन्: ${missingHeaders.map(([, label]) => label).join(', ')}. Template डाउनलोड गरेर सोही header प्रयोग गर्नुहोस्।`);
      }
      const readValue = (row, field) => {
        const wanted = new Set(aliases[field].map(normalizeExcelHeader));
        const key = Object.keys(row).find(candidate => wanted.has(normalizeExcelHeader(candidate)));
        return key == null ? '' : String(row[key] ?? '').trim();
      };
      const rows = sheetRows.map((row, index) => ({
        rowNumber: index + 2,
        regNo: readValue(row, 'regNo'),
        studentName: readValue(row, 'studentName'),
        className: readValue(row, 'className'),
        section: readValue(row, 'section'),
        rollNumber: readValue(row, 'rollNumber'),
        dobBs: readValue(row, 'dobBs'),
        gender: readValue(row, 'gender'),
        address: readValue(row, 'address'),
        guardianName: readValue(row, 'guardianName'),
        guardianPhone: readValue(row, 'guardianPhone'),
        photoUrl: readValue(row, 'photoUrl')
      })).filter(row => [row.regNo, row.studentName, row.className, row.section, row.rollNumber, row.dobBs, row.gender, row.address, row.guardianName, row.guardianPhone, row.photoUrl].some(Boolean));
      if (!rows.length) throw new Error('Header बाहेक import गर्न मिल्ने विद्यार्थी record भेटिएन।');
      if (rows.length > 1000) throw new Error('एकपटकमा बढीमा 1,000 विद्यार्थी मात्र import गर्नुहोस्। ठूलो फाइललाई भागमा विभाजन गर्नुहोस्।');
      setStudentImportRows(rows);
      setStudentImportFileName(file.name);
    } catch (e) {
      setStudentImportError(e.message || 'Excel फाइल पढ्न सकिएन।');
      setStudentImportFileName(file.name);
    } finally {
      // Permit selecting the same file again after correcting it.
      event.target.value = '';
    }
  }

  async function importStudentExcel() {
    if (!studentImportRows.length) return;
    setStudentImporting(true);
    setStudentImportError('');
    setStudentImportSummary(null);
    setSuccess('');
    try {
      const result = await request('/api/fee/students/import', {
        method: 'POST',
        body: JSON.stringify({ organizationId: ORGANIZATION_ID, students: studentImportRows })
      });
      setStudentImportSummary(result);
      setSuccess(`Excel import पूरा भयो: ${result.imported || 0} विद्यार्थी थपिए; ${result.skipped || 0} वटा duplicate/अमान्य record skip भए।`);
      await reloadAll();
    } catch (e) {
      setStudentImportError(e.message || 'Excel बाट विद्यार्थी import गर्न सकिएन।');
    } finally {
      setStudentImporting(false);
    }
  }

  async function openStudentProfile(studentOrId) {
    const student = typeof studentOrId === 'object' ? studentOrId : students.find(item => String(item.id) === String(studentOrId));
    const id = student?.id ?? studentOrId;
    if (!id) return;
    setProfileStudentId(String(id));
    setProfileLoading(true); setError(''); setSuccess('');
    try {
      const data = await request(`/api/fee/students/${encodeURIComponent(id)}/profile?organizationId=${ORGANIZATION_ID}`);
      setProfileData(data);
      setProfileForm({
        studentName: data.student.student_name || '', className: data.student.class_name || '',
        section: data.student.section || '', rollNumber: data.student.roll_number || '',
        guardianName: data.student.guardian_name || '', guardianPhone: data.student.guardian_phone || '',
        dobBs: data.student.dob_bs || '', gender: data.student.gender || '',
        address: data.student.address || '', photoUrl: data.student.photo_url || ''
      });
      setTransportForm({
        busRouteNo: data.transport?.bus_route_no || '', stopName: data.transport?.stop_name || '',
        driverContact: data.transport?.driver_contact || '', pickupTime: data.transport?.pickup_time || '',
        dropTime: data.transport?.drop_time || '', busFee: data.transport?.bus_fee ?? ''
      });
      setProfileTab('Profile Summary'); setTab('Student Profile');
    } catch (e) { setError(`Student Profile load भएन: ${e.message}`); }
    finally { setProfileLoading(false); }
  }

  async function refreshStudentProfile(studentId = profileStudentId) {
    if (!studentId) return;
    const data = await request(`/api/fee/students/${encodeURIComponent(studentId)}/profile?organizationId=${ORGANIZATION_ID}`);
    setProfileData(data);
    setProfileForm(current => ({ ...current,
      studentName: data.student.student_name || '', className: data.student.class_name || '',
      section: data.student.section || '', rollNumber: data.student.roll_number || '',
      guardianName: data.student.guardian_name || '', guardianPhone: data.student.guardian_phone || '',
      dobBs: data.student.dob_bs || '', gender: data.student.gender || '',
      address: data.student.address || '', photoUrl: data.student.photo_url || ''
    }));
    setTransportForm({ busRouteNo: data.transport?.bus_route_no || '', stopName: data.transport?.stop_name || '',
      driverContact: data.transport?.driver_contact || '', pickupTime: data.transport?.pickup_time || '',
      dropTime: data.transport?.drop_time || '', busFee: data.transport?.bus_fee ?? '' });
    await reloadAll();
  }

  async function saveStudentProfile(event) {
    event.preventDefault(); if (!profileStudentId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const result = await request(`/api/fee/students/${encodeURIComponent(profileStudentId)}/profile?organizationId=${ORGANIZATION_ID}`, {
        method: 'PATCH', body: JSON.stringify({ organizationId: ORGANIZATION_ID, ...profileForm })
      });
      setSuccess(`${result.student_name} को विवरण सुरक्षित भयो।`);
      await refreshStudentProfile(profileStudentId);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function saveStudentTransport(event) {
    event.preventDefault(); if (!profileStudentId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await request(`/api/fee/students/${encodeURIComponent(profileStudentId)}/transport`, {
        method: 'PUT', body: JSON.stringify({ organizationId: ORGANIZATION_ID, ...transportForm })
      });
      setSuccess('Transport Info सुरक्षित भयो।'); await refreshStudentProfile(profileStudentId);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function saveDisciplineLog(event) {
    event.preventDefault(); if (!profileStudentId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await request(`/api/fee/students/${encodeURIComponent(profileStudentId)}/discipline`, {
        method: 'POST', body: JSON.stringify({ organizationId: ORGANIZATION_ID, ...disciplineForm })
      });
      setDisciplineForm({ incidentDate: getTodayAD(), category: 'positive', title: '', description: '', actionReport: '' });
      setSuccess('Discipline / Student Log सुरक्षित भयो।'); await refreshStudentProfile(profileStudentId);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function saveTeacherRemark(event) {
    event.preventDefault(); if (!profileStudentId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await request(`/api/fee/students/${encodeURIComponent(profileStudentId)}/remarks`, {
        method: 'POST', body: JSON.stringify({ organizationId: ORGANIZATION_ID, ...remarkForm })
      });
      setRemarkForm({ remarkDate: getTodayAD(), terminalRemarks: '', academicFeedback: '', parentCommunication: '' });
      setSuccess('Teacher Remarks सुरक्षित भयो।'); await refreshStudentProfile(profileStudentId);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function markStudentAttendance(status) {
    if (!profileStudentId) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await request(`/api/fee/students/${encodeURIComponent(profileStudentId)}/attendance`, {
        method: 'POST', body: JSON.stringify({ organizationId: ORGANIZATION_ID, attendanceDate: getTodayAD(), status })
      });
      setSuccess(`आजको attendance ${status} रूपमा सुरक्षित भयो।`); await refreshStudentProfile(profileStudentId);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function chooseFeeDashboardPeriod(period) {
    const today = getTodayAD();
    const todayBS = toBS(today);
    setFeeDashboardPeriod(period);
    if (period === 'daily') {
      setFeeDashboardFrom(today);
      setFeeDashboardTo(today);
      setFeeDashboardFromBS(toNepaliDigits(todayBS));
      setFeeDashboardToBS(toNepaliDigits(todayBS));
    } else if (period === 'monthly') {
      // Monthly means the current Nepali (Bikram Sambat) month, not the AD month.
      const [bsYear, bsMonth] = todayBS.split('-');
      const monthStartBS = `${bsYear}-${bsMonth}-01`;
      const monthStartAD = fromBS(monthStartBS) || `${today.slice(0, 7)}-01`;
      setFeeDashboardFrom(monthStartAD);
      setFeeDashboardTo(today);
      setFeeDashboardFromBS(toNepaliDigits(monthStartBS));
      setFeeDashboardToBS(toNepaliDigits(todayBS));
    }
  }

  function downloadFeeDashboardCsv() {
    if (!feeDashboardPayments.length) {
      setError('हालको filter मा export गर्न receipt record छैन।');
      return;
    }
    const columns = [
      ['Receipt No', 'receipt_number'], ['Date AD', 'receipt_date'], ['Date BS', 'receipt_date_bs'],
      ['Reg No', 'reg_no'], ['Student', 'student_name'], ['Class', 'class_name'], ['Section', 'section'],
      ['Guardian', 'guardian_name'], ['Guardian Phone', 'guardian_phone'], ['Payment Mode', 'payment_method'],
      ['Paid To', 'payment_account_name'], ['Bill No', 'bill_number'], ['Amount', 'total_amount'], ['Notes', 'notes']
    ];
    const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.map(([label]) => csvCell(label)).join(','), ...feeDashboardPayments.map(row => columns.map(([, key]) => csvCell(key === 'receipt_date_bs' ? toBS(formatDateAD(row.receipt_date)) : row[key])).join(','))].join('\r\n');
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student-fee-collections-${feeDashboardFrom}-to-${feeDashboardTo}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function createStudent(event) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const saved = await request('/api/fee/students', {
        method: 'POST',
        body: JSON.stringify({ organizationId: ORGANIZATION_ID, regNo, studentName, className, section, rollNumber, guardianName, guardianPhone, dobBs, gender, address, photoUrl })
      });
      setSuccess(`विद्यार्थी ${saved.student_name} सफलतापूर्वक दर्ता भयो।`);
      setRegNo(''); setStudentName(''); setClassName(''); setSection('A'); setRollNumber(''); setGuardianName(''); setGuardianPhone(''); setDobBs(''); setGender(''); setAddress(''); setPhotoUrl('');
      await reloadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function createFeeTitle(event) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const saved = await request('/api/fee/titles', {
        method: 'POST',
        body: JSON.stringify({ organizationId: ORGANIZATION_ID, titleCode, title: titleName, incomeAccountId: Number(incomeAccountId), defaultAmount: Number(defaultAmount), isMonthly })
      });
      setSuccess(`Fee Title “${saved.title || titleName}” तयार भयो। Receipt भएपछि सोही Income Ledger मा posting हुनेछ।`);
      setTitleCode(''); setTitleName(''); setDefaultAmount('');
      await reloadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  function toggleBillItem(title) {
    setSelectedBillItems(current => current.some(item => Number(item.feeTitleId) === Number(title.id))
      ? current.filter(item => Number(item.feeTitleId) !== Number(title.id))
      : [...current, { feeTitleId: Number(title.id), amount: String(title.default_amount || 0) }]);
  }

  function updateBillItemAmount(titleId, value) {
    setSelectedBillItems(current => current.map(item => Number(item.feeTitleId) === Number(titleId) ? { ...item, amount: value } : item));
  }

  async function createMonthlyBill(event) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      if (!billStudentId) throw new Error('पहिले विद्यार्थी छान्नुहोस्।');
      if (!selectedBillItems.length) throw new Error('कम्तीमा एउटा Fee Title छान्नुहोस्।');
      if (!billMonthAD) throw new Error('कृपया सही नेपाली वर्ष र महिना छान्नुहोस्।');
      const dueDate = billDueDateBS.trim() ? fromBS(billDueDateBS) : null;
      if (billDueDateBS.trim() && !dueDate) throw new Error('Due Date वि.सं. YYYY-MM-DD ढाँचामा सही लेख्नुहोस्।');
      const result = await request('/api/fee/bills', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          studentId: Number(billStudentId),
          feeMonth: billMonthRange.start,
          feeMonthEnd: billMonthRange.end,
          dueDate,
          items: selectedBillItems.map(item => ({ feeTitleId: Number(item.feeTitleId), amount: Number(item.amount) }))
        })
      });
      setSuccess(`${formatBSMonth(billMonthBS)} महिनाको Bill ${result.bill.bill_number} तयार भयो। जम्मा: ${money(result.bill.total_amount)}।`);
      setSelectedBillItems([]);
      await reloadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function createMonthlyBillsForAll() {
    setSaving(true); setError(''); setSuccess('');
    try {
      if (!billMonthAD) throw new Error('कृपया सही नेपाली वर्ष र महिना छान्नुहोस्।');
      if (!selectedBillItems.length) throw new Error('सबै विद्यार्थीको bill बनाउन पहिले कम्तीमा एउटा Fee Title छान्नुहोस्।');
      const dueDate = billDueDateBS.trim() ? fromBS(billDueDateBS) : null;
      if (billDueDateBS.trim() && !dueDate) throw new Error('Due Date वि.सं. YYYY-MM-DD ढाँचामा सही लेख्नुहोस्।');
      const confirmed = window.confirm(`${formatBSMonth(billMonthBS)} महिनाका लागि ${activeStudents.length} सक्रिय विद्यार्थीमध्ये पहिले bill नबनेका विद्यार्थीको bill बनाइनेछ। चयन गरिएका Fee Titles/रकम सबै विद्यार्थीमा लागू हुन्छन्। अघि बढ्ने?`);
      if (!confirmed) return;
      const result = await request('/api/fee/bills/bulk', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          feeMonth: billMonthRange.start,
          feeMonthEnd: billMonthRange.end,
          dueDate,
          items: selectedBillItems.map(item => ({ feeTitleId: Number(item.feeTitleId), amount: Number(item.amount) }))
        })
      });
      setSuccess(`${formatBSMonth(billMonthBS)} महिनाको bill प्रक्रिया पूरा भयो: ${result.createdCount} नयाँ bill, ${result.skippedCount} पहिले नै bill बनेका विद्यार्थी skip भए। नयाँ bill को जम्मा ${money(result.totalBilledAmount)}।`);
      await reloadAll();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function createReceipt(event) {
    event.preventDefault();
    setSaving(true); setError(''); setSuccess(''); setLastReceipt(null);
    try {
      const result = await request('/api/fee/receipts', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: ORGANIZATION_ID,
          billId: Number(receiptBillId),
          receiptDate,
          paymentMethod,
          paymentAccountId: Number(paymentAccountId),
          amount: Number(receiptAmount),
          notes: receiptNotes
        })
      });
      setLastReceipt(result.receipt);
      setSuccess(`Receipt ${result.receipt.receipt_number} जारी भयो। ${money(result.receipt.total_amount)} ${paymentMethod.toUpperCase()} मा प्राप्त; accounting मा income posting भयो।`);
      setReceiptNotes('');
      await reloadAll();
      const refreshedBills = await request(`/api/fee/bills?organizationId=${ORGANIZATION_ID}`);
      setBills(Array.isArray(refreshedBills) ? refreshedBills : []);
      setReceiptBillId(''); setReceiptAmount('');
      await onRefreshAccounts?.();
      if (ledgerStudentId && String(result.receipt.student_id) === String(ledgerStudentId)) await loadStudentLedger(ledgerStudentId);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  }

  const panelHeader = (title, desc, right = null) => (
    <div style={styles.panelHeading}>
      <div><h2 style={styles.panelTitle}>{title}</h2>{desc && <p style={styles.panelDesc}>{desc}</p>}</div>
      {right}
    </div>
  );
  const textField = (label, value, onChange, props = {}) => (
    <label style={styles.label}>{label}<input style={styles.input} value={value} onChange={e => onChange(e.target.value)} {...props} /></label>
  );
  const selectField = (label, value, onChange, options, placeholder = 'छान्नुहोस्') => (
    <label style={styles.label}>{label}<select style={styles.selectInput} value={value} onChange={e => onChange(e.target.value)} required>
      <option value="">{placeholder}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select></label>
  );

  return (
    <section>
      <div style={styles.pageHeading}>
        <div><div style={styles.eyebrow}>Student Receivables</div><h1 style={styles.h1}>Student Fees / विद्यार्थी शुल्क</h1>
          <p style={styles.subtitle}>विद्यार्थी विवरण, मासिक बिल, रसिद, Cash/Bank posting र विद्यार्थीगत Ledger एउटै ठाउँमा।</p></div>
        <button type="button" style={styles.secondaryButton} onClick={reloadAll} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>
      {error && <Notice message={error} type="error" />}
      {success && <Notice message={success} />}
      {!incomeAccounts.length && <Notice message="Fee Title बनाउन Chart of Accounts मा कम्तीमा एउटा active Income type Ledger बनाउनुहोस्।" type="error" />}
      {!assetAccounts.length && <Notice message="Receipt लिन Chart of Accounts मा Cash/Bank का लागि Asset type Ledger बनाउनुहोस्।" type="error" />}

      <div style={styles.reportTabs}>
        {[
          ['Fee Dashboard', 'Fee Dashboard / शुल्क Dashboard'], ['Students', 'विद्यार्थी'], ['Student Profile', 'Student Profile'], ['Fee Titles', 'Fee Titles'], ['Monthly Bill', 'Monthly Bill'],
          ['Receive Fee', 'Receipt काट्ने'], ['Student Ledger', 'विद्यार्थी Ledger'], ['Receipt Register', 'Receipt Register']
        ].map(([key, label]) => <button key={key} type="button" onClick={() => setTab(key)} style={{ ...styles.reportTab, ...(tab === key ? styles.reportTabActive : {}) }}>{label}</button>)}
      </div>

      {tab === 'Fee Dashboard' && <>
        <section style={styles.panel}>
          {panelHeader('Student Fee Management Dashboard', 'दैनिक, मासिक वा आफूले छानेको मिति-दायराअनुसार fee billing, collection, due balance र अभिभावक विवरण।',
            <button type="button" style={styles.secondaryButton} onClick={() => { setFeeDashboardRefreshKey(value => value + 1); reloadAll(); }} disabled={feeDashboardLoading}><RefreshCw size={15} /> Refresh</button>)}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {[['daily', 'आज / Daily'], ['monthly', 'यो महिना / Monthly'], ['range', 'मिति-दायरा / Date Range']].map(([key, label]) => <button key={key} type="button" onClick={() => chooseFeeDashboardPeriod(key)} style={{ ...styles.reportTab, ...(feeDashboardPeriod === key ? styles.reportTabActive : {}) }}>{label}</button>)}
          </div>
          <div style={{ ...styles.formGrid, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', alignItems: 'end' }}>
            <label style={styles.label}>सुरु मिति / From (वि.सं.)
              <input style={styles.input} type="text" inputMode="numeric" placeholder="२०८३-०७-१२" value={feeDashboardFromBS} onChange={event => {
                const value = event.target.value;
                setFeeDashboardPeriod('range');
                setFeeDashboardFromBS(value);
                const adDate = fromBS(value);
                setFeeDashboardData(null);
                if (adDate) { setFeeDashboardFrom(adDate); setFeeDashboardError(''); }
              }} />
              <small style={{ color: '#64748b', fontWeight: 400 }}>वि.सं. मिति YYYY-MM-DD लेख्नुहोस्। नेपाली वा English अंक दुवै मिल्छन्।</small>
            </label>
            <label style={styles.label}>अन्तिम मिति / To (वि.सं.)
              <input style={styles.input} type="text" inputMode="numeric" placeholder="२०८३-०७-३०" value={feeDashboardToBS} onChange={event => {
                const value = event.target.value;
                setFeeDashboardPeriod('range');
                setFeeDashboardToBS(value);
                const adDate = fromBS(value);
                setFeeDashboardData(null);
                if (adDate) { setFeeDashboardTo(adDate); setFeeDashboardError(''); }
              }} />
              <small style={{ color: '#64748b', fontWeight: 400 }}>वि.सं. मिति YYYY-MM-DD लेख्नुहोस्। नेपाली वा English अंक दुवै मिल्छन्।</small>
            </label>
            <label style={styles.label}>कक्षा / Class (सूची filter)
              <select style={styles.selectInput} value={feeDashboardClass} onChange={event => setFeeDashboardClass(event.target.value)}>
                <option value="">सबै कक्षा / All classes</option>
                {feeDashboardClassOptions.map(option => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label style={styles.label}>Payment list / भुक्तानी माध्यम
              <select style={styles.selectInput} value={feeDashboardPaymentMode} onChange={event => setFeeDashboardPaymentMode(event.target.value)}>
                <option value="">सबै माध्यम / All</option><option value="cash">Cash / नगद</option><option value="bank">Bank / बैंक</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '12px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, fontSize: 12, color: '#475569' }}>
            <span><strong>अहिलेको रिपोर्ट:</strong> {feeDashboardFromBS === feeDashboardToBS ? `वि.सं. ${toNepaliDigits(feeDashboardFromBS)}` : `वि.सं. ${toNepaliDigits(feeDashboardFromBS)} देखि ${toNepaliDigits(feeDashboardToBS)} सम्म`}</span>
            <span>{feeDashboardLoading ? 'रिपोर्ट तयार हुँदैछ…' : `${feeDashboardData?.payments?.length ?? 0} भुक्तानी रेकर्ड loaded`}</span>
          </div>
          <small style={{ display: 'block', marginTop: 8, color: '#64748b' }}>मिति-दायराले KPI र chart बदल्छ। कक्षा filter ले तलका payment/due सूची filter गर्छ; payment mode ले payment register मात्र filter गर्छ। Current Outstanding भने सबै हालको बाँकी bill को रकम हो।</small>
        </section>
        {feeDashboardError && <Notice message={feeDashboardError} type="error" />}
        {feeDashboardLoading && !feeDashboardData && <section style={styles.panel}><div style={{ padding: 28, textAlign: 'center', color: '#64748b' }}>Fee Dashboard data load हुँदैछ…</div></section>}
        {feeDashboardData && <>
          <div style={{ ...styles.metricsGrid, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
            <Metric title="Active Students / सक्रिय विद्यार्थी" value={Number(feeDashboardData.summary.active_students || 0).toLocaleString('en-IN')} note="हाल दर्ता भएका विद्यार्थी" icon={<GraduationCap size={19} />} color="#4338ca" bg="#eef2ff" />
            <Metric title="Billed in Period / यस अवधिको बिल" value={money(feeDashboardData.summary.billed_amount)} note={`${feeDashboardData.summary.bills_in_period || 0} bill जारी`} icon={<FileText size={19} />} color="#2563eb" bg="#dbeafe" />
            <Metric title="Fee Collected / शुल्क संकलन" value={money(feeDashboardData.summary.collected_amount)} note={`${feeDashboardData.summary.receipt_count || 0} receipt · ${feeDashboardData.summary.students_paid || 0} विद्यार्थी`} icon={<Wallet size={19} />} color="#047857" bg="#d1fae5" />
            <Metric title="Current Outstanding / कुल बाँकी" value={money(feeDashboardData.summary.outstanding_amount)} note={`${feeDashboardData.summary.students_with_due || 0} विद्यार्थीको बाँकी`} icon={<AlertCircle size={19} />} color="#b45309" bg="#fef3c7" />
            <Metric title="Overdue / म्याद नाघेको" value={money(feeDashboardData.summary.overdue_amount)} note={`${feeDashboardData.summary.overdue_students || 0} विद्यार्थी · due date कटेको`} icon={<CalendarDays size={19} />} color="#b91c1c" bg="#fee2e2" />
          </div>
          <div style={{ ...styles.metricsGrid, gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))' }}>
            <Metric title="Cash Collection / नगद" value={money(feeDashboardData.summary.cash_collected)} note="छानिएको अवधिमा" icon={<Wallet size={18} />} color="#0f766e" bg="#ccfbf1" />
            <Metric title="Bank Collection / बैंक" value={money(feeDashboardData.summary.bank_collected)} note="छानिएको अवधिमा" icon={<Landmark size={18} />} color="#1d4ed8" bg="#dbeafe" />
            <Metric title="Period Receipts / रसिद संख्या" value={Number(feeDashboardData.summary.receipt_count || 0).toLocaleString('en-IN')} note={`${feeDashboardData.summary.bills_in_period || 0} नयाँ bill`} icon={<ReceiptText size={18} />} color="#7c3aed" bg="#ede9fe" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: 18, marginBottom: 24 }}>
            <section style={{ ...styles.panel, marginBottom: 0 }}>
              {panelHeader('Collection Trend / शुल्क संकलनको प्रवृत्ति', feeDashboardData.range?.granularity === 'month' ? 'महिनाअनुसार संकलन' : 'दैनिक संकलन · मिति अनुसार')}
              {(feeDashboardData.trend || []).length ? <div style={{ display: 'flex', alignItems: 'stretch', gap: 10, height: 210, padding: '10px 2px 0', overflowX: 'auto' }}>
                {(feeDashboardData.trend || []).slice(-24).map(item => {
                  const max = Math.max(1, ...(feeDashboardData.trend || []).map(row => Number(row.amount || 0)));
                  const height = Math.max(5, Number(item.amount || 0) / max * 148);
                  const label = feeDashboardData.range?.granularity === 'month' ? toNepaliDigits(item.period_key) : toNepaliDigits(toBS(item.period_key) || item.period_key);
                  return <div key={item.period_key} title={`${item.period_key}: ${money(item.amount)} · ${item.receipt_count} receipts`} style={{ minWidth: 42, flex: '1 0 42px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: 7 }}>
                    <small style={{ color: '#334155', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{Number(item.amount) ? money(item.amount).replace('Rs. ', '') : '0'}</small>
                    <div style={{ height: 150, width: '100%', display: 'flex', alignItems: 'flex-end', background: '#f1f5f9', borderRadius: '7px 7px 2px 2px', overflow: 'hidden' }}><div style={{ width: '100%', height: `${height}px`, background: 'linear-gradient(180deg,#818cf8,#4f46e5)', borderRadius: '7px 7px 0 0' }} /></div>
                    <small style={{ color: '#64748b', fontSize: 10, whiteSpace: 'nowrap' }}>{label}</small>
                  </div>;
                })}
              </div> : <div style={styles.emptyCell}>यो मिति-दायरामा कुनै शुल्क संकलन छैन।</div>}
            </section>
            <section style={{ ...styles.panel, marginBottom: 0 }}>
              {panelHeader('Class-wise Performance / कक्षा अनुसार', 'अवधिभर bill र receipt को तुलना')}
              {(feeDashboardData.classSummary || []).length ? <div style={{ display: 'grid', gap: 14 }}>
                {(feeDashboardData.classSummary || []).slice(0, 10).map(item => {
                  const max = Math.max(1, ...(feeDashboardData.classSummary || []).map(row => Number(row.billed_amount || 0)), ...(feeDashboardData.classSummary || []).map(row => Number(row.collected_amount || 0)));
                  return <div key={`${item.class_name}-${item.section}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 5, fontSize: 12 }}><strong>{item.class_name} · {item.section}</strong><span style={{ color: '#64748b' }}>Collected {money(item.collected_amount)}</span></div>
                    <div style={{ height: 9, background: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, Number(item.collected_amount || 0) / max * 100)}%`, background: '#10b981', borderRadius: 99 }} /></div>
                    <small style={{ color: '#64748b' }}>Billed {money(item.billed_amount)} · {item.receipt_count || 0} receipts</small>
                  </div>;
                })}
              </div> : <div style={styles.emptyCell}>यो अवधिका लागि class-wise billing/collection छैन।</div>}
            </section>
          </div>
          <section style={styles.panel}>
            {panelHeader('Payment Register / अभिभावकसहित भुक्तानी सूची', `${feeDashboardPayments.length} record · वर्तमान filter अनुसार`, <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><input style={{ ...styles.input, maxWidth: 260, marginBottom: 0 }} value={feeDashboardPaymentSearch} onChange={event => setFeeDashboardPaymentSearch(event.target.value)} placeholder="विद्यार्थी, Reg No, अभिभावक खोज्नुहोस्…" /><button type="button" style={styles.secondaryButton} onClick={downloadFeeDashboardCsv}><FileText size={15} /> CSV Export</button></div>)}
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Receipt / Date (BS)', 'Student Details', 'Parent / Guardian', 'Payment', 'Amount', 'Action'].map(title => <th key={title} style={{ padding: 12, background: '#f8fafc' }}>{title}</th>)}</tr></thead><tbody>
              {feeDashboardPayments.map(payment => <tr key={payment.id}>
                <td style={{ padding: 12 }}><strong>{payment.receipt_number}</strong><small style={{ display: 'block', color: '#475569' }}>वि.सं. {toNepaliDigits(toBS(formatDateAD(payment.receipt_date)))}</small><small style={{ display: 'block', color: '#64748b' }}>Bill No. {payment.bill_number}</small></td>
                <td style={{ padding: 12 }}><strong>{payment.student_name}</strong><small style={{ display: 'block', color: '#64748b' }}>{payment.reg_no || payment.admission_no} · {payment.class_name}-{payment.section} / Roll {payment.roll_number}</small></td>
                <td style={{ padding: 12 }}><strong>{payment.guardian_name || 'अभिभावक विवरण छैन'}</strong>{payment.guardian_phone ? <a href={`tel:${payment.guardian_phone}`} style={{ display: 'block', marginTop: 4, color: '#4f46e5', textDecoration: 'none', fontSize: 12 }}>{payment.guardian_phone}</a> : <small style={{ display: 'block', color: '#94a3b8' }}>फोन उपलब्ध छैन</small>}<small style={{ display: 'block', color: '#64748b' }}>{payment.address || ''}</small></td>
                <td style={{ padding: 12 }}><span style={{ ...styles.typeBadge, background: payment.payment_method === 'cash' ? '#dcfce7' : '#dbeafe', color: payment.payment_method === 'cash' ? '#166534' : '#1d4ed8' }}>{String(payment.payment_method || '').toUpperCase()}</span><small style={{ display: 'block', marginTop: 5, color: '#64748b' }}>{payment.payment_account_name}</small></td>
                <td style={{ padding: 12, textAlign: 'right', fontWeight: 750, color: '#047857' }}>{money(payment.total_amount)}</td>
                <td style={{ padding: 12 }}><button type="button" style={styles.secondaryButton} onClick={() => printStudentReceipt(payment)}><Printer size={14} /> Receipt</button></td>
              </tr>)}
              {!feeDashboardPayments.length && <tr><td colSpan="6" style={styles.emptyCell}>{feeDashboardLoading ? 'Loading…' : 'यस filter मा receipt छैन।'}</td></tr>}
            </tbody></table></div>
            <p style={{ color: '#64748b', fontSize: 12, margin: '10px 0 0' }}>नोट: Payment Register मा date-range भित्रका पछिल्ला 500 receipt सम्म देखाइन्छ। Summary र chart database बाट सबै matching receipt को aggregate हुन्।</p>
          </section>
          <section style={styles.panel}>
            {panelHeader('Outstanding Fee & Parent Follow-up / बाँकी शुल्क', `${feeDashboardOutstanding.length} विद्यार्थी · कुल वर्तमान बाँकीको आधारमा ठूलो रकम पहिला`, <input style={{ ...styles.input, maxWidth: 270, marginBottom: 0 }} value={feeDashboardOutstandingSearch} onChange={event => setFeeDashboardOutstandingSearch(event.target.value)} placeholder="विद्यार्थी / अभिभावक खोज्नुहोस्…" />)}
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Student / Reg No', 'Class / Roll', 'Parent Details', 'Outstanding', 'Overdue', 'Oldest Due', 'Follow-up'].map(title => <th key={title} style={{ padding: 12, background: '#f8fafc' }}>{title}</th>)}</tr></thead><tbody>
              {feeDashboardOutstanding.map(student => <tr key={student.student_id}>
                <td style={{ padding: 12 }}><strong>{student.student_name}</strong><small style={{ display: 'block', color: '#64748b' }}>{student.reg_no || student.admission_no}</small></td>
                <td style={{ padding: 12 }}>{student.class_name}-{student.section}<small style={{ display: 'block', color: '#64748b' }}>Roll {student.roll_number}</small></td>
                <td style={{ padding: 12 }}><strong>{student.guardian_name || 'अभिभावक विवरण छैन'}</strong>{student.guardian_phone ? <a href={`tel:${student.guardian_phone}`} style={{ display: 'block', marginTop: 4, color: '#4f46e5', textDecoration: 'none' }}>{student.guardian_phone}</a> : <small style={{ display: 'block', color: '#94a3b8' }}>फोन उपलब्ध छैन</small>}<small style={{ color: '#64748b' }}>{student.address || ''}</small></td>
                <td style={{ padding: 12, textAlign: 'right', fontWeight: 750, color: '#b45309' }}>{money(student.outstanding_amount)}<small style={{ display: 'block', color: '#64748b', fontWeight: 400 }}>{student.due_bill_count} due bill</small></td>
                <td style={{ padding: 12, textAlign: 'right', fontWeight: Number(student.overdue_amount) > 0 ? 700 : 400, color: Number(student.overdue_amount) > 0 ? '#b91c1c' : '#64748b' }}>{money(student.overdue_amount)}</td>
                <td style={{ padding: 12 }}><strong>{student.oldest_due_date ? toNepaliDigits(toBS(formatDateAD(student.oldest_due_date))) : '—'}</strong></td>
                <td style={{ padding: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}><button type="button" style={styles.secondaryButton} onClick={() => openStudentProfile(student.student_id)}>Profile</button>{student.guardian_phone && <a href={`tel:${student.guardian_phone}`} style={{ ...styles.secondaryButton, textDecoration: 'none' }}>Call Parent</a>}</td>
              </tr>)}
              {!feeDashboardOutstanding.length && <tr><td colSpan="7" style={styles.emptyCell}>हाल कुनै बाँकी बिल छैन वा तपाईंको search/class filter सँग मेल खाएन।</td></tr>}
            </tbody></table></div>
          </section>
        </>}
      </>}

      {tab === 'Students' && <>
        <section style={styles.panel}>
          {panelHeader('Excel बाट विद्यार्थी Import', 'Excel (.xlsx/.xls) वा CSV बाट एकैपटक विद्यार्थी दर्ता गर्नुहोस्। आवश्यक header: Reg No, Student Name, Class, Section, Roll Number।')}
          <div style={styles.formGrid}>
            <label style={styles.label}>Excel / CSV फाइल छान्नुहोस्
              <input style={styles.input} type="file" accept=".xlsx,.xls,.csv" onChange={handleStudentExcelSelect} />
              <small style={{ color: '#64748b', fontWeight: 400 }}>{studentImportFileName || 'अधिकतम 1,000 विद्यार्थी एकपटकमा'}</small>
            </label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'start' }}>
              <button type="button" style={styles.secondaryButton} onClick={downloadStudentExcelTemplate}><FileText size={15} /> Excel Template Download</button>
              <button type="button" style={styles.primaryButton} onClick={importStudentExcel} disabled={studentImporting || !studentImportRows.length}><Plus size={15} /> {studentImporting ? 'Import हुँदैछ...' : `${studentImportRows.length} विद्यार्थी Import`}</button>
            </div>
          </div>
          {studentImportError && <Notice message={studentImportError} type="error" />}
          {studentImportSummary && <div style={{ ...styles.notice, ...styles.infoNotice, marginTop: 12 }}>
            <div><strong>Import परिणाम:</strong> {studentImportSummary.imported || 0} थपिए · {studentImportSummary.skipped || 0} skip · {(studentImportSummary.errors || []).length} विवरण</div>
            {(studentImportSummary.errors || []).length > 0 && <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>{studentImportSummary.errors.slice(0, 10).map((item, index) => <li key={`${item.rowNumber || item.row || index}-${index}`}>Row {item.rowNumber || item.row || '—'}: {item.message}</li>)}</ul>}
          </div>}
          {studentImportRows.length > 0 && <div style={{ marginTop: 14 }}>
            <p style={{ color: '#475569', fontSize: 13 }}>Import गर्नुअघि preview (पहिला 10 record): {studentImportRows.length} वटा record भेटिए। Duplicate Reg No वा Class/Section/Roll भएका record skip हुन सक्छन्।</p>
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Excel Row', 'Reg No', 'Student Name', 'Class', 'Section', 'Roll', 'DOB (BS)', 'Gender', 'Guardian', 'Phone'].map(h => <th key={h} style={{ padding: 10, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>
              {studentImportRows.slice(0, 10).map(row => <tr key={row.rowNumber}><td style={{ padding: 10 }}>{row.rowNumber}</td><td style={{ padding: 10 }}>{row.regNo || '—'}</td><td style={{ padding: 10 }}>{row.studentName || '—'}</td><td style={{ padding: 10 }}>{row.className || '—'}</td><td style={{ padding: 10 }}>{row.section || '—'}</td><td style={{ padding: 10 }}>{row.rollNumber || '—'}</td><td style={{ padding: 10 }}>{row.dobBs || '—'}</td><td style={{ padding: 10 }}>{row.gender || '—'}</td><td style={{ padding: 10 }}>{row.guardianName || '—'}</td><td style={{ padding: 10 }}>{row.guardianPhone || '—'}</td></tr>)}
            </tbody></table></div>
          </div>}
        </section>
        <section style={styles.panel}>
          {panelHeader('नयाँ विद्यार्थी दर्ता', 'Reg No, Class, Section र Roll Number विद्यार्थीको खातासँग जोडिन्छ।')}
          <form onSubmit={createStudent}>
            <div style={styles.formGrid}>
              {textField('Reg No *', regNo, setRegNo, { required: true, maxLength: 50 })}
              {textField('विद्यार्थीको पूरा नाम *', studentName, setStudentName, { required: true, maxLength: 200 })}
              {textField('Class *', className, setClassName, { required: true, placeholder: 'जस्तै: 5' })}
              {textField('Section *', section, setSection, { required: true, placeholder: 'A' })}
              {textField('Roll Number *', rollNumber, setRollNumber, { required: true })}
              {textField('जन्ममिति (वि.सं. / DOB BS)', dobBs, setDobBs, { placeholder: 'जस्तै: २०७५-०४-१५' })}
              <label style={styles.label}>लिङ्ग / Gender<select style={styles.selectInput} value={gender} onChange={e => setGender(e.target.value)}><option value="">छान्नुहोस्</option><option value="male">Male / पुरुष</option><option value="female">Female / महिला</option><option value="other">Other / अन्य</option></select></label>
              {textField('ठेगाना / Address', address, setAddress, { maxLength: 500 })}
              {textField('Photo URL (optional)', photoUrl, setPhotoUrl, { type: 'url', maxLength: 1000 })}
              {textField('अभिभावकको नाम', guardianName, setGuardianName, { maxLength: 200 })}
              {textField('अभिभावकको फोन', guardianPhone, setGuardianPhone, { maxLength: 40 })}
            </div>
            <button style={styles.primaryButton} type="submit" disabled={saving}><Plus size={16} /> {saving ? 'Saving...' : 'विद्यार्थी दर्ता गर्नुहोस्'}</button>
          </form>
        </section>
        <section style={styles.panel}>
          {panelHeader('विद्यार्थी सूची', `${students.length} विद्यार्थी`, <input style={{ ...styles.input, maxWidth: 300, marginBottom: 0 }} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="Reg No, नाम, class, roll खोज्नुहोस्..." />)}
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr>
            {['Reg No', 'विद्यार्थी', 'Class', 'Section', 'Roll', 'DOB (BS)', 'अभिभावक', 'फोन', 'दर्ता मिति (BS/AD)', 'Profile / Ledger'].map(h => <th key={h} style={{ padding: 12, borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>{h}</th>)}
          </tr></thead><tbody>{filteredStudents.map(s => <tr key={s.id}>
            <td style={{ padding: 12 }}>{(s.reg_no || s.admission_no)}</td><td style={{ padding: 12, fontWeight: 600 }}>{s.student_name}</td><td style={{ padding: 12 }}>{s.class_name}</td><td style={{ padding: 12 }}>{s.section}</td><td style={{ padding: 12 }}>{s.roll_number}</td><td style={{ padding: 12 }}>{s.dob_bs || '—'}</td><td style={{ padding: 12 }}>{s.guardian_name || '—'}</td><td style={{ padding: 12 }}>{s.guardian_phone || '—'}</td>
            <td style={{ padding: 12 }}><strong>{toBS(formatDateAD(s.created_at)) || '—'}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatDateAD(s.created_at) || '—'}</small></td>
            <td style={{ padding: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}><button type="button" style={styles.secondaryButton} onClick={() => openStudentProfile(s)}>Profile हेर्नुहोस्</button><button type="button" style={styles.secondaryButton} onClick={() => { setLedgerStudentId(String(s.id)); setTab('Student Ledger'); loadStudentLedger(String(s.id)); }}>Ledger</button></td>
          </tr>)}{!filteredStudents.length && <tr><td colSpan="10" style={styles.emptyCell}>{loading ? 'Loading...' : 'विद्यार्थी छैन। माथिको फारमबाट दर्ता गर्नुहोस्।'}</td></tr>}</tbody></table></div>
        </section>
      </>}

      {tab === 'Student Profile' && <>
        {!profileData ? <section style={styles.panel}>
          {panelHeader('Student Profile / विद्यार्थी प्रोफाइल', 'विद्यार्थी सूचीबाट Profile हेर्नुहोस् छान्नुहोस्।')}
          <div style={styles.formGrid}>
            {selectField('विद्यार्थी छान्नुहोस्', profileStudentId, value => openStudentProfile(value), students.map(st => ({ value: String(st.id), label: `${st.reg_no || st.admission_no} · ${st.student_name} · ${st.class_name}-${st.section} / ${st.roll_number}` })), 'विद्यार्थी छान्नुहोस्')}
            <div style={{ alignSelf: 'end' }}><button type="button" style={styles.primaryButton} onClick={() => openStudentProfile(profileStudentId)} disabled={!profileStudentId || profileLoading}><Search size={15} /> Profile खोल्नुहोस्</button></div>
          </div>
        </section> : <>
          <section style={styles.panel}>
            {panelHeader(`Student Profile · ${profileData.student.student_name}`, `${profileData.student.reg_no || profileData.student.admission_no} · Class ${profileData.student.class_name}-${profileData.student.section} · Roll ${profileData.student.roll_number}`, <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}><button type="button" style={styles.secondaryButton} onClick={() => { setProfileData(null); setTab('Students'); }}>विद्यार्थी सूची</button><button type="button" style={styles.secondaryButton} onClick={() => refreshStudentProfile(profileStudentId)} disabled={profileLoading}><RefreshCw size={14} /> Refresh</button></div>)}
            <div style={{ ...styles.reportTabs, marginTop: 14 }}>
              {['Profile Summary', 'Ledger & Billing', 'Transport Info', 'Discipline & Logs', 'Teacher Remarks'].map(name => <button key={name} type="button" onClick={() => setProfileTab(name)} style={{ ...styles.reportTab, ...(profileTab === name ? styles.reportTabActive : {}) }}>{name}</button>)}
            </div>
          </section>
          {profileTab === 'Profile Summary' && <>
            <section style={styles.panel}>
              {panelHeader('Profile Summary / विद्यार्थीको विवरण', 'जन्ममिति नेपाली वि.सं.मा राख्नुहोस्। Photo को लागि optional image URL प्रयोग हुन्छ।')}
              <form onSubmit={saveStudentProfile}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 180px) 1fr', gap: 20, alignItems: 'start' }}>
                  <div style={{ textAlign: 'center' }}>
                    {profileForm.photoUrl ? <img src={profileForm.photoUrl} alt="Student photo" onError={e => { e.currentTarget.style.display = 'none'; }} style={{ width: 128, height: 128, borderRadius: 16, objectFit: 'cover', border: '1px solid #cbd5e1' }} /> : <div style={{ width: 128, height: 128, borderRadius: 16, background: '#e0e7ff', color: '#3730a3', display: 'grid', placeItems: 'center', fontSize: 38, fontWeight: 700, margin: '0 auto' }}>{String(profileForm.studentName || '?').trim().charAt(0).toUpperCase()}</div>}
                    <label style={{ ...styles.label, marginTop: 10, textAlign: 'left' }}>Photo URL<input style={styles.input} type="url" value={profileForm.photoUrl || ''} onChange={e => setProfileForm(current => ({ ...current, photoUrl: e.target.value }))} placeholder="https://..." /></label>
                  </div>
                  <div style={styles.formGrid}>
                    {textField('Reg No', profileData.student.reg_no || profileData.student.admission_no, () => {}, { readOnly: true })}
                    {textField('विद्यार्थीको पूरा नाम *', profileForm.studentName || '', value => setProfileForm(current => ({ ...current, studentName: value })), { required: true, maxLength: 200 })}
                    {textField('जन्ममिति (वि.सं. / DOB BS)', profileForm.dobBs || '', value => setProfileForm(current => ({ ...current, dobBs: value })), { placeholder: 'जस्तै: २०७५-०४-१५' })}
                    <label style={styles.label}>लिङ्ग / Gender<select style={styles.selectInput} value={profileForm.gender || ''} onChange={e => setProfileForm(current => ({ ...current, gender: e.target.value }))}><option value="">छान्नुहोस्</option><option value="male">Male / पुरुष</option><option value="female">Female / महिला</option><option value="other">Other / अन्य</option></select></label>
                    {textField('Class *', profileForm.className || '', value => setProfileForm(current => ({ ...current, className: value })), { required: true })}
                    {textField('Section *', profileForm.section || '', value => setProfileForm(current => ({ ...current, section: value })), { required: true })}
                    {textField('Roll Number *', profileForm.rollNumber || '', value => setProfileForm(current => ({ ...current, rollNumber: value })), { required: true })}
                    {textField('अभिभावकको नाम', profileForm.guardianName || '', value => setProfileForm(current => ({ ...current, guardianName: value })), { maxLength: 200 })}
                    {textField('अभिभावकको फोन', profileForm.guardianPhone || '', value => setProfileForm(current => ({ ...current, guardianPhone: value })), { maxLength: 40 })}
                    {textField('ठेगाना / Address', profileForm.address || '', value => setProfileForm(current => ({ ...current, address: value })), { maxLength: 500 })}
                  </div>
                </div>
                <button type="submit" style={{ ...styles.primaryButton, marginTop: 12 }} disabled={saving}><FileText size={15} /> विवरण Save गर्नुहोस्</button>
              </form>
            </section>
            <section style={styles.panel}>
              {panelHeader('Attendance Summary / हाजिरी सारांश', 'यो Student Fee module भित्रको attendance record हो; अर्को attendance system सँग अहिले स्वतः जोडिएको छैन।')}
              <div style={styles.metricsGrid}>
                <Metric title="Present / उपस्थित" value={profileData.attendanceSummary.present_days} note="रेकर्ड गरिएको दिन" icon={<CheckCircle2 size={19} />} color="#059669" bg="#d1fae5" />
                <Metric title="Absent / अनुपस्थित" value={profileData.attendanceSummary.absent_days} note="रेकर्ड गरिएको दिन" icon={<AlertCircle size={19} />} color="#dc2626" bg="#fee2e2" />
                <Metric title="Attendance %" value={`${profileData.attendanceSummary.attendance_percent}%`} note={`${profileData.attendanceSummary.total_marked} दिन मार्क भएको`} icon={<CalendarDays size={19} />} color="#ff4fa3" bg="#eef2ff" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>{['present', 'absent', 'late', 'leave'].map(status => <button key={status} type="button" style={status === 'absent' ? styles.secondaryButton : styles.primaryButton} disabled={saving} onClick={() => markStudentAttendance(status)}>{({ present: 'आज Present', absent: 'आज Absent', late: 'आज Late', leave: 'आज Leave' })[status]}</button>)}</div>
              <p style={{ fontSize: 12, color: '#64748b' }}>आजको मिति (BS): {toBS(getTodayAD())} · (AD): {getTodayAD()}</p>
              <h3 style={{ fontSize: 14, color: '#334155' }}>हालसालको हाजिरी</h3>
              <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Date (BS/AD)', 'Status'].map(h => <th key={h} style={{ padding: 10, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>{profileData.attendanceRecent.map(item => <tr key={item.id}><td style={{ padding: 10 }}><strong>{toBS(formatDateAD(item.attendance_date))}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatDateAD(item.attendance_date)}</small></td><td style={{ padding: 10 }}>{String(item.status).toUpperCase()}</td></tr>)}{!profileData.attendanceRecent.length && <tr><td colSpan="2" style={styles.emptyCell}>अहिलेसम्म attendance रेकर्ड छैन।</td></tr>}</tbody></table></div>
            </section>
            <section style={styles.panel}>
              {panelHeader('Quick Actions / छिटो काम')}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" style={styles.primaryButton} onClick={() => { setBillStudentId(String(profileStudentId)); setTab('Monthly Bill'); }}><FileText size={15} /> Generate Bill</button>
                <button type="button" style={styles.primaryButton} onClick={() => { const due = outstandingBills.find(b => String(b.student_id) === String(profileStudentId)); setReceiptBillId(due ? String(due.id) : ''); setReceiptAmount(due ? String(due.balance_due) : ''); setTab('Receive Fee'); }}><ReceiptText size={15} /> Receive Fee</button>
                <button type="button" style={styles.secondaryButton} onClick={() => { setLedgerStudentId(String(profileStudentId)); setTab('Student Ledger'); loadStudentLedger(profileStudentId); }}><BookOpen size={15} /> Student Ledger</button>
                <button type="button" style={styles.secondaryButton} onClick={() => { const latest = receipts.find(r => String(r.student_id) === String(profileStudentId)); if (latest) printStudentReceipt(latest); else setError('यो विद्यार्थीको receipt अझै छैन।'); }}><Printer size={15} /> Latest Receipt / Download PDF</button>
              </div>
            </section>
          </>}
          {profileTab === 'Ledger & Billing' && <section style={styles.panel}>
            {panelHeader('Ledger & Billing / बिल तथा भुक्तानी', 'Current Due, bill history र payment history।', <button type="button" style={styles.primaryButton} onClick={() => { setBillStudentId(String(profileStudentId)); setTab('Monthly Bill'); }}><Plus size={15} /> Generate Bill</button>)}
            {(() => { const sbills = bills.filter(b => String(b.student_id) === String(profileStudentId)); const sreceipts = receipts.filter(r => String(r.student_id) === String(profileStudentId)); const billed = sbills.reduce((sum, b) => sum + Number(b.total_amount || 0), 0); const received = sreceipts.reduce((sum, r) => sum + Number(r.total_amount || 0), 0); const due = Math.max(0, billed - received); return <>
              <div style={styles.metricsGrid}><Metric title="Current Due / बाँकी" value={money(due)} note={`${sbills.length} bills`} icon={<AlertCircle size={19} />} color="#d97706" bg="#fef3c7" /><Metric title="Billed / बिल" value={money(billed)} note="कुल billing" icon={<FileText size={19} />} color="#ff4fa3" bg="#eef2ff" /><Metric title="Received / प्राप्त" value={money(received)} note={`${sreceipts.length} receipts`} icon={<Wallet size={19} />} color="#059669" bg="#d1fae5" /></div>
              <h3 style={{ fontSize: 14 }}>Bill History</h3><div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Bill No', 'Month (BS/AD)', 'Billed', 'Received', 'Due', 'Status'].map(h => <th key={h} style={{ padding: 10, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>{sbills.map(b => <tr key={b.id}><td style={{ padding: 10 }}>{b.bill_number}</td><td style={{ padding: 10 }}><strong>{formatBSMonth((toBS(String(b.fee_month).slice(0, 10)) || '').slice(0, 7)) || '—'}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatBSDateLabel(b.fee_month)}</small></td><td style={{ padding: 10, textAlign: 'right' }}>{money(b.total_amount)}</td><td style={{ padding: 10, textAlign: 'right' }}>{money(b.total_received)}</td><td style={{ padding: 10, textAlign: 'right' }}>{money(b.balance_due)}</td><td style={{ padding: 10 }}>{b.status}</td></tr>)}{!sbills.length && <tr><td colSpan="6" style={styles.emptyCell}>Bill छैन। Generate Bill प्रयोग गर्नुहोस्।</td></tr>}</tbody></table></div>
              <h3 style={{ fontSize: 14, marginTop: 20 }}>Payment History</h3><div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Receipt No', 'Date (BS/AD)', 'Mode', 'Paid To', 'Amount', 'Receipt'].map(h => <th key={h} style={{ padding: 10, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>{sreceipts.map(r => <tr key={r.id}><td style={{ padding: 10 }}>{r.receipt_number}</td><td style={{ padding: 10 }}><strong>{toBS(formatDateAD(r.receipt_date))}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatDateAD(r.receipt_date)}</small></td><td style={{ padding: 10 }}>{String(r.payment_method).toUpperCase()}</td><td style={{ padding: 10 }}>{r.payment_account_name}</td><td style={{ padding: 10, textAlign: 'right' }}>{money(r.total_amount)}</td><td style={{ padding: 10 }}><button type="button" style={styles.secondaryButton} onClick={() => printStudentReceipt(r)}><Printer size={14} /> Print / PDF</button></td></tr>)}{!sreceipts.length && <tr><td colSpan="6" style={styles.emptyCell}>Payment छैन।</td></tr>}</tbody></table></div>
            </>; })()}
          </section>}
          {profileTab === 'Transport Info' && <section style={styles.panel}>
            {panelHeader('Transport Info / यातायात विवरण', 'Bus route, stop, driver contact, pickup/drop time र bus fee।')}
            <form onSubmit={saveStudentTransport}><div style={styles.formGrid}>
              {textField('Bus Route No', transportForm.busRouteNo || '', value => setTransportForm(current => ({ ...current, busRouteNo: value })), { maxLength: 50 })}
              {textField('Stop Name', transportForm.stopName || '', value => setTransportForm(current => ({ ...current, stopName: value })), { maxLength: 150 })}
              {textField('Bus Driver Contact', transportForm.driverContact || '', value => setTransportForm(current => ({ ...current, driverContact: value })), { maxLength: 40 })}
              {textField('Pickup Time', transportForm.pickupTime || '', value => setTransportForm(current => ({ ...current, pickupTime: value })), { type: 'time' })}
              {textField('Drop Time', transportForm.dropTime || '', value => setTransportForm(current => ({ ...current, dropTime: value })), { type: 'time' })}
              {textField('Bus Fee (Rs.)', transportForm.busFee ?? '', value => setTransportForm(current => ({ ...current, busFee: value })), { type: 'number', min: '0', step: '0.01' })}
            </div><button type="submit" style={styles.primaryButton} disabled={saving}><FileText size={15} /> Transport Save गर्नुहोस्</button></form>
          </section>}
          {profileTab === 'Discipline & Logs' && <>
            <section style={styles.panel}>{panelHeader('Discipline & Logs / घटना र व्यवहार रेकर्ड', 'Positive / Negative घटना, विवरण र action report लेख्नुहोस्।')}
              <form onSubmit={saveDisciplineLog}><div style={styles.formGrid}>
                <div><label style={styles.label}>Incident Date (AD)<input type="date" required style={styles.input} value={disciplineForm.incidentDate} onChange={e => setDisciplineForm(current => ({ ...current, incidentDate: e.target.value }))} /></label><small style={{ display: 'block', color: '#64748b', marginTop: -10, marginBottom: 14 }}>नेपाली मिति (BS): {toBS(disciplineForm.incidentDate)}</small></div>
                {selectField('Badge / प्रकार', disciplineForm.category, value => setDisciplineForm(current => ({ ...current, category: value })), [{ value: 'positive', label: 'Positive / प्रशंसनीय' }, { value: 'negative', label: 'Negative / अनुशासन घटना' }])}
                {textField('Title *', disciplineForm.title, value => setDisciplineForm(current => ({ ...current, title: value })), { required: true, maxLength: 200 })}
                <label style={styles.label}>Incident / विवरण<textarea style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} value={disciplineForm.description} onChange={e => setDisciplineForm(current => ({ ...current, description: e.target.value }))} /></label>
                <label style={styles.label}>Action Report / गरिएको कारबाही<textarea style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} value={disciplineForm.actionReport} onChange={e => setDisciplineForm(current => ({ ...current, actionReport: e.target.value }))} /></label>
              </div><button type="submit" style={styles.primaryButton} disabled={saving}><Plus size={15} /> Log Save गर्नुहोस्</button></form>
            </section>
            <section style={styles.panel}>{panelHeader('Incident History', `${profileData.disciplineLogs.length} logs`)}<div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Date (BS/AD)', 'Badge', 'Title', 'Details', 'Action Report'].map(h => <th key={h} style={{ padding: 10, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>{profileData.disciplineLogs.map(log => <tr key={log.id}><td style={{ padding: 10 }}><strong>{toBS(formatDateAD(log.incident_date))}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatDateAD(log.incident_date)}</small></td><td style={{ padding: 10 }}><span style={{ ...styles.typeBadge, background: log.category === 'positive' ? '#d1fae5' : '#fee2e2', color: log.category === 'positive' ? '#065f46' : '#991b1b' }}>{log.category}</span></td><td style={{ padding: 10 }}>{log.title}</td><td style={{ padding: 10 }}>{log.description || '—'}</td><td style={{ padding: 10 }}>{log.action_report || '—'}</td></tr>)}{!profileData.disciplineLogs.length && <tr><td colSpan="5" style={styles.emptyCell}>अहिलेसम्म log छैन।</td></tr>}</tbody></table></div></section>
          </>}
          {profileTab === 'Teacher Remarks' && <>
            <section style={styles.panel}>{panelHeader('Teacher Remarks / शिक्षकको टिप्पणी', 'Terminal remarks, academic feedback र parent communications सुरक्षित गर्नुहोस्।')}
              <form onSubmit={saveTeacherRemark}><div style={styles.formGrid}>
                <div><label style={styles.label}>Remark Date (AD)<input type="date" required style={styles.input} value={remarkForm.remarkDate} onChange={e => setRemarkForm(current => ({ ...current, remarkDate: e.target.value }))} /></label><small style={{ display: 'block', color: '#64748b', marginTop: -10, marginBottom: 14 }}>नेपाली मिति (BS): {toBS(remarkForm.remarkDate)}</small></div>
                <label style={styles.label}>Terminal Remarks<textarea style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} value={remarkForm.terminalRemarks} onChange={e => setRemarkForm(current => ({ ...current, terminalRemarks: e.target.value }))} /></label>
                <label style={styles.label}>Academic Feedback<textarea style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} value={remarkForm.academicFeedback} onChange={e => setRemarkForm(current => ({ ...current, academicFeedback: e.target.value }))} /></label>
                <label style={styles.label}>Parent Communications<textarea style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} value={remarkForm.parentCommunication} onChange={e => setRemarkForm(current => ({ ...current, parentCommunication: e.target.value }))} /></label>
              </div><button type="submit" style={styles.primaryButton} disabled={saving}><Plus size={15} /> Remark Save गर्नुहोस्</button></form>
            </section>
            <section style={styles.panel}>{panelHeader('Saved Remarks', `${profileData.teacherRemarks.length} records`)}<div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Date (BS/AD)', 'Terminal Remarks', 'Academic Feedback', 'Parent Communication'].map(h => <th key={h} style={{ padding: 10, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>{profileData.teacherRemarks.map(item => <tr key={item.id}><td style={{ padding: 10 }}><strong>{toBS(formatDateAD(item.remark_date))}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatDateAD(item.remark_date)}</small></td><td style={{ padding: 10 }}>{item.terminal_remarks || '—'}</td><td style={{ padding: 10 }}>{item.academic_feedback || '—'}</td><td style={{ padding: 10 }}>{item.parent_communication || '—'}</td></tr>)}{!profileData.teacherRemarks.length && <tr><td colSpan="4" style={styles.emptyCell}>अहिलेसम्म remark छैन।</td></tr>}</tbody></table></div></section>
          </>}
        </>}
      </>}

      {tab === 'Fee Titles' && <>
        <section style={styles.panel}>
          {panelHeader('Fee Title बनाउनुहोस्', 'प्रत्येक Fee Title लाई Income Ledger सँग link गर्नुहोस्। Receipt काट्दा सोही ledger मा income post हुन्छ।')}
          <form onSubmit={createFeeTitle}>
            <div style={styles.formGrid}>
              {textField('Fee Code *', titleCode, setTitleCode, { required: true, placeholder: 'TUITION' })}
              {textField('Fee Title *', titleName, setTitleName, { required: true, placeholder: 'Tuition Fee' })}
              {selectField('Income Ledger *', incomeAccountId, setIncomeAccountId, incomeAccounts.map(a => ({ value: String(a.id), label: `${a.code} - ${a.name}` })), incomeAccounts.length ? 'Income Ledger छान्नुहोस्' : 'पहिले Income Ledger बनाउनुहोस्')}
              {textField('Default Monthly Amount (Rs.) *', defaultAmount, setDefaultAmount, { required: true, type: 'number', min: '0', step: '0.01' })}
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '0 0 18px', fontSize: 13, color: '#334155' }}><input type="checkbox" checked={isMonthly} onChange={e => setIsMonthly(e.target.checked)} /> प्रत्येक महिनाको bill मा default रूपमा monthly fee title मान्ने</label>
            <button type="submit" style={styles.primaryButton} disabled={saving || !incomeAccounts.length}><Plus size={16} /> Fee Title Save</button>
          </form>
        </section>
        <section style={styles.panel}>
          {panelHeader('Fee Title Register', `${feeTitles.length} titles`)}
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Code', 'Fee Title', 'Income Ledger', 'Default Amount', 'Monthly', 'Status'].map(h => <th key={h} style={{ padding: 12, background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}</tr></thead><tbody>
            {feeTitles.map(t => <tr key={t.id}><td style={{ padding: 12 }}>{t.title_code}</td><td style={{ padding: 12, fontWeight: 600 }}>{t.title}</td><td style={{ padding: 12 }}>{t.income_account_code} - {t.income_account_name}</td><td style={{ padding: 12, textAlign: 'right' }}>{money(t.default_amount)}</td><td style={{ padding: 12 }}>{t.is_monthly ? 'Yes' : 'No'}</td><td style={{ padding: 12 }}>{t.is_active ? 'Active' : 'Inactive'}</td></tr>)}
            {!feeTitles.length && <tr><td colSpan="6" style={styles.emptyCell}>पहिले Fee Title दर्ता गर्नुहोस्।</td></tr>}
          </tbody></table></div>
        </section>
      </>}

      {tab === 'Monthly Bill' && <>
        <section style={styles.panel}>
          {panelHeader('Generate Monthly Fee Bill / मासिक शुल्क बिल', 'नेपाली शैक्षिक महिनाअनुसार bill बनाउनुहोस्। एक विद्यार्थीको bill वा सबै सक्रिय विद्यार्थीको bill एकैपटक generate गर्न सकिन्छ। एउटै विद्यार्थी/महिनाको duplicate bill स्वतः skip हुन्छ।')}
          <form onSubmit={createMonthlyBill}>
            <div style={styles.formGrid}>
              {selectField('एक विद्यार्थीका लागि *', billStudentId, setBillStudentId, activeStudents.map(s => ({ value: String(s.id), label: `${(s.reg_no || s.admission_no)} · ${s.student_name} · कक्षा ${s.class_name}-${s.section} · रोल ${s.roll_number}` })), 'विद्यार्थी छान्नुहोस्')}
              <div>
                <label style={styles.label}>नेपाली महिना (वि.सं.) *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <select style={styles.input} value={billMonthYearPart} onChange={e => setBillMonthBS(`${e.target.value}-${String(billMonthNumberPart || '01').padStart(2, '0')}`)} required>
                    {bsYearOptions.map(year => <option key={year} value={String(year)}>{toNepaliDigits(year)}</option>)}
                  </select>
                  <select style={styles.input} value={String(billMonthNumberPart || '01').padStart(2, '0')} onChange={e => setBillMonthBS(`${billMonthYearPart}-${e.target.value}`)} required>
                    {BS_MONTH_NAMES.map((name, index) => <option key={name} value={String(index + 1).padStart(2, '0')}>{name}</option>)}
                  </select>
                </div>
                <small style={{ display: 'block', color: '#64748b', marginTop: -10, marginBottom: 14 }}>छानिएको महिना: <strong>{formatBSMonth(billMonthBS) || '—'}</strong> · आन्तरिक मिति अवधि: {billMonthRange ? `${billMonthRange.start} देखि ${billMonthRange.end}` : 'मिति छान्नुहोस्'}</small>
              </div>
              <div>
                <label style={styles.label}>Due Date (वि.सं.)</label>
                <input style={styles.input} value={billDueDateBS} onChange={e => setBillDueDateBS(e.target.value)} placeholder="२०८३-०८-१५" inputMode="numeric" />
                <small style={{ display: 'block', color: '#64748b', marginTop: -10, marginBottom: 14 }}>नेपाली मिति YYYY-MM-DD मा लेख्नुहोस्। {billDueDateBS ? `AD: ${fromBS(billDueDateBS) || 'मिति मिलेन'}` : 'खाली छोडे due date राखिँदैन।'}</small>
              </div>
            </div>
            <h3 style={{ fontSize: 14, margin: '14px 0', color: '#334155' }}>Bill मा समावेश गर्ने Fee Titles (सबै विद्यार्थीमा यही दर लागू हुन्छ)</h3>
            {!feeTitles.filter(t => t.is_active !== false).length && <Notice type="error" message="पहिले Fee Titles tab मा Fee Title बनाउनुहोस्। प्रत्येक title मा Income Ledger link हुनुपर्छ।" />}
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr><th style={{ padding: 12, background: '#f8fafc' }}>समावेश</th><th style={{ padding: 12, background: '#f8fafc' }}>Fee Title</th><th style={{ padding: 12, background: '#f8fafc' }}>Income Ledger</th><th style={{ padding: 12, background: '#f8fafc', textAlign: 'right' }}>बिल रकम</th></tr></thead><tbody>
              {feeTitles.filter(t => t.is_active !== false).map(t => {
                const picked = selectedBillItems.find(item => Number(item.feeTitleId) === Number(t.id));
                return <tr key={t.id}><td style={{ padding: 12 }}><input type="checkbox" checked={Boolean(picked)} onChange={() => toggleBillItem(t)} /></td><td style={{ padding: 12, fontWeight: 600 }}>{t.title}{t.is_monthly && <small style={{ display: 'block', color: '#64748b' }}>मासिक</small>}</td><td style={{ padding: 12 }}>{t.income_account_code} - {t.income_account_name}</td><td style={{ padding: 12, minWidth: 170 }}><input style={{ ...styles.input, marginBottom: 0, textAlign: 'right' }} type="number" min="0.01" step="0.01" disabled={!picked} value={picked?.amount ?? t.default_amount ?? ''} onChange={e => updateBillItemAmount(t.id, e.target.value)} /></td></tr>;
              })}
            </tbody><tfoot><tr><td colSpan="3" style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>प्रति विद्यार्थी जम्मा</td><td style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>{money(selectedBillTotal)}</td></tr></tfoot></table></div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              <button type="submit" style={styles.primaryButton} disabled={saving || !billStudentId || !selectedBillItems.length || !billMonthAD}><FileText size={16} /> {saving ? 'बिल बनाउँदै...' : 'छानिएको विद्यार्थीको बिल बनाउनुहोस्'}</button>
              <button type="button" style={styles.secondaryButton} onClick={createMonthlyBillsForAll} disabled={saving || !activeStudents.length || !selectedBillItems.length || !billMonthAD}><Users size={16} /> {saving ? 'सबैको बिल बनाउँदै...' : `${activeStudents.length} सक्रिय विद्यार्थीको बिल एकैपटक बनाउनुहोस्`}</button>
            </div>
            <p style={{ margin: '12px 0 0', fontSize: 12, color: '#64748b' }}>Bulk generation मा एउटै नेपाली महिना र चयन गरिएका Fee Titles/रकम सबै सक्रिय विद्यार्थीमा लागू हुन्छ। पहिले बिल बनिसकेका विद्यार्थीलाई skip गरिन्छ; उनीहरूको bill दोहोरिँदैन। कक्षा अनुसार फरक शुल्क चाहिने भए अलग fee structure आवश्यक हुन्छ।</p>
          </form>
        </section>
        <section style={styles.panel}>
          {panelHeader('Fee Bill Register / शुल्क बिल दर्ता', `${filteredBills.length} bills`, <select aria-label="नेपाली महिना अनुसार filter" style={{ ...styles.input, maxWidth: 220, marginBottom: 0 }} value={selectedBillFilterMonth} onChange={e => setSelectedBillFilterMonth(e.target.value)}><option value="">सबै नेपाली महिना</option>{bsYearOptions.flatMap(year => BS_MONTH_NAMES.map((name, index) => { const value = `${year}-${String(index + 1).padStart(2, '0')}`; return <option key={value} value={value}>{name} {toNepaliDigits(year)}</option>; }))}</select>)}
          <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Bill No', 'नेपाली महिना', 'Reg No', 'विद्यार्थी', 'कक्षा/सेक्सन', 'बिल', 'तिरेको', 'बाँकी', 'Status'].map(h => <th key={h} style={{ padding: 12, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>
            {filteredBills.map(b => <tr key={b.id}><td style={{ padding: 12, fontWeight: 600 }}>{b.bill_number}</td><td style={{ padding: 12 }}><strong>{formatBSMonth((toBS(String(b.fee_month).slice(0, 10)) || '').slice(0, 7)) || '—'}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatBSDateLabel(b.fee_month)}</small></td><td style={{ padding: 12 }}>{(b.reg_no || b.admission_no)}</td><td style={{ padding: 12 }}>{b.student_name}</td><td style={{ padding: 12 }}>{b.class_name}-{b.section} / {b.roll_number}</td><td style={{ padding: 12, textAlign: 'right' }}>{money(b.total_amount)}</td><td style={{ padding: 12, textAlign: 'right' }}>{money(b.total_received)}</td><td style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>{money(b.balance_due)}</td><td style={{ padding: 12 }}><span style={styles.typeBadge}>{b.status}</span></td></tr>)}
            {!filteredBills.length && <tr><td colSpan="9" style={styles.emptyCell}>यस नेपाली महिनामा Bill छैन।</td></tr>}
          </tbody></table></div>
        </section>
      </>}

      {tab === 'Receive Fee' && <>
        <section style={styles.panel}>
          {panelHeader('Receive Student Fee / Receipt', 'Receipt save भएपछि Cash/Bank Debit र चयन गरिएको Fee Title को Income Ledger Credit गरी Journal Entry स्वतः बन्छ।')}
          <form onSubmit={createReceipt}>
            <div style={styles.formGrid}>
              <label style={styles.label}>Receipt Number (auto)<input style={{ ...styles.input, background: '#f8fafc', fontWeight: 700 }} value={receiptNumberPreview} readOnly /></label>
              {selectField('Due Bill *', receiptBillId, value => { setReceiptBillId(value); const found = bills.find(b => String(b.id) === String(value)); setReceiptAmount(found ? String(found.balance_due) : ''); }, outstandingBills.map(b => ({ value: String(b.id), label: `${b.bill_number} · ${b.student_name} · ${(b.reg_no || b.admission_no)} · Due ${money(b.balance_due)}` })), 'बाँकी bill छान्नुहोस्')}
              <div><label style={styles.label}>Receipt Date (AD) / रसिद मिति *<input style={styles.input} value={receiptDate} onChange={e => setReceiptDate(e.target.value)} required type="date" /></label><small style={{ display: 'block', color: '#64748b', marginTop: -10, marginBottom: 14 }}>नेपाली मिति (BS): {receiptDate ? toBS(receiptDate) : '—'}</small></div>
              {selectField('Payment Mode *', paymentMethod, setPaymentMethod, [{ value: 'cash', label: 'Cash / नगद' }, { value: 'bank', label: 'Bank / बैंक' }])}
              {selectField('Cash / Bank Ledger *', paymentAccountId, setPaymentAccountId, displayedPaymentAccounts.map(a => ({ value: String(a.id), label: `${a.code} - ${a.name}` })), displayedPaymentAccounts.length ? 'Cash/Bank Ledger छान्नुहोस्' : 'पहिले Asset Ledger बनाउनुहोस्')}
              {textField('Received Amount (Rs.) *', receiptAmount, setReceiptAmount, { required: true, type: 'number', min: '0.01', max: selectedBill?.balance_due ?? undefined, step: '0.01' })}
              {textField('Remarks', receiptNotes, setReceiptNotes, { placeholder: 'Optional' })}
            </div>
            {selectedBill && <div style={styles.balanceStatus}><span>Student: {selectedBill.student_name}</span><span>Bill: {selectedBill.bill_number}</span><span>Balance: {money(selectedBill.balance_due)}</span></div>}
            <button type="submit" style={styles.primaryButton} disabled={saving || !receiptBillId || !paymentAccountId || !Number(receiptAmount)}><ReceiptText size={16} /> {saving ? 'Saving Receipt...' : 'Receipt काट्नुहोस् र Income Post गर्नुहोस्'}</button>
          </form>
          {lastReceipt && <div style={{ ...styles.notice, ...styles.infoNotice, marginTop: 18, marginBottom: 0, justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span><strong>{lastReceipt.receipt_number}</strong> · {lastReceipt.student_name} · {money(lastReceipt.total_amount)} · Journal ID: {lastReceipt.journal_entry_id}</span>
            <button type="button" style={styles.secondaryButton} onClick={() => printStudentReceipt(lastReceipt)}><Printer size={15} /> Receipt Print</button>
          </div>}
        </section>
      </>}

      {tab === 'Student Ledger' && <>
        <section style={styles.panel}>
          {panelHeader('Student Fee Ledger', 'एक विद्यार्थीको सबै bills, receipts, received amount र बाँकी रकम एकै ठाउँमा।')}
          <div style={{ ...styles.formGrid, alignItems: 'end' }}>
            {selectField('विद्यार्थी छान्नुहोस्', ledgerStudentId, setLedgerStudentId, students.map(s => ({ value: String(s.id), label: `${(s.reg_no || s.admission_no)} · ${s.student_name} · ${s.class_name}-${s.section} / ${s.roll_number}` })), 'विद्यार्थी छान्नुहोस्')}
            <div style={{ paddingBottom: 16 }}><button type="button" style={styles.primaryButton} onClick={() => loadStudentLedger()} disabled={!ledgerStudentId || loading}><Search size={15} /> Ledger हेर्नुहोस्</button></div>
          </div>
          {ledger && <>
            <div style={styles.metricsGrid}>
              <Metric title="Total Billed / जम्मा बिल" value={money(ledger.totals.billed)} note={`${(ledger.student.reg_no || ledger.student.admission_no)} · ${ledger.student.student_name}`} icon={<FileText size={19} />} color="#ff4fa3" bg="#eef2ff" />
              <Metric title="Total Received / जम्मा प्राप्त" value={money(ledger.totals.received)} note="Receipt बाट accounting posting" icon={<Wallet size={19} />} color="#059669" bg="#d1fae5" />
              <Metric title="Balance Due / बाँकी" value={money(ledger.totals.balance)} note={`${ledger.student.class_name}-${ledger.student.section} · Roll ${ledger.student.roll_number}`} icon={<AlertCircle size={19} />} color="#d97706" bg="#fef3c7" />
            </div>
            <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Date (BS/AD)', 'Type', 'Ref No.', 'Description', 'Billed', 'Received', 'Running Balance'].map(h => <th key={h} style={{ padding: 12, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>
              {ledger.rows.map((row, idx) => <tr key={`${row.entry_type}-${row.reference}-${idx}`}><td style={{ padding: 12 }}><strong>{toBS(formatDateAD(row.entry_date))}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatDateAD(row.entry_date)}</small></td><td style={{ padding: 12 }}><span style={styles.typeBadge}>{row.entry_type}</span></td><td style={{ padding: 12, fontWeight: 600 }}>{row.reference}</td><td style={{ padding: 12 }}>{row.description}</td><td style={{ padding: 12, textAlign: 'right' }}>{Number(row.billed) ? money(row.billed) : '—'}</td><td style={{ padding: 12, textAlign: 'right' }}>{Number(row.received) ? money(row.received) : '—'}</td><td style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>{money(row.running_balance)}</td></tr>)}
              {!ledger.rows.length && <tr><td colSpan="7" style={styles.emptyCell}>यो विद्यार्थीको billing/receipt history छैन।</td></tr>}
            </tbody></table></div>
          </>}
        </section>
      </>}

      {tab === 'Receipt Register' && <section style={styles.panel}>
        {panelHeader('Saved Fee Receipts', `${receipts.length} receipts`, <button type="button" style={styles.secondaryButton} onClick={reloadAll} disabled={loading}><RefreshCw size={15} /> Refresh</button>)}
        <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{['Receipt No.', 'Date (BS/AD)', 'Student', 'Class/Section', 'Bill No.', 'Mode', 'Paid To', 'Amount', 'Print'].map(h => <th key={h} style={{ padding: 12, background: '#f8fafc' }}>{h}</th>)}</tr></thead><tbody>
          {receipts.map(r => <tr key={r.id}><td style={{ padding: 12, fontWeight: 700 }}>{r.receipt_number}</td><td style={{ padding: 12 }}><strong>{toBS(formatDateAD(r.receipt_date))}</strong><small style={{ display: 'block', color: '#64748b' }}>{formatDateAD(r.receipt_date)}</small></td><td style={{ padding: 12 }}>{r.student_name}<small style={{ display: 'block', color: '#64748b' }}>{(r.reg_no || r.admission_no)}</small></td><td style={{ padding: 12 }}>{r.class_name}-{r.section} / {r.roll_number}</td><td style={{ padding: 12 }}>{r.bill_number}</td><td style={{ padding: 12 }}>{String(r.payment_method).toUpperCase()}</td><td style={{ padding: 12 }}>{r.payment_account_name}</td><td style={{ padding: 12, textAlign: 'right', fontWeight: 700 }}>{money(r.total_amount)}</td><td style={{ padding: 12 }}><button type="button" style={styles.secondaryButton} onClick={() => printStudentReceipt(r)}><Printer size={15} /> Print</button></td></tr>)}
          {!receipts.length && <tr><td colSpan="9" style={styles.emptyCell}>अहिलेसम्म Receipt काटिएको छैन।</td></tr>}
        </tbody></table></div>
      </section>}
    </section>
  );
}


function Placeholder({ title, setActive }) {
  return (
    <section style={{ ...styles.panel, textAlign: 'center', padding: '60px 20px' }}>
      <div style={styles.eyebrow}>Module Workspace</div>
      <h1 style={{ ...styles.h1, marginTop: '8px' }}>{title}</h1>
      <p style={{ color: '#64748b', marginBottom: '24px' }}>यो मोड्युल छिट्टै पूर्ण रूपमा सञ्चालनमा आउनेछ।</p>
      <button
        style={styles.primaryButton}
        onClick={() => setActive('Dashboard')}
      >
        Dashboard मा फर्कनुहोस्
      </button>
    </section>
  );
}

export default function App() {
  const [showPortfolio, setShowPortfolio] = useState(true);
  const [user, setUser] = useState(null);
  const [active, setActive] = useState('Dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [transactions, setTransactions] = useState([]);

  async function loadAccounts() {
    setLoading(true);
    setAccountsError('');

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/accounts?organizationId=${ORGANIZATION_ID}`
      );
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Accounts load भएन।');
      }

      if (!Array.isArray(data)) {
        throw new Error('API बाट accounts list आएन।');
      }

      setAccounts(data.map(normalizeAccount));
    } catch (e) {
      console.error('Accounts loading error:', e);
      setAccountsError(e.message || 'Accounts load गर्दा समस्या आयो।');
    } finally {
      setLoading(false);
    }
  }
async function loadTodayTransactions() {
  const today = getTodayAD();

  try {
    const query = new URLSearchParams({
      organizationId: String(ORGANIZATION_ID),
      from: today,
      to: today
    });

    const response = await fetch(
      `${API_BASE_URL}/api/journal-entries?${query}`
    );

    const data = await response.json().catch(() => []);

    if (!response.ok) {
      throw new Error(
        data.message || 'आजका कारोबार लोड गर्न सकिएन।'
      );
    }

    if (!Array.isArray(data)) {
      throw new Error('Journal API बाट सही सूची आएन।');
    }

    setTransactions(data.map(entry => ({
      id: Number(entry.id),
      date: String(entry.entry_date || '').slice(0, 10),
      ref: entry.voucher_number || '',
      description: entry.description || '',
      category: entry.voucher_type || 'Journal Voucher',
      method: 'Journal',
      amount: Number(
        entry.total_debit ?? entry.total_credit ?? 0
      ),
      positive: true
    })));
  } catch (error) {
    console.error(
      'Today transactions loading error:',
      error
    );
    setTransactions([]);
  }
}
useEffect(() => {
  loadAccounts();
  loadTodayTransactions();
}, []);
async function handleVoucherSaved() {
  await loadTodayTransactions();
}
  if (showPortfolio) return <PortfolioDashboard onOpenSchool={() => setShowPortfolio(false)} />;
  if (!user) return <LoginSystem onLogin={setUser} />;

  const pageTitle = active === 'Dashboard'
    ? 'Dashboard'
    : active;

  return (
    <div style={styles.appShell} className="ledgerpro-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;500;600;700;800&family=Noto+Sans:wght@400;500;600;700;800&display=swap');
        .ledgerpro-shell{color-scheme:dark; min-height:100vh;}
        .ledgerpro-shell *{box-sizing:border-box;}
        .ledgerpro-shell button{font-family:inherit;}
        .ledgerpro-shell button:hover{filter:brightness(1.08);}
        .ledgerpro-shell button:focus-visible,.ledgerpro-shell input:focus-visible,.ledgerpro-shell select:focus-visible{outline:2px solid rgba(34,199,255,.72);outline-offset:2px;}
        .ledgerpro-shell input::placeholder{color:#7183a5;}
        .ledgerpro-shell input:focus,.ledgerpro-shell select:focus{border-color:#3c9fc3!important;box-shadow:0 0 0 3px rgba(34,199,255,.09);}
        .ledgerpro-shell table:not(.exam-print-table){background:#0b1120;border-collapse:separate;border-spacing:0;}
        .ledgerpro-shell table:not(.exam-print-table) thead th{background:linear-gradient(110deg,#211b46,#141a2d);color:#ff68b1;border-bottom:1px solid #39315f;padding:14px 15px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;}
        .ledgerpro-shell table:not(.exam-print-table) tbody td{padding:14px 15px;color:#d0daed;border-bottom:1px solid #1c2539;vertical-align:middle;}
        .ledgerpro-shell table:not(.exam-print-table) tbody tr:nth-child(even) td{background:rgba(21,29,47,.42);}
        .ledgerpro-shell table:not(.exam-print-table) tbody tr:hover td{background:#17172d;}
        .ledgerpro-shell table:not(.exam-print-table) tbody tr:last-child td{border-bottom:0;}
        .ledgerpro-shell ::-webkit-scrollbar{width:9px;height:9px;}
        .ledgerpro-shell ::-webkit-scrollbar-track{background:#090d17;}
        .ledgerpro-shell ::-webkit-scrollbar-thumb{background:#343254;border-radius:20px;border:2px solid #090d17;}
        .ledgerpro-shell ::-webkit-scrollbar-thumb:hover{background:#65538d;}
        @media(max-width:760px){.ledgerpro-shell .contentArea{padding:16px!important}.ledgerpro-shell header{padding-left:15px!important;padding-right:15px!important}.ledgerpro-shell table:not(.exam-print-table){min-width:680px;}}
        @media print{.ledgerpro-shell{background:#fff!important;color:#111!important;color-scheme:light!important}.ledgerpro-shell table:not(.exam-print-table) thead th{background:#f1f1f1!important;color:#111!important}.ledgerpro-shell table:not(.exam-print-table) tbody td{background:#fff!important;color:#111!important;border-color:#bbb!important}}
      `}</style>
      <Sidebar
        active={active}
        setActive={setActive}
        open={menuOpen}
        setOpen={setMenuOpen}
        user={user}
        onLogout={() => setUser(null)}
      />

      <main style={styles.mainContent}>
        <header style={styles.topbar}>
          <button
            style={styles.iconButton}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <Menu size={20} />
          </button>

          <div style={{ flex: 1, color: '#a8b6d2', fontSize: '14px' }}>
            Workspace / <strong style={{ color: '#f4f7ff' }}>{pageTitle}</strong>
          </div>
          <button style={styles.secondaryButton} onClick={() => setShowPortfolio(true)} title="Return to portfolio">Portfolio</button>

          <div style={styles.searchContainer}>
            <Search size={16} color="#64748b" />
            <input
              style={styles.searchInput}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="खाता वा कारोबार खोज्नुहोस्..."
            />
          </div>

          <button style={styles.iconButton} title="Notifications">
            <Bell size={18} color="#475569" />
          </button>
        </header>

        <div style={styles.contentArea}>
          {active === 'Dashboard' && (
            <Dashboard
              accounts={accounts}
              transactions={transactions.filter(t =>
                !search || `${t.ref} ${t.description}`.toLowerCase()
                  .includes(search.toLowerCase())
              )}
              loading={loading}
              error={accountsError}
              onReload={loadAccounts}
            />
          )}

          {active === 'Journal Vouchers' && (
            <>
              {accountsError && <Notice type="error" message={accountsError} />}
              <JournalVoucher
                accounts={accounts}
                onVoucherSaved={handleVoucherSaved}
              />
            </>
          )}

          {active === 'Chart of Accounts' && (
            <ChartOfAccounts
              accounts={accounts}
              loading={loading}
              error={accountsError}
             onReload={() => {
                loadAccounts();
                 loadTodayTransactions();
            }}
            />
          )}

          {active === 'Financial Reports' && (
            <FinancialReports accounts={accounts} />
          )}

          {active === 'Student Fees' && (
            <StudentFees accounts={accounts} onRefreshAccounts={loadAccounts} />
          )}
          {active === 'Student ID Cards' && (

<StudentIdCardModule
    apiBaseUrl={API_BASE_URL}
    organizationId={ORGANIZATION_ID}
  />
)}

          {active === 'Examination & Marksheet' && (
            <ExaminationModule apiBaseUrl={API_BASE_URL} organizationId={ORGANIZATION_ID} user={user} />
          )}
{active === 'User Management' && user?.role === 'admin' && (
  <UserAccessModule apiBaseUrl={API_BASE_URL} />
)}
         {![
  'Dashboard',
  'Journal Vouchers',
  'Chart of Accounts',
  'Financial Reports',
  'Student Fees',
  'Examination & Marksheet',
  'User Management'
].includes(active) && (
  <Placeholder title={active} setActive={setActive} />
)}
        </div>

        <footer style={styles.footer}>
          <span>LedgerPro · School Accounting System</span>
          <span>Logged in as: <strong>{user.email}</strong></span>
        </footer>
      </main>
    </div>
  );
}

const styles = {
  loginPage: {
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: 'radial-gradient(circle at 15% 0%, rgba(87, 40, 130, .35), transparent 35%), linear-gradient(135deg, #07090e 0%, #0b1020 58%, #15102a 100%)',
    padding: 20, fontFamily: "'Noto Sans Devanagari', 'Noto Sans', Inter, Arial, sans-serif"
  },
  loginCard: {
    background: 'linear-gradient(145deg, #111827 0%, #0b1120 100%)', padding: 40,
    borderRadius: 22, width: '100%', maxWidth: 440, boxSizing: 'border-box',
    display: 'grid', gap: 18, color: '#edf3ff',
    boxShadow: '0 24px 80px rgba(0,0,0,.42)', border: '1px solid #292747'
  },
  loginHeaderIcon: {
    width: 60, height: 60, borderRadius: 16,
    background: 'linear-gradient(135deg, rgba(255,79,163,.2), rgba(34,199,255,.16))',
    border: '1px solid rgba(255,79,163,.35)', color: '#ff4fa3',
    display: 'grid', placeItems: 'center', margin: '0 auto 4px'
  },
  loginTitle: { fontSize: 28, fontWeight: 800, textAlign: 'center', margin: 0, color: '#f8fbff', letterSpacing: '-0.04em' },
  loginSubtitle: { textAlign: 'center', margin: '-10px 0 0', color: '#ff67b2', fontWeight: 700, fontSize: 14 },
  loginSubText: { textAlign: 'center', margin: '-14px 0 10px', color: '#9babca', fontSize: 13 },
  demoBadge: { background: '#0a1120', padding: '10px', borderRadius: 9, textAlign: 'center', fontSize: 12, color: '#a8b6d2', border: '1px solid #252b49' },
  appShell: { minHeight: '100vh', display: 'flex', background: '#07090e', color: '#eef3ff', fontFamily: "'Noto Sans Devanagari', 'Noto Sans', Inter, Arial, sans-serif" },
  sidebar: { width: 286, background: 'linear-gradient(180deg, #0d1322 0%, #090d17 100%)', color: '#b7c4dc', padding: '20px 16px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 14, flexShrink: 0, borderRight: '1px solid #232642' },
  sidebarOpen: { position: 'fixed', inset: '0 auto 0 0', zIndex: 30, width: 286, overflowY: 'auto', boxShadow: '10px 0 40px rgba(0,0,0,0.65)' },
  mobileOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 25, backdropFilter: 'blur(3px)' },
  brand: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px 14px', borderBottom: '1px solid #252640' },
  brandIconBox: { width: 38, height: 38, borderRadius: 11, background: 'linear-gradient(135deg, #ff4fa3 0%, #8b5cf6 55%, #22c7ff 100%)', display: 'grid', placeItems: 'center', boxShadow: '0 6px 22px rgba(182,67,210,.24)' },
  workspace: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'linear-gradient(135deg, #161d30, #101726)', borderRadius: 11, fontSize: 13, border: '1px solid #2b2a4c' },
  workspaceIcon: { display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg, #682e95, #35316e)', color: '#fff', fontWeight: 800, fontSize: 12, border: '1px solid #7c3fa3' },
  navScroll: { overflowY: 'auto', flex: 1, paddingRight: '2px' },
  navTitle: { padding: '16px 8px 6px', fontSize: 10, color: '#7183a5', textTransform: 'uppercase', letterSpacing: '.09em', fontWeight: 800 },
  navButton: { display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '11px 12px', border: '1px solid transparent', borderRadius: 9, color: '#a7b5cf', background: 'transparent', textAlign: 'left', cursor: 'pointer', marginBottom: 4, fontSize: 13, fontWeight: 500, transition: 'all 0.18s ease' },
  navActive: { background: 'linear-gradient(100deg, rgba(255,79,163,.17), rgba(100,62,160,.17))', color: '#ff71b8', fontWeight: 700, border: '1px solid rgba(255,79,163,.27)', boxShadow: 'inset 3px 0 0 #ff4fa3, 0 6px 20px rgba(0,0,0,.12)' },
  userCard: { display: 'flex', alignItems: 'center', gap: 10, padding: '11px 9px', background: 'linear-gradient(135deg, #171d30, #0f1524)', borderRadius: 12, border: '1px solid #292746' },
  avatar: { width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #ee4caa, #874ee5)', color: '#fff', fontWeight: 800, flexShrink: 0, fontSize: 14, boxShadow: '0 4px 15px rgba(236,72,153,.18)' },
  logoutButton: { background: 'transparent', color: '#ff6b86', border: 0, padding: 6, cursor: 'pointer', borderRadius: 6, display: 'grid', placeItems: 'center', transition: 'color 0.2s' },
  iconButton: { display: 'inline-grid', placeItems: 'center', background: '#101727', color: '#b7c4dc', border: '1px solid #292d4d', borderRadius: 9, padding: 8, cursor: 'pointer', boxShadow: '0 3px 8px rgba(0,0,0,.13)' },
  mainContent: { minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', background: '#07090e' },
  topbar: { display: 'flex', alignItems: 'center', gap: 14, minHeight: 68, background: 'rgba(8,11,18,.96)', borderBottom: '1px solid #22253f', padding: '10px 28px', boxSizing: 'border-box', boxShadow: '0 4px 20px rgba(0,0,0,.12)' },
  searchContainer: { display: 'flex', alignItems: 'center', gap: 8, background: '#0d1422', border: '1px solid #282c4a', borderRadius: 10, padding: '9px 12px', maxWidth: 320, width: '100%' },
  searchInput: { border: 0, outline: 0, background: 'transparent', minWidth: 0, width: '100%', fontSize: 13, color: '#f2f5ff' },
  contentArea: { padding: 28, flex: 1, width: '100%', maxWidth: 1700, boxSizing: 'border-box', margin: '0 auto' },
  pageHeading: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap', marginBottom: 24 },
  eyebrow: { color: '#ff5aa9', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 7, letterSpacing: '0.045em' },
  h1: { fontSize: 27, margin: '0 0 6px', letterSpacing: '-.035em', color: '#f6f8ff', fontWeight: 800 },
  subtitle: { color: '#9baaca', fontSize: 14, margin: 0, lineHeight: 1.7 },
  metricsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 18, marginBottom: 24 },
  metricCard: { background: 'linear-gradient(145deg, #111827 0%, #0c1220 100%)', border: '1px solid #292747', borderRadius: 20, padding: 22, boxShadow: '0 12px 30px rgba(0,0,0,.16)', minWidth: 0, transition: 'transform 0.2s, box-shadow 0.2s' },
  metricTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metricTitleText: { fontSize: 13, color: '#b0bdd5', fontWeight: 700 },
  metricIcon: { width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 13, flexShrink: 0, border: '1px solid rgba(255,255,255,.07)' },
  metricValue: { fontSize: 25, fontWeight: 800, margin: '14px 0 6px', overflowWrap: 'anywhere', color: '#f6f8ff', letterSpacing: '-0.025em' },
  metricNote: { color: '#8da0bf', fontSize: 12, lineHeight: 1.6 },
  panel: { background: 'linear-gradient(145deg, #101827 0%, #0b1120 100%)', border: '1px solid #292747', borderRadius: 20, padding: 25, marginBottom: 24, minWidth: 0, boxShadow: '0 14px 36px rgba(0,0,0,.17)' },
  panelHeading: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', marginBottom: 18 },
  panelTitle: { fontSize: 18, fontWeight: 800, color: '#f3f6ff', margin: 0, letterSpacing: '-0.02em' },
  panelDesc: { fontSize: 13, color: '#94a5c2', margin: '4px 0 0', lineHeight: 1.6 },
  countBadge: { borderRadius: 20, padding: '5px 12px', background: 'rgba(255,79,163,.12)', color: '#ff6cb7', fontSize: 12, fontWeight: 800, border: '1px solid rgba(255,79,163,.34)' },
  tableWrap: { width: '100%', overflowX: 'auto', borderRadius: 12, border: '1px solid #262848' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 700, textAlign: 'left', background: '#0b1120' },
  emptyCell: { textAlign: 'center', padding: 40, color: '#8d9fbd', fontStyle: 'italic' },
  label: { display: 'grid', gap: 7, marginBottom: 16, fontSize: 13, fontWeight: 700, color: '#c3cee4' },
  input: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '11px 14px', border: '1px solid #2b3152', borderRadius: 10, background: '#0a1120', color: '#f2f5ff', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s' },
  selectInput: { width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '11px 14px', border: '1px solid #2b3152', borderRadius: 10, background: '#0a1120', color: '#f2f5ff', fontSize: '13px', outline: 'none', cursor: 'pointer' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 18 },
  primaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 20px', border: '1px solid rgba(34,199,255,.35)', borderRadius: 10, background: 'linear-gradient(135deg, #146a91 0%, #3b2b73 100%)', color: '#fff', fontWeight: 800, cursor: 'pointer', fontSize: '14px', boxShadow: '0 7px 20px rgba(34,199,255,.12)', transition: 'all 0.2s' },
  secondaryButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 16px', border: '1px solid #303453', borderRadius: 10, background: '#111827', color: '#cad5e9', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'background 0.2s' },
  dangerButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, border: '1px solid rgba(255,94,112,.35)', borderRadius: 8, color: '#ff7283', background: 'rgba(255,94,112,.1)', cursor: 'pointer', transition: 'background 0.2s' },
  disabledDangerButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 8, border: '1px solid #252b43', borderRadius: 8, color: '#697995', background: '#111827', cursor: 'not-allowed', opacity: 0.6 },
  balanceStatus: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 11, margin: '20px 0', fontWeight: 700, fontSize: 13, border: '1px solid rgba(34,199,255,.26)', background: 'rgba(34,199,255,.08)', color: '#a9eaff' },
  notice: { display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderRadius: 10, marginBottom: 18, fontSize: 13, border: '1px solid' },
  infoNotice: { background: 'rgba(34,199,255,.08)', color: '#a9eaff', borderColor: 'rgba(34,199,255,.28)' },
  errorNotice: { background: 'rgba(255,94,112,.1)', color: '#ffc3cb', borderColor: 'rgba(255,94,112,.35)' },
  error: { color: '#ff7c8b', fontSize: 13, margin: '4px 0 12px', fontWeight: 600 },
  reportTabs: { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  reportTab: { display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, border: '1px solid #2a2e4d', background: '#101727', color: '#b5c2da', cursor: 'pointer', fontWeight: 700, fontSize: '13px', boxShadow: '0 2px 7px rgba(0,0,0,.12)' },
  reportTabActive: { borderColor: 'rgba(255,79,163,.55)', color: '#ff71b8', background: 'rgba(255,79,163,.12)', fontWeight: 800, boxShadow: '0 3px 12px rgba(255,79,163,.08)' },
  dateBadge: { background: 'rgba(105,84,201,.20)', padding: '4px 8px', borderRadius: 7, fontSize: '12px', color: '#d9d2ff', fontWeight: 700, border: '1px solid rgba(136,121,255,.28)' },
  typeBadge: { background: 'rgba(34,199,255,.12)', padding: '4px 8px', borderRadius: 7, fontSize: '11px', color: '#55d7ff', fontWeight: 800, display: 'inline-block', border: '1px solid rgba(34,199,255,.25)' },
  statusBadge: { background: 'rgba(21,217,162,.12)', color: '#3ee7ba', padding: '4px 9px', borderRadius: 8, fontSize: '11px', fontWeight: 800, border: '1px solid rgba(21,217,162,.25)' },
  footer: { display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '18px 28px', background: '#090d17', borderTop: '1px solid #222640', color: '#8da0bf', fontSize: 12 }
};
