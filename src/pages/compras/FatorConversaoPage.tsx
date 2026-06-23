import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, TrendingUp, TrendingDown, Package, CheckCircle2 } from "lucide-react";
import { useFatorConversaoHistorico } from "@/hooks/use-fator-conversao-historico";
import { useHybridEntidades } from "@/hooks/use-hybrid-data";
import { Loader2 } from "lucide-react";

/**
 * Página global de gerenciamento de Histórico de Fator de Conversão
 * Permite visualizar, filtrar e gerenciar todos os fatores de conversão
 */
export default function FatorConversaoPage() {
  const { historico, desvios, loading, error, buscarHistorico, buscarDesviosRecentes } =
    useFatorConversaoHistorico();
  const { fornecedores } = useHybridEntidades();

  const [selectedFornecedor, setSelectedFornecedor] = useState<string>("");
  const [filterItem, setFilterItem] = useState("");
  const [activeTab, setActiveTab] = useState("historico");

  // Buscar histórico quando mudar fornecedor
  useEffect(() => {
    if (selectedFornecedor) {
      buscarHistorico(selectedFornecedor);
      buscarDesviosRecentes(selectedFornecedor, 30);
    }
  }, [selectedFornecedor, buscarHistorico, buscarDesviosRecentes]);

  // Filtrar histórico
  const historicoFiltrado = useMemo(() => {
    return historico.filter((h) => {
      if (filterItem && !h.nfe_numero?.includes(filterItem)) return false;
      return true;
    });
  }, [historico, filterItem]);

  // Calcular KPIs
  const kpis = useMemo(() => {
    const totalImportacoes = historico.length;
    const totalDesvios = desvios.length;
    const sugestoesAceitas = historico.filter((h) => h.origem === "sugestao").length;
    const taxaAceitacao = totalImportacoes > 0 ? Math.round((sugestoesAceitas / totalImportacoes) * 100) : 0;

    return {
      totalImportacoes,
      totalDesvios,
      sugestoesAceitas,
      taxaAceitacao,
    };
  }, [historico, desvios]);

  // Agrupar desvios por item
  const desviosPorItem = useMemo(() => {
    const mapa = new Map<string, typeof desvios[0][]>();
    desvios.forEach((d) => {
      const key = d.item_id;
      if (!mapa.has(key)) {
        mapa.set(key, []);
      }
      mapa.get(key)!.push(d);
    });
    return mapa;
  }, [desvios]);

  const fornecedorSelecionado = fornecedores.find((f) => f.id === selectedFornecedor);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Histórico de Fator de Conversão</h1>
        <p className="text-muted-foreground mt-2">
          Gerencie o histórico de conversões de unidades por fornecedor e detecte anomalias
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Importações</p>
                <p className="text-3xl font-bold mt-2">{kpis.totalImportacoes}</p>
              </div>
              <Package className="h-8 w-8 text-blue-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sugestões Aceitas</p>
                <p className="text-3xl font-bold mt-2">{kpis.sugestoesAceitas}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Aceitação</p>
                <p className="text-3xl font-bold mt-2">{kpis.taxaAceitacao}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Desvios Detectados</p>
                <p className="text-3xl font-bold mt-2 text-amber-600">{kpis.totalDesvios}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium">Fornecedor</label>
              <Select value={selectedFornecedor} onValueChange={setSelectedFornecedor}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  {fornecedores.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium">Buscar NF-e</label>
              <Input
                placeholder="Número da NF-e..."
                value={filterItem}
                onChange={(e) => setFilterItem(e.target.value)}
              />
            </div>

            <Button variant="outline">Exportar CSV</Button>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      {!selectedFornecedor ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Selecione um fornecedor para visualizar o histórico</AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando histórico...</span>
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="historico">Histórico ({historicoFiltrado.length})</TabsTrigger>
            <TabsTrigger value="desvios">Desvios ({desvios.length})</TabsTrigger>
          </TabsList>

          {/* Aba: Histórico */}
          <TabsContent value="historico">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Histórico de Conversões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NF-e</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Conversão</TableHead>
                        <TableHead>Fator</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Custo/un</TableHead>
                        <TableHead>Origem</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historicoFiltrado.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Nenhum registro encontrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        historicoFiltrado.map((h) => (
                          <TableRow key={h.id}>
                            <TableCell className="font-mono text-sm">{h.nfe_numero}</TableCell>
                            <TableCell className="text-sm">
                              {new Date(h.criado_em).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="text-sm">
                              {h.unidade_origem} → {h.unidade_destino}
                            </TableCell>
                            <TableCell className="font-bold">{h.fator_conversao.toLocaleString()}</TableCell>
                            <TableCell className="text-sm">
                              {h.quantidade_xml?.toLocaleString()} → {h.quantidade_interna?.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm">
                              R$ {h.custo_unitario_convertido?.toFixed(3) || "-"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`${
                                  h.origem === "sugestao"
                                    ? "bg-blue-100 text-blue-700"
                                    : h.origem === "manual"
                                      ? "bg-gray-100 text-gray-700"
                                      : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {h.origem}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aba: Desvios */}
          <TabsContent value="desvios">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Desvios Detectados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Fator Anterior</TableHead>
                        <TableHead>Fator Novo</TableHead>
                        <TableHead>Variação</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {desvios.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhum desvio detectado
                          </TableCell>
                        </TableRow>
                      ) : (
                        desvios.map((d) => (
                          <TableRow key={d.id} className="bg-amber-50">
                            <TableCell className="text-sm">
                              {new Date(d.detectado_em).toLocaleDateString("pt-BR")}
                            </TableCell>
                            <TableCell className="font-mono font-bold">{d.fator_anterior}</TableCell>
                            <TableCell className="font-mono font-bold">{d.fator_novo}</TableCell>
                            <TableCell>
                              <Badge
                                className={`${
                                  d.variacao_percentual > 0
                                    ? "bg-red-100 text-red-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {d.variacao_percentual > 0 ? "▲" : "▼"} {Math.abs(d.variacao_percentual).toFixed(1)}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{d.motivo_desvio || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
