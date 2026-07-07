import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Arquivo } from "@/types/erp";
import { toast } from "sonner";
import { getUserCompanyId } from "@/hooks/use-user-company";

export function useUploadFile() {
  return useMutation({
    mutationFn: async ({
      file,
      sensivel = false,
    }: {
      file: File;
      sensivel?: boolean;
    }): Promise<Arquivo> => {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error("Empresa não identificada");

      const ext = file.name.split(".").pop() || "";
      const storageKey = `${companyId}/arquivos/${crypto.randomUUID()}.${ext}`;

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
          company_id: companyId,
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

const SIGNED_URL_TTL_SEG = 3600;

/** Gera signed URL para arquivo no bucket privado erp-files */
export async function createSignedFileUrl(
  storageKey: string,
  expiresIn = SIGNED_URL_TTL_SEG
): Promise<string> {
  const key = storageKey?.trim();
  if (!key) throw new Error('Arquivo sem chave de storage');

  const { data, error } = await supabase.storage
    .from('erp-files')
    .createSignedUrl(key, expiresIn);

  if (error) throw error;
  if (!data?.signedUrl) throw new Error('URL assinada não gerada');
  return data.signedUrl;
}

/** Abre arquivo em nova aba via signed URL */
export async function abrirArquivoEmNovaAba(storageKey: string): Promise<void> {
  const url = await createSignedFileUrl(storageKey);
  const aba = window.open(url, '_blank', 'noopener,noreferrer');
  if (!aba) throw new Error('Pop-up bloqueado pelo navegador');
}
