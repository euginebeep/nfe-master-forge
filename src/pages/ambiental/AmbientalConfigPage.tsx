import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Wifi,
  Thermometer,
  Plus,
  Trash2,
  Edit2,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  ExternalLink,
  RefreshCw,
  Search,
  Link2,
} from "lucide-react";
import { supabase, SUPABASE_URL } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import {
  useAmbientalTempoReal,
  SEM_COMUNICACAO_SEGUNDOS,
  fmtAtualizadoHa,
} from "@/hooks/use-sensor-readings";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type AmbientalConfig = {
  id?: string;
  company_id?: string;
  ewelink_app_id: string | null;
  ewelink_app_secret: string | null;
  ewelink_region: string;
  ewelink_access_token: string | null;
  ewelink_refresh_token: string | null;
  token_expires_at: string | null;
  sync_interval_seconds: number;
  ativo: boolean;
  ultima_sync: string | null;
};

type AmbientalSensor = {
  id: string;
  company_id: string;
  device_id: string;
  device_name: string | null;
  sala: string;
  room_name: string;
  temp_min: number;
  temp_max: number;
  hum_min: number;
  hum_max: number;
  responsible: string | null;
  ativo: boolean;
  ewelink_online: boolean | null;
};

const SALAS_SUGERIDAS = [
  "Produção",
  "Pesagem",
  "Envase",
  "Armazenamento",
  "Microbiologia",
  "Rotulagem",
  "Vestiário",
  "Refeitório",
];

const EMPTY_SENSOR_FORM = {
  device_id: "",
  device_name: "",
  sala: "",
  temp_min: 18,
  temp_max: 25,
  hum_min: 40,
  hum_max: 60,
  responsible: "",
  ativo: true,
};

// Helper para chamar a Edge Function ewelink-sync
async function callEwelinkSync(action: string, body: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("ewelink-sync", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message ?? "Erro na comunicação com eWeLink");
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function AmbientalConfigPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: companyId } = useUserCompanyId();

  // ---------- Credenciais ----------
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [region, setRegion] = useState("eu");
  const [syncInterval, setSyncInterval] = useState("60");
  const [ativo, setAtivo] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<{
    discovered: number;
    inserted: number;
    updated: number;
    sensors: any[];
    message: string;
  } | null>(null);

  const { data: config, isLoading: loadingConfig } = useQuery({
    queryKey: ["ambiental_config", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<AmbientalConfig | null> => {
      const { data, error } = await (supabase as any)
        .from("ambiental_config")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setAppId(config.ewelink_app_id ?? "");
      setAppSecret(config.ewelink_app_secret ?? "");
      setRegion(config.ewelink_region ?? "eu");
      setSyncInterval(String(config.sync_interval_seconds ?? 60));
      setAtivo(!!config.ativo);
    }
  }, [config]);

  // Verificar se voltou de um OAuth callback da Edge Function
  // A Edge Function processa o code e redireciona com ?ewelink_connected=1 ou ?ewelink_error=...
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("ewelink_connected");
    const ewelinkError = params.get("ewelink_error");

    if (connected === "1") {
      // Limpar a URL
      window.history.replaceState({}, "", window.location.pathname);
      queryClient.invalidateQueries({ queryKey: ["ambiental_config", companyId] });
      toast({
        title: "✅ Conta eWeLink conectada!",
        description: "Agora clique em Descobrir Sensores para importar seus dispositivos.",
      });
    } else if (ewelinkError) {
      window.history.replaceState({}, "", window.location.pathname);
      toast({
        title: "Erro ao conectar conta eWeLink",
        description: decodeURIComponent(ewelinkError),
        variant: "destructive",
      });
    }
  }, [companyId]);

  const saveConfigMutation = useMutation({
    mutationFn: async (payload: Partial<AmbientalConfig>) => {
      if (!companyId) throw new Error("Empresa não identificada");
      const upsertPayload = {
        company_id: companyId,
        ewelink_app_id: payload.ewelink_app_id ?? appId,
        ewelink_app_secret: payload.ewelink_app_secret ?? appSecret,
        ewelink_region: payload.ewelink_region ?? region,
        sync_interval_seconds: payload.sync_interval_seconds ?? Number(syncInterval),
        ativo: payload.ativo ?? ativo,
      };
      const { error } = await (supabase as any)
        .from("ambiental_config")
        .upsert(upsertPayload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ambiental_config", companyId] });
      toast({ title: "Configuração salva com sucesso" });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  });

  const handleSaveCredentials = () => {
    if (!appId || !appSecret) {
      toast({ title: "Preencha App ID e App Secret", variant: "destructive" });
      return;
    }
    saveConfigMutation.mutate({
      ewelink_app_id: appId,
      ewelink_app_secret: appSecret,
      ewelink_region: region,
      sync_interval_seconds: Number(syncInterval),
    });
  };

  const handleToggleAtivo = (v: boolean) => {
    setAtivo(v);
    saveConfigMutation.mutate({ ativo: v });
  };

  // Iniciar fluxo OAuth2 — abre a página de autorização eWeLink
  // A Redirect URL é a Edge Function do Supabase (cadastrada no dev.ewelink.cc)
  // Ela processa o code, salva o token e redireciona de volta para o ERP
  const EWELINK_REDIRECT_URL = `${SUPABASE_URL}/functions/v1/ewelink-sync`;

  const handleConnectEwelink = async () => {
    if (!appId || !appSecret) {
      toast({
        title: "Salve as credenciais primeiro",
        description: "Preencha e salve o App ID e App Secret antes de conectar.",
        variant: "destructive",
      });
      return;
    }

    setIsConnecting(true);
    try {
      const result = await callEwelinkSync("get-auth-url", { redirectUrl: EWELINK_REDIRECT_URL });
      if (result?.authUrl) {
        window.location.href = result.authUrl;
      }
    } catch (err: any) {
      toast({
        title: "Erro ao gerar URL de autorização",
        description: err.message,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  // Descobrir sensores automaticamente via API eWeLink
  const handleDiscoverSensors = async () => {
    setIsDiscovering(true);
    setDiscoveryResult(null);
    try {
      const result = await callEwelinkSync("discover");
      setDiscoveryResult(result);
      
      // Adicionar automaticamente sensores descobertos
      if (result.sensors && result.sensors.length > 0) {
        let addedCount = 0;
        for (const sensor of result.sensors) {
          try {
            // Verificar se sensor já existe
            const { data: existing } = await supabase
              .from("ambiental_sensores")
              .select("id")
              .eq("company_id", companyId)
              .eq("device_id", sensor.device_id)
              .single();
            
            if (!existing) {
              // Adicionar novo sensor
              await supabase.from("ambiental_sensores").insert({
                company_id: companyId,
                device_id: sensor.device_id,
                device_name: sensor.name,
                sala: "Não configurado",
                temp_min: 18,
                temp_max: 25,
                hum_min: 40,
                hum_max: 60,
                ativo: true,
              });
              addedCount++;
            }
          } catch (err) {
            console.error(`Erro ao adicionar sensor ${sensor.device_id}:`, err);
          }
        }
        
        if (addedCount > 0) {
          toast({
            title: `${addedCount} sensor(es) adicionado(s) automaticamente`,
            description: `${result.discovered} sensor(es) encontrado(s) no total`,
          });
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ["ambiental_sensores", companyId] });
      toast({
        title: `${result.discovered} sensor(es) encontrado(s)`,
        description: result.message,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao descobrir sensores",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsDiscovering(false);
    }
  };

  // Status badge
  const isTokenValid =
    config?.ewelink_access_token &&
    config?.token_expires_at &&
    new Date(config.token_expires_at) > new Date();

  const connectionStatus = (() => {
    if (!config || !config.ewelink_app_id)
      return { label: "Não configurado", variant: "secondary" as const, icon: AlertCircle };
    if (config.token_expires_at && new Date(config.token_expires_at) < new Date())
      return { label: "Token expirado — reconectar", variant: "destructive" as const, icon: AlertCircle };
    if (isTokenValid)
      return { label: "Conta autorizada", variant: "default" as const, icon: CheckCircle };
    if (config.ewelink_app_id)
      return { label: "Credenciais salvas — autorizar conta", variant: "secondary" as const, icon: AlertCircle };
    return { label: "Não configurado", variant: "secondary" as const, icon: AlertCircle };
  })();

  // ---------- Sensores ----------
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sensorForm, setSensorForm] = useState({ ...EMPTY_SENSOR_FORM });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const { data: sensores = [], isLoading: loadingSensores } = useQuery({
    queryKey: ["ambiental_sensores", companyId],
    enabled: !!companyId,
    queryFn: async (): Promise<AmbientalSensor[]> => {
      const { data, error } = await (supabase as any)
        .from("ambiental_sensores")
        .select("*")
        .eq("company_id", companyId)
        .order("sala", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: tempoReal = [] } = useAmbientalTempoReal();
  const tempoRealByDevice = Object.fromEntries(
    tempoReal.map((r) => [r.device_id, r]),
  );

  const upsertSensorMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Empresa não identificada");
      const payload = {
        device_id: sensorForm.device_id,
        device_name: sensorForm.device_name,
        sala: sensorForm.sala,
        room_name: sensorForm.sala, // sincronizar room_name com sala
        temp_min: Number(sensorForm.temp_min),
        temp_max: Number(sensorForm.temp_max),
        hum_min: Number(sensorForm.hum_min),
        hum_max: Number(sensorForm.hum_max),
        responsible: sensorForm.responsible,
        ativo: sensorForm.ativo,
        company_id: companyId,
      };
      if (editingId) {
        // Para UPDATE, remover campos que não devem ser atualizados
        const updatePayload = { ...payload };
        delete (updatePayload as any).company_id; // não atualizar company_id
        delete (updatePayload as any).device_id; // não atualizar device_id
        const { error } = await (supabase as any)
          .from("ambiental_sensores")
          .update(updatePayload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("ambiental_sensores")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ambiental_sensores", companyId] });
      toast({ title: editingId ? "Sensor atualizado" : "Sensor adicionado" });
      setDialogOpen(false);
      setEditingId(null);
      setSensorForm({ ...EMPTY_SENSOR_FORM });
    },
    onError: (e: any) =>
      toast({ title: "Erro ao salvar sensor", description: e.message, variant: "destructive" }),
  });

  const deleteSensorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("ambiental_sensores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ambiental_sensores", companyId] });
      toast({ title: "Sensor removido" });
      setConfirmDeleteId(null);
    },
    onError: (e: any) =>
      toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }),
  });

  const toggleSensorAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await (supabase as any)
        .from("ambiental_sensores")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["ambiental_sensores", companyId] }),
  });

  const openCreate = () => {
    setEditingId(null);
    setSensorForm({ ...EMPTY_SENSOR_FORM });
    setDialogOpen(true);
  };

  const openEdit = (s: AmbientalSensor) => {
    setEditingId(s.id);
    setSensorForm({
      device_id: s.device_id,
      device_name: s.device_name ?? "",
      sala: s.sala ?? s.room_name ?? "",
      temp_min: s.temp_min,
      temp_max: s.temp_max,
      hum_min: s.hum_min,
      hum_max: s.hum_max,
      responsible: s.responsible ?? "",
      ativo: s.ativo,
    });
    setDialogOpen(true);
  };

  const handleSaveSensor = () => {
    if (!sensorForm.device_id || !sensorForm.sala) {
      toast({ title: "Device ID e Sala são obrigatórios", variant: "destructive" });
      return;
    }
    if (Number(sensorForm.temp_min) >= Number(sensorForm.temp_max)) {
      toast({ title: "Temperatura mínima deve ser menor que a máxima", variant: "destructive" });
      return;
    }
    if (Number(sensorForm.hum_min) >= Number(sensorForm.hum_max)) {
      toast({ title: "Umidade mínima deve ser menor que a máxima", variant: "destructive" });
      return;
    }
    upsertSensorMutation.mutate();
  };

  const StatusIcon = connectionStatus.icon;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <PageHeader
        title="Configuração — Monitoramento Ambiental"
        description="Configure seus sensores e mapeie os limites de temperatura e umidade por sala"
        icon={Settings}
      />

      <Tabs defaultValue="credenciais" className="w-full">
        <TabsList>
          <TabsTrigger value="credenciais">Credenciais eWeLink</TabsTrigger>
          <TabsTrigger value="sensores">Sensores por Sala</TabsTrigger>
        </TabsList>

        {/* ====== TAB 1: CREDENCIAIS ====== */}
        <TabsContent value="credenciais" className="space-y-6 mt-6">
          {/* Banner informativo */}
          <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="space-y-2 text-sm">
                  <p className="text-blue-900 dark:text-blue-100">
                    Para obter as credenciais, acesse{" "}
                    <span className="font-semibold">dev.ewelink.cc</span>, crie um
                    aplicativo OAuth2 e copie o App ID e App Secret. A{" "}
                    <strong>Redirect URL</strong> do aplicativo deve ser configurada para:{" "}
                    <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">
                      {window.location.origin}/ambiental/configuracao
                    </code>
                  </p>
                  <a
                    href="https://dev.ewelink.cc"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 font-medium hover:underline"
                  >
                    Acessar dev.ewelink.cc <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Credenciais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wifi className="h-5 w-5" />
                Credenciais da API eWeLink
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="app_id">eWeLink App ID</Label>
                  <Input
                    id="app_id"
                    value={appId}
                    onChange={(e) => setAppId(e.target.value)}
                    placeholder="Ex.: GwHbUmFNUBUXsDaCigs..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="app_secret">eWeLink App Secret</Label>
                  <div className="relative">
                    <Input
                      id="app_secret"
                      type={showSecret ? "text" : "password"}
                      value={appSecret}
                      onChange={(e) => setAppSecret(e.target.value)}
                      placeholder="••••••••••••"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="region">Região</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger id="region">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eu">EU — Europa / Brasil</SelectItem>
                      <SelectItem value="us">US — América</SelectItem>
                      <SelectItem value="as">AS — Ásia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sync">Frequência de coleta</Label>
                  <Select value={syncInterval} onValueChange={setSyncInterval}>
                    <SelectTrigger id="sync">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 segundos</SelectItem>
                      <SelectItem value="60">60 segundos</SelectItem>
                      <SelectItem value="120">2 minutos</SelectItem>
                      <SelectItem value="300">5 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleSaveCredentials}
                  disabled={saveConfigMutation.isPending || loadingConfig}
                >
                  Salvar Credenciais
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status da Conexão */}
          <Card>
            <CardHeader>
              <CardTitle>Status da Conexão</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Badge variant={connectionStatus.variant} className="gap-1.5">
                    <StatusIcon className="h-3.5 w-3.5" />
                    {connectionStatus.label}
                  </Badge>
                  {config?.ultima_sync && (
                    <span className="text-xs text-muted-foreground">
                      Última sync: {new Date(config.ultima_sync).toLocaleString("pt-BR")}
                    </span>
                  )}
                </div>

                {/* Botão Conectar / Reconectar — sempre visível */}
                <Button
                  variant={isTokenValid ? "outline" : "default"}
                  size="sm"
                  onClick={handleConnectEwelink}
                  disabled={isConnecting}
                  className="gap-2"
                >
                  {isConnecting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  {isTokenValid ? "Reconectar conta eWeLink" : "Conectar conta eWeLink"}
                </Button>
              </div>

              {/* Instrução quando não tem token */}
              {!isTokenValid && (
                <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                  <strong>Próximo passo:</strong> Clique em{" "}
                  <strong>"Conectar conta eWeLink"</strong> para autorizar o acesso aos
                  seus dispositivos. Você será redirecionado para a página de login do eWeLink.
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t">
                <div className="space-y-1">
                  <Label htmlFor="ativo-switch" className="text-sm">
                    Ativar monitoramento automático
                  </Label>
                </div>
                <Switch
                  id="ativo-switch"
                  checked={ativo}
                  onCheckedChange={handleToggleAtivo}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Quando ativado, o sistema sincroniza os dados automaticamente conforme
                o intervalo configurado.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ====== TAB 2: SENSORES ====== */}
        <TabsContent value="sensores" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Thermometer className="h-5 w-5" />
                  Sensores Mapeados
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                  Importe automaticamente os sensores da sua conta eWeLink ou adicione
                  manualmente. Defina os limites de temperatura e umidade. O nome da sala é apenas uma referência do ERP.
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {/* Botão Descobrir Sensores — visível sempre, desabilitado sem token */}
                <Button
                  variant="outline"
                  onClick={handleDiscoverSensors}
                  disabled={isDiscovering || !isTokenValid}
                  title={!isTokenValid ? "Conecte sua conta eWeLink primeiro" : undefined}
                  className="gap-2"
                >
                  {isDiscovering ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Descobrir Sensores
                </Button>
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar Sensor
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Resultado da descoberta */}
              {discoveryResult && (
                <div className="mb-4 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-4 space-y-2">
                  <p className="text-sm font-medium text-green-800 dark:text-green-200">
                    ✅ {discoveryResult.message}
                  </p>
                  {discoveryResult.sensors.length > 0 && (
                    <div className="space-y-1">
                      {discoveryResult.sensors.map((s: any) => (
                        <div key={s.device_id} className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300">
                          <span className={`h-2 w-2 rounded-full ${s.online ? "bg-green-500" : "bg-gray-400"}`} />
                          <span className="font-mono">{s.device_id}</span>
                          <span>{s.name}</span>
                          {s.temperature !== null && (
                            <span className="text-muted-foreground">— {s.temperature}°C</span>
                          )}
                          {s.humidity !== null && (
                            <span className="text-muted-foreground">/ {s.humidity}%</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="text-xs text-green-600 dark:text-green-400 hover:underline"
                    onClick={() => setDiscoveryResult(null)}
                  >
                    Fechar
                  </button>
                </div>
              )}

              {/* Aviso se não tem token */}
              {!isTokenValid && (
                <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 text-sm text-amber-800 dark:text-amber-200">
                  Para descobrir sensores automaticamente, primeiro{" "}
                  <strong>conecte sua conta eWeLink</strong> na aba{" "}
                  <strong>Credenciais eWeLink</strong>.
                </div>
              )}

              {loadingSensores ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Carregando sensores...
                </div>
              ) : sensores.length === 0 ? (
                <EmptyState
                  icon={Wifi}
                  title="Nenhum sensor configurado"
                  description={
                    isTokenValid
                      ? 'Clique em "Descobrir Sensores" para importar automaticamente ou adicione manualmente.'
                      : 'Conecte sua conta eWeLink para descobrir sensores automaticamente.'
                  }
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sala</TableHead>
                      <TableHead>Device ID</TableHead>
                      <TableHead>Temp (Min–Max °C)</TableHead>
                      <TableHead>Umid (Min–Max %)</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Conexão</TableHead>
                      <TableHead>Monitorar</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sensores.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Thermometer className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{s.sala || s.device_name || s.room_name || "Sem nome"}</div>
                              {s.device_id && (
                                <div className="text-xs text-muted-foreground">
                                  {s.device_id}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="font-mono text-xs">
                            {s.device_id}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.temp_min}–{s.temp_max} °C
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.hum_min}–{s.hum_max} %
                        </TableCell>
                        <TableCell>{s.responsible || "—"}</TableCell>
                        <TableCell>
                          {(() => {
                            const tr = tempoRealByDevice[s.device_id];
                            const online =
                              tr != null && tr.segundos_atras <= SEM_COMUNICACAO_SEGUNDOS;
                            const label = !tr
                              ? "Sem dados"
                              : online
                                ? "Online"
                                : "Sem comunicação";
                            const title = !tr
                              ? "Nenhuma leitura recebida ainda"
                              : `${fmtAtualizadoHa(tr.segundos_atras)}${
                                  s.ewelink_online != null
                                    ? ` · eWeLink: ${s.ewelink_online ? "online" : "offline"}`
                                    : ""
                                }`;
                            return (
                              <Badge
                                variant={online ? "secondary" : "outline"}
                                className={cn(
                                  "gap-1",
                                  !online && "border-red-200 text-red-700",
                                )}
                                title={title}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    online ? "bg-emerald-500" : "bg-red-500"
                                  }`}
                                />
                                {label}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={s.ativo}
                            onCheckedChange={(v) =>
                              toggleSensorAtivoMutation.mutate({ id: s.id, ativo: v })
                            }
                            title="Controle manual: liga/desliga o monitoramento deste sensor no ERP"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(s)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setConfirmDeleteId(s.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ====== DIALOG SENSOR ====== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Editar Sensor" : "Adicionar Sensor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="device_id">
                Device ID do eWeLink <span className="text-destructive">*</span>
              </Label>
              <Input
                id="device_id"
                value={sensorForm.device_id}
                onChange={(e) =>
                  setSensorForm({ ...sensorForm, device_id: e.target.value })
                }
                placeholder="ex: 1000abcd"
              />
              <p className="text-xs text-muted-foreground">
                Encontre o Device ID no app eWeLink → dispositivo → informações
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="device_name">Nome do dispositivo</Label>
              <Input
                id="device_name"
                value={sensorForm.device_name}
                onChange={(e) =>
                  setSensorForm({ ...sensorForm, device_name: e.target.value })
                }
                placeholder="ex: Sensor Produção 01"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sala">
                Referência da Sala (Rótulo do ERP) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sala"
                value={sensorForm.sala}
                onChange={(e) =>
                  setSensorForm({ ...sensorForm, sala: e.target.value })
                }
                placeholder="ex: Produção"
              />
              <p className="text-xs text-muted-foreground">
                Esta é apenas uma referência/rótulo para organizar o sensor no ERP. Você pode alterar sem afetar o sensor IoT.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SALAS_SUGERIDAS.map((sala) => (
                  <button
                    key={sala}
                    type="button"
                    onClick={() => setSensorForm({ ...sensorForm, sala })}
                    className="px-2.5 py-1 rounded-full bg-muted text-xs hover:bg-muted-foreground/20 transition"
                  >
                    {sala}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="temp_min">Temperatura mínima</Label>
                <div className="relative">
                  <Input
                    id="temp_min"
                    type="number"
                    value={sensorForm.temp_min}
                    onChange={(e) =>
                      setSensorForm({ ...sensorForm, temp_min: Number(e.target.value) })
                    }
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    °C
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="temp_max">Temperatura máxima</Label>
                <div className="relative">
                  <Input
                    id="temp_max"
                    type="number"
                    value={sensorForm.temp_max}
                    onChange={(e) =>
                      setSensorForm({ ...sensorForm, temp_max: Number(e.target.value) })
                    }
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    °C
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hum_min">Umidade mínima</Label>
                <div className="relative">
                  <Input
                    id="hum_min"
                    type="number"
                    value={sensorForm.hum_min}
                    onChange={(e) =>
                      setSensorForm({ ...sensorForm, hum_min: Number(e.target.value) })
                    }
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hum_max">Umidade máxima</Label>
                <div className="relative">
                  <Input
                    id="hum_max"
                    type="number"
                    value={sensorForm.hum_max}
                    onChange={(e) =>
                      setSensorForm({ ...sensorForm, hum_max: Number(e.target.value) })
                    }
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="responsible">Responsável</Label>
              <Input
                id="responsible"
                value={sensorForm.responsible}
                onChange={(e) =>
                  setSensorForm({ ...sensorForm, responsible: e.target.value })
                }
                placeholder="Nome do responsável pela sala"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveSensor} disabled={upsertSensorMutation.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="Remover sensor?"
        description="Esta ação não pode ser desfeita. O sensor será removido permanentemente."
        confirmLabel="Remover"
        variant="destructive"
        onConfirm={() => confirmDeleteId && deleteSensorMutation.mutate(confirmDeleteId)}
      />
    </div>
  );
}
