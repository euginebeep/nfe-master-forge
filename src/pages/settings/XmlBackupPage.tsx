import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { FileArchive, Download, Trash2, Search, HardDrive, FileText, RefreshCw, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

interface NotaXml {
  id: string;
  chave_nfe: string;
  numero: string;
  serie: string;
  dh_emissao: string | null;
  total_nota: number | null;
  xml_raw: string | null;
  created_at: string;
  fornecedor?: { razao_social: string | null; documento: string | null } | null;
}

export default function XmlBackupPage() {
  const [search, setSearch] = useState('');

  const { data: notas = [], isLoading, refetch } = useQuery({
    queryKey: ['xml-backups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_entrada')
        .select('id, chave_nfe, numero, serie, dh_emissao, total_nota, xml_raw, created_at, fornecedor:entidades!notas_entrada_fornecedor_id_fkey(razao_social, documento)')
        .not('xml_raw', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as NotaXml[];
    },
  });

  const stats = {
    total: notas.length,
    tamanhoTotal: notas.reduce((sum, n) => sum + (n.xml_raw ? new Blob([n.xml_raw]).size : 0), 0),
    valorTotal: notas.reduce((sum, n) => sum + (n.total_nota || 0), 0),
  };

  const filtered = notas.filter(n =>
    (n.numero || '').includes(search) ||
    (n.chave_nfe || '').includes(search) ||
    (n.fornecedor?.razao_social || '').toLowerCase().includes(search.toLowerCase()) ||
    (n.fornecedor?.documento || '').includes(search)
  );

  const handleDownload = (nota: NotaXml) => {
    if (!nota.xml_raw) { toast.error('XML não disponível'); return; }
    const blob = new Blob([nota.xml_raw], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFe_${nota.numero}_${nota.serie}_${nota.chave_nfe}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Download iniciado');
  };

  const handleDownloadAll = () => {
    if (notas.length === 0) { toast.error('Nenhum XML para exportar'); return; }
    const content = notas.filter(n => n.xml_raw).map(n => {
      return `========================================
CHAVE: ${n.chave_nfe}
NÚMERO: ${n.numero} | SÉRIE: ${n.serie}
FORNECEDOR: ${n.fornecedor?.razao_social || '-'} (${n.fornecedor?.documento || '-'})
DATA: ${n.dh_emissao || '-'}
VALOR: R$ ${(n.total_nota || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
========================================
${n.xml_raw}

`;
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
    toast.success(`Exportando ${notas.length} XMLs`);
  };

  const handleDeleteXml = async (id: string) => {
    const { error } = await supabase
      .from('notas_entrada')
      .update({ xml_raw: null } as any)
      .eq('id', id);
    if (error) { toast.error('Erro ao remover XML'); return; }
    refetch();
    toast.success('XML removido do backup');
  };

  const handleClearAll = async () => {
    const ids = notas.map(n => n.id);
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('notas_entrada')
      .update({ xml_raw: null } as any)
      .in('id', ids);
    if (error) { toast.error('Erro ao limpar backups'); return; }
    refetch();
    toast.success('Todos os backups foram removidos');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="📦 Backup de XMLs de NF-e"
        description="Gerenciamento e backup de todos os XMLs originais importados"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-full">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de XMLs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
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
                <p className="text-sm text-muted-foreground">Espaço Utilizado</p>
                <p className="text-2xl font-bold">{formatBytes(stats.tamanhoTotal)}</p>
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
                  R$ {stats.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>XMLs Armazenados</CardTitle>
              <CardDescription>
                Todos os XMLs originais são armazenados na íntegra no banco de dados
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadAll}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Todos
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar Tudo
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Limpar Todos os Backups?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação irá remover permanentemente todos os {stats.total} XMLs do backup.
                      Recomendamos exportar todos os XMLs antes de limpar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleClearAll}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Limpar Tudo
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {search ? 'Nenhum XML encontrado com os filtros aplicados' : 'Nenhum XML armazenado'}
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
                    <TableHead className="text-right">Tamanho</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((nota) => (
                    <TableRow key={nota.id}>
                      <TableCell>
                        <div className="font-medium">{nota.numero}</div>
                        <div className="text-xs text-muted-foreground">Série {nota.serie}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {(nota.chave_nfe || '').substring(0, 22)}...
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{(nota.fornecedor?.razao_social || '-').substring(0, 30)}</div>
                        <div className="text-xs text-muted-foreground">
                          {(nota.fornecedor?.documento || '').replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                        </div>
                      </TableCell>
                      <TableCell>
                        {nota.dh_emissao ? (
                          <div className="text-sm">
                            {format(new Date(nota.dh_emissao), 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {(nota.total_nota || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {nota.xml_raw ? formatBytes(new Blob([nota.xml_raw]).size) : '0 B'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleDownload(nota)} title="Download XML">
                            <Download className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" title="Remover">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover XML do Backup?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  O XML da nota {nota.numero} será removido permanentemente do backup.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteXml(nota.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remover
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
