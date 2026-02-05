import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useCreateEntidade, useUpdateEntidade, useUpsertEntidadePapeis, useCreateContato, useUpdateContato, useDeleteContato, useCreateEndereco, useUpdateEndereco, useDeleteEndereco } from "@/hooks/use-entidades";
import { useUpsertFiscalConfig, useUpsertFinanceiroConfig, useUpsertComercialCRM, useUpsertLogisticaConfig, useUploadDocumentoEntidade, useDeleteDocumentoEntidade, useAuditoriaEntidade } from "@/hooks/use-entidades-extended";
import { supabase } from "@/integrations/supabase/client";
import { IdentificacaoTab } from "./tabs/IdentificacaoTab";
import { FiscalTab } from "./tabs/FiscalTab";
import { EnderecosTab } from "./tabs/EnderecosTab";
import { ContatosTab } from "./tabs/ContatosTab";
import { ComercialCRMTab } from "./tabs/ComercialCRMTab";
import { FinanceiroTab } from "./tabs/FinanceiroTab";
import { LogisticaTab } from "./tabs/LogisticaTab";
import { DocumentosTab } from "./tabs/DocumentosTab";
import { AuditoriaTab } from "./tabs/AuditoriaTab";
import type { EntidadeCompleta, EntidadeContatoExtended, EntidadeEnderecoExtended } from "@/types/entidades";

interface EntidadeFormDialogCompleteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entidade?: EntidadeCompleta | null;
  initialPapel?: string;
  onSuccess?: () => void;
}

const defaultFormData = {
  tipo_pessoa: "PJ",
  documento: "",
  razao_social: "",
  nome_fantasia: "",
  status: "ATIVO",
  classificacao: "REGULAR",
  contribuinte_icms: "NAO_INFORMADO",
  site: "",
  observacoes: "",
  tags: [] as string[],
  papeis: [] as string[],
  ie: "",
  im: "",
  cnae: "",
  crt: "",
};

const defaultFiscalConfig = {
  natureza_operacao_padrao: "",
  cfop_padrao_entrada: "",
  cfop_padrao_saida: "",
  cst_icms_padrao: "",
  cst_pis_padrao: "",
  cst_cofins_padrao: "",
  observacao_fiscal_padrao: "",
  bloquear_sem_cpf_cnpj_valido: true,
  bloquear_sem_ie_quando_exigido: false,
};

const defaultFinanceiroConfig = {
  condicao_pagamento_padrao: "",
  forma_pagamento_padrao: "PIX",
  limite_credito: 0,
  bloquear_inadimplencia: false,
  dias_tolerancia: 0,
  categoria_financeira_padrao: "",
  centro_custo_padrao: "",
  email_nfe: "",
  email_boleto: "",
  importar_duplicatas_xml_gera_contas_pagar: true,
};

const defaultComercialCRM = {
  origem_lead: "ORGANICO",
  etapa_funil: "LEAD",
  score: 0,
  tabela_preco_padrao: "",
  canal_preferido: "WHATSAPP",
  desconto_maximo_percent: 0,
  comissao_padrao_percent: 0,
  observacoes_comerciais: "",
};

const defaultLogisticaConfig = {
  frete_padrao: "CIF",
  janela_recebimento: "",
  observacoes_entrega: "",
  transportadora_preferencial_entidade_id: "",
  prazo_medio_entrega_dias: null as number | null,
  pedido_minimo: null as number | null,
  lead_time_dias: null as number | null,
};

export function EntidadeFormDialogComplete({ open, onOpenChange, entidade, initialPapel, onSuccess }: EntidadeFormDialogCompleteProps) {
  const [activeTab, setActiveTab] = useState("identificacao");
  const [formData, setFormData] = useState(defaultFormData);
  const [fiscalConfig, setFiscalConfig] = useState(defaultFiscalConfig);
  const [financeiroConfig, setFinanceiroConfig] = useState(defaultFinanceiroConfig);
  const [comercialCRM, setComercialCRM] = useState(defaultComercialCRM);
  const [logisticaConfig, setLogisticaConfig] = useState(defaultLogisticaConfig);
  const [enderecos, setEnderecos] = useState<EntidadeEnderecoExtended[]>([]);
  const [contatos, setContatos] = useState<EntidadeContatoExtended[]>([]);
  const [documentos, setDocumentos] = useState<any[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const createEntidade = useCreateEntidade();
  const updateEntidade = useUpdateEntidade();
  const upsertPapeis = useUpsertEntidadePapeis();
  const createContato = useCreateContato();
  const updateContato = useUpdateContato();
  const deleteContato = useDeleteContato();
  const createEndereco = useCreateEndereco();
  const updateEndereco = useUpdateEndereco();
  const deleteEndereco = useDeleteEndereco();
  const upsertFiscal = useUpsertFiscalConfig();
  const upsertFinanceiro = useUpsertFinanceiroConfig();
  const upsertComercial = useUpsertComercialCRM();
  const upsertLogistica = useUpsertLogisticaConfig();
  const uploadDocumento = useUploadDocumentoEntidade();
  const deleteDocumento = useDeleteDocumentoEntidade();
  const { data: auditoria = [] } = useAuditoriaEntidade(entidade?.id);

  const isEditing = !!entidade;

  // Load data when editing
  useEffect(() => {
    if (entidade) {
      setFormData({
        tipo_pessoa: entidade.tipo_pessoa,
        documento: entidade.documento,
        razao_social: entidade.razao_social,
        nome_fantasia: entidade.nome_fantasia || "",
        status: entidade.status,
        classificacao: entidade.classificacao || "REGULAR",
        contribuinte_icms: entidade.contribuinte_icms || "NAO_INFORMADO",
        site: entidade.site || "",
        observacoes: entidade.observacoes || "",
        tags: (entidade.tags as string[]) || [],
        papeis: entidade.entidade_papeis?.map(p => p.papel) || [],
        ie: entidade.ie || "",
        im: entidade.im || "",
        cnae: entidade.cnae || "",
        crt: entidade.crt || "",
      });

      if (entidade.entidade_fiscal_config) {
        const fc = entidade.entidade_fiscal_config;
        setFiscalConfig({
          natureza_operacao_padrao: fc.natureza_operacao_padrao || "",
          cfop_padrao_entrada: fc.cfop_padrao_entrada || "",
          cfop_padrao_saida: fc.cfop_padrao_saida || "",
          cst_icms_padrao: fc.cst_icms_padrao || "",
          cst_pis_padrao: fc.cst_pis_padrao || "",
          cst_cofins_padrao: fc.cst_cofins_padrao || "",
          observacao_fiscal_padrao: fc.observacao_fiscal_padrao || "",
          bloquear_sem_cpf_cnpj_valido: fc.bloquear_sem_cpf_cnpj_valido,
          bloquear_sem_ie_quando_exigido: fc.bloquear_sem_ie_quando_exigido,
        });
      }

      if (entidade.entidade_financeiro_config) {
        const fn = entidade.entidade_financeiro_config;
        setFinanceiroConfig({
          condicao_pagamento_padrao: fn.condicao_pagamento_padrao || "",
          forma_pagamento_padrao: fn.forma_pagamento_padrao,
          limite_credito: fn.limite_credito,
          bloquear_inadimplencia: fn.bloquear_inadimplencia,
          dias_tolerancia: fn.dias_tolerancia,
          categoria_financeira_padrao: fn.categoria_financeira_padrao || "",
          centro_custo_padrao: fn.centro_custo_padrao || "",
          email_nfe: fn.email_nfe || "",
          email_boleto: fn.email_boleto || "",
          importar_duplicatas_xml_gera_contas_pagar: fn.importar_duplicatas_xml_gera_contas_pagar,
        });
      }

      if (entidade.entidade_comercial_crm) {
        const crm = entidade.entidade_comercial_crm;
        setComercialCRM({
          origem_lead: crm.origem_lead,
          etapa_funil: crm.etapa_funil,
          score: crm.score,
          tabela_preco_padrao: crm.tabela_preco_padrao || "",
          canal_preferido: crm.canal_preferido,
          desconto_maximo_percent: crm.desconto_maximo_percent,
          comissao_padrao_percent: crm.comissao_padrao_percent,
          observacoes_comerciais: crm.observacoes_comerciais || "",
        });
      }

      if (entidade.entidade_logistica_config) {
        const log = entidade.entidade_logistica_config;
        setLogisticaConfig({
          frete_padrao: log.frete_padrao,
          janela_recebimento: log.janela_recebimento || "",
          observacoes_entrega: log.observacoes_entrega || "",
          transportadora_preferencial_entidade_id: log.transportadora_preferencial_entidade_id || "",
          prazo_medio_entrega_dias: log.prazo_medio_entrega_dias,
          pedido_minimo: log.pedido_minimo,
          lead_time_dias: log.lead_time_dias,
        });
      }

      setEnderecos((entidade.entidade_enderecos as any) || []);
      setContatos((entidade.entidade_contatos as any) || []);
      setDocumentos(entidade.entidade_documentos || []);
    } else {
      // Reset form
      setFormData({
        ...defaultFormData,
        papeis: initialPapel ? [initialPapel] : [],
      });
      setFiscalConfig(defaultFiscalConfig);
      setFinanceiroConfig(defaultFinanceiroConfig);
      setComercialCRM(defaultComercialCRM);
      setLogisticaConfig(defaultLogisticaConfig);
      setEnderecos([]);
      setContatos([]);
      setDocumentos([]);
    }
    setActiveTab("identificacao");
  }, [entidade, initialPapel, open]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.documento.trim()) {
      newErrors.documento = "Documento é obrigatório";
    }
    if (!formData.razao_social.trim()) {
      newErrors.razao_social = "Razão Social é obrigatória";
    }
    if (formData.papeis.length === 0) {
      newErrors.papeis = "Selecione pelo menos um papel";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error("Corrija os erros antes de salvar");
      return;
    }

    setSaving(true);
    try {
      let entidadeId = entidade?.id;

      // Prepare entidade data
      const entidadeData = {
        tipo_pessoa: formData.tipo_pessoa as 'PJ' | 'PF',
        documento: formData.documento.replace(/\D/g, ""),
        razao_social: formData.razao_social,
        nome_fantasia: formData.nome_fantasia || null,
        status: formData.status as 'ATIVO' | 'BLOQUEADO' | 'HOMOLOGACAO',
        classificacao: formData.classificacao as any,
        contribuinte_icms: formData.contribuinte_icms,
        site: formData.site || null,
        observacoes: formData.observacoes || null,
        tags: formData.tags,
        ie: formData.ie || null,
        im: formData.im || null,
        cnae: formData.cnae || null,
        crt: formData.crt || null,
      };

      if (isEditing) {
        await updateEntidade.mutateAsync({ id: entidadeId!, data: entidadeData as any });
      } else {
        const result = await createEntidade.mutateAsync({ ...entidadeData as any, papeis: formData.papeis });
        entidadeId = result.id;
      }

      // Update papeis if editing
      if (isEditing && entidadeId) {
        await upsertPapeis.mutateAsync({ entidade_id: entidadeId, papeis: formData.papeis });
      }

      // Upsert configs
      if (entidadeId) {
        await Promise.all([
          upsertFiscal.mutateAsync({ entidade_id: entidadeId, ...fiscalConfig } as any),
          upsertFinanceiro.mutateAsync({ entidade_id: entidadeId, ...financeiroConfig } as any),
          upsertComercial.mutateAsync({ entidade_id: entidadeId, ...comercialCRM } as any),
          upsertLogistica.mutateAsync({ entidade_id: entidadeId, ...logisticaConfig } as any),
        ]);
      }

      toast.success(isEditing ? "Entidade atualizada" : "Entidade criada");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  // Handlers for enderecos
  const handleAddEndereco = async (endereco: any) => {
    if (entidade?.id) {
      await createEndereco.mutateAsync({ ...endereco, entidade_id: entidade.id });
    } else {
      setEnderecos([...enderecos, { ...endereco, id: crypto.randomUUID(), entidade_id: '', created_at: new Date().toISOString() }]);
    }
  };

  const handleUpdateEndereco = async (id: string, data: any) => {
    if (entidade?.id) {
      await updateEndereco.mutateAsync({ id, entidade_id: entidade.id, data });
    } else {
      setEnderecos(enderecos.map(e => e.id === id ? { ...e, ...data } : e));
    }
  };

  const handleDeleteEndereco = async (id: string) => {
    if (entidade?.id) {
      await deleteEndereco.mutateAsync({ id, entidade_id: entidade.id });
    } else {
      setEnderecos(enderecos.filter(e => e.id !== id));
    }
  };

  // Handlers for contatos
  const handleAddContato = async (contato: any) => {
    if (entidade?.id) {
      await createContato.mutateAsync({ ...contato, entidade_id: entidade.id });
    } else {
      setContatos([...contatos, { ...contato, id: crypto.randomUUID(), entidade_id: '', created_at: new Date().toISOString() }]);
    }
  };

  const handleUpdateContato = async (id: string, data: any) => {
    if (entidade?.id) {
      await updateContato.mutateAsync({ id, entidade_id: entidade.id, data });
    } else {
      setContatos(contatos.map(c => c.id === id ? { ...c, ...data } : c));
    }
  };

  const handleDeleteContato = async (id: string) => {
    if (entidade?.id) {
      await deleteContato.mutateAsync({ id, entidade_id: entidade.id });
    } else {
      setContatos(contatos.filter(c => c.id !== id));
    }
  };

  // Document handlers
  const handleUploadDoc = async (file: File, tipo: string, observacoes?: string) => {
    if (entidade?.id) {
      await uploadDocumento.mutateAsync({ entidade_id: entidade.id, file, tipo, observacoes });
    } else {
      toast.error("Salve a entidade antes de enviar documentos");
    }
  };

  const handleDeleteDoc = async (id: string, storageKey: string) => {
    if (entidade?.id) {
      await deleteDocumento.mutateAsync({ id, entidade_id: entidade.id, storage_key: storageKey });
    }
  };

  const handleDownloadDoc = async (storageKey: string, fileName: string) => {
    const { data } = await supabase.storage.from('erp-files').download(storageKey);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getTitle = () => {
    if (isEditing) return `Editar: ${entidade?.razao_social}`;
    if (initialPapel === "FORNECEDOR") return "Novo Fornecedor";
    if (initialPapel === "CLIENTE") return "Novo Cliente";
    if (initialPapel === "TRANSPORTADORA") return "Nova Transportadora";
    return "Nova Entidade";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-9 w-full">
            <TabsTrigger value="identificacao" className="text-xs">Identificação</TabsTrigger>
            <TabsTrigger value="fiscal" className="text-xs">Fiscal</TabsTrigger>
            <TabsTrigger value="enderecos" className="text-xs">Endereços</TabsTrigger>
            <TabsTrigger value="contatos" className="text-xs">Contatos</TabsTrigger>
            <TabsTrigger value="comercial" className="text-xs">CRM</TabsTrigger>
            <TabsTrigger value="financeiro" className="text-xs">Financeiro</TabsTrigger>
            <TabsTrigger value="logistica" className="text-xs">Logística</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs">Documentos</TabsTrigger>
            <TabsTrigger value="auditoria" className="text-xs">Auditoria</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            <TabsContent value="identificacao" className="mt-0">
              <IdentificacaoTab
                data={formData}
                onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
                errors={errors}
              />
            </TabsContent>

            <TabsContent value="fiscal" className="mt-0">
              <FiscalTab
                data={{ ie: formData.ie, im: formData.im, cnae: formData.cnae, crt: formData.crt }}
                fiscalConfig={fiscalConfig}
                onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
                onFiscalConfigChange={(field, value) => setFiscalConfig(prev => ({ ...prev, [field]: value }))}
              />
            </TabsContent>

            <TabsContent value="enderecos" className="mt-0">
              <EnderecosTab
                enderecos={entidade?.entidade_enderecos as any || enderecos}
                onAdd={handleAddEndereco}
                onUpdate={handleUpdateEndereco}
                onDelete={handleDeleteEndereco}
              />
            </TabsContent>

            <TabsContent value="contatos" className="mt-0">
              <ContatosTab
                contatos={entidade?.entidade_contatos as any || contatos}
                onAdd={handleAddContato}
                onUpdate={handleUpdateContato}
                onDelete={handleDeleteContato}
              />
            </TabsContent>

            <TabsContent value="comercial" className="mt-0">
              <ComercialCRMTab
                data={comercialCRM}
                onChange={(field, value) => setComercialCRM(prev => ({ ...prev, [field]: value }))}
              />
            </TabsContent>

            <TabsContent value="financeiro" className="mt-0">
              <FinanceiroTab
                data={financeiroConfig}
                onChange={(field, value) => setFinanceiroConfig(prev => ({ ...prev, [field]: value }))}
              />
            </TabsContent>

            <TabsContent value="logistica" className="mt-0">
              <LogisticaTab
                data={logisticaConfig}
                onChange={(field, value) => setLogisticaConfig(prev => ({ ...prev, [field]: value }))}
              />
            </TabsContent>

            <TabsContent value="documentos" className="mt-0">
              <DocumentosTab
                documentos={entidade?.entidade_documentos || documentos}
                onUpload={handleUploadDoc}
                onDelete={handleDeleteDoc}
                onDownload={handleDownloadDoc}
              />
            </TabsContent>

            <TabsContent value="auditoria" className="mt-0">
              <AuditoriaTab eventos={auditoria as any} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
