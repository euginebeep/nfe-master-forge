import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Save, Loader2, Upload } from "lucide-react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useCompany, useUpsertCompany } from "@/hooks/use-company";
import { useUploadFile } from "@/hooks/use-files";
import { CNPJLookupInput } from "@/components/company/CNPJLookupInput";
import { CertificateTestButton } from "@/components/company/CertificateTestButton";
import { MaskedInput } from "@/components/ui/masked-input";
import type { Company, AmbienteNFe } from "@/types/erp";

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

  const form = useForm<Partial<Company>>({
    values: company || undefined,
  });

  const onSubmit = async (data: Partial<Company>) => {
    await upsertCompany.mutateAsync(data);
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
    setCertUploading(true);
    try {
      const arquivo = await uploadFile.mutateAsync({ file, sensivel: true });
      form.setValue("certificado_a1_file_id", arquivo.id);
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
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Arquivo do Certificado (PFX/P12)</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="file"
                            accept=".pfx,.p12"
                            onChange={handleCertUpload}
                            disabled={certUploading}
                            className="file:mr-2 file:px-4 file:py-1 file:rounded file:border-0 file:bg-primary/10 file:text-primary file:font-medium"
                          />
                          {certUploading && <Loader2 className="h-4 w-4 animate-spin" />}
                        </div>
                        {form.watch("certificado_a1_file_id") && (
                          <p className="text-xs text-muted-foreground">Certificado vinculado ✓</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Senha do Certificado</Label>
                        <Input
                          type="password"
                          placeholder="Atualizar senha"
                          onChange={(e) => form.setValue("certificado_senha_encrypted", e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Deixe em branco para manter a senha atual</p>
                      </div>
                    </div>
                    
                    <div className="mt-4 max-w-sm">
                      <CertificateTestButton
                        certificateFileId={form.watch("certificado_a1_file_id")}
                        certificatePassword={form.watch("certificado_senha_encrypted") || undefined}
                      />
                    </div>
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
