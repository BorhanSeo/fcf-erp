import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PriceListClient from "./PriceListClient";

export const metadata = { title: "Price List — FCF ERP" };

export default async function PriceListPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase
      .from("products")
      .select("id, product_code, name, name_bn, subject, pages, unit, purchase_price, selling_price, is_active, product_categories(name)")
      .eq("is_active", true)
      .order("subject")
      .order("name"),
    supabase.from("product_categories").select("id, name").order("name"),
  ]);

  return (
    <PriceListClient
      initialProducts={(products || []) as any}
      categories={categories || []}
      profile={profile}
    />
  );
}
