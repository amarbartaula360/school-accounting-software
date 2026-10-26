import { useEffect, useState } from 'react';
import NepaliDate from 'nepali-date-converter';
import {
  LayoutDashboard, BookOpen, ReceiptText, GraduationCap, Utensils,
  Package, Users, Landmark, ChartNoAxesCombined, Settings, Search,
  Bell, Plus, ArrowUpRight, ArrowDownRight, Wallet, CreditCard,
  TrendingUp, Menu, ChevronDown, CircleHelp, Printer, CheckCircle,
  FolderPlus, LogIn, UserPlus, Lock, Mail, User
} from 'lucide-react';

const navigation = [
  { title: 'OVERVIEW' },
  { label: 'Dashboard', icon: LayoutDashboard },
  { title: 'ACCOUNTING' },
  { label: 'Chart of Accounts', icon: BookOpen },
  { label: 'Journal Vouchers', icon: ReceiptText },
  { label: 'Cash & Bank', icon: Landmark },
  { label: 'Financial Reports', icon: ChartNoAxesCombined },
  { title: 'SCHOOL' },
  { label: 'Student Fees', icon: GraduationCap },
  { label: 'Payroll & Staff', icon: Users },
  { title: 'BUSINESS' },
  { label: 'Hostel & Canteen', icon: Utensils },
  { label: 'Purchases & Inventory', icon: Package },
  { label: 'Sales & Receipts', icon: CreditCard },
];

const nepaliMonths = [
  'वैशाख (Baisakh)', 'जेठ (Jestha)', 'असार (Ashad)', 'साउन (Shrawan)',
  'भदौ (Bhadra)', 'असोज (Ashwin)', 'कार्तिक (Kartik)', 'मंसिर (Mangsir)',
  'पुष (Poush)', 'माघ (Magh)', 'फागुन (Falgun)', 'चैत (Chaitra)'
];

const initialAccounts = [
  { id: 101, code: '1000', name: 'Cash in Hand', type: 'Asset', category: 'Current Asset', balance: 124000 },
  { id: 102, code: '1010', name: 'Nabil Bank Account', type: 'Asset', category: 'Current Asset', balance: 418200 },
  { id: 201, code: '2000', name: 'Salary Payable (Staff)', type: 'Liability', category: 'Current Liability', balance: 0 },
  { id: 301, code: '3000', name: 'School Fee Income', type: 'Income', category: 'Direct Income', balance: 1284500 },
  { id: 401, code: '4000', name: 'Staff Salary Expense', type: 'Expense', category: 'Operating Expense', balance: 450000 },
];

// Initial Transactions (Some set to today's date for demo testing)
const todayStr = new NepaliDate(new Date()).format('YYYY-MM-DD');
const initialTransactions = [
  { date: todayStr, ref: 'RC-00081', description: 'Student tuition fee', category: 'School fees', method: 'Bank', amount: '+ Rs. 35,000', positive: true },
  { date: todayStr, ref: 'PV-00042', description: 'Canteen supplies', category: 'Purchases', method: 'Cash', amount: '− Rs. 8,450', positive: false },
  { date: '2083-07-01', ref: 'JV-00019', description: 'Old Electricity bill', category: 'Utilities', method: 'Bank', amount: '− Rs. 12,600', positive: false },
];

// 1. LOGIN & USER CREATION COMPONENT
function LoginSystem({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [usersList, setUsersList] = useState([
    { email: 'admin@united.edu.np', password: 'password123', name: 'Amar Bartaula' }
  ]);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleAuth(e) {
    e.preventDefault();
    setError('');

    if (isRegistering) {
      if (!email || !password || !name) {
        setError('सबै field हरू अनिवार्य छन्!');
        return;
      }
      const existing = usersList.find(u => u.email === email);
      if (existing) {
        setError('यो इमेल पहिले नै रजिस्टर भइसकेको छ!');
        return;
      }
      const newUser = { email, password, name };
      setUsersList([...usersList, newUser]);
      alert('सफलतापूर्वक खाता बन्यो! अब Login गर्नुहोस्।');
      setIsRegistering(false);
      setPassword('');
    } else {
      const user = usersList.find(u => u.email === email && u.password === password);
      if (user) {
        onLogin(user);
      } else {
        setError('गलत इमेल वा पासवर्ड!');
      }
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', background: '#f1f5f9' }}>
      <div style={{ background: '#ffffff', padding: '40px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ background: '#2563eb', color: '#fff', width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', margin: '0 auto 12px' }}>
            <Landmark size={24} />
          </div>
          <h2>LedgerPro Enterprise</h2>
          <p style={{ color: '#64748b', fontSize: '14px' }}>United Education Management System</p>
        </div>

        {error && <div style={{ background: '#ffeeec', color: '#b91c1c', padding: '10px', borderRadius: '6px', fontSize: '14px', marginBottom: '16px' }}>{error}</div>}

        <form onSubmit={handleAuth} style={{ display: 'grid', gap: '14px' }}>
          {isRegistering && (
            <label style={{ fontSize: '14px', fontWeight: '500' }}>
              Full Name
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', marginTop: '4px' }}>
                <User size={18} color="#64748b" style={{ marginRight: '8px' }}/>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ram Subedi" style={{ border: 'none', outline: 'none', width: '100%' }} required />
              </div>
            </label>
          )}

          <label style={{ fontSize: '14px', fontWeight: '500' }}>
            Email Address
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', marginTop: '4px' }}>
              <Mail size={18} color="#64748b" style={{ marginRight: '8px' }}/>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@united.edu.np" style={{ border: 'none', outline: 'none', width: '100%' }} required />
            </div>
          </label>

          <label style={{ fontSize: '14px', fontWeight: '500' }}>
            Password
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '8px', marginTop: '4px' }}>
              <Lock size={18} color="#64748b" style={{ marginRight: '8px' }}/>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ border: 'none', outline: 'none', width: '100%' }} required />
            </div>
          </label>

          <button type="submit" className="primary-button" style={{ width: '100%', marginTop: '10px', padding: '12px' }}>
            {isRegistering ? <><UserPlus size={18}/> Register New User</> : <><LogIn size={18}/> Login to System</>}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          {isRegistering ? (
            <span>पहिले नै खाता छ? <button onClick={() => setIsRegistering(false)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}>Login गर्नुहोस्</button></span>
          ) : (
            <span>नयाँ प्रयोगकर्ता हुनुहुन्छ? <button onClick={() => setIsRegistering(true)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontWeight: '600' }}>Account सिर्जना गर्नुहोस्</button></span>
          )}
        </div>
      </div>
    </div>
  );
}

// 2. DASHBOARD WITH TODAY'S TRANSACTIONS & AUTOMATIC RESET LOGIC
function Dashboard({ accounts, transactions }) {
  const todayBs = new NepaliDate(new Date()).format('YYYY-MM-DD');

  // Filter transactions strictly for TODAY's date (Automatic Day Reset)
  const todaysTransactions = transactions.filter(t => t.date === todayBs);

  const totalIncome = accounts.filter(a => a.type === 'Income').reduce((s, a) => s + a.balance, 0);
  const totalExpenses = accounts.filter(a => a.type === 'Expense').reduce((s, a) => s + a.balance, 0);
  const cashBank = accounts.filter(a => a.name.includes('Cash') || a.name.includes('Bank')).reduce((s, a) => s + a.balance, 0);

  return <>
    <div className="page-heading">
      <div>
        <div className="eyebrow">आजको मिति (TODAY): {todayBs} (वि.सं.)</div>
        <h1>Good afternoon 👋</h1>
        <p>Today's live financial summary & automatic day-reset transactions.</p>
      </div>
    </div>

    <div className="metrics-grid">
      <div className="metric-card">
        <div className="metric-top"><span>Total Income</span><div className="metric-icon blue"><TrendingUp size={19} /></div></div>
        <div className="metric-value">Rs. {totalIncome.toLocaleString('en-IN')}</div>
        <div className="metric-change positive"><ArrowUpRight size={15} /> Live Ledger Balance</div>
      </div>
      <div className="metric-card">
        <div className="metric-top"><span>Total Expenses</span><div className="metric-icon orange"><ArrowDownRight size={19} /></div></div>
        <div className="metric-value">Rs. {totalExpenses.toLocaleString('en-IN')}</div>
        <div className="metric-change neutral">Active FY 2083/84</div>
      </div>
      <div className="metric-card">
        <div className="metric-top"><span>Cash & Bank Total</span><div className="metric-icon green"><Wallet size={19} /></div></div>
        <div className="metric-value">Rs. {cashBank.toLocaleString('en-IN')}</div>
        <div className="metric-change positive">Synced today</div>
      </div>
    </div>

    {/* TODAY'S TRANSACTIONS SECTION (Resets automatically when day changes) */}
    <section className="panel transactions-panel" style={{ marginTop: '24px' }}>
      <div className="panel-heading">
        <div>
          <h2>Today's Transactions ({todayBs})</h2>
          <p>Automatic day-reset active: केवल आजको मितिका मात्र इन्ट्रीहरू देखाइएको छ।</p>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>DATE / REF</th>
              <th>DESCRIPTION</th>
              <th>CATEGORY</th>
              <th>METHOD</th>
              <th>AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            {todaysTransactions.map((t, idx) => (
              <tr key={idx}>
                <td><strong>{t.date}</strong><span className="table-sub">{t.ref}</span></td>
                <td className="description">{t.description}</td>
                <td>{t.category}</td>
                <td>{t.method}</td>
                <td className={t.positive ? 'amount-positive' : 'amount-negative'}>{t.amount}</td>
              </tr>
            ))}
            {todaysTransactions.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                  आजको मितिमा ({todayBs}) कुनै पनि ट्रान्जेक्सन भएको छैन। (भोलिपल्ट नयाँ दिन सुरु हुँदा यो सूची स्वतः खाली हुनेछ।)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}

// 3. JOURNAL VOUCHER COMPONENT
function JournalVoucher({ accounts, setAccounts, transactions, setTransactions }) {
  const [bsDate, setBsDate] = useState(new NepaliDate(new Date()).format('YYYY-MM-DD'));
  const [voucherNumber, setVoucherNumber] = useState('JV-0001');
  const [description, setDescription] = useState('');
  const [debitAccountId, setDebitAccountId] = useState('');
  const [creditAccountId, setCreditAccountId] = useState('');
  const [amount, setAmount] = useState('');

  function handleSaveVoucher(e) {
    e.preventDefault();
    if (!debitAccountId || !creditAccountId || !amount) {
      alert('सबै खाता र रकम अनिवार्य छ!');
      return;
    }

    const amtNum = Number(amount);
    if (amtNum <= 0) return alert('रकम शून्यभन्दा बढी हुनुपर्छ!');

    // Update account balances
    setAccounts(prev => prev.map(acc => {
      if (acc.id === Number(debitAccountId)) return { ...acc, balance: acc.balance + amtNum };
      if (acc.id === Number(creditAccountId)) return { ...acc, balance: acc.balance + amtNum };
      return acc;
    }));

    // Add to transactions list (shows up on dashboard if date is today)
    const newTx = {
      date: bsDate,
      ref: voucherNumber,
      description,
      category: 'Journal Entry',
      method: 'Transfer',
      amount: `Rs. ${amtNum.toLocaleString('en-IN')}`,
      positive: true
    };

    setTransactions([newTx, ...transactions]);
    alert('Journal Voucher सफलतापूर्वक सेभ र पोस्ट भयो!');
    setDescription('');
    setAmount('');
  }

  return (
    <div className="voucher-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNTING</div>
          <h1>Journal Vouchers</h1>
          <p>डबल इन्ट्री प्रणाली मार्फत डेबिट र क्रेडिट भौचर प्रविष्टि गर्नुहोस्।</p>
        </div>
      </div>

      <section className="panel voucher-panel" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <form onSubmit={handleSaveVoucher} className="voucher-fields" style={{ display: 'grid', gap: '14px' }}>
          <label>
            मिति (वि.सं.)
            <input type="text" value={bsDate} onChange={e => setBsDate(e.target.value)} required />
          </label>

          <label>
            Voucher Number
            <input type="text" value={voucherNumber} onChange={e => setVoucherNumber(e.target.value)} required />
          </label>

          <label>
            Debit Account (डेबिट हुने खाता)
            <select value={debitAccountId} onChange={e => setDebitAccountId(e.target.value)} required>
              <option value="">-- खाता छान्नुहोस् --</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.type})</option>)}
            </select>
          </label>

          <label>
            Credit Account (क्रेडिट हुने खाता)
            <select value={creditAccountId} onChange={e => setCreditAccountId(e.target.value)} required>
              <option value="">-- खाता छान्नुहोस् --</option>
              {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.code} - {acc.name} ({acc.type})</option>)}
            </select>
          </label>

          <label>
            रकम (Amount Rs.)
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" required />
          </label>

          <label>
            विवरण (Description)
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="उदा: भाडा भुक्तानी गरिएको" required />
          </label>

          <button type="submit" className="primary-button" style={{ marginTop: '10px' }}>
            <CheckCircle size={16}/> Save & Post Voucher
          </button>
        </form>
      </section>
    </div>
  );
}

// 4. CHART OF ACCOUNTS COMPONENT
function ChartOfAccounts({ accounts, setAccounts }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Asset');
  const [category, setCategory] = useState('Current Asset');

  function handleCreateAccount(e) {
    e.preventDefault();
    if (!code || !name) return alert('खाता कोड र नाम अनिवार्य छ!');
    const newAcc = { id: Date.now(), code, name, type, category, balance: 0 };
    setAccounts([...accounts, newAcc]);
    setCode('');
    setName('');
    alert('नयाँ Ledger Account सफलतापूर्वक थपियो!');
  }

  return (
    <div className="voucher-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ACCOUNTING</div>
          <h1>Chart of Accounts</h1>
          <p>नयाँ Ledger Head सिर्जना गर्नुहोस् र ब्यालेन्स जाँच गर्नुहोस्।</p>
        </div>
      </div>

      <div className="main-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
        <section className="panel voucher-panel">
          <div className="panel-heading"><h2>Create New Account</h2></div>
          <form onSubmit={handleCreateAccount} className="voucher-fields" style={{ display: 'grid', gap: '12px' }}>
            <label>
              Account Code
              <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder="उदा: 1030" required />
            </label>
            <label>
              Account Name
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="उदा: Office Rent" required />
            </label>
            <label>
              Type
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
              </select>
            </label>
            <button type="submit" className="primary-button"><FolderPlus size={16}/> Save Account</button>
          </form>
        </section>

        <section className="panel voucher-history">
          <div className="panel-heading"><h2>Existing Accounts</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Balance (Rs.)</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(acc => (
                  <tr key={acc.id}>
                    <td><strong>{acc.code}</strong></td>
                    <td>{acc.name}</td>
                    <td><span className={`pill ${acc.type.toLowerCase()}`}>{acc.type}</span></td>
                    <td><strong>Rs. {acc.balance.toLocaleString('en-IN')}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

// Sidebar Component
function Sidebar({ active, setActive, open, setOpen, user, onLogout }) {
  return <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
    <div className="brand">
      <div className="brand-mark"><Landmark size={22} /></div>
      <div><strong>LedgerPro</strong><span>FINANCE SUITE</span></div>
    </div>
    <div className="workspace"><div className="workspace-icon">UE</div><div><strong>United Education</strong><span>School & Business</span></div><ChevronDown size={16} /></div>
    <nav>
      {navigation.map((item) => item.title
        ? <div className="nav-title" key={item.title}>{item.title}</div>
        : <button key={item.label} className={`nav-link ${active === item.label ? 'active' : ''}`} onClick={() => { setActive(item.label); setOpen(false); }}>
            <item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>
          </button>)}
    </nav>
    <div className="sidebar-bottom">
      <button className="nav-link" onClick={() => setActive('Settings')}><Settings size={18} /><span>Settings</span></button>
      <div className="profile" onClick={onLogout} style={{ cursor: 'pointer', background: '#fee2e2', borderRadius: '6px', padding: '8px' }} title="Click to Logout">
        <div className="avatar" style={{ background: '#dc2626', color: '#fff' }}>{user?.name?.[0] || 'U'}</div>
        <div className="profile-text"><strong>{user?.name || 'User'}</strong><span style={{ color: '#dc2626' }}>Logout (लगआउट)</span></div>
      </div>
    </div>
  </aside>;
}

// 5. MAIN ROOT APPLICATION
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [active, setActive] = useState('Dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  const [accounts, setAccounts] = useState(initialAccounts);
  const [transactions, setTransactions] = useState(initialTransactions);

  if (!currentUser) {
    return <LoginSystem onLogin={(user) => setCurrentUser(user)} />;
  }

  return <div className="app-shell">
    <Sidebar active={active} setActive={setActive} open={menuOpen} setOpen={setMenuOpen} user={currentUser} onLogout={() => setCurrentUser(null)} />
    <main className="main-content">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)}><Menu size={21}/></button>
        <div className="breadcrumb">Workspace <span>/</span> <strong>{active}</strong></div>
        <div className="topbar-actions">
          <label className="search-box"><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search accounts, transactions..." /></label>
          <button className="notification" aria-label="Notifications"><Bell size={19}/><i></i></button>
          <div className="top-avatar">{currentUser.name[0]}</div>
        </div>
      </header>
      <div className="content-area">
       {active === 'Dashboard' ? <Dashboard accounts={accounts} transactions={transactions} /> :
        active === 'Journal Vouchers' ? <JournalVoucher accounts={accounts} setAccounts={setAccounts} transactions={transactions} setTransactions={setTransactions} /> :
        active === 'Chart of Accounts' ? <ChartOfAccounts accounts={accounts} setAccounts={setAccounts} /> :
        <div className="module-placeholder">
          <div className="placeholder-icon"><BookOpen size={27}/></div>
          <div className="eyebrow">ACCOUNTING WORKSPACE</div>
          <h1>{active}</h1>
          <p>यो मोड्युल सक्रिय छ।</p>
          <button className="primary-button" onClick={() => setActive('Dashboard')}>Return to dashboard</button>
        </div>}
      </div>
      <footer className="footer">
        <span>LedgerPro Enterprise Suite <span className="muted">· Build 3.1</span></span>
        <span>Logged in as: {currentUser.email}</span>
      </footer>
    </main>
  </div>;
}