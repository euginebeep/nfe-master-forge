import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Arquivo } from "@/types/erp";
import { toast } from "sonner";

export function useUploadFile() {
  return useMutation({
    mutationFn: async ({
      file,
      sensivel = false,
    }: {
      file: File;
      sensivel?: boolean;
    }): Promise<Arquivo> => {
      const ext = file.name.split(".").pop() || "";
      const storageKey = `${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("erp-files")
        .upload(storageKey, file);

      if (uploadError) throw uploadError;

      const { data: arquivo, error: insertError } = await supabase
        .from("arquivos")
        .insert({
          nome_original: file.name,
          mime_type: file.type,
          tamanho: file.size,
          storage_key: storageKey,
          sensivel,
        } as any)
        .select()
        .single();

      if (insertError) throw insertError;

      return arquivo as Arquivo;
    },
    onError: (error) => {
      toast.error("Erro no upload: " + error.message);
    },
  });
}

export function useDownloadFile() {
  return useMutation({
    mutationFn: async (arquivo: Arquivo) => {
      const { data, error } = await supabase.storage
        .from("erp-files")
        .download(arquivo.storage_key);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = arquivo.nome_original;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (error) => {
      toast.error("Erro no download: " + error.message);
    },
  });
}

export function useGetFileUrl() {
  return useMutation({
    mutationFn: async (storageKey: string) => {
      const { data } = supabase.storage
        .from("erp-files")
        .getPublicUrl(storageKey);

      return data.publicUrl;
    },
  });
}
