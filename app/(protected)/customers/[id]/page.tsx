import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import CustomerProfileClient from "./CustomerProfileClient";

interface Props { params: { id: string } }

export default async function CustomerProfilePage({ params }: Props) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");

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
