import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + ALL dashboard data in a single parallel batch
  const [
    { data: profile },
    { data: todaySummary },
    { data: lowStockItems },
    { data: recentOrders },
    { data: monthlyPL },
    { data: activeOrdersWithDue },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("vw_today_summary").select("*").single(),
    supabase.from("vw_low_stock").select("*").limit(5),
    supabase.from("orders").select("*, customers(name, phone)").order("created_at", { ascending: false }).limit(5),
    supabase.from("vw_monthly_pl").select("*").order("year", { ascending: false }).order("month", { ascending: false }).limit(6),
    supabase.from("orders").select("due_amount").gt("due_amount", 0).neq("status", "cancelled"),
  ]);

  if (!profile) redirect("/login");

  const activeOrders = (activeOrdersWithDue as { due_amount: number }[]) || [];
  const totalDue = activeOrders.reduce((sum, o) => sum + (o.due_amount || 0), 0);

  return (
    <DashboardClient
      profile={profile}
      todaySummary={todaySummary}
      lowStockItems={lowStockItems || []}
      recentOrders={recentOrders || []}
      monthlyPL={monthlyPL || []}
      totalDue={totalDue}
    />
  );
}
