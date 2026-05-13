import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import CustomersClient from "./CustomersClient";
import { Customer } from "@/types";

export const metadata = { title: "Customer Management — FCF ERP" };

export default async function CustomersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const [profile, { data: customers }, { count }] = await Promise.all([
    getProfile(user.id),
    supabase.from("customers").select("*").order("total_due", { ascending: false }).limit(50),
    supabase.from("customers").select("*", { count: "exact", head: true }),
  ]);

  if (!profile) redirect("/login");

  const customersList = (customers as Customer[]) || [];
  const areas = Array.from(new Set(customersList.map(c => c.area).filter(Boolean))) as string[];

  return (
    <CustomersClient
      initialCustomers={customers || []}
      totalCount={count || 0}
      areas={areas}
      profile={profile}
    />
  );
}
