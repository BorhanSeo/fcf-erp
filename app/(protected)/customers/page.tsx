import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import CustomersClient from "./CustomersClient";

export const metadata = { title: "Customer Management — FCF ERP" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch profile + data in parallel
  const [{ data: profile }, { data: customers }, { count }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("customers").select("*").order("total_due", { ascending: false }).limit(50),
    supabase.from("customers").select("*", { count: "exact", head: true }),
  ]);

  if (!profile) redirect("/login");

  const areas = [...new Set((customers || []).map(c => c.area).filter(Boolean))] as string[];

  return (
    <CustomersClient
      initialCustomers={customers || []}
      totalCount={count || 0}
      areas={areas}
      profile={profile}
    />
  );
}
