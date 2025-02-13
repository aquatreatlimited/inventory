import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const adjustmentSchema = z.object({
  product_id: z.string().uuid(),
  location: z.enum(["utawala", "kamulu"]),
  quantity: z.number(),
});

export async function POST(request: Request) {
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
    const validatedData = adjustmentSchema.parse(body);

    // First get the current quantity
    const { data: inventory, error: inventoryError } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("product_id", validatedData.product_id)
      .eq("location", validatedData.location)
      .single();

    if (inventoryError && inventoryError.code !== "PGRST116") {
      throw inventoryError;
    }

    const currentQuantity = inventory?.quantity || 0;
    const newQuantity = currentQuantity + validatedData.quantity;

    if (newQuantity < 0) {
      return NextResponse.json(
        { error: "Cannot reduce stock below zero" },
        { status: 400 }
      );
    }

    // Update the existing inventory record
    const { error: updateError } = await supabase
      .from("inventory")
      .update({
        quantity: newQuantity,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", validatedData.product_id)
      .eq("location", validatedData.location);

    if (updateError) {
      // If no record exists, create one
      const { error: insertError } = await supabase.from("inventory").insert({
        product_id: validatedData.product_id,
        location: validatedData.location,
        quantity: validatedData.quantity,
      });

      if (insertError) throw insertError;
    }

    // Create inventory transaction record
    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert({
        product_id: validatedData.product_id,
        transaction_type: validatedData.quantity >= 0 ? "purchase" : "sale",
        from_location:
          validatedData.quantity < 0 ? validatedData.location : null,
        to_location: validatedData.quantity > 0 ? validatedData.location : null,
        quantity: Math.abs(validatedData.quantity),
        created_by: user.id,
      });

    if (transactionError) throw transactionError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Inventory adjustment error:", error);
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Invalid request data", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error.message || "Failed to adjust inventory" },
      { status: 500 }
    );
  }
}
