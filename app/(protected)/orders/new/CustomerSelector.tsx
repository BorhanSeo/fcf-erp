"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Customer } from "@/types";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (c: Customer) => void;
}

export default function CustomerSelector({ customers, selected, onSelect }: Props) {
  const [search, setSearch] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", address: "", area: "" });
  const [saving, setSaving] = useState(false);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  ).slice(0, 8);

  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("customers")
        .insert({ ...newCustomer, total_due: 0, total_purchase: 0, is_active: true })
        .select()
        .single();
      if (error) throw error;
      onSelect(data);
      setShowModal(false);
      setNewCustomer({ name: "", phone: "", address: "", area: "" });
      toast.success("New customer added");
    } catch {
      toast.error("Failed to add customer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fcf-card p-5">
      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
        <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
        Select Customer
      </h3>

      {selected ? (
        <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div>
            <p className="font-semibold text-slate-900 font-bangla">{selected.name}</p>
            <p className="text-sm text-slate-500">{selected.phone} {selected.area ? `• ${selected.area}` : ""}</p>
            {selected.total_due > 0 && (
              <p className="text-sm text-red-600 mt-1">
                Current Due: <strong>{formatCurrency(selected.total_due)}</strong>
              </p>
            )}
          </div>
          <button
            onClick={() => onSelect(null as unknown as Customer)}
            className="text-sm text-slate-500 hover:text-red-500 transition-colors"
          >
            Change Customer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Select or search customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 200)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {isFocused && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl overflow-hidden shadow-lg max-h-60 overflow-y-auto">
                {filtered.length === 0 ? (
                  <div className="p-4 text-sm text-slate-400 text-center">
                    No customers found
                  </div>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { onSelect(c); setSearch(""); setIsFocused(false); }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                    >
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.phone} {c.area ? `• ${c.area}` : ""}</p>
                      {c.total_due > 0 && (
                        <p className="text-xs text-red-500">Due: {formatCurrency(c.total_due)}</p>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add New Customer
          </button>
        </div>
      )}

      {/* New Customer Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <h4 className="text-lg font-bold text-slate-900 mb-4">Add New Customer</h4>
            <div className="space-y-3">
              {[
                { label: "Name *", key: "name", placeholder: "Customer name" },
                { label: "Phone *", key: "phone", placeholder: "01XXXXXXXXX" },
                { label: "Address", key: "address", placeholder: "Full address" },
                { label: "Area", key: "area", placeholder: "Area name" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={newCustomer[key as keyof typeof newCustomer]}
                    onChange={(e) => setNewCustomer({ ...newCustomer, [key]: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 h-10 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCustomer}
                disabled={saving}
                className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
