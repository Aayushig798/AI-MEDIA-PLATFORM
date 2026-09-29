import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

/** SVG QR code for a verify link (used by the Verify page, reports and print views). */
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get("url");
  if (!url || !/^https?:\/\//.test(url) || url.length > 2000) {
    return NextResponse.json({ success: false, error: "A valid http(s) url is required" }, { status: 400 });
  }
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return new NextResponse(svg, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
  });
}
