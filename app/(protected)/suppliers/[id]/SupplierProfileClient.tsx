"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Supplier } from "@/types";
import { toast } from "sonner";

type Tab = "overview" | "purchases" | "payments";

interface PurchaseRow {
  id: string; purchase_number: string; status: string;
  payment_method: string; total_amount: number;
  paid_amount: number; due_amount: number; purchase_date: string;
}
interface SupplierPayment {
  id: string; payment_number?: string; amount: number;
  payment_method: string; payment_date: string; note?: string;
}
interface Props {
  supplier: Supplier;
  purchases: PurchaseRow[];
  payments: SupplierPayment[];
  userId: string;
}

const METHODS: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank" };

function getPurchaseVariant(s: string): any {
  if (s === "received") return "delivered";
  if (s === "returned") return "cancelled";
  return "pending";
}

export default function SupplierProfileClient({ supplier, purchases, payments, userId }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showPayModal, setShowPayModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ name: supplier.name, company: supplier.company || "", phone: supplier.phone, address: supplier.address || "" });
  const [payData, setPayData] = useState({ amount: "", method: "cash", date: new Date().toISOString().split("T")[0], note: "" });
  const [saving, setSaving] = useState(false);

  const totalPurchased = purchases.reduce((s, p) => s + p.total_amount, 0);
  const totalPaid = purchases.reduce((s, p) => s + p.paid_amount, 0);

  // Ledger: merge purchases + payments
  const ledgerItems = [
    ...purchases.map(p => ({ type: "purchase" as const, date: p.purchase_date, data: p })),
    ...payments.map(p => ({ type: "payment" as const, date: p.payment_date, data: p })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handlePaySupplier = async () => {
    const amount = Number(payData.amount);
    if (!amount || amount <= 0) { toast.error("Please enter a valid amount"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      const { count } = await supabase.from("supplier_payments").select("*", { count: "exact", head: true }).like("payment_number", `SPAY-${year}-%`);
      const paymentNumber = `SPAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

      const { error } = await supabase.from("supplier_payments").insert({
        payment_number: paymentNumber,
        supplier_id: supplier.id,
        amount,
        payment_method: payData.method,
        payment_date: payData.date,
        note: payData.note || null,
        created_by: userId,
      });
      if (error) throw error;

      await supabase.from("suppliers").update({
        total_due: Math.max(0, supplier.total_due - amount),
      }).eq("id", supplier.id);

      toast.success(`Payment recorded: ${formatCurrency(amount)}`);
      setShowPayModal(false);
      router.refresh();
    } catch {
      toast.error("Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  const handleEditSave = async () => {
    if (!editData.name || !editData.phone) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("suppliers").update(editData).eq("id", supplier.id);
      if (error) throw error;
      toast.success("Information updated");
      setShowEditModal(false);
      router.refresh();
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "purchases", label: `Purchases (${purchases.length})` },
    { key: "payments", label: `Payments (${payments.length})` },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/suppliers" className="p-2 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 text-xl font-bold">
            {supplier.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{supplier.name}</h1>
            {supplier.company && <p className="text-sm text-slate-500">{supplier.company}</p>}
            <p className="text-sm text-slate-400">{supplier.phone}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={() => setShowEditModal(true)}
            className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
            Edit Info
          </button>
          <button 
            onClick={async () => {
              // Explicit check for transaction history
              if (purchases.length > 0 || payments.length > 0 || supplier.total_due > 0) {
                toast.error("Error: This supplier has purchase records or outstanding payments. Profiles with transaction data cannot be removed to maintain accounting integrity.");
                return;
              }

              const confirm = prompt("To delete this supplier, please type 'DELETE':");
              if (confirm !== "DELETE") return;
              setSaving(true);
              try {
                const supabase = createClient();
                const { error } = await supabase.from("suppliers").delete().eq("id", supplier.id);
                if (error) {
                  if (error.code === '23503') throw new Error("Database Error: Cannot delete supplier with existing purchase records (FK constraint).");
                  throw error;
                }
                toast.success("Supplier deleted successfully");
                router.push("/suppliers");
              } catch (err: any) {
                toast.error(err.message || "Failed to delete");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
            className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
            title="Remove Supplier"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
          {supplier.total_due > 0 && (
            <button onClick={() => setShowPayModal(true)}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700 transition-all">
              Pay Now
            </button>
          )}
        </div>
      </div>

      {/* Due alert */}
      {supplier.total_due > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-orange-700">Our Outstanding Payable</p>
            <p className="text-2xl font-bold text-orange-800 mt-1">{formatCurrency(supplier.total_due)}</p>
          </div>
          <button onClick={() => setShowPayModal(true)}
            className="px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700">
            Pay Now
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium font-bangla border-b-2 transition-colors ${
                activeTab === tab.key ? "border-orange-500 text-orange-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Purchase", value: formatCurrency(totalPurchased), color: "text-slate-900" },
              { label: "Total Paid", value: formatCurrency(totalPaid), color: "text-green-600" },
              { label: "Outstanding Payable", value: formatCurrency(supplier.total_due), color: supplier.total_due > 0 ? "text-orange-600" : "text-green-600" },
              { label: "Purchase Records", value: purchases.length, color: "text-blue-600" },
            ].map(stat => (
              <div key={stat.label} className="fcf-card p-4 text-center">
                <p className={`text-xl font-bold ${stat.color} font-bangla`}>{stat.value}</p>
                <p className="text-xs text-slate-500 font-bangla mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
          <div className="fcf-card p-5 grid grid-cols-2 gap-3 text-sm">
            <h3 className="col-span-2 font-semibold text-slate-700 mb-1">Contact Information</h3>
            <div><span className="text-slate-400">Name: </span><span className="font-medium">{supplier.name}</span></div>
            <div><span className="text-slate-400">Company: </span><span className="font-medium">{supplier.company || "—"}</span></div>
            <div><span className="text-slate-400">Phone: </span><span className="font-medium">{supplier.phone}</span></div>
            <div><span className="text-slate-400">Address: </span><span className="font-medium">{supplier.address || "—"}</span></div>
          </div>
          {/* Ledger preview */}
          <div className="fcf-card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Recent Transactions</h3>
            </div>
            <table className="fcf-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Reference</th><th className="text-right">Amount</th><th className="text-right">Due</th></tr>
              </thead>
              <tbody>
                {ledgerItems.slice(0, 8).map((item, idx) => (
                  <tr key={idx}>
                    <td className="text-sm">{formatDate(item.date)}</td>
                    <td>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.type === "purchase" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                        {item.type === "purchase" ? "Purchase" : "Payment"}
                      </span>
                    </td>
                    <td className="text-sm">
                      {item.type === "purchase"
                        ? <Link href={`/purchases/${(item.data as PurchaseRow).id}`} className="text-blue-600 hover:underline">{(item.data as PurchaseRow).purchase_number}</Link>
                        : <span className="text-slate-500 font-mono text-xs">{(item.data as SupplierPayment).payment_number}</span>}
                    </td>
                    <td className="text-right text-sm font-semibold">{formatCurrency((item.data as any).amount || (item.data as any).total_amount)}</td>
                    <td className="text-right text-sm">
                      {item.type === "purchase" && (item.data as PurchaseRow).due_amount > 0
                        ? <span className="text-orange-600 font-semibold">{formatCurrency((item.data as PurchaseRow).due_amount)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Purchases Tab */}
      {activeTab === "purchases" && (
        <div className="fcf-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-800">Purchase History</h3>
            <Link href="/purchases/new" className="text-sm text-blue-600 hover:underline">+ New Purchase</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="fcf-table">
              <thead>
                <tr><th>Purchase #</th><th>Date</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Due</th><th>Status</th></tr>
              </thead>
              <tbody>
                {purchases.length === 0
                  ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">No purchase records</td></tr>
                  : purchases.map(p => (
                    <tr key={p.id}>
                      <td><Link href={`/purchases/${p.id}`} className="text-blue-600 hover:underline font-semibold text-sm">{p.purchase_number}</Link></td>
                      <td className="text-sm">{formatDate(p.purchase_date)}</td>
                      <td className="text-right text-sm font-semibold">{formatCurrency(p.total_amount)}</td>
                      <td className="text-right text-sm text-green-700">{formatCurrency(p.paid_amount)}</td>
                      <td className="text-right text-sm">{p.due_amount > 0 ? <span className="text-orange-600 font-semibold">{formatCurrency(p.due_amount)}</span> : <span className="text-slate-400">—</span>}</td>
                      <td><Badge variant={getPurchaseVariant(p.status)}>{getStatusLabel(p.status)}</Badge></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments Tab */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setShowPayModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-semibold rounded-xl hover:bg-orange-700">
              + Record Payment
            </button>
          </div>
          <div className="fcf-card overflow-hidden">
            <table className="fcf-table">
              <thead>
                <tr><th>Payment #</th><th>Date</th><th>Method</th><th className="text-right">Amount</th><th>Note</th></tr>
              </thead>
              <tbody>
                {payments.length === 0
                  ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">No payment records</td></tr>
                  : payments.map(p => (
                    <tr key={p.id}>
                      <td className="text-xs font-mono text-slate-600">{p.payment_number || "—"}</td>
                      <td className="text-sm">{formatDate(p.payment_date)}</td>
                      <td><span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full font-bangla">{METHODS[p.payment_method] || p.payment_method}</span></td>
                      <td className="text-right font-bold text-orange-700">{formatCurrency(p.amount)}</td>
                      <td className="text-sm text-slate-400 font-bangla">{p.note || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Pay Supplier</h3>
              <button onClick={() => setShowPayModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {supplier.total_due > 0 && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <p className="text-sm text-orange-700">Outstanding Payable: <strong>{formatCurrency(supplier.total_due)}</strong></p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Amount (৳) *</label>
                <input type="number" step="any" min={1} placeholder="0.00" value={payData.amount}
                  onChange={e => setPayData({ ...payData, amount: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(METHODS).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setPayData({ ...payData, method: val })}
                      className={`h-9 rounded-lg text-xs font-semibold border-2 transition-all font-bangla ${payData.method === val ? "bg-orange-600 text-white border-orange-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                      {label}
                    </button>
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
                <input type="text" placeholder="Comment..." value={payData.note}
                  onChange={e => setPayData({ ...payData, note: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowPayModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handlePaySupplier} disabled={saving}
                className="flex-1 h-10 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
                {saving ? "Saving..." : "Record Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Edit Information</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[["Name *", "name", "Name"], ["Company", "company", "Company name"], ["Phone *", "phone", "01XXXXXXXXX"], ["Address", "address", "Address"]].map(([label, key, placeholder]) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700 font-bangla">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={editData[key as keyof typeof editData]}
                    onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowEditModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
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
