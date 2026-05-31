import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Save, Upload, Search, Loader2, FileCheck, X, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail } from "lucide-react";
import { useLocalCompany, useUpsertLocalCompany, LocalCompany } from "@/hooks/use-local-company";
import { useCompany, useUpsertCompany } from "@/hooks/use-company";
import { CNPJLookupInput } from "@/components/company/CNPJLookupInput";
import { CertificateTestButton } from "@/components/company/CertificateTestButton";
import { MaskedInput } from "@/components/ui/masked-input";
import { useUploadFile } from "@/hooks/use-files";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
  "SP", "SE", "TO"
];

export default function EmpresaSettingsPage() {
  const navigate = useNavigate();
  const { data: company, isLoading, refresh } = useLocalCompany();
  const { data: supabaseCompany } = useCompany();
  const upsertCompanyMutation = useUpsertCompany();
  const { upsert } = useUpsertLocalCompany();
  const [formData, setFormData] = useState<Partial<LocalCompany>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [certificadoNome, setCertificadoNome] = useState<string | null>(null);
  const [certificadoFileId, setCertificadoFileId] = useState<string | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certDaysUntilExpiry, setCertDaysUntilExpiry] = useState<number | null>(null);
  const [certAutoValidated, setCertAutoValidated] = useState(false);
  const [certLastTestResult, setCertLastTestResult] = useState<{
    valid?: boolean;
    subject?: string;
    issuer?: string;
    validFrom?: string;
    validTo?: string;
    daysUntilExpiry?: number;
    certCnpj?: string;
  } | null>(null);
  const uploadFile = useUploadFile();

  useEffect(() => {
    const localHasData = company && company.cnpj && company.cnpj.trim().length > 0;

    if (localHasData) {
      setFormData(company);
      if (company.logo_data) {
        setLogoPreview(company.logo_data);
      }
      if (company.certificado_nome) {
        setCertificadoNome(company.certificado_nome);
      }
    } else if (supabaseCompany && supabaseCompany.cnpj) {
      // Fallback: populate from database when localStorage is empty/blank (e.g. different device)
      const dbData: Partial<LocalCompany> = {
        razao_social: supabaseCompany.razao_social || '',
        nome_fantasia: supabaseCompany.nome_fantasia || '',
        cnpj: supabaseCompany.cnpj || '',
        ie: supabaseCompany.ie || '',
        im: supabaseCompany.im || '',
        cnae: supabaseCompany.cnae || '',
        crt: supabaseCompany.crt || '',
        regime_tributario: supabaseCompany.regime_tributario || '',
        endereco_logradouro: supabaseCompany.endereco_logradouro || '',
        endereco_nro: supabaseCompany.endereco_nro || '',
        endereco_compl: supabaseCompany.endereco_compl || '',
        endereco_bairro: supabaseCompany.endereco_bairro || '',
        endereco_cidade: supabaseCompany.endereco_cidade || '',
        endereco_uf: supabaseCompany.endereco_uf || '',
        endereco_cep: supabaseCompany.endereco_cep || '',
        telefone: supabaseCompany.telefone || '',
        email_fiscal: supabaseCompany.email_fiscal || '',
        email_financeiro: supabaseCompany.email_financeiro || '',
        site: supabaseCompany.site || '',
        nfe_ambiente: (supabaseCompany.nfe_ambiente as 'HOMOLOGACAO' | 'PRODUCAO') || undefined,
        nfe_serie_padrao: supabaseCompany.nfe_serie_padrao || undefined,
        nfe_numero_inicial: supabaseCompany.nfe_numero_inicial || undefined,
        csc_idtoken: supabaseCompany.csc_idtoken || '',
        csc_token: supabaseCompany.csc_token || '',
      };
      setFormData(dbData);
      // Also persist to localStorage for future use on this device
      upsert(dbData);
      refresh();
    }
  }, [company, supabaseCompany]);

  // Load logo from Supabase storage when logo_file_id exists but no local preview
  useEffect(() => {
    if (logoPreview || !supabaseCompany?.logo_file_id) return;
    const loadLogoFromStorage = async () => {
      try {
        const { data: arquivo } = await supabase
          .from("arquivos")
          .select("storage_key")
          .eq("id", supabaseCompany.logo_file_id!)
          .maybeSingle();
        if (arquivo?.storage_key) {
          const { data } = await supabase.storage
            .from("erp-files")
            .createSignedUrl(arquivo.storage_key, 3600);
          if (data?.signedUrl) {
            setLogoPreview(data.signedUrl);
          }
        }
      } catch {
        // Silent fail
      }
    };
    loadLogoFromStorage();
  }, [supabaseCompany?.logo_file_id, logoPreview]);

  // Load certificate file ID and name from Supabase company
  useEffect(() => {
    if (supabaseCompany?.certificado_a1_file_id) {
      setCertificadoFileId(supabaseCompany.certificado_a1_file_id);
      // Fetch the original file name from arquivos table
      const fetchCertName = async () => {
        const { data } = await supabase
          .from("arquivos")
          .select("nome_original")
          .eq("id", supabaseCompany.certificado_a1_file_id!)
          .single();
        if (data?.nome_original) {
          setCertificadoNome(data.nome_original);
        }
      };
      fetchCertName();
    }
  }, [supabaseCompany]);

  // Auto-validate certificate on page load when cert + password exist
  useEffect(() => {
    if (certAutoValidated || !certificadoFileId || !formData.certificado_senha) return;
    
    const autoValidate = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        
        const response = await fetch(`${supabaseUrl}/functions/v1/validate-certificate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({
            fileId: certificadoFileId,
            password: formData.certificado_senha,
            companyCnpj: formData.cnpj,
          }),
        });
        
        const result = await response.json();
        setCertAutoValidated(true);
        
        if (result.valid) {
          setCertLastTestResult(result);
          if (result.daysUntilExpiry !== undefined) {
            setCertDaysUntilExpiry(result.daysUntilExpiry);
          }
        }
      } catch {
        // Silent fail on auto-validate
      }
    };
    
    autoValidate();
  }, [certificadoFileId, formData.certificado_senha, certAutoValidated, formData.cnpj]);

  const handleSave = () => {
    if (!formData.razao_social || !formData.cnpj) {
      toast.error("Preencha pelo menos Razão Social e CNPJ para salvar no sistema");
      return;
    }

    upsert(formData);
    upsertCompanyMutation.mutate(
      {
        razao_social: formData.razao_social || '',
        cnpj: formData.cnpj?.replace(/\D/g, '') || '',
        nome_fantasia: formData.nome_fantasia,
        cnae: formData.cnae,
        crt: formData.crt,
        regime_tributario: formData.regime_tributario,
        ie: formData.ie,
        im: formData.im,
        endereco_logradouro: formData.endereco_logradouro,
        endereco_nro: formData.endereco_nro,
        endereco_compl: formData.endereco_compl,
        endereco_bairro: formData.endereco_bairro,
        endereco_cep: formData.endereco_cep,
        endereco_uf: formData.endereco_uf,
        endereco_cidade: formData.endereco_cidade,
        telefone: formData.telefone,
        email_fiscal: formData.email_fiscal,
        email_financeiro: formData.email_financeiro,
        site: formData.site,
        certificado_a1_file_id: certificadoFileId,
      },
      {
        onSuccess: () => {
          navigate("/");
        },
        onError: (err: any) => {
          toast.error(err?.message || "Erro ao salvar configurações da empresa");
        },
      }
    );
    refresh();
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
    ie?: string;
  }) => {
    setFormData(prev => ({
      ...prev,
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      cnae: data.cnae,
      crt: data.crt,
      regime_tributario: data.regime_tributario,
      endereco_logradouro: data.endereco_logradouro,
      endereco_nro: data.endereco_nro,
      endereco_compl: data.endereco_compl,
      endereco_bairro: data.endereco_bairro,
      endereco_cep: data.endereco_cep,
      endereco_uf: data.endereco_uf,
      endereco_cidade: data.endereco_cidade,
      telefone: data.telefone || prev?.telefone,
      email_fiscal: data.email_fiscal || prev?.email_fiscal,
      ie: data.ie || prev?.ie,
    }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setFormData(prev => ({
        ...prev,
        logo_nome: file.name,
        logo_tipo: file.type,
        logo_data: base64,
      }));
    };
    reader.readAsDataURL(file);

    // Also upload to Supabase for use in reports/contracts
    try {
      const arquivo = await uploadFile.mutateAsync({ file, sensivel: false });
      if (supabaseCompany?.id) {
        upsertCompanyMutation.mutate({ logo_file_id: arquivo.id });
      }
    } catch {
      // Local logo still works, Supabase upload is best-effort
    }
  };

  const handleCertificadoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCertUploading(true);
    setCertificadoNome(file.name);
    setFormData({
      ...formData,
      certificado_nome: file.name,
      certificado_tipo: file.type,
    });

    try {
      const arquivo = await uploadFile.mutateAsync({ file, sensivel: true });
      setCertificadoFileId(arquivo.id);
      // Also save to Supabase company
      if (supabaseCompany?.id) {
        upsertCompanyMutation.mutate({ certificado_a1_file_id: arquivo.id });
      }
      toast.success("Certificado enviado com sucesso!");
    } catch (err) {
      toast.error("Erro ao enviar certificado para validação");
      setCertificadoFileId(null);
    } finally {
      setCertUploading(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div className="w-full max-w-full overflow-x-hidden">
      <PageHeader
        title="Empresa"
        description="Configuracoes da empresa e dados fiscais"
        icon={Building2}
        actions={
          <Button onClick={handleSave} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        }
      />

      <div className="space-y-6 mt-6 w-full min-w-0" onKeyDown={(e) => {
        // Enter = Tab for all input fields on this page
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault();
          const allInputs = Array.from(document.querySelectorAll<HTMLElement>(
            'input:not([disabled]):not([type="hidden"]):not([type="file"]), textarea:not([disabled])'
          ));
          const idx = allInputs.indexOf(e.target as HTMLElement);
          if (idx >= 0 && idx < allInputs.length - 1) {
            setTimeout(() => allInputs[idx + 1]?.focus(), 50);
          }
        }
      }}>
        {/* Dados Gerais */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="razao_social">Razao Social *</Label>
                <Input
                  id="razao_social"
                  value={formData.razao_social || ""}
                  onChange={(e) => setFormData({ ...formData, razao_social: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                <Input
                  id="nome_fantasia"
                  value={formData.nome_fantasia || ""}
                  onChange={(e) => setFormData({ ...formData, nome_fantasia: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ * <span className="text-xs text-muted-foreground">(busca automática)</span></Label>
                <CNPJLookupInput
                  value={formData.cnpj || ""}
                  onChange={(value) => setFormData({ ...formData, cnpj: value })}
                  onDataFound={handleCNPJDataFound}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ie">Inscrição Estadual</Label>
                <MaskedInput
                  id="ie"
                  mask="ie"
                  maxLength={20}
                  value={formData.ie || ""}
                  onChange={(value) => setFormData({ ...formData, ie: value })}
                  placeholder="Ex: 123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="im">Inscrição Municipal</Label>
                <MaskedInput
                  id="im"
                  mask="im"
                  maxLength={20}
                  value={formData.im || ""}
                  onChange={(value) => setFormData({ ...formData, im: value })}
                  placeholder="Ex: 123456"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnae">CNAE</Label>
                <Input
                  id="cnae"
                  value={formData.cnae || ""}
                  onChange={(e) => setFormData({ ...formData, cnae: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="crt">CRT</Label>
                <Select 
                  value={formData.crt || ""} 
                  onValueChange={(v) => setFormData({ ...formData, crt: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 - Simples Nacional</SelectItem>
                    <SelectItem value="2">2 - Simples Nacional Excesso</SelectItem>
                    <SelectItem value="3">3 - Regime Normal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Regime Tributario</Label>
                <Select 
                  value={formData.regime_tributario || ""} 
                  onValueChange={(v) => setFormData({ ...formData, regime_tributario: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SIMPLES">Simples Nacional</SelectItem>
                    <SelectItem value="LUCRO_PRESUMIDO">Lucro Presumido</SelectItem>
                    <SelectItem value="LUCRO_REAL">Lucro Real</SelectItem>
                    <SelectItem value="OUTRO">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                {logoPreview && (
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    className="h-16 w-auto max-w-[180px] object-contain border rounded"
                  />
                )}
                <Label htmlFor="logo-upload" className="cursor-pointer w-full sm:w-auto">
                  <div className="border-2 border-dashed rounded-lg px-6 py-3 text-center hover:border-primary transition-colors">
                    <Upload className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Upload Logo</p>
                  </div>
                </Label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereco */}
        <Card>
          <CardHeader>
            <CardTitle>Endereco Fiscal</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-3 space-y-2">
                <Label>Logradouro</Label>
                <Input
                  value={formData.endereco_logradouro || ""}
                  onChange={(e) => setFormData({ ...formData, endereco_logradouro: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Numero</Label>
                <Input
                  value={formData.endereco_nro || ""}
                  onChange={(e) => setFormData({ ...formData, endereco_nro: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Complemento</Label>
                <Input
                  value={formData.endereco_compl || ""}
                  onChange={(e) => setFormData({ ...formData, endereco_compl: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={formData.endereco_bairro || ""}
                  onChange={(e) => setFormData({ ...formData, endereco_bairro: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <MaskedInput
                  mask="cep"
                  value={formData.endereco_cep || ""}
                  onChange={(value) => setFormData({ ...formData, endereco_cep: value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.endereco_cidade || ""}
                  onChange={(e) => setFormData({ ...formData, endereco_cidade: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>UF</Label>
                <Select 
                  value={formData.endereco_uf || ""} 
                  onValueChange={(v) => setFormData({ ...formData, endereco_uf: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <MaskedInput
                  mask="phone"
                  value={formData.telefone || ""}
                  onChange={(value) => setFormData({ ...formData, telefone: value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Site</Label>
                <Input
                  value={formData.site || ""}
                  onChange={(e) => setFormData({ ...formData, site: e.target.value })}
                  placeholder="https://"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email Fiscal</Label>
                <Input
                  type="email"
                  value={formData.email_fiscal || ""}
                  onChange={(e) => setFormData({ ...formData, email_fiscal: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Financeiro</Label>
                <Input
                  type="email"
                  value={formData.email_financeiro || ""}
                  onChange={(e) => setFormData({ ...formData, email_financeiro: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Certificado Digital */}
        <Card>
          <CardHeader>
            <CardTitle>Certificado Digital A1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {certificadoFileId ? (
              /* Certificado vinculado — mostrar nome e opção de remover */
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                  <FileCheck className="h-5 w-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{certificadoNome || "Certificado Digital A1"}</p>
                    <p className="text-xs text-muted-foreground">Certificado vinculado ✓</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0"
                    onClick={() => {
                      setCertificadoFileId(null);
                      setCertificadoNome(null);
                      setCertDaysUntilExpiry(null);
                      setFormData(prev => ({ ...prev, certificado_nome: undefined, certificado_tipo: undefined }));
                      // Also clear from Supabase company
                      if (supabaseCompany?.id) {
                        upsertCompanyMutation.mutate({ certificado_a1_file_id: null });
                      }
                      toast.success("Certificado removido");
                    }}
                    title="Remover certificado"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* Alerta de expiração */}
                {certDaysUntilExpiry !== null && certDaysUntilExpiry <= 30 && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg border ${
                    certDaysUntilExpiry < 0
                      ? "bg-destructive/10 border-destructive/30 text-destructive"
                      : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-400"
                  }`}>
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <p className="text-sm font-medium">
                      {certDaysUntilExpiry < 0
                        ? `Certificado expirado há ${Math.abs(certDaysUntilExpiry)} dias!`
                        : `Certificado expira em ${certDaysUntilExpiry} dias — renove em breve!`
                      }
                    </p>
                  </div>
                )}

                {/* Info persistente do certificado (auto-validação) */}
                {certLastTestResult?.valid && (
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-1.5 text-sm">
                    <p><strong>Titular:</strong> {certLastTestResult.subject}</p>
                    <p><strong>Emitido por:</strong> {certLastTestResult.issuer}</p>
                    <p><strong>Válido de:</strong> {certLastTestResult.validFrom} <strong>até</strong> {certLastTestResult.validTo}</p>
                    {certLastTestResult.certCnpj && (
                      <p><strong>CNPJ do Certificado:</strong> {certLastTestResult.certCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}</p>
                    )}
                    {certDaysUntilExpiry !== null && certDaysUntilExpiry > 30 && (
                      <div className="flex items-center gap-2 font-medium mt-2 p-2 rounded-md bg-muted/50 text-primary">
                        <span>✓ {certDaysUntilExpiry} dias até expirar</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Senha do Certificado</Label>
                    <Input
                      type="password"
                      value={formData.certificado_senha || ""}
                      onChange={(e) => setFormData({ ...formData, certificado_senha: e.target.value })}
                      placeholder="********"
                    />
                  </div>
                </div>

                {/* Certificate Test Button */}
                <div className="max-w-sm">
                  <CertificateTestButton
                    certificateFileId={certificadoFileId}
                    certificatePassword={formData.certificado_senha}
                    companyCnpj={formData.cnpj}
                    onTestResult={(result) => {
                      if (result?.daysUntilExpiry !== undefined) {
                        setCertDaysUntilExpiry(result.daysUntilExpiry);
                      }
                      if (result?.valid) {
                        setCertLastTestResult(result);
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              /* Sem certificado — mostrar upload */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Senha do Certificado *</Label>
                  <Input
                    type="password"
                    value={formData.certificado_senha || ""}
                    onChange={(e) => setFormData({ ...formData, certificado_senha: e.target.value })}
                    placeholder="Informe a senha antes de enviar"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Certificado (PFX/P12)</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    {certUploading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    <Label htmlFor="cert-upload" className="cursor-pointer w-full sm:w-auto">
                      <div className="border-2 border-dashed rounded-lg px-4 py-2 text-center hover:border-primary transition-colors">
                        <Upload className="h-4 w-4 mx-auto text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Upload PFX/P12</p>
                      </div>
                    </Label>
                    <input
                      id="cert-upload"
                      type="file"
                      accept=".pfx,.p12"
                      className="hidden"
                      onChange={handleCertificadoUpload}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuracoes NF-e */}
        <Card>
          <CardHeader>
            <CardTitle>Configuracoes NF-e</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Ambiente</Label>
                <Select 
                  value={formData.nfe_ambiente || "HOMOLOGACAO"} 
                  onValueChange={(v) => setFormData({ ...formData, nfe_ambiente: v as any })}
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
                  value={formData.nfe_serie_padrao || 1}
                  onChange={(e) => setFormData({ ...formData, nfe_serie_padrao: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Numero Inicial</Label>
                <Input
                  type="number"
                  value={formData.nfe_numero_inicial || 1}
                  onChange={(e) => setFormData({ ...formData, nfe_numero_inicial: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>CSC ID Token (NFC-e)</Label>
                <Input
                  value={formData.csc_idtoken || ""}
                  onChange={(e) => setFormData({ ...formData, csc_idtoken: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CSC Token (NFC-e)</Label>
                <Input
                  type="password"
                  value={formData.csc_token || ""}
                  onChange={(e) => setFormData({ ...formData, csc_token: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
