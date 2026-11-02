"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { discardScreenshot, prepareScreenshotUpload } from "../actions";

const MAX_SIDE = 1600;
const MAX_BYTES = 5 * 1024 * 1024; // matches the bucket's file_size_limit

// Shrinks phone screenshots (often 2–4 MB) to a crisp JPEG under ~500 KB.
// Returns null if the browser can't decode the image (e.g. HEIC outside Safari).
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  } catch {
    return null;
  }
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/heic": "heic" };

export function ScreenshotPicker({
  path, onChange, onUploading, error,
}: { path: string; onChange: (path: string) => void; onUploading: (busy: boolean) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    setProblem(null);
    setBusy(true);
    onUploading(true);
    try {
      const body = (await shrink(file)) ?? file;
      const type = body.type || file.type;
      if (!EXT[type]) throw new Error("Use a PNG, JPEG, WebP or HEIC image.");
      if (body.size > MAX_BYTES) throw new Error("That image is over 5 MB.");

      const { path: next, token } = await prepareScreenshotUpload(EXT[type]);
      const { error } = await createClient()
        .storage.from("screenshots")
        .uploadToSignedUrl(next, token, body, { contentType: type });
      if (error) throw error;

      if (path) await discardScreenshot(path);
      onChange(next);
      setPreview(URL.createObjectURL(body));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      onUploading(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (path) await discardScreenshot(path);
    onChange("");
    setPreview(null);
  }

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        id="screenshot"
        onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
      />
      {preview ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
          <img src={preview} alt="Screenshot preview" className="h-20 w-20 rounded-lg border border-line object-cover" />
          <div className="flex flex-col items-start gap-1 text-sm">
            <span className="font-medium text-good">✓ Screenshot attached</span>
            <button type="button" className="text-muted underline" onClick={remove}>
              Remove
            </button>
          </div>
        </div>
      ) : (
        <label htmlFor="screenshot" className="btn-ghost w-full cursor-pointer gap-2 text-sm">
          {busy ? "Uploading…" : <><span aria-hidden>📷</span>Add a screenshot (optional)</>}
        </label>
      )}
      {(problem || error) && <p className="mt-1 text-xs text-bad">{problem ?? error}</p>}
    </div>
  );
}
