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
const TEMP_HUMIDITY_UIIDS = [15, 18, 1770, 1000, 2026];

// Tipos de dispositivos que podem ter temperatura
const TEMP_DEVICE_KEYWORDS = ["th", "temp", "humi", "sensor", "snzb", "sonoff th"];

/**
 * Gera a assinatura HMAC-SHA256 para autenticação na API CoolKit v2
 */
async function generateSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, messageData);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  return base64;
}

/**
 * Obtém o token de acesso OAuth2 da API CoolKit v2
 * Usa o access_token salvo no banco se ainda válido, ou renova com refresh_token
 */
async function getAccessToken(
  supabaseAdmin: any,
  companyId: string,
  config: any
): Promise<{ token: string; refreshed: boolean }> {
  const now = new Date();

  // Se o token ainda é válido (com margem de 5 minutos)
  if (
    config.ewelink_access_token &&
    config.token_expires_at &&
    new Date(config.token_expires_at) > new Date(now.getTime() + 5 * 60 * 1000)
  ) {
    return { token: config.ewelink_access_token, refreshed: false };
  }

  const baseUrl = REGION_URLS[config.ewelink_region ?? "eu"] ?? REGION_URLS["eu"];

  // Tentar renovar com refresh_token
  if (config.ewelink_refresh_token) {
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

    if (data.error === 0 && data.data?.at) {
      const newToken = data.data.at;
      const newRefresh = data.data.rt;
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Salvar novos tokens no banco
      await supabaseAdmin
        .from("ambiental_config")
        .update({
          ewelink_access_token: newToken,
          ewelink_refresh_token: newRefresh,
          token_expires_at: expiresAt,
          updated_at: now.toISOString(),
        })
        .eq("company_id", companyId);

      return { token: newToken, refreshed: true };
    }
  }

  throw new Error(
    "Token expirado e não foi possível renovar automaticamente. " +
    "Por favor, reconecte sua conta eWeLink na página de configuração."
  );
}

/**
 * Lista todos os dispositivos da conta eWeLink
 */
async function listDevices(
  baseUrl: string,
  appId: string,
  accessToken: string
): Promise<any[]> {
  // GET /v2/device/thing retorna até 100 dispositivos
  const res = await fetch(`${baseUrl}/v2/device/thing?num=0`, {
    method: "GET",
    headers: {
      "x-ck-appid": appId,
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  const data = await res.json();

  if (data.error !== 0) {
    throw new Error(`Erro ao listar dispositivos eWeLink: ${JSON.stringify(data)}`);
  }

  return data.data?.thingList ?? [];
}

/**
 * Verifica se um dispositivo é um sensor de temperatura/umidade
 */
function isTempHumiditySensor(device: any): boolean {
  const uiid = device.itemData?.extra?.uiid ?? device.itemData?.uiid;
  const name = (device.itemData?.name ?? "").toLowerCase();
  const brandName = (device.itemData?.brandName ?? "").toLowerCase();

  if (uiid && TEMP_HUMIDITY_UIIDS.includes(uiid)) return true;

  // Verificar por nome do dispositivo
  if (TEMP_DEVICE_KEYWORDS.some((kw) => name.includes(kw))) return true;
  if (TEMP_DEVICE_KEYWORDS.some((kw) => brandName.includes(kw))) return true;

  // Verificar se o params tem temperatura ou umidade
  const params = device.itemData?.params ?? {};
  if (
    params.currentTemperature !== undefined ||
    params.temperature !== undefined ||
    params.currentHumidity !== undefined ||
    params.humidity !== undefined
  ) {
    return true;
  }

  return false;
}

/**
 * Extrai temperatura e umidade de um dispositivo
 */
function extractReadings(device: any): { temperature: number | null; humidity: number | null } {
  const params = device.itemData?.params ?? {};

  const temperature =
    params.currentTemperature !== undefined
      ? parseFloat(params.currentTemperature)
      : params.temperature !== undefined
      ? parseFloat(params.temperature)
      : null;

  const humidity =
    params.currentHumidity !== undefined
      ? parseFloat(params.currentHumidity)
      : params.humidity !== undefined
      ? parseFloat(params.humidity)
      : null;

  return {
    temperature: temperature !== null && !isNaN(temperature) ? temperature : null,
    humidity: humidity !== null && !isNaN(humidity) ? humidity : null,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Autenticar o usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter company_id do usuário
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: "Empresa não encontrada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyId = profile.company_id;
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "discover";

    // Buscar configuração da empresa
    const { data: config, error: configError } = await supabaseAdmin
      .from("ambiental_config")
      .select("*")
      .eq("company_id", companyId)
      .single();

    if (configError || !config) {
      return new Response(
        JSON.stringify({ error: "Configuração eWeLink não encontrada. Configure as credenciais primeiro." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!config.ewelink_app_id || !config.ewelink_app_secret) {
      return new Response(
        JSON.stringify({ error: "App ID e App Secret não configurados." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl = REGION_URLS[config.ewelink_region ?? "eu"] ?? REGION_URLS["eu"];

    // =====================================================================
    // ACTION: oauth-callback — troca o código OAuth2 por tokens de acesso
    // =====================================================================
    if (action === "oauth-callback") {
      const { code, redirectUrl } = body;
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Código de autorização não fornecido" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tokenBody = JSON.stringify({
        code,
        redirectUrl: redirectUrl ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1/ewelink-sync`,
        grantType: "authorization_code",
      });

      const sign = await generateSignature(tokenBody, config.ewelink_app_secret);

      const tokenRes = await fetch(`${baseUrl}/v2/user/oauth/token`, {
        method: "POST",
        headers: {
          "x-ck-appid": config.ewelink_app_id,
          "Authorization": `Sign ${sign}`,
          "Content-Type": "application/json",
        },
        body: tokenBody,
      });

      const tokenData = await tokenRes.json();

      if (tokenData.error !== 0) {
        return new Response(
          JSON.stringify({ error: `Falha ao obter tokens: ${JSON.stringify(tokenData)}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accessToken = tokenData.data.accessToken;
      const refreshToken = tokenData.data.refreshToken;
      const expiresAt = new Date(tokenData.data.atExpiredTime).toISOString();

      await supabaseAdmin
        .from("ambiental_config")
        .update({
          ewelink_access_token: accessToken,
          ewelink_refresh_token: refreshToken,
          token_expires_at: expiresAt,
          ativo: true,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId);

      return new Response(
        JSON.stringify({ success: true, message: "Conta eWeLink conectada com sucesso!" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================================
    // ACTION: get-auth-url — gera a URL de autorização OAuth2
    // =====================================================================
    if (action === "get-auth-url") {
      const { redirectUrl } = body;
      const seq = Date.now().toString();
      const sign = await generateSignature(
        `${config.ewelink_app_id}_${seq}`,
        config.ewelink_app_secret
      );

      const authUrl = new URL("https://c2ccdn.coolkit.cc/oauth/index.html");
      authUrl.searchParams.set("state", companyId);
      authUrl.searchParams.set("clientId", config.ewelink_app_id);
      authUrl.searchParams.set("authorization", sign);
      authUrl.searchParams.set("seq", seq);
      authUrl.searchParams.set(
        "redirectUrl",
        redirectUrl ?? `${Deno.env.get("SUPABASE_URL")}/functions/v1/ewelink-sync`
      );
      authUrl.searchParams.set("nonce", crypto.randomUUID().replace(/-/g, "").slice(0, 8));
      authUrl.searchParams.set("grantType", "authorization_code");

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Para as demais actions, precisamos de token de acesso
    const { token: accessToken } = await getAccessToken(supabaseAdmin, companyId, config);

    // =====================================================================
    // ACTION: discover — lista dispositivos e popula ambiental_sensores
    // =====================================================================
    if (action === "discover") {
      const thingList = await listDevices(baseUrl, config.ewelink_app_id, accessToken);

      // Filtrar apenas sensores de temperatura/umidade
      const sensors = thingList.filter(isTempHumiditySensor);

      if (sensors.length === 0) {
        return new Response(
          JSON.stringify({
            success: true,
            discovered: 0,
            message: "Nenhum sensor de temperatura/umidade encontrado na conta eWeLink. " +
              "Verifique se os dispositivos estão adicionados ao aplicativo eWeLink.",
            all_devices: thingList.map((d: any) => ({
              id: d.itemData?.deviceid,
              name: d.itemData?.name,
              uiid: d.itemData?.extra?.uiid,
              online: d.itemData?.online,
            })),
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Inserir/atualizar sensores na tabela ambiental_sensores
      let inserted = 0;
      let updated = 0;
      const discoveredSensors = [];

      for (const thing of sensors) {
        const deviceId = thing.itemData?.deviceid ?? thing.itemData?.id;
        const deviceName = thing.itemData?.name ?? `Sensor ${deviceId}`;

        if (!deviceId) continue;

        const sensorPayload = {
          company_id: companyId,
          device_id: deviceId,
          device_name: deviceName,
          room_name: deviceName, // Usuário pode renomear depois
          ativo: thing.itemData?.online ?? true,
        };

        // Verificar se já existe
        const { data: existing } = await supabaseAdmin
          .from("ambiental_sensores")
          .select("id")
          .eq("company_id", companyId)
          .eq("device_id", deviceId)
          .single();

        if (existing) {
          await supabaseAdmin
            .from("ambiental_sensores")
            .update({ device_name: deviceName, ativo: thing.itemData?.online ?? true })
            .eq("id", existing.id);
          updated++;
        } else {
          await supabaseAdmin
            .from("ambiental_sensores")
            .insert(sensorPayload);
          inserted++;
        }

        const readings = extractReadings(thing);
        discoveredSensors.push({
          device_id: deviceId,
          name: deviceName,
          online: thing.itemData?.online,
          temperature: readings.temperature,
          humidity: readings.humidity,
          uiid: thing.itemData?.extra?.uiid,
        });
      }

      // Atualizar ultima_sync
      await supabaseAdmin
        .from("ambiental_config")
        .update({ ultima_sync: new Date().toISOString() })
        .eq("company_id", companyId);

      return new Response(
        JSON.stringify({
          success: true,
          discovered: sensors.length,
          inserted,
          updated,
          sensors: discoveredSensors,
          message: `${inserted} sensor(es) adicionado(s), ${updated} atualizado(s).`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================================
    // ACTION: collect — coleta leituras atuais e salva em sensor_readings
    // =====================================================================
    if (action === "collect") {
      // Buscar sensores configurados da empresa
      const { data: sensores } = await supabaseAdmin
        .from("ambiental_sensores")
        .select("*")
        .eq("company_id", companyId)
        .eq("ativo", true);

      if (!sensores || sensores.length === 0) {
        return new Response(
          JSON.stringify({ success: true, collected: 0, message: "Nenhum sensor ativo configurado." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar dados dos dispositivos em lote (até 10 por vez)
      const deviceIds = sensores.map((s: any) => s.device_id);
      const chunks = [];
      for (let i = 0; i < deviceIds.length; i += 10) {
        chunks.push(deviceIds.slice(i, i + 10));
      }

      const allReadings = [];

      for (const chunk of chunks) {
        const thingList = chunk.map((id: string) => ({ itemType: 1, id }));
        const reqBody = JSON.stringify({ thingList });

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
      }

      // Salvar leituras em sensor_readings
      const now = new Date().toISOString();
      let collected = 0;

      for (const thing of allReadings) {
        const deviceId = thing.itemData?.deviceid ?? thing.itemData?.id;
        const sensor = sensores.find((s: any) => s.device_id === deviceId);
        if (!sensor) continue;

        const { temperature, humidity } = extractReadings(thing);
        if (temperature === null && humidity === null) continue;

        await supabaseAdmin.from("sensor_readings").insert({
          company_id: companyId,
          device_id: deviceId,
          room_name: sensor.room_name,
          temperature,
          humidity,
          temp_min: sensor.temp_min,
          temp_max: sensor.temp_max,
          hum_min: sensor.hum_min,
          hum_max: sensor.hum_max,
          responsible: sensor.responsible,
          recorded_at: now,
        });

        collected++;
      }

      // Atualizar ultima_sync
      await supabaseAdmin
        .from("ambiental_config")
        .update({ ultima_sync: now })
        .eq("company_id", companyId);

      return new Response(
        JSON.stringify({ success: true, collected, message: `${collected} leitura(s) coletada(s).` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =====================================================================
    // ACTION: status — verifica status da conexão e última leitura
    // =====================================================================
    if (action === "status") {
      const thingList = await listDevices(baseUrl, config.ewelink_app_id, accessToken);

      const sensors = thingList.filter(isTempHumiditySensor);
      const allDevices = thingList.map((d: any) => ({
        id: d.itemData?.deviceid,
        name: d.itemData?.name,
        online: d.itemData?.online,
        uiid: d.itemData?.extra?.uiid,
        ...extractReadings(d),
      }));

      return new Response(
        JSON.stringify({
          success: true,
          connected: true,
          total_devices: thingList.length,
          temp_sensors: sensors.length,
          devices: allDevices,
          ultima_sync: config.ultima_sync,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ewelink-sync error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
