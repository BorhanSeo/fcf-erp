import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SettingsClient from "./SettingsClient";

export const metadata = { title: "System Settings — FCF ERP" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { data: settings } = await supabase.from("settings").select("*");
  const settingsMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));

  return <SettingsClient initialSettings={settingsMap} userId={user.id} />;
}
