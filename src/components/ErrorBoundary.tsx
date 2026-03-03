import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

function isChunkLoadError(error: Error): boolean {
  const msg = error.message || '';
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Loading chunk') ||
    msg.includes('Loading CSS chunk') ||
    msg.includes('ChunkLoadError')
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error, errorInfo);

    // Auto-retry chunk load errors up to 2 times with a page reload
    if (isChunkLoadError(error) && this.state.retryCount < 2) {
      this.setState(prev => ({ retryCount: prev.retryCount + 1 }));
      // Force reload to get fresh chunks
      window.location.reload();
      return;
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleForceReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const isChunk = this.state.error && isChunkLoadError(this.state.error);

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <CardTitle>
                {isChunk ? 'Atualização detectada' : 'Ops! Algo deu errado.'}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                {isChunk
                  ? 'Uma nova versão do sistema está disponível. Recarregue a página para continuar.'
                  : 'Ocorreu um erro inesperado. Tente novamente ou entre em contato com o suporte.'}
              </p>
              {this.state.error && (
                <pre className="text-xs text-left bg-muted p-3 rounded-md overflow-auto max-h-32">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex gap-2 justify-center">
                {isChunk ? (
                  <Button onClick={this.handleForceReload} className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Recarregar página
                  </Button>
                ) : (
                  <>
                    <Button onClick={this.handleReset} className="gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Tentar novamente
                    </Button>
                    <Button variant="outline" onClick={this.handleForceReload} className="gap-2">
                      Recarregar página
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
