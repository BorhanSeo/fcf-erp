"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "rent", label: "🏢 Rent", color: "bg-blue-100 text-blue-700" },
  { value: "salary", label: "👤 Salary", color: "bg-purple-100 text-purple-700" },
  { value: "utility", label: "⚡ Utility", color: "bg-yellow-100 text-yellow-700" },
  { value: "transport", label: "🚗 Transport", color: "bg-orange-100 text-orange-700" },
  { value: "marketing", label: "📣 Marketing", color: "bg-pink-100 text-pink-700" },
  { value: "maintenance", label: "🔧 Maintenance", color: "bg-slate-100 text-slate-700" },
  { value: "other", label: "📦 Other", color: "bg-gray-100 text-gray-700" },
];

const getCategoryStyle = (cat: string) =>
  CATEGORIES.find((c) => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

interface Expense {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  note: string | null;
  created_at: string;
}

interface Props {
  initialExpenses: Expense[];
  userId: string;
}

export default function ExpensesClient({ initialExpenses, userId }: Props) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter state
  const [filterMonth, setFilterMonth] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  // Form state
  const [form, setForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "rent",
    amount: "",
    note: "",
  });

  const filtered = expenses.filter((e) => {
    if (filterMonth && !e.expense_date.startsWith(filterMonth)) return false;
    if (filterCategory && e.category !== filterCategory) return false;
    return true;
  });

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0);
  const totalAll = expenses.reduce((s, e) => s + e.amount, 0);

  const handleAdd = async () => {
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await (supabase.from("expenses") as any)
        .insert({
          expense_date: form.expense_date,
          category: form.category,
          amount: Number(form.amount),
          note: form.note || null,
          created_by: userId,
        })
        .select()
        .single();
      if (error) throw error;
      setExpenses([data, ...expenses]);
      setForm({ expense_date: new Date().toISOString().split("T")[0], category: "rent", amount: "", note: "" });
      setShowForm(false);
      toast.success("Expense added!");
    } catch (err: any) {
      toast.error(err.message || "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const userInput = prompt("To confirm deletion, please type 'DELETE':");
    if (userInput !== "DELETE") {
      if (userInput !== null) toast.error("Incorrect confirmation text. Action cancelled.");
      return;
    }
    setDeletingId(id);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
      setExpenses(expenses.filter((e) => e.id !== id));
      toast.success("Expense deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  // Category-wise summary
  const categorySummary = CATEGORIES.map((cat) => ({
    ...cat,
    total: expenses.filter((e) => e.category === cat.value).reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.total > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expenses</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track operational costs</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="fcf-card p-4">
          <p className="text-xs text-slate-500">Total Expenses</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatCurrency(totalAll)}</p>
          <p className="text-xs text-slate-400 mt-1">{expenses.length} records</p>
        </div>
        {categorySummary.slice(0, 3).map((cat) => (
          <div key={cat.value} className="fcf-card p-4">
            <p className="text-xs text-slate-500">{cat.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{formatCurrency(cat.total)}</p>
          </div>
        ))}
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="fcf-card p-5 border-2 border-blue-100">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">+</span>
            New Expense
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Date *</label>
              <input
                type="date"
                value={form.expense_date}
                onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Category *</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Amount (Tk) *</label>
              <input
                type="number"
                step="any"
                min={0}
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Note</label>
              <input
                type="text"
                placeholder="Optional note..."
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleAdd}
              disabled={loading}
              className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              Save Expense
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-5 py-2 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="fcf-card p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Filter by month"
          />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 rounded-lg border border-input px-3 text-sm focus-visible:outline-none"
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {(filterMonth || filterCategory) && (
            <button
              onClick={() => { setFilterMonth(""); setFilterCategory(""); }}
              className="h-9 px-3 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg"
            >
              Reset
            </button>
          )}
          {(filterMonth || filterCategory) && (
            <span className="text-sm text-slate-600 ml-auto font-semibold">
              Filtered total: <span className="text-red-600">{formatCurrency(totalFiltered)}</span>
            </span>
          )}
        </div>
      </div>

      {/* Expenses Table */}
      <div className="fcf-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="fcf-table">
            <thead>
              <tr>
                <th className="text-left">Date</th>
                <th>Category</th>
                <th className="text-right">Amount</th>
                <th className="text-left">Note</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    No expenses found. Add your first expense!
                  </td>
                </tr>
              ) : (
                filtered.map((expense) => {
                  const cat = getCategoryStyle(expense.category);
                  return (
                    <tr key={expense.id}>
                      <td className="text-sm text-slate-700 text-left">
                        {new Date(expense.expense_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cat.color}`}>
                          {cat.label}
                        </span>
                      </td>
                      <td className="text-right font-semibold text-red-600 tabular-nums">
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="text-sm text-slate-500 text-left max-w-[200px] truncate">
                        {expense.note || "—"}
                      </td>
                      <td>
                        <button
                          onClick={() => handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          {deletingId === expense.id ? (
                            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={2} className="px-4 py-3 text-sm text-right text-slate-600">Total:</td>
                  <td className="px-4 py-3 text-right text-red-600 tabular-nums">{formatCurrency(totalFiltered)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="px-4 py-3 border-t border-slate-100 text-sm text-slate-500">
          Showing {filtered.length} / {expenses.length} expenses
        </div>
      </div>
    </div>
  );
}
