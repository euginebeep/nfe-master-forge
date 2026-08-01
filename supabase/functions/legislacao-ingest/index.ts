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

const MAX_CHUNK_CHARS = 1500;

/** Divide o texto em chunks por artigo / item numérico / anexo / parágrafo */
function dividirEmChunks(
  texto: string,
  _fonteId: string,
  normaRotulo: string,
): Array<{ referencia: string; texto: string }> {
  const chunks: Array<{ referencia: string; texto: string }> = [];
  let processado = false;
  // Faixas já cobertas — impede chunk sobreposto (ex.: Anexo engolido por Art.)
  const cobertos: Array<{ start: number; end: number }> = [];
  // Prefixo de marcação opcional no início da linha (*, #, -, espaços, tabs)
  const PREFIX = "[ \\t]*[*#\\-]*[ \\t]*";
  const norma = String(normaRotulo || "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const montarReferencia = (rotuloBruto: string, trechoN: number): string => {
    const limpo = String(rotuloBruto || "")
      .replace(/[*#]+/g, " ")
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const parte = limpo || `trecho ${trechoN}`;
    const full = norma ? `${norma} — ${parte}` : parte;
    return full.slice(0, 80);
  };

  const overlaps = (start: number, end: number) =>
    cobertos.some((c) => start < c.end && end > c.start);

  const pushChunk = (referencia: string, corpo: string) => {
    const t = corpo.trim();
    if (t.length <= 30) return;
    if (t.length <= MAX_CHUNK_CHARS) {
      chunks.push({ referencia, texto: t });
      return;
    }
    // Teto ~1500 chars — blocos longos demais prejudicam o RAG
    const partes = t.match(new RegExp(`.{1,${MAX_CHUNK_CHARS}}(?:\\s|$)`, "gs")) || [t];
    partes.forEach((p, i) => {
      const pt = p.trim();
      if (pt.length > 30) {
        chunks.push({
          referencia: partes.length > 1 ? `${referencia} (${i + 1}/${partes.length})` : referencia,
          texto: pt,
        });
      }
    });
  };

  // 1) Artigos "Art. N" — tolera prefixos; encerra em novo Art. ou Anexo (início de linha)
  const artRe = new RegExp(
    `^${PREFIX}Art\\.\\s*\\d+[°º]?[\\w\\-]*\\.?[^\\n]*(?:\\n(?!${PREFIX}(?:Art\\.\\s*\\d|Anexo\\s+[IVXLCDM]))[^\\n]*)*`,
    "gm",
  );
  let m: RegExpExecArray | null;
  const artigos: Array<{ corpo: string; start: number; end: number }> = [];
  while ((m = artRe.exec(texto)) !== null) {
    artigos.push({ corpo: m[0], start: m.index, end: m.index + m[0].length });
  }
  if (artigos.length > 0) {
    processado = true;
    artigos.forEach((artigo, idx) => {
      const primeiraLinha = artigo.corpo.split("\n")[0].trim();
      const numArtigo = primeiraLinha.match(/Art\.\s*\d+[°º]?[\w\-]*/)?.[0] || `Art. ${idx + 1}`;
      pushChunk(montarReferencia(numArtigo, idx + 1), artigo.corpo);
      cobertos.push({ start: artigo.start, end: artigo.end });
    });
  }

  // 2) Itens numéricos estilo RDC 275 (4.1.1, 4.2.1) — se poucos/nenhum Art.
  if (!processado || chunks.length < 3) {
    const linhas = texto.split(/\n/);
    const lineStarts: number[] = new Array(linhas.length);
    let pos = 0;
    for (let i = 0; i < linhas.length; i++) {
      lineStarts[i] = pos;
      pos += linhas[i].length + 1;
    }
    const itemStarts: number[] = [];
    linhas.forEach((linha, i) => {
      if (/^\s*\d+(\.\d+)+\s*[\).\-–—:]?\s+\S/.test(linha) || /^\s*\d+(\.\d+)+\s*$/.test(linha.trim())) {
        itemStarts.push(i);
      }
    });
    if (itemStarts.length >= 3) {
      processado = true;
      const itemChunks: Array<{ referencia: string; texto: string; start: number; end: number }> = [];
      for (let i = 0; i < itemStarts.length; i++) {
        const start = itemStarts[i];
        const end = i + 1 < itemStarts.length ? itemStarts[i + 1] : linhas.length;
        const bloco = linhas.slice(start, end).join("\n").trim();
        const ref = bloco.match(/^\s*(\d+(?:\.\d+)+)/)?.[1] || `Item ${i + 1}`;
        const charStart = lineStarts[start] ?? 0;
        const charEnd = end < linhas.length ? (lineStarts[end] ?? texto.length) : texto.length;
        if (bloco.length > 30) {
          itemChunks.push({ referencia: ref, texto: bloco, start: charStart, end: charEnd });
        }
      }
      if (itemChunks.length > chunks.length) {
        chunks.length = 0;
        cobertos.length = 0;
        itemChunks.forEach((c, idx) => {
          pushChunk(montarReferencia(c.referencia, idx + 1), c.texto);
          cobertos.push({ start: c.start, end: c.end });
        });
      }
    }
  }

  // 3) Anexos — só início de linha (com prefixo) e só trechos ainda não cobertos
  const anexoRe = new RegExp(
    `^${PREFIX}Anexo\\s+[IVXLCDM]+[^\\n]*(?:\\n(?!${PREFIX}Anexo\\s+[IVXLCDM])[^\\n]*)*`,
    "gim",
  );
  while ((m = anexoRe.exec(texto)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (overlaps(start, end)) continue;
    processado = true;
    const primeiraLinha = m[0].split("\n")[0].trim();
    const rotulo =
      primeiraLinha.match(/Anexo\s+[IVXLCDM]+[^\n]*/i)?.[0] || `trecho ${chunks.length + 1}`;
    pushChunk(montarReferencia(rotulo, chunks.length + 1), m[0]);
    cobertos.push({ start, end });
  }

  // 4) Seções a) b) c) — só se ainda pouco fatiado
  if (chunks.length < 3) {
    const letras = texto.match(/^[ \t]*[a-z]\)[ \t]+[\s\S]*?(?=^[ \t]*[a-z]\)[ \t]+|$)/gim);
    if (letras && letras.length >= 3) {
      processado = true;
      letras.forEach((bloco, idx) => {
        const ref = bloco.match(/^[ \t]*([a-z]\))/)?.[1] || `alínea ${idx + 1}`;
        pushChunk(montarReferencia(ref, idx + 1), bloco);
      });
    }
  }

  // 5) Fallback: parágrafos
  if (!processado || chunks.length === 0) {
    const paragrafos = texto.split(/\n{2,}/).filter((p) => p.trim().length > 50);
    paragrafos.forEach((p, idx) => pushChunk(montarReferencia(`Parágrafo ${idx + 1}`, idx + 1), p));
  }

  return chunks.filter((c) => c.texto.length > 30);
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
    const normaRotulo = `${fonte.tipo} ${fonte.numero}/${fonte.ano}`;
    const chunks = dividirEmChunks(fonte.texto_completo, fonte_id, normaRotulo);

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
