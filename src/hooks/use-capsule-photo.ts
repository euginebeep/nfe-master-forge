import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UploadResult {
  url: string;
  storageKey: string;
}

export function useCapsulePhoto() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadPhoto = useCallback(async (
    file: File, 
    itemId: string
  ): Promise<UploadResult | null> => {
    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo deve ser uma imagem');
      return null;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast.error('A imagem deve ter no máximo 5MB');
      return null;
    }

    setUploading(true);
    setProgress(0);

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storageKey = `capsulas/${itemId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('erp-files')
        .upload(storageKey, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      setProgress(100);

      const { data: urlData } = supabase.storage
        .from('erp-files')
        .getPublicUrl(storageKey);

      toast.success('Foto enviada com sucesso');
      
      return {
        url: urlData.publicUrl,
        storageKey,
      };
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao enviar foto: ' + error.message);
      return null;
    } finally {
      setUploading(false);
    }
  }, []);

  const deletePhoto = useCallback(async (storageKey: string): Promise<boolean> => {
    try {
      const { error } = await supabase.storage
        .from('erp-files')
        .remove([storageKey]);

      if (error) throw error;

      toast.success('Foto removida');
      return true;
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error('Erro ao remover foto: ' + error.message);
      return false;
    }
  }, []);

  const getPhotoUrl = useCallback((storageKey: string): string => {
    const { data } = supabase.storage
      .from('erp-files')
      .getPublicUrl(storageKey);
    
    return data.publicUrl;
  }, []);

  return {
    uploadPhoto,
    deletePhoto,
    getPhotoUrl,
    uploading,
    progress,
  };
}
