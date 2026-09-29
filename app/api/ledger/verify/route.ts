import { NextResponse } from "next/server";
import { verifyFullChain } from "@/lib/ledger";

export const dynamic = "force-dynamic";

/** Server-side recomputation of every entry hash and link in the chain. */
export async function GET() {
  try {
    const result = await verifyFullChain();
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error("GET /api/ledger/verify error:", error);
    return NextResponse.json({ success: false, error: error.message || "Failed to verify ledger" }, { status: 500 });
  }
}
