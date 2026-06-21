import { useState, useEffect } from "react";
import { Bot, Eye, EyeOff, Save, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConfigRow {
  chave: string;
  valor: string | null;
  descricao: string | null;
  categoria: string;
  ativo: boolean;
}

const CHAVES_CONFIG: { chave: string; label: string; descricao: string; placeholder: string }[] = [
  {
    chave: "gemini_api_key",
    label: "BrainX IA — Chave de Análise",
    descricao: "Habilita o módulo BrainX ANVISA Checker, assistente de IA e análise regulatória para TODOS os usuários do sistema.",
    placeholder: "AIzaSy...",
  },
  {
    chave: "firecrawl_api_key",
    label: "BrainX Sync ANVISA — Chave de Sincronização",
    descricao: "Habilita a sincronização automática da base ANVISA (Power BI + portal gov.br) para todos os tenants.",
    placeholder: "fc-...",
  },
];

export function ErpIAConfigPanel() {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [visible, setVisible] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Record<string, "ok" | "empty" | "loading">>({});
  const [loading, setLoading] = useState(true);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("erp_system_config")
        .select("chave, valor, descricao, categoria, ativo")
        .in("chave", CHAVES_CONFIG.map((c) => c.chave));

      if (error) throw error;

      const map: Record<string, string> = {};
      const st: Record<string, "ok" | "empty" | "loading"> = {};

      for (const row of (data as ConfigRow[]) || []) {
        map[row.chave] = row.valor || "";
        st[row.chave] = row.valor ? "ok" : "empty";
      }

      // Chaves que ainda não existem no banco
      for (const c of CHAVES_CONFIG) {
        if (!(c.chave in map)) {
          map[c.chave] = "";
          st[c.chave] = "empty";
        }
      }

      setConfigs(map);
      setStatus(st);
    } catch (e: any) {
      toast.error("Erro ao carregar configurações: " + (e?.message || "?"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  const handleSave = async (chave: string) => {
    const valor = configs[chave]?.trim();
    setSaving((s) => ({ ...s, [chave]: true }));
    try {
      const { error } = await supabase
        .from("erp_system_config")
        .upsert(
          { chave, valor: valor || null, ativo: true },
          { onConflict: "chave" }
        );

      if (error) throw error;

      setStatus((s) => ({ ...s, [chave]: valor ? "ok" : "empty" }));
      toast.success(valor ? "Chave salva com sucesso! Todos os usuários já podem usar o módulo." : "Chave removida.");
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message || "?"));
    } finally {
      setSaving((s) => ({ ...s, [chave]: false }));
    }
  };

  return (
    <Card className="mt-6 border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">Integrações de IA — Configuração Global</CardTitle>
              <CardDescription>
                Configuradas aqui uma única vez pelo Super Admin — valem para <strong>todos os usuários e empresas</strong> do sistema.
              </CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={loadConfigs} disabled={loading} title="Recarregar">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Carregando configurações...
          </div>
        ) : (
          CHAVES_CONFIG.map((cfg) => (
            <div key={cfg.chave} className="space-y-2 p-4 rounded-xl border bg-muted/20">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">{cfg.label}</Label>
                {status[cfg.chave] === "ok" ? (
                  <Badge variant="default" className="gap-1 bg-green-600/80 text-white">
                    <CheckCircle2 className="h-3 w-3" /> Ativo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="gap-1 text-orange-500 border-orange-500/30">
                    <AlertCircle className="h-3 w-3" /> Não configurado
                  </Badge>
                )}
              </div>

              <p className="text-xs text-muted-foreground">{cfg.descricao}</p>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={visible[cfg.chave] ? "text" : "password"}
                    placeholder={cfg.placeholder}
                    value={configs[cfg.chave] || ""}
                    onChange={(e) =>
                      setConfigs((prev) => ({ ...prev, [cfg.chave]: e.target.value }))
                    }
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() =>
                      setVisible((v) => ({ ...v, [cfg.chave]: !v[cfg.chave] }))
                    }
                  >
                    {visible[cfg.chave] ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <Button
                  onClick={() => handleSave(cfg.chave)}
                  disabled={saving[cfg.chave]}
                  size="sm"
                  className="gap-2 shrink-0"
                >
                  {saving[cfg.chave] ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar
                </Button>
              </div>
            </div>
          ))
        )}

        <p className="text-xs text-muted-foreground border-t pt-3">
          🔒 As chaves são armazenadas no banco de dados com acesso restrito ao Super Admin.
          As Edge Functions lêem as chaves diretamente do banco em tempo de execução.
        </p>
      </CardContent>
    </Card>
  );
}
