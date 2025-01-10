import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UtawalaInventory from "@/components/inventory/UtawalaInventory";

export default async function UtawalaInventoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user || error) {
    redirect("/login");
  }

  // Check if user has permission
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "clerk", "accountant"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return <UtawalaInventory />;
}
