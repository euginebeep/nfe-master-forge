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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { 
  FileArchive, 
  Download, 
  Trash2, 
  Search, 
  HardDrive,
  FileText,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  getAllXmlBackups,
  getXmlBackupStats,
  downloadXml,
  downloadAllXmls,
  deleteXmlBackup,
  clearAllXmlBackups,
  type XmlBackup,
} from '@/lib/xml-backup';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export default function XmlBackupPage() {
  const [backups, setBackups] = useState<XmlBackup[]>([]);
  const [stats, setStats] = useState({ total: 0, tamanhoTotal: 0, valorTotal: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    setBackups(getAllXmlBackups());
    setStats(getXmlBackupStats());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredBackups = backups.filter(b => 
    b.numero_nota.includes(search) ||
    b.chave_acesso.includes(search) ||
    b.fornecedor_razao.toLowerCase().includes(search.toLowerCase()) ||
    b.fornecedor_cnpj.includes(search)
  );

  const handleDownload = (backup: XmlBackup) => {
    downloadXml(backup);
    toast.success('Download iniciado');
  };

  const handleDownloadAll = () => {
    if (backups.length === 0) {
      toast.error('Nenhum XML para exportar');
      return;
    }
    downloadAllXmls();
    toast.success(`Exportando ${backups.length} XMLs`);
  };

  const handleDelete = (id: string) => {
    deleteXmlBackup(id);
    loadData();
    toast.success('XML removido do backup');
  };

  const handleClearAll = () => {
    clearAllXmlBackups();
    loadData();
    toast.success('Todos os backups foram removidos');
  };

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

        {/* Ações e Busca */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle>XMLs Armazenados</CardTitle>
                <CardDescription>
                  Todos os XMLs originais são armazenados na íntegra, sem modificações
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={loadData}>
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

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : filteredBackups.length === 0 ? (
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
                    {filteredBackups.map((backup) => (
                      <TableRow key={backup.id}>
                        <TableCell>
                          <div className="font-medium">{backup.numero_nota}</div>
                          <div className="text-xs text-muted-foreground">Série {backup.serie}</div>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">
                            {backup.chave_acesso.substring(0, 22)}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{backup.fornecedor_razao.substring(0, 30)}</div>
                          <div className="text-xs text-muted-foreground">
                            {backup.fornecedor_cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {backup.data_emissao ? (
                            <div className="text-sm">
                              {format(new Date(backup.data_emissao), 'dd/MM/yyyy', { locale: ptBR })}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          R$ {backup.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{formatBytes(backup.tamanho_bytes)}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(backup)}
                              title="Download XML"
                            >
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
                                    O XML da nota {backup.numero_nota} será removido permanentemente do backup.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(backup.id)}
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
