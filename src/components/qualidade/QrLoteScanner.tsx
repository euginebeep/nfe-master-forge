import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
};

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

/** Lê lote da etiqueta via câmera (BarcodeDetector) quando o browser suporta. */
export function QrLoteScannerButton({ onRead }: { onRead: (lote: string) => void }) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && !!window.BarcodeDetector);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let raf = 0;

    (async () => {
      try {
        if (!window.BarcodeDetector) {
          toast.error("Leitura por câmera não suportada neste navegador.");
          setOpen(false);
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();

        const detector = new window.BarcodeDetector({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "data_matrix"],
        });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue?.trim();
            if (raw) {
              // Etiqueta pode trazer URL/hash — extrair último token alfanumérico-hífen
              const match = raw.match(/[A-Za-z0-9][A-Za-z0-9._/-]{3,}/);
              const lote = (match?.[0] || raw).replace(/^.*\//, "");
              onRead(lote);
              setOpen(false);
              return;
            }
          } catch {
            /* frame vazio */
          }
          raf = requestAnimationFrame(() => {
            void tick();
          });
        };
        raf = requestAnimationFrame(() => {
          void tick();
        });
      } catch (e: any) {
        toast.error(e?.message || "Não foi possível abrir a câmera");
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onRead]);

  if (!supported) {
    return null;
  }

  return (
    <>
      <Button type="button" variant="outline" size="icon" title="Ler QR da etiqueta" onClick={() => setOpen(true)}>
        <Camera className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              Ler etiqueta
              <Button size="icon" variant="ghost" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              Aponte para o QR / código de barras do lote. O dossiê abre ao reconhecer.
            </DialogDescription>
          </DialogHeader>
          <video ref={videoRef} className="w-full rounded-md bg-black aspect-square object-cover" muted playsInline />
        </DialogContent>
      </Dialog>
    </>
  );
}
