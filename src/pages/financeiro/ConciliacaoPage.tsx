import { useState, useMemo } from "react";
import { FileSearch, Upload, CheckCircle2, XCircle, AlertTriangle, Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";

interface ExtratoLinha {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: "CREDITO" | "DEBITO";
  conciliado: boolean;
  lancamento_ref?: string;
  lancamento_tabela?: "contas_pagar" | "contas_receber";
  lancamento_id?: string;
}

// Converte "dd/mm/yyyy" ou "yyyy-mm-dd" para Date
function parseDataExtrato(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00`);
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  const d = new Date(t);
  return isNaN(d.getTime()) ? null : d;
}

function diffDays(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86400000);
}

export default function ConciliacaoPage() {
  const { data: companyId } = useUserCompanyId();
  const [linhasExtrato, setLinhasExtrato] = useState<ExtratoLinha[]>([]);
  const [filtro, setFiltro] = useState("");
  const [conciliando, setConciliando] = useState<string | null>(null);

  // Tenta pré-marcar linhas que já correspondem a lançamentos conciliados no DB
  const aplicarConciliacoesExistentes = async (linhas: ExtratoLinha[]) => {
    if (!companyId) return linhas;
    try {
      const [pagar, receber] = await Promise.all([
        supabase
          .from("contas_pagar")
          .select("id, valor, valor_pago, data_vencimento, data_pagamento, conciliado")
          .eq("company_id", companyId)
          .eq("conciliado", true),
        supabase
          .from("contas_receber")
          .select("id, valor, valor_pago, data_vencimento, data_pagamento, conciliado")
          .eq("company_id", companyId)
          .eq("conciliado", true),
      ]);
      const pagarRows = (pagar.data || []) as any[];
      const receberRows = (receber.data || []) as any[];

      return linhas.map((linha) => {
        const dataL = parseDataExtrato(linha.data);
        if (!dataL) return linha;
        const pool = linha.tipo === "DEBITO" ? pagarRows : receberRows;
        const tabela = linha.tipo === "DEBITO" ? "contas_pagar" : "contas_receber";
        const match = pool.find((r) => {
          const valorRef = Number(r.valor_pago || r.valor);
          if (Math.abs(valorRef - linha.valor) > 0.01) return false;
          const dataRef = r.data_pagamento
            ? new Date(`${r.data_pagamento}T00:00:00`)
            : new Date(`${r.data_vencimento}T00:00:00`);
          return diffDays(dataL, dataRef) <= 3;
        });
        if (!match) return linha;
        return {
          ...linha,
          conciliado: true,
          lancamento_id: match.id,
          lancamento_tabela: tabela as ExtratoLinha["lancamento_tabela"],
        };
      });
    } catch {
      return linhas;
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
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

        const comConciliacoes = await aplicarConciliacoesExistentes(parsed);
        setLinhasExtrato(comConciliacoes);
        const jaConc = comConciliacoes.filter((l) => l.conciliado).length;
        toast.success(
          `${parsed.length} lançamentos importados${jaConc ? ` — ${jaConc} já conciliados` : ""}`,
        );
      } catch {
        toast.error("Erro ao processar arquivo CSV");
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  };

  const conciliar = async (linha: ExtratoLinha) => {
    if (!companyId) {
      toast.error("Empresa não identificada");
      return;
    }
    setConciliando(linha.id);
    try {
      const dataL = parseDataExtrato(linha.data);
      if (!dataL) {
        toast.error("Data do extrato inválida");
        return;
      }
      const tabela: "contas_pagar" | "contas_receber" =
        linha.tipo === "DEBITO" ? "contas_pagar" : "contas_receber";

      // Busca janela de ±3 dias e filtra no cliente por valor exato
      const dataMin = new Date(dataL); dataMin.setDate(dataMin.getDate() - 3);
      const dataMax = new Date(dataL); dataMax.setDate(dataMax.getDate() + 3);
      const iso = (d: Date) => d.toISOString().split("T")[0];

      const { data: candidatos, error } = await (supabase as any)
        .from(tabela)
        .select("id, valor, valor_pago, data_vencimento, data_pagamento, descricao, conciliado")
        .eq("company_id", companyId)
        .eq("conciliado", false)
        .gte("data_vencimento", iso(dataMin))
        .lte("data_vencimento", iso(dataMax));
      if (error) throw error;

      const match = (candidatos || []).find((r: any) => {
        const v = Number(r.valor_pago || r.valor);
        return Math.abs(v - linha.valor) < 0.01;
      });

      if (!match) {
        toast.warning(
          `Nenhum lançamento em ${tabela === "contas_pagar" ? "Contas a Pagar" : "Contas a Receber"} bate com R$ ${linha.valor.toFixed(2)} em ±3 dias`,
        );
        return;
      }

      const { error: updErr } = await (supabase as any)
        .from(tabela)
        .update({ conciliado: true, conciliado_em: new Date().toISOString() })
        .eq("id", match.id);
      if (updErr) throw updErr;

      setLinhasExtrato((prev) =>
        prev.map((l) =>
          l.id === linha.id
            ? { ...l, conciliado: true, lancamento_id: match.id, lancamento_tabela: tabela }
            : l,
        ),
      );
      toast.success(`Conciliado: ${match.descricao || `R$ ${linha.valor.toFixed(2)}`}`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao conciliar");
    } finally {
      setConciliando(null);
    }
  };

  const desfazerConciliacao = async (linha: ExtratoLinha) => {
    setConciliando(linha.id);
    try {
      if (linha.lancamento_id && linha.lancamento_tabela) {
        const { error } = await (supabase as any)
          .from(linha.lancamento_tabela)
          .update({ conciliado: false, conciliado_em: null })
          .eq("id", linha.lancamento_id);
        if (error) throw error;
      }
      setLinhasExtrato((prev) =>
        prev.map((l) =>
          l.id === linha.id
            ? { ...l, conciliado: false, lancamento_id: undefined, lancamento_tabela: undefined }
            : l,
        ),
      );
      toast.success("Conciliação desfeita");
    } catch (e: any) {
      toast.error(e.message || "Erro ao desfazer");
    } finally {
      setConciliando(null);
    }
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
                          disabled={conciliando === linha.id}
                          onClick={() =>
                            linha.conciliado ? desfazerConciliacao(linha) : conciliar(linha)
                          }
                        >
                          {linha.conciliado ? (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Desfazer
                            </>
                          ) : (
                            <>
                              <Link2 className="h-3 w-3 mr-1" />
                              {conciliando === linha.id ? "..." : "Conciliar"}
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
