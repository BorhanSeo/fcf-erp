import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewPurchaseClient from "./NewPurchaseClient";

export const metadata = { title: "New Purchase — FCF ERP" };

export default async function NewPurchasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

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
