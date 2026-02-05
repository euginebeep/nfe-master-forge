import { useState, useEffect } from "react";
import { ShieldAlert, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STORAGE_PREFIX = "legacy_erp_";

// All collections to be cleaned
const ALL_COLLECTIONS = [
  { key: "company", label: "Empresa" },
  { key: "entidades", label: "Entidades (Fornecedores/Clientes)" },
  { key: "entidade_contatos", label: "Contatos de Entidades" },
  { key: "entidade_enderecos", label: "Endereços de Entidades" },
  { key: "itens", label: "Produtos/Insumos" },
  { key: "item_fornecedores", label: "Vínculos Item-Fornecedor" },
  { key: "item_alias", label: "Aliases de Itens" },
  { key: "estoque_lotes", label: "Lotes de Estoque" },
  { key: "lote_documentos", label: "Documentos de Lotes" },
  { key: "notas_entrada", label: "Notas de Entrada" },
  { key: "notas_entrada_itens", label: "Itens de Notas de Entrada" },
  { key: "notas_fiscais", label: "Notas Fiscais" },
  { key: "notas_fiscais_observacoes", label: "Observações de NF" },
  { key: "notas_fiscais_itens", label: "Itens de NF" },
  { key: "notas_fiscais_itens_impostos", label: "Impostos de NF" },
  { key: "notas_fiscais_itens_rastros", label: "Rastros de NF" },
  { key: "notas_fiscais_totais", label: "Totais de NF" },
  { key: "notas_fiscais_transporte", label: "Transporte de NF" },
  { key: "notas_fiscais_volumes", label: "Volumes de NF" },
  { key: "notas_fiscais_faturas", label: "Faturas de NF" },
  { key: "notas_fiscais_duplicatas", label: "Duplicatas de NF" },
  { key: "notas_fiscais_pagamentos", label: "Pagamentos de NF" },
  { key: "contas_pagar", label: "Contas a Pagar" },
  { key: "importacao_logs", label: "Logs de Importação" },
  { key: "arquivos", label: "Arquivos" },
  { key: "audit_log", label: "Logs de Auditoria" },
];

interface CleanupStep {
  key: string;
  label: string;
  status: "pending" | "cleaning" | "done";
  count?: number;
}

export default function AdminMasterPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [steps, setSteps] = useState<CleanupStep[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const canConfirm = confirmText.toUpperCase() === "APAGAR TUDO";

  const startCleanup = async () => {
    setConfirmOpen(false);
    setConfirmText("");
    setCleaning(true);
    setCompleted(false);
    setProgress(0);

    // Initialize steps
    const initialSteps: CleanupStep[] = ALL_COLLECTIONS.map((c) => ({
      key: c.key,
      label: c.label,
      status: "pending",
    }));
    setSteps(initialSteps);

    // Process each collection
    for (let i = 0; i < ALL_COLLECTIONS.length; i++) {
      const collection = ALL_COLLECTIONS[i];
      const storageKey = `${STORAGE_PREFIX}${collection.key}`;

      setCurrentStep(collection.key);
      setSteps((prev) =>
        prev.map((s) =>
          s.key === collection.key ? { ...s, status: "cleaning" } : s
        )
      );

      // Get count before deletion
      let count = 0;
      try {
        const data = localStorage.getItem(storageKey);
        if (data) {
          const parsed = JSON.parse(data);
          count = Array.isArray(parsed) ? parsed.length : 1;
        }
      } catch {
        count = 0;
      }

      // Simulate some delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Delete the collection
      localStorage.removeItem(storageKey);

      setSteps((prev) =>
        prev.map((s) =>
          s.key === collection.key ? { ...s, status: "done", count } : s
        )
      );

      setProgress(Math.round(((i + 1) / ALL_COLLECTIONS.length) * 100));
    }

    // Also clear any other legacy_erp_ keys that might exist
    const allKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        allKeys.push(key);
      }
    }
    allKeys.forEach((key) => localStorage.removeItem(key));

    setCurrentStep(null);
    setCleaning(false);
    setCompleted(true);

    // Dispatch event to update any listening components
    window.dispatchEvent(
      new CustomEvent("localdb:change", { detail: { collection: "*" } })
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="Admin Master"
        description="Área restrita - Operações administrativas avançadas"
        icon={ShieldAlert}
      />

      <Card className="border-destructive/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Trash2 className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <CardTitle className="text-destructive">Limpeza Total</CardTitle>
              <CardDescription>
                Remove todos os dados do sistema: cadastros, logs, notas fiscais
                e configurações.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!cleaning && !completed && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  <p className="font-semibold mb-1">ATENÇÃO: Ação irreversível!</p>
                  <p>
                    Esta operação apaga permanentemente todos os dados do
                    sistema. Isso inclui produtos, fornecedores, clientes,
                    lotes, notas fiscais, contas a pagar e todos os logs.
                  </p>
                </div>
              </div>

              <Button
                variant="destructive"
                size="lg"
                className="w-full"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="h-5 w-5 mr-2" />
                Executar Limpeza Total
              </Button>
            </>
          )}

          {cleaning && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Progresso da limpeza</span>
                  <span className="text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-3" />
              </div>

              <div className="max-h-80 overflow-y-auto border rounded-lg divide-y">
                {steps.map((step) => (
                  <div
                    key={step.key}
                    className={`flex items-center justify-between px-4 py-2 text-sm ${
                      step.status === "cleaning"
                        ? "bg-destructive/10"
                        : step.status === "done"
                        ? "bg-muted/30"
                        : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {step.status === "cleaning" && (
                        <div className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                      )}
                      {step.status === "done" && (
                        <div className="h-2 w-2 rounded-full bg-success" />
                      )}
                      {step.status === "pending" && (
                        <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                      )}
                      <span
                        className={
                          step.status === "cleaning"
                            ? "text-destructive font-medium"
                            : ""
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                    {step.status === "done" && step.count !== undefined && (
                      <span className="text-muted-foreground text-xs">
                        {step.count} registro(s) removido(s)
                      </span>
                    )}
                    {step.status === "cleaning" && (
                      <span className="text-destructive text-xs">
                        Limpando...
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {completed && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/30">
                <div className="h-8 w-8 rounded-full bg-success flex items-center justify-center">
                  <svg
                    className="h-5 w-5 text-success-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-success">
                    Limpeza concluída com sucesso!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Todos os dados foram removidos do sistema.
                  </p>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-lg divide-y">
                {steps.map((step) => (
                  <div
                    key={step.key}
                    className="flex items-center justify-between px-4 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-success" />
                      <span>{step.label}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      {step.count || 0} removido(s)
                    </span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setCompleted(false);
                  setSteps([]);
                  setProgress(0);
                }}
              >
                Voltar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Limpeza Total
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Você está prestes a apagar <strong>TODOS</strong> os dados do
                sistema. Esta ação é <strong>IRREVERSÍVEL</strong>.
              </p>
              <p>Serão removidos:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Todos os produtos e insumos</li>
                <li>Todos os fornecedores e clientes</li>
                <li>Todos os lotes e documentos</li>
                <li>Todas as notas fiscais</li>
                <li>Todas as contas a pagar</li>
                <li>Todos os logs do sistema</li>
              </ul>
              <div className="pt-2">
                <Label htmlFor="confirm-text" className="text-foreground">
                  Digite <strong className="text-destructive">APAGAR TUDO</strong>{" "}
                  para confirmar:
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="APAGAR TUDO"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmText("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={startCleanup}
              disabled={!canConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
