import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { Plus, Trash2, Download, FileText, Upload } from "lucide-react";
import { format } from "date-fns";
import { TIPO_DOCUMENTO_LABELS, type TipoDocumentoEntidade, type EntidadeDocumento } from "@/types/entidades";

interface DocumentosTabProps {
  documentos: EntidadeDocumento[];
  onUpload: (file: File, tipo: string, observacoes?: string) => void;
  onDelete: (id: string, storageKey: string) => void;
  onDownload: (storageKey: string, fileName: string) => void;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function DocumentosTab({ documentos, onUpload, onDelete, onDownload }: DocumentosTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipo, setTipo] = useState<string>('OUTRO');
  const [observacoes, setObservacoes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = () => {
    if (selectedFile) {
      onUpload(selectedFile, tipo, observacoes);
      setDialogOpen(false);
      setSelectedFile(null);
      setTipo('OUTRO');
      setObservacoes('');
    }
  };

  const openUploadDialog = () => {
    setSelectedFile(null);
    setTipo('OUTRO');
    setObservacoes('');
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Documentos</h3>
        <Button size="sm" onClick={openUploadDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Enviar Documento
        </Button>
      </div>

      {documentos.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border rounded-md">
          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum documento anexado</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Arquivo</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documentos.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <StatusBadge variant="default">
                    {TIPO_DOCUMENTO_LABELS[doc.tipo as TipoDocumentoEntidade] || doc.tipo}
                  </StatusBadge>
                </TableCell>
                <TableCell className="font-medium">{doc.nome_arquivo}</TableCell>
                <TableCell className="text-muted-foreground">
                  {doc.tamanho_bytes ? formatBytes(doc.tamanho_bytes) : '-'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(doc.created_at), 'dd/MM/yyyy HH:mm')}
                </TableCell>
                <TableCell className="text-muted-foreground max-w-48 truncate">
                  {doc.observacoes || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onDownload(doc.storage_key, doc.nome_arquivo)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => onDelete(doc.id, doc.storage_key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enviar Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Documento</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_DOCUMENTO_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div 
                className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-6 w-6" />
                    <span>{selectedFile.name}</span>
                    <span className="text-muted-foreground">({formatBytes(selectedFile.size)})</span>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Upload className="h-8 w-8 mx-auto mb-2" />
                    <p>Clique para selecionar um arquivo</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                rows={2}
                placeholder="Informações adicionais sobre o documento"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleUpload} disabled={!selectedFile}>
                <Upload className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
