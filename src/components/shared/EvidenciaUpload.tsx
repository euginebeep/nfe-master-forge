import { useState, useRef } from "react";
import { ImagePlus, X, Loader2, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export interface AnexoFile {
  id: string;
  url: string;
  storage_path?: string;
  nome: string;
  tamanho: number;
  tipo: string;
  created_at: string;
}

interface EvidenciaUploadProps {
  anexos: AnexoFile[];
  onChange: (anexos: AnexoFile[]) => void;
  disabled?: boolean;
  pasta: string; // e.g. "desvios/contencao"
  maxFiles?: number;
}

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY = 0.6; // 60% JPEG quality — very light

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao comprimir"))),
        "image/jpeg",
        QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Imagem inválida"));
    };
    img.src = url;
  });
}

export function EvidenciaUpload({ anexos, onChange, disabled, pasta, maxFiles = 10 }: EvidenciaUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (anexos.length + files.length > maxFiles) {
      toast.error(`Máximo de ${maxFiles} arquivos permitidos`);
      return;
    }
    setUploading(true);
    const novos: AnexoFile[] = [];

    for (const file of Array.from(files)) {
      try {
        const isImage = file.type.startsWith("image/");
        const blob = isImage ? await compressImage(file) : file;
        const ext = isImage ? "jpg" : file.name.split(".").pop() || "bin";
        const path = `${pasta}/${crypto.randomUUID()}.${ext}`;

        const { error } = await supabase.storage
          .from("erp-files")
          .upload(path, blob, { contentType: isImage ? "image/jpeg" : file.type });

        if (error) throw error;

        // Bucket is private — use signed URL (valid 10 years)
        const { data: signedData, error: signError } = await supabase.storage
          .from("erp-files")
          .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);

        if (signError || !signedData?.signedUrl) throw signError || new Error("URL error");

        novos.push({
          id: crypto.randomUUID(),
          url: signedData.signedUrl,
          storage_path: path,
          nome: file.name,
          tamanho: blob.size,
          tipo: isImage ? "image/jpeg" : file.type,
          created_at: new Date().toISOString(),
        });
      } catch (err: any) {
        console.error("Upload error:", err);
        toast.error(`Erro ao enviar ${file.name}`);
      }
    }

    if (novos.length > 0) {
      onChange([...anexos, ...novos]);
      toast.success(`${novos.length} arquivo(s) enviado(s)`);
    }
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remover = (id: string) => {
    onChange(anexos.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {anexos.map((a) => {
          const isImg = a.tipo.startsWith("image/");
          return (
            <div key={a.id} className="relative group rounded-lg border overflow-hidden w-24 h-24 bg-muted">
              {isImg ? (
                <img
                  src={a.url}
                  alt={a.nome}
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setPreview(a.url)}
                  loading="lazy"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-1 text-center break-all">
                  {a.nome}
                </div>
              )}
              {!disabled && (
                <button
                  onClick={() => remover(a.id)}
                  className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              {isImg && (
                <button
                  onClick={() => setPreview(a.url)}
                  className="absolute bottom-0.5 right-0.5 bg-background/80 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ZoomIn className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}

        {!disabled && anexos.length < maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary hover:text-primary transition-colors",
              uploading && "opacity-50 cursor-wait"
            )}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            <span className="text-[10px]">{uploading ? "Enviando..." : "Adicionar"}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl p-2">
          {preview && <img src={preview} alt="Evidência" className="w-full rounded" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
