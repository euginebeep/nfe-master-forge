import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Upload, FileArchive, FileText, Image as ImageIcon, X, CheckCircle2, Loader2, AlertCircle, FileSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { resolveAnvisaKey } from "@/lib/anvisa-limits";
import JSZip from "jszip";



const AUDIENCES = [
  { value: "ADULTOS", label: "Adultos ≥19 anos" },
  { value: "GESTANTES", label: "Gestantes" },
  { value: "CRIANCAS_4_8", label: "Crianças 4-8 anos" },
  { value: "CRIANCAS_9_18", label: "Crianças 9-18 anos" },
  { value: "IDOSOS", label: "Idosos ≥65 anos" },
];

const OUTPUT_TYPES = [
  { value: "COMPLETO", label: "Laudo completo" },
  { value: "ALERTAS", label: "Apenas alertas críticos" },
  { value: "TABELA", label: "Tabela nutricional" },
];

const normalizeProductName = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const uniqueProductsByName = (items: any[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const name = item?.nome || item?.produto || item?.name;
    const key = normalizeProductName(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export function AnvisaCheckerForm({ onResult }: { onResult: (laudo: any) => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [audience, setAudience] = useState("ADULTOS");
  const [outputType, setOutputType] = useState("COMPLETO");
  const [clientName, setClientName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [errorDetails, setErrorDetails] = useState<{ message: string; step: string } | null>(null);
  const [zipContents, setZipContents] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clientLogoFile, setClientLogoFile] = useState<File | null>(null);
  const [clientLogoPreview, setClientLogoPreview] = useState<string | null>(null);
  const clientLogoInputRef = useRef<HTMLInputElement>(null);

  const handleClientLogoSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast({ variant: "destructive", title: "Logo muito grande", description: "Máximo 2MB." });
      return;
    }
    setClientLogoFile(f);
    setClientLogoPreview(URL.createObjectURL(f));
  };

  const removeClientLogo = () => {
    setClientLogoFile(null);
    setClientLogoPreview(null);
    if (clientLogoInputRef.current) clientLogoInputRef.current.value = "";
  };

  const uploadClientLogoIfNeeded = async (): Promise<string | null> => {
    if (!clientLogoFile) return null;
    const ext = clientLogoFile.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from('anvisa-laudo-logos')
      .upload(path, clientLogoFile, { upsert: false });
    if (error) {
      console.error('Erro ao subir logo do cliente:', error);
      return null;
    }
    const { data } = supabase.storage.from('anvisa-laudo-logos').getPublicUrl(path);
    return data.publicUrl;
  };

  const steps = [
    "📂 Extraindo dados do arquivo...",
    "🔍 Identificando ativos e doses...",
    "⚖️ Verificando limites IN 28/2018...",
    "📋 Gerando laudo completo..."
  ];

  useEffect(() => {
    let interval: any;
    if (analyzing && currentStep < steps.length) {
      interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev < steps.length - 1) return prev + 1;
          return prev;
        });
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [analyzing, currentStep]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = async (selectedFile: File) => {
    const validTypes = [
      'application/zip', 
      'application/x-zip-compressed',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    const isDocx = selectedFile.name.endsWith('.docx');
    
    if (!validTypes.includes(selectedFile.type) && !isDocx) {
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: "Selecione um arquivo .zip, .docx, .pdf ou imagem."
      });
      return;
    }

    if (selectedFile.size > 20 * 1024 * 1024) {
      toast({
        variant: "destructive",
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 20MB."
      });
      return;
    }

    setZipContents([]);
    
    // Validação específica para ZIP
    if (selectedFile.type.includes('zip') || selectedFile.name.endsWith('.zip')) {
      setIsValidating(true);
      try {
        const zip = await JSZip.loadAsync(selectedFile);
        const filesFound: string[] = [];
        const supportedExtensions = ['.docx', '.pdf', '.txt', '.md', '.csv', '.json', '.xml', '.html'];
        
        Object.keys(zip.files).forEach(filename => {
          const entry = zip.files[filename];
          if (!entry.dir && !filename.startsWith('__MACOSX/') && !filename.endsWith('.DS_Store')) {
            const lowerName = filename.toLowerCase();
            if (supportedExtensions.some(ext => lowerName.endsWith(ext))) {
              filesFound.push(filename);
            }
          }
        });

        if (filesFound.length === 0) {
          toast({
            variant: "destructive",
            title: "ZIP Inválido",
            description: "O arquivo ZIP deve conter pelo menos um documento válido (.docx, .pdf, .txt)."
          });
          setIsValidating(false);
          return;
        }
        
        // Verifica se há algo que pareça um briefing ou ficha técnica (recomendação)
        const hasBriefing = filesFound.some(f => 
          f.toLowerCase().includes('briefing') || 
          f.toLowerCase().includes('ficha') || 
          f.toLowerCase().includes('formula')
        );

        if (!hasBriefing) {
          toast({
            title: "Aviso de conteúdo",
            description: "Nenhum arquivo 'Briefing' ou 'Ficha Técnica' identificado no ZIP. A análise pode ser incompleta.",
          });
        }

        setZipContents(filesFound);
      } catch (err) {
        toast({
          variant: "destructive",
          title: "Erro ao ler ZIP",
          description: "Não foi possível processar o conteúdo do arquivo ZIP."
        });
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    setFile(selectedFile);
    if (selectedFile.type.startsWith('image/')) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };


  const getFileIcon = () => {
    if (previewUrl) return <img src={previewUrl} className="w-48 h-48 object-cover rounded-3xl mb-4 shadow-2xl ring-4 ring-primary/20 animate-in zoom-in duration-500" alt="Preview" />;
    if (!file) return <Upload className="w-20 h-20 text-muted-foreground mb-4 group-hover:scale-110 transition-transform duration-500" />;
    
    const iconClass = "w-20 h-20 text-primary mb-4 animate-in zoom-in duration-300";
    if (file.type.includes('zip')) return <FileArchive className={iconClass} />;
    if (file.type.includes('image')) return <ImageIcon className={iconClass} />;
    return <FileText className={iconClass} />;
  };

  const getChipInfo = () => {
    if (!file) return null;
    if (file.type.includes('zip') || file.name.endsWith('.zip')) {
      return { 
        text: zipContents.length > 0 
          ? `📦 ${zipContents.length} produto(s) detectados` 
          : "📦 Processando ZIP...", 
        variant: "default" 
      };
    }
    if (file.name.endsWith('.docx')) return { text: "📄 Briefing individual", variant: "secondary" };
    if (file.type === 'application/pdf') return { text: "📋 Ficha técnica PDF", variant: "secondary" };
    if (file.type.includes('image')) return { text: "📷 Análise por visão computacional", variant: "outline" };
    return null;
  };


  const handleCheckNow = async () => {
    if (!file) return;

    setAnalyzing(true);
    setCurrentStep(0);
    setErrorDetails(null);

    try {
      const uploadedClientLogoUrl = await uploadClientLogoIfNeeded();

      const reader = new FileReader();
      const fileBase64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const res = reader.result as string;
          resolve(res.split(',')[1]);
        };
        reader.readAsDataURL(file);
      });

      let fileType = "docx";
      if (file.type.includes('zip')) fileType = "zip";
      else if (file.type === 'application/pdf') fileType = "pdf";
      else if (file.type.startsWith('image/')) fileType = "image";

      const { data, error } = await supabase.functions.invoke('anvisa-ai-verify', {
        body: {
          action: 'analyze_file',
          file_type: fileType,
          file_name: file.name,
          file_base64: fileBase64,
          publico: audience,
          cliente: clientName
        }
      });

      if (error) {
        console.error('Invoke error:', error);
        // Tentar extrair mensagem amigável do corpo do erro (status 503/500)
        const errMsg = error?.message || '';
        if (data?.erro) {
          throw new Error(data.erro + (data.mensagem ? ': ' + data.mensagem : ''));
        }
        throw error;
      }

      // ── VERIFICAR SE A RESPOSTA É UM ERRO ESTRUTURADO (ex: 503 com JSON) ──────────
      if (data?.erro) {
        throw new Error(data.erro + (data.mensagem ? ': ' + data.mensagem : ''));
      }

      // ── NORMALIZAÇÃO DO RETORNO
      console.log('AI Response:', data);

      let produtos = [];

      // Caso 1: retornou { produtos: [...] }
      if (data?.produtos && Array.isArray(data.produtos)) {
        produtos = data.produtos;
      }
      // Caso 2: retornou { total_produtos: N, produtos: [...] }
      else if (data?.total_produtos && data?.produtos) {
        produtos = data.produtos;
      }
      // Caso 3: retornou um único produto diretamente (sem array)
      else if (data?.nome || data?.ativos) {
        produtos = [data];
      }
      // Caso 4: retornou array direto
      else if (Array.isArray(data)) {
        produtos = data;
      }
      // Caso 5: fallback — criar produto vazio com a análise
      else {
        produtos = [{
          nome: file.name.replace(/\.[^/.]+$/, ""),
          status_geral: 'VERIFICAR',
          ativos: [],
          alertas: [{ tipo: 'warn', titulo: 'Parsing incompleto', corpo: String(data) }],
          analise_ia: typeof data === 'string' ? data : JSON.stringify(data),
          alegacoes_permitidas: [],
          alegacoes_proibidas: [],
          avisos_rotulo: [],
          sugestao_capsulas: { n: 1, tamanho: '#00', frasco: 60, obs: "" },
        }];
      }

      // ── NORMALIZAR CADA PRODUTO
      produtos = produtos.map((p: any) => ({
        nome: p.nome || p.produto || p.name || file.name.replace(/\.[^/.]+$/, ''),
        cliente: p.cliente || clientName || 'PROLAB',
        categoria: p.categoria || p.category || '',
        status_geral: p.status_geral || p.status || 'VERIFICAR',
        // Normalizar ativos — garantir nome e key sempre preenchidos
        ativos: (p.ativos || p.ingredientes || p.ingredients || []).map((a: any) => {
          const nomeAtivo = a.nome || a.name || a.ingrediente || a.ativo || '';
          const keyResolvida = a.key || a.chave || resolveAnvisaKey(nomeAtivo);
          return {
            nome: nomeAtivo,
            dose: Number(a.dose) || 0,
            unit: a.unit || a.unidade || 'mg',
            key: keyResolvida,
          };
        }).filter((a: any) => a.nome || a.dose > 0), // remover linhas completamente vazias
        alertas: Array.isArray(p.alertas) ? p.alertas : [],
        analise_ia: p.analise_ia || p.analise || p.analysis || '',
        alegacoes_permitidas: Array.isArray(p.alegacoes_permitidas) ? p.alegacoes_permitidas : [],
        alegacoes_proibidas: Array.isArray(p.alegacoes_proibidas) ? p.alegacoes_proibidas : [],
        avisos_rotulo: Array.isArray(p.avisos_rotulo) ? p.avisos_rotulo : [],
        sugestao_capsulas: p.sugestao_capsulas || { n: 1, tamanho: '#00', frasco: 60, obs: '' },
      }));

      produtos = uniqueProductsByName(produtos);

      const { data: { user } } = await supabase.auth.getUser();
      if (user && produtos) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (profile?.company_id) {
          for (const produto of produtos) {
            await supabase.from('anvisa_laudos').insert({
              company_id: profile.company_id,
              produto: produto.nome,
              cliente: clientName,
              cliente_logo_url: uploadedClientLogoUrl,
              cliente_nome_exibicao: clientName,
              status_geral: produto.status_geral,
              payload_entrada: { filename: file.name, ativos: produto.ativos } as any,
              resultado_ia: produto as any,
              criado_por: user.id
            });
          }
        }
      }

      await new Promise(r => setTimeout(resolve => r(null), 1000));
      
      if (produtos.length > 0) {
        onResult({
          produto: produtos[0].nome,
          cliente: clientName,
          cliente_logo_url: uploadedClientLogoUrl,
          payload_entrada: { ativos: produtos[0].ativos },
          resultado_ia: produtos[0],
          multiplos_produtos: produtos
        });

        // Tenta encontrar e clicar na aba de laudos automaticamente
        setTimeout(() => {
          const tabs = document.querySelectorAll('[role="tab"]');
          const laudosTab = Array.from(tabs).find(t => t.textContent?.includes('Laudos'));
          if (laudosTab instanceof HTMLElement) {
            laudosTab.click();
          }
        }, 300);
      }


      toast({ 
        title: "Análise concluída", 
        description: `${produtos.length} produto(s) analisado(s) com sucesso` 
      });
    } catch (error: any) {
      console.error(error);
      const stepName = steps[currentStep] || "Processamento inicial";

      // ── Mapeamento de erros para mensagens amigáveis ────────────────────────
      const rawMsg: string = error?.message || error?.error_description || String(error) || '';
      let friendlyMessage = '';

      if (
        rawMsg.includes('gemini_api_key_nao_configurada') ||
        rawMsg.includes('GEMINI_API_KEY') ||
        rawMsg.includes('503')
      ) {
        friendlyMessage =
          'O serviço de análise por BrainX ANVISA não está ativo. ' +
          'Entre em contato com o suporte para ativar o módulo de verificação regulatória.';
      } else if (
        rawMsg.includes('non-2xx') ||
        rawMsg.includes('Edge Function') ||
        rawMsg.includes('500') ||
        rawMsg.includes('FunctionsFetchError')
      ) {
        friendlyMessage =
          'O servidor de análise retornou um erro interno. ' +
          'Verifique se as chaves de API (GEMINI_API_KEY) estão configuradas no Supabase ' +
          'ou tente novamente em alguns instantes.';
      } else if (rawMsg.includes('gemini_api_error')) {
        friendlyMessage =
          'A API do Google Gemini recusou a requisição. ' +
          'Verifique se a GEMINI_API_KEY é válida e se o projeto tem cota disponível.';
      } else if (rawMsg.includes('powerbi')) {
        friendlyMessage =
          'Não foi possível consultar a base oficial ANVISA (Power BI). ' +
          'A análise continuará apenas com os dados locais.';
      } else {
        friendlyMessage =
          rawMsg || 'Falha ao processar o arquivo. Verifique se o formato é válido (.docx, .pdf, .zip ou imagem).';
      }
      // ─────────────────────────────────────────────────────────────────────────

      setErrorDetails({
        message: friendlyMessage,
        step: stepName
      });
      // Toast removido — o bloco de erro na página (acima do botão) é mais visível e não fica atrás do mascote
    } finally {
      setAnalyzing(false);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPreviewUrl(null);
    setZipContents([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };


  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ELEMENTO 1 — ZONA DE UPLOAD GRANDE */}
      <div className="space-y-4">
        <div
          className={cn(
            "relative min-h-[280px] flex flex-col items-center justify-center border-4 border-dashed rounded-3xl transition-all duration-300 group cursor-pointer",
            dragActive ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/5",
            file ? "border-green-500/50 bg-green-500/5" : ""
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
            accept=".zip,.docx,.pdf,image/*"
          />

          {file && (
            <button
              onClick={removeFile}
              className="absolute top-6 right-6 p-2 rounded-full bg-muted/80 hover:bg-destructive hover:text-white transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="flex flex-col items-center text-center px-8">
            <div className={cn(
              "p-6 rounded-full bg-background shadow-xl mb-4 transition-transform group-hover:scale-110 duration-500",
              file ? "text-green-500" : "text-primary"
            )}>
              {isValidating ? (
                <Loader2 className="w-20 h-20 animate-spin text-primary mb-4" />
              ) : (
                getFileIcon()
              )}
            </div>
            
            {!file ? (
              <>
                <h3 className="text-2xl font-bold tracking-tight mb-2">Arraste aqui ou clique para selecionar</h3>
                <p className="text-muted-foreground">.zip · .docx · .pdf · foto (máx 20MB)</p>
              </>
            ) : (
              <div className="space-y-2 animate-in zoom-in duration-300">
                <h3 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  {file.name}
                </h3>
                <p className="text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                {zipContents.length > 0 && (
                  <div className="mt-4 max-h-32 overflow-y-auto text-xs text-muted-foreground text-left bg-muted/30 p-3 rounded-lg border border-muted/50 w-full max-w-sm">
                    <p className="font-bold mb-1 flex items-center gap-1">
                      <FileSearch className="w-3 h-3" /> Arquivos para análise:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {zipContents.map((f, i) => (
                        <li key={i} className="truncate">{f.split('/').pop()}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {file && (
          <div className="flex justify-center gap-3 animate-in fade-in slide-in-from-top-2 duration-500">
            {(() => {
              const info = getChipInfo();
              if (!info) return null;
              return (
                <Badge variant={info.variant as any} className="px-4 py-1.5 text-sm font-medium shadow-sm">
                  {info.text}
                </Badge>
              );
            })()}
          </div>
        )}
      </div>

      {/* ELEMENTO 2 — OPÇÕES RÁPIDAS (COLAPSÁVEL) */}
      <Accordion type="single" collapsible className="w-full">
        <AccordionItem value="options" className="border rounded-2xl px-6 bg-muted/5">
          <AccordionTrigger className="hover:no-underline font-semibold text-lg py-4">
            ⚙️ Opções da análise
          </AccordionTrigger>
          <AccordionContent className="pb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-2">
              <div className="space-y-2">
                <Label className="text-sm font-bold opacity-70 uppercase tracking-wider">Público-alvo</Label>
                <Select value={audience} onValueChange={setAudience}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {AUDIENCES.map(a => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold opacity-70 uppercase tracking-wider">Tipo de saída</Label>
                <Select value={outputType} onValueChange={setOutputType}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTPUT_TYPES.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold opacity-70 uppercase tracking-wider">Cliente/Marca</Label>
                <Input 
                  placeholder="Opcional" 
                  value={clientName}
                  onChange={e => setClientName(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-bold opacity-70 uppercase tracking-wider">Logo do Cliente</Label>
                <div
                  className="relative h-11 rounded-xl border-2 border-dashed border-muted-foreground/30 hover:border-primary/50 transition-colors flex items-center justify-center cursor-pointer overflow-hidden"
                  onClick={() => clientLogoInputRef.current?.click()}
                >
                  {clientLogoPreview ? (
                    <>
                      <img src={clientLogoPreview} alt="Logo cliente" className="h-full object-contain px-2" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeClientLogo(); }}
                        className="absolute right-1 top-1 p-0.5 rounded-full bg-background/80 hover:bg-destructive hover:text-white"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" /> Opcional (PNG/JPG)
                    </span>
                  )}
                  <input
                    ref={clientLogoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={handleClientLogoSelection}
                  />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* ELEMENTO 3 — AVISO DE ERRO (exibido acima do botão, visível ao usuário) */}
      {errorDetails && (
        <div className="p-5 rounded-2xl bg-destructive/10 border-2 border-destructive/30 animate-in fade-in slide-in-from-top-3 duration-300 shadow-lg">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-destructive mt-0.5 shrink-0" />
            <div className="flex-1 space-y-2">
              <p className="font-bold text-destructive text-sm uppercase tracking-wider">
                ⚠️ Erro na etapa: {errorDetails.step}
              </p>
              <p className="text-sm leading-relaxed text-foreground/80">{errorDetails.message}</p>
              <Button
                variant="link"
                className="p-0 h-auto text-xs text-destructive/70 hover:text-destructive"
                onClick={() => setErrorDetails(null)}
              >
                Fechar aviso
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ELEMENTO 3 — BOTÃO "CHECAR AGORA" */}
      <div className="space-y-6">
        <Button
          size="lg"
          className={cn(
            "w-full h-16 text-xl font-bold rounded-2xl transition-all duration-300 shadow-xl shadow-primary/20",
            analyzing ? "bg-primary/80" : "hover:scale-[1.02] active:scale-95"
          )}
          disabled={!file || analyzing}
          onClick={handleCheckNow}
        >
          {analyzing ? (
            <div className="flex items-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              Analisando com IA ANVISA...
            </div>
          ) : !file ? (
            "Selecione um arquivo para começar"
          ) : (
            "🔬 Checar Agora"
          )}
        </Button>

        {analyzing && (
          <div className="space-y-4 animate-in fade-in duration-500 px-2">
            <Progress value={(currentStep + 1) * 25} className="h-3 rounded-full" />
            <div className="flex items-center justify-center gap-3 text-primary font-bold text-lg">
              <div className="animate-pulse">{steps[currentStep]}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
