'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface StaffMember {
  id: number;
  username: string;
  display_name: string;
  role: string;
  is_active: number;
  permissions: string;
  last_login: string | null;
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', display_name: '', role: 'staff' });
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.get<StaffMember[]>('/api/admin/staff');
      setStaff(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }

  async function create() {
    await api.post('/api/admin/staff', form);
    setShowForm(false);
    setForm({ username: '', password: '', display_name: '', role: 'staff' });
    load();
  }

  async function toggleActive(id: number, active: boolean) {
    await api.patch(`/api/admin/staff/${id}`, { is_active: active });
    load();
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <button onClick={() => setHelpOpen(!helpOpen)} className="text-xs text-blue-600 hover:underline mt-0.5">What is staff management?</button>
          {helpOpen && <p className="text-sm text-gray-500 mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3">Manage admin accounts that can access this panel. Staff can be assigned roles (staff, admin, owner) to control access levels. Disable an account to revoke access without deleting it.</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-medium">+ Add Staff</button>
      </div>

      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 grid grid-cols-2 gap-3">
          <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <input placeholder="Display Name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm" />
          <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="border border-gray-200 rounded px-3 py-1.5 text-sm">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          <button onClick={create} className="col-span-2 px-4 py-2 bg-green-600 text-white rounded text-sm">Create Staff Account</button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Display Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Last Login</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">{s.username}</td>
                <td className="px-4 py-3">{s.display_name}</td>
                <td className="px-4 py-3 capitalize">{s.role}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {s.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{s.last_login ? new Date(s.last_login).toLocaleDateString() : 'Never'}</td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleActive(s.id, !s.is_active)} className="text-xs text-blue-600 hover:underline">
                    {s.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
