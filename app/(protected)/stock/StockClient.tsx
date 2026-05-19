"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, isAdmin } from "@/lib/utils";
import { Product, Profile, ProductCategory } from "@/types";
import { toast } from "sonner";
import StockAdjustModal from "./StockAdjustModal";
import AddProductModal from "./AddProductModal";
import EditProductModal from "./EditProductModal";

type ProductWithCategory = Product & {
  product_categories: { id: string; name: string } | null;
};

interface Props {
  initialProducts: ProductWithCategory[];
  categories: ProductCategory[];
  profile: Profile;
}

const SUBJECTS = ["All Subjects", "Bangla", "Math", "English"];

export default function StockClient({ initialProducts, categories, profile }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [adjustProduct, setAdjustProduct] = useState<ProductWithCategory | null>(null);
  const [editingThreshold, setEditingThreshold] = useState<string | null>(null);
  const [thresholdValue, setThresholdValue] = useState(0);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [fullEditProduct, setFullEditProduct] = useState<ProductWithCategory | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const admin = isAdmin(profile.role);

  const filtered = products.filter((p) => {
    if (categoryFilter && p.product_categories?.name !== categoryFilter) return false;
        if (subjectFilter && subjectFilter !== "All Subjects" && p.subject !== subjectFilter) return false;
    if (lowStockOnly && p.stock_quantity > p.low_stock_threshold) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !p.product_code?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    const orderA = (a as any).sort_order ?? 999999;
    const orderB = (b as any).sort_order ?? 999999;
    if (orderA !== orderB) return orderA - orderB;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const lowStockCount = products.filter(p => p.stock_quantity <= p.low_stock_threshold).length;
  const totalStockValue = products.reduce((sum, p) => sum + (p.purchase_price * p.stock_quantity), 0);

  const startEditThreshold = (p: ProductWithCategory) => {
    setEditingThreshold(p.id);
    setThresholdValue(p.low_stock_threshold);
  };

  const saveThreshold = async (productId: string) => {
    setSavingThreshold(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({ low_stock_threshold: thresholdValue })
        .eq("id", productId);
      if (error) throw error;
      setProducts(products.map(p =>
        p.id === productId ? { ...p, low_stock_threshold: thresholdValue } : p
      ));
      toast.success("Threshold updated");
    } catch {
      toast.error("Failed to update");
    } finally {
      setSavingThreshold(false);
      setEditingThreshold(null);
    }
  };

  const startEditName = (p: ProductWithCategory) => {
    setEditingName(p.id);
    setNameValue(p.name);
  };

  const saveName = async (productId: string) => {
    if (!nameValue.trim()) {
      toast.error("Product name cannot be empty");
      return;
    }
    setSavingName(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("products")
        .update({ name: nameValue.trim() })
        .eq("id", productId);
      if (error) throw error;
      setProducts(products.map(p =>
        p.id === productId ? { ...p, name: nameValue.trim() } : p
      ));
      toast.success("Product name updated");
    } catch {
      toast.error("Failed to update name");
    } finally {
      setSavingName(false);
      setEditingName(null);
    }
  };

  // Drag & Drop handlers
  const handleDragStart = (e: React.DragEvent, productId: string) => {
    setDragId(productId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', productId);
  };

  const handleDragOver = (e: React.DragEvent, productId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (productId !== dragId) {
      setDragOverId(productId);
    }
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    setDragOverId(null);
    if (!dragId || dragId === targetId) {
      setDragId(null);
      return;
    }

    // Reorder in filtered list
    const currentOrder = [...filtered];
    const dragIndex = currentOrder.findIndex(p => p.id === dragId);
    const targetIndex = currentOrder.findIndex(p => p.id === targetId);
    if (dragIndex === -1 || targetIndex === -1) return;

    const [draggedItem] = currentOrder.splice(dragIndex, 1);
    currentOrder.splice(targetIndex, 0, draggedItem);

    // Update sort_order for all products
    const updates = currentOrder.map((p, i) => ({ id: p.id, sort_order: i + 1 }));
    const updatedProducts = products.map(p => {
      const u = updates.find(u => u.id === p.id);
      return u ? { ...p, sort_order: u.sort_order } as any : p;
    });
    setProducts(updatedProducts);
    setDragId(null);

    // Save to Supabase
    try {
      const supabase = createClient();
      for (const u of updates) {
        await supabase.from('products').update({ sort_order: u.sort_order }).eq('id', u.id);
      }
      toast.success('Order saved');
    } catch {
      toast.error('Failed to save order');
    }
  };

  const handleAdjustDone = (productId: string, newStock: number) => {
    setProducts(products.map(p =>
      p.id === productId ? { ...p, stock_quantity: newStock } : p
    ));
    setAdjustProduct(null);
  };

  const handleRemove = async (productId: string) => {
    const userInput = prompt("To confirm deletion, please type 'DELETE':");
    if (userInput !== "DELETE") {
      if (userInput !== null) toast.error("Incorrect confirmation text. Action cancelled.");
      return;
    }
    setRemovingId(productId);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) {
        if (error.code === '23503') {
          throw new Error("Cannot delete product because it has associated orders or purchases.");
        }
        throw error;
      }
      setProducts(products.filter(p => p.id !== productId));
      toast.success("Product removed");
    } catch (err: any) {
      toast.error(err.message || "Failed to remove product");
    } finally {
      setRemovingId(null);
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Subject", "Category", "Unit", "Stock", "Threshold", "Buy Price", "Sell Price"];
    const rows = filtered.map(p => [
      p.name, p.subject || "", p.product_categories?.name || "",
      p.unit, p.stock_quantity, p.low_stock_threshold, p.purchase_price, p.selling_price
    ]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "fcf_stock.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloading CSV...");
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Management</h1>
          <p className="text-sm text-slate-500 mt-0.5 font-bangla">
            Total {products.length} products
            {lowStockCount > 0 && (
              <span className="ml-2 text-red-500 font-semibold">• {lowStockCount} low stock</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Total Stock Value */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl">
            <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <div>
              <p className="text-xs text-indigo-400 leading-none">Total Stock Value</p>
              <p className="text-sm font-bold text-indigo-700 tabular-nums">{formatCurrency(totalStockValue)}</p>
            </div>
          </div>
          {admin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </button>
          )}
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 text-sm font-medium rounded-xl hover:bg-green-100 transition-colors font-bangla"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-red-700">
            <strong>{lowStockCount} product(s)</strong> are below the set threshold. Please restock soon.
          </p>
          <button onClick={() => setLowStockOnly(true)} className="ml-auto text-xs text-red-600 underline">
            View
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="fcf-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search by name or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla w-48"
          />
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla"
          >
            {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div
              onClick={() => setLowStockOnly(!lowStockOnly)}
              className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${lowStockOnly ? "bg-red-500" : "bg-slate-200"}`}
            >
              <div className={`w-4 h-4 bg-white rounded-full shadow mt-0.5 transition-transform ${lowStockOnly ? "translate-x-5" : "translate-x-1"}`} />
            </div>
            <span className="text-sm text-slate-600">Low Stock Only</span>
          </label>
          {(search || categoryFilter || subjectFilter || lowStockOnly) && (
            <button
              onClick={() => { setSearch(""); setCategoryFilter(""); setSubjectFilter(""); setLowStockOnly(false); }}
              className="h-9 px-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg font-bangla"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Stock Table */}
      <div className="fcf-card overflow-hidden">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                {admin && <th className="w-8"></th>}
                <th>Product Name</th>
                <th>Subject</th>
                <th>Category</th>
                <th>Unit</th>
                <th className="text-center">Stock</th>
                <th className="text-center">Threshold</th>
                <th className="text-right min-w-[100px]">Buy Price</th>
                <th className="text-right min-w-[100px]">Sell Price</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-10 text-slate-400">No products found</td>
                </tr>
              ) : filtered.map((product) => {
                const isLow = product.stock_quantity <= product.low_stock_threshold;
                const isOut = product.stock_quantity <= 0;
                return (
                  <tr
                    key={product.id}
                    className={`${isOut ? "bg-red-50/50" : isLow ? "bg-amber-50/30" : ""} ${dragId === product.id ? "opacity-40" : ""} ${dragOverId === product.id ? "border-t-2 border-blue-500" : ""} transition-all`}
                    draggable={admin}
                    onDragStart={e => admin && handleDragStart(e, product.id)}
                    onDragOver={e => admin && handleDragOver(e, product.id)}
                    onDragEnd={handleDragEnd}
                    onDrop={e => admin && handleDrop(e, product.id)}
                  >
                    {admin && (
                      <td className="w-8 cursor-grab active:cursor-grabbing text-center">
                        <svg className="w-4 h-4 text-slate-300 hover:text-slate-500 inline" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 6a2 2 0 112-2 2 2 0 01-2 2zm0 6a2 2 0 112-2 2 2 0 01-2 2zm0 6a2 2 0 112-2 2 2 0 01-2 2zm8-14a2 2 0 11-2-2 2 2 0 012 2zm0 6a2 2 0 11-2-2 2 2 0 012 2zm0 6a2 2 0 11-2-2 2 2 0 012 2z" />
                        </svg>
                      </td>
                    )}
                    <td>
                      {admin && editingName === product.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={nameValue}
                            onChange={e => setNameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") saveName(product.id);
                              if (e.key === "Escape") setEditingName(null);
                            }}
                            className="w-40 h-7 px-2 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => saveName(product.id)} disabled={savingName}
                            className="text-green-600 hover:text-green-800 p-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => setEditingName(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <p className="font-medium text-sm text-slate-800">{product.name}</p>
                          {admin && (
                            <button
                              onClick={() => startEditName(product)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-blue-600"
                              title="Edit name"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="text-sm text-slate-600">{product.subject || "—"}</td>
                    <td>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                        {product.product_categories?.name || "—"}
                      </span>
                    </td>
                    <td className="text-sm text-slate-500">{product.unit}</td>
                    <td className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={`text-lg font-bold ${isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-green-600"}`}>
                          {product.stock_quantity}
                        </span>
                        {isOut && <span className="text-xs text-red-500 bg-red-50 px-1 rounded">Out of stock</span>}
                        {isLow && !isOut && <span className="text-xs text-amber-500 bg-amber-50 px-1 rounded">Low stock</span>}
                      </div>
                    </td>
                    <td className="text-center">
                      {admin && editingThreshold === product.id ? (
                        <div className="flex items-center gap-1 justify-center">
                          <input
                            type="number"
                            min={0}
                            value={thresholdValue}
                            onChange={e => setThresholdValue(Number(e.target.value))}
                            className="w-14 h-7 text-center border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => saveThreshold(product.id)} disabled={savingThreshold}
                            className="text-green-600 hover:text-green-800 p-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => setEditingThreshold(null)} className="text-slate-400 hover:text-slate-600 p-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => admin && startEditThreshold(product)}
                          className={`text-sm font-medium ${admin ? "hover:text-blue-600 cursor-pointer" : "cursor-default"} text-slate-600`}
                          title={admin ? "Click to edit" : ""}
                        >
                          {product.low_stock_threshold}
                          {admin && <svg className="w-3 h-3 inline ml-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>}
                        </button>
                      )}
                    </td>
                    <td className="text-right text-sm tabular-nums font-medium text-slate-700 pr-4">{formatCurrency(product.purchase_price)}</td>
                    <td className="text-right text-sm tabular-nums font-semibold text-slate-800 pr-4">{formatCurrency(product.selling_price)}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/stock/${product.id}/history`}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View history"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </Link>
                        {admin && (
                          <>
                            <button
                              onClick={() => setFullEditProduct(product)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="Edit product"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => setAdjustProduct(product)}
                              className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Adjust stock"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleRemove(product.id)}
                              disabled={removingId === product.id}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                              title="Remove product"
                            >
                              {removingId === product.id ? (
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-400 font-bangla">No products found</div>
          ) : filtered.map((product) => {
            const isLow = product.stock_quantity <= product.low_stock_threshold;
            const isOut = product.stock_quantity <= 0;
            return (
              <div key={product.id} className={`p-4 space-y-3 ${isOut ? "bg-red-50/30" : isLow ? "bg-amber-50/20" : ""}`}>
                 <div className="flex items-start justify-between gap-2">
                   <div className="flex-1 min-w-0">
                      {admin && editingName === product.id ? (
                        <div className="flex items-center gap-1 mb-1">
                          <input
                            type="text"
                            value={nameValue}
                            onChange={e => setNameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") saveName(product.id);
                              if (e.key === "Escape") setEditingName(null);
                            }}
                            className="flex-1 h-7 px-2 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            autoFocus
                          />
                          <button onClick={() => saveName(product.id)} disabled={savingName} className="text-green-600 p-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                          </button>
                          <button onClick={() => setEditingName(null)} className="text-slate-400 p-0.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 group">
                          <p className="font-bold text-slate-900">{product.name}</p>
                          {admin && (
                            <button onClick={() => startEditName(product)} className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-blue-600" title="Edit name">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                          )}
                        </div>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium">{product.product_code || "No Code"}</p>
                   </div>
                   <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      {product.product_categories?.name || "—"}
                   </span>
                 </div>
                <div className="flex justify-between items-end">
                   <div className="space-y-1">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Details</p>
                      <p className="text-xs text-slate-600 font-bangla">{product.subject} • {product.unit}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] text-slate-400 uppercase font-bold">Sell Price</p>
                      <p className="text-sm font-bold text-blue-600">{formatCurrency(product.selling_price)}</p>
                   </div>
                </div>
                <div className="grid grid-cols-3 gap-2 bg-white/50 p-2.5 rounded-xl border border-slate-100">
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Stock</p>
                    <p className={`text-sm font-bold ${isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-green-600"}`}>
                      {product.stock_quantity}
                    </p>
                  </div>
                  <div className="text-center border-x border-slate-200">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Threshold</p>
                    <p className="text-sm font-bold text-slate-600">{product.low_stock_threshold}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Buy Price</p>
                    <p className="text-sm font-bold text-slate-700">{formatCurrency(product.purchase_price)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                   <div className="flex gap-2">
                      <Link href={`/stock/${product.id}/history`} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </Link>
                      {admin && (
                         <>
                           <button onClick={() => setFullEditProduct(product)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg" title="Edit product">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                           </button>
                           <button onClick={() => setAdjustProduct(product)} className="p-2 text-slate-400 hover:text-green-600 bg-slate-50 rounded-lg" title="Adjust stock">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                           </button>
                         </>
                      )}
                   </div>
                   {admin && (
                      <button onClick={() => handleRemove(product.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                   )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500 font-bangla">
          Showing {filtered.length} / {products.length} products
        </div>
      </div>

      {/* Stock Adjust Modal */}
      {adjustProduct && (
        <StockAdjustModal
          product={adjustProduct}
          userId={profile.id}
          onClose={() => setAdjustProduct(null)}
          onDone={handleAdjustDone}
        />
      )}

      {/* Add Product Modal */}
      {showAddModal && (
        <AddProductModal
          categories={categories}
          userId={profile.id}
          onClose={() => setShowAddModal(false)}
          onAdded={(newProduct) => {
            setProducts([newProduct, ...products]);
            setShowAddModal(false);
          }}
        />
      )}

      {/* Full Edit Product Modal */}
      {fullEditProduct && (
        <EditProductModal
          product={fullEditProduct}
          categories={categories}
          userId={profile.id}
          onClose={() => setFullEditProduct(null)}
          onUpdated={(updatedProduct) => {
            setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
            setFullEditProduct(null);
          }}
        />
      )}
    </div>
  );
}
