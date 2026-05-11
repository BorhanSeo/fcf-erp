import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import OrderDetailClient from "./OrderDetailClient";

interface Props { params: { id: string } }

export default async function OrderDetailPage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

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
