import { useState, useCallback } from "react";
import { FileText, Upload, Loader2, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function NFeImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [xmlContent, setXmlContent] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      const reader = new FileReader();
      reader.onload = (ev) => {
        setXmlContent(ev.target?.result as string);
      };
      reader.readAsText(selectedFile);
    }
  }, []);

  const handleImport = async () => {
    if (!xmlContent) return;
    setParsing(true);
    
    // Simulated parsing - in production this would call an edge function
    setTimeout(() => {
      setParsing(false);
      toast.success("Funcionalidade de importacao XML em desenvolvimento. Configure o edge function para parsing completo.");
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Importar NF-e"
        description="Upload de XML para importacao automatica de notas fiscais"
        icon={FileText}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload do XML
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xml"
                onChange={handleFileChange}
                className="hidden"
                id="xml-upload"
              />
              <label
                htmlFor="xml-upload"
                className="cursor-pointer flex flex-col items-center gap-4"
              >
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {file ? file.name : "Clique para selecionar o arquivo XML"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Arquivos XML de NF-e (modelo 55)
                  </p>
                </div>
              </label>
            </div>

            {file && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 flex justify-end"
              >
                <Button onClick={handleImport} disabled={parsing}>
                  {parsing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Processar XML
                </Button>
              </motion.div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-info" />
              Instrucoes
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>1. Faca upload do arquivo XML da NF-e recebida</p>
            <p>2. O sistema ira extrair automaticamente: emitente, destinatario, transportadora e itens</p>
            <p>3. Itens serao vinculados por EAN, codigo do fornecedor ou descricao</p>
            <p>4. Informe manualmente os lotes caso nao constem no XML</p>
            <p>5. Confirme a importacao para gerar os lotes de estoque</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
