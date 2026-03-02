import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateItem as useCreateItemSupabase, useCreateItemFornecedor, useCreateItemAlias } from "@/hooks/use-itens";
import { useHybridEntidades } from "@/hooks/use-hybrid-data";
import type { TipoItemLocal, UnidadeInternaLocal, UnidadeFornecedor } from "@/hooks/use-local-itens";
import {
  calcularFatorConversaoAutomatico,
  unidadeInternaSugerida,
  unidadeFornecedorSugerida,
  validarFatorConversao,
} from "@/lib/erp-validation";
import type { TempFornecedor, TempAlias } from "./item-wizard-constants";
import { TOTAL_STEPS } from "./item-wizard-constants";
import { centralToast } from "@/components/ui/central-toast";

export function useItemWizardState(onSuccess?: () => void) {
  const queryClient = useQueryClient();
  const createItemMutation = useCreateItemSupabase();
  const createFornecedorMutation = useCreateItemFornecedor();
  const createAliasMutation = useCreateItemAlias();
  const { data: entidadesFornecedores } = useHybridEntidades({ papel: "FORNECEDOR" });
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Identificação
  const [tipoItem, setTipoItem] = useState<TipoItemLocal>("MP");
  const [skuInterno, setSkuInterno] = useState("");
  const [descricaoInterna, setDescricaoInterna] = useState("");
  const [descricaoComercial, setDescricaoComercial] = useState("");
  const [categoriaOperacional, setCategoriaOperacional] = useState("");

  // Step 2: Unidades
  const [unidadeFornecedor, setUnidadeFornecedor] = useState<UnidadeFornecedor>("kg");
  const [unidadeInterna, setUnidadeInterna] = useState<UnidadeInternaLocal>("g");
  const [fatorConversao, setFatorConversao] = useState<number>(1000);
  const [fatorManual, setFatorManual] = useState(false);
  const [tipoPotencia, setTipoPotencia] = useState<string>("NENHUMA");
  const [valorPotencia, setValorPotencia] = useState<number | undefined>();
  const [percentualElementar, setPercentualElementar] = useState<number | undefined>();

  // Step 3: Comercial
  const [precoUnitarioFornecedor, setPrecoUnitarioFornecedor] = useState<number | undefined>();
  const [moq, setMoq] = useState<number | undefined>();
  const [leadTimeDias, setLeadTimeDias] = useState<number | undefined>();
  const [observacoesComerciais, setObservacoesComerciais] = useState("");

  // Step 4: Fiscal
  const [ncm, setNcm] = useState("");
  const [ean, setEan] = useState("");
  const [cfopEntradaPadrao, setCfopEntradaPadrao] = useState("");
  const [cfopSaidaPadrao, setCfopSaidaPadrao] = useState("");
  const [cstIcms, setCstIcms] = useState("");
  const [origemIcms, setOrigemIcms] = useState("0");
  const [aliquotaIcms, setAliquotaIcms] = useState<number | undefined>();
  const [mvaSt, setMvaSt] = useState<number | undefined>();
  const [cstIpi, setCstIpi] = useState("");
  const [aliquotaIpi, setAliquotaIpi] = useState<number | undefined>();
  const [cstPis, setCstPis] = useState("");
  const [aliquotaPis, setAliquotaPis] = useState<number | undefined>();
  const [cstCofins, setCstCofins] = useState("");
  const [aliquotaCofins, setAliquotaCofins] = useState<number | undefined>();
  const [cest, setCest] = useState("");
  const [observacoesFiscais, setObservacoesFiscais] = useState("");

  // Step 5: Processo
  const [criticidade, setCriticidade] = useState("NORMAL");
  const [armazenamento, setArmazenamento] = useState("AMBIENTE");
  const [controlaLote, setControlaLote] = useState(true);
  const [controlaValidade, setControlaValidade] = useState(true);
  const [higroscopico, setHigroscopico] = useState(false);
  const [exigePremix, setExigePremix] = useState(false);
  const [ativo, setAtivo] = useState(true);

  // Step 6: Fornecedores
  const [fornecedores, setFornecedores] = useState<TempFornecedor[]>([]);
  const [showFornecedorForm, setShowFornecedorForm] = useState(false);
  const [newFornecedor, setNewFornecedor] = useState<Partial<TempFornecedor>>({
    unidade_compra_padrao: "kg",
    fator_para_unidade_interna: 1000,
    fornecedor_preferencial: false,
  });

  // Step 7: Aliases
  const [aliases, setAliases] = useState<TempAlias[]>([]);
  const [showAliasForm, setShowAliasForm] = useState(false);
  const [newAlias, setNewAlias] = useState<Partial<TempAlias>>({
    tipo: "ALIAS_FORNECEDOR",
    texto: "",
  });

  // Campos de cápsula
  const [capsulaMarca, setCapsulaMarca] = useState("");
  const [capsulaTamanho, setCapsulaTamanho] = useState<string>("");
  const [capsulaCor, setCapsulaCor] = useState("");
  const [capsulaMaterial, setCapsulaMaterial] = useState<string>("");
  const [fotoUrl, setFotoUrl] = useState<string | undefined>();

  const isCapsule = tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA';
  const isAtivo = tipoItem === 'ATIVO' || tipoItem === 'MP';

  // Auto-configuração baseada no tipo
  useEffect(() => {
    const unidadeIntSugerida = unidadeInternaSugerida(tipoItem);
    const unidadeFornSugerida = unidadeFornecedorSugerida(tipoItem);
    setUnidadeInterna(unidadeIntSugerida);
    setUnidadeFornecedor(unidadeFornSugerida);
    const fatorAuto = calcularFatorConversaoAutomatico(unidadeFornSugerida, unidadeIntSugerida);
    if (fatorAuto !== null) {
      setFatorConversao(fatorAuto);
      setFatorManual(false);
    } else {
      setFatorConversao(1);
      setFatorManual(true);
    }
    if (tipoItem === 'CAPSULA' || tipoItem === 'CAPSULA_VAZIA') {
      setControlaLote(true);
      setControlaValidade(true);
    } else if (tipoItem === 'MP' || tipoItem === 'ATIVO') {
      setControlaLote(true);
      setControlaValidade(true);
      setCriticidade('CRITICO');
    }
  }, [tipoItem]);

  useEffect(() => {
    if (!fatorManual) {
      const fatorAuto = calcularFatorConversaoAutomatico(unidadeFornecedor, unidadeInterna);
      if (fatorAuto !== null) setFatorConversao(fatorAuto);
    }
  }, [unidadeFornecedor, unidadeInterna, fatorManual]);

  const validacaoFator = useMemo(() => {
    return validarFatorConversao(unidadeFornecedor, unidadeInterna, fatorConversao);
  }, [unidadeFornecedor, unidadeInterna, fatorConversao]);

  const custoInternoCalculado = useMemo(() => {
    if (!precoUnitarioFornecedor || !fatorConversao) return undefined;
    return precoUnitarioFornecedor / fatorConversao;
  }, [precoUnitarioFornecedor, fatorConversao]);

  const validacaoTipoItem = useMemo(() => {
    const erros: string[] = [];
    if (isCapsule) {
      if (!capsulaTamanho) erros.push("Tamanho da cápsula é obrigatório");
      if (!capsulaMaterial) erros.push("Material da cápsula é obrigatório");
    }
    if (isAtivo && tipoPotencia === 'NENHUMA') {
      erros.push("Ativos e MPs devem ter tipo de potência definido (%, UI/g ou mcg/g)");
    }
    return { valido: erros.length === 0, erros };
  }, [isCapsule, isAtivo, capsulaTamanho, capsulaMaterial, tipoPotencia]);

  const validacaoComercial = useMemo(() => {
    const erros: string[] = [];
    const avisos: string[] = [];
    if (['EMBALAGEM', 'POTE', 'TAMPA', 'ROTULO', 'CAPSULA'].includes(tipoItem)) {
      if (!moq || moq <= 0) avisos.push("Recomenda-se informar MOQ para embalagens");
    }
    return { valido: erros.length === 0, erros, avisos };
  }, [tipoItem, moq]);

  const validacaoFiscal = useMemo(() => {
    const erros: string[] = [];
    const avisos: string[] = [];
    if (['MP', 'ATIVO', 'EXCIPIENTE', 'PA'].includes(tipoItem) && !ncm)
      avisos.push("NCM é recomendado para este tipo de item");
    if (ncm && ncm.length !== 8) erros.push("NCM deve ter exatamente 8 dígitos");
    if (ean && ![8, 12, 13, 14].includes(ean.length)) erros.push("EAN deve ter 8, 12, 13 ou 14 dígitos");
    return { valido: erros.length === 0, erros, avisos };
  }, [tipoItem, ncm, ean]);

  const canProceed = () => {
    switch (currentStep) {
      case 1: return !!descricaoInterna.trim() && (!isCapsule || (!!capsulaTamanho && !!capsulaMaterial));
      case 2: return validacaoFator.valido && (!isAtivo || tipoPotencia !== 'NENHUMA');
      case 3: return validacaoComercial.valido;
      case 4: return validacaoFiscal.valido;
      default: return true;
    }
  };

  const stepValidationMessages = useMemo(() => {
    switch (currentStep) {
      case 1: return validacaoTipoItem;
      case 2: return { valido: validacaoFator.valido, erros: validacaoFator.erro ? [validacaoFator.erro] : [], avisos: [] as string[] };
      case 3: return validacaoComercial;
      case 4: return validacaoFiscal;
      default: return { valido: true, erros: [] as string[], avisos: [] as string[] };
    }
  }, [currentStep, validacaoTipoItem, validacaoFator, validacaoComercial, validacaoFiscal]);

  const handleNext = () => { if (currentStep < TOTAL_STEPS && canProceed()) setCurrentStep(currentStep + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  const handleAddFornecedor = () => {
    if (!newFornecedor.fornecedor_id) return;
    const fornecedor = entidadesFornecedores?.find(e => e.id === newFornecedor.fornecedor_id);
    if (!fornecedor) return;
    const temp: TempFornecedor = {
      id: crypto.randomUUID(),
      fornecedor_id: newFornecedor.fornecedor_id,
      fornecedor_nome: fornecedor.razao_social,
      codigo_fornecedor: newFornecedor.codigo_fornecedor || "",
      descricao_fornecedor: newFornecedor.descricao_fornecedor || "",
      unidade_compra_padrao: newFornecedor.unidade_compra_padrao || "kg",
      fator_para_unidade_interna: newFornecedor.fator_para_unidade_interna || 1000,
      preco_referencia: newFornecedor.preco_referencia,
      moq: newFornecedor.moq,
      lead_time_dias: newFornecedor.lead_time_dias,
      fornecedor_preferencial: newFornecedor.fornecedor_preferencial || false,
    };
    setFornecedores([...fornecedores, temp]);
    setNewFornecedor({ unidade_compra_padrao: "kg", fator_para_unidade_interna: 1000, fornecedor_preferencial: false });
    setShowFornecedorForm(false);
  };

  const handleRemoveFornecedor = (id: string) => setFornecedores(fornecedores.filter(f => f.id !== id));

  const handleAddAlias = () => {
    if (!newAlias.texto?.trim()) return;
    const temp: TempAlias = { id: crypto.randomUUID(), tipo: newAlias.tipo || "ALIAS_FORNECEDOR", texto: newAlias.texto, fornecedor_id: newAlias.fornecedor_id };
    setAliases([...aliases, temp]);
    setNewAlias({ tipo: "ALIAS_FORNECEDOR", texto: "" });
    setShowAliasForm(false);
  };

  const handleRemoveAlias = (id: string) => setAliases(aliases.filter(a => a.id !== id));

  const handleSubmit = async () => {
    if (!validacaoFator.valido) return;
    
    try {
      const itemData: any = {
        sku_interno: skuInterno || undefined,
        descricao_interna: descricaoInterna,
        descricao_comercial: descricaoComercial || undefined,
        categoria_operacional: categoriaOperacional || undefined,
        tipo_item: tipoItem,
        unidade_interna: unidadeInterna,
        ncm: ncm || undefined,
        ean: ean || undefined,
        criticidade: criticidade,
        controla_lote: controlaLote,
        controla_validade: controlaValidade,
        higroscopico,
        exige_premix: exigePremix,
        ativo,
        ...(isCapsule && {
          capsula_marca: capsulaMarca || undefined,
          capsula_tamanho: capsulaTamanho || undefined,
          capsula_cor: capsulaCor || undefined,
          capsula_material: capsulaMaterial || undefined,
          foto_url: fotoUrl || undefined,
        }),
      };

      const item = await createItemMutation.mutateAsync(itemData);

      // Create fornecedor links in Supabase
      const hasPreferencial = fornecedores.some((f) => !!f.fornecedor_preferencial);
      for (const [idx, f] of fornecedores.entries()) {
        try {
          await createFornecedorMutation.mutateAsync({
            item_id: item.id,
            fornecedor_id: f.fornecedor_id,
            codigo_fornecedor: f.codigo_fornecedor || undefined,
            descricao_fornecedor: f.descricao_fornecedor || undefined,
            fornecedor_preferencial: hasPreferencial ? !!f.fornecedor_preferencial : idx === 0,
          } as any);
        } catch (e) {
          console.warn('Erro ao vincular fornecedor:', e);
        }
      }

      // Create aliases in Supabase
      for (const a of aliases) {
        try {
          await createAliasMutation.mutateAsync({
            item_id: item.id,
            fornecedor_id: a.fornecedor_id || undefined,
            tipo: a.tipo,
            texto: a.texto,
          } as any);
        } catch (e) {
          console.warn('Erro ao criar alias:', e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["itens"] });
      queryClient.invalidateQueries({ queryKey: ["hybrid-itens"] });
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error('Erro ao criar item:', error);
    }
  };

  const resetForm = () => {
    setCurrentStep(1); setTipoItem("MP"); setSkuInterno(""); setDescricaoInterna("");
    setDescricaoComercial(""); setCategoriaOperacional(""); setUnidadeFornecedor("kg");
    setUnidadeInterna("g"); setFatorConversao(1000); setFatorManual(false);
    setTipoPotencia("NENHUMA"); setValorPotencia(undefined); setPercentualElementar(undefined);
    setPrecoUnitarioFornecedor(undefined); setMoq(undefined); setLeadTimeDias(undefined);
    setObservacoesComerciais(""); setNcm(""); setEan(""); setCfopEntradaPadrao("");
    setCfopSaidaPadrao(""); setCstIcms(""); setOrigemIcms("0"); setAliquotaIcms(undefined);
    setMvaSt(undefined); setCstIpi(""); setAliquotaIpi(undefined); setCstPis("");
    setAliquotaPis(undefined); setCstCofins(""); setAliquotaCofins(undefined); setCest("");
    setObservacoesFiscais(""); setCriticidade("NORMAL"); setArmazenamento("AMBIENTE");
    setControlaLote(true); setControlaValidade(true); setHigroscopico(false);
    setExigePremix(false); setAtivo(true); setFornecedores([]); setAliases([]);
    setCapsulaMarca(""); setCapsulaTamanho(""); setCapsulaCor(""); setCapsulaMaterial("");
    setFotoUrl(undefined);
  };

  return {
    currentStep, setCurrentStep, entidadesFornecedores,
    // Step 1
    tipoItem, setTipoItem, skuInterno, setSkuInterno, descricaoInterna, setDescricaoInterna,
    descricaoComercial, setDescricaoComercial, categoriaOperacional, setCategoriaOperacional,
    // Step 2
    unidadeFornecedor, setUnidadeFornecedor, unidadeInterna, setUnidadeInterna,
    fatorConversao, setFatorConversao, fatorManual, setFatorManual,
    tipoPotencia, setTipoPotencia, valorPotencia, setValorPotencia,
    percentualElementar, setPercentualElementar,
    // Step 3
    precoUnitarioFornecedor, setPrecoUnitarioFornecedor, moq, setMoq,
    leadTimeDias, setLeadTimeDias, observacoesComerciais, setObservacoesComerciais,
    // Step 4
    ncm, setNcm, ean, setEan, cfopEntradaPadrao, setCfopEntradaPadrao,
    cfopSaidaPadrao, setCfopSaidaPadrao, cstIcms, setCstIcms, origemIcms, setOrigemIcms,
    aliquotaIcms, setAliquotaIcms, mvaSt, setMvaSt, cstIpi, setCstIpi,
    aliquotaIpi, setAliquotaIpi, cstPis, setCstPis, aliquotaPis, setAliquotaPis,
    cstCofins, setCstCofins, aliquotaCofins, setAliquotaCofins, cest, setCest,
    observacoesFiscais, setObservacoesFiscais,
    // Step 5
    criticidade, setCriticidade, armazenamento, setArmazenamento,
    controlaLote, setControlaLote, controlaValidade, setControlaValidade,
    higroscopico, setHigroscopico, exigePremix, setExigePremix, ativo, setAtivo,
    // Step 6
    fornecedores, showFornecedorForm, setShowFornecedorForm,
    newFornecedor, setNewFornecedor, handleAddFornecedor, handleRemoveFornecedor,
    // Step 7
    aliases, showAliasForm, setShowAliasForm,
    newAlias, setNewAlias, handleAddAlias, handleRemoveAlias,
    // Capsule
    capsulaMarca, setCapsulaMarca, capsulaTamanho, setCapsulaTamanho,
    capsulaCor, setCapsulaCor, capsulaMaterial, setCapsulaMaterial,
    fotoUrl, setFotoUrl,
    // Computed
    isCapsule, isAtivo, validacaoFator, custoInternoCalculado,
    validacaoTipoItem, validacaoComercial, validacaoFiscal,
    canProceed, stepValidationMessages,
    // Navigation
    handleNext, handleBack, handleSubmit, resetForm,
    progressPercent: (currentStep / TOTAL_STEPS) * 100,
  };
}
