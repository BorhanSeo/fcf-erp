"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { Supplier } from "@/types";
import { toast } from "sonner";

interface SimpleProduct {
  id: string; name: string; product_code: string;
  subject: string | null; unit: string;
  purchase_price: number; stock_quantity: number;
}
interface SimpleSupplier { id: string; name: string; phone: string; total_due: number; }
interface PurchaseItem {
  product_id: string; product: SimpleProduct;
  quantity: number; unit_price: number; line_total: number;
}
interface Props {
  suppliers: SimpleSupplier[];
  products: SimpleProduct[];
  userId: string;
}

export default function NewPurchaseClient({ suppliers, products, userId }: Props) {
  const router = useRouter();
  const [selectedSupplier, setSelectedSupplier] = useState<SimpleSupplier | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "due" | "partial">("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  // New Supplier modal state
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", company: "", phone: "", address: "" });
  const [allSuppliers, setAllSuppliers] = useState<SimpleSupplier[]>(suppliers);
  const [savingSupplier, setSavingSupplier] = useState(false);

  const totalAmount = items.reduce((s, i) => s + i.line_total, 0);
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  useEffect(() => {
    if (paymentMethod === "cash") setPaidAmount(totalAmount);
    else if (paymentMethod === "due") setPaidAmount(0);
  }, [paymentMethod, totalAmount]);

  const filteredSuppliers = allSuppliers.filter(
    s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || s.phone.includes(supplierSearch)
  ).slice(0, 6);

  const filteredProducts = products.filter(
    p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || p.product_code?.toLowerCase().includes(productSearch.toLowerCase())
  ).slice(0, 8);

  const addProduct = (product: SimpleProduct) => {
    if (items.find(i => i.product_id === product.id)) { setProductSearch(""); return; }
    setItems([...items, {
      product_id: product.id, product,
      quantity: 1, unit_price: product.purchase_price,
      line_total: product.purchase_price,
    }]);
    setProductSearch(""); setShowProductDrop(false);
  };

  const updateItem = (idx: number, field: "quantity" | "unit_price", value: number) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    updated[idx].line_total = updated[idx].quantity * updated[idx].unit_price;
    setItems(updated);
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) { toast.error("Please select a supplier"); return; }
    if (items.length === 0) { toast.error("Add at least one product"); return; }

    setLoading(true);
    try {
      const supabase = createClient();
      const year = new Date().getFullYear();
      const { count } = await supabase.from("purchases").select("*", { count: "exact", head: true }).like("purchase_number", `PUR-${year}-%`);
      const purchaseNumber = `PUR-${year}-${String((count || 0) + 1).padStart(4, "0")}`;

      const finalPaid = paymentMethod === "cash" ? totalAmount : paidAmount;
      const finalDue = Math.max(0, totalAmount - finalPaid);

      const { data: purchase, error: pErr } = await supabase
        .from("purchases")
        .insert({
          purchase_number: purchaseNumber,
          supplier_id: selectedSupplier.id,
          status: "received",
          payment_method: paymentMethod,
          total_amount: totalAmount,
          paid_amount: finalPaid,
          due_amount: finalDue,
          purchase_date: purchaseDate,
          note: note || null,
          created_by: userId,
        })
        .select().single();

      if (pErr) throw pErr;

      const { error: iErr } = await supabase.from("purchase_items").insert(
        items.map(i => ({
          purchase_id: purchase.id,
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price,
          line_total: i.line_total,
        }))
      );
      if (iErr) throw iErr;

      // ✅ Update supplier balance dynamically
      const { data: latestSupplier } = await supabase
        .from("suppliers")
        .select("total_due")
        .eq("id", selectedSupplier.id)
        .single();

      if (latestSupplier && finalDue > 0) {
        await supabase.from("suppliers").update({
          total_due: (latestSupplier.total_due || 0) + finalDue,
        }).eq("id", selectedSupplier.id);
      }

      toast.success("Purchase recorded successfully! 🎉");
      router.push(`/purchases/${purchase.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to record purchase");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAddSupplier = async () => {
    if (!newSupplier.name || !newSupplier.phone) { toast.error("Name and phone are required"); return; }
    setSavingSupplier(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("suppliers")
        .insert({ ...newSupplier, total_due: 0, is_active: true })
        .select().single();
      if (error) throw error;
      setAllSuppliers([data, ...allSuppliers]);
      setSelectedSupplier(data);
      toast.success("Supplier added and selected");
      setShowAddSupplier(false);
      setNewSupplier({ name: "", company: "", phone: "", address: "" });
    } catch {
      toast.error("Failed to add supplier");
    } finally {
      setSavingSupplier(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">New Purchase</h1>
          <p className="text-sm text-slate-500">Enter supplier and product details</p>
        </div>
        <button onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-700">← Go Back</button>
      </div>

      {/* Supplier + Date */}
      <div className="fcf-card p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 font-bangla flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
          Supplier & Date
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Supplier selector */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-slate-700">Supplier *</label>
              {!selectedSupplier && (
                <button onClick={() => setShowAddSupplier(true)} className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
                  New Supplier
                </button>
              )}
            </div>
            {selectedSupplier ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{selectedSupplier.name}</p>
                  <p className="text-xs text-slate-500">{selectedSupplier.phone}</p>
                  {selectedSupplier.total_due > 0 && (
                    <p className="text-xs text-red-500">Due: {formatCurrency(selectedSupplier.total_due)}</p>
                  )}
                </div>
                <button onClick={() => setSelectedSupplier(null)} className="text-xs text-slate-400 hover:text-red-500">Change</button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={supplierSearch}
                  onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDrop(true); }}
                  onFocus={() => setShowSupplierDrop(true)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla"
                />
                {showSupplierDrop && supplierSearch && (
                  <div className="absolute top-11 left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                    {filteredSuppliers.length === 0
                      ? (
                        <button onClick={() => { setNewSupplier({ ...newSupplier, name: supplierSearch }); setShowAddSupplier(true); setShowSupplierDrop(false); }}
                          className="w-full p-4 text-sm text-blue-600 text-center hover:bg-slate-50 font-semibold flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                          Add &quot;{supplierSearch}&quot; as New Supplier
                        </button>
                      )
                      : filteredSuppliers.map(s => (
                        <button key={s.id} onClick={() => { setSelectedSupplier(s); setSupplierSearch(""); setShowSupplierDrop(false); }}
                          className="w-full px-3 py-2.5 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0">
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-slate-400">{s.phone}</p>
                        </button>
                      ))
                    }
                  </div>
                )}
                {showSupplierDrop && <div className="fixed inset-0 z-10" onClick={() => setShowSupplierDrop(false)} />}
              </div>
            )}
          </div>
          {/* Purchase Date */}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Purchase Date *</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={e => setPurchaseDate(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="fcf-card p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 font-bangla flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
          Add Products
        </h3>
        {/* Product search */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search by product name or code..."
            value={productSearch}
            onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true); }}
            onFocus={() => setShowProductDrop(true)}
            className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla"
          />
          {showProductDrop && productSearch && (
            <div className="absolute top-11 left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
              {filteredProducts.length === 0
                ? <div className="p-3 text-sm text-slate-400 text-center">Not found</div>
                : filteredProducts.map(p => (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b last:border-0 flex justify-between">
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-slate-400">{p.product_code} • Stock: {p.stock_quantity} {p.unit}</p>
                    </div>
                    <span className="text-sm font-semibold text-blue-600">{formatCurrency(p.purchase_price)}</span>
                  </button>
                ))
              }
            </div>
          )}
          {showProductDrop && <div className="fixed inset-0 z-10" onClick={() => setShowProductDrop(false)} />}
        </div>

        {/* Items table */}
        {items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500">Product</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-500 w-24">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-28">Unit Price</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-500 w-28">Total</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.product_id} className="border-b border-slate-100">
                    <td className="px-3 py-2.5">
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-xs text-slate-400 font-bangla">{item.product.subject} • {item.product.unit}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="number" step="any" min={1} value={item.quantity}
                        onChange={e => updateItem(idx, "quantity", Number(e.target.value))}
                        className="w-full h-8 text-center border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="number" step="any" min={0} value={item.unit_price}
                        onChange={e => updateItem(idx, "unit_price", Number(e.target.value))}
                        className="w-full h-8 text-right border border-slate-200 rounded-lg text-sm px-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold">{formatCurrency(item.line_total)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => setItems(items.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right text-slate-700">Total:</td>
                  <td className="px-3 py-2 text-right text-slate-900">{formatCurrency(totalAmount)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center">
            <p className="text-slate-400">Search and add products above</p>
          </div>
        )}
      </div>

      {/* Payment */}
      <div className="fcf-card p-5 space-y-4">
        <h3 className="font-semibold text-slate-800 font-bangla flex items-center gap-2">
          <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
          Payment Details
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {[["cash", "Cash", "green"], ["due", "Due", "red"], ["partial", "Partial", "amber"]].map(([val, label, color]) => (
                  <button key={val} type="button"
                    onClick={() => setPaymentMethod(val as "cash" | "due" | "partial")}
                    className={`h-10 rounded-xl text-sm font-semibold font-bangla border-2 transition-all ${paymentMethod === val
                        ? color === "green" ? "bg-green-600 text-white border-green-600"
                          : color === "red" ? "bg-red-600 text-white border-red-600"
                            : "bg-amber-500 text-white border-amber-500"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                      }`}
                  >{label}</button>
                ))}
              </div>
            </div>
            {paymentMethod === "partial" && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Paid Amount</label>
                <input type="number" step="any" min={0} max={totalAmount} value={paidAmount}
                  onChange={e => setPaidAmount(Number(e.target.value))}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                <p className="text-xs text-red-500 mt-1">Due: {formatCurrency(dueAmount)}</p>
              </div>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Note (optional)</label>
            <textarea value={note} onChange={e => setNote(e.target.value)}
              rows={3} placeholder="Comment about this purchase..."
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="fcf-card p-4 flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">Total Purchase Amount</p>
          <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
          {dueAmount > 0 && <p className="text-sm text-red-600">Due to supplier: {formatCurrency(dueAmount)}</p>}
        </div>
        <button onClick={handleSubmit} disabled={loading || !selectedSupplier || items.length === 0}
          className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-blue-500/20">
          {loading ? (
            <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Saving...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Record Purchase</>
          )}
        </button>
      </div>

      {/* Quick Add Supplier Modal */}
      {showAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 font-bangla">Add New Supplier</h3>
              <button onClick={() => setShowAddSupplier(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: "Name *", key: "name", placeholder: "Supplier name" },
                { label: "Phone *", key: "phone", placeholder: "01XXXXXXXXX" },
                { label: "Company", key: "company", placeholder: "Company name (optional)" },
                { label: "Address", key: "address", placeholder: "Full address" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700 font-bangla">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={newSupplier[key as keyof typeof newSupplier]}
                    onChange={e => setNewSupplier({ ...newSupplier, [key]: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring font-bangla" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowAddSupplier(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleQuickAddSupplier} disabled={savingSupplier} className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {savingSupplier ? "Saving..." : "Save & Select"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
