"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel, isAdmin } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Profile, OrderStatus } from "@/types";
import { toast } from "sonner";

interface Props {
  order: any;
  profile: Profile;
}

const STATUS_FLOW: Record<string, string> = {
  pending: "confirmed",
  confirmed: "delivered",
};

const STATUS_LABEL_NEXT: Record<string, string> = {
  pending: "Confirm",
  confirmed: "Mark Delivered",
};

function getBadgeVariant(status: string): "pending" | "confirmed" | "delivered" | "cancelled" | "default" {
  if (status === "pending") return "pending";
  if (status === "confirmed") return "confirmed";
  if (status === "delivered") return "delivered";
  if (status === "cancelled") return "cancelled";
  return "default";
}

export default function OrderDetailClient({ order, profile }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<string>(order.status);
  const [loading, setLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const admin = isAdmin(profile.role);
  const invoice = order.invoices?.[0];

  const [payModal, setPayModal] = useState<boolean>(false);
  const [payData, setPayData] = useState({ amount: String(order.due_amount), discount: "0", method: "cash", date: new Date().toISOString().split("T")[0], note: `Payment for Order ${order.order_number}` });
  const [savingPayment, setSavingPayment] = useState(false);
  const [removeItem, setRemoveItem] = useState<{ id: string; name: string; quantity: number; unit: string | null } | null>(null);
  const [removingItem, setRemovingItem] = useState(false);

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", order.id);
      if (error) throw error;
      setStatus(newStatus);
      toast.success(`Status updated: ${getStatusLabel(newStatus)}`);
      router.refresh();
    } catch {
      toast.error("Failed to update status");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    await updateStatus("cancelled");
    setShowCancelDialog(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();
      
      // Delete the order - Triggers handle stock and balance reversal automatically
      const { error } = await supabase.from("orders").delete().eq("id", order.id);
      
      if (error) throw error;
      
      toast.success("Order deleted permanently");
      router.push("/orders");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete order");
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePayment = async () => {
    const amount = Number(payData.amount) || 0;
    const discount = Number(payData.discount) || 0;

    if (amount < 0 || discount < 0) {
      toast.error("Amount and discount must be positive numbers");
      return;
    }

    if (amount === 0 && discount === 0) {
      toast.error("Please enter a payment amount or a discount");
      return;
    }

    if (amount + discount > order.due_amount) {
      toast.error("The combined payment and discount amount cannot exceed the remaining order due");
      return;
    }
    
    setSavingPayment(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      
      if (amount > 0) {
        const { count } = await supabase.from("payments").select("*", { count: "exact", head: true }).like("payment_number", `PAY-${year}-%`);
        const paymentNumber = `PAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
        
        const { error: paymentError } = await supabase.from("payments").insert({
          payment_number: paymentNumber, customer_id: order.customer_id, amount,
          payment_method: payData.method, payment_date: payData.date,
          note: payData.note || null, created_by: profile.id,
        });
        if (paymentError) throw paymentError;
      }

      // Compute new values
      const newDiscount = order.discount_amount + discount;
      const newTotal = Math.max(0, order.subtotal - newDiscount);
      const newPaid = order.paid_amount + amount;
      const newDue = Math.max(0, newTotal - newPaid);
      let newMethod = "partial";
      if (newDue <= 0) newMethod = payData.method;
      else if (newPaid > 0) newMethod = "partial";
      else newMethod = "due";

      const { error: orderError } = await supabase.from("orders").update({
        discount_amount: newDiscount,
        total_amount: newTotal,
        paid_amount: newPaid,
        due_amount: newDue,
        payment_method: newMethod
      }).eq("id", order.id);
      
      if (orderError) throw orderError;

      toast.success(
        discount > 0
          ? `Payment recorded: ${formatCurrency(amount)} with ${formatCurrency(discount)} discount`
          : `Payment recorded: ${formatCurrency(amount)}`
      );
      setPayModal(false);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to record payment");
    } finally {
      setSavingPayment(false);
    }
  };

  const handleRemoveItem = async () => {
    if (!removeItem) return;
    setRemovingItem(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("order_items").delete().eq("id", removeItem.id);
      if (error) throw error;
      toast.success(`${removeItem.name} removed from order`);
      setRemoveItem(null);
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to remove item");
    } finally {
      setRemovingItem(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{order.order_number}</h1>
            <p className="text-sm text-slate-500">{formatDate(order.created_at)}</p>
          </div>
          <Badge variant={getBadgeVariant(status)}>
            <span className="font-bangla">{getStatusLabel(status)}</span>
          </Badge>
        </div>

        <div className="flex gap-2 flex-wrap">
          {invoice && (
            <Link
              href={`/orders/${order.id}/invoice`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors font-bangla"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              Invoice
            </Link>
          )}
          {admin && STATUS_FLOW[status] && (
            <button
              onClick={() => updateStatus(STATUS_FLOW[status])}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 font-bangla"
            >
              {STATUS_LABEL_NEXT[status]}
            </button>
          )}
          {admin && status !== "cancelled" && status !== "delivered" && (
            <button
              onClick={() => setShowCancelDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 text-sm font-medium rounded-xl hover:bg-orange-100 font-bangla"
            >
              Cancel Order
            </button>
          )}
          {admin && (
            <Link
              href={`/orders/${order.id}/edit`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 text-sm font-medium rounded-xl hover:bg-blue-100 font-bangla"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit Order
            </Link>
          )}
          {admin && (
            <button
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 font-bangla"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete Order
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Customer info */}
        <div className="fcf-card p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Customer Info</h3>
          <p className="font-semibold text-slate-900 text-lg">{order.customers?.name}</p>
          <p className="text-sm text-slate-600 mt-1">{order.customers?.phone}</p>
          {order.customers?.area && <p className="text-sm text-slate-500">{order.customers.area}</p>}
          {order.customers?.total_due > 0 && (
            <div className="mt-3 bg-red-50 border border-red-100 rounded-lg p-2">
              <p className="text-sm text-red-600">Total Due: <strong>{formatCurrency(order.customers.total_due)}</strong></p>
            </div>
          )}
          <div className="mt-3">
            <Link href={`/customers/${order.customers?.id}`} className="text-sm text-blue-600 hover:underline">
              View Customer Profile →
            </Link>
          </div>
        </div>

        {/* Payment summary */}
        <div className="fcf-card p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><span>{formatCurrency(order.subtotal)}</span></div>
            {order.discount_amount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-{formatCurrency(order.discount_amount)}</span></div>}
            <div className="flex justify-between font-semibold text-base border-t border-slate-100 pt-2"><span>Total</span><span>{formatCurrency(order.total_amount)}</span></div>
            <div className="flex justify-between text-green-600"><span>Paid</span><span>{formatCurrency(order.paid_amount)}</span></div>
            {order.due_amount > 0 && (
              <div className="flex justify-between items-center text-red-600 font-semibold mt-1">
                <div className="flex justify-between w-full">
                  <span>Due</span><span>{formatCurrency(order.due_amount)}</span>
                </div>
              </div>
            )}
            {order.due_amount > 0 && order.customers && (
              <div className="pt-2">
                <button onClick={() => {
                  setPayData({
                    amount: String(order.due_amount),
                    discount: "0",
                    method: "cash",
                    date: new Date().toISOString().split("T")[0],
                    note: `Payment for Order ${order.order_number}`
                  });
                  setPayModal(true);
                }} className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Receive Payment
                </button>
              </div>
            )}
            <div className="pt-2 border-t border-slate-100 mt-2">
              <span className="text-slate-500 text-xs">Payment Method: </span>
              <span className="text-xs font-medium">
                {order.payment_method === "cash" ? "Cash" : order.payment_method === "due" ? "Due" : "Partial"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Order items */}
      <div className="fcf-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Order Items ({order.order_items?.length || 0})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Subject</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Price</th>
                <th className="text-right">Discount</th>
                <th className="text-right">Total</th>
                {admin && <th className="text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {order.order_items?.map((item: any, idx: number) => (
                <tr key={item.id}>
                  <td className="text-slate-400">{idx + 1}</td>
                  <td>
                    <p className="font-medium text-sm">{item.products?.name}</p>
                    <p className="text-xs text-slate-400">{item.products?.product_code}</p>
                  </td>
                  <td className="font-bangla text-sm">{item.products?.subject || "—"}</td>
                  <td className="text-right text-sm">{item.quantity} {item.products?.unit}</td>
                  <td className="text-right text-sm">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right text-sm text-green-600">{item.discount > 0 ? formatCurrency(item.discount) : "—"}</td>
                  <td className="text-right font-semibold text-sm">{formatCurrency(item.line_total)}</td>
                  {admin && (
                    <td className="text-right">
                      <button
                        onClick={() => setRemoveItem({
                          id: item.id,
                          name: item.products?.name || "Item",
                          quantity: item.quantity,
                          unit: item.products?.unit ?? null,
                        })}
                        disabled={(order.order_items?.length || 0) <= 1}
                        title={(order.order_items?.length || 0) <= 1 ? "Cannot remove the last item — delete the whole order instead" : "Remove this item from the order"}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {order.note && (
        <div className="fcf-card p-4">
          <p className="text-sm text-slate-500">Note: {order.note}</p>
        </div>
      )}

      {/* Cancel dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h4 className="text-lg font-bold text-slate-900 mb-2">Cancel Order?</h4>
            <p className="text-sm text-slate-500 mb-5">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowCancelDialog(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">No, Keep It</button>
              <button onClick={handleCancel} disabled={loading} className="flex-1 h-10 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">Yes, Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h4 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Delete Order?
            </h4>
            <p className="text-sm text-slate-500 mb-4">This will permanently delete the order, invoice, and restore stock & customer balance. This cannot be undone.</p>
            <div className="mb-5">
              <label className="text-sm font-medium text-slate-700 mb-1 block">Type <strong>DELETE</strong> to confirm:</label>
              <input 
                type="text" 
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                className="w-full h-10 border border-slate-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" 
                placeholder="DELETE" 
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteDialog(false); setConfirmDeleteText(""); }} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button 
                onClick={handleDelete} 
                disabled={confirmDeleteText !== "DELETE" || deleting} 
                className="flex-1 h-10 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Record Payment</h3>
              <button onClick={() => setPayModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border rounded-xl p-3 bg-blue-50 border-blue-100">
                <p className="font-semibold text-slate-900">Order: {order.order_number}</p>
                <p className="text-sm text-slate-600">{order.customers?.name}</p>
                <p className="text-sm mt-1 text-red-700">
                  Due: <strong>{formatCurrency(order.due_amount)}</strong>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Amount Paid (৳) *</label>
                  <input type="number" step="any" min={0} value={payData.amount}
                    onChange={e => setPayData({ ...payData, amount: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">Discount (৳)</label>
                  <input type="number" step="any" min={0} value={payData.discount}
                    onChange={e => setPayData({ ...payData, discount: e.target.value })}
                    className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="0" />
                </div>
              </div>

              {(() => {
                const amt = Number(payData.amount) || 0;
                const disc = Number(payData.discount) || 0;
                const remaining = Math.max(0, order.due_amount - (amt + disc));
                const totalReduction = amt + disc;
                const isOverLimit = totalReduction > order.due_amount;
                return (
                  <div className={`text-xs px-3 py-2 rounded-lg ${isOverLimit ? "bg-red-50 text-red-700 border border-red-100" : "bg-slate-50 text-slate-600 border border-slate-100"}`}>
                    <div className="flex justify-between">
                      <span>Total Reduction:</span>
                      <span className="font-semibold">{formatCurrency(totalReduction)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span>Remaining Due:</span>
                      <span className={`font-bold ${isOverLimit ? "text-red-700" : "text-slate-800"}`}>
                        {isOverLimit ? "Exceeds remaining due!" : formatCurrency(remaining)}
                      </span>
                    </div>
                  </div>
                );
              })()}

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
              <button onClick={() => setPayModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handlePayment} disabled={savingPayment}
                className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {savingPayment ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove item dialog */}
      {removeItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
            <h4 className="text-lg font-bold text-red-600 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              Remove Item?
            </h4>
            <p className="text-sm text-slate-600 mb-2">
              Remove <strong>{removeItem.name}</strong> ({removeItem.quantity} {removeItem.unit || "pcs"}) from this order?
            </p>
            {status === "delivered" && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-2 mb-4">
                Stock will be returned automatically and order totals will be recalculated.
              </p>
            )}
            {status !== "delivered" && (
              <p className="text-xs text-slate-500 mb-4">Order totals will be recalculated automatically.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setRemoveItem(null)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleRemoveItem}
                disabled={removingItem}
                className="flex-1 h-10 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {removingItem ? "Removing..." : "Yes, Remove"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
