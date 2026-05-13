import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import SuppliersClient from "./SuppliersClient";

export const metadata = { title: "Suppliers — FCF ERP" };

export default async function SuppliersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [profile, { data: suppliers }, { count }] = await Promise.all([
    getProfile(user.id),
    supabase.from("suppliers").select("*").order("total_due", { ascending: false }),
    supabase.from("suppliers").select("*", { count: "exact", head: true }),
  ]);

  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return <SuppliersClient initialSuppliers={suppliers || []} totalCount={count || 0} profile={profile} />;
}
