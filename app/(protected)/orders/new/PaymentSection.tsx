"use client";

import { formatCurrency } from "@/lib/utils";

interface Props {
  subtotal: number;
  orderDiscount: number;
  setOrderDiscount: (v: number) => void;
  totalAmount: number;
  paymentMethod: "cash" | "due" | "partial";
  setPaymentMethod: (v: "cash" | "due" | "partial") => void;
  paidAmount: number;
  setPaidAmount: (v: number) => void;
  dueAmount: number;
  note: string;
  setNote: (v: string) => void;
}

export default function PaymentSection({
  subtotal, orderDiscount, setOrderDiscount,
  totalAmount, paymentMethod, setPaymentMethod,
  paidAmount, setPaidAmount, dueAmount, note, setNote,
}: Props) {
  return (
    <div className="fcf-card p-5">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
        Payment Details
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Left: Summary */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm py-2 border-b border-slate-100">
            <span className="text-slate-600">Subtotal</span>
            <span className="font-semibold">{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm py-2 border-b border-slate-100 gap-4">
            <label className="text-slate-600 whitespace-nowrap">Order Discount</label>
            <input
              type="number"
              step="any"
              min={0}
              max={subtotal}
              value={orderDiscount}
              onChange={(e) => setOrderDiscount(Number(e.target.value))}
              className="w-28 h-8 text-right border border-slate-200 rounded-lg text-sm px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-between py-2 border-b border-slate-200">
            <span className="font-semibold text-slate-800">Total Amount</span>
            <span className="text-xl font-bold text-slate-900">{formatCurrency(totalAmount)}</span>
          </div>
        </div>

        {/* Right: Payment method */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "cash", label: "Cash", color: "green" },
                { value: "due", label: "Due", color: "red" },
                { value: "partial", label: "Partial", color: "amber" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPaymentMethod(opt.value as "cash" | "due" | "partial")}
                  className={`h-10 rounded-xl text-sm font-semibold font-bangla border-2 transition-all ${
                    paymentMethod === opt.value
                      ? opt.color === "green"
                        ? "bg-green-600 text-white border-green-600"
                        : opt.color === "red"
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-amber-500 text-white border-amber-500"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMethod === "partial" && (
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Paid Amount</label>
              <input
                type="number"
                step="any"
                min={0}
                max={totalAmount}
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <p className="text-xs text-red-500 mt-1">Remaining Due: {formatCurrency(dueAmount)}</p>
            </div>
          )}

          {paymentMethod === "cash" && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
              ✓ Fully Paid — {formatCurrency(totalAmount)}
            </div>
          )}
          {paymentMethod === "due" && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              Full Due — {formatCurrency(totalAmount)}
            </div>
          )}
        </div>
      </div>

      {/* Note */}
      <div className="mt-4">
        <label className="text-sm font-medium text-slate-700 mb-1 block">Note (optional)</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Any special note about this order..."
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
    </div>
  );
}
