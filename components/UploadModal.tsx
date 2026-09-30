"use client";

import { useState, useRef } from "react";
import {
  X,
  Upload,
  UploadCloud,
  Video,
  Play,
  Camera,
  Check,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Plus,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  MapPin,
  Sparkles,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import { TrustBadge, IntegritySummary } from "./TrustBadge";
import { cx, IconChip, useBodyScrollLock } from "./ui";
import { extractExifCaptureDate } from "@/lib/exif";
const CATEGORY_OPTIONS = [
  "Environmental",
  "Infrastructure",
  "Community",
  "Disaster Response",
  "Uncategorized",
];

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  resourceType: "image" | "video";
  manualCategory: string;
  manualLocation: string;
  manualNotes: string;
  capturedAt: string;
  hasExifDate?: boolean;
  exifChecking?: boolean;
  status: "idle" | "uploading" | "verifying" | "success" | "error";
  integrity?: IntegritySummary | null;
  progress: number;
  errorMessage?: string;
}

interface UploadModalProps {
  projectId: string;
  defaultLocation?: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: () => void;
}

const FIELD_CLASS = "input disabled:cursor-not-allowed disabled:bg-zinc-50 disabled:text-zinc-500";

// Set once Cloudinary reports the monthly Google auto-tagging allowance is used up,
// so later files in this session skip straight to uploading without it.
let autoTaggingExhausted = false;

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ACCEPTED_FORMATS = ["JPG", "PNG", "WEBP", "MP4", "MOV"];

/** Status pill shown on each file card. */
function FileStatus({ item }: { item: StagedFile }) {
  switch (item.status) {
    case "uploading":
      return (
        <span className="badge badge-green">
          <Loader2 className="h-3 w-3 animate-spin" />
          Uploading <span className="tabular-nums">{item.progress}%</span>
        </span>
      );
    case "verifying":
      return (
        <span className="badge badge-blue">
          <Loader2 className="h-3 w-3 animate-spin" />
          Verifying
        </span>
      );
    case "success":
      return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span className="badge badge-green">
            <Check className="h-3 w-3" />
            Uploaded
          </span>
          {item.integrity && <TrustBadge integrity={item.integrity} />}
        </span>
      );
    case "error":
      return (
        <span className="badge badge-red">
          <AlertCircle className="h-3 w-3" />
          Couldn&apos;t upload
        </span>
      );
    default:
      return (
        <span className="badge badge-neutral">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          Ready
        </span>
      );
  }
}

/** Preview tile with a small status overlay. */
function FileThumb({ item }: { item: StagedFile }) {
  const busy = item.status === "uploading" || item.status === "verifying";
  return (
    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-zinc-100 sm:h-[72px] sm:w-[72px]">
      {item.resourceType === "video" ? (
        <>
          <video
            src={item.previewUrl}
            muted
            playsInline
            preload="metadata"
            className="h-full w-full bg-zinc-900 object-cover"
          />
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-sm">
              <Play className="ml-px h-3 w-3 fill-current" />
            </span>
          </span>
        </>
      ) : (
        <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
      )}
      <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-black/5" />
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center bg-white/55 backdrop-blur-[1px]">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
        </span>
      )}
      {item.status === "success" && (
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm ring-2 ring-white">
          <Check className="h-3 w-3" />
        </span>
      )}
      {item.status === "error" && (
        <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm ring-2 ring-white">
          <AlertCircle className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

export function UploadModal({
  projectId,
  defaultLocation = "",
  isOpen,
  onClose,
  onUploadComplete,
}: UploadModalProps) {
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchCategory, setBatchCategory] = useState("");
  // Run the Integrity Engine as each file lands (uses free-tier quotas; can be switched off)
  const [autoVerify, setAutoVerify] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const newItems: StagedFile[] = fileList.map((file, idx) => {
      const isVideo = file.type.startsWith("video/");
      const preview = URL.createObjectURL(file);
      return {
        id: `staged_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`,
        file,
        previewUrl: preview,
        resourceType: isVideo ? "video" : "image",
        manualCategory: batchCategory,
        manualLocation: defaultLocation || "",
        manualNotes: "",
        capturedAt: "",
        hasExifDate: false,
        exifChecking: !isVideo,
        status: "idle",
        progress: 0,
      };
    });

    setStagedFiles((prev) => [...prev, ...newItems]);

    // Asynchronously extract EXIF capture date (DateTimeOriginal) from image files
    newItems.forEach((staged) => {
      if (staged.resourceType === "image") {
        extractExifCaptureDate(staged.file).then((exifIso) => {
          if (exifIso) {
            const dateOnly = exifIso.split("T")[0];
            setStagedFiles((prev) =>
              prev.map((item) =>
                item.id === staged.id
                  ? {
                      ...item,
                      capturedAt: dateOnly,
                      hasExifDate: true,
                      exifChecking: false,
                    }
                  : item
              )
            );
          } else {
            setStagedFiles((prev) =>
              prev.map((item) =>
                item.id === staged.id
                  ? { ...item, hasExifDate: false, exifChecking: false }
                  : item
              )
            );
          }
        });
      }
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleRemoveStaged = (id: string) => {
    setStagedFiles((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const updateStagedField = (id: string, field: keyof StagedFile, value: any) => {
    setStagedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const applyCategoryToAll = (category: string) => {
    setBatchCategory(category);
    setStagedFiles((prev) =>
      prev.map((item) => ({ ...item, manualCategory: category }))
    );
  };

  // Helper to read image dimensions
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith("image/")) {
        return resolve({ width: 1920, height: 1080 });
      }
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        resolve({ width: 1920, height: 1080 });
      };
      img.src = URL.createObjectURL(file);
    });
  };

  // Helper to convert file to Base64 data URL
  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  };

  const uploadSingleAsset = async (staged: StagedFile): Promise<boolean> => {
    try {
      updateStagedField(staged.id, "status", "uploading");
      updateStagedField(staged.id, "progress", 10);

      // Step 1: Request signed upload params from /api/cloudinary/sign
      const requestSignature = async (autoTagging: boolean) => {
        const signRes = await fetch("/api/cloudinary/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, resourceType: staged.resourceType, autoTagging }),
        });
        if (!signRes.ok) {
          throw new Error("Couldn't start the upload. Please try again.");
        }
        return signRes.json();
      };

      let signData = await requestSignature(!autoTaggingExhausted);
      const { apiKey, cloudName, folder } = signData;

      updateStagedField(staged.id, "progress", 30);

      let publicId = "";
      let secureUrl = "";
      let resourceType = staged.resourceType;
      let format = staged.file.name.split(".").pop() || (resourceType === "video" ? "mp4" : "jpg");
      let bytes = staged.file.size;
      let width = 1920;
      let height = 1080;

      // Extract image dimensions client-side
      try {
        const dims = await getImageDimensions(staged.file);
        width = dims.width;
        height = dims.height;
      } catch (e) {
        // ignore
      }

      let rawCloudinaryInfo: any = null;

      // Step 2: Direct upload to Cloudinary (whenever real credentials are configured)
      if (apiKey && apiKey !== "" && cloudName && cloudName !== "demo") {
        const attemptUpload = async (sd: any) => {
          const uploadFormData = new FormData();
          uploadFormData.append("file", staged.file);
          uploadFormData.append("api_key", sd.apiKey);
          uploadFormData.append("timestamp", sd.timestamp.toString());
          uploadFormData.append("signature", sd.signature);
          uploadFormData.append("folder", sd.folder);
          // Only fields the server signed may be sent, or Cloudinary rejects the signature
          if (sd.categorization) {
            uploadFormData.append("categorization", sd.categorization);
            uploadFormData.append("auto_tagging", String(sd.auto_tagging ?? 0.6));
          }
          uploadFormData.append("image_metadata", (sd.image_metadata ?? true).toString());
          // Signed too: perceptual hash for the Integrity Engine, optional webhook
          if (sd.phash) uploadFormData.append("phash", "true");
          if (sd.notification_url) uploadFormData.append("notification_url", sd.notification_url);
          if (sd.auto_transcription) uploadFormData.append("auto_transcription", "true");

          const cldRes = await fetch(`https://api.cloudinary.com/v1_1/${sd.cloudName}/auto/upload`, {
            method: "POST",
            body: uploadFormData,
          });
          return { ok: cldRes.ok, data: await cldRes.json().catch(() => ({})) };
        };

        updateStagedField(staged.id, "progress", 50);
        let result = await attemptUpload(signData);

        // The free Google auto-tagging allowance (50 a month) can run out, and Cloudinary then
        // refuses the whole upload. Upload without it; the server tags the photo with Gemini.
        if (!result.ok && signData.categorization && /auto tagging/i.test(result.data?.error?.message || "")) {
          autoTaggingExhausted = true;
          signData = await requestSignature(false);
          result = await attemptUpload(signData);
        }
        if (!result.ok) {
          throw new Error(`Cloudinary rejected the upload: ${result.data?.error?.message || "unknown error"}`);
        }

        const cldData = result.data;
        rawCloudinaryInfo = cldData;
        publicId = cldData.public_id;
        secureUrl = cldData.secure_url;
        resourceType = cldData.resource_type || resourceType;
        format = cldData.format || format;
        bytes = cldData.bytes || bytes;
        width = cldData.width || width;
        height = cldData.height || height;
      } else {
        // Development / mock mode only: no Cloudinary credentials configured
        const uuidStr = Math.random().toString(36).substring(2, 9);
        publicId = `${folder}/${uuidStr}_${staged.file.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;

        // If file is an image, convert to data URL so it displays immediately and offline!
        if (staged.resourceType === "image" && staged.file.size < 5 * 1024 * 1024) {
          secureUrl = await fileToDataUrl(staged.file);
        } else {
          // Sample Cloudinary CDN delivery URL for video or large files
          secureUrl = `https://res.cloudinary.com/${cloudName || "demo"}/image/upload/${folder}/${uuidStr}.jpg`;
        }
      }

      updateStagedField(staged.id, "progress", 80);

      const hasPickedCategory = Boolean(staged.manualCategory && staged.manualCategory.trim() !== "");

      // Step 3: Register media asset in database via POST /api/assets
      const assetPayload = {
        projectId,
        cloudinaryPublicId: publicId,
        secureUrl,
        resourceType,
        format,
        bytes,
        width,
        height,
        manualCategory: hasPickedCategory ? staged.manualCategory.trim() : null,
        categorySource: hasPickedCategory ? "user" : "ai",
        manualLocation: staged.manualLocation || null,
        manualNotes: staged.manualNotes || null,
        capturedAt: staged.capturedAt ? new Date(staged.capturedAt).toISOString() : null,
        info: rawCloudinaryInfo,
        filename: staged.file.name,
      };

      const dbRes = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assetPayload),
      });

      const dbJson = await dbRes.json();
      if (!dbRes.ok) {
        throw new Error(dbJson.error || "Couldn't save this file to the project.");
      }

      updateStagedField(staged.id, "progress", 100);

      // Proof-of-Impact Integrity Engine: duplicates, pHash, web, EXIF, weather, AI auditor...
      if (autoVerify && dbJson.asset?.id) {
        updateStagedField(staged.id, "status", "verifying");
        try {
          const vRes = await fetch(`/api/assets/${dbJson.asset.id}/verify`, { method: "POST" });
          const vJson = await vRes.json();
          if (vJson.integrity) updateStagedField(staged.id, "integrity", vJson.integrity);
        } catch (verifyErr) {
          console.warn("Verification after upload failed:", verifyErr);
        }
      }

      updateStagedField(staged.id, "status", "success");
      return true;
    } catch (err: any) {
      console.error("Upload error for file", staged.file.name, err);
      updateStagedField(staged.id, "status", "error");
      updateStagedField(staged.id, "errorMessage", err.message || "Upload failed");
      return false;
    }
  };

  const handleStartBatchUpload = async () => {
    if (stagedFiles.length === 0) return;

    try {
      setBatchUploading(true);
      const pendingFiles = stagedFiles.filter((f) => f.status !== "success");

      for (const item of pendingFiles) {
        await uploadSingleAsset(item);
      }

      // Refresh gallery after all uploaded
      onUploadComplete();
    } finally {
      setBatchUploading(false);
    }
  };

  const allSuccess =
    stagedFiles.length > 0 && stagedFiles.every((f) => f.status === "success");

  // Derived counts for plain-language status text
  const successCount = stagedFiles.filter((f) => f.status === "success").length;
  const errorCount = stagedFiles.filter((f) => f.status === "error").length;
  const pendingCount = stagedFiles.length - successCount;

  const readyCount = stagedFiles.filter((f) => f.status === "idle").length;
  const missingDateCount = stagedFiles.filter(
    (f) => !f.capturedAt && !f.exifChecking && f.status !== "success"
  ).length;
  const totalBytes = stagedFiles.reduce((sum, f) => sum + f.file.size, 0);
  const batchPercent = stagedFiles.length > 0 ? Math.round((successCount / stagedFiles.length) * 100) : 0;

  // Plain-language summary pieces for the footer ("3 files · 2 ready")
  const summaryParts: { text: string; className?: string }[] = [];
  if (readyCount > 0) summaryParts.push({ text: `${readyCount} ready` });
  if (successCount > 0) summaryParts.push({ text: `${successCount} uploaded`, className: "text-emerald-700" });
  if (errorCount > 0) summaryParts.push({ text: `${errorCount} couldn't be uploaded`, className: "text-red-700" });
  if (missingDateCount > 0) summaryParts.push({ text: `${missingDateCount} without a date`, className: "text-amber-700" });

  const nextSteps = [
    { icon: CalendarDays, tone: "sky" as const, title: "Reads the date", text: "From the photo, when it has one" },
    { icon: Sparkles, tone: "violet" as const, title: "Tags it with AI", text: "So it's easy to find later" },
    autoVerify
      ? { icon: ShieldCheck, tone: "emerald" as const, title: "Verifies it", text: "Checks for reuse or editing" }
      : { icon: ShieldCheck, tone: "zinc" as const, title: "Verification off", text: "Turn it on in upload settings" },
  ];

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: () => setIsDragging(false),
    onDrop: handleDrop,
  };

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex items-start justify-center overflow-y-auto bg-zinc-950/50 p-4 sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Upload media"
        className="animate-fade-in relative my-auto flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[0_24px_64px_-16px_rgba(16,24,40,0.35)] sm:max-h-[calc(100vh-3rem)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          id="close-upload-modal-btn"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div
          className={cx(
            "flex items-start gap-3.5 px-6 pb-4 pr-12 pt-6",
            stagedFiles.length > 0 && "border-b border-zinc-100"
          )}
        >
          <IconChip icon={Upload} tone="emerald" />
          <div className="min-w-0 space-y-1">
            <h2 className="text-[17px] font-semibold tracking-tight text-zinc-900">Upload media</h2>
            <p className="text-sm leading-relaxed text-zinc-500">
              Add photos or videos as evidence for this project.
            </p>
          </div>
        </div>

        {/* Body */}
        <div className={cx("min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-6", stagedFiles.length > 0 && "pt-5")}>
          {stagedFiles.length === 0 ? (
            <>
              {/* Hero drop zone */}
              <button
                type="button"
                {...dragHandlers}
                onClick={() => fileInputRef.current?.click()}
                className={cx(
                  "group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-gradient-to-b px-6 py-12 text-center transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20 sm:py-14",
                  isDragging
                    ? "border-emerald-500 from-emerald-100/80 via-emerald-50 to-emerald-50/40 ring-4 ring-emerald-500/10"
                    : "border-zinc-300/80 from-emerald-50/80 via-white to-white hover:border-emerald-400 hover:from-emerald-100/60 hover:via-emerald-50/30"
                )}
              >
                <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(5,150,105,0.14)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />

                <span className="pointer-events-none relative mb-5 inline-flex">
                  <span
                    className={cx(
                      "absolute -inset-4 rounded-full blur-2xl transition duration-300",
                      isDragging ? "bg-emerald-300/70" : "bg-emerald-200/60 group-hover:bg-emerald-300/60"
                    )}
                  />
                  <span
                    className={cx(
                      "relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_14px_30px_-10px_rgba(5,150,105,0.7)] ring-4 ring-white transition duration-300",
                      isDragging ? "scale-110" : "group-hover:-translate-y-0.5"
                    )}
                  >
                    <UploadCloud className="h-7 w-7" />
                  </span>
                </span>

                <span className="pointer-events-none relative block text-base font-semibold tracking-tight text-zinc-900 sm:text-lg">
                  {isDragging ? "Let go to add your files" : "Drop photos or videos here"}
                </span>
                <span className="pointer-events-none relative mt-1 block text-sm text-zinc-500">
                  or{" "}
                  <span className="font-medium text-emerald-700 underline decoration-emerald-300 decoration-2 underline-offset-4 transition group-hover:decoration-emerald-600">
                    browse files
                  </span>
                </span>

                <span className="pointer-events-none relative mt-6 flex flex-wrap items-center justify-center gap-1.5">
                  {ACCEPTED_FORMATS.map((f) => (
                    <span
                      key={f}
                      className="rounded-md bg-white/90 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 ring-1 ring-inset ring-zinc-200"
                    >
                      {f}
                    </span>
                  ))}
                  <span className="text-[11px] text-zinc-400">· add several at once</span>
                </span>
              </button>

              {/* What happens next */}
              <div>
                <p className="mb-2 text-xs font-medium text-zinc-500">What happens next</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {nextSteps.map((step) => (
                    <div
                      key={step.title}
                      className="flex items-start gap-2.5 rounded-xl border border-zinc-200/80 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
                    >
                      <IconChip icon={step.icon} tone={step.tone} size="sm" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium text-zinc-900">{step.title}</p>
                        <p className="text-xs leading-snug text-zinc-500">{step.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Compact drop zone for adding more */}
              <button
                type="button"
                {...dragHandlers}
                onClick={() => fileInputRef.current?.click()}
                className={cx(
                  "group flex w-full items-center gap-3 rounded-xl border-2 border-dashed bg-gradient-to-r px-4 py-3 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-500/20",
                  isDragging
                    ? "border-emerald-500 from-emerald-100/70 to-emerald-50/40"
                    : "border-zinc-300/80 from-emerald-50/60 to-white hover:border-emerald-400 hover:from-emerald-100/50"
                )}
              >
                <span
                  className={cx(
                    "pointer-events-none flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 transition",
                    isDragging ? "ring-emerald-300" : "ring-zinc-200 group-hover:ring-emerald-200"
                  )}
                >
                  <Plus className="h-4 w-4" />
                </span>
                <span className="pointer-events-none min-w-0">
                  <span className="block text-sm font-medium text-zinc-900">
                    {isDragging ? "Let go to add your files" : "Add more files"}
                  </span>
                  <span className="block text-xs text-zinc-500">
                    Drop them here or{" "}
                    <span className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 group-hover:decoration-emerald-600">
                      browse
                    </span>
                  </span>
                </span>
              </button>

              {/* Selected files */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-zinc-900">Selected files</h3>
                  <span className="badge badge-neutral tabular-nums">{stagedFiles.length}</span>
                </div>
                <span className="text-xs tabular-nums text-zinc-500">{formatSize(totalBytes)} in total</span>
              </div>

              <ul className="space-y-3">
                {stagedFiles.map((item, index) => {
                  const dateMissing = !item.capturedAt && !item.exifChecking;
                  const active = item.status === "uploading" || item.status === "verifying";
                  return (
                    <li
                      key={item.id}
                      id={`staged-item-${index}`}
                      className={cx(
                        "overflow-hidden rounded-xl border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_1px_3px_rgba(16,24,40,0.04)] transition",
                        active
                          ? "border-emerald-300 ring-4 ring-emerald-500/[0.06]"
                          : item.status === "success"
                            ? "border-emerald-200"
                            : item.status === "error"
                              ? "border-red-200"
                              : "border-zinc-200/80"
                      )}
                    >
                      {/* File summary */}
                      <div className="relative flex items-start gap-3.5 p-3.5 sm:gap-4 sm:p-4">
                        <FileThumb item={item} />

                        <div className="min-w-0 flex-1 pr-8">
                          <p className="truncate text-sm font-medium text-zinc-900" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs tabular-nums text-zinc-500">
                            {item.resourceType === "video" ? (
                              <Video className="h-3.5 w-3.5 text-zinc-400" />
                            ) : (
                              <Camera className="h-3.5 w-3.5 text-zinc-400" />
                            )}
                            {item.resourceType === "video" ? "Video" : "Photo"}
                            <span className="text-zinc-300">·</span>
                            {formatSize(item.file.size)}
                          </p>
                          <div className="mt-2">
                            <FileStatus item={item} />
                          </div>

                          {item.status === "uploading" && (
                            <div
                              className="mt-2.5 h-1 max-w-xs overflow-hidden rounded-full bg-emerald-100"
                              role="progressbar"
                              aria-valuenow={item.progress}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          )}
                        </div>

                        {!batchUploading && (
                          <button
                            type="button"
                            id={`remove-staged-btn-${index}`}
                            onClick={() => handleRemoveStaged(item.id)}
                            aria-label={`Remove ${item.file.name}`}
                            title="Remove"
                            className="btn btn-ghost btn-sm btn-icon absolute right-2.5 top-2.5 text-zinc-400"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      {item.status === "error" && item.errorMessage && (
                        <div className="mx-3.5 mb-3.5 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-inset ring-red-600/10 sm:mx-4">
                          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                          {item.errorMessage}
                        </div>
                      )}

                      {/* Date, location and less common fields */}
                      <div className="space-y-3 border-t border-zinc-100 bg-zinc-50/60 px-3.5 py-3.5 sm:px-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className="mb-1.5 flex items-center justify-between gap-2">
                              <label
                                htmlFor={`staged-date-${index}`}
                                className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-700"
                              >
                                <CalendarDays className="h-3.5 w-3.5 text-sky-600" />
                                Date taken
                              </label>
                              {item.exifChecking ? (
                                <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                  Reading photo…
                                </span>
                              ) : item.hasExifDate ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-1.5 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-inset ring-sky-600/15">
                                  <Check className="h-3 w-3" />
                                  From photo
                                </span>
                              ) : null}
                            </div>
                            <input
                              id={`staged-date-${index}`}
                              type="date"
                              value={item.capturedAt}
                              onChange={(e) => updateStagedField(item.id, "capturedAt", e.target.value)}
                              disabled={batchUploading}
                              className={cx(
                                FIELD_CLASS,
                                dateMissing && "border-amber-300 focus:border-amber-400 focus:ring-amber-500/10"
                              )}
                            />
                            {dateMissing && (
                              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700">
                                <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
                                No date found. Add one so this can be compared over time.
                              </p>
                            )}
                          </div>

                          <div>
                            <label
                              htmlFor={`staged-location-${index}`}
                              className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-zinc-700"
                            >
                              <MapPin className="h-3.5 w-3.5 text-sky-600" />
                              Location
                            </label>
                            <input
                              id={`staged-location-${index}`}
                              type="text"
                              placeholder="e.g. Zone B-4"
                              value={item.manualLocation}
                              onChange={(e) => updateStagedField(item.id, "manualLocation", e.target.value)}
                              disabled={batchUploading}
                              className={FIELD_CLASS}
                            />
                          </div>
                        </div>

                        {/* Less common fields */}
                        <details className="group/file">
                          <summary className="flex min-w-0 cursor-pointer list-none items-center gap-1.5 rounded-md text-[13px] text-zinc-500 transition hover:text-zinc-900 [&::-webkit-details-marker]:hidden">
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 transition group-open/file:rotate-90" />
                            <Tag className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                            <span className="shrink-0 font-medium">Category and notes</span>
                            <span className="truncate text-zinc-400">
                              · {item.manualCategory || "Detected automatically"}
                              {item.manualNotes ? " · Note added" : ""}
                            </span>
                          </summary>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <label htmlFor={`staged-category-${index}`} className="label">
                                Category
                              </label>
                              <select
                                id={`staged-category-${index}`}
                                value={item.manualCategory}
                                onChange={(e) => updateStagedField(item.id, "manualCategory", e.target.value)}
                                disabled={batchUploading}
                                className={FIELD_CLASS}
                              >
                                <option value="">Detect automatically</option>
                                {CATEGORY_OPTIONS.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label htmlFor={`staged-notes-${index}`} className="label">
                                Notes
                              </label>
                              <input
                                id={`staged-notes-${index}`}
                                type="text"
                                placeholder="What does this show?"
                                value={item.manualNotes}
                                onChange={(e) => updateStagedField(item.id, "manualNotes", e.target.value)}
                                disabled={batchUploading}
                                className={FIELD_CLASS}
                              />
                            </div>
                          </div>
                        </details>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {/* Options that apply to the whole upload */}
              <details className="group/opts overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition hover:bg-zinc-50/70 [&::-webkit-details-marker]:hidden">
                  <IconChip icon={SlidersHorizontal} tone="zinc" size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-900">Upload settings</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {batchCategory ? `Category: ${batchCategory}` : "Category detected automatically"} ·{" "}
                      {autoVerify ? "Verify after upload" : "Verification off"}
                    </span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open/opts:rotate-180" />
                </summary>
                <div className="space-y-5 border-t border-zinc-100 px-4 py-4">
                  <div>
                    <label htmlFor="upload-batch-category" className="label">
                      Category for all files
                    </label>
                    <select
                      id="upload-batch-category"
                      value={batchCategory}
                      onChange={(e) => applyCategoryToAll(e.target.value)}
                      className={cx(FIELD_CLASS, "sm:max-w-xs")}
                    >
                      <option value="">Detect automatically</option>
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-xs text-zinc-500">
                      Replaces the category on every file in this upload.
                    </p>
                  </div>

                  <label className="flex cursor-pointer items-start justify-between gap-4">
                    <span className="flex items-start gap-3">
                      <IconChip icon={ShieldCheck} tone={autoVerify ? "emerald" : "zinc"} size="sm" />
                      <span>
                        <span className="block text-sm font-medium text-zinc-900">Verify each file after upload</span>
                        <span className="block text-xs leading-relaxed text-zinc-500">
                          Checks each file for signs of reuse or editing. Turn off to upload faster.
                        </span>
                      </span>
                    </span>
                    <span className="relative mt-1 inline-flex shrink-0">
                      <input
                        type="checkbox"
                        checked={autoVerify}
                        onChange={(e) => setAutoVerify(e.target.checked)}
                        className="peer sr-only"
                      />
                      <span className="h-5 w-9 rounded-full bg-zinc-200 transition peer-checked:bg-emerald-600 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-500/20" />
                      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm ring-1 ring-black/5 transition peer-checked:translate-x-4" />
                    </span>
                  </label>
                </div>
              </details>
            </>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        {/* Footer */}
        <div className="relative flex flex-col-reverse gap-3 border-t border-zinc-200/70 bg-white/95 px-6 py-3.5 shadow-[0_-12px_24px_-20px_rgba(16,24,40,0.35)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 sm:mr-auto">
            {stagedFiles.length === 0 ? (
              <p className="text-[13px] text-zinc-500">No files selected yet</p>
            ) : batchUploading ? (
              <div className="w-full sm:w-60">
                <p className="flex items-center justify-between gap-3 text-[13px]">
                  <span className="font-medium text-zinc-900">Uploading…</span>
                  <span className="tabular-nums text-zinc-500">
                    {successCount} of {stagedFiles.length} uploaded
                  </span>
                </p>
                <div
                  className="mt-1.5 h-1 overflow-hidden rounded-full bg-emerald-100"
                  role="progressbar"
                  aria-valuenow={batchPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${batchPercent}%` }}
                  />
                </div>
              </div>
            ) : allSuccess ? (
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                {plural(successCount, "file")} uploaded
              </p>
            ) : (
              <div>
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] tabular-nums text-zinc-500">
                  <span className="font-medium text-zinc-900">{plural(stagedFiles.length, "file")}</span>
                  {summaryParts.map((part) => (
                    <span key={part.text} className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="text-zinc-300">
                        ·
                      </span>
                      <span className={part.className}>{part.text}</span>
                    </span>
                  ))}
                </p>
                {errorCount > 0 && <p className="mt-0.5 text-xs text-zinc-500">You can try again.</p>}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              id="upload-modal-cancel-btn"
              onClick={onClose}
              disabled={batchUploading}
              className="btn btn-ghost"
            >
              {allSuccess ? "Close" : "Cancel"}
            </button>

            {stagedFiles.length > 0 && !allSuccess && (
              <button
                type="button"
                id="start-upload-btn"
                onClick={handleStartBatchUpload}
                disabled={batchUploading}
                className="btn btn-primary"
              >
                {batchUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {batchUploading ? "Uploading…" : `Upload ${plural(pendingCount, "file")}`}
              </button>
            )}

            {allSuccess && (
              <button
                type="button"
                id="upload-complete-close-btn"
                onClick={onClose}
                className="btn btn-primary"
              >
                <Check className="h-4 w-4" />
                View uploads
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
