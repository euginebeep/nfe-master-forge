import { useState } from 'react';
import { Search, Shield, XCircle, BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { useAnvisaSync } from '@/hooks/use-anvisa-sync';
import { useAnvisaSearch } from '@/hooks/use-anvisa-search';
import { DoseTable } from '@/components/regulatorio/DoseTable';
import { ResultCard } from '@/components/regulatorio/ResultCard';
import { SyncStatusBanner } from '@/components/regulatorio/SyncStatusBanner';

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

export default function ConsultaAnvisaPage() {
  const { termo, resultados, isLoading, buscar, limpar } = useAnvisaSearch();
  const { ultimoSync, sincronizar, sincronizando } = useAnvisaSync();

  const handleSync = () => {
    sincronizar(undefined, {
      onSuccess: (data: Record<string, unknown>) => {
        if (data?.status === 'alerta_mudanca') {
          toast.warning('Possível alteração na legislação detectada!', { description: 'Revise manualmente os dados.' });
        } else {
          toast.success('Base verificada com sucesso junto ao portal ANVISA.');
        }
      },
      onError: (err: Error) => {
        toast.error('Erro ao sincronizar com a ANVISA', { description: err.message });
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consulta ANVISA – Suplementos Alimentares"
        description="Consulte substâncias, doses máximas, alegações permitidas e dados para fiscalização conforme RDC 243/2018 e IN 28/2018"
      />

      {/* Status de sincronização */}
      <SyncStatusBanner
        ultimoSync={ultimoSync}
        sincronizando={sincronizando}
        onSync={handleSync}
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
                onChange={(e) => buscar(e.target.value)}
                className="pl-10"
              />
            </div>
            {termo && (
              <Button variant="ghost" onClick={() => limpar()}>Limpar</Button>
            )}
          </div>

          {/* Tags rápidas */}
          <div className="flex flex-wrap gap-2 mt-4">
            {TAGS_RAPIDAS.map(tag => (
              <Button
                key={tag}
                variant={termo === tag ? 'default' : 'outline'}
                size="sm"
                onClick={() => buscar(tag)}
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
      {isLoading && (
        <div className="space-y-2">
          <LoadingSpinner text="Buscando constituintes..." />
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            Resolvendo nomes científicos via IA...
          </p>
        </div>
      )}

      {!isLoading && termo.length >= 2 && resultados && resultados.length === 0 && (
        <Card className="border-destructive bg-red-50 dark:bg-red-950/30 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <XCircle className="w-8 h-8 text-destructive shrink-0" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-destructive text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  SUBSTÂNCIA NÃO AUTORIZADA PARA SUPLEMENTOS
                </h3>
                <p className="text-sm mt-2 text-destructive/90 dark:text-red-300">
                  <strong>"{termo}"</strong> <strong>NÃO consta</strong> na lista de constituintes autorizados pela ANVISA
                  conforme IN 28/2018 e RDC 243/2018.
                </p>
                <div className="mt-3 p-3 bg-destructive/5 rounded-md border border-destructive/20">
                  <p className="text-sm font-semibold text-destructive">⚠ Consequências legais:</p>
                  <ul className="text-xs mt-1 space-y-1 text-destructive/80">
                    <li>• Constituintes não listados na IN 28/2018 <strong>NÃO podem</strong> ser utilizados em suplementos alimentares</li>
                    <li>• O uso configura infração sanitária sujeita a apreensão do produto e multa</li>
                    <li>• A empresa fabricante é responsável pela regularização junto à ANVISA</li>
                  </ul>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Se esta substância deveria constar na base, verifique a grafia ou consulte diretamente
                  a <a href="https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares" target="_blank" rel="noopener noreferrer" className="underline text-primary">Biblioteca ANVISA</a>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {resultados && resultados.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {resultados.length} resultado(s) encontrado(s) para "{termo}"
          </p>
          {/* Show prohibited substances first */}
          {resultados
            .sort((a, b) => (b.is_proibido ? 1 : 0) - (a.is_proibido ? 1 : 0))
            .map(c => <ResultCard key={c.id} constituinte={c} />)}
        </div>
      )}

      {/* Empty state inicial */}
      {!termo && (
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
