import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get("location");

    if (!location) {
      return new NextResponse("Location is required", { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get products with their inventory for the specified location
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        description,
        min_stock_level,
        inventory!inner (
          quantity,
          location
        )
      `
      )
      .eq("inventory.location", location);

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get user's role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "clerk"].includes(profile.role)) {
      return new NextResponse("Unauthorized: Insufficient permissions", {
        status: 403,
      });
    }

    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return new NextResponse("Product ID is required", { status: 400 });
    }

    // First check if product exists and get its current state
    const { data: existingProduct, error: checkError } = await supabase
      .from("products")
      .select(
        `
        *,
        inventory!inner (
          quantity,
          location
        )
      `
      )
      .eq("id", id)
      .single();

    if (checkError || !existingProduct) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Clean up the update data
    const cleanUpdateData = {
      name: updateData.name,
      description: updateData.description,
      min_stock_level:
        typeof updateData.min_stock_level === "string"
          ? parseInt(updateData.min_stock_level, 10)
          : updateData.min_stock_level,
      category_id: updateData.category_id,
      updated_at: new Date().toISOString(),
    };

    // First perform the update
    const { error: updateError } = await supabase
      .from("products")
      .update(cleanUpdateData)
      .eq("id", id);

    if (updateError) {
      console.error("❌ Update failed:", updateError);
      throw updateError;
    }

    // Then fetch the updated product with all its relations
    const { data: updatedProduct, error: fetchError } = await supabase
      .from("products")
      .select(
        `
        *,
        inventory!inner (
          quantity,
          location
        ),
        category:product_categories(
          id,
          name
        )
      `
      )
      .eq("id", id)
      .single();

    if (fetchError) {
      console.error("❌ Failed to fetch updated product:", fetchError);
      throw fetchError;
    }
    
    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    console.error("❌ Error in PATCH /api/products:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update product" },
      { status: 500 }
    );
  }
}
