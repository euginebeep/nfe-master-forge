import { useCallback, useEffect, useState } from "react";
import { FileArchive, RefreshCw, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AnexarXmlButton } from "@/components/nfe/AnexarXmlButton";
import { formatDate } from "@/lib/formatters";

type NotaSemXml = {
  company_id: string;
  id: string;
  numero: string | null;
  chave_nfe: string;
  emissao: string | null;
  xml_no_banco: boolean | null;
  xml_no_storage: boolean | null;
  acao: string | null;
};

function isRecuperavel(acao: string | null | undefined) {
  return (acao || "").toUpperCase().startsWith("RECUPERAVEL");
}

function isPerdido(acao: string | null | undefined) {
  return (acao || "").toUpperCase().startsWith("PERDIDO");
}

export default function NotasSemXmlPage() {
  const [rows, setRows] = useState<NotaSemXml[]>([]);
  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("v_notas_sem_xml" as any)
        .select("company_id, id, numero, chave_nfe, emissao, xml_no_banco, xml_no_storage, acao")
        .order("emissao", { ascending: false });

      if (error) throw error;
      setRows((data as NotaSemXml[]) || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Falha ao ler v_notas_sem_xml: ${msg}`);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const recuperaveis = rows.filter((r) => isRecuperavel(r.acao) || (r.xml_no_banco && !r.xml_no_storage));
  const perdidos = rows.filter((r) => isPerdido(r.acao) || (!r.xml_no_banco && !r.xml_no_storage));

  const runBackfill = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("backfill-xml-storage", {
        body: {},
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Backfill: ${data?.ok ?? 0} ok, ${data?.falhas ?? 0} falhas. ` +
          `Ainda na view: ${data?.ainda_na_view ?? "?"}`,
      );
      await load();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Backfill falhou: ${msg}`);
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="XMLs pendentes"
        description="Notas sem XML no storage ou sem XML em lugar nenhum (guarda fiscal 5 anos)"
        icon={FileArchive}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={() => void runBackfill()} disabled={backfilling || recuperaveis.length === 0}>
              <Upload className="h-4 w-4 mr-2" />
              {backfilling ? "Backfill…" : "Rodar backfill (recuperáveis)"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Recuperáveis</CardTitle>
            <CardDescription>XML no banco, ausente no storage — backfill resolve</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{recuperaveis.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Perdidos</CardTitle>
            <CardDescription>Sem XML — solicitar à contabilidade/fornecedor e anexar</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{perdidos.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendências</CardTitle>
          <CardDescription>Fonte: view pública v_notas_sem_xml</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma pendência — todos os XMLs estão ok.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nota</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Banco</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium tabular-nums">{r.numero || "—"}</TableCell>
                    <TableCell className="tabular-nums">{r.emissao ? formatDate(r.emissao) : "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.chave_nfe?.slice(-8) || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.xml_no_banco ? "default" : "destructive"}>
                        {r.xml_no_banco ? "sim" : "não"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.xml_no_storage ? "default" : "secondary"}>
                        {r.xml_no_storage ? "sim" : "não"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[220px] truncate" title={r.acao || ""}>
                      {r.acao || "—"}
                    </TableCell>
                    <TableCell>
                      {!r.xml_no_banco && r.chave_nfe && (
                        <AnexarXmlButton
                          notaId={r.id}
                          chaveNfe={r.chave_nfe}
                          onDone={() => void load()}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
