import { useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, RefreshCw, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface NewsItem {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  description?: string;
}

async function fetchNews(): Promise<NewsItem[]> {
  const { data, error } = await supabase.functions.invoke('news-feed');
  if (error) throw error;
  return data?.news || [];
}

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(diffMin / 60);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin} min`;
    if (diffHrs < 24) return `${diffHrs}h`;
    return `${Math.floor(diffHrs / 24)}d`;
  } catch {
    return '';
  }
}

function getSourceStyle(source: string) {
  switch (source) {
    case 'CNN Brasil':
      return { dot: 'bg-destructive', badge: 'border-destructive/20 text-destructive bg-destructive/5' };
    case 'Jovem Pan':
      return { dot: 'bg-emerald-500', badge: 'border-emerald-500/20 text-emerald-700 bg-emerald-500/5 dark:text-emerald-400' };
    default:
      return { dot: 'bg-muted-foreground', badge: 'border-border text-muted-foreground bg-muted' };
  }
}

export function NewsFeedCard() {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const { data: news, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['news-feed'],
    queryFn: fetchNews,
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });

  const topNews = news?.slice(0, 1)[0];
  const restNews = news?.slice(1, 8);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <Card className="overflow-hidden border-border/60 shadow-sm">
          {/* Header */}
          <CardHeader className="pb-0 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2.5 text-foreground">
                <div className="p-1.5 rounded-md bg-primary/10">
                  <TrendingUp className="h-3.5 w-3.5 text-primary" />
                </div>
                Notícias em Destaque
                <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 h-4 border-border/50 text-muted-foreground">
                  LIVE
                </Badge>
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-3">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <div className="grid grid-cols-2 gap-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-12 rounded-md" />
                  ))}
                </div>
              </div>
            ) : error || !news?.length ? (
              <div className="py-8 text-center">
                <Newspaper className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {error ? 'Erro ao carregar' : 'Sem notícias'}
                </p>
                <Button variant="link" size="sm" onClick={() => refetch()} className="mt-1 text-xs">
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Featured / top news */}
                {topNews && (
                  <button
                    onClick={() => setSelectedNews(topNews)}
                    className="w-full text-left group"
                  >
                    <div className="p-3.5 rounded-lg bg-muted/40 border border-border/40 hover:border-primary/30 hover:bg-muted/60 transition-all duration-200">
                      <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                        {topNews.title}
                      </p>
                      {topNews.description && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">
                          {topNews.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getSourceStyle(topNews.source).badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getSourceStyle(topNews.source).dot}`} />
                          {topNews.source}
                        </span>
                        {topNews.pubDate && (
                          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                            <Clock className="h-2.5 w-2.5" />
                            {formatTimeAgo(topNews.pubDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                )}

                {/* Rest of the news in compact list */}
                <div className="space-y-0.5">
                  {restNews?.map((item, idx) => {
                    const style = getSourceStyle(item.source);
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedNews(item)}
                        className="w-full flex items-center gap-3 px-2.5 py-2 rounded-md hover:bg-muted/50 transition-colors group text-left"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                        <p className="flex-1 text-[13px] leading-snug line-clamp-1 text-foreground/80 group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                            {item.source}
                          </span>
                          {item.pubDate && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {formatTimeAgo(item.pubDate)}
                            </span>
                          )}
                          <ExternalLink className="h-3 w-3 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* News iframe dialog */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              {selectedNews && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getSourceStyle(selectedNews.source).badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${getSourceStyle(selectedNews.source).dot}`} />
                  {selectedNews.source}
                </span>
              )}
              {selectedNews?.pubDate && (
                <span className="text-[10px] text-muted-foreground">
                  {formatTimeAgo(selectedNews.pubDate)}
                </span>
              )}
            </div>
            <DialogTitle className="text-sm leading-snug line-clamp-1 pr-6">
              {selectedNews?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">Visualização da notícia</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {selectedNews?.link && (
              <iframe
                src={selectedNews.link}
                className="w-full h-full border-0"
                sandbox="allow-scripts allow-same-origin allow-popups"
                title={selectedNews.title}
              />
            )}
          </div>
          <div className="px-4 py-2 border-t flex-shrink-0 flex justify-end">
            <Button asChild variant="outline" size="sm">
              <a href={selectedNews?.link} target="_blank" rel="noopener noreferrer" className="gap-2">
                <ExternalLink className="h-3.5 w-3.5" />
                Abrir em nova aba
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
