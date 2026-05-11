"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, isAdmin } from "@/lib/utils";
import { Customer, Profile } from "@/types";
import { toast } from "sonner";

interface Props {
  initialCustomers: Customer[];
  totalCount: number;
  areas: string[];
  profile: Profile;
}

export default function CustomersClient({ initialCustomers, totalCount, areas, profile }: Props) {
  const router = useRouter();
  const [customers, setCustomers] = useState(initialCustomers);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [areaFilter, setAreaFilter] = useState("");
  const [dueFilter, setDueFilter] = useState(""); // "has_due" | "no_due" | ""
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "", area: "" });
  const [saving, setSaving] = useState(false);
  const admin = isAdmin(profile.role);
  const PAGE_SIZE = 50;

  const fetchCustomers = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("customers")
        .select("*", { count: "exact" })
        .order("total_due", { ascending: false })
        .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);

      if (areaFilter) query = query.eq("area", areaFilter);
      if (dueFilter === "has_due") query = query.gt("total_due", 0);
      if (dueFilter === "no_due") query = query.eq("total_due", 0);

      const { data, count, error } = await query;
      if (error) throw error;

      const customersData = (data as Customer[]) || [];
      let filtered = customersData;

      if (search) {
        const s = search.toLowerCase();
        filtered = customersData.filter(c => 
          (c.name?.toLowerCase().includes(s)) || 
          (c.phone?.includes(search))
        );
      }

      setCustomers(filtered);
      setTotal(count || 0);
      setPage(pageNum);
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, [search, areaFilter, dueFilter]);

  const handleAddCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) { toast.error("Name and phone number are required"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("customers").insert({
        ...newCustomer, total_due: 0, total_purchase: 0, is_active: true,
      });
      if (error) throw error;
      toast.success("New customer added");
      setShowAddModal(false);
      setNewCustomer({ name: "", phone: "", address: "", area: "" });
      fetchCustomers(1);
    } catch {
      toast.error("Failed to add customer");
    } finally {
      setSaving(false);
    }
  };
  
  const handleDeleteCustomer = async (id: string, totalPurchase: number, totalDue: number) => {
    // Explicit check for transaction history
    if (totalPurchase > 0 || totalDue > 0) {
      toast.error("Error: This customer has order history. You cannot delete a customer with existing transaction records.");
      return;
    }

    const confirm = prompt("To delete this customer, please type 'DELETE':");
    if (confirm !== "DELETE") return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) {
        if (error.code === '23503') throw new Error("Cannot delete customer with existing orders.");
        throw error;
      }
      toast.success("Customer deleted");
      fetchCustomers(page);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setSaving(false);
    }
  };

  const totalDue = customers.reduce((s, c) => s + (c.total_due || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Total {total} customers
            {admin && totalDue > 0 && <span className="ml-2 text-red-500">• Total Due: {formatCurrency(totalDue)}</span>}
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all active:scale-95 font-bangla shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Customer
        </button>
      </div>

      {/* Filters */}
      <div className="fcf-card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text" placeholder="Search by name or phone..." value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && fetchCustomers(1)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla w-48"
          />
          <select value={areaFilter} onChange={e => setAreaFilter(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla">
            <option value="">All Areas</option>
            {areas.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select value={dueFilter} onChange={e => setDueFilter(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla">
            <option value="">All Customers</option>
            <option value="has_due">Has Due</option>
            <option value="no_due">No Due</option>
          </select>
          <button onClick={() => fetchCustomers(1)} disabled={loading}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 font-bangla">
            {loading ? "..." : "Search"}
          </button>
          <button onClick={() => { setSearch(""); setAreaFilter(""); setDueFilter(""); setTimeout(() => fetchCustomers(1), 50); }}
            className="h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50 font-bangla">
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="fcf-card overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Area</th>
                <th className="text-right">Total Purchase</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Due</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No customers found</td></tr>
              ) : customers.map(c => (
                <tr key={c.id} className={c.total_due > 0 ? "bg-red-50/20" : ""}>
                  <td>
                    <Link href={`/customers/${c.id}`} className="font-semibold text-slate-800 hover:text-blue-600 transition-colors font-bangla">
                      {c.name}
                    </Link>
                  </td>
                  <td className="text-sm text-slate-600">{c.phone}</td>
                  <td className="text-sm text-slate-500 font-bangla">{c.area || "—"}</td>
                  <td className="text-right text-sm font-medium">{formatCurrency(c.total_purchase)}</td>
                  <td className="text-right text-sm text-green-700">{formatCurrency(c.total_purchase - c.total_due)}</td>
                  <td className="text-right">
                    {c.total_due > 0
                      ? <span className="text-red-600 font-bold text-sm">{formatCurrency(c.total_due)}</span>
                      : <span className="text-green-600 text-sm">✓ Cleared</span>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <Link href={`/customers/${c.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"
                        title="View Profile">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                      {admin && (
                        <button 
                          onClick={() => handleDeleteCustomer(c.id, c.total_purchase, c.total_due)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"
                          title="Delete Customer"
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

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400 font-bangla">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-bangla">No customers found</div>
          ) : customers.map(c => (
            <div key={c.id} className={`p-4 space-y-3 ${c.total_due > 0 ? "bg-red-50/10" : ""}`}>
              <div className="flex items-center justify-between">
                 <Link href={`/customers/${c.id}`} className="font-bold text-slate-900 font-bangla">{c.name}</Link>
                 <div className="flex gap-2">
                    <Link href={`/customers/${c.id}`} className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">Profile</Link>
                    {admin && (
                      <button 
                        onClick={() => handleDeleteCustomer(c.id, c.total_purchase, c.total_due)}
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
                    <p className="text-[10px] text-slate-400 uppercase font-bold text-[8px]">Phone</p>
                    <p className="font-medium text-slate-700">{c.phone}</p>
                 </div>
                 <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold text-[8px]">Area</p>
                    <p className="font-medium text-slate-700 font-bangla">{c.area || "—"}</p>
                 </div>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-white/50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold text-[8px]">Total</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(c.total_purchase)}</p>
                </div>
                <div className="text-center border-x border-slate-200">
                  <p className="text-[10px] text-slate-500 uppercase font-bold text-[8px]">Paid</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(c.total_purchase - c.total_due)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold text-[8px]">Due</p>
                  <p className={`text-sm font-bold ${c.total_due > 0 ? "text-red-600" : "text-slate-400"}`}>
                    {c.total_due > 0 ? formatCurrency(c.total_due) : "Cleared"}
                  </p>
                </div>
              </div>
              {c.address && (
                <div>
                   <p className="text-[10px] text-slate-400 uppercase font-bold text-[8px]">Address</p>
                   <p className="text-xs text-slate-600 font-bangla line-clamp-1">{c.address}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500 font-bangla">
          Showing {customers.length}
          {Math.ceil(total / PAGE_SIZE) > 1 && (
            <div className="flex gap-2 float-right">
              <button onClick={() => fetchCustomers(page - 1)} disabled={page <= 1 || loading}
                className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40">← Prev</button>
              <button onClick={() => fetchCustomers(page + 1)} disabled={page >= Math.ceil(total / PAGE_SIZE) || loading}
                className="px-3 py-1 text-xs border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Add New Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Name *", key: "name", placeholder: "Customer full name" },
                { label: "Phone *", key: "phone", placeholder: "01XXXXXXXXX" },
                { label: "Address", key: "address", placeholder: "Full address" },
                { label: "Area", key: "area", placeholder: "e.g. Dhaka, Chittagong" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700 font-bangla">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={newCustomer[key as keyof typeof newCustomer]}
                    onChange={e => setNewCustomer({ ...newCustomer, [key]: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowAddModal(false)}
                className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleAddCustomer} disabled={saving}
                className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
