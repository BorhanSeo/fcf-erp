import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppLayout from "@/components/layout/AppLayout";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get profile data
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  // Get system settings
  const { data: settingsData } = await supabase.from("settings").select("*");
  const settings = settingsData?.reduce(
    (acc, row) => ({ ...acc, [row.key]: row.value }),
    {} as Record<string, string>
  ) || {};

  return <AppLayout user={profile} settings={settings}>{children}</AppLayout>;
}
