import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import UsersClient from "./UsersClient";

export const metadata = { title: "User Management — FCF ERP" };

export default async function UsersPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  return <UsersClient users={users || []} currentUserId={user.id} />;
}
