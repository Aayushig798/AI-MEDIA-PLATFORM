import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Record where an anchor's Merkle root was published (e.g. the commit URL made
 * by the ledger-anchor workflow). Bearer-token protected: ANCHOR_TOKEN.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = process.env.ANCHOR_TOKEN;
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { externalRef } = await req.json();
    if (typeof externalRef !== "string" || !/^https:\/\//.test(externalRef) || externalRef.length > 500) {
      return NextResponse.json({ success: false, error: "externalRef must be an https URL" }, { status: 400 });
    }
    const anchor = await prisma.merkleAnchor.update({ where: { id: params.id }, data: { externalRef } });
    return NextResponse.json({ success: true, anchor });
  } catch (error: any) {
    console.error(`PATCH /api/ledger/anchor/${params.id} error:`, error);
    return NextResponse.json({ success: false, error: error.message || "Failed to update anchor" }, { status: 500 });
  }
}
