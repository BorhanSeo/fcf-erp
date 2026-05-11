import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import StockHistoryClient from "./StockHistoryClient";

interface Props { params: { id: string } }

export default async function StockHistoryPage({ params }: Props) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: product }, { data: movements }] = await Promise.all([
    supabase.from("products").select("*, product_categories(name)").eq("id", params.id).single(),
    supabase
      .from("stock_movements")
      .select("*")
      .eq("product_id", params.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if (!product) notFound();

  return <StockHistoryClient product={product} movements={movements || []} />;
}
