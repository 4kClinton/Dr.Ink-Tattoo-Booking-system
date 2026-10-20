"use client";
import { api } from "@drink/backend/api";
import type { Id } from "@drink/backend/dataModel";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGES_PER_TATTOO } from "@drink/shared";
import { useMutation } from "convex/react";
import { ImagePlus, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";

export interface Thumb {
  id: Id<"_storage"> | string; // string = local pending key
  url: string;
  progress?: number; // 0–1 while uploading
}

/** Compress (2048px long edge, JPEG 0.8) then POST to a Convex upload URL with progress (TRD §7). */
async function compress(file: File): Promise<Blob> {
  if (file.type === "image/heic" || file.type === "image/heif") return file; // browsers can't decode HEIC; upload as-is
  const { default: imageCompression } = await import("browser-image-compression");
  return imageCompression(file, { maxWidthOrHeight: 2048, initialQuality: 0.8, fileType: "image/jpeg", useWebWorker: true });
}

function upload(url: string, blob: Blob, onProgress: (p: number) => void): Promise<Id<"_storage">> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Content-Type", blob.type || "image/jpeg");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve(JSON.parse(xhr.responseText).storageId) : reject(new Error(String(xhr.status))));
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(blob);
  });
}

function Ring({ p }: { p: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="size-9 -rotate-90" aria-label={`${Math.round(p * 100)}% uploaded`}>
      <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <circle cx="18" cy="18" r={r} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
    </svg>
  );
}

export function ImageUploader({
  thumbs,
  onUploaded,
  onRemove,
  max = MAX_IMAGES_PER_TATTOO,
  altPrefix,
  canRemove = true,
  readOnly = false,
}: {
  thumbs: Thumb[];
  onUploaded: (ids: Id<"_storage">[], previews: Thumb[]) => void | Promise<void>;
  onRemove?: (id: Id<"_storage">) => void;
  max?: number;
  altPrefix: string;
  canRemove?: boolean;
  readOnly?: boolean;
}) {
  const genUrl = useMutation(api.tattoos.generateUploadUrl);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Thumb[]>([]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files].slice(0, Math.max(0, max - thumbs.length));
    if (list.length < files.length) toast(`Up to ${max} images.`);
    const done: { id: Id<"_storage">; url: string }[] = [];
    await Promise.all(
      list.map(async (file, i) => {
        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
          toast(`${file.name}: only JPEG, PNG, HEIC or WebP.`);
          return;
        }
        const key = `p${Date.now()}${i}`;
        const preview = URL.createObjectURL(file);
        setPending((p) => [...p, { id: key, url: preview, progress: 0 }]);
        try {
          const blob = await compress(file);
          const url = await genUrl();
          const id = await upload(url, blob, (pr) => setPending((p) => p.map((t) => (t.id === key ? { ...t, progress: pr } : t))));
          done.push({ id, url: preview });
        } catch {
          toast(`Couldn't upload ${file.name}. Try again.`);
        } finally {
          setPending((p) => p.filter((t) => t.id !== key));
        }
      }),
    );
    if (done.length) await onUploaded(done.map((d) => d.id), done);
    if (input.current) input.current.value = "";
  }

  const all = [...thumbs, ...pending];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {all.map((t, i) => (
        <div key={String(t.id)} className="relative size-[72px] shrink-0 overflow-hidden rounded-md border border-line bg-hover">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.url} alt={`${altPrefix} ${i + 1}`} className="size-full object-cover" />
          {t.progress !== undefined && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <Ring p={t.progress} />
            </div>
          )}
          {t.progress === undefined && canRemove && onRemove && (
            <button
              type="button"
              onClick={() => onRemove(t.id as Id<"_storage">)}
              className="absolute top-1 right-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
              aria-label={`Remove ${altPrefix} ${i + 1}`}
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      ))}
      {all.length < max && !readOnly && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={cn(
            "tap flex size-[72px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-line-strong text-caption text-fg-2 hover:bg-hover",
          )}
        >
          <ImagePlus className="size-5" aria-hidden />
          Add
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        multiple
        hidden
        onChange={(e) => void onFiles(e.target.files)}
      />
    </div>
  );
}
