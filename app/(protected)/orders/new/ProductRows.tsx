"use client";

import { useState } from "react";
import { Product } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { OrderItem } from "./NewOrderClient";

interface Props {
  products: (Product & { product_categories: { name: string } | null })[];
  items: OrderItem[];
  onChange: (items: OrderItem[]) => void;
}

export default function ProductRows({ products, items, onChange }: Props) {
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = products.filter(
    (p) =>
      p.stock_quantity > 0 &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.product_code?.toLowerCase().includes(search.toLowerCase()) ||
      p.subject?.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 8);

  const addProduct = (product: Product) => {
    const exists = items.find((i) => i.product_id === product.id);
    if (exists) { setSearch(""); setShowDropdown(false); return; }
    const newItem: OrderItem = {
      product_id: product.id,
      product,
      quantity: 1,
      unit_price: product.selling_price,
      discount: 0,
      line_total: product.selling_price,
    };
    onChange([...items, newItem]);
    setSearch("");
    setShowDropdown(false);
  };

  const updateItem = (idx: number, field: keyof OrderItem, value: number) => {
    const updated = [...items];
    const item = { ...updated[idx], [field]: value };
    item.line_total = Math.max(0, (item.unit_price - item.discount) * item.quantity);
    updated[idx] = item;
    onChange(updated);
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="fcf-card p-5">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
        Add Products
      </h3>

      {/* Product search */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search by product name, code or subject..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {showDropdown && (
          <div className="absolute top-12 left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-slate-400 text-center">No products found</div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addProduct(p)}
                  className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-slate-400">
                      {p.product_code} • {p.subject} • Stock: {p.stock_quantity} {p.unit}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-blue-600">{formatCurrency(p.selling_price)}</span>
                </button>
              ))
            )}
          </div>
        )}
        {showDropdown && <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />}
      </div>

      {/* Product rows table */}
      {items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Product</th>
                <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-24">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-28">Price</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-24">Discount</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-28">Total</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={item.product_id} className="border-b border-slate-100 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5">
                    <p className="font-medium text-slate-800">{item.product.name}</p>
                    <p className="text-xs text-slate-400">
                      {item.product.subject} • Stock: 
                      <span className={item.quantity > item.product.stock_quantity ? " text-red-500 font-semibold" : " text-green-600"}>
                        {" "}{item.product.stock_quantity} {item.product.unit}
                      </span>
                    </p>
                    {item.quantity > item.product.stock_quantity && (
                      <p className="text-xs text-red-500">⚠ Low stock!</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, "quantity", Number(e.target.value) || 0)}
                      className="w-full h-8 text-center border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={item.unit_price}
                      onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))}
                      className="w-full h-8 text-right border border-slate-200 rounded-lg text-sm px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={item.discount}
                      onChange={(e) => updateItem(idx, "discount", Number(e.target.value))}
                      className="w-full h-8 text-right border border-slate-200 rounded-lg text-sm px-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800">
                    {formatCurrency(item.line_total)}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => removeItem(idx)}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50">
                <td colSpan={4} className="px-3 py-2 text-right text-sm font-semibold text-slate-700">Subtotal:</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  {formatCurrency(items.reduce((s, i) => s + i.line_total, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {items.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
          <p className="text-slate-400">Search above and add products</p>
        </div>
      )}
    </div>
  );
}
