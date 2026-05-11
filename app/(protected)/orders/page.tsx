import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export const metadata = {
  title: "Order Management — FCF ERP",
};

export default async function OrdersPage() {
  const supabase = await createClient();

  // Auth already handled by layout — fetch profile + data in parallel
  const [{ data: { user } }] = await Promise.all([
    supabase.auth.getUser(),
  ]);
  if (!user) redirect("/login");

  const [{ data: profile }, { data: orders }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("orders")
      .select(`*, customers(id, name, phone, area)`)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("orders").select("*", { count: "exact", head: true }),
  ]);

  if (!profile) redirect("/login");

  return (
    <OrdersClient
      initialOrders={orders || []}
      totalCount={count || 0}
      profile={profile}
    />
  );
}
