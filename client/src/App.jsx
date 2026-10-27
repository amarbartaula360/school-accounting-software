
import { useEffect, useMemo, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import {
  LayoutDashboard, BookOpen, ReceiptText, GraduationCap, Utensils,
  Package, Users, Landmark, ChartNoAxesCombined, Settings, Search,
  Bell, ArrowUpRight, ArrowDownRight, Wallet, CreditCard, TrendingUp,
  Menu, ChevronDown, Plus, Trash2, RefreshCw, Printer, FileText,
  LogIn, LogOut, CalendarDays, AlertCircle, CheckCircle2
} from 'lucide-react';

const API_BASE_URL = 'https://school-accounting-software.onrender.com';
const ORGANIZATION_ID = 1;// DBeaver मा सही ID पुष्टि भएपछि मात्र राख्नुहोस्
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
        <Landmark size={42} color="#2563eb" />
        <h1>LedgerPro</h1>
        <p>United English Boarding School</p>
        <p>विद्यालय लेखा व्यवस्थापन प्रणाली</p>

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

        <small style={{ color: '#64748b' }}>
          Demo password: @Amar123
        </small>
      </form>
    </div>
  );
}

function Sidebar({ active, setActive, open, setOpen, user, onLogout }) {
  return (
    <>
      {open && (
        <button
          aria-label="Close menu"
          style={styles.mobileOverlay}
          onClick={() => setOpen(false)}
        />
      )}

      <aside style={{
        ...styles.sidebar,
        ...(open ? styles.sidebarOpen : {})
      }}>
        <div style={styles.brand}>
          <Landmark size={28} color="#93c5fd" />
          <div>
            <strong>LedgerPro</strong>
            <small style={{ display: 'block', color: '#94a3b8' }}>
              SCHOOL FINANCE
            </small>
          </div>
        </div>

        <div style={styles.workspace}>
          <div style={styles.workspaceIcon}>UE</div>
          <div style={{ flex: 1 }}>
            <strong>United English</strong>
            <small style={{ display: 'block' }}>School Accounting</small>
          </div>
          <ChevronDown size={16} />
        </div>

        <nav>
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
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          )}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <div style={styles.userCard}>
            <div style={styles.avatar}>
              {user?.name?.[0] || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong>{user?.name || 'User'}</strong>
              <small style={{ display: 'block', overflowWrap: 'anywhere' }}>
                {user?.email}
              </small>
            </div>
            <button
              title="Logout"
              style={styles.iconButton}
              onClick={onLogout}
            >
              <LogOut size={17} />
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
            आजको मिति / Today's Date: {todayBS} वि.सं.
          </div>
          <h1 style={styles.h1}>नमस्कार! 👋</h1>
          <p>विद्यालयको आर्थिक अवस्था र कारोबारको सारांश।</p>
        </div>
        <button style={styles.secondaryButton} onClick={onReload}>
          <RefreshCw size={16} /> Refresh Data
        </button>
      </div>

      {error && <Notice type="error" message={error} />}
      {loading && <Notice message="Accounts लोड हुँदैछन्..." />}

      <div style={styles.metricsGrid}>
        <Metric
          title="कुल आम्दानी / Total Income"
          value={money(totalIncome)}
          note="आम्दानी खाताहरूको उपलब्ध balance"
          icon={<TrendingUp size={21} />}
          color="#2563eb"
        />
        <Metric
          title="कुल खर्च / Total Expenses"
          value={money(totalExpenses)}
          note="खर्च खाताहरूको उपलब्ध balance"
          icon={<ArrowDownRight size={21} />}
          color="#ea580c"
        />
        <Metric
          title="नगद तथा बैंक / Cash & Bank"
          value={money(cashBank)}
          note="नगद तथा बैंक खाताहरूको उपलब्ध balance"
          icon={<Wallet size={21} />}
          color="#059669"
        />
        <Metric
          title="खाता संख्या / Accounts"
          value={accounts.length.toLocaleString('en-IN')}
          note="लोड भएका खाताहरू"
          icon={<BookOpen size={21} />}
          color="#7c3aed"
        />
      </div>

      <section style={styles.panel}>
        <div style={styles.panelHeading}>
          <div>
            <h2>आजका कारोबार / Today's Transactions</h2>
            <p>मिति: {todayBS} वि.सं. ({todayAD} AD)</p>
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
                  <td>{toBS(t.date)} BS</td>
                  <td>{t.ref || '-'}</td>
                  <td>{t.description}</td>
                  <td>{t.category || 'Journal Voucher'}</td>
                  <td>{t.amount || money(t.debit || t.credit)}</td>
                </tr>
              ))}
              {!todayTransactions.length && (
                <tr>
                  <td colSpan="5" style={styles.emptyCell}>
                    आजको कारोबारको सूची उपलब्ध छैन। Voucher save भएपछि
                    देखाउन सकिन्छ।
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

function Metric({ title, value, note, icon, color }) {
  return (
    <div style={styles.metricCard}>
      <div style={styles.metricTop}>
        <span>{title}</span>
        <div style={{
          ...styles.metricIcon,
          color,
          background: `${color}14`
        }}>
          {icon}
        </div>
      </div>
      <div style={styles.metricValue}>{value}</div>
      <small style={{ color: '#64748b' }}>{note}</small>
    </div>
  );
}

function Notice({ message, type = 'info' }) {
  return (
    <div style={{
      ...styles.notice,
      ...(type === 'error' ? styles.errorNotice : {})
    }}>
      {type === 'error'
        ? <AlertCircle size={18} />
        : <CheckCircle2 size={18} />}
      <span>{message}</span>
    </div>
  );
}
function JournalVoucher({ accounts, onVoucherSaved }) {
  const [entryDate, setEntryDate] = useState(getTodayAD());
  const [bsDate, setBsDate] = useState(toBS(getTodayAD()));

  const [voucherNumber, setVoucherNumber] = useState(
    `JV-${Date.now().toString().slice(-6)}`
  );

  const [description, setDescription] = useState('');
  const [rows, setRows] = useState([
    { accountId: '', debit: '', credit: '' },
    { accountId: '', debit: '', credit: '' }
  ]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Database बाट saved journal entries राख्ने state
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

  // Database बाट journal register load गर्ने
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

  // Page खुल्दा database बाट पुराना entries load गर्ने
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
        r => !accounts.some(a => a.id === Number(r.accountId))
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

      // Save सफल भएपछि database बाट register फेरि load गर्ने
      await loadJournalEntries();

      onVoucherSaved?.({
        date: entryDate,
        ref: voucherNumber.trim(),
        description: description.trim(),
        category: 'Journal Voucher',
        method: 'Journal',
        amount: money(totalDebit),
        positive: true
      });

      setSuccess(
        'Journal Voucher database मा सुरक्षित भयो।'
      );

      setVoucherNumber(
        `JV-${Date.now().toString().slice(-6)}`
      );

      setDescription('');
      setRows([
        { accountId: '', debit: '', credit: '' },
        { accountId: '', debit: '', credit: '' }
      ]);
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
          <h1 style={styles.h1}>Journal Voucher</h1>
          <p>
            एउटै भौचरमा धेरै Debit र Credit entries राख्नुहोस्।
          </p>
        </div>
      </div>

      {/* Journal Voucher Form */}
      <section style={styles.panel}>
        <form onSubmit={saveVoucher}>
          <div style={styles.formGrid}>
            <label style={styles.label}>
              Voucher No. / भौचर नं.
              <input
                style={styles.input}
                value={voucherNumber}
                onChange={e => setVoucherNumber(e.target.value)}
                maxLength={50}
                required
              />
            </label>

            <label style={styles.label}>
              Date / नेपाली मिति (वि.सं.)
              <div style={{ display: 'flex', gap: 8 }}>
                <CalendarDays size={20} />
                <input
                  style={styles.input}
                  type="text"
                  value={bsDate}
                  onChange={e => changeDate(e.target.value)}
                  placeholder="2083-07-10"
                  pattern="[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}"
                  required
                />
              </div>
              <small>AD date: {entryDate}</small>
            </label>
          </div>

          <label style={styles.label}>
            Narration / कारोबारको विवरण
            <input
              style={styles.input}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="कारोबारको विवरण लेख्नुहोस्..."
              required
            />
          </label>

          <div style={styles.panelHeading}>
            <div>
              <h2>Entry Details / कारोबार विवरण</h2>
              <p>
                हरेक account row मा Debit वा Credit मध्ये एउटा मात्र राख्नुहोस्।
              </p>
            </div>

            <button
              type="button"
              style={styles.secondaryButton}
              onClick={addRow}
            >
              <Plus size={16} /> Add Row
            </button>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th>S.N.</th>
                  <th>Account Head / खाता</th>
                  <th>Debit / डेबिट</th>
                  <th>Credit / क्रेडिट</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>

                    <td>
                      <select
                        style={styles.input}
                        value={row.accountId}
                        onChange={e =>
                          updateRow(
                            index,
                            'accountId',
                            e.target.value
                          )
                        }
                      >
                        <option value="">खाता छान्नुहोस्</option>

                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>
                            {a.code} - {a.name}
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

                    <td>
                      <button
                        type="button"
                        style={styles.dangerButton}
                        disabled={rows.length <= 2}
                        onClick={() => removeRow(index)}
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr>
                  <th colSpan="2">Total / जम्मा</th>
                  <th>{money(totalDebit)}</th>
                  <th>{money(totalCredit)}</th>
                  <th></th>
                </tr>
              </tfoot>
            </table>
          </div>

          <div
            style={{
              ...styles.balanceStatus,
              color: balanced ? '#047857' : '#b45309',
              background: balanced ? '#ecfdf5' : '#fffbeb'
            }}
          >
            {balanced
              ? <CheckCircle2 size={18} />
              : <AlertCircle size={18} />}

            {balanced
              ? 'Balanced: Debit = Credit'
              : 'Not Balanced: Debit र Credit बराबर हुनुपर्छ।'}
          </div>

          {error && <Notice type="error" message={error} />}
          {success && <Notice message={success} />}

          <button
            type="submit"
            style={styles.primaryButton}
            disabled={saving || !balanced}
          >
            {saving
              ? 'Saving...'
              : 'Save Voucher / भौचर सुरक्षित गर्नुहोस्'}
          </button>
        </form>
      </section>

      {/* Saved Journal Vouchers from database */}
      <section style={styles.panel}>
        <div style={styles.panelHeading}>
          <div>
            <h2>Saved Journal Vouchers / सुरक्षित भौचरहरू</h2>
            <p>
              Database मा सुरक्षित भएका भौचरहरूको सूची।
            </p>
          </div>

          <button
            type="button"
            style={styles.secondaryButton}
            onClick={loadJournalEntries}
            disabled={loadingEntries}
          >
            <RefreshCw size={16} />
            {loadingEntries ? 'Loading...' : 'Reload'}
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
                  <th>Voucher Type</th>
                  <th>Description</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {journalEntries.map(entry => (
                  <tr key={entry.id}>
                    <td>
                      {String(entry.entry_date || '').slice(0, 10)}
                    </td>
                    <td>{entry.voucher_number}</td>
                    <td>{entry.voucher_type}</td>
                    <td>{entry.description}</td>
                    <td>{money(Number(entry.total_debit) || 0)}</td>
                    <td>{money(Number(entry.total_credit) || 0)}</td>
                    <td>{entry.status}</td>
                  </tr>
                ))}

                {journalEntries.length === 0 && (
                  <tr>
                    <td colSpan="7" style={styles.emptyCell}>
                      अहिलेसम्म कुनै Journal Voucher भेटिएन।
                    </td>
                  </tr>
                )}
              </tbody>

              {journalEntries.length > 0 && (
                <tfoot>
                  <tr>
                    <th colSpan="4">Total / जम्मा</th>
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

  const filtered = accounts.filter(a =>
    `${a.code} ${a.name} ${a.type}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div>
      <div style={styles.pageHeading}>
        <div>
          <div style={styles.eyebrow}>Accounting / लेखा व्यवस्थापन</div>
          <h1 style={styles.h1}>Chart of Accounts</h1>
          <p>विद्यालयको खाताहरूको सूची।</p>
        </div>
        <button style={styles.secondaryButton} onClick={onReload}>
          <RefreshCw size={16} /> Reload
        </button>
      </div>

      <section style={styles.panel}>
        <input
          style={{ ...styles.input, maxWidth: 420, marginBottom: 16 }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="खाता खोज्नुहोस् / Search accounts..."
        />

        {loading && <Notice message="Accounts लोड हुँदैछन्..." />}
        {error && <Notice type="error" message={error} />}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account Name / खाताको नाम</th>
                <th>Type / प्रकार</th>
                <th>Balance / मौज्दात</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id}>
                  <td>{a.code}</td>
                  <td>{a.name}</td>
                  <td>{a.type}</td>
                  <td>{money(a.balance)}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan="4" style={styles.emptyCell}>
                    कुनै खाता भेटिएन।
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

  const income = accounts.filter(a => /income/i.test(a.type));
  const expenses = accounts.filter(a => /expense/i.test(a.type));

  const totalIncome = income.reduce(
    (sum, a) => sum + Number(a.balance || 0), 0
  );
  const totalExpenses = expenses.reduce(
    (sum, a) => sum + Number(a.balance || 0), 0
  );

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
          <p>विद्यालयको वित्तीय प्रतिवेदन हेर्नुहोस्।</p>
        </div>
        <button style={styles.primaryButton} onClick={printReport}>
          <Printer size={16} /> Print Report
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
        <h2>
          {report === 'trial'
            ? 'Trial Balance / परीक्षण सन्तुलन'
            : report === 'income'
              ? 'Income & Expenditure / आम्दानी तथा खर्च'
              : 'Account Ledger / खाता बही'}
        </h2>

        {report === 'trial' && (
          <>
            <p style={{ color: '#64748b' }}>
              हाल यहाँ account मा उपलब्ध balance देखाइएको छ। पूर्ण Trial Balance का लागि posted journal lines बाट balances गणना गर्नुपर्छ।
            </p>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Account</th>
                    <th>Type</th>
                    <th>Available Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map(a => (
                    <tr key={a.id}>
                      <td>{a.code}</td>
                      <td>{a.name}</td>
                      <td>{a.type}</td>
                      <td>{money(a.balance)}</td>
                    </tr>
                  ))}
                  {!accounts.length && (
                    <tr><td colSpan="4" style={styles.emptyCell}>
                      खाताको data उपलब्ध छैन।
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {report === 'income' && (
          <>
            <div style={styles.metricsGrid}>
              <Metric
                title="Income / आम्दानी"
                value={money(totalIncome)}
                note="उपलब्ध income account balances"
                icon={<TrendingUp size={20} />}
                color="#059669"
              />
              <Metric
                title="Expenses / खर्च"
                value={money(totalExpenses)}
                note="उपलब्ध expense account balances"
                icon={<ArrowDownRight size={20} />}
                color="#ea580c"
              />
              <Metric
                title="Difference / अन्तर"
                value={money(totalIncome - totalExpenses)}
                note="आम्दानी minus खर्च"
                icon={<ChartNoAxesCombined size={20} />}
                color="#2563eb"
              />
            </div>

            <h3>आम्दानी खाताहरू</h3>
            <ReportAccountTable accounts={income} />

            <h3>खर्च खाताहरू</h3>
            <ReportAccountTable accounts={expenses} />
          </>
        )}

        {report === 'ledger' && (
          <>
            <p style={{ color: '#64748b' }}>
              Journal Voucher बाट पोस्ट भएका कारोबार हेर्न खाता छान्नुहोस्।
            </p>

            <label style={styles.label}>
              Account Ledger / खाता बही
              <select
                style={styles.input}
                value={selectedAccountId}
                onChange={e => setSelectedAccountId(e.target.value)}
              >
                <option value="">खाता छान्नुहोस्</option>
                {accounts.map(account => (
                  <option key={account.id} value={account.id}>
                    {account.code} - {account.name}
                  </option>
                ))}
              </select>
            </label>

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
                      <th>Running Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows.map((row, index) => {
                      const balance = Number(row.running_balance) || 0;
                      return (
                        <tr key={`${row.journal_entry_id}-${index}`}>
                          <td>{String(row.entry_date || '').slice(0, 10)}</td>
                          <td>{row.voucher_number}</td>
                          <td>{row.description}</td>
                          <td>{money(Number(row.debit) || 0)}</td>
                          <td>{money(Number(row.credit) || 0)}</td>
                          <td>
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
                        <th colSpan="3">Total / जम्मा</th>
                        <th>{money(ledgerRows.reduce((sum, row) => sum + (Number(row.debit) || 0), 0))}</th>
                        <th>{money(ledgerRows.reduce((sum, row) => sum + (Number(row.credit) || 0), 0))}</th>
                        <th>
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
              <Notice message="Ledger हेर्न माथिबाट एउटा Account छान्नुहोस्।" />
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
            <th>Code</th>
            <th>Account / खाता</th>
            <th>Balance / मौज्दात</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map(a => (
            <tr key={a.id}>
              <td>{a.code}</td>
              <td>{a.name}</td>
              <td>{money(a.balance)}</td>
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
    <section style={styles.panel}>
      <div style={styles.eyebrow}>Accounting Workspace</div>
      <h1 style={styles.h1}>{title}</h1>
      <p>यो मोड्युलको functionality अर्को चरणमा backend सँग जोड्न सकिन्छ।</p>
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
            <Menu size={21} />
          </button>

          <div style={{ flex: 1 }}>
            Workspace / <strong>{pageTitle}</strong>
          </div>

          <div style={styles.searchContainer}>
            <Search size={17} />
            <input
              style={styles.searchInput}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="खाता वा कारोबार खोज्नुहोस्..."
            />
          </div>

          <button style={styles.iconButton} title="Notifications">
            <Bell size={19} />
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
          <span>LedgerPro · School Accounting</span>
          <span>{user.email}</span>
        </footer>
      </main>
    </div>
  );
}

const styles = {
  loginPage: {
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: '#f1f5f9', padding: 20, fontFamily: 'Arial, sans-serif'
  },
  loginCard: {
    background: '#fff', padding: 32, borderRadius: 16, width: '100%',
    maxWidth: 420, boxSizing: 'border-box', display: 'grid', gap: 15,
    boxShadow: '0 10px 35px rgba(15,23,42,.10)'
  },
  appShell: {
    minHeight: '100vh', display: 'flex', background: '#f8fafc',
    color: '#0f172a', fontFamily: 'Inter, Arial, sans-serif'
  },
  sidebar: {
    width: 260, background: '#0f172a', color: '#e2e8f0',
    padding: 18, boxSizing: 'border-box', display: 'flex',
    flexDirection: 'column', gap: 18, flexShrink: 0
  },
  sidebarOpen: {
    position: 'fixed', inset: '0 auto 0 0', zIndex: 20,
    width: 280, overflowY: 'auto'
  },
  mobileOverlay: {
    position: 'fixed', inset: 0, background: '#0007', zIndex: 19,
    border: 0
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px'
  },
  workspace: {
    display: 'flex', alignItems: 'center', gap: 9, padding: 12,
    background: '#1e293b', borderRadius: 10, fontSize: 13
  },
  workspaceIcon: {
    display: 'grid', placeItems: 'center', width: 34, height: 34,
    borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 700
  },
  navTitle: {
    padding: '13px 8px 5px', fontSize: 11, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: '.04em'
  },
  navButton: {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '10px 11px', border: 0, borderRadius: 8,
    color: '#cbd5e1', background: 'transparent', textAlign: 'left',
    cursor: 'pointer', marginBottom: 3, fontSize: 13
  },
  navActive: {
    background: '#2563eb', color: '#fff', fontWeight: 600
  },
  userCard: {
    display: 'flex', alignItems: 'center', gap: 9, padding: 8,
    borderTop: '1px solid #334155', fontSize: 12
  },
  avatar: {
    width: 34, height: 34, borderRadius: '50%', display: 'grid',
    placeItems: 'center', background: '#dbeafe', color: '#1d4ed8',
    fontWeight: 700, flexShrink: 0
  },
  iconButton: {
    display: 'inline-grid', placeItems: 'center', background: '#fff',
    color: '#334155', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: 8, cursor: 'pointer'
  },
  mainContent: {
    minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column'
  },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 14, minHeight: 64,
    background: '#fff', borderBottom: '1px solid #e2e8f0',
    padding: '10px 24px', boxSizing: 'border-box'
  },
  searchContainer: {
    display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc',
    border: '1px solid #e2e8f0', borderRadius: 9, padding: '8px 10px',
    maxWidth: 320
  },
  searchInput: {
    border: 0, outline: 0, background: 'transparent', minWidth: 0, width: '100%'
  },
  contentArea: {
    padding: 24, flex: 1, width: '100%', maxWidth: 1600,
    boxSizing: 'border-box', margin: '0 auto'
  },
  pageHeading: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: 16, flexWrap: 'wrap', marginBottom: 22
  },
  eyebrow: {
    color: '#2563eb', fontSize: 12, fontWeight: 700,
    textTransform: 'uppercase', marginBottom: 6
  },
  h1: { fontSize: 28, margin: '0 0 7px', letterSpacing: '-.03em' },
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))',
    gap: 16, marginBottom: 24
  },
  metricCard: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
    padding: 19, boxShadow: '0 2px 8px #0f172a06', minWidth: 0
  },
  metricTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10, fontSize: 13, color: '#475569'
  },
  metricIcon: {
    width: 40, height: 40, display: 'grid', placeItems: 'center',
    borderRadius: 12, flexShrink: 0
  },
  metricValue: {
    fontSize: 23, fontWeight: 750, margin: '18px 0 8px',
    overflowWrap: 'anywhere'
  },
  panel: {
    background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14,
    padding: 20, marginBottom: 20, minWidth: 0,
    boxShadow: '0 2px 8px #0f172a05'
  },
  panelHeading: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, flexWrap: 'wrap', marginBottom: 16
  },
  countBadge: {
    borderRadius: 20, padding: '5px 10px', background: '#eff6ff',
    color: '#1d4ed8', fontSize: 12, fontWeight: 700
  },
  tableWrap: { width: '100%', overflowX: 'auto' },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
    minWidth: 650
  },
  emptyCell: {
    textAlign: 'center', padding: 30, color: '#64748b'
  },
  label: {
    display: 'grid', gap: 7, marginBottom: 16, fontSize: 13,
    fontWeight: 600, color: '#334155'
  },
  input: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '10px 11px',
    border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff',
    color: '#0f172a', font: 'inherit'
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))',
    gap: 16
  },
  primaryButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '11px 15px', border: 0, borderRadius: 9,
    background: '#2563eb', color: '#fff', fontWeight: 700, cursor: 'pointer'
  },
  secondaryButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 7, padding: '9px 12px', border: '1px solid #cbd5e1',
    borderRadius: 9, background: '#fff', color: '#334155',
    cursor: 'pointer', fontWeight: 600
  },
  dangerButton: {
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '7px 9px', border: '1px solid #fecaca', borderRadius: 7,
    color: '#b91c1c', background: '#fff7f7', cursor: 'pointer'
  },
  balanceStatus: {
    display: 'flex', alignItems: 'center', gap: 8, padding: 12,
    borderRadius: 9, margin: '16px 0', fontWeight: 700, fontSize: 13
  },
  notice: {
    display: 'flex', alignItems: 'center', gap: 9, padding: 12,
    borderRadius: 9, background: '#eff6ff', color: '#1d4ed8',
    marginBottom: 14, fontSize: 13
  },
  errorNotice: { background: '#fef2f2', color: '#b91c1c' },
  error: { color: '#b91c1c', fontSize: 13 },
  reportTabs: {
    display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18
  },
  reportTab: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: 11,
    borderRadius: 9, border: '1px solid #e2e8f0', background: '#fff',
    color: '#334155', cursor: 'pointer'
  },
  reportTabActive: {
    borderColor: '#2563eb', color: '#1d4ed8', background: '#eff6ff',
    fontWeight: 700
  },
  footer: {
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: 10, padding: '16px 24px', background: '#fff',
    borderTop: '1px solid #e2e8f0', color: '#64748b', fontSize: 12
  }
};
