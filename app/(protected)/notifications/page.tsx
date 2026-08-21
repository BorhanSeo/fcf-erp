import { createClient } from "@/lib/supabase/server";
import { getAuthUser, getProfile } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import NotificationsClient from "./NotificationsClient";

export const metadata = { title: "Notifications — FCF ERP" };

export default async function NotificationsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const profile = await getProfile(user.id);
  const supabase = await createClient();

  const { data: permSetting } = await supabase.from("settings").select("value").eq("key", "perm_staff_notifications").maybeSingle();
  const allowed = profile?.role === "admin" || (permSetting ? permSetting.value === "true" : false);
  if (!allowed) redirect("/dashboard");
  const [
    { data: templates },
    { data: logs },
    { data: customers },
    { data: settings },
  ] = await Promise.all([
    supabase.from("notification_templates").select("*").order("type"),
    supabase.from("notification_logs").select("*, customers(name)").order("created_at", { ascending: false }).limit(50),
    supabase.from("customers").select("id, name, phone").eq("is_active", true).order("name"),
    supabase.from("settings").select("key, value").in("key", ["whatsapp_api_key", "whatsapp_enabled", "company_phone"]),
  ]);

  const settingsMap = Object.fromEntries((settings || []).map(s => [s.key, s.value]));

  return (
    <NotificationsClient
      templates={templates || []}
      logs={logs || []}
      customers={customers || []}
      settings={settingsMap}
      userId={user.id}
    />
  );
}
