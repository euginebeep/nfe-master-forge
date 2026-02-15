import { useState, useCallback, useEffect } from 'react';
import { Search, Shield, AlertTriangle, CheckCircle2, XCircle, BookOpen, ExternalLink, ChevronDown, ChevronUp, Pill } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnvisaConstituinte, LimiteDose } from '@/types/anvisa';

const TAGS_RAPIDAS = [
  'Vitamina D', 'Melatonina', 'Ômega 3', 'Maca Peruana', 'Creatina',
  'Colágeno', 'Whey', 'Vitamina C', 'Zinco', 'Magnésio', 'Vitamina B12',
  'Biotina', 'Coenzima Q10', 'Ashwagandha', 'Probióticos'
];

const LINKS_LEGISLACAO = [
  { label: 'RDC 243/2018', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34379969/do1-2018-07-27-resolucao-da-diretoria-colegiada-rdc-n-243-de-26-de-julho-de-2018-34379917' },
  { label: 'IN 28/2018', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34380639' },
  { label: 'Biblioteca ANVISA', url: 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares' },
];

function formatDose(dose: LimiteDose | null): string {
  if (!dose) return '—';
  const min = dose.min === 'NE' || dose.min === 'NA' ? dose.min : dose.min;
  const max = dose.max === 'NE' || dose.max === 'NA' ? dose.max : dose.max;
  return `${min} – ${max} ${dose.unidade || ''}`;
}

function DoseTable({ constituinte }: { constituinte: AnvisaConstituinte }) {
  const grupos = [
    { label: '0–6 meses', data: constituinte.limites_0_6_meses },
    { label: '7–11 meses', data: constituinte.limites_7_11_meses },
    { label: '1–3 anos', data: constituinte.limites_1_3_anos },
    { label: '4–8 anos', data: constituinte.limites_4_8_anos },
    { label: '9–18 anos', data: constituinte.limites_9_18_anos },
    { label: '≥19 anos', data: constituinte.limites_19_mais },
    { label: 'Gestantes', data: constituinte.limites_gestantes },
    { label: 'Lactantes', data: constituinte.limites_lactantes },
  ].filter(g => g.data);

  if (grupos.length === 0) return <p className="text-sm text-muted-foreground">Limites não estabelecidos</p>;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Grupo</TableHead>
          <TableHead>Mínimo</TableHead>
          <TableHead>Máximo</TableHead>
          <TableHead>Unidade</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {grupos.map(g => (
          <TableRow key={g.label}>
            <TableCell className="font-medium">{g.label}</TableCell>
            <TableCell>{g.data?.min ?? '—'}</TableCell>
            <TableCell>{g.data?.max ?? '—'}</TableCell>
            <TableCell>{g.data?.unidade ?? '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ResultCard({ constituinte }: { constituinte: AnvisaConstituinte }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={constituinte.is_proibido ? 'border-destructive' : 'border-border'}>
      <CardHeader className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-lg">
                {constituinte.nome_tecnico}
              </CardTitle>
              {constituinte.nome_generico && (
                <span className="text-muted-foreground">({constituinte.nome_generico})</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="outline">{constituinte.categoria}</Badge>
              {constituinte.subcategoria && <Badge variant="secondary">{constituinte.subcategoria}</Badge>}
              {constituinte.is_proibido ? (
                <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />PROIBIDO</Badge>
              ) : (
                <Badge className="bg-green-600 text-white"><CheckCircle2 className="w-3 h-3 mr-1" />AUTORIZADO</Badge>
              )}
              <Badge variant="outline">{constituinte.norma_inclusao}</Badge>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-6">
          {/* Info básica */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            {constituinte.cas_number && (
              <div><span className="text-muted-foreground">CAS:</span> <strong>{constituinte.cas_number}</strong></div>
            )}
            {constituinte.fonte_de && (
              <div><span className="text-muted-foreground">Fornece:</span> <strong>{constituinte.fonte_de}</strong></div>
            )}
            <div><span className="text-muted-foreground">Anexo:</span> <strong>{constituinte.anexo_origem}</strong></div>
          </div>

          {constituinte.nome_popular && constituinte.nome_popular.length > 0 && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Nomes populares:</p>
              <div className="flex flex-wrap gap-1">
                {constituinte.nome_popular.map((n, i) => <Badge key={i} variant="outline" className="text-xs">{n}</Badge>)}
              </div>
            </div>
          )}

          <Separator />

          {/* Doses */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2"><Pill className="w-4 h-4" /> Doses Diárias Autorizadas</h4>
            <DoseTable constituinte={constituinte} />
          </div>

          {/* Alegações */}
          {constituinte.alegacoes && constituinte.alegacoes.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-green-600" /> Alegações Permitidas</h4>
                <ul className="space-y-1">
                  {constituinte.alegacoes.map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">•</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Advertências */}
          {constituinte.advertencias && constituinte.advertencias.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> Advertências Obrigatórias</h4>
                <ul className="space-y-1">
                  {constituinte.advertencias.map((a, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">⚠</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {/* Grupos não autorizados */}
          {constituinte.grupos_nao_autorizados && constituinte.grupos_nao_autorizados.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2"><XCircle className="w-4 h-4 text-destructive" /> Grupos Não Autorizados</h4>
                <div className="flex flex-wrap gap-1">
                  {constituinte.grupos_nao_autorizados.map((g, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">{g}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Referências */}
          {constituinte.referencias_especificacao && constituinte.referencias_especificacao.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-semibold mb-2 text-sm">Referências de Especificação (Art. 8º RDC 243/2018)</h4>
                <div className="flex flex-wrap gap-1">
                  {constituinte.referencias_especificacao.map((r, i) => (
                    <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Card de Fiscalização */}
          <Separator />
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <h4 className="font-bold mb-3 flex items-center gap-2"><Shield className="w-4 h-4" /> Dados para Fiscalização</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted-foreground">Base legal:</span><br /><strong>{constituinte.norma_inclusao}, {constituinte.anexo_origem}</strong></div>
                {constituinte.limites_19_mais && (
                  <>
                    <div><span className="text-muted-foreground">Dose máx. adulto:</span><br /><strong>{constituinte.limites_19_mais.max} {constituinte.limites_19_mais.unidade}/dia</strong></div>
                    <div><span className="text-muted-foreground">Dose mín. adulto:</span><br /><strong>{constituinte.limites_19_mais.min} {constituinte.limites_19_mais.unidade}/dia</strong></div>
                  </>
                )}
                <div><span className="text-muted-foreground">Advertências:</span><br /><strong>{constituinte.advertencias?.length || 0}</strong></div>
                <div><span className="text-muted-foreground">Alegações:</span><br /><strong>{constituinte.alegacoes?.length || 0}</strong></div>
                <div><span className="text-muted-foreground">Status:</span><br />
                  {constituinte.is_proibido 
                    ? <span className="text-destructive font-bold">PROIBIDO</span> 
                    : <span className="text-green-600 font-bold">AUTORIZADO</span>}
                </div>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      )}
    </Card>
  );
}

export default function ConsultaAnvisaPage() {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setTermoDebounced(termo), 300);
    return () => clearTimeout(t);
  }, [termo]);

  const { data: resultados, isLoading } = useQuery({
    queryKey: ['anvisa-search', termoDebounced],
    queryFn: async () => {
      if (!termoDebounced || termoDebounced.length < 2) return [];

      const { data: fullText } = await supabase
        .from('anvisa_constituintes')
        .select('*')
        .textSearch('search_vector', termoDebounced, { type: 'websearch', config: 'portuguese' })
        .eq('ativo', true)
        .limit(20);

      const { data: ilike } = await supabase
        .from('anvisa_constituintes')
        .select('*')
        .or(`nome_tecnico.ilike.%${termoDebounced}%,nome_generico.ilike.%${termoDebounced}%`)
        .eq('ativo', true)
        .limit(20);

      const mapa = new Map<string, AnvisaConstituinte>();
      [...(fullText || []), ...(ilike || [])].forEach((r) => {
        const item = r as unknown as AnvisaConstituinte;
        mapa.set(item.id, item);
      });

      return Array.from(mapa.values());
    },
    enabled: termoDebounced.length >= 2,
    staleTime: 10 * 60 * 1000,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consulta ANVISA – Suplementos Alimentares"
        description="Consulte substâncias, doses máximas, alegações permitidas e dados para fiscalização conforme RDC 243/2018 e IN 28/2018"
      />

      {/* Barra de busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Busque por nome técnico, popular ou sinônimo... Ex: D3, Maca, Ômega 3, Melatonina"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                className="pl-10"
              />
            </div>
            {termo && (
              <Button variant="ghost" onClick={() => setTermo('')}>Limpar</Button>
            )}
          </div>

          {/* Tags rápidas */}
          <div className="flex flex-wrap gap-2 mt-4">
            {TAGS_RAPIDAS.map(tag => (
              <Button
                key={tag}
                variant={termo === tag ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTermo(tag)}
                className="text-xs"
              >
                {tag}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Links de legislação */}
      <div className="flex flex-wrap gap-3">
        {LINKS_LEGISLACAO.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {link.label}
            <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>

      {/* Resultados */}
      {isLoading && <LoadingSpinner text="Buscando constituintes..." />}

      {!isLoading && termoDebounced.length >= 2 && resultados && resultados.length === 0 && (
        <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-amber-700 dark:text-amber-400">ATENÇÃO</h3>
                <p className="text-sm mt-1">
                  <strong>"{termoDebounced}"</strong> NÃO consta na lista de constituintes autorizados pela ANVISA (IN 28/2018).
                  Constituintes não autorizados NÃO podem ser utilizados em suplementos alimentares.
                  A responsabilidade de submissão para aprovação é da empresa fabricante.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {resultados && resultados.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {resultados.length} resultado(s) encontrado(s) para "{termoDebounced}"
          </p>
          {resultados.map(c => <ResultCard key={c.id} constituinte={c} />)}
        </div>
      )}

      {/* Empty state inicial */}
      {!termoDebounced && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-16">
            <Shield className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Base de Dados ANVISA</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Digite o nome de uma substância ou clique em uma tag rápida para consultar doses máximas,
              alegações permitidas e dados regulatórios conforme IN 28/2018.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
