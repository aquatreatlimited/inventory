import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import KamuluInventory from "@/components/inventory/KamuluInventory";

export default async function KamuluInventoryPage() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (!user || error) {
    redirect("/login");
  }

  // Check if user has permission
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || !['admin', 'clerk'].includes(profile.role)) {
    redirect("/dashboard");
  }

  return <KamuluInventory />;
}
