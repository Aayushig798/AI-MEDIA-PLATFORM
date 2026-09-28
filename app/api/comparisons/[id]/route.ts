import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
