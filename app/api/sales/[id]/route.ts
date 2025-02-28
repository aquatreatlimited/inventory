import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Verify user role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "accountant"].includes(profile.role)) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { status, approved_by } = body;

    if (status === "approved") {
      // Call the stored procedure to approve the sale
      const { data, error } = await supabase.rpc("approve_sale", {
        p_sale_id: params.id,
        p_approved_by: user.id,
      });

      if (error) {
        console.error("Error approving sale:", error);
        return NextResponse.json(
          {
            error: error.message,
            checkInventory: error.message.includes("Insufficient stock"),
          },
          { status: 400 }
        );
      }

      return NextResponse.json(data);
    }

    // Handle rejection case
    const { data: updatedSale, error: updateError } = await supabase
      .from("sales")
      .update({
        status: "rejected",
        approved_by,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json(updatedSale);
  } catch (error: any) {
    console.error("Error processing sale:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process sale" },
      { status: 500 }
    );
  }
}
