import { useState } from 'react';
import { motion } from 'framer-motion';
import { Newspaper, ExternalLink, RefreshCw, TrendingUp, Scale } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useNewsFeed, type NewsItem } from '@/hooks/use-news-feed';

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

function getSourceStyle(source: string) {
  switch (source) {
    case 'CNN Brasil':
      return { dot: 'bg-destructive', badge: 'border-destructive/20 text-destructive bg-destructive/5', short: 'CNN', icon: null };
    case 'Jovem Pan':
      return { dot: 'bg-emerald-500', badge: 'border-emerald-500/20 text-emerald-700 bg-emerald-500/5 dark:text-emerald-400', short: 'JP', icon: null };
    case 'ANVISA':
      return { dot: 'bg-teal-500', badge: 'border-teal-500/25 text-teal-700 bg-teal-500/10 dark:text-teal-300', short: 'ANVISA', icon: Scale };
    default:
      return { dot: 'bg-muted-foreground', badge: 'border-border text-muted-foreground bg-muted', short: '?', icon: null };
  }
}

export function NewsFeedCard() {
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const { noticias: news, isLoading, error, refetch, isFetching } = useNewsFeed(undefined, 10);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="w-full"
      >
        <Card className="overflow-hidden border-border/60 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3">
            {/* Label */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="p-1 rounded-md bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">Notícias</span>
              <Badge variant="outline" className="text-[9px] font-medium px-1.5 py-0 h-4 border-border/50 text-muted-foreground">
                LIVE
              </Badge>
            </div>

            <div className="h-5 w-px bg-border/60 flex-shrink-0" />

            {/* News items horizontal */}
            <div className="flex-1 overflow-x-auto scrollbar-hide">
              {isLoading ? (
                <div className="flex gap-3">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-5 w-48 rounded-md flex-shrink-0" />
                  ))}
                </div>
              ) : error || !news.length ? (
                <div className="flex items-center gap-2">
                  <Newspaper className="h-3.5 w-3.5 text-muted-foreground/30" />
                  <span className="text-[11px] text-muted-foreground">
                    {error ? 'Erro ao carregar' : 'Sem notícias'}
                  </span>
                  <Button variant="link" size="sm" onClick={() => refetch()} className="text-[10px] h-auto p-0">
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  {news.slice(0, 10).map((item, idx) => {
                    const style = getSourceStyle(item.source);
                    return (
                      <span key={`${item.source}-${item.link}-${idx}`} className="contents">
                        {idx > 0 && (
                          <span className="text-muted-foreground/20 text-[10px] flex-shrink-0 mx-1">•</span>
                        )}
                        <button
                          onClick={() => setSelectedNews(item)}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors group flex-shrink-0 text-left"
                        >
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold border ${style.badge}`}>
                            {style.icon ? (
                              <style.icon className="h-2.5 w-2.5" />
                            ) : (
                              <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                            )}
                            {style.short}
                          </span>
                          <span className="text-[13px] leading-snug text-foreground/85 group-hover:text-primary font-medium transition-colors max-w-[280px] truncate">
                            {item.title}
                          </span>
                          {item.pubDate && (
                            <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 tabular-nums">
                              {formatTimeAgo(item.pubDate)}
                            </span>
                          )}
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Refresh */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-md flex-shrink-0"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </Card>
      </motion.div>

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
