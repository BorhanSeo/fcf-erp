import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect, notFound } from "next/navigation";
import OrderDetailClient from "./OrderDetailClient";

interface Props { params: { id: string } }

export default async function OrderDetailPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select(`
      *,
      customers(id, name, phone, address, area, total_due),
      order_items(*, products(id, name, product_code, subject, unit)),
      invoices(id, invoice_number)
    `)
    .eq("id", params.id)
    .single();

  if (!order) notFound();

  return <OrderDetailClient order={order} profile={profile} />;
}
