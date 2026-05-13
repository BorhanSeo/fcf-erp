import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "System Settings — FCF ERP" };

export default async function SettingsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("*");
  const settingsMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));

  return <SettingsClient initialSettings={settingsMap} userId={user.id} />;
}
