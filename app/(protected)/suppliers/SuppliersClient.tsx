"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, isAdmin } from "@/lib/utils";
import { Supplier, Profile } from "@/types";
import { toast } from "sonner";

interface Props {
  initialSuppliers: Supplier[];
  totalCount: number;
  profile: Profile;
}

export default function SuppliersClient({ initialSuppliers, totalCount, profile }: Props) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", company: "", phone: "", address: "" });
  const [saving, setSaving] = useState(false);
  const admin = isAdmin(profile.role);

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    (s.company || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalDue = suppliers.reduce((s, sup) => s + (sup.total_due || 0), 0);

  const handleAdd = async () => {
    if (!newSupplier.name || !newSupplier.phone) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...newSupplier, total_due: 0, is_active: true })
        .select().single();
      if (error) throw error;
      setSuppliers([data, ...suppliers]);
      toast.success("New supplier added");
      setShowAddModal(false);
      setNewSupplier({ name: "", company: "", phone: "", address: "" });
    } catch {
      toast.error("Failed to add supplier");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSupplier = async (id: string, totalDue: number) => {
    // Explicit check for transaction history
    if (totalDue > 0) {
      toast.error("Error: This supplier has an outstanding balance or purchase history. You cannot delete a supplier with active transaction records.");
      return;
    }

    const confirm = prompt("To delete this supplier, please type 'DELETE':");
    if (confirm !== "DELETE") return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) {
        if (error.code === '23503') throw new Error("Cannot delete supplier with existing purchase records.");
        throw error;
      }
      setSuppliers(suppliers.filter(s => s.id !== id));
      toast.success("Supplier deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Total {totalCount}
            {totalDue > 0 && <span className="ml-2 text-red-500">• Total Payable: {formatCurrency(totalDue)}</span>}
          </p>
        </div>
        <button onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all active:scale-95 font-bangla shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Supplier
        </button>
      </div>

      {/* Due alert */}
      {totalDue > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-orange-700">
            Total outstanding payable to suppliers: <strong>{formatCurrency(totalDue)}</strong>
          </p>
        </div>
      )}

      {/* Search */}
      <div className="fcf-card p-4">
        <input type="text" placeholder="Search by name, company or phone..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-full max-w-sm" />
      </div>

      {/* Table */}
      <div className="fcf-card overflow-hidden">
        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Address</th>
                <th className="text-right">Total Purchase</th>
                <th className="text-right">Payable</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No suppliers found</td></tr>
              ) : filtered.map(s => (
                <tr key={s.id} className={s.total_due > 0 ? "bg-orange-50/20" : ""}>
                  <td>
                    <Link href={`/suppliers/${s.id}`} className="font-semibold text-slate-800 hover:text-blue-600 font-bangla transition-colors">
                      {s.name}
                    </Link>
                  </td>
                  <td className="text-sm text-slate-500 font-bangla">{s.company || "—"}</td>
                  <td className="text-sm text-slate-600">{s.phone}</td>
                  <td className="text-sm text-slate-400 font-bangla max-w-[160px] truncate">{s.address || "—"}</td>
                  <td className="text-right text-sm font-medium">{formatCurrency(s.total_due)}</td>
                  <td className="text-right">
                    {s.total_due > 0
                      ? <span className="text-orange-600 font-bold text-sm">{formatCurrency(s.total_due)}</span>
                      : <span className="text-green-600 text-sm">✓ Cleared</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/suppliers/${s.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex" title="Profile">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      {admin && (
                        <button 
                          onClick={() => handleDeleteSupplier(s.id, s.total_due)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                          title="Delete Supplier"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No suppliers found</div>
          ) : filtered.map(s => (
            <div key={s.id} className={`p-4 space-y-3 ${s.total_due > 0 ? "bg-orange-50/10" : ""}`}>
              <div className="flex items-center justify-between">
                <Link href={`/suppliers/${s.id}`} className="font-bold text-slate-900 font-bangla">{s.name}</Link>
                <div className="flex gap-2">
                   <Link href={`/suppliers/${s.id}`} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">View</Link>
                   {admin && (
                      <button 
                        onClick={() => handleDeleteSupplier(s.id, s.total_due)}
                        className="text-red-500 bg-red-50 p-1 rounded-lg"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                   )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                 <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Company</p>
                    <p className="font-medium text-slate-700 truncate font-bangla">{s.company || "—"}</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Phone</p>
                    <p className="font-medium text-slate-700">{s.phone}</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-2 bg-white/50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Purchase</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(s.total_due)}</p>
                </div>
                <div className="text-center border-l border-slate-200">
                  <p className="text-[10px] text-slate-500 uppercase font-bold">Payable</p>
                  <p className={`text-sm font-bold ${s.total_due > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {s.total_due > 0 ? formatCurrency(s.total_due) : "Cleared"}
                  </p>
                </div>
              </div>
              {s.address && (
                <div>
                   <p className="text-[10px] text-slate-400 uppercase font-bold">Address</p>
                   <p className="text-xs text-slate-600 font-bangla line-clamp-1">{s.address}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500 font-bangla">
          Showing {filtered.length} / {suppliers.length} suppliers
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Add New Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Name *", key: "name", placeholder: "Supplier name" },
                { label: "Company", key: "company", placeholder: "Company name (optional)" },
                { label: "Phone *", key: "phone", placeholder: "01XXXXXXXXX" },
                { label: "Address", key: "address", placeholder: "Full address" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700 font-bangla">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={newSupplier[key as keyof typeof newSupplier]}
                    onChange={e => setNewSupplier({ ...newSupplier, [key]: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowAddModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
