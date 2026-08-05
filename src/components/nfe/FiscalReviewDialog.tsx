import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, Check, AlertTriangle, Edit } from "lucide-react";
import type { NFeParseResult } from "@/types/nfe-completa";
import { useCompany } from "@/hooks/use-company";
import { carregarCodigosFiscaisDaEmpresa, type CodigoFiscalOption } from "@/lib/codigos-fiscais";

export interface FiscalItemConfig {
  itemIndex: number;
  ncm: string;
  cfop: string;
  cstIcms: string;
  aliquotaIcms: number;
  cstIpi: string;
  aliquotaIpi: number;
  cstPis: string;
  aliquotaPis: number;
  cstCofins: string;
  aliquotaCofins: number;
  edited: boolean;
}

interface FiscalReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedResult: NFeParseResult | null;
  onConfirm: (configs: FiscalItemConfig[]) => void;
}

export function FiscalReviewDialog({
  open,
  onOpenChange,
  parsedResult,
  onConfirm,
}: FiscalReviewDialogProps) {
  const { data: company } = useCompany();
  const [itemConfigs, setItemConfigs] = useState<FiscalItemConfig[]>([]);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);
  const [opcoesIcms, setOpcoesIcms] = useState<CodigoFiscalOption[]>([]);
  const [opcoesIpi, setOpcoesIpi] = useState<CodigoFiscalOption[]>([]);
  const [opcoesPisCofins, setOpcoesPisCofins] = useState<CodigoFiscalOption[]>([]);
  const [rotuloIcms, setRotuloIcms] = useState("CST ICMS");

  // CRT do emitente do XML (entrada) — define CST vs CSOSN na revisão
  const crtEmitente = parsedResult?.emitente?.crt ?? company?.crt;

  // Initialize configs from parsed result
  useEffect(() => {
    if (parsedResult?.itens) {
      const configs = parsedResult.itens.map((itemData, index) => ({
        itemIndex: index,
        ncm: itemData.item.ncm || "",
        cfop: itemData.item.cfop || "",
        cstIcms: itemData.impostos.icms_cst || "",
        aliquotaIcms: itemData.impostos.icms_aliquota || 0,
        cstIpi: itemData.impostos.ipi_cst || "",
        aliquotaIpi: itemData.impostos.ipi_aliquota || 0,
        cstPis: itemData.impostos.pis_cst || "",
        aliquotaPis: itemData.impostos.pis_aliquota || 0,
        cstCofins: itemData.impostos.cofins_cst || "",
        aliquotaCofins: itemData.impostos.cofins_aliquota || 0,
        edited: false,
      }));
      setItemConfigs(configs);
      setExpandedItem(null);
    }
  }, [parsedResult]);

  useEffect(() => {
    const companyId = company?.id;
    if (!companyId) return;
    let ativo = true;
    (async () => {
      try {
        const loaded = await carregarCodigosFiscaisDaEmpresa(companyId, crtEmitente);
        if (!ativo) return;
        setOpcoesIcms(loaded.icms);
        setOpcoesIpi(loaded.ipi);
        setOpcoesPisCofins(loaded.pisCofins);
        setRotuloIcms(loaded.tipoIcms === "CSOSN" ? "CSOSN" : "CST ICMS");
      } catch {
        // silencioso: carregarCodigosFiscaisDaEmpresa já devolve listas locais
      }
    })();
    return () => {
      ativo = false;
    };
  }, [company?.id, crtEmitente]);

  const updateItemConfig = (
    index: number,
    field: keyof FiscalItemConfig,
    value: string | number
  ) => {
    setItemConfigs((prev) =>
      prev.map((config, i) =>
        i === index ? { ...config, [field]: value, edited: true } : config
      )
    );
  };

  const handleConfirm = () => {
    onConfirm(itemConfigs);
    onOpenChange(false);
  };

  const editedCount = itemConfigs.filter((c) => c.edited).length;

  if (!parsedResult) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Revisão Fiscal dos Itens
            {editedCount > 0 && (
              <Badge variant="outline" className="ml-2">
                {editedCount} alterado(s)
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-4">
          Revise e ajuste os dados fiscais de cada item antes de gravar no cadastro.
          Os valores apresentados foram extraídos do XML original.
        </div>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-3">
            {parsedResult.itens.map((itemData, index) => {
              const config = itemConfigs[index];
              if (!config) return null;

              const isExpanded = expandedItem === index;

              return (
                <Card
                  key={index}
                  className={`transition-all ${config.edited ? "border-primary" : ""}`}
                >
                  <CardHeader
                    className="py-3 cursor-pointer"
                    onClick={() => setExpandedItem(isExpanded ? null : index)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          #{itemData.item.n_item}
                        </span>
                        <div>
                          <CardTitle className="text-sm font-medium">
                            {itemData.item.descricao}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground">
                            NCM: {config.ncm} | CFOP: {config.cfop}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {config.edited && (
                          <Badge variant="secondary">
                            <Edit className="h-3 w-3 mr-1" />
                            Editado
                          </Badge>
                        )}
                        <Button variant="ghost" size="sm">
                          {isExpanded ? "Recolher" : "Editar"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="pt-0 space-y-4">
                      <Separator />

                      {/* NCM e CFOP */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>NCM</Label>
                          <Input
                            value={config.ncm}
                            onChange={(e) =>
                              updateItemConfig(index, "ncm", e.target.value)
                            }
                            placeholder="00000000"
                            maxLength={8}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>CFOP</Label>
                          <Input
                            value={config.cfop}
                            onChange={(e) =>
                              updateItemConfig(index, "cfop", e.target.value)
                            }
                            placeholder="0000"
                            maxLength={4}
                          />
                        </div>
                      </div>

                      {/* ICMS */}
                      <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                        <p className="text-sm font-medium">ICMS</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">{rotuloIcms}</Label>
                            <Select
                              value={config.cstIcms}
                              onValueChange={(v) =>
                                updateItemConfig(index, "cstIcms", v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {opcoesIcms.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Alíquota ICMS (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={config.aliquotaIcms}
                              onChange={(e) =>
                                updateItemConfig(
                                  index,
                                  "aliquotaIcms",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* IPI */}
                      <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                        <p className="text-sm font-medium">IPI</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">CST IPI</Label>
                            <Select
                              value={config.cstIpi}
                              onValueChange={(v) =>
                                updateItemConfig(index, "cstIpi", v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {opcoesIpi.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Alíquota IPI (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={config.aliquotaIpi}
                              onChange={(e) =>
                                updateItemConfig(
                                  index,
                                  "aliquotaIpi",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>

                      {/* PIS/COFINS */}
                      <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                        <p className="text-sm font-medium">PIS / COFINS</p>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">CST PIS</Label>
                            <Select
                              value={config.cstPis}
                              onValueChange={(v) =>
                                updateItemConfig(index, "cstPis", v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {opcoesPisCofins.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Alíquota PIS (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={config.aliquotaPis}
                              onChange={(e) =>
                                updateItemConfig(
                                  index,
                                  "aliquotaPis",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs">CST COFINS</Label>
                            <Select
                              value={config.cstCofins}
                              onValueChange={(v) =>
                                updateItemConfig(index, "cstCofins", v)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                              </SelectTrigger>
                              <SelectContent>
                                {opcoesPisCofins.map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Alíquota COFINS (%)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={config.aliquotaCofins}
                              onChange={(e) =>
                                updateItemConfig(
                                  index,
                                  "aliquotaCofins",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {editedCount > 0 ? (
              <span className="flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-warning" />
                {editedCount} item(ns) com alterações manuais
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Check className="h-4 w-4 text-success" />
                Todos os dados do XML original
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              <Check className="h-4 w-4 mr-2" />
              Confirmar e Importar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
