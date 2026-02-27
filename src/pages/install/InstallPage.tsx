import { useState, useEffect } from "react";
import { Download, Smartphone, Apple, Monitor, CheckCircle2, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPage() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(isIOSDevice);

    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as any).standalone === true;
    setIsInstalled(isStandalone);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">App Instalado!</h2>
            <p className="text-muted-foreground">
              O BrainX ERP já está instalado no seu dispositivo. Você pode acessá-lo pela tela inicial.
            </p>
            <Button onClick={() => window.location.href = "/"} className="w-full">
              Abrir BrainX ERP
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3 py-8">
          <img src="/icon-192.png" alt="BrainX ERP" className="h-20 w-20 mx-auto rounded-2xl shadow-lg" />
          <h1 className="text-3xl font-bold">Instalar BrainX ERP</h1>
          <p className="text-muted-foreground text-lg">
            Acesse o sistema completo direto do seu celular, como um app nativo.
          </p>
        </div>

        {/* Android / Chrome - botão direto */}
        {deferredPrompt && (
          <Card className="border-primary">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Smartphone className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold text-lg">Instalação rápida</h3>
                  <p className="text-muted-foreground text-sm">Toque para instalar agora</p>
                </div>
              </div>
              <Button onClick={handleInstall} size="lg" className="w-full gap-2">
                <Download className="h-5 w-5" />
                Instalar BrainX ERP
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Instruções iOS */}
        {isIOS && !deferredPrompt && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Apple className="h-6 w-6" />
                Instalar no iPhone / iPad
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                  <p>Toque no botão <Share className="inline h-4 w-4 mx-1" /> <strong>Compartilhar</strong> na barra inferior do Safari</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                  <p>Role para baixo e toque em <strong>"Adicionar à Tela Início"</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                  <p>Toque em <strong>"Adicionar"</strong> no canto superior direito</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ⚠️ Use o Safari para instalar. Outros navegadores no iOS não suportam PWA.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Instruções genéricas quando sem prompt */}
        {!deferredPrompt && !isIOS && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-6 w-6" />
                Como instalar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">1</span>
                  <p>Abra o <strong>menu do navegador</strong> (⋮ ou ⋯)</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">2</span>
                  <p>Selecione <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong></p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shrink-0">3</span>
                  <p>Confirme a instalação</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Benefícios */}
        <Card>
          <CardHeader>
            <CardTitle>Vantagens do App</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Acesso rápido pela tela inicial
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Funciona em tela cheia, sem barra do navegador
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Carregamento mais rápido com cache inteligente
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Funciona no Android e iPhone
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                Sem necessidade de app store
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
