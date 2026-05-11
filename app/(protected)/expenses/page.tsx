import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExpensesClient from "./ExpensesClient";

export const metadata = { title: "Expenses — FCF ERP" };

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const profile = profileData as any;
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { data: expenses, error } = await (supabase.from("expenses") as any)
    .select("*")
    .order("expense_date", { ascending: false })
    .limit(100);

  // If table doesn't exist yet, show setup instructions
  if (error && (error.code === "42P01" || error.message?.includes("does not exist"))) {
    return (
      <div className="max-w-2xl mx-auto mt-10 fcf-card p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-800">Expenses Table Not Found</h2>
        <p className="text-slate-500 text-sm">
          The <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-mono">expenses</code> table does not exist in your database yet.
        </p>
        <div className="bg-slate-900 rounded-xl p-4 text-left">
          <p className="text-xs text-slate-400 mb-2">Run this in Supabase SQL Editor:</p>
          <pre className="text-green-400 text-xs whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category TEXT NOT NULL DEFAULT 'other',
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  note TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_all" ON expenses 
  FOR ALL USING (get_my_role() = 'admin');

CREATE POLICY "expenses_select" ON expenses 
  FOR SELECT USING (auth.uid() IS NOT NULL);`}</pre>
        </div>
        <p className="text-xs text-slate-400">
          The SQL file is at: <code className="font-mono">supabase/expenses_table.sql</code>
        </p>
      </div>
    );
  }

  return <ExpensesClient initialExpenses={expenses || []} userId={user.id} />;
}

