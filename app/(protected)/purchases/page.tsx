import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PurchasesClient from "./PurchasesClient";

export const metadata = { title: "Purchase Management — FCF ERP" };

export default async function PurchasesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + all data in parallel
  const [{ data: profile }, { data: purchases }, { count }, { data: suppliers }, { data: purchaseTotals }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("purchases").select("*, suppliers(id, name, phone)").order("created_at", { ascending: false }).limit(20),
    supabase.from("purchases").select("*", { count: "exact", head: true }),
    supabase.from("suppliers").select("id, name, phone").eq("is_active", true).order("name"),
    supabase.from("purchases").select("total_amount").neq("status", "cancelled"),
  ]);

  if (!profile || profile.role !== "admin") redirect("/dashboard");

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
