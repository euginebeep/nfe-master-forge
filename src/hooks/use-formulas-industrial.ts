import { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalDb } from '@/lib/local-db';
import { 
  FormulaIndustrial, 
  InsumoFormulacao, 
  ProdutoFormulacao,
  PerfilExcipiente,
  FormulaIngredienteIndustrial,
  TipoCapsulaIndustrial,
  CAPSULAS_CAPACIDADE,
  PERFIL_SEMI_AUTOMATICA,
  calcularPesoAPesar,
  calcularExcipientes,
  gerarAlertasFormula,
  determinarStatusOcupacao,
  calcularQSPIndustrial,
  calcularCustoPorCapsula,
} from '@/types/formulas-industrial';
import { toast } from 'sonner';

// ========================================
// HOOKS PARA INSUMOS
// ========================================

export function useInsumosFormulacao() {
  const [insumos, setInsumos] = useState<InsumoFormulacao[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    const data = LocalDb.getCollection<InsumoFormulacao>('insumos_formulacao' as any);
    data.sort((a, b) => a.nome_interno.localeCompare(b.nome_interno));
    setInsumos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection;
      if (!collection || collection === '*' || collection === 'insumos_formulacao') {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [refresh]);

  const create = useCallback((data: Omit<InsumoFormulacao, 'id' | 'created_at' | 'updated_at'>) => {
    const insumo = LocalDb.insert<InsumoFormulacao>('insumos_formulacao' as any, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    toast.success('Insumo cadastrado');
    return insumo;
  }, []);

  const update = useCallback((id: string, data: Partial<InsumoFormulacao>) => {
    const updated = LocalDb.update<InsumoFormulacao>('insumos_formulacao' as any, id, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    if (updated) toast.success('Insumo atualizado');
    return updated;
  }, []);

  const remove = useCallback((id: string) => {
    LocalDb.remove('insumos_formulacao' as any, id);
    toast.success('Insumo excluído');
  }, []);

  return { 
    data: insumos, 
    isLoading: loading, 
    refresh, 
    create, 
    update, 
    remove,
    // Filtros úteis
    ativos: useMemo(() => insumos.filter(i => i.categoria === 'ATIVO'), [insumos]),
    excipientes: useMemo(() => insumos.filter(i => i.categoria === 'EXCIPIENTE'), [insumos]),
    aditivos: useMemo(() => insumos.filter(i => i.categoria === 'ADITIVO_TECNOLOGICO'), [insumos]),
  };
}

// ========================================
// HOOKS PARA PERFIS DE EXCIPIENTE
// ========================================

export function usePerfisExcipiente() {
  const [perfis, setPerfis] = useState<PerfilExcipiente[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<PerfilExcipiente>('perfis_excipiente' as any);
    
    // Se não houver perfis, criar o padrão
    if (data.length === 0) {
      const perfilPadrao = LocalDb.insert<PerfilExcipiente>('perfis_excipiente' as any, {
        ...PERFIL_SEMI_AUTOMATICA,
        updated_at: new Date().toISOString(),
      });
      data = [perfilPadrao];
    }
    
    data.sort((a, b) => {
      if (a.padrao && !b.padrao) return -1;
      if (!a.padrao && b.padrao) return 1;
      return a.nome.localeCompare(b.nome);
    });
    
    setPerfis(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection;
      if (!collection || collection === '*' || collection === 'perfis_excipiente') {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [refresh]);

  const create = useCallback((data: Omit<PerfilExcipiente, 'id' | 'created_at' | 'updated_at'>) => {
    const perfil = LocalDb.insert<PerfilExcipiente>('perfis_excipiente' as any, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    toast.success('Perfil de excipiente criado');
    return perfil;
  }, []);

  const update = useCallback((id: string, data: Partial<PerfilExcipiente>) => {
    const updated = LocalDb.update<PerfilExcipiente>('perfis_excipiente' as any, id, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    if (updated) toast.success('Perfil atualizado');
    return updated;
  }, []);

  const remove = useCallback((id: string) => {
    const perfil = LocalDb.getById<PerfilExcipiente>('perfis_excipiente' as any, id);
    if (perfil?.padrao) {
      toast.error('Não é possível excluir o perfil padrão');
      return;
    }
    LocalDb.remove('perfis_excipiente' as any, id);
    toast.success('Perfil excluído');
  }, []);

  const perfilPadrao = useMemo(() => perfis.find(p => p.padrao), [perfis]);

  return { 
    data: perfis, 
    isLoading: loading, 
    refresh, 
    create, 
    update, 
    remove,
    perfilPadrao,
  };
}

// ========================================
// HOOKS PARA PRODUTOS
// ========================================

function generateProductCode(): string {
  const produtos = LocalDb.getCollection<ProdutoFormulacao>('produtos_formulacao' as any);
  const maxNum = produtos.reduce((max, p) => {
    const match = p.codigo.match(/^PROD-(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `PROD-${String(maxNum + 1).padStart(4, '0')}`;
}

export function useProdutosFormulacao() {
  const [produtos, setProdutos] = useState<ProdutoFormulacao[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    const data = LocalDb.getCollection<ProdutoFormulacao>('produtos_formulacao' as any);
    data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setProdutos(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection;
      if (!collection || collection === '*' || collection === 'produtos_formulacao') {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [refresh]);

  const create = useCallback((data: Omit<ProdutoFormulacao, 'id' | 'codigo' | 'created_at' | 'updated_at'>) => {
    const produto = LocalDb.insert<ProdutoFormulacao>('produtos_formulacao' as any, {
      ...data,
      codigo: generateProductCode(),
      updated_at: new Date().toISOString(),
    });
    toast.success('Produto cadastrado');
    return produto;
  }, []);

  const update = useCallback((id: string, data: Partial<ProdutoFormulacao>) => {
    const updated = LocalDb.update<ProdutoFormulacao>('produtos_formulacao' as any, id, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    if (updated) toast.success('Produto atualizado');
    return updated;
  }, []);

  const remove = useCallback((id: string) => {
    LocalDb.remove('produtos_formulacao' as any, id);
    toast.success('Produto excluído');
  }, []);

  return { data: produtos, isLoading: loading, refresh, create, update, remove };
}

export function useProdutoFormulacao(id: string | undefined) {
  const [produto, setProduto] = useState<ProdutoFormulacao | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) {
      setProduto(null);
      setLoading(false);
      return;
    }
    const data = LocalDb.getById<ProdutoFormulacao>('produtos_formulacao' as any, id);
    setProduto(data);
    setLoading(false);
  }, [id]);

  return { produto, isLoading: loading };
}

// ========================================
// HOOKS PARA FÓRMULAS INDUSTRIAIS
// ========================================

function generateFormulaCode(): string {
  const formulas = LocalDb.getCollection<FormulaIndustrial>('formulas_industrial' as any);
  const maxNum = formulas.reduce((max, f) => {
    const match = f.codigo.match(/^FRM-(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return `FRM-${String(maxNum + 1).padStart(4, '0')}`;
}

export function useFormulasIndustrial(filters?: { status?: string; produto_id?: string }) {
  const [formulas, setFormulas] = useState<FormulaIndustrial[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<FormulaIndustrial>('formulas_industrial' as any);
    
    if (filters?.status) {
      data = data.filter(f => f.status === filters.status);
    }
    if (filters?.produto_id) {
      data = data.filter(f => f.produto_id === filters.produto_id);
    }
    
    data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setFormulas(data);
    setLoading(false);
  }, [filters?.status, filters?.produto_id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection;
      if (!collection || collection === '*' || collection === 'formulas_industrial') {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [refresh]);

  return { data: formulas, isLoading: loading, refresh };
}

export function useFormulaIndustrial(id: string | undefined) {
  const [formula, setFormula] = useState<FormulaIndustrial | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setFormula(null);
      setLoading(false);
      return;
    }
    const data = LocalDb.getById<FormulaIndustrial>('formulas_industrial' as any, id);
    setFormula(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { formula, isLoading: loading, refresh };
}

// ========================================
// HOOK PARA CRIAR/CALCULAR FÓRMULA
// ========================================

export interface CriarFormulaParams {
  produto_id: string;
  capsulas_por_dose: 1 | 2;
  numero_doses: number;
  perfil_excipiente_id: string;
  tipo_capsula?: TipoCapsulaIndustrial;
  capacidade_alvo?: number;
}

export function useCreateFormulaIndustrial() {
  const { data: perfis } = usePerfisExcipiente();

  const calcularFormula = useCallback((
    produto: ProdutoFormulacao,
    insumos: InsumoFormulacao[],
    params: CriarFormulaParams
  ): Omit<FormulaIndustrial, 'id' | 'codigo' | 'created_at' | 'updated_at'> | null => {
    
    const perfil = perfis.find(p => p.id === params.perfil_excipiente_id);
    if (!perfil) {
      toast.error('Perfil de excipiente não encontrado');
      return null;
    }

    const tipoCapsula = params.tipo_capsula || produto.tipo_capsula_padrao;
    const capacidadeAlvo = params.capacidade_alvo || produto.capacidade_alvo || CAPSULAS_CAPACIDADE[tipoCapsula].alvo;

    // Calcular ingredientes
    const ingredientes: FormulaIngredienteIndustrial[] = [];
    let totalAtivos = 0;
    let custoIngredientes = 0;
    const erros: string[] = [];

    produto.ativos.forEach((ativo, index) => {
      const insumo = insumos.find(i => i.id === ativo.insumo_id);
      if (!insumo) {
        erros.push(`Insumo "${ativo.nome_insumo}" não encontrado`);
        return;
      }

      // Calcular dose por cápsula
      const dosePorCapsula = ativo.dose_diaria / params.capsulas_por_dose;

      // Calcular peso a pesar
      const { peso_mg, erro } = calcularPesoAPesar(
        dosePorCapsula,
        ativo.unidade_dose,
        insumo.tipo_potencia,
        insumo.valor_potencia,
        insumo.percentual_elementar
      );

      if (erro) {
        erros.push(`${insumo.nome_interno}: ${erro}`);
      }

      totalAtivos += peso_mg;

      // Calcular custo deste ingrediente
      const custoIngrediente = calcularCustoPorCapsula(peso_mg, insumo.custo_por_kg);
      custoIngredientes += custoIngrediente;

      ingredientes.push({
        id: crypto.randomUUID(),
        insumo_id: insumo.id,
        item_id: insumo.item_id,
        nome_interno: insumo.nome_interno,
        nome_rotulo: insumo.nome_rotulo,
        categoria: insumo.categoria,
        dose_por_capsula: dosePorCapsula,
        unidade_dose: ativo.unidade_dose,
        tipo_potencia: insumo.tipo_potencia,
        valor_potencia: insumo.valor_potencia,
        peso_a_pesar_mg: Math.round(peso_mg * 100) / 100,
        custo_por_kg: insumo.custo_por_kg,
        custo_por_capsula: Math.round(custoIngrediente * 10000) / 10000,
        higroscopico: insumo.higroscopico,
        nivel_higroscopicidade: insumo.nivel_higroscopicidade,
        ordem: index,
      });
    });

    if (erros.length > 0) {
      erros.forEach(e => toast.error(e));
    }

    // Calcular excipientes
    const excipientes = calcularExcipientes(perfil, capacidadeAlvo, totalAtivos);
    
    // Adicionar custo aos excipientes (custo padrão estimado se não informado)
    const excipientesComCusto = excipientes.map(exc => {
      // Custo padrão para excipientes: ~R$ 50/kg (estimativa conservadora)
      const custoExcKg = 50;
      const custoExc = calcularCustoPorCapsula(exc.peso_mg, custoExcKg);
      custoIngredientes += custoExc;
      return {
        ...exc,
        custo_por_kg: custoExcKg,
        custo_por_capsula: Math.round(custoExc * 10000) / 10000,
      };
    });

    const totalExcipientesFixos = excipientesComCusto
      .filter(e => e.tipo === 'PERCENTUAL_FIXO')
      .reduce((sum, e) => sum + e.peso_mg, 0);
    const qsp = excipientesComCusto.find(e => e.tipo === 'QSP')?.peso_mg || 0;

    const pesoTotal = totalAtivos + totalExcipientesFixos + qsp;
    const percentualOcupacao = capacidadeAlvo > 0 ? (pesoTotal / capacidadeAlvo) * 100 : 0;
    const statusOcupacao = determinarStatusOcupacao(pesoTotal, capacidadeAlvo);

    // Custo total
    const custoTotalCapsula = Math.round(custoIngredientes * 10000) / 10000;
    const totalCapsulas = params.numero_doses * params.capsulas_por_dose;
    const custoTotalLote = Math.round(custoTotalCapsula * totalCapsulas * 100) / 100;

    const formulaBase: Omit<FormulaIndustrial, 'id' | 'codigo' | 'created_at' | 'updated_at' | 'alertas'> = {
      produto_id: produto.id,
      produto_nome: produto.nome_comercial,
      nome: `${produto.nome_comercial} - ${params.capsulas_por_dose}caps/dose`,
      capsulas_por_dose: params.capsulas_por_dose,
      numero_doses: params.numero_doses,
      tipo_capsula: tipoCapsula,
      capacidade_alvo_mg: capacidadeAlvo,
      ingredientes,
      perfil_excipiente_id: params.perfil_excipiente_id,
      excipientes: excipientesComCusto,
      total_ativos_mg: Math.round(totalAtivos * 100) / 100,
      total_excipientes_fixos_mg: Math.round(totalExcipientesFixos * 100) / 100,
      qsp_mg: Math.round(qsp * 100) / 100,
      peso_total_capsula_mg: Math.round(pesoTotal * 100) / 100,
      percentual_ocupacao: Math.round(percentualOcupacao * 10) / 10,
      custo_total_capsula: custoTotalCapsula,
      custo_total_lote: custoTotalLote,
      status_ocupacao: statusOcupacao,
      versao: 1,
      status: 'RASCUNHO',
    };

    // Gerar alertas
    const alertas = gerarAlertasFormula(formulaBase);

    return {
      ...formulaBase,
      alertas,
    };
  }, [perfis]);

  const create = useCallback((data: Omit<FormulaIndustrial, 'id' | 'codigo' | 'created_at' | 'updated_at'>) => {
    // Bloquear se houver erros críticos
    const errosCriticos = data.alertas.filter(a => 
      a.severidade === 'error' && a.tipo === 'POTENCIA_AUSENTE'
    );
    
    if (errosCriticos.length > 0) {
      toast.error('Não é possível salvar: potência ausente em um ou mais ativos');
      return null;
    }

    const formula = LocalDb.insert<FormulaIndustrial>('formulas_industrial' as any, {
      ...data,
      codigo: generateFormulaCode(),
      updated_at: new Date().toISOString(),
    });
    toast.success('Fórmula criada com sucesso');
    return formula;
  }, []);

  return { calcularFormula, create };
}

export function useUpdateFormulaIndustrial() {
  const update = useCallback((id: string, data: Partial<FormulaIndustrial>) => {
    const existing = LocalDb.getById<FormulaIndustrial>('formulas_industrial' as any, id);
    if (!existing) {
      toast.error('Fórmula não encontrada');
      return null;
    }

    const merged = { ...existing, ...data };
    
    // Recalcular alertas
    merged.alertas = gerarAlertasFormula(merged);
    merged.status_ocupacao = determinarStatusOcupacao(
      merged.peso_total_capsula_mg,
      merged.capacidade_alvo_mg
    );

    const updated = LocalDb.update<FormulaIndustrial>('formulas_industrial' as any, id, {
      ...merged,
      updated_at: new Date().toISOString(),
    });
    
    if (updated) toast.success('Fórmula atualizada');
    return updated;
  }, []);

  return { update };
}

export function useDeleteFormulaIndustrial() {
  const deleteFormula = useCallback((id: string) => {
    LocalDb.remove('formulas_industrial' as any, id);
    toast.success('Fórmula excluída');
  }, []);

  return { deleteFormula };
}

export function useDuplicateFormulaIndustrial() {
  const duplicate = useCallback((id: string, asNewVersion: boolean = false) => {
    const original = LocalDb.getById<FormulaIndustrial>('formulas_industrial' as any, id);
    if (!original) {
      toast.error('Fórmula não encontrada');
      return null;
    }

    const codigo = asNewVersion ? original.codigo : generateFormulaCode();
    const versao = asNewVersion ? original.versao + 1 : 1;

    // Criar novos IDs para ingredientes e excipientes
    const ingredientes = original.ingredientes.map(ing => ({
      ...ing,
      id: crypto.randomUUID(),
    }));
    
    const excipientes = original.excipientes.map(exc => ({
      ...exc,
      id: crypto.randomUUID(),
    }));

    const formula = LocalDb.insert<FormulaIndustrial>('formulas_industrial' as any, {
      ...original,
      id: undefined,
      codigo,
      nome: asNewVersion ? original.nome : `${original.nome} (Cópia)`,
      versao,
      versao_anterior_id: asNewVersion ? original.id : undefined,
      ingredientes,
      excipientes,
      status: 'RASCUNHO',
      updated_at: new Date().toISOString(),
    });

    if (asNewVersion && original.status !== 'ARQUIVADO') {
      LocalDb.update<FormulaIndustrial>('formulas_industrial' as any, original.id, { 
        status: 'ARQUIVADO',
        updated_at: new Date().toISOString(),
      });
    }

    toast.success(asNewVersion ? 'Nova versão criada' : 'Fórmula duplicada');
    return formula;
  }, []);

  return { duplicate };
}
