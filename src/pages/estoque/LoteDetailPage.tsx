import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Beaker, CheckCircle, FileText, Info, Upload, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { LocalDb } from "@/lib/local-db";
import type { LocalEstoqueLote, LocalItem, LocalLoteDocumento } from "@/hooks/use-local-itens";
import { useLoteDocumentos } from "@/hooks/use-local-itens";
import { COAParserButton } from "@/components/lotes/COAParserButton";
import { QRCodeAuditoria } from "@/components/shared/QRCodeAuditoria";

type TipoPotencia = "NENHUMA" | "UI_POR_GRAMA" | "MG_POR_GRAMA" | "PERCENTUAL";

function getTipoPotenciaLabel(tipo: TipoPotencia) {
  switch (tipo) {
    case "UI_POR_GRAMA":
      return "UI/g";
    case "MG_POR_GRAMA":
      return "mg/g";
    case "PERCENTUAL":
      return "%";
    case "NENHUMA":
    default:
      return "-";
  }
}

function formatarPotencia(tipo: TipoPotencia, valor?: number): string {
  if (tipo === "NENHUMA" || !valor) return "-";
  return `${valor.toLocaleString('pt-BR')} ${getTipoPotenciaLabel(tipo)}`;
}

export default function LoteDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [refreshKey, setRefreshKey] = useState(0);

  const lote = useMemo(() => {
    if (!id) return null;
    return LocalDb.getById<LocalEstoqueLote>("estoque_lotes", id);
  }, [id, refreshKey]);

  const item = useMemo(() => {
    if (!lote) return null;
    return LocalDb.getById<LocalItem>("itens", lote.item_id);
  }, [lote, refreshKey]);

  const { documentos, create, validate } = useLoteDocumentos(id);

  const [tipoPotencia, setTipoPotencia] = useState<TipoPotencia>((lote?.tipo_potencia as TipoPotencia) || "NENHUMA");
  const [potenciaValor, setPotenciaValor] = useState<number>(lote?.potencia_valor || 0);

  const hasCOA = useMemo(() => documentos.some(d => d.tipo_documento === "COA"), [documentos]);
  const hasCOAValidado = useMemo(
    () => documentos.some(d => d.tipo_documento === "COA" && d.status_validacao === "VALIDADO"),
    [documentos]
  );

  const salvarPotencia = () => {
    if (!lote || !id) return;

    const update: Partial<LocalEstoqueLote> = {
      tipo_potencia: tipoPotencia,
      potencia_valor: tipoPotencia === "NENHUMA" ? undefined : potenciaValor || undefined,
      potencia_unidade: getTipoPotenciaLabel(tipoPotencia) === "-" ? undefined : getTipoPotenciaLabel(tipoPotencia),
    };

    LocalDb.update("estoque_lotes", id, update);
    toast.success("Potência do lote salva");
    setRefreshKey(k => k + 1);
  };

  const aplicarPresetVitD = () => {
    setTipoPotencia("UI_POR_GRAMA");
    setPotenciaValor(400000);
  };

  const handleUploadCOA = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    // Read file as base64 for LocalDb
    const reader = new FileReader();
    reader.onload = () => {
      create({
        lote_id: id,
        tipo_documento: "COA",
        arquivo_nome: file.name,
        arquivo_tipo: file.type,
        arquivo_size: file.size,
        arquivo_data: reader.result as string,
        status_validacao: "PENDENTE",
      } as Omit<LocalLoteDocumento, "id">);

      setRefreshKey(k => k + 1);
    };

    reader.readAsDataURL(file);
  };

  if (!lote || !item) {
    return (
      <div>
        <PageHeader
          title="Lote não encontrado"
          description="Volte para a lista e selecione um lote válido."
          icon={FileText}
          actions={
            <Button variant="outline" onClick={() => navigate("/estoque/lotes")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={`Lote ${lote.numero_lote}`}
        description={`Item: ${item.descricao_interna}`}
        icon={FileText}
        actions={
          <Button variant="outline" onClick={() => navigate("/estoque/lotes")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code de Rastreabilidade */}
        <div className="lg:col-span-1 flex justify-center">
          <QRCodeAuditoria
            tipo="LOTE_MP"
            id={lote.id}
            hash={lote.id}
            codigo={lote.numero_lote}
            label={`Lote ${lote.numero_lote}`}
            size={120}
          />
        </div>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge variant={lote.status === "DISPONIVEL" ? "success" : lote.status === "QUARENTENA" ? "warning" : "muted"}>
                {lote.status}
              </StatusBadge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Quantidade interna</span>
              <span className="font-mono font-medium">
                {Number(lote.quantidade_interna).toLocaleString("pt-BR")} {item.unidade_interna}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Validade</span>
              <span className="font-mono font-medium">{lote.data_val || "-"}</span>
            </div>

            <Separator />

            <Alert className="bg-muted/50">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Ordem correta:</strong> 1) Importar NF-e (gera lote) → 2) Anexar COA → 3) Registrar potência do lote → 4) Validar COA / liberar.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Potência do lote (COA)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de potência</Label>
                <Select value={tipoPotencia} onValueChange={(v) => setTipoPotencia(v as TipoPotencia)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NENHUMA">Nenhuma</SelectItem>
                    <SelectItem value="UI_POR_GRAMA">UI por grama (UI/g)</SelectItem>
                    <SelectItem value="MG_POR_GRAMA">mg por grama (mg/g)</SelectItem>
                    <SelectItem value="PERCENTUAL">Percentual (%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  type="number"
                  step="any"
                  value={potenciaValor}
                  onChange={(e) => setPotenciaValor(parseFloat(e.target.value) || 0)}
                  disabled={tipoPotencia === "NENHUMA"}
                  placeholder={tipoPotencia === "UI_POR_GRAMA" ? "Ex: 400000" : ""}
                />
                <p className="text-xs text-muted-foreground">
                  Atual: <span className="font-mono">{formatarPotencia((lote.tipo_potencia as any) || "NENHUMA", lote.potencia_valor)}</span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <COAParserButton 
                materiasPrimas={[]}
                onPotenciaEncontrada={(dados) => {
                  // Map tipo to our format
                  const tipoMap: Record<string, TipoPotencia> = {
                    "UI_POR_GRAMA": "UI_POR_GRAMA",
                    "MG_POR_GRAMA": "MG_POR_GRAMA", 
                    "PERCENTUAL": "PERCENTUAL",
                  };
                  setTipoPotencia(tipoMap[dados.tipo] || "NENHUMA");
                  setPotenciaValor(dados.valor);
                  toast.success(`Potência extraída do COA: ${dados.valor}`);
                }}
              />
              <Button type="button" variant="secondary" onClick={aplicarPresetVitD}>
                <Beaker className="h-4 w-4 mr-2" />
                Vitamina D3 (400.000 UI/g)
              </Button>
              <Button type="button" onClick={salvarPotencia}>
                Salvar potência
              </Button>
            </div>

            {tipoPotencia === "UI_POR_GRAMA" && potenciaValor === 400000 && (
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Exemplo automático: <strong>2.000 UI = 5 mg = 50 mcg</strong> (preparação 400.000 UI/g).
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">COA / Laudo do fornecedor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="upload-coa" className="cursor-pointer">
                <div className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Clique para anexar COA (PDF)
                  </p>
                </div>
              </Label>
              <input
                id="upload-coa"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleUploadCOA}
              />
            </div>

            <div className="flex items-center gap-2">
              {hasCOAValidado ? (
                <StatusBadge variant="success">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  COA validado
                </StatusBadge>
              ) : hasCOA ? (
                <StatusBadge variant="warning">COA pendente</StatusBadge>
              ) : (
                <StatusBadge variant="muted">Sem COA</StatusBadge>
              )}

              {!hasCOAValidado && hasCOA && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const pendente = documentos.find(d => d.tipo_documento === "COA" && d.status_validacao === "PENDENTE");
                    if (!pendente) return;
                    validate(pendente.id);
                    setRefreshKey(k => k + 1);
                  }}
                >
                  Marcar como validado
                </Button>
              )}
            </div>

            {documentos.length > 0 && (
              <div className="space-y-2">
                {documentos.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between border rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{doc.arquivo_nome}</div>
                        <div className="text-xs text-muted-foreground">{doc.tipo_documento} • {doc.status_validacao}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
