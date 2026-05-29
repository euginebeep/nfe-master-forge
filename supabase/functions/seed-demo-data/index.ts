import { createClient } from 'npm:@supabase/supabase-js@2';

const DEMO_COMPANY_ID = '00000000-0000-0000-0000-000000000001';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deterministic UUIDs for the demo tenant (so re-seeds replace cleanly)
// IMPORTANT: must be valid hex — use only digits in the variable segment.
const uid = (n: number, _prefix?: string) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: number) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
};
const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const log: string[] = [];
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const c = DEMO_COMPANY_ID;

  try {
    // ───────────────── 1. WIPE existing demo data (reverse FK order) ─────────────────
    const wipeTables = [
      'crm_interacoes', 'oportunidades', 'qc_desvios', 'qc_analises',
      'pedido_vendedor_itens', 'pedidos_vendedor', 'pedido_itens', 'pedidos_venda',
      'orcamento_itens', 'orcamentos',
      'op_pesagens_criticas', 'op_controle_qualidade', 'op_controle_perdas',
      'op_historico_etapas', 'op_checklist', 'op_anexos', 'op_assinaturas_rt',
      'op_embalagens', 'op_materias_primas', 'ordens_producao_industrial',
      'formula_itens', 'formula_versoes', 'formulas',
      'notas_saida_itens', 'notas_saida',
      'notas_entrada_itens', 'notas_entrada',
      'contas_pagar', 'contas_receber',
      'estoque_movimentacoes', 'lote_documentos', 'estoque_lotes',
      'item_alias', 'item_fornecedores', 'itens',
      'entidade_papeis', 'entidade_contatos', 'entidade_enderecos',
      'entidade_fiscal_config', 'entidade_financeiro_config', 'entidade_logistica_config',
      'entidade_comercial_crm', 'entidade_documentos', 'entidades',
      'vendedores_externos', 'responsaveis_tecnicos',
      'notifications', 'audit_log',
    ];

    for (const t of wipeTables) {
      const { error, count } = await supabase.from(t).delete({ count: 'exact' }).eq('company_id', c);
      if (error && !error.message.includes('column "company_id"')) {
        log.push(`WIPE ${t}: ${error.message}`);
      } else {
        log.push(`WIPE ${t}: ${count ?? 0}`);
      }
    }

    // ───────────────── 2. Responsáveis Técnicos ─────────────────
    const rts = [
      { nome_completo: 'Dra. Mariana Silva', cpf: '11111111111', email: 'mariana.rt@brainxdemo.com', tipo_conselho: 'CRN', numero_registro: 'CRN-3 12345', uf_conselho: 'SP' },
      { nome_completo: 'Dr. Felipe Costa', cpf: '22222222222', email: 'felipe.rt@brainxdemo.com', tipo_conselho: 'CRF', numero_registro: 'CRF-SP 67890', uf_conselho: 'SP' },
      { nome_completo: 'Dra. Camila Rocha', cpf: '33333333333', email: 'camila.rt@brainxdemo.com', tipo_conselho: 'CRQ', numero_registro: 'CRQ-IV 55432', uf_conselho: 'SP' },
      { nome_completo: 'Dr. Rafael Mendes', cpf: '44444444444', email: 'rafael.rt@brainxdemo.com', tipo_conselho: 'CRF', numero_registro: 'CRF-SP 99887', uf_conselho: 'SP' },
    ];
    const rtRows = rts.map((r, i) => ({
      id: uid(i + 1, 'rt'),
      ...r,
      validade_registro: addDays(365 + i * 30),
      status: 'ATIVO',
      company_id: c,
    }));
    const { error: rtErr } = await supabase.from('responsaveis_tecnicos').insert(rtRows);
    if (rtErr) log.push(`RT err: ${rtErr.message}`); else log.push(`RT: ${rtRows.length}`);

    // ───────────────── 3. Entidades (clientes / fornecedores / transportadoras) ─────────────────
    const entidades: any[] = [];

    // 30 clientes PJ
    const empresasNomes = ['Suplementos Vita', 'NutriMax Distribuidora', 'Pharma Health', 'Vida Saudável', 'Corpo Forte', 'BioFit', 'NutriLife', 'Energia Plus', 'Saúde Total', 'Vitalidade Pro', 'Performance Max', 'Wellness Center', 'Atlética Nutri', 'Premium Supps', 'Power Health', 'Active Body', 'Pure Life', 'Natural Force', 'Strong Mind', 'Fit Lifestyle', 'Anabolic Store', 'Mega Muscle', 'Iron Body', 'Nutri Farma', 'Health First', 'Bio Energy', 'Vital Pharma', 'Suplmax', 'Anabólicos BR', 'NutriCenter'];
    empresasNomes.forEach((nome, i) => {
      entidades.push({
        id: uid(100 + i, 'ent'),
        company_id: c,
        tipo_pessoa: 'PJ',
        documento: `1234567800${String(i).padStart(4, '0')}`.slice(0, 14),
        razao_social: `${nome} Comércio Ltda`,
        nome_fantasia: nome,
        status: 'ATIVO',
        classificacao: pick(['REGULAR', 'VIP', 'REGULAR', 'VIP'], i),
        limite_credito: 10000 + i * 5000,
        prazo_pagamento_padrao_dias: pick([15, 30, 45, 60], i),
        contribuinte_icms: 'CONTRIBUINTE',
      });
    });

    // 20 fornecedores PJ
    const fornecedoresNomes = ['Galena Química', 'Vitalfarma Insumos', 'PharmaSpecial', 'BioActive Pharma', 'NovaQuímica', 'IngredientCo', 'NutriIngredients', 'Pharma Nostra', 'Roche Nutrição', 'DSM Nutricional', 'Capsugel Brasil', 'ACG Cápsulas', 'Embalagens Forte', 'Frascos Brasil', 'PotPak', 'Quality Pharma', 'Sigma Aldrich', 'Natural Choice', 'BioFarm Suprimentos', 'Vita Source'];
    fornecedoresNomes.forEach((nome, i) => {
      entidades.push({
        id: uid(200 + i, 'ent'),
        company_id: c,
        tipo_pessoa: 'PJ',
        documento: `9876543200${String(i).padStart(4, '0')}`.slice(0, 14),
        razao_social: `${nome} Indústria Ltda`,
        nome_fantasia: nome,
        status: 'ATIVO',
        classificacao: pick(['REGULAR', 'VIP'], i),
        prazo_pagamento_padrao_dias: pick([28, 30, 45, 60, 90], i),
        contribuinte_icms: 'CONTRIBUINTE',
      });
    });

    // 10 transportadoras
    const transportadorasNomes = ['Translog Express', 'Rápido Brasil', 'TransPharma', 'LogiCargo', 'JadLog', 'Mercúrio Cargas', 'Total Express', 'Braspress', 'Patrus Transportes', 'TNT Mercúrio'];
    transportadorasNomes.forEach((nome, i) => {
      entidades.push({
        id: uid(300 + i, 'ent'),
        company_id: c,
        tipo_pessoa: 'PJ',
        documento: `5555555500${String(i).padStart(4, '0')}`.slice(0, 14),
        razao_social: `${nome} Logística S/A`,
        nome_fantasia: nome,
        status: 'ATIVO',
        contribuinte_icms: 'CONTRIBUINTE',
      });
    });

    const { error: entErr } = await supabase.from('entidades').insert(entidades);
    if (entErr) log.push(`ENT err: ${entErr.message}`); else log.push(`ENT: ${entidades.length}`);

    // Papéis
    const papeis: any[] = [];
    entidades.forEach((e, i) => {
      let papel = 'CLIENTE';
      if (i >= 30 && i < 50) papel = 'FORNECEDOR';
      if (i >= 50) papel = 'TRANSPORTADORA';
      papeis.push({ entidade_id: e.id, papel, ativo: true, company_id: c });
    });
    await supabase.from('entidade_papeis').insert(papeis);

    const clientesIds = entidades.slice(0, 30).map((e) => e.id);
    const fornecedoresIds = entidades.slice(30, 50).map((e) => e.id);

    // ───────────────── 4. Itens ─────────────────
    const mpNames = [
      'Vitamina C (Ácido Ascórbico)', 'Vitamina D3 100.000 UI/g', 'Vitamina E Acetato', 'Vitamina B12 Cianocobalamina',
      'Vitamina A Palmitato 250.000 UI/g', 'Vitamina K2 MK-7 2000 ppm', 'Vitamina B6 Cloridrato', 'Vitamina B1 Tiamina',
      'Vitamina B2 Riboflavina', 'Vitamina B3 Niacinamida', 'Vitamina B5 Pantotenato', 'Vitamina B9 Ácido Fólico',
      'Biotina 1% CWS', 'Magnésio Dimalato', 'Magnésio Glicinato', 'Magnésio Treonato',
      'Magnésio Citrato', 'Cálcio Citrato Malato', 'Zinco Bisglicinato 20%', 'Ferro Bisglicinato 20%',
      'Selênio Selenometionina 0.5%', 'Cobre Bisglicinato 10%', 'Manganês Bisglicinato', 'Cromo Picolinato',
      'Iodo Iodeto de Potássio', 'Molibdênio', 'Boro Citrato', 'Whey Protein Isolado 90%',
      'Caseína Micelar', 'BCAA 2:1:1', 'L-Leucina', 'L-Glutamina',
      'Creatina Monohidratada', 'Beta Alanina', 'L-Arginina HCl', 'L-Carnitina Tartarato',
      'Taurina', 'L-Teanina', 'Colágeno Hidrolisado', 'Colágeno Tipo II',
      'Ômega 3 EPA/DHA 33/22', 'Coenzima Q10 100%', 'Curcumina 95%', 'Resveratrol 98%',
      'Quercetina 95%', 'Ashwagandha 5% Withanolides', 'Rhodiola Rosea 3%', 'Ginkgo Biloba 24%',
      'Cordyceps Sinensis', 'Reishi (Ganoderma)', 'Spirulina em Pó', 'Chlorella',
      'Maca Peruana', 'Tribulus Terrestris 40%', 'Saw Palmetto 25%', 'Cafeína Anidra',
      'Inositol', 'NAC (N-Acetilcisteína)', 'Alfa Lipoico (ALA)', 'PQQ Dissódico',
    ];
    const capsulas = [
      { d: 'Cápsula Gelatina 00 Branca', un: 'MIL' },
      { d: 'Cápsula Gelatina 0 Branca', un: 'MIL' },
      { d: 'Cápsula Gelatina 1 Branca', un: 'MIL' },
      { d: 'Cápsula Vegetal 00 Transparente', un: 'MIL' },
      { d: 'Cápsula Vegetal 0 Verde', un: 'MIL' },
    ];
    const embalagens = [
      { d: 'Pote PET 60 Cápsulas Branco', un: 'UN' },
      { d: 'Pote PET 120 Cápsulas Branco', un: 'UN' },
      { d: 'Pote PET 250 ml Âmbar', un: 'UN' },
      { d: 'Tampa Rosca 38mm Lacre', un: 'UN' },
      { d: 'Rótulo Adesivo Personalizado', un: 'UN' },
      { d: 'Cartucho 60 cápsulas', un: 'UN' },
      { d: 'Selo Holográfico', un: 'UN' },
      { d: 'Sache Sílica 1g', un: 'UN' },
    ];
    const produtosAcabados = [
      'Multivitamínico Premium 60 caps', 'Whey Protein Isolado Baunilha 900g',
      'Magnésio Dimalato 120 caps', 'Vitamina D3 10.000 UI 60 caps',
      'Ômega 3 Concentrado 60 caps', 'Creatina Pura 300g',
      'Colágeno + Vitamina C 30 doses', 'BCAA Power 120 caps',
      'Coenzima Q10 60 caps', 'Vitamina C Lipossomal 60 caps',
      'Curcumina + Piperina 60 caps', 'Ashwagandha KSM-66 60 caps',
    ];

    const itens: any[] = [];
    mpNames.forEach((nome, i) => {
      itens.push({
        id: uid(1000 + i, 'it'),
        company_id: c,
        tipo_item: 'MP',
        descricao_interna: nome,
        sku_interno: `MP-${String(i + 1).padStart(4, '0')}`,
        unidade_interna: 'g',
        ativo: true,
      });
    });
    capsulas.forEach((it, i) => {
      itens.push({
        id: uid(2000 + i, 'it'),
        company_id: c,
        tipo_item: 'CAPSULA_VAZIA',
        descricao_interna: it.d,
        sku_interno: `CAP-${String(i + 1).padStart(3, '0')}`,
        unidade_interna: it.un,
        ativo: true,
      });
    });
    embalagens.forEach((it, i) => {
      itens.push({
        id: uid(3000 + i, 'it'),
        company_id: c,
        tipo_item: 'EMBALAGEM',
        descricao_interna: it.d,
        sku_interno: `EMB-${String(i + 1).padStart(3, '0')}`,
        unidade_interna: it.un,
        ativo: true,
      });
    });
    produtosAcabados.forEach((d, i) => {
      itens.push({
        id: uid(4000 + i, 'it'),
        company_id: c,
        tipo_item: 'PA',
        descricao_interna: d,
        sku_interno: `PA-${String(i + 1).padStart(4, '0')}`,
        unidade_interna: 'UN',
        ativo: true,
      });
    });
    const { error: itErr } = await supabase.from('itens').insert(itens);
    if (itErr) log.push(`IT err: ${itErr.message}`); else log.push(`IT: ${itens.length}`);

    const mpItens = itens.filter((x) => x.tipo_item === 'MP');
    const paItens = itens.filter((x) => x.tipo_item === 'PA');

    // ───────────────── 5. Estoque Lotes ─────────────────
    const lotes: any[] = [];
    itens.slice(0, 80).forEach((it, i) => {
      const status = i < 65 ? 'DISPONIVEL' : i < 75 ? 'QUARENTENA' : 'DISPONIVEL';
      const isExpiring = i >= 75; // last 5 are expiring soon
      const qtd = it.tipo_item === 'MP' ? 5000 + i * 100 : it.unidade_interna === 'MIL' ? 50 : 1000;
      lotes.push({
        id: uid(5000 + i, 'lt'),
        company_id: c,
        item_id: it.id,
        numero_lote: `L${String(2026000 + i).padStart(7, '0')}`,
        quantidade_original: qtd,
        unidade_original: it.unidade_interna,
        unidade_interna: it.unidade_interna,
        quantidade_interna: qtd,
        custo_unitario_interno: 0.15 + (i % 50) * 0.8,
        status,
        data_fab: addDays(-90 - i),
        data_val: isExpiring ? addDays(15 + i % 20) : addDays(365 + i * 10),
        fornecedor_id: pick(fornecedoresIds, i),
        observacoes_qc: status === 'QUARENTENA' ? 'Aguardando análise de COA' : null,
      });
    });
    const { error: ltErr } = await supabase.from('estoque_lotes').insert(lotes);
    if (ltErr) log.push(`LT err: ${ltErr.message}`); else log.push(`LT: ${lotes.length}`);

    // ───────────────── 6. Item Fornecedores ─────────────────
    const itemForn: any[] = [];
    itens.slice(0, 60).forEach((it, i) => {
      itemForn.push({
        item_id: it.id,
        fornecedor_id: pick(fornecedoresIds, i),
        company_id: c,
        sku_fornecedor: `FRN-${i}`,
        descricao_fornecedor: it.descricao_interna,
        preco_unitario: 10 + i * 2.5,
      });
    });
    await supabase.from('item_fornecedores').insert(itemForn);

    // ───────────────── 7. Fórmulas ─────────────────
    const formulas: any[] = [];
    const formItens: any[] = [];
    const formulaModelos = [
      { nome: 'Multivitamínico Premium', ingred: [['Vitamina C (Ácido Ascórbico)', 500], ['Vitamina D3 100.000 UI/g', 0.5], ['Vitamina B12 Cianocobalamina', 0.1], ['Magnésio Dimalato', 200], ['Zinco Bisglicinato 20%', 50]] },
      { nome: 'Magnésio Dimalato 500mg', ingred: [['Magnésio Dimalato', 500]] },
      { nome: 'Vitamina D3 10.000 UI', ingred: [['Vitamina D3 100.000 UI/g', 0.1]] },
      { nome: 'Coenzima Q10 100mg', ingred: [['Coenzima Q10 100%', 100]] },
      { nome: 'Ashwagandha KSM-66', ingred: [['Ashwagandha 5% Withanolides', 600]] },
      { nome: 'Curcumina + Piperina', ingred: [['Curcumina 95%', 500], ['NAC (N-Acetilcisteína)', 50]] },
      { nome: 'Stack Pré-Treino', ingred: [['Cafeína Anidra', 200], ['Beta Alanina', 2000], ['L-Arginina HCl', 1500], ['Taurina', 1000]] },
      { nome: 'Sono & Relaxamento', ingred: [['L-Teanina', 200], ['Magnésio Glicinato', 300], ['Vitamina B6 Cloridrato', 25]] },
      { nome: 'Pacote Imunidade', ingred: [['Vitamina C (Ácido Ascórbico)', 1000], ['Vitamina D3 100.000 UI/g', 0.2], ['Zinco Bisglicinato 20%', 75], ['Selênio Selenometionina 0.5%', 40]] },
      { nome: 'BCAA 2:1:1 5g', ingred: [['L-Leucina', 2500], ['BCAA 2:1:1', 2500]] },
      { nome: 'Colágeno + Vit C', ingred: [['Colágeno Hidrolisado', 10000], ['Vitamina C (Ácido Ascórbico)', 90]] },
      { nome: 'Energia & Foco', ingred: [['Cafeína Anidra', 100], ['L-Teanina', 200], ['Rhodiola Rosea 3%', 300]] },
    ];
    formulaModelos.forEach((m, i) => {
      const fid = uid(6000 + i, 'fm');
      formulas.push({
        id: fid,
        company_id: c,
        codigo_formula: `FORM-${String(i + 1).padStart(4, '0')}`,
        nome_formula: m.nome,
        tipo_apresentacao: 'CAPSULA',
        status: 'ATIVA',
        responsavel_tecnico_id: pick(rtRows.map((r) => r.id), i),
      });
      m.ingred.forEach((ing, j) => {
        const matchedItem = mpItens.find((it) => it.descricao_interna === ing[0]);
        formItens.push({
          formula_id: fid,
          item_id: matchedItem?.id || null,
          nome_insumo: ing[0],
          quantidade_informada: ing[1],
          unidade_informada: 'mg',
          quantidade_convertida_mg: ing[1],
          ordem: j + 1,
        });
      });
    });
    await supabase.from('formulas').insert(formulas);
    await supabase.from('formula_itens').insert(formItens);
    log.push(`Formulas: ${formulas.length}`);

    // ───────────────── 8. Notas de Entrada + Contas a Pagar ─────────────────
    const notasEntrada: any[] = [];
    const notasEntradaItens: any[] = [];
    const contasPagar: any[] = [];
    for (let i = 0; i < 25; i++) {
      const nid = uid(7000 + i, 'ne');
      const forn = pick(fornecedoresIds, i);
      const valor = 5000 + i * 1200;
      notasEntrada.push({
        id: nid,
        company_id: c,
        chave_nfe: `35260${String(i).padStart(38, '0')}`.slice(0, 44),
        numero: String(10000 + i),
        serie: '1',
        emitente_id: forn,
        data_emissao: addDays(-60 + i * 2),
        data_entrada: addDays(-60 + i * 2 + 1),
        valor_total: valor,
        status: 'PROCESSADA',
      });
      notasEntradaItens.push({
        nota_entrada_id: nid,
        item_id: pick(mpItens, i).id,
        descricao: pick(mpItens, i).descricao_interna,
        quantidade: 10 + i,
        valor_unitario: valor / (10 + i),
        valor_total: valor,
      });
      contasPagar.push({
        company_id: c,
        descricao: `NF ${10000 + i} — ${pick(fornecedoresNomes, i)}`,
        valor,
        valor_pago: i < 15 ? valor : 0,
        data_emissao: addDays(-60 + i * 2),
        data_vencimento: addDays(-30 + i * 2),
        data_pagamento: i < 15 ? addDays(-25 + i * 2) : null,
        status: i < 15 ? 'PAGO' : 'PENDENTE',
        entidade_id: forn,
        nota_entrada_id: nid,
      });
    }
    await supabase.from('notas_entrada').insert(notasEntrada);
    await supabase.from('notas_entrada_itens').insert(notasEntradaItens);
    await supabase.from('contas_pagar').insert(contasPagar);
    log.push(`NFe entrada: ${notasEntrada.length} | Contas pagar: ${contasPagar.length}`);

    // ───────────────── 9. Vendedores Externos ─────────────────
    const vendedores: any[] = [];
    ['Carlos Mendes', 'Patrícia Souza', 'Bruno Lima', 'Fernanda Castro', 'André Oliveira'].forEach((n, i) => {
      vendedores.push({
        id: uid(8000 + i, 'vd'),
        company_id: c,
        nome: n,
        email: `${n.toLowerCase().replace(/ /g, '.')}@brainxdemo.com`,
        telefone: `(11) 9${String(80000000 + i * 1111).padStart(8, '0')}`,
        comissao_padrao: 5 + i,
        ativo: true,
      });
    });
    await supabase.from('vendedores_externos').insert(vendedores);

    // ───────────────── 10. Pedidos de Venda + Contas a Receber ─────────────────
    const pedidos: any[] = [];
    const pedidoItens: any[] = [];
    const contasReceber: any[] = [];
    for (let i = 0; i < 40; i++) {
      const pid = uid(9000 + i, 'pd');
      const cli = pick(clientesIds, i);
      const cliNome = pick(empresasNomes, i);
      const valor = 800 + i * 250;
      const status = pick(['RASCUNHO', 'APROVADO', 'EM_PRODUCAO', 'FATURADO', 'ENTREGUE'], i);
      pedidos.push({
        id: pid,
        company_id: c,
        codigo: `PED-2026-${String(i + 1).padStart(4, '0')}`,
        cliente_id: cli,
        cliente_nome: cliNome,
        valor_total: valor,
        status,
        data_emissao: addDays(-90 + i * 2),
        data_entrega_estimada: addDays(-90 + i * 2 + 10),
        vendedor_id: pick(vendedores.map((v) => v.id), i),
      });
      const pa = pick(paItens, i);
      pedidoItens.push({
        pedido_id: pid,
        item_id: pa.id,
        produto_nome: pa.descricao_interna,
        quantidade: 5 + (i % 20),
        valor_unitario: valor / (5 + (i % 20)),
        valor_total: valor,
      });
      contasReceber.push({
        company_id: c,
        descricao: `Pedido ${`PED-2026-${String(i + 1).padStart(4, '0')}`} — ${cliNome}`,
        valor,
        valor_recebido: i < 25 ? valor : 0,
        data_emissao: addDays(-90 + i * 2),
        data_vencimento: addDays(-60 + i * 2),
        data_recebimento: i < 25 ? addDays(-55 + i * 2) : null,
        status: i < 25 ? 'RECEBIDO' : 'PENDENTE',
        entidade_id: cli,
        pedido_venda_id: pid,
      });
    }
    await supabase.from('pedidos_venda').insert(pedidos);
    await supabase.from('pedido_itens').insert(pedidoItens);
    await supabase.from('contas_receber').insert(contasReceber);
    log.push(`Pedidos: ${pedidos.length} | Contas receber: ${contasReceber.length}`);

    return new Response(
      JSON.stringify({ success: true, company_id: c, log }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    log.push(`FATAL: ${String(err)}`);
    console.error('seed-demo-data error', err);
    return new Response(JSON.stringify({ error: String(err), log }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});