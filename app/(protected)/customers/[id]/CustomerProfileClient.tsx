"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, getStatusLabel, isAdmin } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Customer, Profile, Payment } from "@/types";
import { toast } from "sonner";

type Tab = "overview" | "orders" | "ledger" | "payments";

interface OrderRow {
  id: string; order_number: string; status: string;
  payment_method: string; total_amount: number;
  paid_amount: number; due_amount: number; created_at: string;
  note?: string;
  invoices: { invoice_number: string }[];
}
interface Props {
  customer: Customer;
  orders: OrderRow[];
  payments: any[]; // Kept for interface compatibility but ignored
  profile: Profile;
}

const PAYMENT_METHODS = ["cash", "bkash", "nagad", "bank"];
const METHOD_LABELS: Record<string, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank" };

function getOrderVariant(s: string): any {
  if (s === "pending") return "pending";
  if (s === "confirmed") return "confirmed";
  if (s === "delivered") return "delivered";
  if (s === "cancelled") return "cancelled";
  return "default";
}

export default function CustomerProfileClient({ customer, orders, payments, profile }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showEditModal, setShowEditModal] = useState(false);
  const [editData, setEditData] = useState({ name: customer.name, phone: customer.phone, address: customer.address || "", area: customer.area || "" });
  const [saving, setSaving] = useState(false);
  const admin = isAdmin(profile.role);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((s, o) => s + o.total_amount, 0);

  // Derive unified payments directly from active orders
  const unifiedPayments = orders
    .filter(o => o.paid_amount > 0)
    .map(o => ({
      id: o.id,
      payment_number: o.order_number, // display order number as reference
      amount: o.paid_amount,
      payment_method: o.payment_method,
      payment_date: o.created_at,
      note: o.note ? `Order: ${o.order_number} - ${o.note}` : `Payment for Order ${o.order_number}`,
      isOrder: true,
    }));

  const totalPaid = unifiedPayments.reduce((s, p) => s + p.amount, 0);

  // Ledger: derived purely from orders
  const ledgerItems = orders.map(o => ({
    type: "order" as const,
    date: o.created_at,
    data: o,
    amount: o.total_amount,
    paid: o.paid_amount,
    due: o.due_amount
  })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleEditSave = async () => {
    if (!editData.name || !editData.phone) { toast.error("Name and phone are required"); return; }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("customers").update(editData).eq("id", customer.id);
      if (error) throw error;
      toast.success("Customer info updated");
      setShowEditModal(false);
      router.refresh();
    } catch {
      toast.error("Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "orders", label: `Orders (${totalOrders})` },
    { key: "ledger", label: "Ledger" },
    { key: "payments", label: `Payments (${unifiedPayments.length})` },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/customers" className="p-2 hover:bg-slate-100 rounded-lg">
            <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-xl font-bold">
            {customer.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 font-bangla">{customer.name}</h1>
            <p className="text-sm text-slate-500">{customer.phone} {customer.area ? `• ${customer.area}` : ""}</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {admin && (
            <div className="flex gap-2">
              <button onClick={() => setShowEditModal(true)}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-200 transition-colors">
                Edit Info
              </button>
              <button 
                onClick={async () => {
                  // Explicit check for transaction history
                  if (orders.length > 0 || customer.total_due > 0) {
                    toast.error("Error: This customer has order history or an outstanding balance. Profiles with transaction data cannot be removed to maintain accounting integrity.");
                    return;
                  }

                  const confirm = prompt("To delete this customer, please type 'DELETE':");
                  if (confirm !== "DELETE") return;
                  setSaving(true);
                  try {
                    const supabase = createClient();
                    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
                    if (error) {
                      if (error.code === '23503') throw new Error("Database Error: Cannot delete customer with existing orders (FK constraint).");
                      throw error;
                    }
                    toast.success("Customer deleted successfully");
                    router.push("/customers");
                  } catch (err: any) {
                    toast.error(err.message || "Failed to delete");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50"
                title="Remove Customer"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
          {customer.total_due > 0 && (
            <Link href={`/orders?search=${encodeURIComponent(customer.phone)}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700">
              View Orders & Pay
            </Link>
          )}
        </div>
      </div>

      {/* Due alert */}
      {customer.total_due > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-red-700">Outstanding Due</p>
            <p className="text-2xl font-bold text-red-800 mt-1">{formatCurrency(customer.total_due)}</p>
          </div>
          <Link href={`/orders?search=${encodeURIComponent(customer.phone)}`}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700">
            Pay Now
          </Link>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex gap-0">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`px-5 py-3 text-sm font-medium font-bangla border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Orders", value: totalOrders, color: "text-blue-600" },
            { label: "Total Sales", value: formatCurrency(totalRevenue), color: "text-slate-900" },
            { label: "Total Paid", value: formatCurrency(totalRevenue - customer.total_due), color: "text-green-600" },
            { label: "Outstanding Due", value: formatCurrency(customer.total_due), color: customer.total_due > 0 ? "text-red-600" : "text-green-600" },
          ].map(stat => (
            <div key={stat.label} className="fcf-card p-4 text-center">
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
          <div className="col-span-2 sm:col-span-4 fcf-card p-5 space-y-2 text-sm">
            <h3 className="font-semibold text-slate-700 mb-3">Customer Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-slate-400">Name: </span><span className="font-medium">{customer.name}</span></div>
              <div><span className="text-slate-400">Phone: </span><span className="font-medium">{customer.phone}</span></div>
              <div><span className="text-slate-400">Area: </span><span className="font-medium">{customer.area || "—"}</span></div>
              <div><span className="text-slate-400">Address: </span><span className="font-medium">{customer.address || "—"}</span></div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Orders */}
      {activeTab === "orders" && (
        <div className="fcf-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="fcf-table">
              <thead>
                <tr><th>Order #</th><th>Date</th><th className="text-right">Total</th><th className="text-right">Paid</th><th className="text-right">Due</th><th>Status</th><th>Invoice</th></tr>
              </thead>
              <tbody>
                {orders.length === 0
                  ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No orders found</td></tr>
                  : orders.map(o => (
                    <tr key={o.id}>
                      <td><Link href={`/orders/${o.id}`} className="text-blue-600 hover:underline font-semibold text-sm">{o.order_number}</Link></td>
                      <td className="text-sm">{formatDate(o.created_at)}</td>
                      <td className="text-right text-sm font-semibold">{formatCurrency(o.total_amount)}</td>
                      <td className="text-right text-sm text-green-700">{formatCurrency(o.paid_amount)}</td>
                      <td className="text-right text-sm">{o.due_amount > 0 ? <span className="text-red-600 font-semibold">{formatCurrency(o.due_amount)}</span> : <span className="text-slate-400">—</span>}</td>
                      <td><Badge variant={getOrderVariant(o.status)}><span className="font-bangla">{getStatusLabel(o.status)}</span></Badge></td>
                      <td>{o.invoices?.[0] && <Link href={`/orders/${o.id}/invoice`} className="text-xs text-blue-600 hover:underline">{o.invoices[0].invoice_number}</Link>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Ledger */}
      {activeTab === "ledger" && (
        <div className="fcf-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="fcf-table">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Reference</th><th className="text-right">Amount</th><th className="text-right">Paid</th><th className="text-right">Due</th></tr>
              </thead>
              <tbody>
                {ledgerItems.length === 0
                  ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">No transactions</td></tr>
                  : ledgerItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="text-sm">{formatDate(item.date)}</td>
                      <td>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.type === "order" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}`}>
                          {item.type === "order" ? "Order" : "Payment"}
                        </span>
                      </td>
                      <td className="text-sm text-blue-600">
                        <Link href={`/orders/${(item.data as OrderRow).id}`} className="hover:underline">{(item.data as OrderRow).order_number}</Link>
                      </td>
                      <td className="text-right text-sm font-semibold">{formatCurrency(item.amount)}</td>
                      <td className="text-right text-sm text-green-700">{formatCurrency(item.paid)}</td>
                      <td className="text-right text-sm">{item.due > 0 ? <span className="text-red-600 font-semibold">{formatCurrency(item.due)}</span> : <span className="text-slate-300">—</span>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Payments */}
      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="fcf-card overflow-hidden">
            <table className="fcf-table">
              <thead>
                <tr><th>Reference</th><th>Date</th><th>Method</th><th className="text-right">Amount</th><th>Note</th></tr>
              </thead>
              <tbody>
                {unifiedPayments.length === 0
                  ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">No payments recorded</td></tr>
                  : unifiedPayments.map(p => (
                    <tr key={p.id}>
                      <td className="text-sm font-mono text-slate-600">
                        <Link href={`/orders/${p.id}`} className="text-blue-600 hover:underline">{p.payment_number}</Link>
                        <span className="block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded border border-blue-100 font-medium tracking-wide w-fit">ORDER PAYMENT</span>
                      </td>
                      <td className="text-sm">{formatDate(p.payment_date)}</td>
                      <td><span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{METHOD_LABELS[p.payment_method] || p.payment_method}</span></td>
                      <td className="text-right font-bold text-green-700">{formatCurrency(p.amount)}</td>
                      <td className="text-sm text-slate-400">{p.note || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Edit Customer Info</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[["Name *", "name", "Full name"], ["Phone *", "phone", "01XXXXXXXXX"], ["Address", "address", "Address"], ["Area", "area", "Area"]].map(([label, key, placeholder]) => (
                <div key={key}>
                  <label className="text-sm font-medium text-slate-700">{label}</label>
                  <input type="text" placeholder={placeholder}
                    value={editData[key as keyof typeof editData]}
                    onChange={e => setEditData({ ...editData, [key]: e.target.value })}
                    className="mt-1 flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                </div>
              ))}
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowEditModal(false)} className="flex-1 h-10 border border-slate-200 rounded-xl text-sm hover:bg-slate-50">Cancel</button>
              <button onClick={handleEditSave} disabled={saving} className="flex-1 h-10 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving..." : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
