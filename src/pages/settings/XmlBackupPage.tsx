// ============================================
// BACKUP DE XMLs — LEITURA DO SUPABASE
// Substituiu localStorage por notas_entrada (xml_raw já gravado lá)
// ============================================

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  FileArchive,
  Download,
  Search,
  HardDrive,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { getUserCompanyId } from '@/hooks/use-user-company';
import { backfillFiscalDataFromXML } from '@/lib/supabase-nfe-import';

// ── Tipagem local baseada no Supabase ────────────────────────────────────────

interface NotaXmlRow {
  id: string;
  chave_nfe: string;
  numero: string | null;
  serie: string | null;
  dh_emissao: string | null;
  total_nota: number | null;
  xml_raw: string | null;
  created_at: string;
  fornecedor: {
    razao_social: string;
    documento: string;
  } | null;
}

// ── Utilitários ──────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function downloadXml(nota: NotaXmlRow): void {
  if (!nota.xml_raw) {
    toast.error('XML não disponível para esta nota');
    return;
  }
  const blob = new Blob([nota.xml_raw], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NFe_${nota.numero || 'SEM_NUM'}_${nota.serie || '1'}_${nota.chave_nfe}.xml`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadAllXmls(notas: NotaXmlRow[]): void {
  const comXml = notas.filter(n => n.xml_raw);
  if (comXml.length === 0) {
    toast.error('Nenhum XML disponível para exportar');
    return;
  }

  const content = comXml.map(n => {
    const fornRazao = n.fornecedor?.razao_social || 'Desconhecido';
    const fornCnpj  = n.fornecedor?.documento    || '';
    return [
      '========================================',
      `CHAVE: ${n.chave_nfe}`,
      `NÚMERO: ${n.numero || '-'} | SÉRIE: ${n.serie || '-'}`,
      `FORNECEDOR: ${fornRazao} (${fornCnpj})`,
      `DATA: ${n.dh_emissao || '-'}`,
      `VALOR: R$ ${(n.total_nota ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      '========================================',
      n.xml_raw,
      '',
    ].join('\n');
  }).join('\n\n');

  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup_xmls_nfe_${new Date().toISOString().split('T')[0]}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Componente ───────────────────────────────────────────────────────────────

export default function XmlBackupPage() {
  const [notas, setNotas] = useState<NotaXmlRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [backfilling, setBackfilling] = useState(false);

  const handleBackfillFiscal = async () => {
    setBackfilling(true);
    try {
      const result = await backfillFiscalDataFromXML();
      toast.success(`Dados fiscais atualizados: ${result.updated} itens processados${result.errors > 0 ? `, ${result.errors} erros` : ''}`);
    } catch (err) {
      toast.error('Erro ao reprocessar dados fiscais');
      console.error(err);
    } finally {
      setBackfilling(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) {
        toast.error('Empresa não configurada');
        return;
      }

      const { data, error } = await supabase
        .from('notas_entrada')
        .select(`
          id,
          chave_nfe,
          numero,
          serie,
          dh_emissao,
          total_nota,
          xml_raw,
          created_at,
          fornecedor:entidades (razao_social, documento)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotas((data as unknown as NotaXmlRow[]) || []);
    } catch (err) {
      toast.error('Erro ao carregar notas: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // ── Stats derivadas ──────────────────────────────────────────────────────
  const total       = notas.length;
  const comXml      = notas.filter(n => n.xml_raw).length;
  const tamanhoTotal = notas.reduce((sum, n) => sum + new Blob([n.xml_raw || '']).size, 0);
  const valorTotal  = notas.reduce((sum, n) => sum + (n.total_nota ?? 0), 0);

  // ── Filtro ───────────────────────────────────────────────────────────────
  const filtradas = notas.filter(n => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      (n.numero || '').includes(search) ||
      n.chave_nfe.includes(search) ||
      (n.fornecedor?.razao_social || '').toLowerCase().includes(s) ||
      (n.fornecedor?.documento || '').includes(search)
    );
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="📦 Backup de XMLs de NF-e"
        description="Gerenciamento e backup de todos os XMLs originais importados"
      />

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Notas</p>
                <p className="text-2xl font-bold">{total}</p>
                {comXml < total && (
                  <p className="text-xs text-muted-foreground">{comXml} com XML disponível</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-secondary rounded-full">
                <HardDrive className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Espaço dos XMLs</p>
                <p className="text-2xl font-bold">{formatBytes(tamanhoTotal)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent rounded-full">
                <FileArchive className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Valor Total das Notas</p>
                <p className="text-2xl font-bold">
                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>XMLs Armazenados</CardTitle>
              <CardDescription>
                XMLs originais gravados no banco de dados — sem modificações
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  downloadAllXmls(notas);
                  toast.success(`Exportando ${comXml} XMLs`);
                }}
                disabled={comXml === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar Todos
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackfillFiscal}
                disabled={backfilling || comXml === 0}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${backfilling ? 'animate-spin' : ''}`} />
                {backfilling ? 'Processando...' : 'Reprocessar Fiscal'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, chave, fornecedor ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtradas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'Nenhuma nota encontrada com esse filtro' : 'Nenhuma nota importada ainda'}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nota</TableHead>
                    <TableHead>Chave de Acesso</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data Emissão</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Tamanho XML</TableHead>
                    <TableHead className="text-center">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map((nota) => {
                    const xmlSize = nota.xml_raw ? new Blob([nota.xml_raw]).size : 0;
                    const fornRazao = nota.fornecedor?.razao_social || 'Desconhecido';
                    const fornCnpj  = nota.fornecedor?.documento    || '';
                    const cnpjFmt   = fornCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

                    return (
                      <TableRow key={nota.id}>
                        <TableCell>
                          <div className="font-medium">{nota.numero || '-'}</div>
                          <div className="text-xs text-muted-foreground">Série {nota.serie || '-'}</div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {nota.chave_nfe.substring(0, 22)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{fornRazao.substring(0, 30)}</div>
                          <div className="text-xs text-muted-foreground">{cnpjFmt}</div>
                        </TableCell>
                        <TableCell>
                          {nota.dh_emissao ? (
                            <div className="text-sm">
                              {format(new Date(nota.dh_emissao), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {(nota.total_nota ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          {xmlSize > 0
                            ? <Badge variant="outline">{formatBytes(xmlSize)}</Badge>
                            : <Badge variant="secondary">Sem XML</Badge>
                          }
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => { downloadXml(nota); toast.success('Download iniciado'); }}
                            disabled={!nota.xml_raw}
                            title={nota.xml_raw ? 'Download XML' : 'XML não disponível'}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
