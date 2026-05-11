"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel } from "@/lib/utils";
import { Purchase, Supplier } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type PurchaseWithSupplier = Purchase & {
  suppliers: { id: string; name: string; phone: string } | null;
};

interface Props {
  initialPurchases: PurchaseWithSupplier[];
  totalCount: number;
  suppliers: Pick<Supplier, "id" | "name" | "phone">[];
  totalPurchaseValue: number;
}

function getStatusVariant(status: string): "pending" | "confirmed" | "delivered" | "cancelled" | "default" {
  if (status === "received") return "delivered";
  if (status === "pending") return "pending";
  if (status === "returned") return "cancelled";
  return "default";
}

export default function PurchasesClient({ initialPurchases, totalCount, suppliers, totalPurchaseValue }: Props) {
  const [purchases, setPurchases] = useState(initialPurchases);
  const [total, setTotal] = useState(totalCount);
  const [loading, setLoading] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [payModal, setPayModal] = useState<{ id: string; purchase_number: string; supplier_id: string; supplier_name: string; due: number; current_paid: number; current_total: number } | null>(null);
  const [payData, setPayData] = useState({ amount: "", method: "cash", date: new Date().toISOString().split("T")[0], note: "" });
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 20;

  const [filteredTotalValue, setFilteredTotalValue] = useState(totalPurchaseValue);

  const fetchPurchases = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase
        .from("purchases")
        .select("*, suppliers(id, name, phone)", { count: "exact" })
        .order("created_at", { ascending: false })
        .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);

      let sumQuery = supabase.from("purchases").select("total_amount").neq("status", "cancelled");

      if (supplierFilter) {
        query = query.eq("supplier_id", supplierFilter);
        sumQuery = sumQuery.eq("supplier_id", supplierFilter);
      }
      if (statusFilter) {
        query = query.eq("status", statusFilter);
        sumQuery = sumQuery.eq("status", statusFilter);
      }
      if (dateFrom) {
        query = query.gte("purchase_date", dateFrom);
        sumQuery = sumQuery.gte("purchase_date", dateFrom);
      }
      if (dateTo) {
        query = query.lte("purchase_date", dateTo);
        sumQuery = sumQuery.lte("purchase_date", dateTo);
      }

      const [res, sumRes] = await Promise.all([query, sumQuery]);
      
      if (res.error) throw res.error;
      setPurchases(res.data || []);
      setTotal(res.count || 0);
      setPage(pageNum);

      if (!sumRes.error && sumRes.data) {
        setFilteredTotalValue(sumRes.data.reduce((acc, p) => acc + (p.total_amount || 0), 0));
      }

    } catch {
      toast.error("Failed to load purchases");
    } finally {
      setLoading(false);
    }
  }, [supplierFilter, statusFilter, dateFrom, dateTo]);

  const openPayModal = (purchase: PurchaseWithSupplier) => {
    if (!purchase.suppliers) return;
    setPayModal({
      id: purchase.id,
      purchase_number: purchase.purchase_number,
      supplier_id: purchase.supplier_id,
      supplier_name: purchase.suppliers.name,
      due: purchase.due_amount,
      current_paid: purchase.paid_amount,
      current_total: purchase.total_amount
    });
    setPayData({ amount: String(purchase.due_amount), method: "cash", date: new Date().toISOString().split("T")[0], note: `Payment for Purchase ${purchase.purchase_number}` });
  };

  const handlePayment = async () => {
    if (!payModal) return;
    const amount = Number(payData.amount);
    if (!amount || amount <= 0 || amount > payModal.due) { toast.error("Enter a valid amount"); return; }
    
    setSaving(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      
      const { count } = await supabase.from("supplier_payments").select("*", { count: "exact", head: true }).like("payment_number", `SPAY-${year}-%`);
      const paymentNumber = `SPAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
      
      const { error: paymentError } = await supabase.from("supplier_payments").insert({
        payment_number: paymentNumber, supplier_id: payModal.supplier_id, amount,
        payment_method: payData.method, payment_date: payData.date,
        note: payData.note || null, created_by: (await supabase.auth.getUser()).data.user?.id,
      });
      if (paymentError) throw paymentError;

      const { data: supplier } = await supabase.from("suppliers").select("total_due").eq("id", payModal.supplier_id).single();
      if (supplier) {
        await supabase.from("suppliers").update({ total_due: Math.max(0, supplier.total_due - amount) }).eq("id", payModal.supplier_id);
      }

      const newPaid = payModal.current_paid + amount;
      const newDue = payModal.current_total - newPaid;
      let newMethod = "partial";
      if (newDue <= 0) newMethod = payData.method;
      else if (newPaid > 0) newMethod = "partial";
      else newMethod = "due";

      const { error: purchaseError } = await supabase.from("purchases").update({
        paid_amount: newPaid,
        due_amount: newDue,
        payment_method: newMethod
      }).eq("id", payModal.id);
      
      if (purchaseError) throw purchaseError;

      toast.success(`Payment recorded: ${formatCurrency(amount)}`);
      setPayModal(null);
      fetchPurchases(page);
    } catch (err: any) { 
      toast.error(err.message || "Failed to record payment"); 
    } finally { 
      setSaving(false); 
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Purchase Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Total {total} purchase records</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-orange-50 text-orange-700 text-sm font-semibold rounded-xl border border-orange-100 shadow-sm transition-all duration-300">
            Total Purchases: {formatCurrency(filteredTotalValue)}
          </div>
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all active:scale-95 font-bangla shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Purchase
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="fcf-card p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="received">Received</option>
            <option value="returned">Returned</option>
          </select>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button
            onClick={() => fetchPurchases(1)}
            disabled={loading}
            className="h-9 px-4 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 font-bangla"
          >
            {loading ? "..." : "Search"}
          </button>
          <button
            onClick={() => { setSupplierFilter(""); setStatusFilter(""); setDateFrom(""); setDateTo(""); setTimeout(() => fetchPurchases(1), 50); }}
            className="h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50 font-bangla"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="fcf-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>Purchase #</th>
                <th>Supplier</th>
                <th>Date</th>
                <th className="text-right">Paid</th>
                <th className="text-right">Due</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td></tr>
              ) : purchases.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-slate-400">No purchase records found</td></tr>
              ) : purchases.map(p => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/purchases/${p.id}`} className="text-blue-600 hover:underline font-semibold text-sm">
                      {p.purchase_number}
                    </Link>
                  </td>
                  <td>
                    <p className="font-medium text-sm font-bangla">{p.suppliers?.name || "—"}</p>
                    <p className="text-xs text-slate-400">{p.suppliers?.phone}</p>
                  </td>
                  <td className="text-sm text-slate-600">{formatDate(p.purchase_date)}</td>
                  <td className="text-right text-sm text-green-700">{formatCurrency(p.paid_amount)}</td>
                  <td className="text-right text-sm">
                    {p.due_amount > 0
                      ? <span className="text-red-600 font-semibold">{formatCurrency(p.due_amount)}</span>
                      : <span className="text-slate-400">৳0.00</span>}
                  </td>
                  <td>
                    <Badge variant={getStatusVariant(p.status)}>
                      {getStatusLabel(p.status)}
                    </Badge>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {p.due_amount > 0 && p.suppliers && (
                        <button onClick={() => openPayModal(p)} className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg" title="Pay Supplier">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      )}
                      <Link href={`/purchases/${p.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Page {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => fetchPurchases(page - 1)} disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">← Prev</button>
              <button onClick={() => fetchPurchases(page + 1)} disabled={page >= totalPages || loading}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Pay Supplier</h3>
              <button onClick={() => setPayModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border rounded-xl p-3 bg-orange-50 border-orange-100">
                <p className="font-semibold text-slate-900">Purchase: {payModal.purchase_number}</p>
                <p className="text-sm text-slate-600">{payModal.supplier_name}</p>
                <p className="text-sm mt-1 text-orange-700">
                  Due: <strong>{formatCurrency(payModal.due)}</strong>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Amount (৳) *</label>
                <input type="number" min={1} max={payModal.due} value={payData.amount}
                  onChange={e => setPayData({ ...payData, amount: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { val: "cash", label: "Cash" },
                    { val: "bkash", label: "bKash" },
                    { val: "nagad", label: "Nagad" },
                    { val: "bank", label: "Bank" }
                  ].map(({ val, label }) => (
                    <button key={val} type="button" onClick={() => setPayData({ ...payData, method: val })}
                      className={`h-9 rounded-lg text-xs font-semibold border-2 transition-all ${
                        payData.method === val
                          ? "bg-orange-600 text-white border-orange-600"
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
                className="flex-1 h-10 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
