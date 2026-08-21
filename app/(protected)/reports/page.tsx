import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";

export const metadata = { title: "Profit & Loss Report — FCF ERP" };

export default async function ReportsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const today = new Date().toISOString().split("T")[0];
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const yearStart = `${year}-01-01`;

  const supabase = await createClient();
  const [
    profile,
    { data: todayOrders },
    { data: monthOrders },
    { data: yearOrders },
    { data: todayPayments },
    { data: monthPayments },
    { data: yearPayments },
    { data: allMonthOrderItems },
    { data: allYearOrderItems },
  ] = await Promise.all([
    getProfile(user.id),
    supabase.from("orders").select("id, total_amount, subtotal, discount_amount, paid_amount, due_amount, status, created_at").gte("created_at", today).neq("status", "cancelled"),
    supabase.from("orders").select("id, total_amount, subtotal, discount_amount, paid_amount, due_amount, status, created_at").gte("created_at", monthStart).neq("status", "cancelled"),
    supabase.from("orders").select("id, total_amount, subtotal, discount_amount, paid_amount, due_amount, status, created_at").gte("created_at", yearStart).neq("status", "cancelled"),
    supabase.from("payments").select("amount, created_at, note").gte("created_at", today),
    supabase.from("payments").select("amount, created_at, note").gte("created_at", monthStart),
    supabase.from("payments").select("amount, created_at, note").gte("created_at", yearStart),
    supabase.from("order_items").select("order_id, quantity, line_total, created_at, products(purchase_price)").gte("created_at", monthStart),
    supabase.from("order_items").select("order_id, quantity, line_total, created_at, products(purchase_price)").gte("created_at", yearStart),
  ]);

  const { data: permSetting } = await supabase.from("settings").select("value").eq("key", "perm_staff_reports").maybeSingle();
  const allowed = profile?.role === "admin" || (permSetting ? permSetting.value === "true" : false);
  if (!allowed) redirect("/dashboard");

  // Filter order_items to exclude cancelled orders
  const yearOrderIds = new Set((yearOrders || []).map((o: any) => o.id));
  const monthOrderItems = (allMonthOrderItems || []).filter((item: any) => yearOrderIds.has(item.order_id));
  const yearOrderItems = (allYearOrderItems || []).filter((item: any) => yearOrderIds.has(item.order_id));

  return (
    <ReportsClient
      todayOrders={todayOrders || []}
      monthOrders={monthOrders || []}
      yearOrders={yearOrders || []}
      todayPayments={(todayPayments || []) as any}
      monthPayments={(monthPayments || []) as any}
      yearPayments={(yearPayments || []) as any}
      monthOrderItems={monthOrderItems as any}
      yearOrderItems={yearOrderItems as any}
      currentYear={year}
      currentMonth={month}
    />
  );
}
