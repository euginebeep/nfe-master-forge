import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, BookOpen, ExternalLink, Scale, 
  CheckCircle, AlertTriangle, XCircle, Loader2 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

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
const DADOS_REGULATORIOS_BASE: Record<string, Partial<DadosRegulatorios>> = {
  'vitamina d': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 50, unidade: 'mcg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'A vitamina D auxilia na formação de ossos e dentes', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina D auxilia na absorção de cálcio e fósforo', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina D auxilia no funcionamento do sistema imune', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos', 'Gestantes', 'Lactantes', 'Idosos'],
  },
  'vitamina c': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 1000, unidade: 'mg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'A vitamina C é um antioxidante', permitido: true, fonte: 'IN 28/2018' },
      { texto: 'A vitamina C auxilia na absorção de ferro', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos', 'Gestantes', 'Lactantes'],
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
    ],
    populacaoAlvo: ['Adultos acima de 19 anos'],
    observacoes: 'Limite de 0,21 mg por dose. Doses acima são consideradas medicamento.',
  },
  'cálcio': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 1500, unidade: 'mg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'O cálcio auxilia na formação e manutenção de ossos e dentes', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos', 'Gestantes', 'Lactantes', 'Idosos'],
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
    observacoes: 'Não possui alegações de saúde aprovadas pela ANVISA.',
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
  },
  'zinco': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 40, unidade: 'mg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'O zinco auxilia no funcionamento do sistema imune', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: [],
    populacaoAlvo: ['Adultos'],
  },
  'ferro': {
    status: 'LIBERADO',
    instrucaoNormativa: 'IN nº 28/2018',
    doseMaxima: { valor: 45, unidade: 'mg', referencia: 'RDC nº 239/2018' },
    alegacoes: [
      { texto: 'O ferro auxilia na formação de células vermelhas do sangue', permitido: true, fonte: 'IN 28/2018' },
    ],
    advertencias: ['Gestantes, nutrizes e crianças até 3 anos, somente sob orientação profissional'],
    populacaoAlvo: ['Adultos'],
  },
};

const getStatusColor = (status: DadosRegulatorios['status']) => {
  switch (status) {
    case 'LIBERADO': return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30';
    case 'RESTRITO': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30';
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

export function ConsultaANVISACard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [dados, setDados] = useState<DadosRegulatorios | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const buscarSubstancia = async () => {
    if (!searchTerm.trim()) return;
    
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    
    const nomeNormalizado = searchTerm.toLowerCase().trim();
    let dadosEncontrados: Partial<DadosRegulatorios> | null = null;
    
    for (const [chave, valor] of Object.entries(DADOS_REGULATORIOS_BASE)) {
      if (nomeNormalizado.includes(chave) || chave.includes(nomeNormalizado)) {
        dadosEncontrados = valor;
        break;
      }
    }
    
    if (dadosEncontrados) {
      setDados({
        substancia: searchTerm,
        status: dadosEncontrados.status || 'NAO_ENCONTRADO',
        instrucaoNormativa: dadosEncontrados.instrucaoNormativa || null,
        doseMaxima: dadosEncontrados.doseMaxima || null,
        alegacoes: dadosEncontrados.alegacoes || [],
        advertencias: dadosEncontrados.advertencias || [],
        populacaoAlvo: dadosEncontrados.populacaoAlvo || [],
        observacoes: dadosEncontrados.observacoes || null,
        linksUteis: [
          { titulo: 'IN 28/2018 - Alegações de Propriedade', url: 'https://antigo.anvisa.gov.br/documents/10181/3898888/IN_28_2018_.pdf' },
          { titulo: 'RDC 239/2018 - Limites de Nutrientes', url: 'https://antigo.anvisa.gov.br/documents/10181/3898888/RDC_239_2018_.pdf' },
          { titulo: 'RDC 243/2018 - Suplementos Alimentares', url: 'https://antigo.anvisa.gov.br/documents/10181/3898888/RDC_243_2018_.pdf' },
        ],
      });
    } else {
      setDados({
        substancia: searchTerm,
        status: 'NAO_ENCONTRADO',
        instrucaoNormativa: null,
        doseMaxima: null,
        alegacoes: [],
        advertencias: [],
        populacaoAlvo: [],
        observacoes: 'Substância não encontrada na base local. Consulte a legislação ANVISA diretamente.',
        linksUteis: [
          { titulo: 'IN 28/2018 - Alegações de Propriedade', url: 'https://antigo.anvisa.gov.br/documents/10181/3898888/IN_28_2018_.pdf' },
          { titulo: 'RDC 239/2018 - Limites de Nutrientes', url: 'https://antigo.anvisa.gov.br/documents/10181/3898888/RDC_239_2018_.pdf' },
          { titulo: 'Biblioteca ANVISA - Suplementos', url: 'https://antigo.anvisa.gov.br/suplementos-alimentares' },
        ],
      });
    }
    
    setLoading(false);
    setDialogOpen(true);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      buscarSubstancia();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Consulta ANVISA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Consulte substâncias, doses máximas e alegações permitidas
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Vitamina D, Melatonina..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={handleKeyPress}
                className="h-9 text-sm"
              />
              <Button 
                size="sm" 
                onClick={buscarSubstancia}
                disabled={loading || !searchTerm.trim()}
                className="h-9"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            {/* Quick links */}
            <div className="flex flex-wrap gap-1 pt-1">
              {['Vitamina D', 'Melatonina', 'Ômega 3'].map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    setSearchTerm(item);
                    setTimeout(() => buscarSubstancia(), 100);
                  }}
                >
                  {item}
                </Button>
              ))}
            </div>
            
            <a
              href="https://antigo.anvisa.gov.br/suplementos-alimentares"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline pt-1"
            >
              <ExternalLink className="h-3 w-3" />
              Legislação ANVISA - Suplementos
            </a>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Resultado da Consulta
            </DialogTitle>
            <DialogDescription>
              Informações regulatórias para: <strong>{dados?.substancia}</strong>
            </DialogDescription>
          </DialogHeader>

          {dados && (
            <ScrollArea className="max-h-[55vh] pr-4">
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center gap-3">
                  <Badge className={`px-3 py-1 ${getStatusColor(dados.status)}`}>
                    {getStatusIcon(dados.status)}
                    <span className="ml-1">{dados.status.replace('_', ' ')}</span>
                  </Badge>
                  {dados.instrucaoNormativa && (
                    <span className="text-sm text-muted-foreground">
                      {dados.instrucaoNormativa}
                    </span>
                  )}
                </div>

                {/* Dose máxima */}
                {dados.doseMaxima && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Dose Máxima</p>
                    <p className="text-lg font-bold">
                      {dados.doseMaxima.valor} {dados.doseMaxima.unidade}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Fonte: {dados.doseMaxima.referencia}
                    </p>
                  </div>
                )}

                {/* Alegações */}
                {dados.alegacoes.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Alegações:</p>
                    {dados.alegacoes.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        {a.permitido ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <span>{a.texto}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Advertências */}
                {dados.advertencias.length > 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      Advertências
                    </p>
                    <ul className="text-sm space-y-1">
                      {dados.advertencias.map((adv, i) => (
                        <li key={i}>• {adv}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Observações */}
                {dados.observacoes && (
                  <p className="text-sm text-muted-foreground italic">
                    {dados.observacoes}
                  </p>
                )}

                {/* Links */}
                <div className="pt-2 space-y-2">
                  {dados.linksUteis.map((link, i) => (
                    <a
                      key={i}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {link.titulo}
                    </a>
                  ))}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
