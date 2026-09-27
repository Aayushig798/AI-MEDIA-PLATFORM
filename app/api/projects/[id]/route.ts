import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Project ID is required" },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({
      where: { id },
      include: {
        assets: {
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { assets: true } },
      },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error(`GET /api/projects/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch project" },
      { status: 500 }
    );
  }
}
