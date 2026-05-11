import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import NewOrderClient from "./NewOrderClient";

export const metadata = { title: "New Order — FCF ERP" };

export default async function NewOrderPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: customers }, { data: products }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, area, total_due")
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("products")
      .select("*, product_categories(name)")
      .eq("is_active", true)
      .order("name"),
  ]);

  return (
    <NewOrderClient
      customers={(customers || []) as any}
      products={(products || []) as any}
      userId={user.id}
    />
  );
}
