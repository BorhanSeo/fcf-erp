"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, isAdmin } from "@/lib/utils";
import { Profile } from "@/types";
import { toast } from "sonner";

type Tab = "customer_due" | "supplier_due" | "history";

interface CustomerDue { id: string; name: string; phone: string; area: string | null; total_due: number; }
interface SupplierDue { id: string; name: string; company: string | null; phone: string; total_due: number; }
interface CustomerPayment { id: string; amount: number; payment_method: string; payment_date: string; note?: string; customers: { name: string; phone: string } | null; isOrder?: boolean; orderNumber?: string; }
interface SupplierPayment { id: string; amount: number; payment_method: string; payment_date: string; note?: string; suppliers: { name: string } | null; }

interface Props {
  customersWithDue: CustomerDue[];
  suppliersWithDue: SupplierDue[];
  recentCustomerPayments: CustomerPayment[];
  recentSupplierPayments: SupplierPayment[];
  totalCustomerDue: number;
  totalSupplierDue: number;
  todayTotal: number;
  monthTotal: number;
  profile: Profile;
}

const METHODS: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank" };

export default function PaymentsClient({
  customersWithDue, suppliersWithDue, recentCustomerPayments, recentSupplierPayments,
  totalCustomerDue, totalSupplierDue, todayTotal, monthTotal, profile,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("customer_due");
  const [payModal, setPayModal] = useState<{ type: "customer" | "supplier"; id: string; name: string; due: number } | null>(null);
  const [payData, setPayData] = useState({ amount: "", method: "cash", date: new Date().toISOString().split("T")[0], note: "" });
  const [saving, setSaving] = useState(false);
  const admin = isAdmin(profile.role);

  const openPayModal = (type: "customer" | "supplier", id: string, name: string, due: number) => {
    setPayModal({ type, id, name, due });
    setPayData({ amount: String(due), method: "cash", date: new Date().toISOString().split("T")[0], note: "" });
  };

  const handlePayment = async () => {
    if (!payModal) return;
    const amount = Number(payData.amount);
    if (!amount || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      if (payModal.type === "customer") {
        const { count } = await supabase.from("payments").select("*", { count: "exact", head: true }).like("payment_number", `PAY-${year}-%`);
        const paymentNumber = `PAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
        const { error } = await supabase.from("payments").insert({
          payment_number: paymentNumber, customer_id: payModal.id, amount,
          payment_method: payData.method, payment_date: payData.date,
          note: payData.note || null, created_by: profile.id,
        });
        if (error) throw error;
        await supabase.from("customers").update({ total_due: Math.max(0, payModal.due - amount) }).eq("id", payModal.id);
      } else {
        const { count } = await supabase.from("supplier_payments").select("*", { count: "exact", head: true }).like("payment_number", `SPAY-${year}-%`);
        const paymentNumber = `SPAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
        const { error } = await supabase.from("supplier_payments").insert({
          payment_number: paymentNumber, supplier_id: payModal.id, amount,
          payment_method: payData.method, payment_date: payData.date,
          note: payData.note || null, created_by: profile.id,
        });
        if (error) throw error;
        await supabase.from("suppliers").update({ total_due: Math.max(0, payModal.due - amount) }).eq("id", payModal.id);
      }
      toast.success(`Payment recorded: ${formatCurrency(amount)}`);
      setPayModal(null);
      router.refresh();
    } catch { toast.error("Failed to record payment"); }
    finally { setSaving(false); }
  };

  const handleDelete = async (type: "customer" | "supplier", id: string) => {
    if (!confirm("Are you sure you want to delete this payment record? This will NOT restore customer due automatically.")) return;
    try {
      const supabase = createClient();
      const table = type === "customer" ? "payments" : "supplier_payments";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Payment deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete");
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "customer_due", label: `Customer Due (${customersWithDue.length})` },
    { key: "supplier_due", label: `Supplier Payable (${suppliersWithDue.length})` },
    { key: "history", label: "Payment History" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Payments & Due Tracking</h1>
        <p className="text-sm text-slate-500 mt-0.5">All customer & supplier outstanding dues at a glance</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="fcf-card p-4">
          <p className="text-xs text-slate-500 mb-1">Total Customer Due</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalCustomerDue)}</p>
          <p className="text-xs text-slate-400 mt-1">{customersWithDue.length} customers</p>
        </div>
        <div className="fcf-card p-4">
          <p className="text-xs text-slate-500 mb-1">Total Supplier Payable</p>
          <p className="text-xl font-bold text-orange-600">{formatCurrency(totalSupplierDue)}</p>
          <p className="text-xs text-slate-400 mt-1">{suppliersWithDue.length} suppliers</p>
        </div>
        <div className="fcf-card p-4">
          <p className="text-xs text-slate-500 mb-1">Today&apos;s Collection</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(todayTotal)}</p>
          <p className="text-xs text-slate-400 mt-1">Today&apos;s payments</p>
        </div>
        <div className="fcf-card p-4">
          <p className="text-xs text-slate-500 mb-1">This Month&apos;s Collection</p>
          <p className="text-xl font-bold text-blue-600">{formatCurrency(monthTotal)}</p>
          <p className="text-xs text-slate-400 mt-1">Monthly payments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customer Due Tab */}
      {activeTab === "customer_due" && (
        <div className="fcf-card overflow-hidden">
          {customersWithDue.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-600 font-semibold">All cleared!</p>
              <p className="text-slate-400 text-sm mt-1">No customer has any outstanding due</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="fcf-table">
                <thead>
                  <tr>
                    <th>Customer</th><th>Phone</th><th>Area</th>
                    <th className="text-right">Due Amount</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {customersWithDue.map(c => (
                    <tr key={c.id}>
                      <td><Link href={`/customers/${c.id}`} className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">{c.name}</Link></td>
                      <td className="text-sm text-slate-600">{c.phone}</td>
                      <td className="text-sm text-slate-400">{c.area || "—"}</td>
                      <td className="text-right"><span className="text-red-600 font-bold">{formatCurrency(c.total_due)}</span></td>
                      <td>
                        <Link href={`/orders?search=${encodeURIComponent(c.phone)}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-lg hover:bg-blue-100 transition-colors">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          View Orders
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-red-50/50">
                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-slate-700 text-right">Total Due:</td>
                    <td className="px-4 py-2 text-right font-bold text-red-700">{formatCurrency(totalCustomerDue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Supplier Due Tab */}
      {activeTab === "supplier_due" && (
        <div className="fcf-card overflow-hidden">
          {suppliersWithDue.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-slate-600 font-semibold">No payables!</p>
              <p className="text-slate-400 text-sm mt-1">All supplier payments are settled</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="fcf-table">
                <thead>
                  <tr>
                    <th>Supplier</th><th>Company</th><th>Phone</th>
                    <th className="text-right">Payable Amount</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliersWithDue.map(s => (
                    <tr key={s.id}>
                      <td><Link href={`/suppliers/${s.id}`} className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">{s.name}</Link></td>
                      <td className="text-sm text-slate-500">{s.company || "—"}</td>
                      <td className="text-sm text-slate-600">{s.phone}</td>
                      <td className="text-right"><span className="text-orange-600 font-bold">{formatCurrency(s.total_due)}</span></td>
                      <td>
                        {admin && (
                          <button onClick={() => openPayModal("supplier", s.id, s.name, s.total_due)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            Pay Supplier
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-orange-50/50">
                    <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-slate-700 text-right">Total Payable:</td>
                    <td className="px-4 py-2 text-right font-bold text-orange-700">{formatCurrency(totalSupplierDue)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="fcf-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Recent Customer Payments</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="fcf-table">
                <thead><tr><th>Date</th><th>Customer</th><th>Method</th><th className="text-right">Amount</th><th>Note</th>{admin && <th className="text-right">Action</th>}</tr></thead>
                <tbody>
                    {recentCustomerPayments.length === 0
                      ? <tr><td colSpan={5} className="text-center py-6 text-slate-400">No payments yet</td></tr>
                      : recentCustomerPayments.map(p => (
                        <tr key={p.id}>
                          <td className="text-sm">
                            <span className="block">{formatDate(p.payment_date)}</span>
                            {p.isOrder && <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-100 font-medium tracking-wide">ORDER PAYMENT</span>}
                          </td>
                          <td>
                            <p className="font-medium text-sm text-slate-800">{p.customers?.name}</p>
                            <p className="text-xs text-slate-500">{p.customers?.phone}</p>
                          </td>
                          <td><span className={`text-xs px-2 py-0.5 rounded-full ${p.isOrder ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>{METHODS[p.payment_method] || p.payment_method}</span></td>
                          <td className="text-right font-bold text-green-700">{formatCurrency(p.amount)}</td>
                          <td className="text-sm text-slate-500">{p.isOrder && p.orderNumber ? (
                            <Link href={`/orders/${p.id}/invoice`} className="text-blue-600 hover:underline">{p.note}</Link>
                          ) : (
                            p.note || "—"
                          )}</td>
                          {admin && (
                            <td className="text-right">
                              <button onClick={() => handleDelete("customer", p.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          </div>
          {admin && (
            <div className="fcf-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-semibold text-slate-800">Recent Supplier Payments</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="fcf-table">
                  <thead><tr><th>Date</th><th>Supplier</th><th>Method</th><th className="text-right">Amount</th><th>Note</th><th className="text-right">Action</th></tr></thead>
                  <tbody>
                    {recentSupplierPayments.length === 0
                      ? <tr><td colSpan={5} className="text-center py-6 text-slate-400">No payments yet</td></tr>
                      : recentSupplierPayments.map(p => (
                        <tr key={p.id}>
                          <td className="text-sm">{formatDate(p.payment_date)}</td>
                          <td className="font-medium text-sm">{p.suppliers?.name}</td>
                          <td><span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">{METHODS[p.payment_method] || p.payment_method}</span></td>
                          <td className="text-right font-bold text-orange-700">{formatCurrency(p.amount)}</td>
                          <td className="text-sm text-slate-400">{p.note || "—"}</td>
                          <td className="text-right">
                            <button onClick={() => handleDelete("supplier", p.id)} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">
                {payModal.type === "customer" ? "Record Customer Payment" : "Pay Supplier"}
              </h3>
              <button onClick={() => setPayModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`border rounded-xl p-3 ${payModal.type === "customer" ? "bg-red-50 border-red-100" : "bg-orange-50 border-orange-100"}`}>
                <p className="font-semibold text-slate-900">{payModal.name}</p>
                <p className={`text-sm mt-0.5 ${payModal.type === "customer" ? "text-red-700" : "text-orange-700"}`}>
                  {payModal.type === "customer" ? "Due: " : "Payable: "}<strong>{formatCurrency(payModal.due)}</strong>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Amount (৳) *</label>
                <input type="number" step="any" min={1} value={payData.amount}
                  onChange={e => setPayData({ ...payData, amount: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(METHODS).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setPayData({ ...payData, method: val })}
                      className={`h-9 rounded-lg text-xs font-semibold border-2 transition-all ${
                        payData.method === val
                          ? payModal.type === "customer" ? "bg-green-600 text-white border-green-600" : "bg-orange-600 text-white border-orange-600"
                          : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}>{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Date</label>
                <input type="date" value={payData.date} onChange={e => setPayData({ ...payData, date: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Note (optional)</label>
                <input type="text" placeholder="Remarks..." value={payData.note}
                  onChange={e => setPayData({ ...payData, note: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setPayModal(null)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handlePayment} disabled={saving}
                className={`flex-1 h-10 text-white rounded-xl text-sm font-semibold disabled:opacity-50 ${payModal.type === "customer" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}>
                {saving ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
