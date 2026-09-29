import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseProjectIntegrityFields } from "@/lib/project-fields";
import { INTEGRITY_SUMMARY } from "@/lib/integrity/summary";

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
          include: { integrity: { select: INTEGRITY_SUMMARY } },
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

/** Update the Integrity Engine inputs: site coordinates, geofence, impact type, claim. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json();
    const fields = parseProjectIntegrityFields(body);
    if ("error" in fields) {
      return NextResponse.json({ success: false, error: fields.error }, { status: 400 });
    }

    const existing = await db.project.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 });
    }

    const project = await db.project.update({ where: { id: params.id }, data: fields.data });
    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error(`PATCH /api/projects/${params.id} error:`, error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to update project" },
      { status: 500 }
    );
  }
}
