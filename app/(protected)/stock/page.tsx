import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import StockClient from "./StockClient";

export const metadata = { title: "Stock Management — FCF ERP" };

export default async function StockPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [profile, { data: products }, { data: categories }] = await Promise.all([
    getProfile(user.id),
    supabase.from("products").select("*, product_categories(id, name)").order("sort_order", { ascending: true, nullsFirst: false }).order("name"),
    supabase.from("product_categories").select("*").order("name"),
  ]);

  if (!profile) redirect("/login");

  return (
    <StockClient
      initialProducts={products || []}
      categories={categories || []}
      profile={profile}
    />
  );
}
