import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import StockClient from "./StockClient";

export const metadata = { title: "Stock Management — FCF ERP" };

export default async function StockPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + data in parallel
  const [{ data: profile }, { data: products }, { data: categories }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("products").select("*, product_categories(id, name)").order("name"),
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
