                  ))}
                  {accounts.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '24px' }}>कुनै account भेटिएन।</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

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

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [active, setActive] = useState('Dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState('');
  const [transactions, setTransactions] = useState(initialTransactions);

  async function loadAccounts() {
    setAccountsLoading(true);
    setAccountsError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts?organizationId=1`);
      const data = await response.json().catch(() => []);
      if (!response.ok) throw new Error(data.error || 'Accounts load हुन सकेन');
      if (!Array.isArray(data)) throw new Error('API बाट accounts list आएन');
      setAccounts(data.map(account => ({
        id: Number(account.id),
        code: account.account_code ?? account.code,
        name: account.account_name ?? account.name,
        type: String(account.account_type ?? account.type ?? '').toLowerCase(),
        category: '',
        balance: 0,
      })));
    } catch (error) {
      console.error('Accounts loading error:', error);
      setAccountsError(error.message || 'Accounts load हुन सकेन');
    } finally {
      setAccountsLoading(false);
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

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
        active === 'Journal Vouchers' ? <JournalVoucher accounts={accounts} transactions={transactions} setTransactions={setTransactions} /> :
        active === 'Chart of Accounts' ? (
          <ChartOfAccounts
            accounts={accounts}
            accountsLoading={accountsLoading}
            accountsError={accountsError}
            onCreateAccount={loadAccounts}
          />
        ) :
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
