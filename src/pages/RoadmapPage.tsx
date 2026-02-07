import { useMemo } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSystemHealth } from "@/hooks/use-system-health";
import { ArrowRight, CheckCircle2, Map, RefreshCcw, XCircle } from "lucide-react";

function statusBadge(status: "ok" | "warn" | "error") {
  switch (status) {
    case "ok":
      return <Badge className="bg-primary text-primary-foreground">OK</Badge>;
    case "warn":
      return <Badge className="bg-warning text-warning-foreground">Atenção</Badge>;
    case "error":
      return <Badge className="bg-destructive text-destructive-foreground">Erro</Badge>;
  }
}

export default function RoadmapPage() {
  const ambiente = useMemo(() => {
    const host = window.location.hostname;
    if (host.includes("preview")) return "Preview (teste)";
    return "Publicado (produção)";
  }, []);

  const { data, isLoading, isFetching, refetch } = useSystemHealth();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roadmap do ERP"
        description="Mapa do sistema, dependências entre módulos e diagnóstico de conexão"
        icon={Map}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ambiente</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Você está vendo: <span className="font-medium text-foreground">{ambiente}</span>. Se no Publicado não aparece o mesmo que no Preview, normalmente é porque o ambiente de produção ainda não tem os mesmos dados.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Diagnóstico (conexão e dados)</CardTitle>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className={"h-4 w-4 mr-2 " + (isFetching ? "animate-spin" : "")} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Verificando…</div>
          ) : (
            <div className="space-y-2">
              {data?.items.map((it) => (
                <div key={it.id} className="flex items-start justify-between gap-4 rounded-md border p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {it.status === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      ) : it.status === "warn" ? (
                        <ArrowRight className="h-4 w-4 text-warning" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <p className="font-medium truncate">{it.label}</p>
                      {statusBadge(it.status)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{it.details}</p>
                  </div>
                  {it.value ? (
                    <div className="text-sm font-semibold tabular-nums">{it.value}</div>
                  ) : null}
                </div>
              ))}

              <p className="text-xs text-muted-foreground mt-4">
                Dica: se “Lotes a vencer (≤90d)” estiver zerado no Publicado, a tela vai ficar vazia mesmo — é falta de dados nesse ambiente, não “conexão perdida”.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roadmap (módulo por módulo — o que alimenta o quê)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <section className="space-y-2">
            <p className="font-semibold">1) Cadastros Base</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><span className="text-foreground font-medium">Empresa</span> → alimenta regras fiscais, emissão/validação e parâmetros operacionais.</li>
              <li><span className="text-foreground font-medium">Entidades</span> (fornecedores/clientes/transportadoras) → alimenta compras, vendas, logística e financeiro.</li>
              <li><span className="text-foreground font-medium">Itens</span> (matéria-prima/produto/embalagem) → alimenta NFe, estoque por lote, fórmulas e OP.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-semibold">2) Compras (NF-e)</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><span className="text-foreground font-medium">Importar NF-e (XML)</span> → gera/atualiza <span className="font-mono">notas_entrada</span> e <span className="font-mono">notas_entrada_itens</span>.</li>
              <li>Matching de itens (SKU/alias/EAN/NCM) → evita duplicidade de cadastro.</li>
              <li>Da nota, o sistema pode originar <span className="text-foreground font-medium">Lotes</span> em <span className="font-mono">estoque_lotes</span>.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-semibold">3) Estoque (por lote)</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><span className="text-foreground font-medium">Lotes</span> → alimentam QC/Quarentena e consumo em OP.</li>
              <li><span className="text-foreground font-medium">Quarentena</span> → controla status e observações de qualidade do lote.</li>
              <li><span className="text-foreground font-medium">Documentos de Lote</span> (<span className="font-mono">lote_documentos</span>) → COA/Laudos e validações.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-semibold">4) Produção (Fórmulas e OP)</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li><span className="text-foreground font-medium">Fórmulas</span> (<span className="font-mono">formulas</span>, <span className="font-mono">formula_itens</span>) → alimentam cálculo e execução de OP.</li>
              <li><span className="text-foreground font-medium">Ordens de Produção</span> → consomem lotes (matérias-primas/embalagens) e geram rastreabilidade.</li>
              <li><span className="text-foreground font-medium">Lotes de Produto Acabado</span> → consolidam fabricação/validade/liberação e auditoria.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-semibold">5) Financeiro</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Compras → alimenta contas a pagar e projeções de caixa.</li>
              <li>Vendas → alimenta contas a receber e conciliação.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-semibold">6) Relatórios / Auditoria / Dashboard</p>
            <ul className="list-disc pl-5 text-muted-foreground space-y-1">
              <li>Relatórios consolida dados de compras/estoque/produção.</li>
              <li>Auditoria registra eventos e trilha técnica (imutável).</li>
              <li>Dashboard lê indicadores e alertas (ex.: lotes a vencer).</li>
            </ul>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
