import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { redirect, notFound } from "next/navigation";
import EditOrderClient from "./EditOrderClient";

interface Props { params: { id: string } }

export const metadata = { title: "Edit Order — FCF ERP" };

export default async function EditOrderPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  // Fetch order, active customers and active products in parallel
  const [
    { data: order },
    { data: customers },
    { data: products }
  ] = await Promise.all([
    supabase
      .from("orders")
      .select(`
        *,
        order_items(*, products(id, name, product_code, subject, unit))
      `)
      .eq("id", params.id)
      .single(),
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

  if (!order) notFound();

  return (
    <EditOrderClient
      order={order}
      customers={(customers || []) as any}
      products={(products || []) as any}
      userId={user.id}
    />
  );
}
