import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, ArrowRight, Loader2, X } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { centralToast } from "@/components/ui/central-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  parseCSV,
  readFileAsText,
  ITEM_FIELDS,
  ENTIDADE_FIELDS,
  type CSVParseResult,
  type ColumnMapping,
} from "@/lib/csv-import";

type ImportTarget = "itens" | "entidades";

export default function ImportarDadosPage() {
  const [target, setTarget] = useState<ImportTarget>("itens");
  const [csvResult, setCsvResult] = useState<CSVParseResult | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<{ ok: number; err: number } | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const fields = target === "itens" ? ITEM_FIELDS : ENTIDADE_FIELDS;

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStats(null);
    setFileName(file.name);
    try {
      const text = await readFileAsText(file);
      const result = parseCSV(text);
      setCsvResult(result);
      // Auto-map by fuzzy header matching
      const autoMappings: ColumnMapping[] = result.headers.map((h) => {
        const lower = h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const match = fields.find((f) => {
          const fl = f.label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return lower.includes(fl) || fl.includes(lower) || f.value === lower;
        });
        return { csvColumn: h, dbField: match?.value || "__ignorar" };
      });
      setMappings(autoMappings);
    } catch {
      centralToast.error("Erro ao ler arquivo CSV");
    }
    // Reset input
    e.target.value = "";
  }, [fields]);

  const updateMapping = (csvCol: string, dbField: string) => {
    setMappings((prev) => prev.map((m) => (m.csvColumn === csvCol ? { ...m, dbField } : m)));
  };

  const handleImport = async () => {
    if (!csvResult) return;
    setImporting(true);
    let ok = 0;
    let err = 0;

    for (const row of csvResult.rows) {
      const record: Record<string, string> = {};
      mappings.forEach((m, idx) => {
        if (m.dbField !== "__ignorar" && row[idx]) {
          record[m.dbField] = row[idx];
        }
      });

      // Skip rows without required fields
      if (target === "itens" && !record.descricao_interna) { err++; continue; }
      if (target === "entidades" && !record.razao_social) { err++; continue; }

      try {
        if (target === "itens") {
          const payload = {
            descricao_interna: record.descricao_interna || "",
            sku_interno: record.sku_interno || null,
            tipo_item: record.tipo_item || "MP",
            unidade_interna: record.unidade_interna || "g",
            ncm: record.ncm || null,
            categoria_operacional: record.categoria_operacional || null,
            armazenamento: record.armazenamento || "AMBIENTE",
          };
          const { error } = await supabase.from("itens").insert(payload);
          if (error) throw error;
        } else {
          const payload = {
            razao_social: record.razao_social || "",
            nome_fantasia: record.nome_fantasia || null,
            documento: record.documento || "000.000.000-00",
            tipo_pessoa: record.tipo_pessoa || "PJ",
            ie: record.ie || null,
            status: record.status || "ATIVO",
          };
          const { error } = await supabase.from("entidades").insert(payload);
          if (error) throw error;
        }
        ok++;
      } catch (e) {
        console.error("Import row error:", e);
        err++;
      }
    }

    setImportStats({ ok, err });
    setImporting(false);
    if (err === 0) {
      centralToast.success(`${ok} registros importados com sucesso!`);
    } else {
      centralToast.warning(`${ok} importados, ${err} com erro.`);
    }
  };

  const reset = () => {
    setCsvResult(null);
    setMappings([]);
    setImportStats(null);
    setFileName("");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Importar Dados (CSV)"
        description="Importe itens ou entidades em massa a partir de planilhas CSV/Excel"
        icon={FileSpreadsheet}
      />

      {/* Step 1: Target + File */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            1. Selecionar arquivo
          </CardTitle>
          <CardDescription>Escolha o tipo de cadastro e envie seu arquivo CSV (separado por ; ou ,)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Importar para:</label>
              <Select value={target} onValueChange={(v) => { setTarget(v as ImportTarget); reset(); }}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="itens">Itens / Produtos</SelectItem>
                  <SelectItem value="entidades">Entidades (Fornecedores/Clientes)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="cursor-pointer">
                <input type="file" accept=".csv,.tsv,.txt" className="hidden" onChange={handleFile} />
                <Button variant="outline" asChild>
                  <span><Upload className="h-4 w-4 mr-2" /> Selecionar CSV</span>
                </Button>
              </label>
            </div>
            {fileName && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileSpreadsheet className="h-4 w-4" />
                {fileName}
                <button onClick={reset} className="text-destructive hover:text-destructive/80">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {csvResult && csvResult.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{csvResult.errors.join("; ")}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Column Mapping */}
      {csvResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              2. Mapear colunas
            </CardTitle>
            <CardDescription>
              Associe cada coluna do CSV ao campo correspondente. {csvResult.totalRows} linhas detectadas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mappings.map((m) => (
                <div key={m.csvColumn} className="flex items-center gap-2 p-2 rounded border bg-muted/30">
                  <Badge variant="secondary" className="min-w-[120px] justify-center text-xs truncate">
                    {m.csvColumn}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select value={m.dbField} onValueChange={(v) => updateMapping(m.csvColumn, v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview first 5 rows */}
            <div className="mt-4 overflow-auto max-h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {csvResult.headers.map((h, i) => (
                      <TableHead key={i} className="text-xs whitespace-nowrap">{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {csvResult.rows.slice(0, 5).map((row, ri) => (
                    <TableRow key={ri}>
                      {row.map((cell, ci) => (
                        <TableCell key={ci} className="text-xs py-1 whitespace-nowrap">{cell}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {csvResult.totalRows > 5 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  ... e mais {csvResult.totalRows - 5} linhas
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Import */}
      {csvResult && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              3. Importar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {importStats && (
              <Alert variant={importStats.err > 0 ? "destructive" : "default"}>
                <AlertDescription>
                  <strong>{importStats.ok}</strong> registros importados com sucesso.
                  {importStats.err > 0 && <> <strong>{importStats.err}</strong> com erro.</>}
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={handleImport} disabled={importing} className="w-full" size="lg">
              {importing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Importar {csvResult.totalRows} registros</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
