import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export const metadata = { title: "User Management — FCF ERP" };

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return <UsersClient users={users || []} currentUserId={user.id} />;
}
