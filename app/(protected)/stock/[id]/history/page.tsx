import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { redirect, notFound } from "next/navigation";
import StockHistoryClient from "./StockHistoryClient";

interface Props { params: { id: string } }

export default async function StockHistoryPage({ params }: Props) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
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
