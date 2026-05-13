import { cache } from "react";
import { createClient } from "./server";

export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return data;
});

export const getSettings = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.from("settings").select("*");
  return (data || []).reduce(
    (acc: Record<string, string>, row: any) => ({ ...acc, [row.key]: row.value }),
    {} as Record<string, string>
  );
});
