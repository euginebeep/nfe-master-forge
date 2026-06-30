import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
import { registrarAuditoria } from "@/lib/audit-logger";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", 
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", 
  "SP", "SE", "TO"
];

export default function EmpresaSettingsPage() {
  const queryClient = useQueryClient();
  const { data: company, isLoading, refresh } = useLocalCompany();
  const { data: supabaseCompany } = useCompany();
  const upsertCompanyMutation = useUpsertCompany();
  const [logoIsLoading, setLogoIsLoading] = useState(false);
  const [isRemovingLogo, setIsRemovingLogo] = useState(false);
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
    const localHasData = company && company.cnpj && company.cnpj.trim().length > 0 && !company.is_demo;

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
        endereco_cmun: supabaseCompany.endereco_cmun || '',
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
      // We explicitly DO NOT call upsert(dbData, false) here anymore to prevent
      // local data from overriding or flickering before Supabase data is ready.
      // The logo effect handles its own state correctly.
    }
  }, [company, supabaseCompany]);

  // Carregar Opt-out status
  useEffect(() => {
    if (supabaseCompany?.id) {
       const fetchOptout = async () => {
          const { data } = await supabase.from('brainx_optout').select('company_id').eq('company_id', supabaseCompany.id).maybeSingle();
          setFormData(prev => ({ ...prev, optout_parceiros: !!data }));
       };
       fetchOptout();
    }
  }, [supabaseCompany?.id]);

  // Load logo from Supabase storage when logo_file_id exists
  useEffect(() => {
    let isMounted = true;
    
    // Explicitly hide logo if database hasn't provided an ID yet
    // This prevents showing stale/demo logos from localStorage
    if (!supabaseCompany?.logo_file_id) {
      if (!logoPreview?.startsWith('data:') && !logoIsLoading) {
        setLogoPreview(null);
      }
      return;
    }

    setLogoIsLoading(true);
    const loadLogoFromStorage = async () => {
      try {
        const { data: arquivo, error: dbError } = await supabase
          .from("arquivos")
          .select("storage_key")
          .eq("id", supabaseCompany.logo_file_id!)
          .maybeSingle();
        
        if (dbError || !arquivo?.storage_key) {
          if (dbError) {
            await registrarAuditoria({
              tipo: 'ACAO_UI',
              descricao: 'Erro ao buscar storage_key do logo',
              entidade_tipo: 'company',
              entidade_id: supabaseCompany.id,
              dados_evento: { error: dbError.message }
            });
          }
          if (isMounted) setLogoPreview(null);
          return;
        }

        const { data, error: storageError } = await supabase.storage
          .from("erp-files")
          .createSignedUrl(arquivo.storage_key, 3600);
          
        if (storageError || !data?.signedUrl) {
          await registrarAuditoria({
            tipo: 'ACAO_UI',
            descricao: 'Erro ao gerar signed URL para o logo',
            entidade_tipo: 'company',
            entidade_id: supabaseCompany.id,
            dados_evento: { error: storageError?.message || 'URL não gerada' }
          });
          if (isMounted) setLogoPreview(null);
          return;
        }

        if (isMounted) {
          // Adiciona timestamp para cache busting
          const urlWithVersion = `${data.signedUrl}${data.signedUrl.includes('?') ? '&' : '?'}v=${new Date().getTime()}`;
          setLogoPreview(urlWithVersion);
        }
      } catch (err) {
        console.error("Erro fatal ao carregar logo:", err);
      } finally {
        if (isMounted) setLogoIsLoading(false);
      }
    };
    loadLogoFromStorage();
    return () => { isMounted = false; };
  }, [supabaseCompany?.logo_file_id]);

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

  // Auto-validate certificate on page load when cert + password exist.
  // Usa cache em sessionStorage (6h) pra não decriptar o .p12 e reenviar a
  // senha do certificado toda vez que essa página é aberta — só revalida de
  // verdade se o cache expirou ou não existe. Validação manual via botão
  // "Testar Certificado" sempre força uma checagem nova, sem usar o cache.
  useEffect(() => {
    if (certAutoValidated || !certificadoFileId || !formData.certificado_senha) return;

    const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
    const cacheKey = `cert_validation_${certificadoFileId}`;

    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
          setCertAutoValidated(true);
          if (parsed.result?.valid) {
            setCertLastTestResult(parsed.result);
            if (parsed.result.daysUntilExpiry !== undefined) {
              setCertDaysUntilExpiry(parsed.result.daysUntilExpiry);
            }
          }
          return;
        }
      } catch {
        // cache corrompido, ignora e revalida
      }
    }

    const autoValidate = async () => {
      try {
        const { data: result, error } = await supabase.functions.invoke("validate-certificate", {
          body: {
            fileId: certificadoFileId,
            password: formData.certificado_senha,
            companyCnpj: formData.cnpj,
          },
        });
        if (error) return;

        setCertAutoValidated(true);
        sessionStorage.setItem(cacheKey, JSON.stringify({ result, cachedAt: Date.now() }));

        if (result?.valid) {
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

  const handleSave = async () => {
    if (!formData.razao_social || !formData.cnpj) {
      toast.error("Preencha pelo menos Razão Social e CNPJ para salvar no sistema");
      return;
    }

    // Persist local data silently without showing a redundant toast
    upsert(formData, false);

    try {
      await upsertCompanyMutation.mutateAsync({
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
        endereco_cmun: formData.endereco_cmun,
        telefone: formData.telefone,
        email_fiscal: formData.email_fiscal,
        email_financeiro: formData.email_financeiro,
        site: formData.site,
        certificado_a1_file_id: certificadoFileId,
      });
      // Só atualiza o estado local DEPOIS que o Supabase confirmou o save —
      // antes disso rodava em paralelo (fire-and-forget) e podia recarregar
      // dado desatualizado se o save demorasse mais que o refresh.
      refresh();
      // Continua na própria tela de configurações — esta página não faz parte
      // do fluxo de onboarding (que é uma rota separada, /onboarding), então
      // não há motivo para redirecionar o usuário pra fora dela ao salvar.
    } catch (err) {
      // O toast de erro já é exibido pelo onError do hook useUpsertCompany —
      // evita mostrar a mesma mensagem duas vezes.
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
      endereco_cmun: data.endereco_cmun,
      telefone: data.telefone || prev?.telefone,
      email_fiscal: data.email_fiscal || prev?.email_fiscal,
      ie: data.ie || prev?.ie,
    }));
  };

  // Padrão de logo do ERP. IMPORTANTE: como toda a exibição usa height fixa +
  // width:auto + object-fit:contain, uma logo quadrada/redonda (1:1) ou mesmo
  // vertical NÃO quebra layout nenhum — só ocupa uma largura menor dentro do
  // mesmo espaço, o que é visualmente normal. O único caso que realmente
  // quebra é uma logo excessivamente larga (banner), que estoura o
  // max-width:110px do cabeçalho do laudo (exportLaudoA4.ts) a 36px de altura.
  const LOGO_RATIO_MAX = 4; // acima disso, vira aviso (não bloqueia)
  const LOGO_MIN_WIDTH = 200;
  const LOGO_MIN_HEIGHT = 200;

  function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Não foi possível ler a imagem"));
      };
      img.src = url;
    });
  }

  // Detecta se a imagem tem algum pixel transparente de verdade — cobre o caso comum
  // de PNG exportado sem canal alpha (fundo sólido), que o `file.type` sozinho não pega.
  function hasTransparentPixel(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          const SAMPLE = 64; // reduz pra checagem rápida, não precisa da imagem inteira
          const canvas = document.createElement("canvas");
          canvas.width = SAMPLE;
          canvas.height = SAMPLE;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(true); // não bloqueia por falha de canvas
          ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
          const { data } = ctx.getImageData(0, 0, SAMPLE, SAMPLE);
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 255) return resolve(true);
          }
          resolve(false);
        } catch {
          resolve(true); // CORS ou outro erro de canvas: não bloqueia, assume ok
        }
      };
      img.onerror = () => resolve(true);
      img.src = url;
    });
  }

  // Formatos realmente aceitos pelo bucket erp-files no Storage (ver migration
  // 20260205144652, allowed_mime_types do bucket). SVG e WEBP NÃO estão na
  // lista — se permitíssemos no frontend, o Storage rejeitaria o upload e o
  // usuário só veria um "Erro ao enviar logo" genérico sem entender o motivo.
  // SVG também tem suporte incerto nos geradores de PDF deste projeto
  // (pdf-lib não embute SVG sem rasterizar antes), por isso não vale a pena
  // liberar no bucket — mais simples manter PNG/JPEG só.
  const LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg"];

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato não suportado", {
        description: "Use PNG ou JPEG. Outros formatos (SVG, WEBP, GIF, BMP) não são aceitos.",
      });
      e.target.value = "";
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande", { description: "Máximo 2MB." });
      e.target.value = "";
      return;
    }

    try {
      const { width, height } = await getImageDimensions(file);
      const ratio = width / height;

      if (width < LOGO_MIN_WIDTH || height < LOGO_MIN_HEIGHT) {
        toast.error("Imagem com resolução muito baixa", {
          description: `Mínimo ${LOGO_MIN_WIDTH}×${LOGO_MIN_HEIGHT}px para não ficar borrada nos relatórios.`,
        });
        e.target.value = "";
        return;
      }

      // Logos redondas, quadradas ou verticais são bem-vindas — o sistema centraliza
      // e ajusta automaticamente em todos os documentos. Só avisamos (sem bloquear)
      // quando a logo é um banner extremamente largo, caso raro que pode ficar
      // espremido no cabeçalho do laudo.
      if (ratio > LOGO_RATIO_MAX) {
        toast.warning("Logo bem larga — pode ficar pequena no cabeçalho do laudo", {
          description: "Funciona, mas uma versão mais próxima de 1:1 ou 2:1 fica mais nítida nos relatórios.",
        });
      }

      if (file.type === "image/jpeg") {
        toast.warning("JPG não suporta fundo transparente", {
          description: "Em relatórios com fundo branco isso pode aparecer como uma caixa colorida. PNG transparente é o ideal.",
        });
      } else {
        const transparent = await hasTransparentPixel(file);
        if (!transparent) {
          toast.warning("Esse arquivo não tem fundo transparente", {
            description: "É um PNG com fundo sólido. Em relatórios com fundo branco isso vai aparecer como uma caixa colorida atrás da logo.",
          });
        }
      }
    } catch {
      // Se não conseguir medir, segue o fluxo normal (não bloqueia o usuário por isso)
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles').select('company_id').eq('id', user?.id).single();
      if (!profile?.company_id) throw new Error('Empresa não identificada');

      const ext = file.name.split('.').pop();
      const path = `${profile.company_id}/logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('erp-files')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: arquivo, error: arquivoError } = await supabase
        .from('arquivos')
        .insert({
          company_id: profile.company_id,
          nome_original: file.name,
          mime_type: file.type,
          tamanho: file.size,
          storage_key: path,
        })
        .select('id')
        .single();
      if (arquivoError) throw arquivoError;

      const { error: updateCompanyError } = await supabase.from('company')
        .update({ logo_file_id: arquivo.id })
        .eq('id', profile.company_id);
      if (updateCompanyError) throw updateCompanyError;

      // Sem isso, o resto do app (sidebar, outras telas que usam useCompany)
      // só veria o novo logo depois de um F5 — a query ficaria com cache antigo.
      queryClient.invalidateQueries({ queryKey: ["company"] });

      // Mesmo método usado no carregamento (useEffect) — o bucket erp-files é
      // privado, então getPublicUrl geraria um link que não funciona.
      const { data: signedData } = await supabase.storage
        .from('erp-files')
        .createSignedUrl(path, 3600);
      if (signedData?.signedUrl) {
        setLogoPreview(`${signedData.signedUrl}&v=${Date.now()}`);
      }
      toast.success("Logo atualizado com sucesso");
    } catch (err: any) {
      toast.error("Erro ao enviar logo", { description: err?.message ?? "Tente novamente." });
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
      {/* Conteúdo de Parceiros - Opt-out */}
      <Card className="mb-6 border-primary/20">
        <CardHeader>
          <CardTitle className="text-sm font-bold uppercase tracking-wider">Conteúdo de Parceiros BrainX</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
             <div className="space-y-1">
                <p className="text-sm">Exibir recomendações e conteúdo de parceiros verificados no seu dashboard.</p>
                <p className="text-xs text-muted-foreground">Isso ajuda a descobrir soluções de insumos, equipamentos e consultoria para o setor industrial.</p>
             </div>
             <Switch 
               checked={!formData.optout_parceiros}
               onCheckedChange={async (checked) => {
                 const optout = !checked;
                 setFormData(prev => ({ ...prev, optout_parceiros: optout }));
                 
                 const cid = supabaseCompany?.id;
                 if (!cid) return;

                 if (optout) {
                    await supabase.from('brainx_optout').insert({ company_id: cid, motivo: 'Opt-out do usuário' });
                 } else {
                    await supabase.from('brainx_optout').delete().eq('company_id', cid);
                 }
                 toast.success(optout ? "Preferência salva: conteúdo de parceiros desativado." : "Preferência salva: conteúdo de parceiros ativado.");
               }}
             />
          </div>
        </CardContent>
      </Card>

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

            <div className="space-y-2">
              <Label>Logo da Empresa</Label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 min-h-[80px]">
                {logoIsLoading ? (
                  <div className="h-20 w-32 bg-muted animate-pulse rounded border flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : logoPreview ? (
                  <div className="relative group">
                    <img 
                      src={logoPreview} 
                      alt="Logo" 
                      className="h-20 w-auto max-w-[200px] object-contain border rounded p-1 bg-white"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://placehold.co/200x80?text=Logo+Indisponível';
                        console.error("Logo falhou ao carregar");
                      }}
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      disabled={isRemovingLogo}
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={async () => {
                        if (isRemovingLogo) return;
                        setIsRemovingLogo(true);
                        const loadingToast = toast.loading("Removendo logo...");
                        try {
                          // Se houver um ID de arquivo no banco, deveríamos deletar o registro/storage
                          // No momento, o ERP usa uma tabela 'arquivos' e storage 'erp-files'
                          if (supabaseCompany?.logo_file_id) {
                            const { data: arquivo } = await supabase
                              .from("arquivos")
                              .select("storage_key")
                              .eq("id", supabaseCompany.logo_file_id)
                              .maybeSingle();

                            if (arquivo?.storage_key) {
                              await supabase.storage
                                .from("erp-files")
                                .remove([arquivo.storage_key]);
                            }

                            // Remove a referência na tabela company
                            await upsertCompanyMutation.mutateAsync({ logo_file_id: null });
                          }

                          setLogoPreview(null);
                          setFormData(prev => ({
                            ...prev,
                            logo_nome: undefined,
                            logo_tipo: undefined,
                            logo_data: undefined,
                          }));

                          toast.success("Logo removido com sucesso");
                        } catch (err) {
                          toast.error("Erro ao remover logo. Tente novamente.");
                        } finally {
                          toast.dismiss(loadingToast);
                          setIsRemovingLogo(false);
                        }
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Label htmlFor="logo-upload" className="cursor-pointer w-full sm:w-auto">
                      <div className="border-2 border-dashed rounded-lg px-6 py-4 text-center hover:border-primary hover:bg-primary/5 transition-all">
                        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">Upload Logo</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          PNG ou JPEG · qualquer formato (redonda, quadrada ou horizontal) · PNG transparente é o ideal · mín. 200×200px · máx. 2MB
                        </p>
                      </div>
                    </Label>
                    <input
                      id="logo-upload"
                      type="file"
                      accept="image/png,image/jpeg"
                      className="hidden"
                      onChange={handleLogoUpload}
                    />
                  </>
                )}
              </div>

              {logoPreview && !logoIsLoading && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    Prévia de como a logo aparece nos documentos (qualquer formato é centralizado automaticamente):
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1">
                      <div className="border rounded bg-white px-3 flex items-center" style={{ height: 56 }}>
                        <img
                          src={logoPreview}
                          alt="Prévia — Laudo"
                          style={{ height: 36, width: "auto", maxWidth: 110, objectFit: "contain" }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">Cabeçalho do Laudo</p>
                    </div>
                    <div className="space-y-1">
                      <div className="border rounded bg-white px-3 flex items-center" style={{ height: 72 }}>
                        <img
                          src={logoPreview}
                          alt="Prévia — Contrato"
                          style={{ maxHeight: 60, width: "auto", objectFit: "contain" }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground text-center">Contrato / Relatório</p>
                    </div>
                  </div>
                </div>
              )}
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

        <SmtpSettingsCard />
      </div>
    </div>
  );
}

function SmtpSettingsCard() {
  const { data: company } = useCompany();
  const upsertCompany = useUpsertCompany();
  const [smtp, setSmtp] = useState({
    smtp_host: "",
    smtp_port: 465,
    smtp_secure: true,
    smtp_user: "",
    smtp_from_name: "",
    smtp_from_email: "",
  });
  // Password is write-only: NEVER returned by the API. We only know whether
  // it is set (smtp_pass_set flag) and accept a new value to overwrite it.
  const [newPassword, setNewPassword] = useState("");
  const passwordIsSet = !!(company as any)?.smtp_pass_set;
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<
    { ok: boolean; code: string; message: string } | null
  >(null);

  useEffect(() => {
    if (company) {
      setSmtp({
        smtp_host: (company as any).smtp_host || "",
        smtp_port: (company as any).smtp_port || 465,
        smtp_secure: (company as any).smtp_secure ?? true,
        smtp_user: (company as any).smtp_user || "",
        smtp_from_name: (company as any).smtp_from_name || "",
        smtp_from_email: (company as any).smtp_from_email || "",
      });
      setNewPassword("");
    }
  }, [company]);

  const handleSave = async () => {
    if (!smtp.smtp_host || !smtp.smtp_user) {
      toast.error("Preencha servidor e usuário.");
      return;
    }
    if (!passwordIsSet && !newPassword) {
      toast.error("Informe a senha do SMTP.");
      return;
    }
    // 1. Save non-sensitive settings via normal upsert
    await upsertCompany.mutateAsync(smtp as any);
    // 2. If user typed a new password, encrypt + store via RPC (write-only)
    if (newPassword) {
      const { error: rpcErr } = await supabase.rpc(
        "set_company_smtp_password" as any,
        { p_password: newPassword },
      );
      if (rpcErr) {
        toast.error("Falha ao salvar senha do SMTP.");
        return;
      }
      setNewPassword("");
      toast.success("Senha do SMTP salva com segurança (criptografada).");
    }
    if (company?.id) {
      registrarAuditoria({
        tipo: 'SMTP_CONFIGURADO',
        descricao: `Configurações de SMTP atualizadas (${smtp.smtp_host}:${smtp.smtp_port})`,
        entidade_tipo: 'company',
        entidade_id: company.id,
        entidade_codigo: company.razao_social || undefined,
        dados_evento: {
          tenant_id: company.id,
          timestamp: new Date().toISOString(),
          smtp_host: smtp.smtp_host,
          smtp_port: smtp.smtp_port,
          smtp_secure: smtp.smtp_secure,
          smtp_user: smtp.smtp_user,
          smtp_from_email: smtp.smtp_from_email || null,
          smtp_from_name: smtp.smtp_from_name || null,
          senha_alterada: !!newPassword,
        },
      });
    }
  };

  const handleTest = async () => {
    if (!smtp.smtp_host || !smtp.smtp_user) {
      toast.error("Preencha servidor e usuário antes de testar.");
      return;
    }
    if (!passwordIsSet && !newPassword) {
      toast.error("Informe e salve a senha do SMTP antes de testar.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const dest = smtp.smtp_from_email || smtp.smtp_user;
      const { data, error } = await supabase.functions.invoke("verify-tenant-smtp", {
        body: {
          // Use unsaved overrides so user can test before saving
          smtp_host: smtp.smtp_host,
          smtp_port: smtp.smtp_port,
          smtp_secure: smtp.smtp_secure,
          smtp_user: smtp.smtp_user,
          smtp_pass: newPassword || undefined, // omit → backend uses stored encrypted password
          send_test: true,
          test_to: dest,
          from_name: smtp.smtp_from_name,
          from_email: smtp.smtp_from_email,
        },
      });
      if (error) throw new Error(error.message || "Falha de comunicação");
      const result = data as { ok: boolean; code: string; message: string };
      setTestResult(result);
      if (!result.ok) throw new Error(result.message || "Falha");
      toast.success(result.message);
      if (company?.id) {
        registrarAuditoria({
          tipo: 'SMTP_TESTE_ENVIADO',
          descricao: `E-mail de teste de SMTP enviado para ${dest}`,
          entidade_tipo: 'company',
          entidade_id: company.id,
          entidade_codigo: company.razao_social || undefined,
          dados_evento: {
            tenant_id: company.id,
            timestamp: new Date().toISOString(),
            destinatario: dest,
            smtp_host: smtp.smtp_host,
            smtp_user: smtp.smtp_user,
            resultado: 'SUCESSO',
            codigo: result.code,
          },
        });
      }
    } catch (err: any) {
      const msg = String(err?.message || err || "Falha desconhecida");
      toast.error("Falha no teste: " + msg);
      if (!testResult) {
        setTestResult({ ok: false, code: "ERROR", message: msg });
      }
      if (company?.id) {
        registrarAuditoria({
          tipo: 'SMTP_TESTE_ENVIADO',
          descricao: `Falha ao enviar e-mail de teste de SMTP`,
          entidade_tipo: 'company',
          entidade_id: company.id,
          entidade_codigo: company.razao_social || undefined,
          dados_evento: {
            tenant_id: company.id,
            timestamp: new Date().toISOString(),
            smtp_host: smtp.smtp_host,
            smtp_user: smtp.smtp_user,
            resultado: 'FALHA',
            erro: msg,
          },
        });
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          SMTP - Servidor de Envio de E-mails
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription className="text-sm">
            Este SMTP é usado para enviar <b>contratos, orçamentos, NF-e e cobranças</b> em nome
            da sua empresa. E-mails do sistema (recuperação de senha, cadastro no SaaS) são
            enviados separadamente pela plataforma.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label>Servidor SMTP *</Label>
            <Input
              placeholder="smtp.hostinger.com"
              value={smtp.smtp_host}
              onChange={(e) => setSmtp({ ...smtp, smtp_host: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Porta *</Label>
            <Input
              type="number"
              value={smtp.smtp_port}
              onChange={(e) => setSmtp({ ...smtp, smtp_port: parseInt(e.target.value) || 465 })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={smtp.smtp_secure}
            onCheckedChange={(v) => setSmtp({ ...smtp, smtp_secure: v })}
          />
          <Label className="!mt-0">Usar SSL/TLS (recomendado para porta 465)</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Usuário / E-mail de login *</Label>
            <Input
              type="email"
              placeholder="contato@suaempresa.com.br"
              value={smtp.smtp_user}
              onChange={(e) => setSmtp({ ...smtp, smtp_user: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Senha *</Label>
            <Input
              type="password"
              placeholder={passwordIsSet ? "••••••••  (senha já configurada — preencha para alterar)" : "Senha do servidor SMTP"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              {passwordIsSet
                ? "🔒 Senha armazenada criptografada. Deixe em branco para manter a atual."
                : "🔒 A senha é criptografada antes de ser salva e nunca é retornada pelo sistema."}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do remetente</Label>
            <Input
              placeholder="Sua Empresa LTDA"
              value={smtp.smtp_from_name}
              onChange={(e) => setSmtp({ ...smtp, smtp_from_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>E-mail "De" (opcional)</Label>
            <Input
              type="email"
              placeholder="(usa o e-mail de login se vazio)"
              value={smtp.smtp_from_email}
              onChange={(e) => setSmtp({ ...smtp, smtp_from_email: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={upsertCompany.isPending}>
            <Save className="h-4 w-4 mr-2" />
            Salvar SMTP
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Enviar e-mail de teste
          </Button>
        </div>

        {testResult && (
          <Alert variant={testResult.ok ? "default" : "destructive"}>
            <AlertDescription className="text-sm">
              <b>[{testResult.code}]</b> {testResult.message}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
