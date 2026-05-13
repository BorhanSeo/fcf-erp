import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect, notFound } from "next/navigation";
import PurchaseDetailClient from "./PurchaseDetailClient";

interface Props { params: { id: string } }

export default async function PurchaseDetailPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: purchase } = await supabase
    .from("purchases")
    .select(`*, suppliers(id, name, phone, address, total_due), purchase_items(*, products(id, name, product_code, subject, unit, stock_quantity))`)
    .eq("id", params.id)
    .single();

  if (!purchase) notFound();

  return <PurchaseDetailClient purchase={purchase} userId={user.id} />;
}
