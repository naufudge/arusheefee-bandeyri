"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import SignaturePad from "signature_pad";
import { Eraser, Pencil, Save, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

interface Props {
  /** Parent handles the actual fetch + toast + post-save behaviour. */
  onSave: (file: File) => Promise<void> | void;
  /** Disables every interactive control. Parent toggles this around its upload call. */
  busy?: boolean;
  /** Initial mode — defaults to "draw". */
  defaultMode?: "draw" | "upload";
}

type Mode = "draw" | "upload";

export function SignatureEditor({
  onSave,
  busy = false,
  defaultMode = "draw",
}: Props) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const [mode, setMode] = useState<Mode>(defaultMode);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Re-fit the canvas backing store to its CSS size + DPR. signature_pad
  // doesn't re-scale on resize automatically; we have to wipe + rescale
  // ourselves and we lose any in-progress strokes when we do.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const pad = padRef.current;
    if (!canvas || !pad) return;
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    pad.clear();
    setHasStrokes(false);
  }, []);

  // Init / teardown the pad when the Draw tab is active. Using
  // useLayoutEffect so the canvas has a measured size before we resize
  // (avoids a one-frame "zero-sized" flash on mount).
  useLayoutEffect(() => {
    if (mode !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePad(canvas, {
      // Transparent background so the exported PNG composes cleanly
      // over whatever surface displays it later.
      backgroundColor: "rgba(0,0,0,0)",
      penColor: "rgb(15, 23, 42)",
      minWidth: 0.7,
      maxWidth: 2.2,
    });
    padRef.current = pad;

    // Track empty/non-empty so the Save button can disable cleanly.
    pad.addEventListener("endStroke", () => setHasStrokes(!pad.isEmpty()));

    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      pad.off();
      padRef.current = null;
    };
  }, [mode, resizeCanvas]);

  // Reset the empty-state flag every time the user switches tabs so
  // the Save button starts disabled on a fresh canvas.
  useEffect(() => {
    if (mode === "draw") setHasStrokes(false);
  }, [mode]);

  const validateFile = (file: File): boolean => {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Not an image", description: "Pick a PNG or JPG." });
      return false;
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      toast({ title: "Image too large", description: "Keep it under 2 MB." });
      return false;
    }
    return true;
  };

  const handleClear = () => {
    padRef.current?.clear();
    setHasStrokes(false);
  };

  const handleSaveDrawing = async () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      toast({
        title: "Nothing drawn yet",
        description: "Sign on the panel above first.",
      });
      return;
    }
    const dataUrl = pad.toDataURL("image/png");
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "signature.png", { type: "image/png" });
    await onSave(file);
    pad.clear();
    setHasStrokes(false);
  };

  const handleUploadClick = () => inputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!validateFile(file)) return;
    await onSave(file);
  };

  const ModeButton: React.FC<{
    value: Mode;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ value, icon, children }) => (
    <button
      type="button"
      onClick={() => setMode(value)}
      disabled={busy}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        mode === value
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Mode toggle (segmented control) */}
      <div
        role="tablist"
        aria-label="Signature input mode"
        className="inline-flex w-full items-center gap-1 rounded-md border bg-muted/50 p-0.5"
      >
        <ModeButton value="draw" icon={<Pencil className="size-3.5" />}>
          Draw
        </ModeButton>
        <ModeButton value="upload" icon={<Upload className="size-3.5" />}>
          Upload
        </ModeButton>
      </div>

      {/* Signature panel — same chrome (aspect, corner ticks) regardless of mode */}
      <div className="relative aspect-[5/3] w-full overflow-hidden rounded-md border bg-muted/30">
        <span className="pointer-events-none absolute left-2 top-2 size-2.5 border-l border-t border-muted-foreground/40" />
        <span className="pointer-events-none absolute right-2 top-2 size-2.5 border-r border-t border-muted-foreground/40" />
        <span className="pointer-events-none absolute bottom-2 left-2 size-2.5 border-b border-l border-muted-foreground/40" />
        <span className="pointer-events-none absolute bottom-2 right-2 size-2.5 border-b border-r border-muted-foreground/40" />

        {mode === "draw" ? (
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none cursor-crosshair"
            aria-label="Signature canvas"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-end pb-8">
            <div className="flex w-3/4 items-end gap-2 text-muted-foreground/70">
              <span className="text-lg leading-none">×</span>
              <div className="mb-1 h-px flex-1 bg-muted-foreground/40" />
            </div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Sign here
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input — shared between any Upload trigger */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-2">
        {mode === "draw" ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleClear}
              disabled={busy || !hasStrokes}
            >
              <Eraser className="size-3.5" />
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveDrawing}
              disabled={busy || !hasStrokes}
            >
              <Save className="size-3.5" />
              {busy ? "Saving…" : "Save signature"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={handleUploadClick}
            disabled={busy}
          >
            <Upload className="size-3.5" />
            {busy ? "Uploading…" : "Upload signature"}
          </Button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          PNG or JPG, up to 2 MB
        </span>
      </div>
    </div>
  );
}
