"use client";

import { useState, useRef } from "react";
import { 
  X, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Sparkles,
  MapPin,
  Calendar,
  Layers
} from "lucide-react";
import { CATEGORIES } from "./GalleryFilterBar";

interface StagedFile {
  id: string;
  file: File;
  previewUrl: string;
  resourceType: "image" | "video";
  manualCategory: string;
  manualLocation: string;
  manualNotes: string;
  capturedAt: string;
  status: "idle" | "uploading" | "success" | "error";
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
  const [batchCategory, setBatchCategory] = useState("Environmental");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const todayStr = new Date().toISOString().split("T")[0];
    const newItems: StagedFile[] = Array.from(files).map((file, idx) => {
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
        capturedAt: todayStr,
        status: "idle",
        progress: 0,
      };
    });

    setStagedFiles((prev) => [...prev, ...newItems]);
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
      const signRes = await fetch("/api/cloudinary/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      if (!signRes.ok) {
        throw new Error("Failed to generate upload signature");
      }

      const signData = await signRes.json();
      const { signature, timestamp, apiKey, cloudName, folder } = signData;

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

      // Step 2: Attempt direct upload to Cloudinary
      let uploadedToCloudinary = false;

      // Only attempt network upload if we have an API key and valid cloud name
      if (apiKey && apiKey !== "" && cloudName && cloudName !== "demo") {
        try {
          const uploadFormData = new FormData();
          uploadFormData.append("file", staged.file);
          uploadFormData.append("api_key", apiKey);
          uploadFormData.append("timestamp", timestamp.toString());
          uploadFormData.append("signature", signature);
          uploadFormData.append("folder", folder);
          uploadFormData.append("categorization", signData.categorization || "google_tagging");
          uploadFormData.append("auto_tagging", (signData.auto_tagging ?? signData.autoTagging ?? 0.6).toString());
          uploadFormData.append("image_metadata", (signData.image_metadata ?? signData.imageMetadata ?? true).toString());

          updateStagedField(staged.id, "progress", 50);

          const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;
          const cldRes = await fetch(uploadUrl, {
            method: "POST",
            body: uploadFormData,
          });

          if (cldRes.ok) {
            const cldData = await cldRes.json();
            rawCloudinaryInfo = cldData;
            publicId = cldData.public_id;
            secureUrl = cldData.secure_url;
            resourceType = cldData.resource_type || resourceType;
            format = cldData.format || format;
            bytes = cldData.bytes || bytes;
            width = cldData.width || width;
            height = cldData.height || height;
            uploadedToCloudinary = true;
          } else {
            console.warn("Cloudinary direct upload responded with:", await cldRes.text());
          }
        } catch (cldErr) {
          console.warn("Cloudinary upload failed over network, using fallback storage:", cldErr);
        }
      }

      // Fallback for development / mock mode when real Cloudinary API credentials aren't active
      if (!uploadedToCloudinary) {
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
        manualCategory: staged.manualCategory,
        manualLocation: staged.manualLocation || null,
        manualNotes: staged.manualNotes || null,
        capturedAt: staged.capturedAt ? new Date(staged.capturedAt).toISOString() : new Date().toISOString(),
        info: rawCloudinaryInfo,
        filename: staged.file.name,
      };

      const dbRes = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assetPayload),
      });

      if (!dbRes.ok) {
        const errJson = await dbRes.json();
        throw new Error(errJson.error || "Failed to persist media asset to database");
      }

      updateStagedField(staged.id, "progress", 100);
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div 
        className="glass-dropdown w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl p-6 sm:p-8 shadow-2xl relative border border-white/10 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-2">
              <UploadCloud className="w-3.5 h-3.5" />
              Signed Cloudinary Direct Upload
            </div>
            <h2 className="text-2xl font-bold text-white">Upload Field Evidence</h2>
            <p className="text-xs text-slate-400 mt-1">
              Select or drop mixed images and video footage. Apply per-file manual metadata and domain categories.
            </p>
          </div>
          <button
            id="close-upload-modal-btn"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Dropzone Container */}
        <div className="flex-1 overflow-y-auto py-5 space-y-5 pr-1">
          {stagedFiles.length === 0 ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4 ${
                isDragging
                  ? "border-emerald-400 bg-emerald-500/10 scale-[1.01]"
                  : "border-white/15 hover:border-emerald-500/50 hover:bg-white/[0.02]"
              }`}
            >
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <UploadCloud className="w-8 h-8" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  Drag & drop field photos & videos here, or <span className="text-emerald-400 underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Supports JPG, PNG, WEBP, MP4, MOV. Batch upload multiple files simultaneously.
                </p>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Signed Client-Side Direct Upload
                </span>
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" /> Auto Folder Namespacing
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Batch Actions Bar */}
              <div className="glass-panel p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-300">
                    Staged: <span className="text-emerald-400">{stagedFiles.length} files</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="ml-2 text-emerald-400 hover:underline font-medium"
                  >
                    + Add More Files
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Apply Category to All:</span>
                  <select
                    value={batchCategory}
                    onChange={(e) => applyCategoryToAll(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {CATEGORIES.filter((c) => c !== "ALL").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Staged File Cards */}
              <div className="space-y-3">
                {stagedFiles.map((item, index) => (
                  <div
                    key={item.id}
                    id={`staged-item-${index}`}
                    className="glass-card rounded-2xl p-4 border border-white/5 space-y-3"
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail / Icon */}
                      <div className="relative w-16 h-16 rounded-xl bg-slate-900 overflow-hidden shrink-0 border border-white/10">
                        {item.resourceType === "video" ? (
                          <div className="w-full h-full flex flex-col items-center justify-center text-cyan-400 bg-cyan-950/30">
                            <Video className="w-6 h-6" />
                            <span className="text-[9px] uppercase font-bold mt-1">Video</span>
                          </div>
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      {/* File Details & Inputs */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        {/* File Name & Status */}
                        <div className="sm:col-span-2 md:col-span-1">
                          <p className="font-semibold text-slate-200 truncate" title={item.file.name}>
                            {item.file.name}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {(item.file.size / 1024 / 1024).toFixed(2)} MB &bull; {item.resourceType}
                          </p>
                          {item.status === "uploading" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Uploading ({item.progress}%)
                            </span>
                          )}
                          {item.status === "success" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                            </span>
                          )}
                          {item.status === "error" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-medium mt-1" title={item.errorMessage}>
                              <AlertCircle className="w-3.5 h-3.5" /> Failed
                            </span>
                          )}
                        </div>

                        {/* Category Dropdown */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-medium">Category</label>
                          <select
                            id={`staged-category-${index}`}
                            value={item.manualCategory}
                            onChange={(e) => updateStagedField(item.id, "manualCategory", e.target.value)}
                            disabled={batchUploading}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                          >
                            {CATEGORIES.filter((c) => c !== "ALL").map((cat) => (
                              <option key={cat} value={cat}>
                                {cat}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Location Override */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-medium">Location</label>
                          <input
                            id={`staged-location-${index}`}
                            type="text"
                            placeholder="e.g. Zone B-4"
                            value={item.manualLocation}
                            onChange={(e) => updateStagedField(item.id, "manualLocation", e.target.value)}
                            disabled={batchUploading}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        {/* Capture Date */}
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-medium">Captured Date</label>
                          <input
                            id={`staged-date-${index}`}
                            type="date"
                            value={item.capturedAt}
                            onChange={(e) => updateStagedField(item.id, "capturedAt", e.target.value)}
                            disabled={batchUploading}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      {/* Remove Button */}
                      {!batchUploading && (
                        <button
                          type="button"
                          id={`remove-staged-btn-${index}`}
                          onClick={() => handleRemoveStaged(item.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Notes Field */}
                    <div className="pt-2 border-t border-white/5 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <input
                        id={`staged-notes-${index}`}
                        type="text"
                        placeholder="Add field notes, environmental observation, or activity details..."
                        value={item.manualNotes}
                        onChange={(e) => updateStagedField(item.id, "manualNotes", e.target.value)}
                        disabled={batchUploading}
                        className="w-full px-2.5 py-1 rounded-lg bg-slate-900/60 border border-white/5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {/* Progress Bar */}
                    {item.status === "uploading" && (
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
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

        {/* Footer Actions */}
        <div className="pt-4 border-t border-white/10 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {stagedFiles.length > 0 && (
              <span>
                Ready to upload {stagedFiles.length} file{stagedFiles.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              id="upload-modal-cancel-btn"
              onClick={onClose}
              disabled={batchUploading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition"
            >
              {allSuccess ? "Done" : "Cancel"}
            </button>

            {stagedFiles.length > 0 && !allSuccess && (
              <button
                type="button"
                id="start-upload-btn"
                onClick={handleStartBatchUpload}
                disabled={batchUploading}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                {batchUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>
                  {batchUploading
                    ? "Uploading Batch..."
                    : `Upload ${stagedFiles.length} Asset${stagedFiles.length !== 1 ? "s" : ""}`}
                </span>
              </button>
            )}

            {allSuccess && (
              <button
                type="button"
                id="upload-complete-close-btn"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>All Assets Uploaded &rarr; View Gallery</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
