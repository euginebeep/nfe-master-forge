import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Upload, FileArchive, FileText, Image as ImageIcon, X, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

export function AnvisaCheckerForm({ onResult }: { onResult: (laudo: any) => void }) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [audience, setAudience] = useState("ADULTOS");
  const [outputType, setOutputType] = useState("COMPLETO");
  const [clientName, setClientName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelection = (selectedFile: File) => {
    const validTypes = [
      'application/zip', 
      'application/x-zip-compressed',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.docx')) {
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

    setFile(selectedFile);
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-12 h-12 text-muted-foreground mb-4" />;
    if (file.type.includes('zip')) return <FileArchive className="w-12 h-12 text-primary mb-4" />;
    if (file.type.includes('image')) return <ImageIcon className="w-12 h-12 text-primary mb-4" />;
    return <FileText className="w-12 h-12 text-primary mb-4" />;
  };

  const getChipInfo = () => {
    if (!file) return null;
    if (file.type.includes('zip')) return { text: "📦 Múltiplos produtos detectados", variant: "default" };
    if (file.name.endsWith('.docx')) return { text: "📄 Briefing individual", variant: "secondary" };
    if (file.type === 'application/pdf') return { text: "📋 Ficha técnica PDF", variant: "secondary" };
    if (file.type.includes('image')) return { text: "📷 Análise por visão computacional", variant: "outline" };
    return null;
  };

  const handleCheckNow = async () => {
    if (!file) return;

    setAnalyzing(true);
    setCurrentStep(0);

    try {
      // Converter arquivo para base64 se necessário
      const reader = new FileReader();
      const fileData = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });

      // Chamar Edge Function anvisa-ai-verify
      // NOTA: Estamos assumindo que a função aceita este payload agora ou lidaremos com a resposta
      const { data, error } = await supabase.functions.invoke('anvisa-ai-verify', {
        body: {
          action: 'analyze_file', // Tentando usar analyze_file conforme a nova interface
          file: fileData,
          filename: file.name,
          options: {
            publico: audience,
            tipo_saida: outputType,
            cliente: clientName
          }
        }
      });

      if (error) throw error;

      // Salvar histórico no Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (profile?.company_id) {
          await supabase.from('anvisa_laudos').insert({
            company_id: profile.company_id,
            produto: file.name,
            cliente: clientName,
            status_geral: data.status_geral || 'PROCESSADO',
            payload_entrada: { filename: file.name, options: { audience, outputType } } as any,
            resultado_ia: data as any,
            criado_por: user.id
          });
        }
      }

      // Pequeno delay final para garantir que o usuário veja a última etapa
      await new Promise(r => setTimeout(resolve => r(null), 1000));
      
      onResult({
        produto: file.name,
        cliente: clientName,
        payload_entrada: { ativos: data.ativos || [] },
        resultado_ia: data
      });

      toast({ title: "Análise concluída", description: "O laudo foi gerado com sucesso." });
    } catch (error) {
      console.error(error);
      toast({ 
        variant: "destructive", 
        title: "Erro na análise", 
        description: "Falha ao processar o arquivo. Verifique se o formato é válido." 
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const removeFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ELEMENTO 1 — ZONA DE UPLOAD GRANDE */}
      <div className="space-y-4">
        <div
          className={cn(
            "relative min-h-[320px] flex flex-col items-center justify-center border-4 border-dashed rounded-3xl transition-all duration-300 group cursor-pointer",
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
              "p-6 rounded-full bg-background shadow-xl mb-2 transition-transform group-hover:scale-110 duration-500",
              file ? "text-green-500" : "text-primary"
            )}>
              {getFileIcon()}
            </div>
            
            {!file ? (
              <>
                <h3 className="text-2xl font-bold tracking-tight mb-2">Arraste aqui ou clique para selecionar</h3>
                <p className="text-muted-foreground text-lg">.zip · .docx · .pdf · foto (máx 20MB)</p>
              </>
            ) : (
              <div className="space-y-2 animate-in zoom-in duration-300">
                <h3 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  {file.name}
                </h3>
                <p className="text-muted-foreground">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
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
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

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
