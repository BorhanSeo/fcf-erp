import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Profit & Loss Report — FCF ERP" };

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const yearStart = `${year}-01-01`;

  // Profile + ALL report data in a single parallel batch
  const [
    { data: profile },
    { data: todayOrders },
    { data: monthOrders },
    { data: yearOrders },
    { data: todayPayments },
    { data: monthPayments },
    { data: yearPayments },
    { data: monthOrderItems },
    { data: yearOrderItems },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("orders").select("total_amount, paid_amount, due_amount, status, created_at").gte("created_at", today).neq("status", "cancelled"),
    supabase.from("orders").select("total_amount, paid_amount, due_amount, status, created_at").gte("created_at", monthStart).neq("status", "cancelled"),
    supabase.from("orders").select("total_amount, paid_amount, due_amount, status, created_at").gte("created_at", yearStart).neq("status", "cancelled"),
    supabase.from("payments").select("amount, created_at, note").gte("created_at", today),
    supabase.from("payments").select("amount, created_at, note").gte("created_at", monthStart),
    supabase.from("payments").select("amount, created_at, note").gte("created_at", yearStart),
    supabase.from("order_items").select("quantity, line_total, created_at, products(purchase_price)").gte("created_at", monthStart),
    supabase.from("order_items").select("quantity, line_total, created_at, products(purchase_price)").gte("created_at", yearStart),
  ]);

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return (
    <ReportsClient
      todayOrders={todayOrders || []}
      monthOrders={monthOrders || []}
      yearOrders={yearOrders || []}
      todayPayments={(todayPayments || []) as any}
      monthPayments={(monthPayments || []) as any}
      yearPayments={(yearPayments || []) as any}
      monthOrderItems={(monthOrderItems || []) as any}
      yearOrderItems={(yearOrderItems || []) as any}
      currentYear={year}
      currentMonth={month}
    />
  );
}
