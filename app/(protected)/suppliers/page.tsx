import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SuppliersClient from "./SuppliersClient";

export const metadata = { title: "Suppliers — FCF ERP" };

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + data in parallel
  const [{ data: profile }, { data: suppliers }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("suppliers").select("*").order("total_due", { ascending: false }),
    supabase.from("suppliers").select("*", { count: "exact", head: true }),
  ]);

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return <SuppliersClient initialSuppliers={suppliers || []} totalCount={count || 0} profile={profile} />;
}
