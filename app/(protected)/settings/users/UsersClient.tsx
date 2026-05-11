"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Profile } from "@/types";
import { toast } from "sonner";

interface Props { users: Profile[]; currentUserId: string; }

export default function UsersClient({ users: initialUsers, currentUserId }: Props) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [newUser, setNewUser] = useState({ full_name: "", email: "", phone: "", role: "staff", password: "" });
  const [editData, setEditData] = useState({ full_name: "", phone: "", role: "staff", is_active: true });
  const [saving, setSaving] = useState(false);

  const handleAddUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.password) {
      toast.error("Name, email and password are required");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newUser.email,
          password: newUser.password,
          full_name: newUser.full_name,
          phone: newUser.phone,
          role: newUser.role,
        }),
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to create user");

      toast.success("New user added");
      setShowAddModal(false);
      setNewUser({ full_name: "", email: "", phone: "", role: "staff", password: "" });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to add user");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update(editData).eq("id", editingUser.id);
      if (error) throw error;
      setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...editData } as Profile : u));
      toast.success("Information updated");
      setEditingUser(null);
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: Profile) => {
    if (user.id === currentUserId) { toast.error("You cannot deactivate yourself"); return; }
    try {
      const supabase = createClient();
      const newStatus = !user.is_active;
      const { error } = await supabase.from("profiles").update({ is_active: newStatus }).eq("id", user.id);
      if (error) throw error;
      setUsers(users.map(u => u.id === user.id ? { ...u, is_active: newStatus } : u));
      toast.success(newStatus ? "User activated" : "User deactivated");
    } catch {
      toast.error("Failed to change status");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="p-2 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
            <p className="text-sm text-slate-500 mt-0.5">Total {users.length} users</p>
          </div>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add New Staff
        </button>
      </div>

      <div className="fcf-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={!u.is_active ? "opacity-50" : ""}>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-sm font-bold flex-shrink-0">
                        {u.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{u.full_name}</p>
                        {u.id === currentUserId && <p className="text-xs text-blue-500">You</p>}
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-slate-600">{u.email}</td>
                  <td className="text-sm text-slate-600">{u.phone || "—"}</td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      u.role === "admin" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                    }`}>
                      {u.role === "admin" ? "Admin" : "Staff"}
                    </span>
                  </td>
                  <td>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      u.is_active ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                    }`}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="text-sm text-slate-500">{formatDate(u.created_at)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingUser(u); setEditData({ full_name: u.full_name, phone: u.phone || "", role: u.role, is_active: u.is_active }); }}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {u.id !== currentUserId && (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`p-1.5 rounded-lg transition-colors ${u.is_active ? "text-slate-400 hover:text-red-500 hover:bg-red-50" : "text-slate-400 hover:text-green-600 hover:bg-green-50"}`}
                          title={u.is_active ? "Deactivate" : "Activate"}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {u.is_active
                              ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                              : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />}
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Add New Staff</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                ["Full Name *", "full_name", "text", "Staff name"],
                ["Email *", "email", "email", "staff@fcf.com"],
                ["Phone", "phone", "tel", "01XXXXXXXXX"],
              ].map(([label, key, type, placeholder]) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <input type={type} placeholder={placeholder}
                    value={newUser[key as keyof typeof newUser]}
                    onChange={e => setNewUser({ ...newUser, [key]: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
              ))}
              <div>
                <label className="text-sm font-medium text-slate-700">Role</label>
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Temporary Password *</label>
                <input type="password" placeholder="At least 6 characters" value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-xs text-amber-700">Staff can change the password on first login.</p>
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowAddModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleAddUser} disabled={saving} className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Adding..." : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Edit Information</h3>
              <button onClick={() => setEditingUser(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <input type="text" value={editData.full_name} onChange={e => setEditData({ ...editData, full_name: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Phone</label>
                <input type="tel" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              {editingUser.id !== currentUserId && (
                <div>
                  <label className="text-sm font-medium text-slate-700">Role</label>
                  <select value={editData.role} onChange={e => setEditData({ ...editData, role: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none font-bangla">
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setEditingUser(null)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleEditSave} disabled={saving} className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Updating..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
