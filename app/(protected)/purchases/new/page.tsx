import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import NewPurchaseClient from "./NewPurchaseClient";

export const metadata = { title: "New Purchase — FCF ERP" };

export default async function NewPurchasePage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: suppliers }, { data: products }] = await Promise.all([
    supabase.from("suppliers").select("id, name, phone, total_due").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name, product_code, subject, unit, purchase_price, stock_quantity").eq("is_active", true).order("name"),
  ]);

  return (
    <NewPurchaseClient
      suppliers={suppliers || []}
      products={products || []}
      userId={user.id}
    />
  );
}
