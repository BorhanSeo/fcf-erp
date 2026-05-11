"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel, isAdmin } from "@/lib/utils";
import { Order, Profile } from "@/types";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type OrderWithCustomer = Order & {
  customers: { id: string; name: string; phone: string; area: string | null } | null;
};
interface OrdersClientProps {
  initialOrders: OrderWithCustomer[];
  totalCount: number;
  profile: Profile;
}

const STATUS_OPTIONS = [
  { value: "", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];
const PAYMENT_OPTIONS = [
  { value: "", label: "All Payment" },
  { value: "cash", label: "Cash" },
  { value: "due", label: "Due" },
  { value: "partial", label: "Partial" },
];

function getStatusVariant(s: string): "pending"|"confirmed"|"delivered"|"cancelled"|"default" {
  return (["pending","confirmed","delivered","cancelled"].includes(s) ? s : "default") as any;
}

export default function OrdersClient({ initialOrders, totalCount, profile }: OrdersClientProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(totalCount);
  const [payModal, setPayModal] = useState<{ id: string; order_number: string; customer_id: string; customer_name: string; due: number; current_paid: number; current_total: number } | null>(null);
  const [payData, setPayData] = useState({ amount: "", method: "cash", date: new Date().toISOString().split("T")[0], note: "" });
  const [saving, setSaving] = useState(false);
  const PAGE_SIZE = 20;

  const fetchOrders = useCallback(async (pageNum = 1) => {
    setLoading(true);
    try {
      const supabase = createClient();
      let query = supabase.from("orders")
        .select(`*, customers(id, name, phone, area)`, { count: "exact" })
        .order("created_at", { ascending: false })
        .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);
      if (statusFilter) query = query.eq("status", statusFilter);
      if (paymentFilter) query = query.eq("payment_method", paymentFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", dateTo + "T23:59:59");
      const { data, count, error } = await query;
      if (error) throw error;
      let filtered = data || [];
      if (search) filtered = filtered.filter(o =>
        o.order_number?.toLowerCase().includes(search.toLowerCase()) ||
        o.customers?.name?.toLowerCase().includes(search.toLowerCase()) ||
        o.customers?.phone?.includes(search));
      setOrders(filtered); setTotal(count || 0); setPage(pageNum);
    } catch { toast.error("Failed to load orders"); }
    finally { setLoading(false); }
  }, [statusFilter, paymentFilter, dateFrom, dateTo, search]);

  const handleReset = () => {
    setSearch(""); setStatusFilter(""); setPaymentFilter(""); setDateFrom(""); setDateTo("");
    setTimeout(() => fetchOrders(1), 100);
  };
  
  const openPayModal = (order: OrderWithCustomer) => {
    if (!order.customers) return;
    setPayModal({
      id: order.id,
      order_number: order.order_number,
      customer_id: order.customer_id,
      customer_name: order.customers.name,
      due: order.due_amount,
      current_paid: order.paid_amount,
      current_total: order.total_amount
    });
    setPayData({ amount: String(order.due_amount), method: "cash", date: new Date().toISOString().split("T")[0], note: `Payment for Order ${order.order_number}` });
  };

  const handlePayment = async () => {
    if (!payModal) return;
    const amount = Number(payData.amount);
    if (!amount || amount <= 0 || amount > payModal.due) { toast.error("Enter a valid amount"); return; }
    
    setSaving(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      
      // 1. We no longer use the payments table for customers. All payment info is stored in orders.
      // Payment history will be generated directly from the orders table.

      // 2. Customer total_due is now automatically handled by the database trigger sync_customer_totals

      // 3. Update Order
      const newPaid = payModal.current_paid + amount;
      const newDue = payModal.current_total - newPaid;
      // Determine new payment method status based on due amount
      let newMethod = "partial";
      if (newDue <= 0) {
          newMethod = payData.method; // "cash", "bkash", etc if fully paid now
      } else if (newPaid > 0) {
          newMethod = "partial";
      } else {
          newMethod = "due";
      }

      const { error: orderError } = await supabase.from("orders").update({
        paid_amount: newPaid,
        due_amount: newDue,
        payment_method: newMethod
      }).eq("id", payModal.id);
      
      if (orderError) throw orderError;

      toast.success(`Payment recorded: ${formatCurrency(amount)}`);
      setPayModal(null);
      fetchOrders(page); // refresh current page
    } catch (err: any) { 
      toast.error(err.message || "Failed to record payment"); 
    } finally { 
      setSaving(false); 
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Order Management</h1>
          <p className="text-sm text-slate-500 mt-0.5">Total {total} orders</p>
        </div>
        <Link href="/orders/new" className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          New Order
        </Link>
      </div>

      <div className="fcf-card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input type="text" placeholder="Order no. / Customer..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && fetchOrders(1)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {PAYMENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <div className="flex gap-2">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => fetchOrders(1)} disabled={loading}
              className="flex-1 h-10 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {loading ? "Loading..." : "Search"}
            </button>
            <button onClick={handleReset} className="h-10 px-3 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50">Reset</button>
          </div>
        </div>
      </div>

      <div className="fcf-card overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>Order No.</th><th>Customer</th><th>Date</th>
                <th className="text-right">Total</th><th className="text-right">Paid</th>
                <th className="text-right">Due</th><th>Payment</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-slate-400">No orders found</td></tr>
              ) : orders.map(order => (
                <tr key={order.id} className={order.status === "cancelled" ? "opacity-60" : ""}>
                  <td><Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline font-semibold text-sm">{order.order_number}</Link></td>
                  <td><div><p className="font-medium text-sm">{order.customers?.name || "—"}</p><p className="text-xs text-slate-400">{order.customers?.phone}</p></div></td>
                  <td className="text-sm text-slate-600">{formatDate(order.created_at)}</td>
                  <td className="text-right font-semibold text-sm">{formatCurrency(order.total_amount)}</td>
                  <td className="text-right text-sm text-green-700">{formatCurrency(order.paid_amount)}</td>
                  <td className="text-right text-sm">
                    {order.due_amount > 0 ? <span className="text-red-600 font-semibold">{formatCurrency(order.due_amount)}</span> : <span className="text-slate-400">৳0.00</span>}
                  </td>
                  <td><span className="text-xs text-slate-600 capitalize">{order.payment_method}</span></td>
                  <td><Badge variant={getStatusVariant(order.status)}>{getStatusLabel(order.status)}</Badge></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      {order.due_amount > 0 && order.customers && (
                        <button onClick={() => openPayModal(order)} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Receive Payment">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </button>
                      )}
                      <Link href={`/orders/${order.id}`} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </Link>
                      <Link href={`/orders/${order.id}/invoice`} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded-lg" title="Invoice">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-slate-400">Loading...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No orders found</div>
          ) : orders.map(order => (
            <div key={order.id} className={`p-4 space-y-3 ${order.status === "cancelled" ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between">
                <Link href={`/orders/${order.id}`} className="text-blue-600 font-bold">{order.order_number}</Link>
                <Badge variant={getStatusVariant(order.status)}>{getStatusLabel(order.status)}</Badge>
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-slate-900">{order.customers?.name || "—"}</p>
                  <p className="text-xs text-slate-500">{order.customers?.phone}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">{formatDate(order.created_at)}</p>
                  <p className="text-xs font-medium text-slate-600 capitalize">{order.payment_method}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold text-[8px]">Total</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(order.total_amount)}</p>
                </div>
                <div className="text-center border-x border-slate-200">
                  <p className="text-[10px] text-slate-500 uppercase font-bold text-[8px]">Paid</p>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(order.paid_amount)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-slate-500 uppercase font-bold text-[8px]">Due</p>
                  <p className={`text-sm font-bold ${order.due_amount > 0 ? "text-red-600" : "text-slate-400"}`}>{formatCurrency(order.due_amount)}</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                 <div className="flex gap-2">
                    <Link href={`/orders/${order.id}/invoice`} className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-3 py-1.5 rounded-lg">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                      Invoice
                    </Link>
                    <Link href={`/orders/${order.id}`} className="flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
                      View
                    </Link>
                 </div>
                 {order.due_amount > 0 && order.customers && (
                    <button onClick={() => openPayModal(order)} className="flex items-center gap-1 text-[11px] font-bold text-white bg-blue-600 px-3 py-1.5 rounded-lg shadow-sm">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      Pay Due
                    </button>
                 )}
              </div>
            </div>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">Total {total} orders — Page {page} / {totalPages}</p>
            <div className="flex gap-2">
              <button onClick={() => fetchOrders(page - 1)} disabled={page <= 1 || loading}
                className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40">← Previous</button>
              <button onClick={() => fetchOrders(page + 1)} disabled={page >= totalPages || loading}
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
              <h3 className="font-bold text-slate-900">Record Payment</h3>
              <button onClick={() => setPayModal(null)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border rounded-xl p-3 bg-blue-50 border-blue-100">
                <p className="font-semibold text-slate-900">Order: {payModal.order_number}</p>
                <p className="text-sm text-slate-600">{payModal.customer_name}</p>
                <p className="text-sm mt-1 text-red-700">
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
                          ? "bg-blue-600 text-white border-blue-600"
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
                className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
