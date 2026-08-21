import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import PurchasesClient from "./PurchasesClient";

export const metadata = { title: "Purchase Management — FCF ERP" };

export default async function PurchasesPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [profile, { data: purchases }, { count }, { data: suppliers }, { data: purchaseTotals }] = await Promise.all([
    getProfile(user.id),
    supabase.from("purchases").select("*, suppliers(id, name, phone)").order("created_at", { ascending: false }).limit(20),
    supabase.from("purchases").select("*", { count: "exact", head: true }),
    supabase.from("suppliers").select("id, name, phone").eq("is_active", true).order("name"),
    supabase.from("purchases").select("total_amount").neq("status", "cancelled"),
  ]);

  const { data: permSetting } = await supabase.from("settings").select("value").eq("key", "perm_staff_purchases").maybeSingle();
  const allowed = profile?.role === "admin" || (permSetting ? permSetting.value === "true" : false);
  if (!allowed) redirect("/dashboard");

  const totalPurchaseValue = purchaseTotals?.reduce((sum, p) => sum + (p.total_amount || 0), 0) || 0;

  return (
    <PurchasesClient
      initialPurchases={purchases || []}
      totalCount={count || 0}
      suppliers={suppliers || []}
      totalPurchaseValue={totalPurchaseValue}
    />
  );
}
