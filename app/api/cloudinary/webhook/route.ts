import { NextRequest, NextResponse } from "next/server";
import { cloudinary } from "@/lib/cloudinary";
import { prisma as db } from "@/lib/db";
import { tryAppendLedger } from "@/lib/ledger";

const MAX_AGE_SECONDS = 7200;

/**
 * Cloudinary notification_url target (uploads, eager/explicit derivatives,
 * transcription). Only signed notifications are accepted and ledgered.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const timestamp = Number(req.headers.get("x-cld-timestamp"));
  const signature = req.headers.get("x-cld-signature") || "";

  const valid =
    Number.isFinite(timestamp) &&
    signature &&
    cloudinary.utils.verifyNotificationSignature(rawBody, timestamp, signature, MAX_AGE_SECONDS);
  if (!valid) {
    return NextResponse.json({ success: false, error: "Invalid Cloudinary signature" }, { status: 401 });
  }

  let body: Record<string, any>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ success: false, error: "Body is not JSON" }, { status: 400 });
  }

  const asset = body.public_id
    ? await db.mediaAsset.findUnique({
        where: { cloudinaryPublicId: body.public_id },
        select: { id: true, projectId: true },
      })
    : null;

  await tryAppendLedger({
    type: "CLOUDINARY_NOTIFICATION",
    actor: "cloudinary-webhook",
    assetId: asset?.id ?? null,
    projectId: asset?.projectId ?? null,
    payload: {
      notificationType: body.notification_type ?? body.info_kind ?? null,
      publicId: body.public_id ?? null,
      etag: body.etag ?? null,
      phash: body.phash ?? null,
      eager: Array.isArray(body.eager) ? body.eager.map((e: any) => e.secure_url) : undefined,
      infoStatus: body.info_status ?? undefined,
      notifiedAt: timestamp,
    },
  });

  return NextResponse.json({ success: true });
}
