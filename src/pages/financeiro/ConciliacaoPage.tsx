import { useState, useMemo } from "react";
import { FileSearch, Upload, CheckCircle2, XCircle, AlertTriangle, Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

interface ExtratoLinha {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "CREDITO" | "DEBITO";
  conciliado: boolean;
  lancamento_ref?: string;
}

export default function ConciliacaoPage() {
  const [linhasExtrato, setLinhasExtrato] = useState<ExtratoLinha[]>([]);
  const [filtro, setFiltro] = useState("");

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split("\n").filter(Boolean);
        if (lines.length < 2) {
          toast.error("Arquivo vazio ou inválido");
          return;
        }

        const separator = lines[0].includes(";") ? ";" : ",";
        const headers = lines[0].split(separator).map((h) => h.trim().toLowerCase());

        const dataIdx = headers.findIndex((h) => h.includes("data"));
        const descIdx = headers.findIndex((h) => h.includes("descri") || h.includes("histori"));
        const valorIdx = headers.findIndex((h) => h.includes("valor") || h.includes("quantia"));

        if (dataIdx === -1 || valorIdx === -1) {
          toast.error("Colunas 'data' e 'valor' não encontradas no CSV");
          return;
        }

        const parsed: ExtratoLinha[] = lines.slice(1).map((line, i) => {
          const cols = line.split(separator).map((c) => c.trim().replace(/"/g, ""));
          const valor = parseFloat(cols[valorIdx]?.replace(/\./g, "").replace(",", ".") || "0");
          return {
            id: `ext-${i}`,
            data: cols[dataIdx] || "",
            descricao: cols[descIdx] || cols[dataIdx] || "",
            valor: Math.abs(valor),
            tipo: valor >= 0 ? "CREDITO" : "DEBITO",
            conciliado: false,
          };
        });

        setLinhasExtrato(parsed);
        toast.success(`${parsed.length} lançamentos importados`);
      } catch {
        toast.error("Erro ao processar arquivo CSV");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const toggleConciliado = (id: string) => {
    setLinhasExtrato((prev) =>
      prev.map((l) => (l.id === id ? { ...l, conciliado: !l.conciliado } : l))
    );
  };

  const linhasFiltradas = useMemo(() => {
    if (!filtro) return linhasExtrato;
    const f = filtro.toLowerCase();
    return linhasExtrato.filter(
      (l) => l.descricao.toLowerCase().includes(f) || l.data.includes(f)
    );
  }, [linhasExtrato, filtro]);

  const resumo = useMemo(() => {
    const total = linhasExtrato.length;
    const conciliados = linhasExtrato.filter((l) => l.conciliado).length;
    const pendentes = total - conciliados;
    const totalCredito = linhasExtrato
      .filter((l) => l.tipo === "CREDITO")
      .reduce((a, l) => a + l.valor, 0);
    const totalDebito = linhasExtrato
      .filter((l) => l.tipo === "DEBITO")
      .reduce((a, l) => a + l.valor, 0);
    return { total, conciliados, pendentes, totalCredito, totalDebito };
  }, [linhasExtrato]);

  const fmtMoeda = (v: number) =>
    `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <PageHeader
        title="Conciliação Bancária"
        description="Importe extratos e concilie com os lançamentos do sistema"
        icon={FileSearch}
        actions={
          <label>
            <input
              type="file"
              accept=".csv,.txt,.ofx"
              className="hidden"
              onChange={handleImportCSV}
            />
            <Button asChild variant="default">
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Importar Extrato CSV
              </span>
            </Button>
          </label>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Total</p>
            <p className="text-2xl font-bold">{resumo.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Conciliados</p>
            <p className="text-2xl font-bold text-emerald-600">{resumo.conciliados}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Pendentes</p>
            <p className="text-2xl font-bold text-destructive">{resumo.pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Créditos</p>
            <p className="text-lg font-bold text-emerald-600">{fmtMoeda(resumo.totalCredito)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase">Débitos</p>
            <p className="text-lg font-bold text-destructive">{fmtMoeda(resumo.totalDebito)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lançamentos do Extrato</CardTitle>
              <CardDescription>
                Clique em "Conciliar" para marcar como conciliado manualmente
              </CardDescription>
            </div>
            <Input
              placeholder="Filtrar por descrição ou data..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {linhasExtrato.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileSearch className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhum extrato importado</p>
              <p className="text-sm">Importe um arquivo CSV do seu banco para iniciar a conciliação</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhasFiltradas.map((linha) => (
                    <TableRow
                      key={linha.id}
                      className={linha.conciliado ? "opacity-60" : ""}
                    >
                      <TableCell className="font-mono text-sm">{linha.data}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{linha.descricao}</TableCell>
                      <TableCell>
                        <Badge variant={linha.tipo === "CREDITO" ? "secondary" : "destructive"}>
                          {linha.tipo === "CREDITO" ? "Crédito" : "Débito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {fmtMoeda(linha.valor)}
                      </TableCell>
                      <TableCell>
                        {linha.conciliado ? (
                          <Badge variant="outline" className="text-emerald-600 border-emerald-600">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Conciliado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant={linha.conciliado ? "ghost" : "outline"}
                          onClick={() => toggleConciliado(linha.id)}
                        >
                          {linha.conciliado ? (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Desfazer
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3 w-3 mr-1" />
                              Conciliar
                            </>
                          )}
                        </Button>
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
