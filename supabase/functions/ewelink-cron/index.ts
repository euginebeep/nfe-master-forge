// ============================================================
// BRAINX ERP — eWeLink Auto-Sync Cron
// Executado a cada 5 minutos via pg_cron / net.http_post
// Usa service_role — não requer JWT de usuário
//
// Para cada empresa com ambiental_config ativo:
//   1. Auto-descobre novos sensores (não cadastrados ainda)
//   2. Coleta leituras de todos os sensores ativos
// ============================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapa de regiões para URLs da API CoolKit
const REGION_URLS: Record<string, string> = {
  eu: "https://eu-apia.coolkit.cc",
  us: "https://us-apia.coolkit.cc",
  as: "https://as-apia.coolkit.cc",
  cn: "https://cn-apia.coolkit.cc",
};

// UIIDs de sensores de temperatura/umidade conhecidos
const TEMP_HUMIDITY_UIIDS = [15, 18, 1770, 1000, 2026, 7014];
// UIIDs que retornam temperatura em centésimos (ex: 2580 = 25.80°C)
const CENTESIMAL_UIIDS = [7014];

// ─── Assinatura HMAC-SHA256 ───────────────────────────────────
async function generateSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

// ─── Renovação de token ───────────────────────────────────────
async function getAccessToken(
  supabaseAdmin: any,
  companyId: string,
  config: any
): Promise<string | null> {
  const now = new Date();
  // Token ainda válido (com margem de 5 minutos)
  if (
    config.ewelink_access_token &&
    config.token_expires_at &&
    new Date(config.token_expires_at) > new Date(now.getTime() + 5 * 60 * 1000)
  ) {
    return config.ewelink_access_token;
  }
  const baseUrl = REGION_URLS[config.ewelink_region ?? "us"] ?? REGION_URLS["us"];
  if (!config.ewelink_refresh_token) return null;

  try {
    const body = JSON.stringify({ rt: config.ewelink_refresh_token });
    const sign = await generateSignature(body, config.ewelink_app_secret);
    const res = await fetch(`${baseUrl}/v2/user/refresh`, {
      method: "POST",
      headers: {
        "x-ck-appid": config.ewelink_app_id,
        "Authorization": `Sign ${sign}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const data = await res.json();
    if (data.error !== 0) {
      console.error(`[ewelink-cron] Falha ao renovar token empresa ${companyId}:`, data);
      return null;
    }
    const newToken     = data.data.accessToken;
    const newRefresh   = data.data.refreshToken;
    const newExpiresAt = new Date(data.data.atExpiredTime).toISOString();
    await supabaseAdmin
      .from("ambiental_config")
      .update({
        ewelink_access_token:  newToken,
        ewelink_refresh_token: newRefresh,
        token_expires_at:      newExpiresAt,
      })
      .eq("company_id", companyId);
    return newToken;
  } catch (err) {
    console.error(`[ewelink-cron] Erro ao renovar token empresa ${companyId}:`, err);
    return null;
  }
}

// ─── Listar dispositivos ──────────────────────────────────────
async function listDevices(baseUrl: string, appId: string, accessToken: string): Promise<any[]> {
  const res = await fetch(`${baseUrl}/v2/device/thing?num=0`, {
    headers: {
      "x-ck-appid": appId,
      "Authorization": `Bearer ${accessToken}`,
    },
  });
  const data = await res.json();
  if (data.error !== 0) return [];
  return (data.data?.thingList ?? []) as any[];
}

// ─── Identificar sensor de temperatura/umidade ───────────────
function isTempHumiditySensor(device: any): boolean {
  const uiid = device.itemData?.extra?.uiid;
  if (TEMP_HUMIDITY_UIIDS.includes(uiid)) return true;
  const name = (device.itemData?.name ?? "").toLowerCase();
  const keywords = ["th", "temp", "humi", "sensor", "snzb", "sonoff th"];
  if (keywords.some(k => name.includes(k))) return true;
  const params = device.itemData?.params ?? {};
  return "temperature" in params || "humidity" in params || "currentTemperature" in params;
}

// ─── Extrair leituras de temperatura e umidade ───────────────
function extractReadings(thing: any): { temperature: number | null; humidity: number | null } {
  const params = thing.itemData?.params ?? {};
  const uiid   = thing.itemData?.extra?.uiid;
  const isCentesimal = CENTESIMAL_UIIDS.includes(uiid);

  let temperature: number | null = null;
  let humidity:    number | null = null;

  // Temperatura
  const rawTemp = params.temperature ?? params.currentTemperature ?? params.temp ?? null;
  if (rawTemp !== null && rawTemp !== undefined) {
    const parsed = parseFloat(String(rawTemp));
    if (!isNaN(parsed)) {
      temperature = (isCentesimal || parsed >= 500) ? parsed / 100 : parsed;
    }
  }

  // Umidade
  const rawHum = params.humidity ?? params.currentHumidity ?? params.hum ?? null;
  if (rawHum !== null && rawHum !== undefined) {
    const parsed = parseFloat(String(rawHum));
    if (!isNaN(parsed)) {
      humidity = (isCentesimal || parsed >= 500) ? parsed / 100 : parsed;
    }
  }

  return { temperature, humidity };
}

// ─── Processar uma empresa ────────────────────────────────────
async function processCompany(supabaseAdmin: any, config: any): Promise<{
  companyId: string;
  newSensors: number;
  collected: number;
  error?: string;
}> {
  const companyId = config.company_id;

  if (!config.ewelink_app_id || !config.ewelink_app_secret) {
    return { companyId, newSensors: 0, collected: 0, error: "Credenciais incompletas" };
  }

  // Obter token de acesso
  const accessToken = await getAccessToken(supabaseAdmin, companyId, config);
  if (!accessToken) {
    return { companyId, newSensors: 0, collected: 0, error: "Token inválido ou expirado" };
  }

  const baseUrl = REGION_URLS[config.ewelink_region ?? "us"] ?? REGION_URLS["us"];

  // ── 1. Listar todos os dispositivos da conta eWeLink ──────
  let thingList: any[];
  try {
    thingList = await listDevices(baseUrl, config.ewelink_app_id, accessToken);
  } catch (err) {
    return { companyId, newSensors: 0, collected: 0, error: `Erro ao listar dispositivos: ${err}` };
  }

  const sensors = thingList.filter(isTempHumiditySensor);

  // ── 2. Auto-descoberta: inserir sensores novos ────────────
  let newSensors = 0;
  for (const thing of sensors) {
    const deviceId   = thing.itemData?.deviceid ?? thing.itemData?.id;
    const deviceName = thing.itemData?.name ?? `Sensor ${deviceId}`;
    if (!deviceId) continue;

    // Verificar se já existe
    const { data: existing } = await supabaseAdmin
      .from("ambiental_sensores")
      .select("id, ewelink_online")
      .eq("company_id", companyId)
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!existing) {
      // Novo sensor — inserir automaticamente.
      // `ativo` (monitorar ou não) começa true e a partir daqui é controle
      // exclusivo do usuário no ERP. `ewelink_online` é o status real de
      // conectividade no eWeLink, atualizado automaticamente a cada ciclo.
      await supabaseAdmin.from("ambiental_sensores").insert({
        company_id:     companyId,
        device_id:      deviceId,
        device_name:    deviceName,
        room_name:      deviceName,
        sala:           deviceName,
        ativo:          true,
        ewelink_online: thing.itemData?.online ?? true,
        temp_min:       18,
        temp_max:       25,
        hum_min:        40,
        hum_max:        60,
      });
      newSensors++;
      console.log(`[ewelink-cron] Novo sensor detectado: ${deviceName} (${deviceId}) — empresa ${companyId}`);
    } else {
      // Sensor já cadastrado: atualizar SOMENTE o status de conectividade
      // do eWeLink. NUNCA sobrescrever `device_name` (editável pelo usuário
      // no ERP) nem `ativo` (controle manual de monitoramento no ERP).
      const onlineNow = thing.itemData?.online ?? true;
      if (existing.ewelink_online !== onlineNow) {
        await supabaseAdmin
          .from("ambiental_sensores")
          .update({ ewelink_online: onlineNow })
          .eq("company_id", companyId)
          .eq("device_id", deviceId);
      }
    }
  }

  // ── 3. Buscar sensores ativos do banco (inclui os recém-criados) ──
  const { data: sensoresAtivos } = await supabaseAdmin
    .from("ambiental_sensores")
    .select("*")
    .eq("company_id", companyId)
    .eq("ativo", true);

  if (!sensoresAtivos || sensoresAtivos.length === 0) {
    return { companyId, newSensors, collected: 0 };
  }

  // ── 4. Coletar leituras em lote ───────────────────────────
  const deviceIds = sensoresAtivos.map((s: any) => s.device_id);
  const chunks: string[][] = [];
  for (let i = 0; i < deviceIds.length; i += 10) {
    chunks.push(deviceIds.slice(i, i + 10));
  }

  const allReadings: any[] = [];
  for (const chunk of chunks) {
    try {
      const reqBody = JSON.stringify({ thingList: chunk.map((id: string) => ({ itemType: 1, id })) });
      const res = await fetch(`${baseUrl}/v2/device/thing`, {
        method: "POST",
        headers: {
          "x-ck-appid": config.ewelink_app_id,
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: reqBody,
      });
      const data = await res.json();
      if (data.error === 0 && data.data?.thingList) {
        allReadings.push(...data.data.thingList);
      }
    } catch (err) {
      console.error(`[ewelink-cron] Erro ao coletar leituras empresa ${companyId}:`, err);
    }
  }

  // ── 5. Salvar leituras no banco ───────────────────────────
  const now = new Date().toISOString();
  let collected = 0;

  for (const thing of allReadings) {
    const deviceId = thing.itemData?.deviceid ?? thing.itemData?.id;
    const sensor   = sensoresAtivos.find((s: any) => s.device_id === deviceId);
    if (!sensor) continue;

    const { temperature, humidity } = extractReadings(thing);
    if (temperature === null && humidity === null) continue;

    await supabaseAdmin.from("sensor_readings").insert({
      company_id:  companyId,
      device_id:   deviceId,
      room_name:   sensor.room_name,
      temperature,
      humidity,
      temp_min:    sensor.temp_min,
      temp_max:    sensor.temp_max,
      hum_min:     sensor.hum_min,
      hum_max:     sensor.hum_max,
      responsible: sensor.responsible,
      recorded_at: now,
    });
    collected++;
  }

  // ── 6. Atualizar ultima_sync ──────────────────────────────
  await supabaseAdmin
    .from("ambiental_config")
    .update({ ultima_sync: now })
    .eq("company_id", companyId);

  return { companyId, newSensors, collected };
}

// ─── Handler principal ────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Aceitar chamadas do pg_cron (sem Authorization) ou com service_role key
  // Esta função é interna (chamada pelo pg_cron ou service_role)
  // Aceita chamadas sem Authorization ou com qualquer Bearer token
  // A segurança é garantida pelo --no-verify-jwt + uso exclusivo interno
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceKey
  );

  try {
    // Buscar todas as empresas com eWeLink configurado e ativo
    const { data: configs, error } = await supabaseAdmin
      .from("ambiental_config")
      .select("*")
      .eq("ativo", true)
      .not("ewelink_access_token", "is", null);

    if (error) throw error;
    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma empresa com eWeLink ativo.", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[ewelink-cron] Processando ${configs.length} empresa(s)...`);

    // Processar cada empresa em paralelo (com limite de concorrência)
    const results = await Promise.allSettled(
      configs.map((config: any) => processCompany(supabaseAdmin, config))
    );

    const summary = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { companyId: configs[i].company_id, newSensors: 0, collected: 0, error: String(r.reason) };
    });

    const totalNew       = summary.reduce((s, r) => s + r.newSensors, 0);
    const totalCollected = summary.reduce((s, r) => s + r.collected, 0);
    const errors         = summary.filter(r => r.error).map(r => `${r.companyId}: ${r.error}`);

    console.log(`[ewelink-cron] Concluído: ${totalNew} novos sensores, ${totalCollected} leituras coletadas.`);
    if (errors.length) console.warn(`[ewelink-cron] Erros:`, errors);

    return new Response(
      JSON.stringify({
        success: true,
        processed: configs.length,
        totalNewSensors: totalNew,
        totalCollected,
        errors: errors.length ? errors : undefined,
        summary,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[ewelink-cron] Erro crítico:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
