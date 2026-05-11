"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, isAdmin } from "@/lib/utils";
import { Profile } from "@/types";
import { toast } from "sonner";
import { useSettingsStore } from "@/store/settingsStore";

interface ProductRow {
  id: string;
  product_code: string;
  name: string;
  subject: string | null;
  selling_price: number;
  purchase_price: number;
  is_active: boolean;
  product_categories: { name: string } | null;
}
interface Props {
  initialProducts: ProductRow[];
  categories: { id: string; name: string }[];
  profile: Profile;
}

export default function PriceListClient({ initialProducts, categories, profile }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState(0);
  const [saving, setSaving] = useState(false);
  const admin = isAdmin(profile.role);

  // Full display name = "FCF 124 বাংলা"
  const displayName = (p: ProductRow) =>
    p.subject ? `${p.name} ${p.subject}` : p.name;

  const filtered = products.filter(p => {
    if (categoryFilter && p.product_categories?.name !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!displayName(p).toLowerCase().includes(q) &&
          !p.product_code.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const savePrice = async (productId: string) => {
    if (editPrice <= 0) { toast.error("Price must be greater than 0"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("products")
        .update({ selling_price: editPrice })
        .eq("id", productId);
      if (error) throw error;
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, selling_price: editPrice } : p));
      toast.success("Price updated ✓");
      setEditingId(null);
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Price List</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} products</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Link href="/stock" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Add Product
          </Link>
          <button onClick={handlePrint}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="fcf-card p-4 print:hidden flex flex-wrap gap-3">
        <input type="text" placeholder="Search products..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring w-48" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {(search || categoryFilter) && (
          <button onClick={() => { setSearch(""); setCategoryFilter(""); }}
            className="h-9 px-3 border border-slate-200 rounded-lg text-sm text-slate-500 hover:bg-slate-50">
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="fcf-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Product Name</th>
                <th>Category</th>
                <th className="text-right">Selling Price</th>
                {admin && <th className="text-center">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    No products found
                  </td>
                </tr>
              ) : filtered.map((p, i) => {
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id}>
                    <td className="text-slate-400 text-sm">{i + 1}</td>
                    <td>
                      <span className="font-semibold text-slate-800 font-bangla">
                        {displayName(p)}
                      </span>
                    </td>
                    <td>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        p.product_categories?.name === "Kidz"
                          ? "bg-pink-50 text-pink-700"
                          : "bg-blue-50 text-blue-700"
                      }`}>
                        {p.product_categories?.name || "—"}
                      </span>
                    </td>
                    <td className="text-right">
                      {isEditing ? (
                        <input
                          type="number" step="any" min={1} autoFocus
                          value={editPrice}
                          onChange={e => setEditPrice(Number(e.target.value))}
                          onKeyDown={e => { if (e.key === "Enter") savePrice(p.id); if (e.key === "Escape") setEditingId(null); }}
                          className="w-28 h-8 text-right border-2 border-blue-400 rounded-lg text-sm px-2 focus:outline-none"
                        />
                      ) : (
                        <span className={`text-base font-bold ${p.selling_price > 0 ? "text-slate-900" : "text-slate-300"}`}>
                          {p.selling_price > 0 ? formatCurrency(p.selling_price) : "No price"}
                        </span>
                      )}
                    </td>
                    {admin && (
                      <td className="text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => savePrice(p.id)} disabled={saving}
                              className="p-1.5 bg-green-100 text-green-700 hover:bg-green-200 rounded-lg transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="p-1.5 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-lg transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingId(p.id); setEditPrice(p.selling_price); }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mx-auto">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print View */}
      <div className="hidden print:block">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{useSettingsStore((state) => state.settings.company_name) || "FCF Stationery House"}</h1>
          <h2 className="text-lg font-semibold mt-1">Price List</h2>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleDateString()}</p>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="px-3 py-2 text-left font-semibold">#</th>
              <th className="px-3 py-2 text-left font-semibold">Product Name</th>
              <th className="px-3 py-2 text-left font-semibold">Category</th>
              <th className="px-3 py-2 text-right font-semibold">Price (৳)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? "" : "bg-gray-50"}>
                <td className="px-3 py-1.5 text-xs text-gray-500">{i + 1}</td>
                <td className="px-3 py-1.5 font-medium font-bangla">{displayName(p)}</td>
                <td className="px-3 py-1.5 text-xs text-gray-500">{p.product_categories?.name}</td>
                <td className="px-3 py-1.5 text-right font-bold">{p.selling_price > 0 ? formatCurrency(p.selling_price) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 text-center mt-8 font-bangla">{useSettingsStore((state) => state.settings.company_name) || "FCF Stationery House"} © {new Date().getFullYear()}</p>
      </div>

      <style jsx global>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .hidden.print\\:block { display: block !important; }
        }
      `}</style>
    </div>
  );
}
