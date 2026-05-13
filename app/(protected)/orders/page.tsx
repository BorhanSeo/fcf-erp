import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export const metadata = {
  title: "Order Management — FCF ERP",
};

export default async function OrdersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [profile, { data: orders }, { count }] = await Promise.all([
    getProfile(user.id),
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
