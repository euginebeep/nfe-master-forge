// ============================================================
// CONSULTA REGULATÓRIA ANVISA
// Botão e Dialog para consultar legislação de ativos
// IN, RDC, Alegações permitidas, Dose máxima
// ============================================================

import { useState } from "react";
import { 
  ExternalLink, FileText, Scale, AlertTriangle, 
  CheckCircle, XCircle, Search, Loader2, BookOpen
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DadosRegulatorios {
  substancia: string;
  status: 'LIBERADO' | 'RESTRITO' | 'PROIBIDO' | 'NAO_ENCONTRADO';
  instrucaoNormativa: string | null;
  doseMaxima: {
    valor: number | null;
    unidade: string;
    referencia: string;
  } | null;
  alegacoes: {
    texto: string;
    permitido: boolean;
    fonte: string;
  }[];
  advertencias: string[];
  populacaoAlvo: string[];
  observacoes: string | null;
  linksUteis: { titulo: string; url: string }[];
}

// Base de dados local de referência ANVISA
// Em produção, isso viria de uma API ou banco de dados atualizado
const DADOS_REGULATORIOS_BASE: Record<string, Partial<DadosRegulatorios>> = {
  'vitamina d': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 50, unidade: 'mcg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'A vitamina D auxilia na formação de ossos e dentes', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina D auxilia na absorção de cálcio e fósforo', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina D auxilia no funcionamento do sistema imune', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina D auxilia no funcionamento muscular', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos', 'Gestantes', 'Lactantes', 'Idosos'],
    linksUteis: [
      { titulo: 'IN nº 28/2018 - Alegações', url: 'https://www.gov.br/anvisa/pt-br' },
      { titulo: 'RDC nº 239/2018 - Limites', url: 'https://www.gov.br/anvisa/pt-br' },
    ],
  },
  'vitamina c': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 1000, unidade: 'mg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'A vitamina C é um antioxidante', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina C auxilia na absorção de ferro', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina C auxilia no funcionamento do sistema imune', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos', 'Gestantes', 'Lactantes'],
    linksUteis: [
      { titulo: 'IN nº 28/2018', url: 'https://www.gov.br/anvisa/pt-br' },
    ],
  },
  'melatonina': {
    status: 'RESTRITO',
    instrucaoNormativa: 'RDC nº 833/2023',
    doseMaxima: { valor: 0.21, unidade: 'mg', referencia: 'RDC nº 833/2023' },
    alegacoes: [
      { texto: 'A melatonina auxilia no sono', permitido: true, fonte: 'RDC 833/2023' },
    ],
    advertencias: [
      'Não recomendado para gestantes, lactantes e crianças',
      'Consumir antes de dormir',
      'Não exceder a dose diária recomendada',
    ],
    populacaoAlvo: ['Adultos acima de 19 anos'],
    observacoes: 'Limite de 0,21 mg por dose. Doses acima são consideradas medicamento.',
    linksUteis: [
      { titulo: 'RDC nº 833/2023', url: 'https://www.gov.br/anvisa/pt-br' },
    ],
  },
  'cálcio': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 1500, unidade: 'mg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'O cálcio auxilia na formação e manutenção de ossos e dentes', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'O cálcio auxilia na coagulação do sangue', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos', 'Gestantes', 'Lactantes', 'Idosos'],
    linksUteis: [
      { titulo: 'IN nº 28/2018', url: 'https://www.gov.br/anvisa/pt-br' },
    ],
  },
  'colágeno': {
    status: 'LIBERADO',
    instrucaoNormativa: 'RDC nº 243/2018',
    doseMaxima: null,
    alegacoes: [
      { texto: 'O colágeno auxilia na manutenção da pele', permitido: false, fonte: 'Não aprovado ANVISA' },
    ],
    advertencias: ['Alegações de saúde não autorizadas para colágeno puro'],
    populacaoAlvo: ['Adultos'],
    observacoes: 'Não possui alegações de saúde aprovadas pela ANVISA. Classificado como alimento.',
    linksUteis: [
      { titulo: 'RDC nº 243/2018', url: 'https://www.gov.br/anvisa/pt-br' },
    ],
  },
  'ômega 3': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 3000, unidade: 'mg', referencia: 'EFSA' },
    alegacoes: [
      { texto: 'O ômega 3 (EPA e DHA) auxilia na manutenção de níveis saudáveis de triglicerídeos', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos'],
    linksUteis: [
      { titulo: 'IN nº 28/2018', url: 'https://www.gov.br/anvisa/pt-br' },
    ],
  },
};

interface ConsultaRegulatoriaANVISAProps {
  nomeAtivo: string;
  quantidadeMg: number;
  trigger?: React.ReactNode;
}

export function ConsultaRegulatoriaANVISA({ 
  nomeAtivo, 
  quantidadeMg,
  trigger 
}: ConsultaRegulatoriaANVISAProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<DadosRegulatorios | null>(null);

  // Buscar dados regulatórios
  const buscarDados = async () => {
    setLoading(true);
    
    // Simular delay de API
    await new Promise(r => setTimeout(r, 500));
    
    // Buscar na base local (case insensitive, partial match)
    const nomeNormalizado = nomeAtivo.toLowerCase();
    let dadosEncontrados: Partial<DadosRegulatorios> | null = null;
    
    for (const [chave, valor] of Object.entries(DADOS_REGULATORIOS_BASE)) {
      if (nomeNormalizado.includes(chave) || chave.includes(nomeNormalizado)) {
        dadosEncontrados = valor;
        break;
      }
    }
    
    if (dadosEncontrados) {
      setDados({
        substancia: nomeAtivo,
        status: dadosEncontrados.status || 'NAO_ENCONTRADO',
        instrucaoNormativa: dadosEncontrados.instrucaoNormativa || null,
        doseMaxima: dadosEncontrados.doseMaxima || null,
        alegacoes: dadosEncontrados.alegacoes || [],
        advertencias: dadosEncontrados.advertencias || [],
        populacaoAlvo: dadosEncontrados.populacaoAlvo || [],
        observacoes: dadosEncontrados.observacoes || null,
        linksUteis: dadosEncontrados.linksUteis || [],
      });
    } else {
      setDados({
        substancia: nomeAtivo,
        status: 'NAO_ENCONTRADO',
        instrucaoNormativa: null,
        doseMaxima: null,
        alegacoes: [],
        advertencias: [],
        populacaoAlvo: [],
        observacoes: 'Substância não encontrada na base de dados local. Consulte a ANVISA diretamente.',
        linksUteis: [
          { titulo: 'Portal ANVISA - Suplementos', url: 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares' },
          { titulo: 'Sistema de Consulta Pública', url: 'https://consultas.anvisa.gov.br/' },
        ],
      });
    }
    
    setLoading(false);
  };

  // Verificar se dose atual excede máximo
  const doseExcedida = dados?.doseMaxima && quantidadeMg > dados.doseMaxima.valor!;

  const getStatusColor = (status: DadosRegulatorios['status']) => {
    switch (status) {
      case 'LIBERADO': return 'bg-success/10 text-success border-success/30';
      case 'RESTRITO': return 'bg-warning/10 text-warning border-warning/30';
      case 'PROIBIDO': return 'bg-destructive/10 text-destructive border-destructive/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: DadosRegulatorios['status']) => {
    switch (status) {
      case 'LIBERADO': return <CheckCircle className="h-4 w-4" />;
      case 'RESTRITO': return <AlertTriangle className="h-4 w-4" />;
      case 'PROIBIDO': return <XCircle className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o && !dados) buscarDados();
    }}>
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
            Panorama regulatório para: <strong>{nomeAtivo}</strong>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : dados ? (
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Status principal */}
              <div className="flex items-center gap-3">
                <Badge className={`px-3 py-1 ${getStatusColor(dados.status)}`}>
                  {getStatusIcon(dados.status)}
                  <span className="ml-1">{dados.status.replace('_', ' ')}</span>
                </Badge>
                {dados.instrucaoNormativa && (
                  <span className="text-sm text-muted-foreground">
                    Ref: {dados.instrucaoNormativa}
                  </span>
                )}
              </div>

              {/* Alerta de dose excedida */}
              {doseExcedida && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Dose acima do limite!</AlertTitle>
                  <AlertDescription>
                    Dose atual: {quantidadeMg} mg | Limite: {dados.doseMaxima?.valor} {dados.doseMaxima?.unidade}
                    <br />
                    <span className="text-xs">Referência: {dados.doseMaxima?.referencia}</span>
                  </AlertDescription>
                </Alert>
              )}

              <Tabs defaultValue="resumo" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="resumo" className="flex-1">Resumo</TabsTrigger>
                  <TabsTrigger value="alegacoes" className="flex-1">Alegações</TabsTrigger>
                  <TabsTrigger value="links" className="flex-1">Legislação</TabsTrigger>
                </TabsList>

                <TabsContent value="resumo" className="space-y-4 mt-4">
                  {/* Dose Máxima */}
                  {dados.doseMaxima && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Scale className="h-4 w-4" />
                          Dose Máxima Permitida
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {dados.doseMaxima.valor} {dados.doseMaxima.unidade}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Sua dose: {quantidadeMg.toFixed(2)} mg 
                          {!doseExcedida && <span className="text-success ml-2">✓ Dentro do limite</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Fonte: {dados.doseMaxima.referencia}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Advertências */}
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

                  {/* População alvo */}
                  {dados.populacaoAlvo.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">População Alvo:</span>
                      <div className="flex flex-wrap gap-1">
                        {dados.populacaoAlvo.map((pop, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {pop}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Observações */}
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
                      Nenhuma alegação de saúde registrada na base local.
                    </p>
                  ) : (
                    dados.alegacoes.map((alegacao, i) => (
                      <Card key={i} className={alegacao.permitido ? 'border-success/30' : 'border-destructive/30'}>
                        <CardContent className="py-3">
                          <div className="flex items-start gap-2">
                            {alegacao.permitido ? (
                              <CheckCircle className="h-4 w-4 text-success mt-0.5" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                            )}
                            <div>
                              <p className="text-sm">{alegacao.texto}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {alegacao.permitido ? 'Permitida' : 'Não Permitida'} | {alegacao.fonte}
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
                  
                  <div className="space-y-2">
                    <p className="text-xs font-medium">Consultas Adicionais:</p>
                    <a
                      href={`https://consultas.anvisa.gov.br/#/alimentos/q/?substancia=${encodeURIComponent(nomeAtivo)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <Search className="h-4 w-4 text-primary" />
                      <span className="text-sm">Buscar "{nomeAtivo}" no Sistema ANVISA</span>
                    </a>
                    <a
                      href="https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 rounded-lg border hover:bg-muted transition-colors"
                    >
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span className="text-sm">Portal ANVISA - Suplementos Alimentares</span>
                    </a>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </ScrollArea>
        ) : null}

        <div className="text-xs text-muted-foreground mt-4 pt-4 border-t">
          <p>
            ⚠️ Dados de referência local. Para decisões regulatórias, sempre consulte a legislação oficial atualizada.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
