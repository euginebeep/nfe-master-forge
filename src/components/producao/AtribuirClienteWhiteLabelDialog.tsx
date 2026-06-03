import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package, Upload, X } from "lucide-react";

interface ClienteOption {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  documento: string;
}

interface AtribuirClienteWhiteLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loteId: string;
  loteNumero?: string;
  produtoNome?: string;
  onSuccess?: () => void;
}

export function AtribuirClienteWhiteLabelDialog({
  open, onOpenChange, loteId, loteNumero, produtoNome, onSuccess,
}: AtribuirClienteWhiteLabelDialogProps) {
  const [busca, setBusca] = useState("");
  const [clientes, setClientes] = useState<ClienteOption[]>([]);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteOption | null>(null);
  const [marcaCliente, setMarcaCliente] = useState("");
  const [rotuloFile, setRotuloFile] = useState<File | null>(null);
  const [rotuloUrl, setRotuloUrl] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      setBusca(""); setClientes([]); setClienteSelecionado(null);
      setMarcaCliente(""); setRotuloFile(null); setRotuloUrl("");
    }
  }, [open]);

  useEffect(() => {
    if (busca.length < 2) { setClientes([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento")
        .or(`razao_social.ilike.%${busca}%,nome_fantasia.ilike.%${busca}%,documento.ilike.%${busca}%`)
        .eq("status", "ATIVO")
        .limit(10);
      setClientes((data as ClienteOption[]) || []);
    }, 300);
    return () => clearTimeout(t);
  }, [busca]);

  const handleUploadRotulo = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `white-label-rotulos/${loteId}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("erp-files").upload(path, file, { contentType: file.type });
      if (error) throw error;
      const { data: signed, error: signErr } = await supabase.storage
        .from("erp-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !signed?.signedUrl) throw signErr || new Error("URL error");
      setRotuloUrl(signed.signedUrl);
      setRotuloFile(file);
      toast.success("Rótulo enviado.");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao enviar rótulo.");
    } finally {
      setUploading(false);
    }
  };

  const handleSalvar = async () => {
    if (!clienteSelecionado) { toast.error("Selecione um cliente."); return; }
    if (!marcaCliente.trim()) { toast.error("Informe a marca do cliente."); return; }
    setSalvando(true);
    try {
      const { error } = await supabase
        .from("lotes_produto_acabado")
        .update({
          white_label_cliente_id: clienteSelecionado.id,
          marca_cliente: marcaCliente.trim(),
          rotulo_cliente_url: rotuloUrl || null,
          white_label_atribuido_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", loteId);
      if (error) throw error;
      toast.success(`Lote atribuído a ${clienteSelecionado.nome_fantasia || clienteSelecionado.razao_social}.`);
      onSuccess?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atribuir cliente ao lote.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Atribuir Cliente ao Lote White Label
          </DialogTitle>
          <DialogDescription>
            {loteNumero && <>Lote <strong>{loteNumero}</strong> </>}
            {produtoNome && <>— {produtoNome}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Cliente *</Label>
            {clienteSelecionado ? (
              <div className="flex items-center justify-between rounded border p-2 bg-muted/30">
                <div className="text-sm">
                  <div className="font-medium">{clienteSelecionado.nome_fantasia || clienteSelecionado.razao_social}</div>
                  <div className="text-xs text-muted-foreground font-mono">{clienteSelecionado.documento}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setClienteSelecionado(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <>
                <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por razão social, fantasia ou CNPJ..." />
                {clientes.length > 0 && (
                  <div className="border rounded max-h-48 overflow-auto mt-1">
                    {clientes.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => { setClienteSelecionado(c); setMarcaCliente(c.nome_fantasia || c.razao_social); }}
                        className="w-full text-left p-2 hover:bg-accent text-sm border-b last:border-0"
                      >
                        <div className="font-medium">{c.nome_fantasia || c.razao_social}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.documento}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="space-y-1">
            <Label>Marca do Cliente *</Label>
            <Input value={marcaCliente} onChange={(e) => setMarcaCliente(e.target.value)} placeholder="Nome comercial impresso no rótulo" />
          </div>

          <div className="space-y-1">
            <Label>Rótulo Personalizado (PDF/Imagem)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="file"
                accept="image/*,application/pdf"
                disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadRotulo(f); }}
              />
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            {rotuloFile && rotuloUrl && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Upload className="h-3 w-3" /> {rotuloFile.name} enviado
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando || !clienteSelecionado || !marcaCliente.trim()}>
            {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Atribuir Cliente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}