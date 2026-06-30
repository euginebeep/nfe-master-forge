import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Save, Loader2, Upload, X, FileCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useCompany, useUpsertCompany } from "@/hooks/use-company";
import { useUploadFile } from "@/hooks/use-files";
import { CNPJLookupInput } from "@/components/company/CNPJLookupInput";
import { CertificateTestButton } from "@/components/company/CertificateTestButton";
import { MaskedInput } from "@/components/ui/masked-input";
import type { Company, AmbienteNFe } from "@/types/erp";
import { toast } from "sonner";

const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const CRT_OPTIONS = [
  { value: "1", label: "1 - Simples Nacional" },
  { value: "2", label: "2 - Simples Nacional (excesso sublimite)" },
  { value: "3", label: "3 - Regime Normal" },
  { value: "4", label: "4 - MEI" },
];

export default function CompanySettingsPage() {
  const navigate = useNavigate();
  const { data: company, isLoading } = useCompany();
  const upsertCompany = useUpsertCompany();
  const uploadFile = useUploadFile();
  const [logoUploading, setLogoUploading] = useState(false);
  const [certUploading, setCertUploading] = useState(false);
  const [certFileName, setCertFileName] = useState<string | null>(null);
  const [certTestResult, setCertTestResult] = useState<{ daysUntilExpiry?: number } | null>(null);
  const [certError, setCertError] = useState<string | null>(null);
  // A senha do certificado NUNCA deve ser persistida (nem localStorage, nem
  // Supabase) — fica só em memória durante esta sessão da página, usada
  // exclusivamente para testar/validar o certificado. Ver auditoria de
  // segurança da página Empresa: a coluna certificado_senha_encrypted no
  // banco sugere criptografia pelo nome, mas nunca houve função de
  // criptografia implementada para ela — salvar ali era texto puro disfarçado.
  const [certSenha, setCertSenha] = useState("");

  // Fetch certificate file name when company loads
  useEffect(() => {
    const fetchCertName = async () => {
      const fileId = company?.certificado_a1_file_id;
      if (!fileId) { setCertFileName(null); return; }
      const { data } = await supabase
        .from("arquivos")
        .select("nome_original")
        .eq("id", fileId)
        .single();
      setCertFileName(data?.nome_original || null);
    };
    fetchCertName();
  }, [company?.certificado_a1_file_id]);

  const form = useForm<Partial<Company>>({
    values: company || undefined,
  });

  const onSubmit = async (data: Partial<Company>) => {
    // Defesa extra: garante que a senha do certificado nunca seja persistida,
    // mesmo que tenha vindo populada no form a partir de um valor antigo do banco.
    const { certificado_senha_encrypted, ...payload } = data as any;
    try {
      await upsertCompany.mutateAsync(payload);
      navigate("/");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar configurações da empresa");
    }
  };

  // Handle CNPJ lookup data
  const handleCNPJDataFound = (data: {
    razao_social: string;
    nome_fantasia: string;
    cnae: string;
    crt: string;
    regime_tributario: string;
    endereco_logradouro: string;
    endereco_nro: string;
    endereco_compl: string;
    endereco_bairro: string;
    endereco_cep: string;
    endereco_uf: string;
    endereco_cidade: string;
    endereco_cmun: string;
    telefone: string;
    email_fiscal: string;
  }) => {
    // Only update if fields are empty or user confirms
    form.setValue("razao_social", data.razao_social);
    form.setValue("nome_fantasia", data.nome_fantasia);
    form.setValue("cnae", data.cnae);
    form.setValue("crt", data.crt);
    form.setValue("regime_tributario", data.regime_tributario);
    form.setValue("endereco_logradouro", data.endereco_logradouro);
    form.setValue("endereco_nro", data.endereco_nro);
    form.setValue("endereco_compl", data.endereco_compl);
    form.setValue("endereco_bairro", data.endereco_bairro);
    form.setValue("endereco_cep", data.endereco_cep);
    form.setValue("endereco_uf", data.endereco_uf);
    form.setValue("endereco_cidade", data.endereco_cidade);
    form.setValue("endereco_cmun", data.endereco_cmun);
    if (data.telefone) form.setValue("telefone", data.telefone);
    if (data.email_fiscal) form.setValue("email_fiscal", data.email_fiscal);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const arquivo = await uploadFile.mutateAsync({ file });
      form.setValue("logo_file_id", arquivo.id);
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCertUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const companyCnpj = form.getValues("cnpj");

    if (!certSenha) {
      setCertError("Preencha a senha do certificado antes de enviar o arquivo.");
      toast.error("Preencha a senha do certificado antes de enviar o arquivo.");
      return;
    }

    setCertUploading(true);
    setCertError(null);

    try {
      // 1. Upload the file
      const arquivo = await uploadFile.mutateAsync({ file, sensivel: true });

      // 2. Validate certificate CNPJ against company CNPJ
      if (companyCnpj) {
        const { data: result, error } = await supabase.functions.invoke("validate-certificate", {
          body: { fileId: arquivo.id, password: certSenha, companyCnpj },
        });
        if (error) throw error;

        if (!result.valid) {
          // Certificate is invalid or CNPJ doesn't match — reject
          setCertError(result.error || "Certificado inválido.");
          toast.error(result.error || "Certificado inválido.");
          // Don't link the certificate
          return;
        }
        
        // Store expiry info
        setCertTestResult({ daysUntilExpiry: result.daysUntilExpiry });
        
        if (result.daysUntilExpiry !== undefined && result.daysUntilExpiry <= 30) {
          toast.warning(`Atenção: certificado expira em ${result.daysUntilExpiry} dias!`);
        } else {
          toast.success("Certificado válido e vinculado com sucesso!");
        }
      }
      
      // 3. Link certificate
      form.setValue("certificado_a1_file_id", arquivo.id);
      setCertFileName(file.name);
    } catch (err) {
      setCertError(err instanceof Error ? err.message : "Erro ao processar certificado.");
      toast.error("Erro ao processar certificado.");
    } finally {
      setCertUploading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Configuracoes da Empresa"
        description="Cadastro fiscal e configuracao para emissao de NF-e"
        icon={Building2}
        actions={
          <Button
            onClick={form.handleSubmit(onSubmit)}
            disabled={upsertCompany.isPending}
          >
            {upsertCompany.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        }
      />

      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Tabs defaultValue="geral" className="space-y-6">
          <TabsList>
            <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
            <TabsTrigger value="endereco">Endereco</TabsTrigger>
            <TabsTrigger value="nfe">NF-e</TabsTrigger>
          </TabsList>

          <TabsContent value="geral">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Identificacao</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Razao Social *</Label>
                    <Input {...form.register("razao_social")} placeholder="Razao Social" />
                  </div>
                  <div className="space-y-2">
                    <Label>Nome Fantasia</Label>
                    <Input {...form.register("nome_fantasia")} placeholder="Nome Fantasia" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>CNPJ * <span className="text-xs text-muted-foreground">(busca automática na Receita Federal)</span></Label>
                    <CNPJLookupInput
                      value={form.watch("cnpj") || ""}
                      onChange={(value) => form.setValue("cnpj", value)}
                      onDataFound={handleCNPJDataFound}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Inscricao Estadual</Label>
                    <Input {...form.register("ie")} placeholder="IE" />
                  </div>
                  <div className="space-y-2">
                    <Label>Inscricao Municipal</Label>
                    <Input {...form.register("im")} placeholder="IM" />
                  </div>
                  <div className="space-y-2">
                    <Label>CNAE</Label>
                    <Input {...form.register("cnae")} placeholder="CNAE" />
                  </div>
                  <div className="space-y-2">
                    <Label>CRT</Label>
                    <Select
                      value={form.watch("crt") || ""}
                      onValueChange={(v) => form.setValue("crt", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {CRT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Regime Tributario</Label>
                    <Input {...form.register("regime_tributario")} placeholder="Regime" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Contatos</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Email Financeiro</Label>
                    <Input {...form.register("email_financeiro")} type="email" placeholder="financeiro@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email Fiscal</Label>
                    <Input {...form.register("email_fiscal")} type="email" placeholder="fiscal@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <MaskedInput
                      mask="phone"
                      value={form.watch("telefone") || ""}
                      onChange={(value) => form.setValue("telefone", value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <Input {...form.register("site")} placeholder="https://empresa.com" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Arquivos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-2">
                    <Label>Logo da Empresa</Label>
                    {form.watch("logo_file_id") ? (
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-muted-foreground">✓ Logo vinculado</p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10"
                          onClick={() => form.setValue("logo_file_id", null)}
                        >
                          Excluir Logo
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={logoUploading}
                          onClick={() => document.getElementById("logo-upload-input")?.click()}
                        >
                          {logoUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                          Enviar Logo
                        </Button>
                        <input
                          id="logo-upload-input"
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <h4 className="text-sm font-medium mb-4">Certificado Digital A1</h4>
                    
                    {form.watch("certificado_a1_file_id") ? (
                      <div className="space-y-4">
                        {/* Certificado vinculado - mostrar info */}
                        <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                          <FileCheck className="h-5 w-5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{certFileName || "Certificado Digital A1"}</p>
                            <p className="text-xs text-muted-foreground">Certificado vinculado ✓</p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={() => {
                              form.setValue("certificado_a1_file_id", null);
                              setCertFileName(null);
                              setCertTestResult(null);
                            }}
                            title="Remover certificado"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Alerta de expiração */}
                        {certTestResult?.daysUntilExpiry !== undefined && certTestResult.daysUntilExpiry <= 30 && (
                          <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                            certTestResult.daysUntilExpiry < 0 
                              ? "bg-destructive/10 border-destructive/30 text-destructive" 
                              : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400"
                          }`}>
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <p className="text-sm font-medium">
                              {certTestResult.daysUntilExpiry < 0
                                ? `Certificado expirado há ${Math.abs(certTestResult.daysUntilExpiry)} dias!`
                                : `Certificado expira em ${certTestResult.daysUntilExpiry} dias — renove em breve!`
                              }
                            </p>
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Senha do Certificado</Label>
                            <Input
                              type="password"
                              placeholder="Atualizar senha"
                              value={certSenha}
                              onChange={(e) => setCertSenha(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">A senha não é salva — informe-a sempre que quiser testar o certificado nesta sessão</p>
                          </div>
                        </div>
                        
                        <div className="max-w-sm">
                          <CertificateTestButton
                            certificateFileId={form.watch("certificado_a1_file_id")}
                            certificatePassword={certSenha || undefined}
                            onTestResult={(result) => setCertTestResult({ daysUntilExpiry: result.daysUntilExpiry })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Sem certificado - mostrar upload */}
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Senha do Certificado *</Label>
                            <Input
                              type="password"
                              placeholder="Digite a senha antes de enviar"
                              value={certSenha}
                              onChange={(e) => setCertSenha(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">Obrigatória para validar o certificado</p>
                          </div>
                          <div className="space-y-2">
                            <Label>Arquivo do Certificado (PFX/P12)</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={certUploading}
                                onClick={() => document.getElementById("cert-upload-input")?.click()}
                              >
                                {certUploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
                                {certUploading ? "Validando..." : "Enviar Certificado"}
                              </Button>
                              <input
                                id="cert-upload-input"
                                type="file"
                                accept=".pfx,.p12"
                                onChange={handleCertUpload}
                                className="hidden"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Erro de validação do certificado */}
                        {certError && (
                          <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Certificado Rejeitado</AlertTitle>
                            <AlertDescription>{certError}</AlertDescription>
                          </Alert>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="endereco">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Endereco Fiscal</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Logradouro</Label>
                    <Input {...form.register("endereco_logradouro")} placeholder="Rua, Avenida..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Numero</Label>
                    <Input {...form.register("endereco_nro")} placeholder="Numero" />
                  </div>
                  <div className="space-y-2">
                    <Label>Complemento</Label>
                    <Input {...form.register("endereco_compl")} placeholder="Sala, Andar..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input {...form.register("endereco_bairro")} placeholder="Bairro" />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input {...form.register("endereco_cidade")} placeholder="Cidade" />
                  </div>
                  <div className="space-y-2">
                    <Label>UF</Label>
                    <Select
                      value={form.watch("endereco_uf") || ""}
                      onValueChange={(v) => form.setValue("endereco_uf", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UF_OPTIONS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>CEP</Label>
                    <MaskedInput
                      mask="cep"
                      value={form.watch("endereco_cep") || ""}
                      onChange={(value) => form.setValue("endereco_cep", value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Codigo Municipio (IBGE)</Label>
                    <Input {...form.register("endereco_cmun")} placeholder="cMun" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="nfe">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuracao NF-e</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Ambiente</Label>
                    <Select
                      value={form.watch("nfe_ambiente") || "HOMOLOGACAO"}
                      onValueChange={(v) => form.setValue("nfe_ambiente", v as AmbienteNFe)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="HOMOLOGACAO">Homologacao</SelectItem>
                        <SelectItem value="PRODUCAO">Producao</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Serie Padrao</Label>
                    <Input
                      type="number"
                      {...form.register("nfe_serie_padrao", { valueAsNumber: true })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Numero Inicial</Label>
                    <Input
                      type="number"
                      {...form.register("nfe_numero_inicial", { valueAsNumber: true })}
                      placeholder="1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Regime de Apuracao</Label>
                    <Input {...form.register("regime_apuracao")} placeholder="Regime" />
                  </div>
                  <div className="space-y-2">
                    <Label>CSC ID Token (NFC-e)</Label>
                    <Input {...form.register("csc_idtoken")} placeholder="ID Token" />
                  </div>
                  <div className="space-y-2">
                    <Label>CSC Token (NFC-e)</Label>
                    <Input {...form.register("csc_token")} placeholder="Token" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>
      </form>

      {company?.updated_at && (
        <p className="text-xs text-muted-foreground mt-6">
          Ultima atualizacao: {new Date(company.updated_at).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}
