/**
 * Edge Function: legislacao-rag-search
 *
 * Copilot Regulatório travado em fonte oficial.
 * REGRA ABSOLUTA: a IA NUNCA responde sem citar pelo menos um chunk da base.
 * Se não encontrar nada relevante, diz explicitamente e nunca "completa" com
 * conhecimento geral do modelo.
 *
 * Referências: RDC 243/2018, RDC 275/2002, IN 28/2018 (suplementos alimentares)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { pergunta, company_id, usuario_id } = await req.json();

    if (!pergunta?.trim()) {
      return new Response(JSON.stringify({ error: "Pergunta não pode estar vazia." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey    = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai   = new OpenAI({ apiKey: openaiKey });

    // ── 1. Gerar embedding da pergunta ──────────────────────────────────────
    const embeddingResp = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: pergunta,
    });
    const queryEmbedding = embeddingResp.data[0].embedding;

    // ── 2. Buscar os 5 chunks mais similares (cosine similarity) ────────────
    // Threshold 0.35: perguntas curtas em linguagem natural raramente passam de 0.70
    // contra texto jurídico (deploy prod v6).
    const { data: chunks, error: chunkErr } = await supabase.rpc("match_legislacao_chunks", {
      query_embedding: queryEmbedding,
      match_threshold: 0.35,
      match_count: 5,
    });

    if (chunkErr) throw chunkErr;

    // ── 3. Montar contexto e prompt ─────────────────────────────────────────
    let encontrouResposta = false;
    let resposta = "";
    let fontesUsadas: Array<{
      fonte_id: string;
      referencia: string;
      titulo: string;
      tipo: string;
      numero: string;
      ano: number;
      url_oficial: string;
      categoria: string;
    }> = [];

    if (!chunks || chunks.length === 0) {
      // Nenhum chunk relevante encontrado — resposta de "não sei"
      encontrouResposta = false
;
      resposta = "⚠️ **Não encontrei essa informação na base de legislação carregada.**\n\nRecomendo verificar diretamente nas fontes oficiais:\n- [ANVISA Legislação](https://www.gov.br/anvisa/pt-br/assuntos/legislacao)\n- [ANVISALegis — IN 28/2018 consolidada](https://anvisalegis.datalegis.net)\n- [Perguntas e Respostas ANVISA — Suplementos](https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares)\n\n*Este sistema responde apenas com base nos trechos carregados na base — nunca com conhecimento geral.*";
    } else {
      encontrouResposta = true;

      // Buscar metadados das fontes dos chunks
      const fonteIds = [...new Set(chunks.map((c: any) => c.fonte_id))];
      const { data: fontes } = await supabase
        .from("legislacao_fontes")
        .select("id, tipo, numero, ano, titulo, url_oficial, categoria")
        .in("id", fonteIds);

      const fontesMap: Record<string, any> = {};
      (fontes || []).forEach((f: any) => { fontesMap[f.id] = f; });

      // Montar contexto dos chunks para o prompt
      const contexto = chunks.map((c: any, i: number) => {
        const fonte = fontesMap[c.fonte_id];
        const nomeFonte = fonte ? `${fonte.tipo} ${fonte.numero}/${fonte.ano}` : "Fonte desconhecida";
        const aviso = fonte?.categoria === "REFERENCIA_MEDICAMENTO_NAO_APLICAVEL"
          ? "\n⚠️ ATENÇÃO: Esta norma é de MEDICAMENTOS e NÃO se aplica a suplementos alimentares."
          : "";
        return `[TRECHO ${i + 1}] ${nomeFonte} — ${c.referencia}${aviso}\n${c.texto}`;
      }).join("\n\n---\n\n");

      fontesUsadas = chunks.map((c: any) => {
        const fonte = fontesMap[c.fonte_id];
        return {
          fonte_id: c.fonte_id,
          referencia: c.referencia,
          titulo: fonte?.titulo || "",
          tipo: fonte?.tipo || "",
          numero: fonte?.numero || "",
          ano: fonte?.ano || 0,
          url_oficial: fonte?.url_oficial || "",
          categoria: fonte?.categoria || "",
        };
      });

      // ── 4. Chamar o modelo com REGRA RÍGIDA anti-alucinação ───────────────
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0,
        messages: [
          {
            role: "system",
            content: `Você é o Copilot Regulatório do BrainX ERP, especializado em legislação ANVISA para SUPLEMENTOS ALIMENTARES.

REGRA ABSOLUTA: Responda APENAS com base nos trechos fornecidos abaixo. Cite a norma e o artigo/anexo de cada trecho usado (ex: "conforme RDC 243/2018, Art. 10").

Se os trechos não contiverem a resposta, diga EXATAMENTE: "Não encontrei essa informação na base de legislação carregada. Recomendo verificar diretamente na fonte oficial: [url_oficial da fonte mais relevante]"

NUNCA complete com conhecimento próprio fora dos trechos fornecidos.
NUNCA cite a RDC 658/2022 como norma aplicável a suplementos — ela é BPF de MEDICAMENTOS.

Responda em português brasileiro, de forma clara e objetiva.`
          },
          {
            role: "user",
            content: `TRECHOS DA BASE:\n\n${contexto}\n\n---\n\nPERGUNTA DO RT: ${pergunta}`
          }
        ]
      });

      resposta = completion.choices[0].message.content || "";
    }

    // ── 5. Salvar no histórico auditável ────────────────────────────────────
    if (company_id && usuario_id) {
      await supabase.from("legislacao_perguntas").insert({
        company_id,
        usuario_id,
        pergunta,
        resposta,
        chunks_usados: chunks ? chunks.map((c: any) => c.id) : [],
        encontrou_resposta: encontrouResposta,
      });
    }

    // ── 6. Retornar resposta + fontes citadas ───────────────────────────────
    return new Response(JSON.stringify({
      resposta,
      encontrou_resposta: encontrouResposta,
      fontes: fontesUsadas,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("legislacao-rag-search error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
