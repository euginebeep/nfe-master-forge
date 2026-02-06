import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { 
  Building2, ArrowRight, ArrowLeft, Check, AlertTriangle, 
  MapPin, Users, FileText, DollarSign, Plus, Trash2, Globe
} from "lucide-react";
import { useCreateEntidade, LocalEntidade } from "@/hooks/use-local-entidades";
import { CNPJLookupInput } from "@/components/company/CNPJLookupInput";
import { MaskedInput } from "@/components/ui/masked-input";
import { 
  TipoPessoa, ContribuinteICMS, Departamento, TipoEnderecoExtended, FormaPagamento,
  TIPO_PESSOA_LABELS, DEPARTAMENTO_LABELS, TIPO_ENDERECO_LABELS, FORMA_PAGAMENTO_LABELS,
  isEstrangeiro
} from "@/types/entidades";

interface EntidadeWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialPapel?: string;
  onSuccess?: () => void;
}

// ====================================================
// CONSTANTES
// ====================================================
const PAPEIS = [
  { value: "FORNECEDOR", label: "Fornecedor" },
  { value: "CLIENTE", label: "Cliente" },
  { value: "TRANSPORTADORA", label: "Transportadora" },
  { value: "TERCEIRIZADO", label: "Terceirizado" },
  { value: "VENDEDOR", label: "Vendedor" },
  { value: "AFILIADO", label: "Afiliado" },
  { value: "REPRESENTANTE", label: "Representante" },
  { value: "OUTRO", label: "Outro" },
];

const CLASSIFICACOES = [
  { value: "VIP", label: "VIP" },
  { value: "REGULAR", label: "Regular" },
  { value: "RISCO", label: "Risco" },
  { value: "RESTRITO", label: "Restrito" },
];

const STATUS_OPTIONS = [
  { value: "ATIVO", label: "Ativo" },
  { value: "INATIVO", label: "Inativo" },
  { value: "BLOQUEADO", label: "Bloqueado" },
];

const CONTRIBUINTE_ICMS_OPTIONS = [
  { value: "SIM", label: "Sim - Contribuinte" },
  { value: "NAO", label: "Não - Não Contribuinte" },
  { value: "ISENTO", label: "Isento" },
  { value: "NAO_INFORMADO", label: "Não Informado" },
];

const CONDICOES_PAGAMENTO = [
  { value: "A_VISTA", label: "À Vista" },
  { value: "7_DIAS", label: "7 dias" },
  { value: "14_DIAS", label: "14 dias" },
  { value: "21_DIAS", label: "21 dias" },
  { value: "28_DIAS", label: "28 dias" },
  { value: "30_DIAS", label: "30 dias" },
  { value: "30_60_90", label: "30/60/90 dias" },
];

interface EnderecoForm {
  tipo: TipoEnderecoExtended;
  cep: string;
  logradouro: string;
  nro: string;
  compl: string;
  bairro: string;
  cidade: string;
  uf: string;
  pais: string;
  principal: boolean;
}

interface ContatoForm {
  nome: string;
  departamento: Departamento;
  cargo: string;
  telefone: string;
  whatsapp: string;
  email: string;
  preferencial: boolean;
}

// ====================================================
// ETAPAS DO WIZARD
// ====================================================
const WIZARD_STEPS = [
  { id: 1, title: "Identificação", icon: Building2, description: "Dados básicos da entidade" },
  { id: 2, title: "Endereços", icon: MapPin, description: "Endereços fiscais e de entrega" },
  { id: 3, title: "Contatos", icon: Users, description: "Contatos da entidade" },
  { id: 4, title: "Fiscal", icon: FileText, description: "Configurações fiscais" },
  { id: 5, title: "Financeiro", icon: DollarSign, description: "Configurações financeiras" },
  { id: 6, title: "Revisão", icon: Check, description: "Confirmar e salvar" },
];

export function EntidadeWizardDialog({ open, onOpenChange, initialPapel, onSuccess }: EntidadeWizardDialogProps) {
  const { create } = useCreateEntidade();
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Identificação
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("PJ");
  const [documento, setDocumento] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [ie, setIe] = useState("");
  const [im, setIm] = useState("");
  const [cnae, setCnae] = useState("");
  const [crt, setCrt] = useState("");
  const [contribuinteIcms, setContribuinteIcms] = useState<ContribuinteICMS>("NAO_INFORMADO");
  const [status, setStatus] = useState("ATIVO");
  const [classificacao, setClassificacao] = useState("REGULAR");
  const [selectedPapeis, setSelectedPapeis] = useState<string[]>(initialPapel ? [initialPapel] : []);
  const [site, setSite] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [pais, setPais] = useState("Brasil");
  
  // Step 2: Endereços
  const [enderecos, setEnderecos] = useState<EnderecoForm[]>([{
    tipo: "FISCAL",
    cep: "",
    logradouro: "",
    nro: "",
    compl: "",
    bairro: "",
    cidade: "",
    uf: "",
    pais: "Brasil",
    principal: true,
  }]);
  
  // Step 3: Contatos
  const [contatos, setContatos] = useState<ContatoForm[]>([{
    nome: "",
    departamento: "OUTRO",
    cargo: "",
    telefone: "",
    whatsapp: "",
    email: "",
    preferencial: true,
  }]);
  
  // Step 4: Fiscal
  const [naturezaOperacaoPadrao, setNaturezaOperacaoPadrao] = useState("");
  const [cfopEntrada, setCfopEntrada] = useState("");
  const [cfopSaida, setCfopSaida] = useState("");
  const [cstIcmsPadrao, setCstIcmsPadrao] = useState("");
  const [cstPisPadrao, setCstPisPadrao] = useState("");
  const [cstCofinsPadrao, setCstCofinsPadrao] = useState("");
  const [observacaoFiscal, setObservacaoFiscal] = useState("");
  const [bloquearSemDoc, setBloquearSemDoc] = useState(true);
  const [bloquearSemIe, setBloquearSemIe] = useState(false);
  
  // Step 5: Financeiro
  const [condicaoPagamento, setCondicaoPagamento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("PIX");
  const [limiteCredito, setLimiteCredito] = useState<number>(0);
  const [bloquearInadimplencia, setBloquearInadimplencia] = useState(false);
  const [diasTolerancia, setDiasTolerancia] = useState(0);
  const [emailNfe, setEmailNfe] = useState("");
  const [emailBoleto, setEmailBoleto] = useState("");
  const [gerarContasPagar, setGerarContasPagar] = useState(true);

  const isForeign = isEstrangeiro(tipoPessoa);

  const handleCNPJData = (data: {
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
    if (data) {
      setRazaoSocial(data.razao_social || "");
      setNomeFantasia(data.nome_fantasia || "");
      setCnae(data.cnae || "");
      setCrt(data.crt || "");
      
      const newEndereco: EnderecoForm = {
        tipo: "FISCAL",
        cep: data.endereco_cep || "",
        logradouro: data.endereco_logradouro || "",
        nro: data.endereco_nro || "",
        compl: data.endereco_compl || "",
        bairro: data.endereco_bairro || "",
        cidade: data.endereco_cidade || "",
        uf: data.endereco_uf || "",
        pais: "Brasil",
        principal: true,
      };
      setEnderecos([newEndereco]);
      
      if (data.telefone) {
        setContatos([{
          ...contatos[0],
          telefone: data.telefone,
        }]);
      }
    }
  };

  const togglePapel = (papel: string) => {
    setSelectedPapeis(prev => 
      prev.includes(papel) 
        ? prev.filter(p => p !== papel)
        : [...prev, papel]
    );
  };

  const addEndereco = () => {
    setEnderecos([...enderecos, {
      tipo: "ENTREGA",
      cep: "",
      logradouro: "",
      nro: "",
      compl: "",
      bairro: "",
      cidade: "",
      uf: "",
      pais: "Brasil",
      principal: false,
    }]);
  };

  const removeEndereco = (index: number) => {
    if (enderecos.length > 1) {
      setEnderecos(enderecos.filter((_, i) => i !== index));
    }
  };

  const updateEndereco = (index: number, field: keyof EnderecoForm, value: any) => {
    const updated = [...enderecos];
    updated[index] = { ...updated[index], [field]: value };
    setEnderecos(updated);
  };

  const addContato = () => {
    setContatos([...contatos, {
      nome: "",
      departamento: "OUTRO",
      cargo: "",
      telefone: "",
      whatsapp: "",
      email: "",
      preferencial: false,
    }]);
  };

  const removeContato = (index: number) => {
    if (contatos.length > 1) {
      setContatos(contatos.filter((_, i) => i !== index));
    }
  };

  const updateContato = (index: number, field: keyof ContatoForm, value: any) => {
    const updated = [...contatos];
    updated[index] = { ...updated[index], [field]: value };
    setContatos(updated);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return documento.trim() && razaoSocial.trim() && selectedPapeis.length > 0;
      case 2:
        return enderecos.some(e => e.logradouro.trim() || isForeign);
      case 3:
        return contatos.some(c => c.nome.trim());
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < 6 && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    const entidade = create({
      tipo_pessoa: tipoPessoa,
      documento,
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia || undefined,
      ie: isForeign ? undefined : ie,
      im: isForeign ? undefined : im,
      cnae: isForeign ? undefined : cnae,
      crt: isForeign ? undefined : crt,
      contribuinte_icms: contribuinteIcms,
      status: status as any,
      classificacao: classificacao as any,
      papeis: selectedPapeis,
      site: site || undefined,
      observacoes: observacoes || undefined,
      pais: isForeign ? pais : undefined,
      tags: [],
      // Store additional data for later processing
      _enderecos: enderecos,
      _contatos: contatos,
      _fiscal: {
        natureza_operacao_padrao: naturezaOperacaoPadrao,
        cfop_padrao_entrada: cfopEntrada,
        cfop_padrao_saida: cfopSaida,
        cst_icms_padrao: cstIcmsPadrao,
        cst_pis_padrao: cstPisPadrao,
        cst_cofins_padrao: cstCofinsPadrao,
        observacao_fiscal_padrao: observacaoFiscal,
        bloquear_sem_cpf_cnpj_valido: bloquearSemDoc,
        bloquear_sem_ie_quando_exigido: bloquearSemIe,
      },
      _financeiro: {
        condicao_pagamento_padrao: condicaoPagamento,
        forma_pagamento_padrao: formaPagamento,
        limite_credito: limiteCredito,
        bloquear_inadimplencia: bloquearInadimplencia,
        dias_tolerancia: diasTolerancia,
        email_nfe: emailNfe,
        email_boleto: emailBoleto,
        importar_duplicatas_xml_gera_contas_pagar: gerarContasPagar,
      },
    } as any);

    if (entidade) {
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setTipoPessoa("PJ");
    setDocumento("");
    setRazaoSocial("");
    setNomeFantasia("");
    setIe("");
    setIm("");
    setCnae("");
    setCrt("");
    setContribuinteIcms("NAO_INFORMADO");
    setStatus("ATIVO");
    setClassificacao("REGULAR");
    setSelectedPapeis(initialPapel ? [initialPapel] : []);
    setSite("");
    setObservacoes("");
    setPais("Brasil");
    setEnderecos([{
      tipo: "FISCAL",
      cep: "",
      logradouro: "",
      nro: "",
      compl: "",
      bairro: "",
      cidade: "",
      uf: "",
      pais: "Brasil",
      principal: true,
    }]);
    setContatos([{
      nome: "",
      departamento: "OUTRO",
      cargo: "",
      telefone: "",
      whatsapp: "",
      email: "",
      preferencial: true,
    }]);
    setNaturezaOperacaoPadrao("");
    setCfopEntrada("");
    setCfopSaida("");
    setCstIcmsPadrao("");
    setCstPisPadrao("");
    setCstCofinsPadrao("");
    setObservacaoFiscal("");
    setBloquearSemDoc(true);
    setBloquearSemIe(false);
    setCondicaoPagamento("");
    setFormaPagamento("PIX");
    setLimiteCredito(0);
    setBloquearInadimplencia(false);
    setDiasTolerancia(0);
    setEmailNfe("");
    setEmailBoleto("");
    setGerarContasPagar(true);
  };

  const progressPercent = (currentStep / 6) * 100;

  const enderecoFiscal = enderecos.find(e => e.tipo === "FISCAL");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {initialPapel === "FORNECEDOR" && "Novo Fornecedor"}
            {initialPapel === "CLIENTE" && "Novo Cliente"}
            {initialPapel === "TRANSPORTADORA" && "Nova Transportadora"}
            {!initialPapel && "Nova Entidade"}
          </DialogTitle>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Etapa {currentStep} de 6</span>
            <span className="text-muted-foreground">{WIZARD_STEPS[currentStep - 1].title}</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          {/* Step Indicators */}
          <div className="flex justify-between mt-4">
            {WIZARD_STEPS.map((step) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isCompleted = currentStep > step.id;
              
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                    isActive ? 'text-primary' : isCompleted ? 'text-primary/60' : 'text-muted-foreground'
                  }`}
                  onClick={() => {
                    if (isCompleted || step.id === currentStep) {
                      setCurrentStep(step.id);
                    }
                  }}
                >
                  <div className={`p-2 rounded-full ${
                    isActive ? 'bg-primary text-primary-foreground' : 
                    isCompleted ? 'bg-primary/20' : 'bg-muted'
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs hidden md:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-4" />

        {/* Step Content */}
        <div className="min-h-[400px]">
          {/* Step 1: Identificação */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Dados Básicos</CardTitle>
                  <CardDescription>Identificação da entidade</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Tipo Pessoa */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo Pessoa *</Label>
                      <Select value={tipoPessoa} onValueChange={(v) => setTipoPessoa(v as TipoPessoa)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
                          <SelectItem value="PF">Pessoa Física</SelectItem>
                          <SelectItem value="ESTRANGEIRO">Estrangeiro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {isForeign && (
                      <div className="space-y-2">
                        <Label>País *</Label>
                        <Input 
                          value={pais} 
                          onChange={(e) => setPais(e.target.value)}
                          placeholder="Ex: Estados Unidos"
                        />
                      </div>
                    )}
                  </div>

                  {/* Documento */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{tipoPessoa === "PJ" ? "CNPJ *" : tipoPessoa === "PF" ? "CPF *" : "Documento *"}</Label>
                      {tipoPessoa === "PJ" && !isForeign ? (
                        <CNPJLookupInput
                          value={documento}
                          onChange={setDocumento}
                          onDataFound={handleCNPJData}
                        />
                      ) : (
                        <Input
                          value={documento}
                          onChange={(e) => setDocumento(e.target.value)}
                          placeholder={isForeign ? "Documento estrangeiro" : undefined}
                        />
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Contribuinte ICMS</Label>
                      <Select value={contribuinteIcms} onValueChange={(v) => setContribuinteIcms(v as ContribuinteICMS)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONTRIBUINTE_ICMS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Razão Social e Nome Fantasia */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Razão Social *</Label>
                      <Input
                        value={razaoSocial}
                        onChange={(e) => setRazaoSocial(e.target.value)}
                        placeholder="Nome completo / Razão social"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome Fantasia</Label>
                      <Input
                        value={nomeFantasia}
                        onChange={(e) => setNomeFantasia(e.target.value)}
                        placeholder="Nome comercial"
                      />
                    </div>
                  </div>

                  {/* IE, IM, CNAE, CRT - Ocultos para estrangeiro */}
                  {!isForeign && (
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>IE</Label>
                        <MaskedInput
                          mask="ie"
                          uf={enderecoFiscal?.uf || ""}
                          value={ie}
                          onChange={setIe}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>IM</Label>
                        <MaskedInput
                          mask="im"
                          value={im}
                          onChange={setIm}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CNAE</Label>
                        <Input
                          value={cnae}
                          onChange={(e) => setCnae(e.target.value)}
                          placeholder="0000-0/00"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>CRT</Label>
                        <Select value={crt} onValueChange={setCrt}>
                          <SelectTrigger>
                            <SelectValue placeholder="Regime" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 - Simples Nacional</SelectItem>
                            <SelectItem value="2">2 - Simples Excesso</SelectItem>
                            <SelectItem value="3">3 - Regime Normal</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  {/* Status e Classificação */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Classificação</Label>
                      <Select value={classificacao} onValueChange={setClassificacao}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLASSIFICACOES.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Papéis */}
                  <div className="space-y-2">
                    <Label>Papéis *</Label>
                    <div className="flex flex-wrap gap-4">
                      {PAPEIS.map((papel) => (
                        <div key={papel.value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`papel-${papel.value}`}
                            checked={selectedPapeis.includes(papel.value)}
                            onCheckedChange={() => togglePapel(papel.value)}
                          />
                          <label htmlFor={`papel-${papel.value}`} className="text-sm cursor-pointer">
                            {papel.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Site e Observações */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Site</Label>
                      <Input
                        value={site}
                        onChange={(e) => setSite(e.target.value)}
                        placeholder="https://"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Endereços */}
          {currentStep === 2 && (
            <div className="space-y-4">
              {isForeign && (
                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Entidades estrangeiras não exigem endereço brasileiro. Preencha conforme necessário.
                  </AlertDescription>
                </Alert>
              )}
              
              {enderecos.map((endereco, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Endereço {index + 1}
                      </CardTitle>
                      {enderecos.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeEndereco(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select 
                          value={endereco.tipo} 
                          onValueChange={(v) => updateEndereco(index, 'tipo', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(TIPO_ENDERECO_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {!isForeign && (
                        <div className="space-y-2">
                          <Label>CEP</Label>
                          <MaskedInput
                            mask="cep"
                            value={endereco.cep}
                            onChange={(v) => updateEndereco(index, 'cep', v)}
                          />
                        </div>
                      )}
                      <div className="space-y-2 flex items-end">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={endereco.principal}
                            onCheckedChange={(v) => updateEndereco(index, 'principal', v)}
                          />
                          <Label className="text-sm">Endereço Principal</Label>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4">
                      <div className="col-span-2 space-y-2">
                        <Label>Logradouro</Label>
                        <Input
                          value={endereco.logradouro}
                          onChange={(e) => updateEndereco(index, 'logradouro', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Número</Label>
                        <Input
                          value={endereco.nro}
                          onChange={(e) => updateEndereco(index, 'nro', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Complemento</Label>
                        <Input
                          value={endereco.compl}
                          onChange={(e) => updateEndereco(index, 'compl', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Bairro</Label>
                        <Input
                          value={endereco.bairro}
                          onChange={(e) => updateEndereco(index, 'bairro', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cidade</Label>
                        <Input
                          value={endereco.cidade}
                          onChange={(e) => updateEndereco(index, 'cidade', e.target.value)}
                        />
                      </div>
                      {!isForeign && (
                        <div className="space-y-2">
                          <Label>UF</Label>
                          <Input
                            value={endereco.uf}
                            onChange={(e) => updateEndereco(index, 'uf', e.target.value.toUpperCase())}
                            maxLength={2}
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label>País</Label>
                        <Input
                          value={endereco.pais}
                          onChange={(e) => updateEndereco(index, 'pais', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button variant="outline" onClick={addEndereco} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Endereço
              </Button>
            </div>
          )}

          {/* Step 3: Contatos */}
          {currentStep === 3 && (
            <div className="space-y-4">
              {contatos.map((contato, index) => (
                <Card key={index}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Contato {index + 1}
                      </CardTitle>
                      {contatos.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeContato(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Nome *</Label>
                        <Input
                          value={contato.nome}
                          onChange={(e) => updateContato(index, 'nome', e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Departamento</Label>
                        <Select 
                          value={contato.departamento} 
                          onValueChange={(v) => updateContato(index, 'departamento', v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(DEPARTAMENTO_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Cargo</Label>
                        <Input
                          value={contato.cargo}
                          onChange={(e) => updateContato(index, 'cargo', e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Telefone</Label>
                        <MaskedInput
                          mask="phone"
                          value={contato.telefone}
                          onChange={(v) => updateContato(index, 'telefone', v)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>WhatsApp</Label>
                        <MaskedInput
                          mask="phone"
                          value={contato.whatsapp}
                          onChange={(v) => updateContato(index, 'whatsapp', v)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>E-mail</Label>
                        <Input
                          type="email"
                          value={contato.email}
                          onChange={(e) => updateContato(index, 'email', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        checked={contato.preferencial}
                        onCheckedChange={(v) => updateContato(index, 'preferencial', v)}
                      />
                      <Label className="text-sm">Contato Preferencial</Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              <Button variant="outline" onClick={addContato} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Contato
              </Button>
            </div>
          )}

          {/* Step 4: Fiscal */}
          {currentStep === 4 && (
            <div className="space-y-6">
              {isForeign && (
                <Alert>
                  <Globe className="h-4 w-4" />
                  <AlertDescription>
                    Operações com entidades estrangeiras utilizam CFOPs específicos (3.xxx entrada / 7.xxx saída).
                  </AlertDescription>
                </Alert>
              )}
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configurações Fiscais Padrão</CardTitle>
                  <CardDescription>Valores aplicados automaticamente nas operações</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Natureza Operação Padrão</Label>
                      <Input
                        value={naturezaOperacaoPadrao}
                        onChange={(e) => setNaturezaOperacaoPadrao(e.target.value)}
                        placeholder="Ex: VENDA DE MERCADORIA"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CFOP Entrada Padrão</Label>
                      <Input
                        value={cfopEntrada}
                        onChange={(e) => setCfopEntrada(e.target.value)}
                        placeholder={isForeign ? "Ex: 3102" : "Ex: 1102"}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CFOP Saída Padrão</Label>
                      <Input
                        value={cfopSaida}
                        onChange={(e) => setCfopSaida(e.target.value)}
                        placeholder={isForeign ? "Ex: 7102" : "Ex: 5102"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CST ICMS Padrão</Label>
                      <Input
                        value={cstIcmsPadrao}
                        onChange={(e) => setCstIcmsPadrao(e.target.value)}
                        placeholder="Ex: 00"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>CST PIS Padrão</Label>
                      <Input
                        value={cstPisPadrao}
                        onChange={(e) => setCstPisPadrao(e.target.value)}
                        placeholder="Ex: 01"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CST COFINS Padrão</Label>
                      <Input
                        value={cstCofinsPadrao}
                        onChange={(e) => setCstCofinsPadrao(e.target.value)}
                        placeholder="Ex: 01"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observação Fiscal Padrão</Label>
                    <Textarea
                      value={observacaoFiscal}
                      onChange={(e) => setObservacaoFiscal(e.target.value)}
                      rows={2}
                      placeholder="Texto padrão para notas fiscais"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Regras de Validação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium">Bloquear sem CPF/CNPJ válido</p>
                      <p className="text-sm text-muted-foreground">Impede operações com documento inválido</p>
                    </div>
                    <Switch checked={bloquearSemDoc} onCheckedChange={setBloquearSemDoc} />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium">Bloquear sem IE quando exigido</p>
                      <p className="text-sm text-muted-foreground">Impede operações sem IE para contribuinte</p>
                    </div>
                    <Switch checked={bloquearSemIe} onCheckedChange={setBloquearSemIe} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 5: Financeiro */}
          {currentStep === 5 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configurações Financeiras</CardTitle>
                  <CardDescription>Condições padrão para pagamentos e cobranças</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Condição de Pagamento Padrão</Label>
                      <Select value={condicaoPagamento} onValueChange={setCondicaoPagamento}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDICOES_PAGAMENTO.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Forma de Pagamento Padrão</Label>
                      <Select value={formaPagamento} onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FORMA_PAGAMENTO_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Limite de Crédito (R$)</Label>
                      <Input
                        type="number"
                        value={limiteCredito || ""}
                        onChange={(e) => setLimiteCredito(parseFloat(e.target.value) || 0)}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Dias de Tolerância</Label>
                      <Input
                        type="number"
                        value={diasTolerancia || ""}
                        onChange={(e) => setDiasTolerancia(parseInt(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>E-mail para NF-e</Label>
                      <Input
                        type="email"
                        value={emailNfe}
                        onChange={(e) => setEmailNfe(e.target.value)}
                        placeholder="nfe@empresa.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail para Boletos</Label>
                      <Input
                        type="email"
                        value={emailBoleto}
                        onChange={(e) => setEmailBoleto(e.target.value)}
                        placeholder="financeiro@empresa.com"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Regras Financeiras</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium">Bloquear por inadimplência</p>
                      <p className="text-sm text-muted-foreground">Bloqueia operações com títulos vencidos</p>
                    </div>
                    <Switch checked={bloquearInadimplencia} onCheckedChange={setBloquearInadimplencia} />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-md">
                    <div>
                      <p className="font-medium">Gerar Contas a Pagar do XML</p>
                      <p className="text-sm text-muted-foreground">Cria automaticamente contas a pagar ao importar NF-e</p>
                    </div>
                    <Switch checked={gerarContasPagar} onCheckedChange={setGerarContasPagar} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 6: Revisão */}
          {currentStep === 6 && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Check className="h-5 w-5 text-primary" />
                    Revisão Final
                  </CardTitle>
                  <CardDescription>Confira os dados antes de salvar</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Tipo</p>
                      <p className="font-medium">{TIPO_PESSOA_LABELS[tipoPessoa]}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Documento</p>
                      <p className="font-medium">{documento}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Razão Social</p>
                      <p className="font-medium">{razaoSocial}</p>
                    </div>
                    {nomeFantasia && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Nome Fantasia</p>
                        <p className="font-medium">{nomeFantasia}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Papéis</p>
                      <p className="font-medium">{selectedPapeis.join(", ")}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <p className="font-medium">{status}</p>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Endereços</p>
                      <p className="font-medium">{enderecos.length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Contatos</p>
                      <p className="font-medium">{contatos.filter(c => c.nome).length}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Limite Crédito</p>
                      <p className="font-medium">R$ {limiteCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <Separator className="my-4" />

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>

          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            
            {currentStep < 6 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Avançar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                <Check className="h-4 w-4 mr-2" />
                Salvar Entidade
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
