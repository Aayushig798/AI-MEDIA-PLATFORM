import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json();
    const { notes } = body;

    const existing = await db.comparison.findMany({ where: { id } });
    if (!existing || existing.length === 0) {
      // Try single find
    }

    const updated = await db.comparison.update({
      where: { id },
      data: {
        notes: notes !== undefined ? (notes ? String(notes).trim() : null) : undefined,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Comparison updated successfully",
      comparison: updated,
    });
  } catch (error: any) {
    console.error(`PATCH /api/comparisons/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update comparison" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const deleted = await db.comparison.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Comparison removed successfully",
      deletedId: id,
    });
  } catch (error: any) {
    console.error(`DELETE /api/comparisons/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to delete comparison" },
      { status: 500 }
    );
  }
}
