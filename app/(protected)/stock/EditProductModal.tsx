import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { ProductCategory } from "@/types";

interface Props {
  product: any;
  categories: ProductCategory[];
  userId: string;
  onClose: () => void;
  onUpdated: (product: any) => void;
}

export default function EditProductModal({ product, categories, userId, onClose, onUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: product.name || "",
    category_id: product.category_id || "",
    subject: product.subject || "All Subjects",
    unit: product.unit || "pcs",
    purchase_price: product.purchase_price || 0,
    selling_price: product.selling_price || 0,
    low_stock_threshold: product.low_stock_threshold || 0,
  });

  const subjects = ["All Subjects", "Bangla", "Math", "English"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.category_id) {
      toast.error("Please fill in the required fields");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const payload: any = {
        name: formData.name,
        category_id: formData.category_id,
        subject: formData.subject === "All Subjects" ? null : (formData.subject || null),
        unit: formData.unit,
        purchase_price: Number(formData.purchase_price),
        selling_price: Number(formData.selling_price),
        low_stock_threshold: Number(formData.low_stock_threshold),
      };

      const { data, error } = await supabase
        .from("products")
        .update(payload)
        .eq("id", product.id)
        .select(`
          *,
          product_categories ( id, name )
        `)
        .single();

      if (error) throw error;

      toast.success("Product updated successfully");
      onUpdated(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to update product");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <h3 className="font-bold text-slate-900">Edit Product</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Name *</label>
              <input type="text" required value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Category *</label>
              <select required value={formData.category_id}
                onChange={e => setFormData({ ...formData, category_id: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Subject</label>
              <select value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="All Subjects">No Subject</option>
                {subjects.filter(s => s !== "All Subjects").map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Unit</label>
              <select value={formData.unit}
                onChange={e => setFormData({ ...formData, unit: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <option value="pcs">pcs</option>
                <option value="Rim">Rim</option>
                <option value="Dozen">Dozen</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Buy Price</label>
              <input type="number" step="any" min={0} value={formData.purchase_price}
                onChange={e => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Sell Price</label>
              <input type="number" step="any" min={0} value={formData.selling_price}
                onChange={e => setFormData({ ...formData, selling_price: Number(e.target.value) })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Low Stock Alert</label>
              <input type="number" min={0} value={formData.low_stock_threshold}
                onChange={e => setFormData({ ...formData, low_stock_threshold: Number(e.target.value) })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
