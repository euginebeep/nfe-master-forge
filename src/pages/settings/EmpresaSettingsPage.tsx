import { useState, useEffect } from "react";
import { Building2, Save, Upload } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useLocalCompany, useUpsertLocalCompany, LocalCompany } from "@/hooks/use-local-company";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
  "SP", "SE", "TO"
];

export default function EmpresaSettingsPage() {
  const { data: company, isLoading, refresh } = useLocalCompany();
  const { upsert } = useUpsertLocalCompany();
  const [formData, setFormData] = useState<Partial<LocalCompany>>({});
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [certificadoNome, setCertificadoNome] = useState<string | null>(null);

  useEffect(() => {
    if (company) {
      setFormData(company);
      if (company.logo_data) {
        setLogoPreview(company.logo_data);
      }
      if (company.certificado_nome) {
        setCertificadoNome(company.certificado_nome);
      }
    }
  }, [company]);

  const handleSave = () => {
    upsert(formData);
    refresh();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setFormData({
        ...formData,
        logo_nome: file.name,
        logo_tipo: file.type,
        logo_data: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleCertificadoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCertificadoNome(file.name);
    setFormData({
      ...formData,
      certificado_nome: file.name,
      certificado_tipo: file.type,
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Empresa"
        description="Configuracoes da empresa e dados fiscais"
        icon={Building2}
        actions={
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        }
      />

      <div className="space-y-6 mt-6">
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
                <Label htmlFor="cnpj">CNPJ *</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj || ""}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ie">Inscricao Estadual</Label>
                <Input
                  id="ie"
                  value={formData.ie || ""}
                  onChange={(e) => setFormData({ ...formData, ie: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="im">Inscricao Municipal</Label>
                <Input
                  id="im"
                  value={formData.im || ""}
                  onChange={(e) => setFormData({ ...formData, im: e.target.value })}
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
              <div className="flex items-center gap-4">
                {logoPreview && (
                  <img 
                    src={logoPreview} 
                    alt="Logo" 
                    className="h-16 w-auto object-contain border rounded"
                  />
                )}
                <Label htmlFor="logo-upload" className="cursor-pointer">
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
                <Input
                  value={formData.endereco_cep || ""}
                  onChange={(e) => setFormData({ ...formData, endereco_cep: e.target.value })}
                  placeholder="00000-000"
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
                <Input
                  value={formData.telefone || ""}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Certificado (PFX/P12)</Label>
                <div className="flex items-center gap-4">
                  {certificadoNome && (
                    <span className="text-sm text-muted-foreground">{certificadoNome}</span>
                  )}
                  <Label htmlFor="cert-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed rounded-lg px-4 py-2 text-center hover:border-primary transition-colors">
                      <Upload className="h-4 w-4 mx-auto text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">Upload</p>
                    </div>
                  </Label>
                  <input
                    id="cert-upload"
                    type="file"
                    accept=".pfx,.p12,.pdf"
                    className="hidden"
                    onChange={handleCertificadoUpload}
                  />
                </div>
              </div>
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
