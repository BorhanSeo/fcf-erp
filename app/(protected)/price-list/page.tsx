import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import PriceListClient from "./PriceListClient";

export const metadata = { title: "Price List — FCF ERP" };

export default async function PriceListPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile) redirect("/login");

  const supabase = await createClient();
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
