import { useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, RefreshCw, Clock, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    if (diffMin < 60) return `${diffMin}min`;
    if (diffHrs < 24) return `${diffHrs}h`;
    return `${Math.floor(diffHrs / 24)}d`;
  } catch {
    return '';
  }
}

function getSourceColor(source: string): string {
  switch (source) {
    case 'CNN Brasil': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    case 'Jovem Pan': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    default: return 'bg-muted text-muted-foreground';
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="lg:col-span-2"
      >
        <Card className="overflow-hidden h-full">
          <CardHeader className="pb-2 bg-gradient-to-r from-rose-50 to-orange-50/50 dark:from-rose-950/30 dark:to-orange-950/20">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-destructive/10">
                  <Newspaper className="h-4 w-4 text-destructive" />
                </div>
                Notícias do Dia
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : error || !news?.length ? (
              <div className="p-6 text-center">
                <Newspaper className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {error ? 'Erro ao carregar notícias' : 'Nenhuma notícia disponível'}
                </p>
                <Button variant="link" size="sm" onClick={() => refetch()} className="mt-1">
                  Tentar novamente
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[320px]">
                <div className="divide-y divide-border">
                  {news.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedNews(item)}
                      className="flex items-start gap-3 p-3 hover:bg-muted/50 transition-colors group w-full text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${getSourceColor(item.source)}`}>
                            {item.source}
                          </span>
                          {item.pubDate && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" />
                              {formatTimeAgo(item.pubDate)}
                            </span>
                          )}
                        </div>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary flex-shrink-0 mt-1 transition-colors" />
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* News popup dialog */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {selectedNews && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${getSourceColor(selectedNews.source)}`}>
                  {selectedNews.source}
                </span>
              )}
              {selectedNews?.pubDate && (
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(selectedNews.pubDate)}
                </span>
              )}
            </div>
            <DialogTitle className="text-base leading-snug">
              {selectedNews?.title}
            </DialogTitle>
            <DialogDescription className="sr-only">Detalhes da notícia</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedNews?.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedNews.description}
              </p>
            )}
            <div className="flex justify-end">
              <Button asChild variant="outline" size="sm">
                <a href={selectedNews?.link} target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ler matéria completa
                </a>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
