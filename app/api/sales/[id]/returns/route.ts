import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schema for return items
const returnItemSchema = z.object({
  sale_item_id: z.string().uuid(),
  quantity_returned: z.number().positive(),
  unit_price: z.number().positive(),
});

// Schema for the complete return request
const returnRequestSchema = z.object({
  notes: z.string().optional(),
  items: z.array(returnItemSchema).min(1),
});

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "clerk"].includes(profile.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body
    const validatedData = returnRequestSchema.parse(body);

    // Process the return using our stored function
    const { data, error } = await supabase.rpc("process_return", {
      p_sale_id: params.id,
      p_created_by: user.id,
      p_notes: validatedData.notes || null,
      p_return_items: validatedData.items,
    });

    if (error) {
      console.error("Return processing error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to process return" },
        { status: 400 }
      );
    }

    // Fetch the created return with its items
    const { data: returnData, error: fetchError } = await supabase
      .from("sale_returns")
      .select(
        `
        *,
        sale_return_items (
          *,
          sale_item: sale_items (
            product: products (name)
          )
        )
      `
      )
      .eq("id", data)
      .single();

    if (fetchError) {
      console.error("Error fetching return details:", fetchError);
      return NextResponse.json(
        { error: "Return processed but failed to fetch details" },
        { status: 500 }
      );
    }

    return NextResponse.json(returnData);
  } catch (error: any) {
    console.error("Return creation error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to process return" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all returns for the sale
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
        )
      `
      )
      .eq("sale_id", params.id)
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
