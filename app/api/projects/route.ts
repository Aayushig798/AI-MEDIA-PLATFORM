import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { parseProjectIntegrityFields } from "@/lib/project-fields";

export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { createdAt: "desc" },
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

    // Attempt to get logged-in user or fallback to seeded demo user
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id || "usr_demo123";

    // Ensure user exists in database
    let user = await db.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await db.user.create({
        data: {
          id: userId,
          email: session?.user?.email || "demo@impactmedia.org",
          name: session?.user?.name || "Field Officer Elena",
          password: "demo123_plain_or_hash",
        },
      });
    }

    // Optional Integrity Engine inputs: site coordinates, geofence, impact type, claim
    const integrityFields = parseProjectIntegrityFields(body);
    if ("error" in integrityFields) {
      return NextResponse.json({ success: false, error: integrityFields.error }, { status: 400 });
    }

    const project = await db.project.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        location: location?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        createdBy: user.id,
        ...integrityFields.data,
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
