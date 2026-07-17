/**
 * Edge Function: legislacao-ingest
 *
 * Recebe texto de uma norma já aprovada por humano, divide em chunks por
 * artigo/parágrafo/anexo, gera embeddings e grava em legislacao_chunks.
 *
 * REGRA: só roda quando aprovado_por está preenchido na legislacao_fontes.
 * Nunca processa normas não aprovadas.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Divide o texto em chunks por artigo/parágrafo/anexo */
function dividirEmChunks(texto: string, fonteId: string): Array<{ referencia: string; texto: string }> {
  const chunks: Array<{ referencia: string; texto: string }> = [];

  // Padrões de divisão: Art., §, Anexo, Capítulo, Seção
  const padroes = [
    /^(Art\.\s*\d+[°º]?[\w\-]*\.?.*?)(?=\nArt\.\s*\d+|$)/gms,
    /^(Anexo\s+[IVXLCDM]+.*?)(?=\nAnexo\s+[IVXLCDM]+|$)/gims,
    /^(Cap[íi]tulo\s+[IVXLCDM\d]+.*?)(?=\nCap[íi]tulo\s+[IVXLCDM\d]+|$)/gims,
  ];

  let processado = false;

  // Tentar dividir por artigos primeiro
  const artigos = texto.match(/Art\.\s*\d+[°º]?[\w\-]*\.?[^\n]*(?:\n(?!Art\.\s*\d)[^\n]*)*/g);
  if (artigos && artigos.length > 0) {
    processado = true;
    artigos.forEach((artigo, idx) => {
      const linhas = artigo.split("\n");
      const primeiraLinha = linhas[0].trim();
      const numArtigo = primeiraLinha.match(/Art\.\s*(\d+[°º]?[\w\-]*)/)?.[0] || `Art. ${idx + 1}`;
      if (artigo.trim().length > 20) {
        chunks.push({ referencia: numArtigo, texto: artigo.trim() });
      }
    });
  }

  // Tentar dividir por Anexos
  const anexos = texto.match(/Anexo\s+[IVXLCDM]+[^\n]*(?:\n(?!Anexo\s+[IVXLCDM])[^\n]*)*/gi);
  if (anexos && anexos.length > 0) {
    processado = true;
    anexos.forEach((anexo) => {
      const primeiraLinha = anexo.split("\n")[0].trim();
      if (anexo.trim().length > 20) {
        chunks.push({ referencia: primeiraLinha.slice(0, 80), texto: anexo.trim() });
      }
    });
  }

  // Fallback: dividir por parágrafos de ~800 chars se nenhum padrão funcionou
  if (!processado || chunks.length === 0) {
    const paragrafos = texto.split(/\n{2,}/).filter(p => p.trim().length > 50);
    paragrafos.forEach((p, idx) => {
      // Dividir parágrafos muito longos em sub-chunks de ~800 chars
      if (p.length > 1000) {
        const subChunks = p.match(/.{1,800}(?:\s|$)/gs) || [p];
        subChunks.forEach((sc, si) => {
          chunks.push({ referencia: `Parágrafo ${idx + 1}.${si + 1}`, texto: sc.trim() });
        });
      } else {
        chunks.push({ referencia: `Parágrafo ${idx + 1}`, texto: p.trim() });
      }
    });
  }

  return chunks.filter(c => c.texto.length > 30);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { fonte_id, aprovado_por } = await req.json();

    if (!fonte_id) {
      return new Response(JSON.stringify({ error: "fonte_id é obrigatório." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey    = Deno.env.get("OPENAI_API_KEY")!;
    const anonKey      = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai   = new OpenAI({ apiKey: openaiKey });

    // Resolver aprovado_por: só uuid válido (nunca string literal tipo "saas-admin")
    let aprovadorId: string | null = isUuid(aprovado_por) ? aprovado_por : null;
    if (!aprovadorId) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: callingUser } } = await userClient.auth.getUser();
        if (callingUser?.id && isUuid(callingUser.id)) {
          aprovadorId = callingUser.id;
        }
      }
    }

    // ── 1. Buscar a fonte e verificar aprovação ──────────────────────────────
    const { data: fonte, error: fonteErr } = await supabase
      .from("legislacao_fontes")
      .select("*")
      .eq("id", fonte_id)
      .single();

    if (fonteErr || !fonte) {
      return new Response(JSON.stringify({ error: "Fonte não encontrada." }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!fonte.aprovado_por && !aprovadorId) {
      return new Response(JSON.stringify({
        error: "Esta norma ainda não foi aprovada por um humano. Informe aprovado_por (uuid do usuário) antes de processar."
      }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (!fonte.texto_completo?.trim()) {
      return new Response(JSON.stringify({
        error: "texto_completo está vazio. Faça o upload do texto da norma antes de processar."
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── 2. Marcar aprovação se fornecida agora ───────────────────────────────
    if (aprovadorId && !fonte.aprovado_por) {
      const { error: aprovErr } = await supabase.from("legislacao_fontes").update({
        aprovado_por: aprovadorId,
        aprovado_em: new Date().toISOString(),
      }).eq("id", fonte_id);

      if (aprovErr) {
        console.error("[legislacao-ingest] falha ao gravar aprovado_por:", aprovErr.message);
        return new Response(JSON.stringify({
          error: `Falha ao gravar aprovação: ${aprovErr.message}`,
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    // ── 3. Remover chunks antigos desta fonte ────────────────────────────────
    await supabase.from("legislacao_chunks").delete().eq("fonte_id", fonte_id);

    // ── 4. Dividir em chunks ─────────────────────────────────────────────────
    const chunks = dividirEmChunks(fonte.texto_completo, fonte_id);

    if (chunks.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum chunk gerado. Verifique o texto da norma." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // ── 5. Gerar embeddings em lotes de 20 ──────────────────────────────────
    const BATCH = 20;
    let totalInseridos = 0;

    for (let i = 0; i < chunks.length; i += BATCH) {
      const lote = chunks.slice(i, i + BATCH);
      const textos = lote.map(c => c.texto);

      const embeddingResp = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: textos,
      });

      const rows = lote.map((c, idx) => ({
        fonte_id,
        referencia: c.referencia,
        texto: c.texto,
        embedding: embeddingResp.data[idx].embedding,
      }));

      const { error: insertErr } = await supabase.from("legislacao_chunks").insert(rows);
      if (insertErr) throw insertErr;
      totalInseridos += rows.length;
    }

    // ── 6. Atualizar data_ultima_verificacao ─────────────────────────────────
    await supabase.from("legislacao_fontes").update({
      data_ultima_verificacao: new Date().toISOString(),
    }).eq("id", fonte_id);

    return new Response(JSON.stringify({
      success: true,
      chunks_gerados: totalInseridos,
      fonte: `${fonte.tipo} ${fonte.numero}/${fonte.ano}`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("legislacao-ingest error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
