"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  product: Product;
  userId: string;
  onClose: () => void;
  onDone: (productId: string, newStock: number) => void;
}

type AdjustType = "manual_in" | "manual_out";

const REASONS = [
  "Damaged goods removed",
  "Count correction",
  "Sample / Used",
  "Extra stock added",
  "Returned goods added",
  "Other",
];

export default function StockAdjustModal({ product, userId, onClose, onDone }: Props) {
  const [adjustType, setAdjustType] = useState<AdjustType>("manual_in");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [saving, setSaving] = useState(false);

  const newStock = adjustType === "manual_in"
    ? product.stock_quantity + quantity
    : Math.max(0, product.stock_quantity - quantity);

  const handleSubmit = async () => {
    const finalReason = reason === "Other" ? customReason : reason;
    if (!finalReason) { toast.error("Please provide a reason"); return; }
    if (quantity <= 0) { toast.error("Quantity must be greater than 0"); return; }
    if (adjustType === "manual_out" && quantity > product.stock_quantity) {
      toast.error("Cannot remove more than current stock"); return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: movErr } = await supabase.from("stock_movements").insert({
        product_id: product.id, movement_type: adjustType, quantity,
        stock_before: product.stock_quantity, stock_after: newStock,
        note: finalReason, created_by: userId,
      });
      if (movErr) throw movErr;
      const { error: updErr } = await supabase.from("products").update({ stock_quantity: newStock }).eq("id", product.id);
      if (updErr) throw updErr;
      toast.success(`Stock updated: ${product.stock_quantity} → ${newStock}`);
      onDone(product.id, newStock);
    } catch {
      toast.error("Failed to update stock");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900">Manual Stock Adjustment</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="font-semibold text-slate-800">{product.name}</p>
            <p className="text-sm text-slate-500 mt-0.5">{product.product_code} • {product.unit}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-slate-500">Current Stock:</span>
              <span className="text-lg font-bold text-slate-900">{product.stock_quantity}</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setAdjustType("manual_in")}
                className={`h-10 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2 ${
                  adjustType === "manual_in" ? "bg-green-600 text-white border-green-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Add Stock
              </button>
              <button type="button" onClick={() => setAdjustType("manual_out")}
                className={`h-10 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2 ${
                  adjustType === "manual_out" ? "bg-red-600 text-white border-red-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                Remove Stock
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Quantity</label>
            <input type="number" step="any" min={1} max={adjustType === "manual_out" ? product.stock_quantity : undefined}
              value={quantity} onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Reason</label>
            <select value={reason} onChange={e => setReason(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">Select reason...</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {reason === "Other" && (
              <input type="text" placeholder="Enter reason..."
                value={customReason} onChange={e => setCustomReason(e.target.value)}
                className="mt-2 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            )}
          </div>

          <div className={`rounded-xl p-3 border ${adjustType === "manual_in" ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Stock after update:</span>
              <span className={`text-xl font-bold ${adjustType === "manual_in" ? "text-green-700" : "text-red-700"}`}>
                {newStock} {product.unit}
              </span>
            </div>
            {adjustType === "manual_in" && (
              <p className="text-xs text-green-600 mt-1">+{quantity} will be added ({product.stock_quantity} → {newStock})</p>
            )}
            {adjustType === "manual_out" && (
              <p className="text-xs text-red-600 mt-1">-{quantity} will be removed ({product.stock_quantity} → {newStock})</p>
            )}
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose}
            className="flex-1 h-10 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving || !reason}
            className={`flex-1 h-10 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors ${
              adjustType === "manual_in" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
            }`}>
            {saving ? "Saving..." : "Update Stock"}
          </button>
        </div>
      </div>
    </div>
  );
}
