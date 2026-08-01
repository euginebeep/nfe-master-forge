import { useQuery } from "@tanstack/react-query";
import { invokeEdge } from "@/lib/edge-invoke";

export interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description?: string;
  imageUrl?: string;
}

async function fetchNews(): Promise<NewsItem[]> {
  const { data, error } = await invokeEdge<{ news?: NewsItem[] }>("news-feed");
  if (error) throw new Error(error);
  return data?.news ?? [];
}

/**
 * Feed de notícias. `fonte` filtra por origem (ex.: "ANVISA").
 * A query é compartilhada: o mesmo queryKey serve todos os cards.
 */
export function useNewsFeed(fonte?: string, limite = 20) {
  const query = useQuery({
    queryKey: ["news-feed"],
    queryFn: fetchNews,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
  });

  const noticias = (query.data ?? [])
    .filter((n) => (fonte ? n.source === fonte : true))
    .slice(0, limite);

  return { ...query, noticias };
}
