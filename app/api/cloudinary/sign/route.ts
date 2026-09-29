import { NextRequest, NextResponse } from "next/server";
import { generateUploadSignature } from "@/lib/cloudinary";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, resourceType } = body;

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "projectId is required for signed upload" },
        { status: 400 }
      );
    }

    const folderUuid = crypto.randomUUID();
    const signedParams = generateUploadSignature(projectId, folderUuid, resourceType);

    return NextResponse.json({
      success: true,
      signature: signedParams.signature,
      timestamp: signedParams.timestamp,
      api_key: signedParams.apiKey,
      apiKey: signedParams.apiKey,
      cloud_name: signedParams.cloudName,
      cloudName: signedParams.cloudName,
      folder: signedParams.folder,
      categorization: signedParams.categorization,
      auto_tagging: signedParams.autoTagging,
      autoTagging: signedParams.autoTagging,
      image_metadata: signedParams.imageMetadata,
      imageMetadata: signedParams.imageMetadata,
      phash: signedParams.phash,
      notification_url: signedParams.notificationUrl,
      auto_transcription: signedParams.autoTranscription,
    });
  } catch (error: any) {
    console.error("POST /api/cloudinary/sign error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to generate upload signature" },
      { status: 500 }
    );
  }
}
