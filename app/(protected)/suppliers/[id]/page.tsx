import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect, notFound } from "next/navigation";
import SupplierProfileClient from "./SupplierProfileClient";

interface Props { params: { id: string } }

export default async function SupplierProfilePage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const [{ data: supplier }, { data: purchases }, { data: payments }] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", params.id).single(),
    supabase
      .from("purchases")
      .select("id, purchase_number, status, payment_method, total_amount, paid_amount, due_amount, purchase_date")
      .eq("supplier_id", params.id)
      .order("purchase_date", { ascending: false }),
    supabase
      .from("supplier_payments")
      .select("*")
      .eq("supplier_id", params.id)
      .order("payment_date", { ascending: false }),
  ]);

  if (!supplier) notFound();

  return (
    <SupplierProfileClient
      supplier={supplier}
      purchases={purchases || []}
      payments={payments || []}
      userId={user.id}
    />
  );
}
