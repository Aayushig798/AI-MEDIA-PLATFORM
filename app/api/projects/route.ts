import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActor } from "@/lib/auth";
import { parseProjectIntegrityFields } from "@/lib/project-fields";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { assets: true } } },
    });
    return NextResponse.json({ success: true, projects });
  } catch (error: any) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description, location, startDate } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Project name is required" },
        { status: 400 }
      );
    }

    const fields = parseProjectIntegrityFields(body);
    if ("error" in fields) {
      return NextResponse.json({ success: false, error: fields.error }, { status: 400 });
    }

    const actor = await getActor();
    const user = await db.user.findUnique({ where: { id: actor.id } });
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Demo user missing. Run `npx prisma db seed` first." },
        { status: 500 }
      );
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        createdBy: user.id,
        ...fields.data,
      },
    });

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create project" },
      { status: 500 }
    );
  }
}
