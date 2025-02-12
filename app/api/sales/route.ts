import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "clerk"].includes(profile.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { request_id, items, ...saleData } = await request.json();

    // Calculate total amount
    const total_amount = items.reduce(
      (acc: number, item: any) => acc + item.total_price,
      0
    );

    // Create the sale
    const { data: sale, error: saleError } = await supabase
      .from("sales")
      .insert({
        ...saleData,
        total_amount,
        created_by: user.id,
        request_id,
        status: "pending",
      })
      .select()
      .single();

    if (saleError) {
      console.error("Sale creation error:", saleError);
      throw saleError;
    }

    // Insert sale items
    const { error: itemsError } = await supabase.from("sale_items").insert(
      items.map((item: any) => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))
    );

    if (itemsError) {
      console.error("Sale items error:", itemsError);
      throw itemsError;
    }

    // Update inventory request if needed
    if (request_id) {
      const { error: requestError } = await supabase
        .from("inventory_requests")
        .update({
          sale_id: sale.id,
          status: "approved",
          approved_by: user.id,
        })
        .eq("id", request_id);

      if (requestError) {
        console.error("Request update error:", requestError);
        throw requestError;
      }
    }

    return NextResponse.json(sale);
  } catch (error: any) {
    console.error("Sale creation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create sale" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    // First get all sales with their basic info
    const { data: sales, error } = await supabase
      .from("sales")
      .select(
        `
        *,
        profiles!sales_created_by_fkey (
          full_name
        ),
        approved_by_profile: profiles!sales_approved_by_fkey (
          full_name
        )
      `
      )
      .neq("status", "fully_returned")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching sales:", error);
      throw error;
    }

    // For each sale, get its items with effective quantities
    const salesWithItems = await Promise.all(
      sales.map(async (sale) => {
        const { data: items, error: itemsError } = await supabase.rpc(
          "get_sale_items_with_returns",
          { p_sale_id: sale.id }
        );

        if (itemsError) {
          console.error("Error fetching sale items:", itemsError);
          throw itemsError;
        }

        // Transform the items to match the expected structure
        const transformedItems =
          items?.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            effective_quantity: item.effective_quantity,
            products: {
              name: item.product_name,
            },
          })) || [];

        return {
          ...sale,
          sale_items: transformedItems,
        };
      })
    );

    return NextResponse.json(salesWithItems);
  } catch (error: any) {
    console.error("Sales fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch sales" },
      { status: 500 }
    );
  }
}
