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

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
    const itemXml = match[1];
    const title = itemXml.match(/<title>(.*?)<\/title>/)?.[1] || '';
    const link = itemXml.match(/<link>(.*?)<\/link>/)?.[1] || '';
    const pubDate = itemXml.match(/<dc:date>(.*?)<\/dc:date>/)?.[1] || '';
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

  return items;
}

function parseRSSItems(xml: string, source: string, maxItems = 6): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < maxItems) {
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

  return items;
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
            ? parseRdfRSSItems(xml, source.name, 4)
            : parseRSSItems(xml, source.name, 4);
        } catch (e) {
          console.error(`Error fetching ${source.name}:`, e);
          return [];
        }
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        allNews.push(...result.value);
      }
    }

    // Sort by date (newest first) and limit
    allNews.sort((a, b) => {
      try {
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      } catch {
        return 0;
      }
    });

    const news = allNews.slice(0, 12);

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
