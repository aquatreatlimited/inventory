import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all returns with related data
    const { data: returns, error } = await supabase
      .from("sale_returns")
      .select(
        `
        *,
        created_by_profile: profiles!created_by (full_name),
        sale_return_items (
          *,
          sale_item: sale_items (
            product: products (name)
          )
        ),
        sale: sales (
          id,
          customer_name
        )
      `
      )
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching returns:", error);
      throw error;
    }

    return NextResponse.json(returns);
  } catch (error: any) {
    console.error("Returns fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch returns" },
      { status: 500 }
    );
  }
}
