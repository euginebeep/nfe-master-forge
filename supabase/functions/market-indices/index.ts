import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const results: Record<string, any> = {};

    // Fetch Ibovespa - try multiple sources
    // Source 1: brapi.dev
    try {
      const brapiRes = await fetch("https://brapi.dev/api/quote/%5EBVSP", {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      if (brapiRes.ok) {
        const brapiData = await brapiRes.json();
        const r = brapiData.results?.[0];
        if (r?.regularMarketPrice) {
          results.ibovespa = {
            price: r.regularMarketPrice,
            change: r.regularMarketChangePercent || 0,
          };
        }
      }
    } catch (e) {
      console.error("brapi error:", e);
    }

    // Source 2: Yahoo Finance (if brapi failed)
    if (!results.ibovespa) {
      try {
        const yahooRes = await fetch(
          "https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?interval=1d&range=1d",
          { headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (yahooRes.ok) {
          const yahooData = await yahooRes.json();
          const meta = yahooData.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice) {
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose || meta.previousClose || price;
            results.ibovespa = {
              price,
              change: prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0,
            };
          }
        }
      } catch (e) {
        console.error("yahoo error:", e);
      }
    }

    // Source 3: Google Finance via alternative proxy
    if (!results.ibovespa) {
      try {
        const altRes = await fetch("https://www.google.com/finance/quote/IBOV:INDEXBVMF", {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
        });
        if (altRes.ok) {
          const html = await altRes.text();
          const priceMatch = html.match(/data-last-price="([^"]+)"/);
          const changeMatch = html.match(/data-last-normal-market-change-percent="([^"]+)"/);
          if (priceMatch) {
            results.ibovespa = {
              price: parseFloat(priceMatch[1]),
              change: changeMatch ? parseFloat(changeMatch[1]) : 0,
            };
          }
        }
      } catch (e) {
        console.error("google finance error:", e);
      }
    }

    // Fetch crypto from CoinGecko (server-side, no CORS issues)
    try {
      const cryptoRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd&include_24hr_change=true"
      );
      if (cryptoRes.ok) {
        results.crypto = await cryptoRes.json();
      }
    } catch (e) {
      console.error("coingecko error:", e);
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});