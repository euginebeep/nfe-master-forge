// ============================================================
// CONSULTA REGULATÓRIA ANVISA (popup do Formulador)
// Fonte única: rpc anvisa_consultar — nunca fuzzy/popular/hardcode.
// ============================================================

import { useState } from "react";
import {
  ExternalLink,
  FileText,
  Scale,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  estiloStatusAnvisaConsulta,
  rpcAnvisaConsultar,
  type AnvisaConsultaResult,
} from "@/lib/anvisa-consultar";

interface DadosRegulatorios {
  substancia: string;
  statusLabel: string;
  statusClass: string;
  consultaStatus: string;
  instrucaoNormativa: string | null;
  doseMaxima: {
    valor: number | null;
    unidade: string;
    referencia: string;
  } | null;
  alegacoes: { texto: string; permitido: boolean; fonte: string }[];
  advertencias: string[];
  observacoes: string | null;
  mensagem: string | null;
  nomeTecnico: string | null;
  linksUteis: { titulo: string; url: string }[];
}

function parseLimiteAdultoMg(consulta: AnvisaConsultaResult): number | null {
  if (consulta.limite_maximo_mg != null && Number.isFinite(consulta.limite_maximo_mg)) {
    return Number(consulta.limite_maximo_mg);
  }
  const texto =
    consulta.limite_texto ||
    (consulta.limites?.["19_mais"] as { texto?: string } | undefined)?.texto ||
    "";
  const m = String(texto).match(/M[áa]ximo:\s*([0-9\.\,]+)/i);
  if (!m) return null;
  // BR: "5.000" = 5000; "9,94" = 9.94
  const raw = m[1];
  if (raw.includes(",") && raw.includes(".")) {
    return parseFloat(raw.replace(/\./g, "").replace(",", "."));
  }
  if (raw.includes(",")) return parseFloat(raw.replace(",", "."));
  if (/^\d{1,3}(\.\d{3})+$/.test(raw)) return parseFloat(raw.replace(/\./g, ""));
  return parseFloat(raw);
}

function mapConsultaToDados(
  nomeAtivo: string,
  quantidadeMg: number,
  consulta: AnvisaConsultaResult,
  consultaComDose?: AnvisaConsultaResult | null,
): DadosRegulatorios {
  const estilo = estiloStatusAnvisaConsulta(consulta.status);
  const alegRaw = Array.isArray(consulta.alegacoes) ? consulta.alegacoes : [];
  const advRaw = Array.isArray(consulta.advertencias) ? consulta.advertencias : [];

  const limiteAdulto = parseLimiteAdultoMg(consultaComDose || consulta);
  const statusEfetivo = consultaComDose?.status || consulta.status;
  const estiloEfetivo = estiloStatusAnvisaConsulta(statusEfetivo);

  return {
    substancia: nomeAtivo,
    statusLabel: estiloEfetivo.label,
    statusClass: estiloEfetivo.className,
    consultaStatus: statusEfetivo,
    instrucaoNormativa: consulta.norma_inclusao || "IN 28/2018",
    doseMaxima:
      limiteAdulto != null
        ? {
            valor: limiteAdulto,
            unidade: "mg",
            referencia: consulta.norma_inclusao || "IN 28/2018",
          }
        : null,
    alegacoes: alegRaw.map((a) => ({
      texto: String(a),
      permitido: true,
      fonte: consulta.norma_inclusao || "IN 28/2018",
    })),
    advertencias: advRaw.map((a) => String(a)),
    observacoes: consulta.mensagem || estilo.label,
    mensagem: consultaComDose?.mensagem || consulta.mensagem || null,
    nomeTecnico: consulta.nome_tecnico || null,
    linksUteis: [
      {
        titulo: "Portal ANVISA - Suplementos",
        url: "https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares",
      },
      {
        titulo: "Sistema de Consulta Pública",
        url: "https://consultas.anvisa.gov.br/",
      },
    ],
  };
}

interface ConsultaRegulatoriaANVISAProps {
  nomeAtivo: string;
  quantidadeMg: number;
  trigger?: React.ReactNode;
}

export function ConsultaRegulatoriaANVISA({
  nomeAtivo,
  quantidadeMg,
  trigger,
}: ConsultaRegulatoriaANVISAProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<DadosRegulatorios | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const buscarDados = async () => {
    setLoading(true);
    setErro(null);
    try {
      // Fonte única — primeiro acha o constituinte
      const consulta = await rpcAnvisaConsultar({ termo: nomeAtivo });

      // Se achou e há dose, valida contra grupo adulto (19_mais)
      let consultaDose: AnvisaConsultaResult | null = null;
      if (
        consulta.ok &&
        consulta.status !== "nao_encontrado" &&
        consulta.status !== "termo_vazio" &&
        quantidadeMg > 0
      ) {
        consultaDose = await rpcAnvisaConsultar({
          termo: nomeAtivo,
          grupo: "19_mais",
          doseMg: quantidadeMg,
        });
      }

      setDados(mapConsultaToDados(nomeAtivo, quantidadeMg, consulta, consultaDose));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao consultar ANVISA");
      setDados(null);
    } finally {
      setLoading(false);
    }
  };

  const doseExcedida =
    dados?.consultaStatus === "acima_limite" ||
    Boolean(
      dados?.doseMaxima?.valor != null &&
        quantidadeMg > (dados.doseMaxima.valor as number),
    );

  const statusIcon =
    dados?.consultaStatus === "proibido" ||
    dados?.consultaStatus === "acima_limite" ||
    dados?.consultaStatus === "nao_autorizado_grupo" ? (
      <XCircle className="h-4 w-4" />
    ) : dados?.consultaStatus === "encontrado" ||
      dados?.consultaStatus === "conforme" ? (
      <CheckCircle className="h-4 w-4" />
    ) : (
      <Search className="h-4 w-4" />
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) buscarDados();
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <BookOpen className="h-3 w-3 mr-1" />
            Consultar ANVISA
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Consulta Regulatória ANVISA
          </DialogTitle>
          <DialogDescription>
            Fonte única <code className="text-xs">anvisa_consultar</code> para:{" "}
            <strong>{nomeAtivo}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : erro ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Erro na consulta</AlertTitle>
            <AlertDescription>{erro}</AlertDescription>
          </Alert>
        ) : dados ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`px-3 py-1 ${dados.statusClass}`}>
                  {statusIcon}
                  <span className="ml-1">{dados.statusLabel}</span>
                </Badge>
                {dados.nomeTecnico && dados.nomeTecnico !== nomeAtivo && (
                  <span className="text-sm text-muted-foreground">
                    Match: <strong>{dados.nomeTecnico}</strong>
                  </span>
                )}
                {dados.instrucaoNormativa && (
                  <span className="text-sm text-muted-foreground">
                    Ref: {dados.instrucaoNormativa}
                  </span>
                )}
              </div>

              {dados.mensagem && (
                <p className="text-sm text-muted-foreground">{dados.mensagem}</p>
              )}

              {doseExcedida && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Dose acima do limite!</AlertTitle>
                  <AlertDescription>
                    Dose atual: {quantidadeMg} mg
                    {dados.doseMaxima?.valor != null && (
                      <>
                        {" "}
                        | Limite: {dados.doseMaxima.valor} {dados.doseMaxima.unidade}
                      </>
                    )}
                    <br />
                    <span className="text-xs">
                      Referência: {dados.doseMaxima?.referencia || "IN 28/2018"}
                    </span>
                  </AlertDescription>
                </Alert>
              )}

              {dados.consultaStatus === "nao_encontrado" && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Consulte ANVISA / PENDENTE_RT</AlertTitle>
                  <AlertDescription className="text-sm">
                    {dados.mensagem ||
                      "Não consta na base de constituintes ANVISA (IN 28/2018)."}
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="resumo" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="resumo" className="flex-1">
                    Resumo
                  </TabsTrigger>
                  <TabsTrigger value="alegacoes" className="flex-1">
                    Alegações
                  </TabsTrigger>
                  <TabsTrigger value="links" className="flex-1">
                    Legislação
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="space-y-4 mt-4">
                  {dados.doseMaxima && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Scale className="h-4 w-4" />
                          Dose Máxima Permitida (adulto)
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {dados.doseMaxima.valor} {dados.doseMaxima.unidade}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sua dose: {quantidadeMg.toFixed(2)} mg
                          {!doseExcedida && dados.consultaStatus !== "nao_encontrado" && (
                            <span className="text-success ml-2">✓ Dentro do limite</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fonte: {dados.doseMaxima.referencia}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {dados.advertencias.length > 0 && (
                    <Card className="border-warning/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-warning">
                          <AlertTriangle className="h-4 w-4" />
                          Advertências Obrigatórias
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm">
                          {dados.advertencias.map((adv, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-warning">•</span>
                              {adv}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}

                  {dados.observacoes && (
                    <Alert>
                      <FileText className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        {dados.observacoes}
                      </AlertDescription>
                    </Alert>
                  )}
                </TabsContent>

                <TabsContent value="alegacoes" className="space-y-3 mt-4">
                  {dados.alegacoes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      Nenhuma alegação retornada pela fonte única.
                    </p>
                  ) : (
                    dados.alegacoes.map((alegacao, i) => (
                      <Card
                        key={i}
                        className={
                          alegacao.permitido
                            ? "border-success/30"
                            : "border-destructive/30"
                        }
                      >
                        <CardContent className="py-3">
                          <div className="flex items-start gap-2">
                            {alegacao.permitido ? (
                              <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                            )}
                            <div>
                              <p className="text-sm whitespace-pre-line">
                                {alegacao.texto}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {alegacao.fonte}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>

                <TabsContent value="links" className="space-y-3 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Links úteis para consulta da legislação completa:
                  </p>
                  {dados.linksUteis.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{link.titulo}</span>
                    </a>
                  ))}

                  <Separator className="my-4" />

                  <a
                    href={`https://consultas.anvisa.gov.br/#/alimentos/q/?substancia=${encodeURIComponent(nomeAtivo)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                  >
                    <Search className="h-4 w-4 text-primary" />
                    <span className="text-sm">Buscar "{nomeAtivo}" no Sistema ANVISA</span>
                  </a>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        ) : null}

        <div className="text-xs text-muted-foreground mt-4 pt-4 border-t">
          <p>
            Fonte única BrainX: <code>anvisa_consultar</code>. Para decisões
            regulatórias, confirme sempre na legislação oficial atualizada.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
