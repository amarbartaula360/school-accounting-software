const styles = {
  loginPage: {
    minHeight: '100vh', display: 'grid', placeItems: 'center',
    background: 'radial-gradient(circle at top right, #1e1b4b 0%, #090d16 100%)', padding: 20, fontFamily: 'Inter, Arial, sans-serif'
  },
  loginCard: {
    background: 'rgba(17, 24, 39, 0.85)', backdropFilter: 'blur(16px)', padding: 40, borderRadius: 24, width: '100%',
    maxWidth: 440, boxSizing: 'border-box', display: 'grid', gap: 18,
    boxShadow: '0 25px 50px rgba(0,0,0,0.6)', border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  loginHeaderIcon: {
    width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    display: 'grid', placeItems: 'center', margin: '0 auto 4px', boxShadow: '0 10px 25px rgba(99,102,241,0.4)'
  },
  loginTitle: {
    fontSize: 28, fontWeight: 800, textAlign: 'center', margin: 0, color: '#f8fafc', letterSpacing: '-0.03em'
  },
  loginSubtitle: {
    textAlign: 'center', margin: '-8px 0 0', color: '#818cf8', fontWeight: 600, fontSize: 14
  },
  loginSubText: {
    textAlign: 'center', margin: '-12px 0 10px', color: '#94a3b8', fontSize: 13
  },
  demoBadge: {
    background: 'rgba(30, 41, 59, 0.6)', padding: '12px', borderRadius: 10, textAlign: 'center',
    fontSize: 12, color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.06)'
  },
  appShell: {
    minHeight: '100vh', display: 'flex', background: '#090d16',
    color: '#f1f5f9', fontFamily: 'Inter, Arial, sans-serif'
  },
  sidebar: {
    width: 270, background: '#0b1120', color: '#94a3b8',
    padding: '20px 16px', boxSizing: 'border-box', display: 'flex',
    flexDirection: 'column', gap: 14, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)'
  },
  sidebarOpen: {
    position: 'fixed', inset: '0 auto 0 0', zIndex: 30,
    width: 280, overflowY: 'auto', boxShadow: '15px 0 40px rgba(0,0,0,0.8)'
  },
  mobileOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 25,
    backdropFilter: 'blur(4px)'
  },
  brand: {
    display: 'flex', alignItems: 'center', gap: 12, padding: '6px 8px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)'
  },
  brandIconBox: {
    width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    display: 'grid', placeItems: 'center', boxShadow: '0 8px 20px rgba(79,70,229,0.4)'
  },
  workspace: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
    background: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, fontSize: 13, border: '1px solid rgba(255,255,255,0.06)'
  },
  workspaceIcon: {
    display: 'grid', placeItems: 'center', width: 34, height: 34,
    borderRadius: 9, background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#fff', fontWeight: 700, fontSize: 12
  },
  navScroll: {
    overflowY: 'auto', flex: 1, paddingRight: '2px'
  },
  navTitle: {
    padding: '16px 8px 6px', fontSize: 11, color: '#64748b',
    textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 700
  },
  navButton: {
    display: 'flex', alignItems: 'center', gap: 11, width: '100%',
    padding: '11px 14px', border: 0, borderRadius: 10,
    color: '#94a3b8', background: 'transparent', textAlign: 'left',
    cursor: 'pointer', marginBottom: 4, fontSize: 13, fontWeight: 500,
    transition: 'all 0.2s ease'
  },
  navActive: {
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 600,
    boxShadow: '0 6px 20px rgba(79,70,229,0.4)'
  },
  userCard: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '12px 10px',
    background: 'rgba(30, 41, 59, 0.5)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)'
  },
  avatar: {
    width: 38, height: 38, borderRadius: '50%', display: 'grid',
    placeItems: 'center', background: 'rgba(99,102,241,0.2)', color: '#818cf8',
    fontWeight: 700, flexShrink: 0, fontSize: 14, border: '1px solid rgba(99,102,241,0.3)'
  },
  logoutButton: {
    background: 'transparent', color: '#94a3b8', border: 0,
    padding: 6, cursor: 'pointer', borderRadius: 8, display: 'grid', placeItems: 'center',
    transition: 'color 0.2s'
  },
  iconButton: {
    display: 'inline-grid', placeItems: 'center', background: '#111827',
    color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
    padding: 9, cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
  },
  mainContent: {
    minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', background: '#090d16'
  },
  topbar: {
    display: 'flex', alignItems: 'center', gap: 14, minHeight: 72,
    background: '#0b1120', borderBottom: '1px solid rgba(255,255,255,0.06)',
    padding: '10px 32px', boxSizing: 'border-box', boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
  },
  searchContainer: {
    display: 'flex', alignItems: 'center', gap: 10, background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '9px 14px',
    maxWidth: 340, width: '100%'
  },
  searchInput: {
    border: 0, outline: 0, background: 'transparent', minWidth: 0, width: '100%', fontSize: 13, color: '#f8fafc'
  },
  contentArea: {
    padding: 32, flex: 1, width: '100%', maxWidth: 1600,
    boxSizing: 'border-box', margin: '0 auto'
  },
  pageHeading: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: 16, flexWrap: 'wrap', marginBottom: 28
  },
  eyebrow: {
    color: '#818cf8', fontSize: 12, fontWeight: 700,
    textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.06em'
  },
  h1: { fontSize: 28, margin: '0 0 6px', letterSpacing: '-.03em', color: '#f8fafc', fontWeight: 800 },
  subtitle: { color: '#94a3b8', fontSize: 14, margin: 0 },
  metricsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
    gap: 20, marginBottom: 28
  },
  metricCard: {
    background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18,
    padding: 22, boxShadow: '0 10px 30px rgba(0,0,0,0.3)', minWidth: 0,
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  metricTop: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 10
  },
  metricTitleText: { fontSize: 13, color: '#94a3b8', fontWeight: 600 },
  metricIcon: {
    width: 44, height: 44, display: 'grid', placeItems: 'center',
    borderRadius: 14, flexShrink: 0
  },
  metricValue: {
    fontSize: 26, fontWeight: 800, margin: '14px 0 6px',
    overflowWrap: 'anywhere', color: '#f8fafc', letterSpacing: '-0.02em'
  },
  metricNote: { color: '#64748b', fontSize: 12 },
  panel: {
    background: '#111827', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20,
    padding: 28, marginBottom: 28, minWidth: 0,
    boxShadow: '0 10px 40px rgba(0,0,0,0.4)'
  },
  panelHeading: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 14, flexWrap: 'wrap', marginBottom: 20
  },
  panelTitle: { fontSize: 19, fontWeight: 750, color: '#f8fafc', margin: 0, letterSpacing: '-0.02em' },
  panelDesc: { fontSize: 13, color: '#94a3b8', margin: '4px 0 0' },
  countBadge: {
    borderRadius: 20, padding: '5px 14px', background: 'rgba(99,102,241,0.15)',
    color: '#818cf8', fontSize: 12, fontWeight: 700, border: '1px solid rgba(99,102,241,0.3)'
  },
  tableWrap: { width: '100%', overflowX: 'auto', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)' },
  table: {
    width: '100%', borderCollapse: 'collapse', fontSize: 13,
    minWidth: 700, textAlign: 'left', color: '#e2e8f0'
  },
  emptyCell: {
    textAlign: 'center', padding: 40, color: '#94a3b8', fontStyle: 'italic'
  },
  label: {
    display: 'grid', gap: 6, marginBottom: 16, fontSize: 13,
    fontWeight: 600, color: '#cbd5e1'
  },
  input: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '11px 16px',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, background: '#0b1120',
    color: '#f8fafc', fontSize: '13px', outline: 'none', transition: 'border-color 0.2s, box-shadow 0.2s'
  },
  selectInput: {
    width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '11px 16px',
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, background: '#0b1120',
    color: '#f8fafc', fontSize: '13px', outline: 'none', cursor: 'pointer'
  },
  formGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))',
    gap: 18
  },
  primaryButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 8, padding: '12px 22px', border: 0, borderRadius: 12,
    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', color: '#ffffff', fontWeight: 650, cursor: 'pointer',
    fontSize: '14px', boxShadow: '0 8px 25px rgba(79,70,229,0.4)', transition: 'all 0.2s'
  },
  secondaryButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    gap: 7, padding: '11px 18px', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, background: '#1e293b', color: '#f1f5f9',
    cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'background 0.2s'
  },
  dangerButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10,
    color: '#f87171', background: 'rgba(239,68,68,0.15)', cursor: 'pointer', transition: 'background 0.2s'
  },
  disabledDangerButton: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
    color: '#64748b', background: '#0b1120', cursor: 'not-allowed', opacity: 0.6
  },
  balanceStatus: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
    borderRadius: 12, margin: '20px 0', fontWeight: 600, fontSize: 13, border: '1px solid'
  },
  notice: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px',
    borderRadius: 12, marginBottom: 18, fontSize: 13, border: '1px solid'
  },
  infoNotice: { background: 'rgba(99,102,241,0.15)', color: '#818cf8', borderColor: 'rgba(99,102,241,0.3)' },
  errorNotice: { background: 'rgba(239,68,68,0.15)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' },
  error: { color: '#f87171', fontSize: 13, margin: '4px 0 12px', fontWeight: 500 },
  reportTabs: {
    display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20
  },
  reportTab: {
    display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px',
    borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: '#111827',
    color: '#94a3b8', cursor: 'pointer', fontWeight: 500, fontSize: '13px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
  },
  reportTabActive: {
    borderColor: '#6366f1', color: '#ffffff', background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    fontWeight: 700, boxShadow: '0 6px 20px rgba(79,70,229,0.4)'
  },
  dateBadge: {
    background: '#1e293b', padding: '4px 8px', borderRadius: 6, fontSize: '12px', color: '#cbd5e1', fontWeight: 500
  },
  typeBadge: {
    background: '#1e293b', padding: '3px 8px', borderRadius: 6, fontSize: '11px', color: '#e2e8f0', fontWeight: 600, display: 'inline-block'
  },
  statusBadge: {
    background: 'rgba(16,185,129,0.15)', color: '#34d399', padding: '3px 8px', borderRadius: 6, fontSize: '11px', fontWeight: 600, border: '1px solid rgba(16,185,129,0.3)'
  },
  footer: {
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap',
    gap: 10, padding: '20px 32px', background: '#0b1120',
    borderTop: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8', fontSize: 12
  }
};
