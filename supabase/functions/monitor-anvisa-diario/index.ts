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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FONTES_MONITORADAS = [
  {
    id: "ANVISALEGIS_IN28",
    url: "https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000028&sgl_tipo=INS&sgl_orgao=ANVS&ano_ato=2018",
    descricao: "ANVISALegis — IN 28/2018 consolidada (listas/limites/alegações de suplementos)",
  },
  {
    id: "NOTICIAS_ANVISA",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa",
    descricao: "Notícias ANVISA — filtro: suplemento alimentar",
    filtro: "suplemento",
  },
  {
    id: "DOU_SECAO1",
    url: "https://www.in.gov.br/leiturajornal?data=hoje&secao=do1",
    descricao: "DOU Seção 1 — filtro: suplemento alimentar, RDC, IN, ANVISA",
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

/** Extrai texto relevante de HTML */
function extrairTextoRelevante(html: string, filtro?: string): string {
  // Remover tags HTML
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (!filtro) return texto.slice(0, 5000);

  // Extrair apenas parágrafos que contêm o filtro
  const palavras = filtro.toLowerCase().split(" ");
  const linhas = texto.split(/[.!?]\s+/);
  const relevantes = linhas.filter(l =>
    palavras.some(p => l.toLowerCase().includes(p))
  );

  return relevantes.slice(0, 50).join(". ").slice(0, 5000);
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
        // ── Buscar conteúdo atual da fonte ─────────────────────────────────
        const resp = await fetch(fonte.url, {
          headers: { "User-Agent": "BrainXERP-Monitor/1.0 (regulatorio@brainxerp.com)" },
          signal: AbortSignal.timeout(15000),
        });

        if (!resp.ok) {
          resultados.push({ fonte: fonte.id, mudanca: false, status: "ERRO_HTTP", mensagem: `HTTP ${resp.status}` });
          continue;
        }

        const html = await resp.text();
        const textoRelevante = extrairTextoRelevante(html, fonte.filtro);
        const hashNovo = await sha256(textoRelevante);

        // ── Buscar último registro desta fonte ─────────────────────────────
        const { data: ultimoRegistro } = await supabase
          .from("legislacao_monitoramento")
          .select("hash_novo, id")
          .eq("fonte_monitorada", fonte.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        const hashAnterior = ultimoRegistro?.hash_novo || null;
        const mudancaDetectada = hashAnterior !== null && hashAnterior !== hashNovo;

        // ── Gerar resumo da mudança com IA (apenas se houve mudança) ───────
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

        // ── Gravar registro de monitoramento ──────────────────────────────
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
        console.error(`Erro ao monitorar ${fonte.id}:`, fonteErr);
        resultados.push({ fonte: fonte.id, mudanca: false, status: "ERRO", mensagem: String(fonteErr) });
      }
    }

    // ── Notificação in-app se houver mudanças ──────────────────────────────
    const mudancas = resultados.filter(r => r.mudanca);
    if (mudancas.length > 0) {
      console.log(`[monitor-anvisa-diario] ${mudancas.length} mudança(s) detectada(s) — notificação pendente para revisão humana.`);
      // TODO: integrar com sistema de notificações in-app do projeto
    }

    return new Response(JSON.stringify({
      executado_em: new Date().toISOString(),
      resultados,
      total_mudancas: mudancas.length,
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
