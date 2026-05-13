import { redirect } from "next/navigation";
import { getAuthUser, getProfile, getSettings } from "@/lib/supabase/auth";
import AppLayout from "@/components/layout/AppLayout";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [profile, settings] = await Promise.all([
    getProfile(user.id),
    getSettings(),
  ]);

  if (!profile || !profile.is_active) redirect("/login");

  return <AppLayout user={profile} settings={settings}>{children}</AppLayout>;
}
