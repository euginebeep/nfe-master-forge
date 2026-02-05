import { useState, useRef } from 'react';
import { Image, Upload, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCapsulePhoto } from '@/hooks/use-capsule-photo';

interface CapsulePhotoUploadProps {
  itemId?: string;
  currentPhotoUrl?: string;
  onPhotoChange: (url: string | undefined, storageKey: string | undefined) => void;
  disabled?: boolean;
}

export function CapsulePhotoUpload({ 
  itemId, 
  currentPhotoUrl, 
  onPhotoChange,
  disabled 
}: CapsulePhotoUploadProps) {
  const { uploadPhoto, deletePhoto, uploading } = useCapsulePhoto();
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(currentPhotoUrl);
  const [currentStorageKey, setCurrentStorageKey] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview imediato
    const reader = new FileReader();
    reader.onload = (event) => {
      setPreviewUrl(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload para Supabase
    const tempId = itemId || `temp-${Date.now()}`;
    const result = await uploadPhoto(file, tempId);
    
    if (result) {
      setPreviewUrl(result.url);
      setCurrentStorageKey(result.storageKey);
      onPhotoChange(result.url, result.storageKey);
    } else {
      // Rollback preview em caso de erro
      setPreviewUrl(currentPhotoUrl);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    if (currentStorageKey) {
      await deletePhoto(currentStorageKey);
    }
    setPreviewUrl(undefined);
    setCurrentStorageKey(undefined);
    onPhotoChange(undefined, undefined);
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || uploading}
      />

      {previewUrl ? (
        <div className="relative group">
          <img 
            src={previewUrl} 
            alt="Foto da cápsula" 
            className="w-full h-32 object-cover rounded-lg border"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button 
              type="button"
              size="sm" 
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4" />
            </Button>
            <Button 
              type="button"
              size="sm" 
              variant="destructive"
              onClick={handleRemove}
              disabled={uploading}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <Button 
          type="button"
          variant="outline" 
          className="w-full h-32 flex flex-col gap-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Enviando...</span>
            </>
          ) : (
            <>
              <Image className="h-6 w-6" />
              <span className="text-sm">Adicionar Foto</span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
