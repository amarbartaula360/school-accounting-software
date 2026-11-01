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
  const [examRole, setExamRole] = useState('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingUser, setEditingUser] = useState(null);

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
  body: JSON.stringify({ fullName, email, password, role, examRole, permissions: [] })
});
      setNotice(`${email} का लागि छुट्टै login तयार भयो।`);
      setFullName(''); setEmail(''); setPassword(''); setRole('accountant'); setExamRole('none');
      await loadUsers();
    } catch (err) { setError(err.message || 'नयाँ login बनाउन सकिएन।'); }
    finally { setLoading(false); }
  }
  async function saveUserEdit(event) {
    event.preventDefault(); setError(''); setNotice(''); setLoading(true);
    try {
      await request('/api/admin/users/' + editingUser.id, {
        method: 'PUT',
        body: JSON.stringify({ fullName: editingUser.full_name, email: editingUser.email, role: editingUser.role, examRole: editingUser.exam_role || 'none', permissions: editingUser.permissions || [] })
      });
      setNotice(editingUser.email + ' को विवरण परिवर्तन गरियो।');
      setEditingUser(null);
      await loadUsers();
    } catch (err) { setError(err.message || 'User विवरण परिवर्तन गर्न सकिएन।'); }
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
          <label>Accounting / General Role<select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>{ROLES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Examination &amp; Marksheet Role<select value={examRole} onChange={e => setExamRole(e.target.value)} style={inputStyle}><option value="none">No Access / पहुँच छैन</option><option value="admin">Admin / प्रशासक</option><option value="principal">Principal / प्रधानाध्यापक</option><option value="exam_coordinator">Exam Coordinator / परीक्षा संयोजक</option><option value="teacher">Teacher / शिक्षक</option></select></label>
          <button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Saving...' : 'नयाँ Login बनाउनुहोस्'}</button>
        </form>
      </section>
      <section style={{ background: '#111827', border: '1px solid #334155', borderRadius: 14, padding: 20, color: '#e5e7eb', overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>प्रयोगकर्ता सूची</h3><button type="button" onClick={loadUsers} style={buttonStyle}>Refresh</button>
        </div>
        {editingUser && (
          <form onSubmit={saveUserEdit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12, padding: 14, marginBottom: 16, border: '1px solid #475569', borderRadius: 10 }}>
            <strong style={{ gridColumn: '1 / -1' }}>प्रयोगकर्ता विवरण सम्पादन / Edit User</strong>
            <label>पूरा नाम<input value={editingUser.full_name || ''} onChange={e => setEditingUser(u => ({ ...u, full_name: e.target.value }))} required style={inputStyle} /></label>
            <label>Email<input type="email" value={editingUser.email || ''} onChange={e => setEditingUser(u => ({ ...u, email: e.target.value }))} required style={inputStyle} /></label>
            <label>Accounting / General Role<select value={editingUser.role || 'accountant'} onChange={e => setEditingUser(u => ({ ...u, role: e.target.value }))} style={inputStyle}>{ROLES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Examination Role<select value={editingUser.exam_role || 'none'} onChange={e => setEditingUser(u => ({ ...u, exam_role: e.target.value }))} style={inputStyle}><option value="none">No Access / पहुँच छैन</option><option value="admin">Admin / प्रशासक</option><option value="principal">Principal / प्रधानाध्यापक</option><option value="exam_coordinator">Exam Coordinator / परीक्षा संयोजक</option><option value="teacher">Teacher / शिक्षक</option></select></label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'end' }}><button type="submit" disabled={loading} style={buttonStyle}>{loading ? 'Saving...' : 'Save Changes'}</button><button type="button" onClick={() => setEditingUser(null)} style={{ ...buttonStyle, background: '#475569' }}>Cancel</button></div>
          </form>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>{['नाम','Email','General Role','Examination Role','स्थिति','अन्तिम Login','कार्य'].map(x => <th key={x} style={thStyle}>{x}</th>)}</tr></thead>
          <tbody>{users.map(user => <tr key={user.id}>
            <td style={tdStyle}>{user.full_name}</td><td style={tdStyle}>{user.email}</td><td style={tdStyle}>{user.role}</td>
            <td style={tdStyle}>{({ admin: 'Admin', principal: 'Principal', exam_coordinator: 'Exam Coordinator', teacher: 'Teacher', none: 'No Access' })[user.exam_role || 'none']}</td>
            <td style={tdStyle}>{user.is_active ? 'Active' : 'Inactive'}</td>
            <td style={tdStyle}>{user.last_login_at ? new Date(user.last_login_at).toLocaleString() : 'अहिलेसम्म login छैन'}</td>
            <td style={tdStyle}><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}><button type="button" onClick={() => setEditingUser({ ...user, exam_role: user.exam_role || 'none' })} disabled={loading} style={{ ...buttonStyle, background: '#2563eb' }}>Edit</button><button type="button" onClick={() => toggleActive(user)} disabled={loading} style={buttonStyle}>{user.is_active ? 'Deactivate' : 'Activate'}</button></div></td>
          </tr>)}{!users.length && <tr><td style={tdStyle} colSpan="7">{loading ? 'Loading...' : 'प्रयोगकर्ता छैनन्।'}</td></tr>}</tbody>
        </table>
      </section>
    </div>
  );
}
const inputStyle = { display: 'block', width: '100%', marginTop: 6, padding: '10px 12px', borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#f8fafc' };
const buttonStyle = { padding: '10px 14px', borderRadius: 8, border: '1px solid #475569', background: '#7c3aed', color: 'white', cursor: 'pointer', alignSelf: 'end' };
const thStyle = { textAlign: 'left', padding: '10px 8px', borderBottom: '1px solid #475569' };
const tdStyle = { padding: '10px 8px', borderBottom: '1px solid #334155' };
