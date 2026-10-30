import { useEffect, useState } from 'react';
import { apiFetch } from './api.js';

const ROLES = [
  ['principal', 'Principal / प्रधानाध्यापक'],
  ['accountant', 'Accountant / लेखापाल'],
  ['cashier', 'Cashier / क्यासियर'],
  ['exam_coordinator', 'Exam Coordinator / परीक्षा संयोजक'],
  ['teacher', 'Teacher / शिक्षक'],
  ['viewer', 'Read-only / हेर्ने मात्र'],
  ['admin', 'Admin / प्रशासक']
];

export default function UserAccessModule({ apiBaseUrl }) {
  const [users, setUsers] = useState([]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('accountant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function request(path, options = {}) {
    const response = await apiFetch(`${apiBaseUrl}${path}`, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  }
  async function loadUsers() {
    setLoading(true); setError('');
    try { setUsers(await request('/api/admin/users')); }
    catch (err) { setError(err.message || 'प्रयोगकर्ता सूची लोड भएन।'); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function createUser(event) {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true);
    try {
      await request('/api/admin/users', {
  method: 'POST',
  body: JSON.stringify({ fullName, email, password, role, permissions: [] })
});
      setNotice(`${email} का लागि छुट्टै login तयार भयो।`);
      setFullName(''); setEmail(''); setPassword(''); setRole('accountant');
      await loadUsers();
    } catch (err) { setError(err.message || 'नयाँ login बनाउन सकिएन।'); }
    finally { setLoading(false); }
  }
  async function toggleActive(user) {
    setError(''); setNotice('');
    try {
   await request(`/api/admin/users/${user.id}/status`, {
  method: 'PATCH',
  body: JSON.stringify({ isActive: !user.is_active })
});  
      setNotice(`${user.email} को login ${user.is_active ? 'निष्क्रिय' : 'सक्रिय'} गरियो।`);
      await loadUsers();
    } catch (err) { setError(err.message || 'User update गर्न सकिएन।'); }
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <section style={{ background: '#111827', border: '1px solid #334155', borderRadius: 14, padding: 20, color: '#e5e7eb' }}>
        <h2 style={{ marginTop: 0 }}>प्रयोगकर्ता पहुँच / User Access Control</h2>
        <p style={{ color: '#94a3b8' }}>प्रत्येक कर्मचारीलाई छुट्टै login र role दिनुहोस्। Password कम्तीमा १२ अक्षरको हुनुपर्छ।</p>
        {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
        {notice && <p style={{ color: '#86efac' }}>{notice}</p>}
        <form onSubmit={createUser} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 12 }}>
          <label>पूरा नाम<input value={fullName} onChange={e => setFullName(e.target.value)} required style={inputStyle} /></label>
          <label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={inputStyle} /></label>
          <label>Temporary password<input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={12} required style={inputStyle} /></label>
          <label>Role<select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>{ROLES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Saving...' : 'नयाँ Login बनाउनुहोस्'}</button>
        </form>
      </section>
      <section style={{ background: '#111827', border: '1px solid #334155', borderRadius: 14, padding: 20, color: '#e5e7eb', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>प्रयोगकर्ता सूची</h3><button type="button" onClick={loadUsers} style={buttonStyle}>Refresh</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['नाम','Email','Role','स्थिति','अन्तिम Login','कार्य'].map(x => <th key={x} style={thStyle}>{x}</th>)}</tr></thead>
          <tbody>{users.map(user => <tr key={user.id}>
            <td style={tdStyle}>{user.full_name}</td><td style={tdStyle}>{user.email}</td><td style={tdStyle}>{user.role}</td>
            <td style={tdStyle}>{user.is_active ? 'Active' : 'Inactive'}</td>
            <td style={tdStyle}>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'अहिलेसम्म login छैन'}</td>
            <td style={tdStyle}><button type="button" onClick={() => toggleActive(user)} disabled={loading} style={buttonStyle}>{user.is_active ? 'Deactivate' : 'Activate'}</button></td>
          </tr>)}{!users.length && <tr><td style={tdStyle} colSpan="6">{loading ? 'Loading...' : 'प्रयोगकर्ता छैनन्।'}</td></tr>}</tbody>
        </table>
      </section>
    </div>
  );
}
const inputStyle = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc' };
const buttonStyle = { padding: '10px 14px', borderRadius: 8, border: '1px solid #475569', background: '#7c3aed', color: 'white', cursor: 'pointer', alignSelf: 'end' };
const thStyle = { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #475569' };
const tdStyle = { padding: '10px 8px', borderBottom: '1px solid #334155' };
