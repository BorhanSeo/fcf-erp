"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Props { purchase: any; userId: string }

export default function PurchaseDetailClient({ purchase, userId }: Props) {
  const router = useRouter();
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnReason, setReturnReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");

  const [payModal, setPayModal] = useState<boolean>(false);
  const [payData, setPayData] = useState({ amount: String(purchase.due_amount), method: "cash", date: new Date().toISOString().split("T")[0], note: `Payment for Purchase ${purchase.purchase_number}` });
  const [savingPayment, setSavingPayment] = useState(false);

  const getStatusVariant = (s: string) => s === "received" ? "delivered" : s === "returned" ? "cancelled" : "pending" as any;

  const handleReturn = async () => {
    const hasAny = Object.values(returnQtys).some(v => v > 0);
    if (!hasAny) { toast.error("Enter return quantity"); return; }
    if (!returnReason) { toast.error("Please provide a reason"); return; }

    setProcessing(true);
    try {
      const supabase = createClient();
      const movements = [];
      const stockUpdates = [];

      for (const item of purchase.purchase_items) {
        const qty = returnQtys[item.id] || 0;
        if (qty <= 0) continue;
        if (qty > item.quantity) { toast.error(`${item.products?.name}: quantity exceeds purchased amount`); setProcessing(false); return; }

        const newStock = Math.max(0, (item.products?.stock_quantity || 0) - qty);
        movements.push({
          product_id: item.product_id,
          movement_type: "return_out",
          quantity: qty,
          stock_before: item.products?.stock_quantity || 0,
          stock_after: newStock,
          reference_id: purchase.id,
          reference_type: "purchase",
          note: returnReason,
          created_by: userId,
        });
        stockUpdates.push({ id: item.product_id, stock: newStock });
      }

      // Insert stock movements
      const { error: mErr } = await supabase.from("stock_movements").insert(movements);
      if (mErr) throw mErr;

      // Update stock for each product
      for (const u of stockUpdates) {
        await supabase.from("products").update({ stock_quantity: u.stock }).eq("id", u.id);
      }

      // Update purchase status
      const totalReturnQty = Object.values(returnQtys).reduce((s, v) => s + v, 0);
      const totalPurchaseQty = purchase.purchase_items.reduce((s: number, i: any) => s + i.quantity, 0);
      const newStatus = totalReturnQty >= totalPurchaseQty ? "returned" : "partial";

      await supabase.from("purchases").update({ status: newStatus }).eq("id", purchase.id);

      toast.success("Return successfully recorded");
      setShowReturnModal(false);
      router.refresh();
    } catch {
      toast.error("Failed to record return");
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const supabase = createClient();
      
      // 1. Revert Stock (Decrease)
      if (purchase.purchase_items && purchase.purchase_items.length > 0) {
        for (const item of purchase.purchase_items) {
          const { data: product } = await supabase
            .from("products")
            .select("stock_quantity")
            .eq("id", item.product_id)
            .single();
            
          if (product) {
            await supabase
              .from("products")
              .update({ stock_quantity: Math.max(0, product.stock_quantity - item.quantity) })
              .eq("id", item.product_id);
          }
        }
      }

      // 2. Revert Supplier Balance
      if (purchase.supplier_id) {
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("total_due")
          .eq("id", purchase.supplier_id)
          .single();
          
        if (supplier) {
          await supabase
            .from("suppliers")
            .update({
              total_due: Math.max(0, (supplier.total_due || 0) - purchase.due_amount),
            })
            .eq("id", purchase.supplier_id);
        }
      }

      // 3. Delete related records
      await supabase.from("stock_movements").delete().eq("reference_id", purchase.id);
      await supabase.from("purchase_items").delete().eq("purchase_id", purchase.id);
      
      // 4. Delete the purchase
      const { error } = await supabase.from("purchases").delete().eq("id", purchase.id);
      
      if (error) throw error;
      
      toast.success("Purchase deleted permanently");
      router.push("/purchases");
      router.refresh();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete purchase");
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handlePayment = async () => {
    const amount = Number(payData.amount);
    if (!amount || amount <= 0 || amount > purchase.due_amount) { toast.error("Enter a valid amount"); return; }
    
    setSavingPayment(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      
      const { count } = await supabase.from("supplier_payments").select("*", { count: "exact", head: true }).like("payment_number", `SPAY-${year}-%`);
      const paymentNumber = `SPAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
      
      const { error: paymentError } = await supabase.from("supplier_payments").insert({
        payment_number: paymentNumber, supplier_id: purchase.supplier_id, amount,
        payment_method: payData.method, payment_date: payData.date,
        note: payData.note || null, created_by: userId,
      });
      if (paymentError) throw paymentError;

      const { data: supplier } = await supabase.from("suppliers").select("total_due").eq("id", purchase.supplier_id).single();
      if (supplier) {
        await supabase.from("suppliers").update({ total_due: Math.max(0, supplier.total_due - amount) }).eq("id", purchase.supplier_id);
      }

      const newPaid = purchase.paid_amount + amount;
      const newDue = purchase.total_amount - newPaid;
      let newMethod = "partial";
      if (newDue <= 0) newMethod = payData.method;
      else if (newPaid > 0) newMethod = "partial";
      else newMethod = "due";

      const { error: purchaseError } = await supabase.from("purchases").update({
        paid_amount: newPaid,
        due_amount: newDue,
        payment_method: newMethod
      }).eq("id", purchase.id);
      
      if (purchaseError) throw purchaseError;

      toast.success(`Payment recorded: ${formatCurrency(amount)}`);
      setPayModal(false);
      router.refresh();
    } catch (err: any) { 
      toast.error(err.message || "Failed to record payment"); 
    } finally { 
      setSavingPayment(false); 
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/purchases" className="p-2 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-slate-900">{purchase.purchase_number}</h1>
            <p className="text-sm text-slate-500">{formatDate(purchase.purchase_date)}</p>
          </div>
          <Badge variant={getStatusVariant(purchase.status)}>
            <span className="font-bangla">{getStatusLabel(purchase.status)}</span>
          </Badge>
        </div>
        {purchase.status === "received" && (
          <button onClick={() => setShowReturnModal(true)}
            className="px-4 py-2 bg-orange-50 text-orange-700 text-sm font-medium rounded-xl hover:bg-orange-100 font-bangla">
            Record Return
          </button>
        )}
        <button onClick={() => setShowDeleteDialog(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-xl hover:bg-red-100 font-bangla">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          Delete Purchase
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Supplier */}
        <div className="fcf-card p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Supplier</h3>
          <p className="font-semibold text-lg">{purchase.suppliers?.name}</p>
          <p className="text-sm text-slate-600 mt-1">{purchase.suppliers?.phone}</p>
          {purchase.suppliers?.total_due > 0 && (
            <p className="text-sm text-red-500 mt-2">Outstanding Payable: {formatCurrency(purchase.suppliers.total_due)}</p>
          )}
          <Link href={`/suppliers/${purchase.suppliers?.id}`} className="text-sm text-blue-600 hover:underline mt-2 block">View Profile →</Link>
        </div>

        {/* Payment */}
        <div className="fcf-card p-5">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Payment</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatCurrency(purchase.total_amount)}</span></div>
            <div className="flex justify-between text-green-600"><span>Paid</span><span>{formatCurrency(purchase.paid_amount)}</span></div>
            {purchase.due_amount > 0 && (
              <div className="flex justify-between items-center text-red-600 font-semibold mt-1">
                <div className="flex justify-between w-full">
                  <span>Due</span><span>{formatCurrency(purchase.due_amount)}</span>
                </div>
              </div>
            )}
            {purchase.due_amount > 0 && purchase.suppliers && (
              <div className="pt-2">
                <button onClick={() => setPayModal(true)} className="w-full inline-flex justify-center items-center gap-1.5 px-3 py-2 bg-orange-50 text-orange-700 text-xs font-semibold rounded-lg hover:bg-orange-100 transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Pay Supplier
                </button>
              </div>
            )}
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 mt-2">
              Payment: {purchase.payment_method === "cash" ? "Cash" : purchase.payment_method === "due" ? "Due" : "Partial"}
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="fcf-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">Purchased Items ({purchase.purchase_items?.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>#</th><th>Product</th><th>Subject</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Unit Price</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {purchase.purchase_items?.map((item: any, idx: number) => (
                <tr key={item.id}>
                  <td className="text-slate-400">{idx + 1}</td>
                  <td>
                    <p className="font-medium text-sm">{item.products?.name}</p>
                    <p className="text-xs text-slate-400">{item.products?.product_code}</p>
                  </td>
                  <td className="text-sm font-bangla">{item.products?.subject || "—"}</td>
                  <td className="text-right text-sm">{item.quantity} {item.products?.unit}</td>
                  <td className="text-right text-sm">{formatCurrency(item.unit_price)}</td>
                  <td className="text-right font-semibold text-sm">{formatCurrency(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {purchase.note && (
        <div className="fcf-card p-4">
          <p className="text-sm text-slate-500">Note: {purchase.note}</p>
        </div>
      )}

      {/* Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Record Purchase Return</h3>
              <button onClick={() => setShowReturnModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500">Enter return quantities:</p>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {purchase.purchase_items?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.products?.name}</p>
                      <p className="text-xs text-slate-400">Purchased: {item.quantity} {item.products?.unit}</p>
                    </div>
                    <input
                      type="number" min={0} max={item.quantity}
                      value={returnQtys[item.id] || 0}
                      onChange={e => setReturnQtys({ ...returnQtys, [item.id]: Number(e.target.value) })}
                      className="w-20 h-8 text-center border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Reason *</label>
                <input type="text" placeholder="Enter return reason..." value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowReturnModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleReturn} disabled={processing} className="flex-1 h-10 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
                {processing ? "Recording..." : "Record Return"}
              </button>
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
              Delete Purchase?
            </h4>
            <p className="text-sm text-slate-500 mb-4">This will permanently delete the purchase and revert stock & supplier balances. This cannot be undone.</p>
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
              <h3 className="font-bold text-slate-900">Pay Supplier</h3>
              <button onClick={() => setPayModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="border rounded-xl p-3 bg-orange-50 border-orange-100">
                <p className="font-semibold text-slate-900">Purchase: {purchase.purchase_number}</p>
                <p className="text-sm text-slate-600">{purchase.suppliers?.name}</p>
                <p className="text-sm mt-1 text-orange-700">
                  Due: <strong>{formatCurrency(purchase.due_amount)}</strong>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Amount (৳) *</label>
                <input type="number" step="any" min={1} max={purchase.due_amount} value={payData.amount}
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
              <button onClick={() => setPayModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handlePayment} disabled={savingPayment}
                className="flex-1 h-10 bg-orange-600 text-white rounded-xl text-sm font-semibold hover:bg-orange-700 disabled:opacity-50">
                {savingPayment ? "Saving..." : "Save Payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
