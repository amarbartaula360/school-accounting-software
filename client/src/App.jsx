import { useEffect, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import {
  LayoutDashboard, BookOpen, ReceiptText, GraduationCap, Utensils,
  Package, Users, Landmark, ChartNoAxesCombined, Settings, Search,
  Bell, ArrowUpRight, ArrowDownRight, Wallet, CreditCard, TrendingUp,
  Menu, ChevronDown, Plus, Trash2, RefreshCw, Printer, FileText,
  LogIn, LogOut, CalendarDays, AlertCircle, CheckCircle2
} from 'lucide-react';

const API_BASE_URL = 'https://school-accounting-software.onrender.com';
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
  { label: 'Payroll & Staff', icon: Users },
  { label: 'Hostel & Canteen', icon: Utensils },
  { label: 'Purchases & Inventory', icon: Package },
  { label: 'Sales & Receipts', icon: CreditCard }
];

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
  const [email, setEmail] = useState('amar@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  function login(e) {
    e.preventDefault();
    setError('');

    if (
      email.trim().toLowerCase() === 'amar@gmail.com' &&
      password === '@Amar123'
    ) {
      onLogin({ name: 'Amar Bartaula', email: 'amar@gmail.com' });
    } else {
      setError(
        'इमेल वा पासवर्ड मिलेन। यो demo login हो; production login backend मा बनाउनुपर्छ।'
      );
    }
  }

  return (
    <div style={styles.loginPage}>
      <form onSubmit={login} style={styles.loginCard}>
        <div style={styles.loginHeaderIcon}>
          <Landmark size={32} color="#4f46e5" />
        </div>
        <h1 style={styles.loginTitle}>LedgerPro</h1>
        <p style={styles.loginSubtitle}>United English Boarding School</p>
        <p style={styles.loginSubText}>विद्यालय लेखा व्यवस्थापन प्रणाली</p>

        <label style={styles.label}>
          इमेल / Email
          <input
            style={styles.input}
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </label>

        <label style={styles.label}>
          पासवर्ड / Password
          <input
            style={styles.input}
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p style={styles.error}>{error}</p>}

        <button style={styles.primaryButton} type="submit">
          <LogIn size={17} /> Login गर्नुहोस्
        </button>

        <div style={styles.demoBadge}>
          Demo password: <strong>@Amar123</strong>
        </div>
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

      <aside style={{
        ...styles.sidebar,
        ...(open ? styles.sidebarOpen : {})
      }}>
        <div style={styles.brand}>
          <div style={styles.brandIconBox}>
            <Landmark size={22} color="#fff" />
          </div>
          <div>
            <strong style={{ fontSize: '16px', letterSpacing: '-0.02em', color: '#f8fafc' }}>LedgerPro</strong>
            <small style={{ display: 'block', color: '#94a3b8', fontSize: '10px', fontWeight: 600, letterSpacing: '0.05em' }}>
              SCHOOL FINANCE
            </small>
          </div>
        </div>

        <div style={styles.workspace}>
          <div style={styles.workspaceIcon}>UE</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong style={{ display: 'block', color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>United English</strong>
            <small style={{ display: 'block', color: '#94a3b8', fontSize: '11px' }}>School Accounting</small>
          </div>
          <ChevronDown size={14} color="#64748b" />
        </div>

        <nav style={styles.navScroll}>
          {navigation.map((item, index) =>
            item.title ? (
              <div key={`${item.title}-${index}`} style={styles.navTitle}>
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
                  ...(active === item.label ? styles.navActive : {})
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
              <strong style={{ display: 'block', color: '#e2e8f0', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name || 'User'}</strong>
              <small style={{ display: 'block', color: '#94a3b8', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          color="#059669"
          bg="#ecfdf5"
        />
        <Metric
          title="कुल खर्च / Total Expenses"
          value={money(totalExpenses)}
          note="खर्च खाताहरूको उपलब्ध balance"
          icon={<ArrowDownRight size={20} />}
          color="#dc2626"
          bg="#fef2f2"
        />
        <Metric
          title="नगद तथा बैंक / Cash & Bank"
          value={money(cashBank)}
          note="नगद तथा बैंक खाताहरूको उपलब्ध balance"
          icon={<Wallet size={20} />}
          color="#4f46e5"
          bg="#eef2ff"
        />
        <Metric
          title="खाता संख्या / Accounts"
          value={accounts.length.toLocaleString('en-IN')}
          note="लोड भएका खाताहरू"
          icon={<BookOpen size={20} />}
          color="#d97706"
          bg="#fffbeb"
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
                  <td><strong style={{ color: '#334155' }}>{t.ref || '-'}</strong></td>
                  <td>{t.description}</td>
                  <td><span style={styles.typeBadge}>{t.category || 'Journal Voucher'}</span></td>
                  <td><strong style={{ color: '#0f172a' }}>{t.amount || money(t.debit || t.credit)}</strong></td>
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
                    color="#4f46e5"
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
                color="#4f46e5"
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

  useEffect(() => {
    loadAccounts();
  }, []);

  function handleVoucherSaved(transaction) {
    setTransactions(prev => [transaction, ...prev]);
  }

  if (!user) return <LoginSystem onLogin={setUser} />;

  const pageTitle = active === 'Dashboard'
    ? 'Dashboard'
    : active;

  return (
    <div style={styles.appShell}>
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

          <div style={{ flex: 1, color: '#475569', fontSize: '14px' }}>
            Workspace / <strong style={{ color: '#0f172a' }}>{pageTitle}</strong>
          </div>

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
              onReload={loadAccounts}
            />
          )}

          {active === 'Financial Reports' && (
            <FinancialReports accounts={accounts} />
          )}

          {![
            'Dashboard',
            'Journal Vouchers',
            'Chart of Accounts',
            'Financial Reports'
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
    background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', padding: 20, fontFamily: 'Inter, Arial, sans-serif'
  },
  loginCard: {
    background: '#ffffff', padding: 40, borderRadius: 20, width: '100%',
    maxWidth: 440, boxSizing: 'border-box', display: 'grid', gap: 18,
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
  },
  loginHeaderIcon: {
    width: 60, height: 60, borderRadius: 16, background: '#eef2ff',
    display: 'grid', placeItems: 'center', margin: '0 auto 4px'
  },
  loginTitle: {
    fontSize: 26, fontWeight: 700, textAlign: 'center', margin: 0, color: '#0f172a', letterSpacing: '-0.03em'
  },
  loginSubtitle: {
    textAlign: 'center', margin: '-10px 0 0', color: '#4f46e5', fontWeight: 600, fontSize: 14
  },
  loginSubText: {
    textAlign: 'center', margin: '-14px 0 10px', color: '#64748b', fontSize: 13
  },
  demoBadge: {
    background: '#f8fafc', padding: '10px', borderRadius: 8, textAlign: 'center',
    fontSize: 12, color: '#475569', border: '1px solid #e2e8f0'
  },
  appShell: {
    minHeight: '100vh', display: 'flex', background: '#f8fafc',
    color: '#0f172a', fontFamily: 'Inter, Arial, sans-serif'
  },
  sidebar: {
    width: 270, background: '#0f172a', color: '#cbd5e1',
    padding: '20px 16px', boxSizing: 'border-box', display: 'flex',
    flexDirection: 'column', gap: 14, flexShrink: 0, borderRight: '1px solid #1e293b'
  },
  sidebarOpen: {
    position: 'fixed', inset: '0 auto 0 0', zIndex: 30,
    width: 280, overflowY: 'auto', boxShadow: '10px 0 30px rgba(0,0,0,0.5)'
  },
  mobileOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 25,
    backdropFilter: 'blur(2px)'
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px 12px', borderBottom: '1px solid #1e293b'
  },
  brandIconBox: {
    width: 38, height: 38, borderRadius: 10, background: '#4f46e5',
    display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(79,70,229,0.4)'
  },
  workspace: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    background: '#1e293b', borderRadius: 10, fontSize: 13, border: '1px solid #334155'
  },
  workspaceIcon: {
    display: 'grid', placeItems: 'center', width: 32, height: 32,
    borderRadius: 8, background: '#4f46e5', color: '#fff', fontWeight: 700, fontSize: 12
  },
  navScroll: {
    overflowY: 'auto', flex: 1, paddingRight: '2px'
  },
  navTitle: {
    padding: '16px 8px 6px', fontSize: 11, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 700
  },
  navButton: {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    padding: '10px 12px', border: 0, borderRadius: 8,
    color: '#94a3b8', background: 'transparent', textAlign: 'left',
    cursor: 'pointer', marginBottom: 3, fontSize: 13, fontWeight: 500,
    transition: 'all 0.15s ease'
  },
  navActive: {
    background: '#4f46e5', color: '#ffffff', fontWeight: 600,
    boxShadow: '0 4px 12px rgba(79,70,229,0.3)'
  },
  userCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 8px',
    background: '#1e293b', borderRadius: 10, border: '1px solid #334155'
  },
  avatar: {
    width: 36, height: 36, borderRadius: '50%', display: 'grid',
    placeItems: 'center', background: '#eef2ff', color: '#4f46e5',
    fontWeight: 700, flexShrink: 0, fontSize: 14
  },
  logoutButton: {
    background: 'transparent', color: '#94a3b8', border: 0,
    padding: 6, cursor: 'pointer', borderRadius: 6, display: 'grid', placeItems: 'center',
    transition: 'color 0.2s'
  },
  iconButton: {
    display: 'inline-grid', placeItems: 'center', background: '#ffffff',
    color: '#475569', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: 8, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  mainContent: {
    minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column'
  },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 14, minHeight: 68,
    background: '#ffffff', borderBottom: '1px solid #e2e8f0',
    padding: '10px 28px', boxSizing: 'border-box', boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
  },
  searchContainer: {
    display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 12px',
    maxWidth: 320, width: '100%'
  },
  searchInput: {
    border: 0, outline: 0, background: 'transparent', minWidth: 0, width: '100%', fontSize: 13, color: '#0f172a'
  },
  contentArea: {
    padding: 28, flex: 1, width: '100%', maxWidth: 1600,
    boxSizing: 'border-box', margin: '0 auto'
  },
  pageHeading: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, flexWrap: 'wrap', marginBottom: 24
  },
  eyebrow: {
    color: '#4f46e5', fontSize: 12, fontWeight: 700,
    textTransform: 'uppercase', marginBottom: 4, letterSpacing: '0.04em'
  },
  h1: { fontSize: 26, margin: '0 0 4px', letterSpacing: '-.03em', color: '#0f172a', fontWeight: 700 },
  subtitle: { color: '#64748b', fontSize: 14, margin: 0 },
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
    gap: 18, marginBottom: 24
  },
  metricCard: {
    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 14,
    padding: 20, boxShadow: '0 4px 12px rgba(15,23,42,0.03)', minWidth: 0,
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  metricTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10
  },
  metricTitleText: { fontSize: 13, color: '#64748b', fontWeight: 600 },
  metricIcon: {
    width: 42, height: 42, display: 'grid', placeItems: 'center',
    borderRadius: 12, flexShrink: 0
  },
  metricValue: {
    fontSize: 24, fontWeight: 750, margin: '14px 0 6px',
    overflowWrap: 'anywhere', color: '#0f172a', letterSpacing: '-0.02em'
  },
  metricNote: { color: '#64748b', fontSize: 12 },
  panel: {
    background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 16,
    padding: 24, marginBottom: 24, minWidth: 0,
    boxShadow: '0 4px 16px rgba(15,23,42,0.04)'
  },
  panelHeading: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, flexWrap: 'wrap', marginBottom: 18
  },
  panelTitle: { fontSize: 18, fontWeight: 700, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' },
  panelDesc: { fontSize: 13, color: '#64748b', margin: '2px 0 0' },
  countBadge: {
    borderRadius: 20, padding: '4px 12px', background: '#eef2ff',
    color: '#4f46e5', fontSize: 12, fontWeight: 700, border: '1px solid #c7d2fe'
  },
  tableWrap: { width: '100%', overflowX: 'auto', borderRadius: 10, border: '1px solid #f1f5f9' },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
    minWidth: 700, textAlign: 'left'
  },
  emptyCell: {
    textAlign: 'center', padding: 40, color: '#64748b', fontStyle: 'italic'
  },
  label: {
    display: 'grid', gap: 6, marginBottom: 16, fontSize: 13,
    fontWeight: 600, color: '#334155'
  },
  input: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '10px 14px',
    border: '1px solid #cbd5e1', borderRadius: 9, background: '#ffffff',
    color: '#0f172a', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s'
  },
  selectInput: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '10px 14px',
    border: '1px solid #cbd5e1', borderRadius: 9, background: '#ffffff',
    color: '#0f172a', fontSize: '13px', outline: 'none', cursor: 'pointer'
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
    gap: 18
  },
  primaryButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '11px 20px', border: 0, borderRadius: 10,
    background: '#4f46e5', color: '#ffffff', fontWeight: 600, cursor: 'pointer',
    fontSize: '14px', boxShadow: '0 4px 12px rgba(79,70,229,0.3)', transition: 'background 0.2s'
  },
  secondaryButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 7, padding: '10px 16px', border: '1px solid #cbd5e1',
    borderRadius: 10, background: '#ffffff', color: '#334155',
    cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'background 0.2s'
  },
  dangerButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px', border: '1px solid #fecaca', borderRadius: 8,
    color: '#dc2626', background: '#fef2f2', cursor: 'pointer', transition: 'background 0.2s'
  },
  disabledDangerButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px', border: '1px solid #e2e8f0', borderRadius: 8,
    color: '#94a3b8', background: '#f8fafc', cursor: 'not-allowed', opacity: 0.6
  },
  balanceStatus: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
    borderRadius: 10, margin: '20px 0', fontWeight: 600, fontSize: 13, border: '1px solid'
  },
  notice: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
    borderRadius: 10, marginBottom: 18, fontSize: 13, border: '1px solid'
  },
  infoNotice: { background: '#eef2ff', color: '#3730a3', borderColor: '#c7d2fe' },
  errorNotice: { background: '#fef2f2', color: '#991b1b', borderColor: '#f87171' },
  error: { color: '#dc2626', fontSize: 13, margin: '4px 0 12px', fontWeight: 500 },
  reportTabs: {
    display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20
  },
  reportTab: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px',
    borderRadius: 10, border: '1px solid #e2e8f0', background: '#ffffff',
    color: '#475569', cursor: 'pointer', fontWeight: 500, fontSize: '13px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
  },
  reportTabActive: {
    borderColor: '#4f46e5', color: '#4f46e5', background: '#eef2ff',
    fontWeight: 700, boxShadow: '0 2px 6px rgba(79,70,229,0.15)'
  },
  dateBadge: {
    background: '#f1f5f9', padding: '4px 8px', borderRadius: 6, fontSize: '12px', color: '#334155', fontWeight: 500
  },
  typeBadge: {
    background: '#e2e8f0', padding: '3px 8px', borderRadius: 6, fontSize: '11px', color: '#1e293b', fontWeight: 600, display: 'inline-block'
  },
  statusBadge: {
    background: '#ecfdf5', color: '#065f46', padding: '3px 8px', borderRadius: 6, fontSize: '11px', fontWeight: 600, border: '1px solid #a7f3d0'
  },
  footer: {
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: 10, padding: '18px 28px', background: '#ffffff',
    borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 12
  }
};