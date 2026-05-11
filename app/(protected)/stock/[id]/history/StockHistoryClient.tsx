"use client";

import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Product, StockMovement, StockMovementType } from "@/types";

interface Props {
  product: Product & { product_categories: { name: string } | null };
  movements: StockMovement[];
}

const MOVEMENT_LABELS: Record<StockMovementType, { label: string; color: string; icon: string }> = {
  purchase_in: { label: "Purchase In", color: "text-green-700 bg-green-50 border-green-200", icon: "+" },
  sale_out: { label: "Sale Out", color: "text-blue-700 bg-blue-50 border-blue-200", icon: "-" },
  manual_in: { label: "Manual Add", color: "text-teal-700 bg-teal-50 border-teal-200", icon: "+" },
  manual_out: { label: "Manual Remove", color: "text-orange-700 bg-orange-50 border-orange-200", icon: "-" },
  return_out: { label: "Return", color: "text-red-700 bg-red-50 border-red-200", icon: "-" },
};

export default function StockHistoryClient({ product, movements }: Props) {
  const totalIn = movements.filter(m =>
    ["purchase_in", "manual_in"].includes(m.movement_type)
  ).reduce((s, m) => s + m.quantity, 0);

  const totalOut = movements.filter(m =>
    ["sale_out", "manual_out", "return_out"].includes(m.movement_type)
  ).reduce((s, m) => s + m.quantity, 0);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/stock" className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">{product.name}</h1>
          <p className="text-sm text-slate-500">Stock Movement History</p>
        </div>
      </div>

      {/* Product summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="fcf-card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{product.stock_quantity}</p>
          <p className="text-xs text-slate-500 mt-1">Current Stock</p>
          <p className="text-xs text-slate-400">{product.unit}</p>
        </div>
        <div className="fcf-card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">+{totalIn}</p>
          <p className="text-xs text-slate-500 mt-1">Total In</p>
        </div>
        <div className="fcf-card p-4 text-center">
          <p className="text-2xl font-bold text-red-600">-{totalOut}</p>
          <p className="text-xs text-slate-500 mt-1">Total Out</p>
        </div>
        <div className="fcf-card p-4 text-center">
          <p className="text-sm font-bold text-blue-600">{formatCurrency(product.selling_price)}</p>
          <p className="text-xs text-slate-500 mt-1">Selling Price</p>
          <p className="text-xs text-slate-400">{formatCurrency(product.purchase_price)} Purchase</p>
        </div>
      </div>

      {/* Movements table */}
      <div className="fcf-card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-semibold text-slate-800">Movement Records</h3>
          <span className="text-sm text-slate-500">{movements.length} records</span>
        </div>
        <div className="overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Type</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Before</th>
                <th className="text-right">After</th>
                <th>Reference</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {movements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-slate-400 font-bangla">
                    No movement records
                  </td>
                </tr>
              ) : movements.map((m) => {
                const info = MOVEMENT_LABELS[m.movement_type] || { label: m.movement_type, color: "text-slate-700 bg-slate-50 border-slate-200", icon: "" };
                const isIn = ["purchase_in", "manual_in"].includes(m.movement_type);
                return (
                  <tr key={m.id}>
                    <td>
                      <p className="text-sm">{formatDate(m.created_at)}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(m.created_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </td>
                    <td>
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${info.color}`}>
                        {info.icon && <span>{info.icon}</span>}
                        {info.label}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={`text-sm font-bold ${isIn ? "text-green-600" : "text-red-600"}`}>
                        {isIn ? "+" : "-"}{m.quantity}
                      </span>
                    </td>
                    <td className="text-right text-sm text-slate-500">{m.stock_before}</td>
                    <td className="text-right text-sm font-semibold">{m.stock_after}</td>
                    <td className="text-xs text-slate-400 font-mono">
                      {m.reference_id ? m.reference_id.slice(0, 8) + "..." : "—"}
                    </td>
                    <td className="text-xs text-slate-500 font-bangla max-w-[160px] truncate">
                      {m.note || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
