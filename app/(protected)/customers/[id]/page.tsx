import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect, notFound } from "next/navigation";
import CustomerProfileClient from "./CustomerProfileClient";

interface Props { params: { id: string } }

export default async function CustomerProfilePage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const [{ data: customer }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).single(),
    supabase
      .from("orders")
      .select("id, order_number, status, payment_method, total_amount, paid_amount, due_amount, created_at, note, invoices(invoice_number)")
      .eq("customer_id", params.id)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);

  if (!customer) notFound();

  return (
    <CustomerProfileClient
      customer={customer}
      orders={orders || []}
      payments={[]}
      profile={profile}
    />
  );
}
