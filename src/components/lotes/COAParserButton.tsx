// ============================================================
// COA PARSER BUTTON - Extrai dados de potência do PDF do COA
// ============================================================

import { useState, useRef } from "react";
import { Search, FileText, Loader2, AlertCircle, CheckCircle, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

interface COAParserButtonProps {
  materiasPrimas: Array<{ id: string; descricao: string }>;
  onPotenciaEncontrada?: (dados: {
    tipo: "UI_POR_GRAMA" | "MG_POR_GRAMA" | "PERCENTUAL";
    valor: number;
    textoOriginal: string;
  }) => void;
}

// Padrões regex para encontrar potências em COA
const POTENCIA_PATTERNS = [
  // UI/g patterns
  { regex: /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:UI|IU)\s*(?:\/|por)\s*(?:g|grama)/gi, tipo: "UI_POR_GRAMA" as const },
  { regex: /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:IU|UI)\s*\/\s*g/gi, tipo: "UI_POR_GRAMA" as const },
  { regex: /potency[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:IU|UI)/gi, tipo: "UI_POR_GRAMA" as const },
  { regex: /assay[:\s]*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*(?:IU|UI)/gi, tipo: "UI_POR_GRAMA" as const },
  
  // mg/g patterns
  { regex: /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*mg\s*(?:\/|por)\s*(?:g|grama)/gi, tipo: "MG_POR_GRAMA" as const },
  { regex: /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)\s*mg\/g/gi, tipo: "MG_POR_GRAMA" as const },
  
  // Percentual patterns
  { regex: /(\d{1,3}(?:[.,]\d{1,2})?)\s*%\s*(?:pureza|purity|teor|assay)/gi, tipo: "PERCENTUAL" as const },
  { regex: /(?:pureza|purity|teor|assay)[:\s]*(\d{1,3}(?:[.,]\d{1,2})?)\s*%/gi, tipo: "PERCENTUAL" as const },
  { regex: /(\d{2,3}(?:[.,]\d{1,2})?)\s*%/gi, tipo: "PERCENTUAL" as const },
];

interface ResultadoBusca {
  tipo: "UI_POR_GRAMA" | "MG_POR_GRAMA" | "PERCENTUAL";
  valor: number;
  textoOriginal: string;
  confianca: "alta" | "media" | "baixa";
}

function parseNumero(str: string): number {
  // Handle Brazilian number format (1.000,50) and international (1,000.50)
  let cleaned = str.replace(/\s/g, '');
  
  // If has both . and ,, determine format
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Brazilian: 1.000,50 -> last separator is decimal
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // International: 1,000.50
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (cleaned.includes(',')) {
    // Could be decimal comma (1,5) or thousand separator (1,000)
    const parts = cleaned.split(',');
    if (parts[1]?.length === 3 && !parts[1].includes('.')) {
      // Likely thousand separator
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Likely decimal comma
      cleaned = cleaned.replace(',', '.');
    }
  }
  
  return parseFloat(cleaned) || 0;
}

function buscarPotenciaNoTexto(texto: string): ResultadoBusca[] {
  const resultados: ResultadoBusca[] = [];
  
  for (const pattern of POTENCIA_PATTERNS) {
    const matches = texto.matchAll(pattern.regex);
    for (const match of matches) {
      const valorStr = match[1];
      const valor = parseNumero(valorStr);
      
      if (valor > 0) {
        // Determine confidence based on context
        const contexto = match[0].toLowerCase();
        let confianca: "alta" | "media" | "baixa" = "media";
        
        if (contexto.includes('assay') || contexto.includes('potency') || contexto.includes('teor')) {
          confianca = "alta";
        } else if (pattern.tipo === "UI_POR_GRAMA" && valor >= 10000) {
          confianca = "alta"; // Common vitamin potencies
        } else if (pattern.tipo === "PERCENTUAL" && valor >= 90 && valor <= 110) {
          confianca = "alta"; // Common purity range
        }
        
        resultados.push({
          tipo: pattern.tipo,
          valor,
          textoOriginal: match[0].trim(),
          confianca,
        });
      }
    }
  }
  
  // Sort by confidence and value
  return resultados.sort((a, b) => {
    const confOrder = { alta: 0, media: 1, baixa: 2 };
    if (confOrder[a.confianca] !== confOrder[b.confianca]) {
      return confOrder[a.confianca] - confOrder[b.confianca];
    }
    return b.valor - a.valor;
  });
}

export function COAParserButton({ materiasPrimas, onPotenciaEncontrada }: COAParserButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [textoExtraido, setTextoExtraido] = useState("");
  const [resultados, setResultados] = useState<ResultadoBusca[]>([]);
  const [buscaManual, setBuscaManual] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    setLoading(true);
    setTextoExtraido("");
    setResultados([]);
    setDialogOpen(true);

    try {
      // Read file as text (basic extraction for now)
      // In production, this would use a proper PDF parser or OCR service
      const text = await extractTextFromPDF(file);
      setTextoExtraido(text);
      
      // Search for potency patterns
      const encontrados = buscarPotenciaNoTexto(text);
      setResultados(encontrados);
      
      if (encontrados.length === 0) {
        toast.warning("Nenhuma potência encontrada automaticamente. Verifique o texto extraído.");
      } else {
        toast.success(`${encontrados.length} potência(s) encontrada(s)`);
      }
    } catch (err) {
      console.error("Erro ao processar PDF:", err);
      toast.error("Erro ao processar o PDF");
    } finally {
      setLoading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Simple text extraction - reads the raw PDF content
    // For production, use pdf.js or a server-side solution
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        
        // Extract readable text from PDF binary
        // This is a basic approach - extracts strings between parentheses and other patterns
        let extracted = "";
        
        // Pattern 1: Text between parentheses (common in PDF)
        const parenMatches = content.match(/\(([^)]+)\)/g);
        if (parenMatches) {
          extracted += parenMatches
            .map(m => m.slice(1, -1))
            .filter(t => t.length > 2 && /[a-zA-Z0-9]/.test(t))
            .join(" ");
        }
        
        // Pattern 2: Look for common COA terms directly in binary
        const textPatterns = [
          /Assay[:\s]*[\d.,]+\s*(?:IU|UI|mg|%)/gi,
          /Potency[:\s]*[\d.,]+\s*(?:IU|UI|mg|%)/gi,
          /[\d.,]+\s*(?:IU|UI)\/g/gi,
          /[\d.,]+\s*mg\/g/gi,
          /[\d.,]+\s*%\s*(?:purity|pureza|teor)/gi,
        ];
        
        for (const pattern of textPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            extracted += " " + matches.join(" ");
          }
        }
        
        resolve(extracted || "Não foi possível extrair texto. Cole o conteúdo manualmente abaixo.");
      };
      reader.readAsText(file);
    });
  };

  const handleBuscaManual = () => {
    if (!buscaManual.trim()) return;
    const encontrados = buscarPotenciaNoTexto(buscaManual);
    setResultados(encontrados);
    
    if (encontrados.length === 0) {
      toast.warning("Nenhuma potência encontrada no texto informado");
    }
  };

  const aplicarResultado = (resultado: ResultadoBusca) => {
    onPotenciaEncontrada?.({
      tipo: resultado.tipo,
      valor: resultado.valor,
      textoOriginal: resultado.textoOriginal,
    });
    setDialogOpen(false);
    toast.success(`Potência aplicada: ${resultado.valor} ${resultado.tipo === "UI_POR_GRAMA" ? "UI/g" : resultado.tipo === "MG_POR_GRAMA" ? "mg/g" : "%"}`);
  };

  const getTipoLabel = (tipo: string) => {
    switch (tipo) {
      case "UI_POR_GRAMA": return "UI/g";
      case "MG_POR_GRAMA": return "mg/g";
      case "PERCENTUAL": return "%";
      default: return tipo;
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />
      
      <Button
        type="button"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Search className="h-4 w-4 mr-2" />
        )}
        Pesquisar no COA
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Extração de Potência do COA
            </DialogTitle>
            <DialogDescription>
              O sistema buscou automaticamente valores de potência no PDF. 
              Selecione o valor correto ou cole o texto manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Resultados encontrados */}
            {resultados.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Potências encontradas:</Label>
                <div className="space-y-2">
                  {resultados.map((resultado, idx) => (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => aplicarResultado(resultado)}
                    >
                      <div className="flex items-center gap-3">
                        {resultado.confianca === "alta" ? (
                          <CheckCircle className="h-5 w-5 text-secondary" />
                        ) : resultado.confianca === "media" ? (
                          <Beaker className="h-5 w-5 text-warning" />
                        ) : (
                          <AlertCircle className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                          <div className="font-mono font-medium">
                            {resultado.valor.toLocaleString('pt-BR')} {getTipoLabel(resultado.tipo)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            "{resultado.textoOriginal}"
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary">
                        Aplicar
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resultados.length === 0 && !loading && (
              <Alert className="bg-warning/10 border-warning/30">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-sm">
                  Nenhuma potência encontrada automaticamente. 
                  Cole o texto do COA abaixo para busca manual.
                </AlertDescription>
              </Alert>
            )}

            {/* Busca manual */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Busca manual (cole o texto do COA):</Label>
              <Textarea
                value={buscaManual}
                onChange={(e) => setBuscaManual(e.target.value)}
                placeholder="Cole aqui o texto copiado do PDF do COA..."
                rows={4}
              />
              <Button 
                type="button" 
                variant="secondary" 
                size="sm"
                onClick={handleBuscaManual}
                disabled={!buscaManual.trim()}
              >
                <Search className="h-4 w-4 mr-2" />
                Buscar no texto
              </Button>
            </div>

            {/* Texto extraído (debug) */}
            {textoExtraido && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">
                  Texto extraído do PDF (para referência):
                </Label>
                <ScrollArea className="h-24 border rounded p-2">
                  <pre className="text-xs whitespace-pre-wrap text-muted-foreground">
                    {textoExtraido.substring(0, 2000)}
                    {textoExtraido.length > 2000 && "..."}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
