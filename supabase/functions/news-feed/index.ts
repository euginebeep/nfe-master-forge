import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description?: string;
  imageUrl?: string;
}

/** RSS 1.0 / RDF (formato usado pelo portal gov.br/ANVISA) */
function parseRdfRSSItems(xml: string, source: string, maxItems = 6): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item\s[^>]*>([\s\S]*?)<\/item>/g;
  let match;

  const skipTypes = new Set(['Folder', 'Collection', 'File', 'collective.polls.poll']);

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate =
      itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]
      || itemXml.match(/<dcterms:issued>(.*?)<\/dcterms:issued>/)?.[1]
      || itemXml.match(/<dc:date>(.*?)<\/dc:date>/)?.[1]
      || '';
    const contentType = itemXml.match(/<dc:type>(.*?)<\/dc:type>/)?.[1] || '';
    const description = itemXml.match(/<description>(.*?)<\/description>/)?.[1] || '';

    if (skipTypes.has(contentType.trim())) continue;

    const cleanTitle = title.replace(/<[^>]+>/g, '').replace(/&apos;/g, "'").trim();
    if (!cleanTitle || cleanTitle.length < 12) continue;

    const cleanDesc = description.replace(/<[^>]+>/g, '').trim().substring(0, 150);

    items.push({
      title: cleanTitle,
      link: link.trim(),
      source,
      pubDate,
      description: cleanDesc || undefined,
    });
  }

  return maxItems > 0 ? items.slice(0, maxItems) : items;
}

function parseRSSItems(xml: string, source: string, maxItems = 6): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    
    const title = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] 
      || itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    const description = itemXml.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)?.[1]
      || itemXml.match(/<description>(.*?)<\/description>/)?.[1] || '';
    
    // Try to extract image from media:content, enclosure, or description
    let imageUrl = itemXml.match(/<media:content[^>]*url="([^"]+)"/)?.[1]
      || itemXml.match(/<enclosure[^>]*url="([^"]+)"/)?.[1]
      || itemXml.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1]
      || '';

    if (!imageUrl && description) {
      const imgMatch = description.match(/<img[^>]*src="([^"]+)"/);
      if (imgMatch) imageUrl = imgMatch[1];
    }

    if (title && title.trim()) {
      // Clean HTML from title
      const cleanTitle = title.replace(/<[^>]+>/g, '').trim();
      const cleanDesc = description.replace(/<[^>]+>/g, '').trim().substring(0, 150);

      items.push({
        title: cleanTitle,
        link: link.trim(),
        source,
        pubDate,
        description: cleanDesc || undefined,
        imageUrl: imageUrl || undefined,
      });
    }
  }

  return maxItems > 0 ? items.slice(0, maxItems) : items;
}

function parseAnyDate(value: string): Date | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const pt = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (pt) {
    const parsed = new Date(`${pt[3]}-${pt[2]}-${pt[1]}T00:00:00-03:00`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseAnvisaHtmlItems(html: string, maxItems = 20): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<li[^>]*class="[^"]*noticia[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const li = match[1];
    const linkMatch = li.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;
    const linkRaw = linkMatch[1];
    const titleRaw = linkMatch[2];
    const dateRaw =
      li.match(/(\d{2}\/\d{2}\/\d{4})/)?.[1]
      || li.match(/<time[^>]*>(.*?)<\/time>/i)?.[1]
      || '';
    const date = parseAnyDate(dateRaw);
    if (!date) continue;
    const title = titleRaw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (!title || title.length < 12) continue;
    const link = linkRaw.startsWith("http")
      ? linkRaw
      : `https://www.gov.br${linkRaw.startsWith("/") ? "" : "/"}${linkRaw}`;
    items.push({
      title,
      link,
      source: "ANVISA",
      pubDate: date.toISOString(),
    });
  }
  return items.slice(0, maxItems);
}

/** Remove acentos para comparar termos setoriais. */
function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * ANVISA passa integralmente. Fontes generalistas só passam se a manchete
 * ou descrição contiver termo do setor (suplementos / regulatório / BPF).
 */
const TERMOS_SETORIAIS = [
  "anvisa", "suplemento", "suplementos", "rotulagem", "rotulo",
  "rdc", "instrucao normativa", "in 28", "bpf", "boas praticas",
  "recall", "importacao", "vitamina", "colageno", "creatina",
  "melatonina", "omega", "probiotico", "prebiotico", "nutraceutico",
  "alimento", "alimentos", "constituinte", "alegacao", "farmacia",
  "industria", "qualidade", "inspecao", "vigilancia sanitaria",
  "registro", "notificacao", "cosmetico", "saude",
];

function ehRelevanteSetorial(item: NewsItem): boolean {
  if (item.source === "ANVISA") return true;
  const texto = semAcento(`${item.title} ${item.description ?? ""}`);
  return TERMOS_SETORIAIS.some((t) => texto.includes(semAcento(t)));
}

const RSS_SOURCES = [
  { url: "https://www.cnnbrasil.com.br/feed/", name: "CNN Brasil", parser: "rss2" as const },
  { url: "https://jovempan.com.br/feed", name: "Jovem Pan", parser: "rss2" as const },
  { url: "https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/RSS", name: "ANVISA", parser: "rdf" as const },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const allNews: NewsItem[] = [];

    // Fetch from multiple sources in parallel
    const results = await Promise.allSettled(
      RSS_SOURCES.map(async (source) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);

          const res = await fetch(source.url, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (!res.ok) return [];
          
          // Always read as bytes first to detect encoding properly
          const buffer = await res.arrayBuffer();
          const contentType = res.headers.get('content-type') || '';
          
          // Preview first bytes to check XML encoding declaration
          const preview = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(buffer, 0, Math.min(200, buffer.byteLength)));
          const xmlEnc = preview.match(/encoding=["']([^"']+)["']/i)?.[1]?.toLowerCase() || '';
          const isLatin = contentType.includes('iso-8859') || contentType.includes('latin') 
                        || xmlEnc.includes('iso-8859') || xmlEnc.includes('latin');
          
          const xml = new TextDecoder(isLatin ? 'iso-8859-1' : 'utf-8').decode(buffer)
            .replace(/&apos;/g, "'");
          
          return source.parser === "rdf"
            ? parseRdfRSSItems(xml, source.name, 0)
            : parseRSSItems(xml, source.name, 0);
        } catch (e) {
          console.error(`Error fetching ${source.name}:`, e);
          return [];
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allNews.push(...result.value.filter(ehRelevanteSetorial));
      }
    }

    // Descartar item sem data válida para evitar NaN embaralhando ordenação.
    const dated = allNews
      .map((n) => {
        const date = parseAnyDate(n.pubDate);
        return date ? { item: { ...n, pubDate: date.toISOString() }, ts: date.getTime() } : null;
      })
      .filter((v): v is { item: NewsItem; ts: number } => !!v);

    // Fallback: RSS ANVISA vazio/insuficiente nos últimos 30 dias.
    const agora = Date.now();
    const trintaDiasMs = 30 * 24 * 60 * 60 * 1000;
    const anvisaRecentes = dated.filter((v) => v.item.source === "ANVISA" && (agora - v.ts) <= trintaDiasMs);
    if (anvisaRecentes.length < 5) {
      try {
        const htmlRes = await fetch("https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa", {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
        });
        if (htmlRes.ok) {
          const html = await htmlRes.text();
          const fallbackAnvisa = parseAnvisaHtmlItems(html, 30)
            .map((item) => ({ item, ts: parseAnyDate(item.pubDate)?.getTime() ?? 0 }))
            .filter((v) => v.ts > 0);
          if (fallbackAnvisa.length) {
            const semAnvisaAtual = dated.filter((v) => v.item.source !== "ANVISA");
            dated.length = 0;
            dated.push(...semAnvisaAtual, ...fallbackAnvisa);
          }
        }
      } catch (e) {
        console.error("ANVISA HTML fallback error:", e);
      }
    }

    // Sort by date (newest first) and limit
    dated.sort((a, b) => b.ts - a.ts);

    const news = dated.slice(0, 12).map((v) => v.item);

    return new Response(JSON.stringify({ news, fetchedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("News feed error:", error);
    return new Response(JSON.stringify({ error: error.message, news: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
