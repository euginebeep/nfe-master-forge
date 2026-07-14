/**
 * Edge Function: monitor-anvisa-diario
 *
 * Cron diário (06h) — monitora 3 fontes ANVISA e detecta mudanças.
 * REGRA ABSOLUTA: só detecta e alerta — NUNCA publica automaticamente.
 * Toda mudança fica com status_revisao = 'PENDENTE' até aprovação humana.
 *
 * Fontes monitoradas:
 * 1. ANVISALegis — IN 28/2018 consolidada
 * 2. Notícias ANVISA (filtro: suplemento)
 * 3. DOU Seção 1 (filtro: suplemento alimentar, RDC, ANVISA)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_CHARS_VALIDOS = 2000;

interface FonteMonitorada {
  id: string;
  url: string;
  descricao: string;
  marcador: string;
  filtro?: string;
  /** Datalegis serve ISO-8859-1 — não usar resp.text() */
  decodificarIso88591?: boolean;
}

const FONTES_MONITORADAS: FonteMonitorada[] = [
  {
    id: "ANVISALEGIS_IN28",
    url: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=INM&numeroAto=00000028&seqAto=000&valorAno=2018&orgao=DC%2FANVISA%2FMS&cod_menu=1696&cod_modulo=134&pesquisa=true",
    descricao: "ANVISALegis — IN 28/2018 consolidada (listas/limites/alegações de suplementos)",
    marcador: "listas de constituintes",
    decodificarIso88591: true,
  },
  {
    id: "NOTICIAS_ANVISA",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa",
    descricao: "Notícias ANVISA — filtro: suplemento alimentar",
    marcador: "notícias",
    filtro: "suplemento",
  },
  {
    id: "DOU_SECAO1",
    url: "https://www.in.gov.br/leiturajornal?data=hoje&secao=do1",
    descricao: "DOU Seção 1 — filtro: suplemento alimentar, RDC, IN, ANVISA",
    marcador: "imprensa nacional",
    filtro: "suplemento alimentar",
  },
];

/** Calcula hash SHA-256 simples de uma string */
async function sha256(texto: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/** Decodifica corpo da resposta com charset correto */
async function decodificarResposta(resp: Response, iso88591: boolean): Promise<string> {
  const buffer = await resp.arrayBuffer();
  const charset = iso88591 ? "iso-8859-1" : "utf-8";
  return new TextDecoder(charset).decode(buffer);
}

/** Mojibake típico de UTF-8 lido como Latin-1 */
function temEncodingQuebrado(texto: string): boolean {
  return texto.includes("Ã§") || texto.includes("Ã£");
}

/** Valida que a página baixada é conteúdo real — nunca hashear página de erro */
function validarConteudoFonte(texto: string, marcador: string): { ok: true } | { ok: false; motivo: string } {
  if (temEncodingQuebrado(texto)) {
    return { ok: false, motivo: "Encoding inválido (mojibake Ã§/Ã£ — esperado ISO-8859-1 no Datalegis)" };
  }
  if (texto.length < MIN_CHARS_VALIDOS) {
    return { ok: false, motivo: `Conteúdo muito curto (${texto.length} chars, mínimo ${MIN_CHARS_VALIDOS})` };
  }
  if (!texto.toLowerCase().includes(marcador.toLowerCase())) {
    return { ok: false, motivo: `Marcador obrigatório "${marcador}" não encontrado no texto` };
  }
  return { ok: true };
}

/** Extrai texto relevante de HTML */
function extrairTextoRelevante(html: string, filtro?: string): string {
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (!filtro) return texto.slice(0, 5000);

  const palavras = filtro.toLowerCase().split(" ");
  const linhas = texto.split(/[.!?]\s+/);
  const relevantes = linhas.filter(l =>
    palavras.some(p => l.toLowerCase().includes(p))
  );

  return relevantes.slice(0, 50).join(". ").slice(0, 5000);
}

/** Registra falha e alerta alta — sem hash, sem baseline inválido */
async function registrarFonteInacessivel(
  supabase: SupabaseClient,
  fonte: FonteMonitorada,
  motivo: string,
): Promise<void> {
  const resumo = `🚨 ALERTA ALTA — Fonte inacessível: ${motivo}`;

  await supabase.from("legislacao_monitoramento").insert({
    fonte_monitorada: fonte.id,
    url: fonte.url,
    hash_anterior: null,
    hash_novo: null,
    mudanca_detectada: true,
    resumo_mudanca: resumo,
    status_revisao: "PENDENTE",
  });

  await supabase.from("anvisa_alertas_normativos").insert({
    tipo: "ATUALIZACAO",
    titulo: `Fonte inacessível: ${fonte.id}`,
    descricao: `${fonte.descricao}. ${motivo}`,
    norma: fonte.id,
    fonte_url: fonte.url,
    critico: true,
  });

  console.error(`[monitor-anvisa-diario] FONTE INACESSÍVEL ${fonte.id}: ${motivo}`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey    = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai   = new OpenAI({ apiKey: openaiKey });

    const resultados: Array<{
      fonte: string;
      mudanca: boolean;
      status: string;
      mensagem: string;
    }> = [];

    for (const fonte of FONTES_MONITORADAS) {
      try {
        const resp = await fetch(fonte.url, {
          headers: { "User-Agent": "BrainXERP-Monitor/1.0 (regulatorio@brainxerp.com)" },
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          const motivo = `HTTP ${resp.status}`;
          await registrarFonteInacessivel(supabase, fonte, motivo);
          resultados.push({
            fonte: fonte.id,
            mudanca: true,
            status: "FONTE_INACESSIVEL",
            mensagem: `🚨 Fonte inacessível (${motivo}): ${fonte.descricao}`,
          });
          continue;
        }

        const html = await decodificarResposta(resp, fonte.decodificarIso88591 === true);
        const validacao = validarConteudoFonte(html, fonte.marcador);

        if (!validacao.ok) {
          await registrarFonteInacessivel(supabase, fonte, validacao.motivo);
          resultados.push({
            fonte: fonte.id,
            mudanca: true,
            status: "FONTE_INACESSIVEL",
            mensagem: `🚨 Fonte inacessível: ${validacao.motivo}`,
          });
          continue;
        }

        const textoRelevante = extrairTextoRelevante(html, fonte.filtro);
        const hashNovo = await sha256(textoRelevante);

        // Ignora registros de erro (hash_novo nulo) ao buscar baseline
        const { data: ultimoRegistro } = await supabase
          .from("legislacao_monitoramento")
          .select("hash_novo, id")
          .eq("fonte_monitorada", fonte.id)
          .not("hash_novo", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const hashAnterior = ultimoRegistro?.hash_novo || null;
        const mudancaDetectada = hashAnterior !== null && hashAnterior !== hashNovo;

        let resumoMudanca: string | null = null;
        if (mudancaDetectada && textoRelevante.length > 100) {
          try {
            const completion = await openai.chat.completions.create({
              model: "gpt-4o-mini",
              temperature: 0,
              max_tokens: 300,
              messages: [
                {
                  role: "system",
                  content: "Você é um assistente que resume mudanças em legislação ANVISA para suplementos alimentares. Seja objetivo e cite apenas o que mudou. AVISO: este resumo será revisado por um humano antes de qualquer ação."
                },
                {
                  role: "user",
                  content: `Detectei uma mudança no conteúdo de: ${fonte.descricao}\n\nTrecho relevante atual:\n${textoRelevante.slice(0, 2000)}\n\nResuma em 2-3 frases o que pode ter mudado, com base no contexto.`
                }
              ]
            });
            resumoMudanca = completion.choices[0].message.content || null;
          } catch {
            resumoMudanca = "Resumo automático indisponível — revisar manualmente.";
          }
        }

        await supabase.from("legislacao_monitoramento").insert({
          fonte_monitorada: fonte.id,
          url: fonte.url,
          hash_anterior: hashAnterior,
          hash_novo: hashNovo,
          mudanca_detectada: mudancaDetectada,
          resumo_mudanca: resumoMudanca,
          status_revisao: "PENDENTE",
        });

        resultados.push({
          fonte: fonte.id,
          mudanca: mudancaDetectada,
          status: mudancaDetectada ? "MUDANÇA_DETECTADA" : "SEM_MUDANÇA",
          mensagem: mudancaDetectada
            ? `⚠️ Mudança detectada em ${fonte.descricao}. Aguardando revisão humana.`
            : `✓ Sem alterações em ${fonte.descricao}.`,
        });

      } catch (fonteErr) {
        const motivo = String(fonteErr);
        console.error(`Erro ao monitorar ${fonte.id}:`, fonteErr);
        await registrarFonteInacessivel(supabase, fonte, motivo);
        resultados.push({
          fonte: fonte.id,
          mudanca: true,
          status: "FONTE_INACESSIVEL",
          mensagem: `🚨 Fonte inacessível: ${motivo}`,
        });
      }
    }

    const mudancas = resultados.filter(r => r.mudanca);
    const fontesInacessiveis = resultados.filter(r => r.status === "FONTE_INACESSIVEL");
    if (mudancas.length > 0) {
      console.log(
        `[monitor-anvisa-diario] ${mudancas.length} alerta(s) — ` +
        `${fontesInacessiveis.length} fonte(s) inacessível(is), ` +
        `${mudancas.length - fontesInacessiveis.length} mudança(s) de conteúdo.`,
      );
    }

    return new Response(JSON.stringify({
      executado_em: new Date().toISOString(),
      resultados,
      total_mudancas: mudancas.length,
      total_fontes_inacessiveis: fontesInacessiveis.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("monitor-anvisa-diario error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
