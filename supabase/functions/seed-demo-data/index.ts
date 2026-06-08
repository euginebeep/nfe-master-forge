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

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

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
      'lotes_produto_acabado',
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
      'vendedores_externos', 'responsaveis_tecnicos', 'equipamentos',
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
    const transportadorasIds = entidades.slice(50, 60).map((e) => e.id);

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

    // ───────────────── 10. Pedidos de Venda (incluindo fila de expedição) ─────────────────
    const pedidos: any[] = [];
    const pedidoItens: any[] = [];
    const contasReceber: any[] = [];
    const romaneioItems: any[] = [];

    for (let i = 0; i < 45; i++) {
      const pid = uid(9000 + i, 'pd');
      const cli = pick(clientesIds, i);
      const cliNome = pick(empresasNomes, i);
      const valor = 800 + i * 250;
      
      // Status variados para cobrir todas as telas:
      // 0-5: PRONTO (na fila de expedição)
      // 6-10: SEPARACAO (com romaneio gerado)
      // 11-15: DESPACHADO (em trânsito)
      // Resto: ENTREGUE, CANCELADO, RASCUNHO
      let status = 'ENTREGUE';
      if (i <= 5) status = 'PRONTO';
      else if (i <= 10) status = 'SEPARACAO';
      else if (i <= 15) status = 'DESPACHADO';
      else if (i === 16) status = 'RASCUNHO';
      else if (i === 17) status = 'CANCELADO';

      pedidos.push({
        id: pid,
        company_id: c,
        numero: String(3000 + i),
        codigo: `PED-2026-${String(i + 1).padStart(4, '0')}`,
        cliente_id: cli,
        cliente_nome: cliNome,
        valor_total: valor,
        status,
        data_emissao: addDays(-90 + i * 2),
        data_entrega_estimada: addDays(-90 + i * 2 + 10),
        data_despacho: status === 'DESPACHADO' || status === 'ENTREGUE' ? addDays(-90 + i * 2 + 5) : null,
        data_entrega_confirmada: status === 'ENTREGUE' ? addDays(-90 + i * 2 + 8) : null,
        vendedor_id: pick(vendedores.map((v) => v.id), i),
        transportadora_id: status === 'DESPACHADO' || status === 'ENTREGUE' ? transportadorasIds[i % transportadorasIds.length] : null,
        volumes: status === 'DESPACHADO' || status === 'ENTREGUE' ? 2 : null,
        nfe_numero: status === 'DESPACHADO' || status === 'ENTREGUE' ? String(5000 + i) : null,
        nfe_chave: status === 'DESPACHADO' || status === 'ENTREGUE' ? `35260${String(i).padStart(38, '0')}` : null,
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

      // Se estiver em SEPARACAO ou além, gerar romaneio
      if (status === 'SEPARACAO' || status === 'DESPACHADO' || status === 'ENTREGUE') {
        romaneioItems.push({
          company_id: c,
          pedido_id: pid,
          item_id: pa.id,
          produto_nome: pa.descricao_interna,
          quantidade: 5 + (i % 20),
          conferido: true,
          conferido_em: addDays(-90 + i * 2 + 4),
        });
      }

      contasReceber.push({
        company_id: c,
        descricao: `Pedido ${`PED-2026-${String(i + 1).padStart(4, '0')}`} — ${cliNome}`,
        valor,
        valor_recebido: status === 'ENTREGUE' ? valor : 0,
        data_emissao: addDays(-90 + i * 2),
        data_vencimento: addDays(-60 + i * 2),
        data_recebimento: status === 'ENTREGUE' ? addDays(-55 + i * 2) : null,
        status: status === 'ENTREGUE' ? 'RECEBIDO' : 'PENDENTE',
        entidade_id: cli,
        pedido_venda_id: pid,
      });
    }
    await supabase.from('pedidos_vendedor').insert(pedidos);
    await supabase.from('pedido_vendedor_itens').insert(pedidoItens);
    await supabase.from('contas_receber').insert(contasReceber);
    if (romaneioItems.length > 0) {
      await supabase.from('expedicao_romaneio').insert(romaneioItems);
    }
    log.push(`Pedidos: ${pedidos.length} | Contas receber: ${contasReceber.length} | Romaneios: ${romaneioItems.length}`);

    // ───────────────── 11. Equipamentos (Misturador V) ─────────────────
    const equipamentos = [
      { id: uid(10000, 'eq'), company_id: c, nome: 'Misturador V-01 (50 L)', tipo: 'MISTURADOR_V',
        volume_nominal_litros: 50, capacidade_padrao_kg: 20, capacidade_minima_kg: 10, capacidade_maxima_kg: 25,
        capacidade_maxima_com_aprovacao_kg: 30, fator_enchimento_padrao: 0.60, fator_enchimento_minimo: 0.50,
        fator_enchimento_maximo: 0.70, densidade_padrao_kg_l: 0.65, ativo: true },
      { id: uid(10001, 'eq'), company_id: c, nome: 'Misturador V-02 (100 L)', tipo: 'MISTURADOR_V',
        volume_nominal_litros: 100, capacidade_padrao_kg: 40, capacidade_minima_kg: 20, capacidade_maxima_kg: 50,
        capacidade_maxima_com_aprovacao_kg: 60, fator_enchimento_padrao: 0.60, fator_enchimento_minimo: 0.50,
        fator_enchimento_maximo: 0.70, densidade_padrao_kg_l: 0.65, ativo: true },
      { id: uid(10002, 'eq'), company_id: c, nome: 'Misturador V-03 (200 L)', tipo: 'MISTURADOR_V',
        volume_nominal_litros: 200, capacidade_padrao_kg: 80, capacidade_minima_kg: 40, capacidade_maxima_kg: 100,
        capacidade_maxima_com_aprovacao_kg: 120, fator_enchimento_padrao: 0.60, fator_enchimento_minimo: 0.50,
        fator_enchimento_maximo: 0.70, densidade_padrao_kg_l: 0.65, ativo: true },
    ];
    const { error: eqErr } = await supabase.from('equipamentos').insert(equipamentos);
    if (eqErr) log.push(`EQ err: ${eqErr.message}`); else log.push(`EQ: ${equipamentos.length}`);

    // ───────────────── 12. Conversões UI/mcg → mg (ativos críticos) ─────────────────
    const conversoesData = [
      { substancia: 'Vitamina D3', fator_ui_para_mg: 0.000025, conversao_ui_mcg: 0.025, classificacao_risco: 'ULTRA_CRITICO', fonte_tecnica: 'USP/FCC: 1 UI = 0,025 µg colecalciferol' },
      { substancia: 'Vitamina A Palmitato', fator_ui_para_mg: 0.0003, conversao_ui_mcg: 0.3, classificacao_risco: 'ULTRA_CRITICO', fonte_tecnica: 'USP: 1 UI = 0,3 µg retinol' },
      { substancia: 'Vitamina E Acetato', fator_ui_para_mg: 0.67, conversao_ui_mcg: 670, classificacao_risco: 'CRITICO', fonte_tecnica: 'USP: 1 UI = 0,67 mg d-α-tocoferol' },
      { substancia: 'Vitamina B12 Cianocobalamina', fator_ui_para_mg: 0.001, conversao_ui_mcg: 1.0, classificacao_risco: 'ULTRA_CRITICO', fonte_tecnica: 'Conversão padrão µg' },
      { substancia: 'Biotina', fator_ui_para_mg: 0.001, conversao_ui_mcg: 1.0, classificacao_risco: 'ULTRA_CRITICO', fonte_tecnica: 'Conversão padrão µg' },
      { substancia: 'Vitamina K2 MK-7', fator_ui_para_mg: 0.001, conversao_ui_mcg: 1.0, classificacao_risco: 'ULTRA_CRITICO', fonte_tecnica: 'Conversão padrão µg' },
    ];
    // upsert por chave substancia (única)
    for (const cv of conversoesData) {
      await supabase.from('conversoes_unidades').upsert(cv, { onConflict: 'substancia' });
    }
    log.push(`Conversões: ${conversoesData.length}`);

    // ───────────────── 13. Ordens de Produção Industrial (com OP completa) ─────────────────
    // 6 OPs: 2 concluídas/assinadas, 2 em produção, 1 WHITE_LABEL sem cliente, 1 WHITE_LABEL já atribuída
    const opsConfig = [
      { i: 0, status: 'CONCLUIDA',  etapa: 'FINALIZADA',     pa: 0,  cliente: 0,  whiteLabel: false, attribuido: false, eq: 1, batch: 18 },
      { i: 1, status: 'CONCLUIDA',  etapa: 'FINALIZADA',     pa: 2,  cliente: 3,  whiteLabel: false, attribuido: false, eq: 0, batch: 12 },
      { i: 2, status: 'EM_PRODUCAO', etapa: 'PESAGEM',       pa: 4,  cliente: 7,  whiteLabel: false, attribuido: false, eq: 1, batch: 20 },
      { i: 3, status: 'EM_PRODUCAO', etapa: 'MISTURA',       pa: 6,  cliente: 11, whiteLabel: false, attribuido: false, eq: 2, batch: 45 },
      { i: 4, status: 'PLANEJADA',   etapa: 'SEPARACAO_MP',  pa: 8,  cliente: -1, whiteLabel: true,  attribuido: false, eq: 1, batch: 25 },
      { i: 5, status: 'CONCLUIDA',   etapa: 'FINALIZADA',    pa: 10, cliente: -1, whiteLabel: true,  attribuido: true,  eq: 1, batch: 22 },
    ];

    const ops: any[] = [];
    const opMPs: any[] = [];
    const opEmbs: any[] = [];
    const opPesagens: any[] = [];
    const opAssinaturas: any[] = [];
    const lotesPA: any[] = [];

    for (const cfg of opsConfig) {
      const opId = uid(11000 + cfg.i, 'op');
      const pa = paItens[cfg.pa];
      const formula = formulas[cfg.pa % formulas.length];
      const loteNumero = `LPA-2026${String(cfg.i + 1).padStart(4, '0')}`;
      const qrToken = uid(11100 + cfg.i, 'qr');
      const qrHash = await sha256(`${opId}:${loteNumero}:LOVABLE_OP_MASTER_SECRET_2026`);
      const rt = rtRows[cfg.i % rtRows.length];
      const equip = equipamentos[cfg.eq];
      const isFinal = cfg.status === 'CONCLUIDA';

      ops.push({
        id: opId, company_id: c,
        codigo: `OP-2026-${String(cfg.i + 1).padStart(4, '0')}`,
        produto_id: pa.id, produto_nome: pa.descricao_interna,
        formula_id: formula.id, formula_codigo: formula.codigo_formula, formula_versao: 1,
        quantidade_frascos: 100 + cfg.i * 50,
        capsulas_por_frasco: 60,
        total_capsulas: (100 + cfg.i * 50) * 60,
        acrescimo_percentual: 5,
        total_capsulas_com_acrescimo: Math.round((100 + cfg.i * 50) * 60 * 1.05),
        lote_produto_acabado: loteNumero,
        data_fabricacao: addDays(-30 + cfg.i * 5),
        data_validade: addDays(720 + cfg.i * 10),
        tipo_apresentacao: 'CAPSULA',
        peso_capsula_mg: 500,
        tipo_capsula: '00',
        excipiente_base: 'AMIDO',
        status: cfg.status,
        etapa_producao_atual: cfg.etapa,
        etapa_atualizada_em: new Date().toISOString(),
        responsavel_tecnico_id: rt.id,
        rt_nome: rt.nome_completo,
        rt_tipo_conselho: rt.tipo_conselho,
        rt_numero_registro: rt.numero_registro,
        rt_uf_conselho: rt.uf_conselho,
        rt_vinculado_em: new Date().toISOString(),
        qr_code_token: qrToken,
        qr_code_hash: qrHash,
        qr_code_lote: loteNumero,
        cliente_id: cfg.cliente >= 0 ? clientesIds[cfg.cliente] : null,
        cliente_nome: cfg.cliente >= 0 ? empresasNomes[cfg.cliente] : null,
        white_label: cfg.whiteLabel,
        marca_cliente: cfg.attribuido ? 'BioVitta Premium' : null,
        turno: pick(['MANHÃ', 'TARDE', 'NOITE'], cfg.i),
        linha_producao: `Linha ${(cfg.i % 3) + 1}`,
        cor_capsula: 'BRANCA',
        cor_tampa: 'BRANCA',
        tipo_pote: 'PET 60 caps',
        tipo_tampa: 'Rosca 38mm',
        incluir_silica: true,
        quantidade_silica_sache: '1g',
        peso_total_mistura_kg: cfg.batch,
        numero_bateladas: 1,
        peso_por_batelada_kg: cfg.batch,
        equipamento_id: equip.id,
        data_inicio_producao: cfg.status !== 'PLANEJADA' ? addDays(-20 + cfg.i * 3) : null,
        data_fim_producao: isFinal ? addDays(-15 + cfg.i * 3) : null,
      });

      // Matérias-primas da OP (3 a 5 itens, 1 ultra-crítico)
      const formItensOP = formItens.filter((f: any) => f.formula_id === formula.id);
      formItensOP.forEach((fi: any, idx: number) => {
        const mpId = uid(12000 + cfg.i * 100 + idx, 'mp');
        const isCritico = idx === 0 && /Vitamina (D3|B12|A|K2)|Biotina/i.test(fi.nome_insumo);
        const qtdMg = Number(fi.quantidade_convertida_mg || fi.quantidade_informada || 100) * (100 + cfg.i * 50);
        const qtdG = qtdMg / 1000;
        const fornId = pick(fornecedoresIds, idx);
        const fornNome = pick(fornecedoresNomes, idx);
        const loteRM = lotes.find((l) => l.item_id === fi.item_id);
        opMPs.push({
          id: mpId, op_id: opId,
          insumo_id: fi.item_id, insumo_nome: fi.nome_insumo,
          categoria: 'ATIVO',
          lote_id: loteRM?.id || null,
          numero_lote: loteRM?.numero_lote || null,
          fornecedor_id: fornId, fornecedor_nome: fornNome,
          quantidade_teorica_mg: qtdMg,
          quantidade_teorica_g: qtdG,
          quantidade_real_g: isFinal ? qtdG * 1.002 : null,
          unidade: 'g',
          pesagem_critica: isCritico,
          motivo_critico: isCritico ? 'Ativo ultra-crítico <1mg/dose — exige pré-mix e dupla conferência' : null,
          tolerancia_percentual: isCritico ? 2 : 10,
          ordem_mistura: idx + 1,
          dentro_tolerancia: isFinal ? true : null,
          pesado_em: isFinal ? new Date().toISOString() : null,
          conferido_em: isFinal ? new Date().toISOString() : null,
        });

        // Pesagem crítica registrada
        if (isCritico) {
          opPesagens.push({
            op_id: opId, materia_prima_id: mpId,
            insumo_nome: fi.nome_insumo,
            quantidade_teorica_mg: qtdMg,
            quantidade_pesada_mg: isFinal ? qtdMg * 1.001 : null,
            operador_pesagem_nome: 'Operador Demo João',
            assinatura_operador: isFinal ? `OP-SIGN-${cfg.i}` : null,
            data_pesagem: isFinal ? new Date().toISOString() : null,
            conferente_nome: 'Conferente Demo Maria',
            assinatura_conferente: isFinal ? `CF-SIGN-${cfg.i}` : null,
            data_conferencia: isFinal ? new Date().toISOString() : null,
            status: isFinal ? 'CONFERIDO' : 'PENDENTE',
            observacoes: 'Pré-mix 1:100 com excipiente — distribuição geométrica',
          });
        }
      });

      // Embalagens da OP
      const potePA = itens.find((it) => it.tipo_item === 'EMBALAGEM' && it.descricao_interna.startsWith('Pote'));
      const tampa = itens.find((it) => it.tipo_item === 'EMBALAGEM' && it.descricao_interna.startsWith('Tampa'));
      const capsula = itens.find((it) => it.tipo_item === 'CAPSULA_VAZIA');
      if (potePA && tampa && capsula) {
        const qtdF = 100 + cfg.i * 50;
        opEmbs.push(
          { op_id: opId, tipo_embalagem: 'POTE', insumo_id: potePA.id, insumo_nome: potePA.descricao_interna, quantidade_planejada: qtdF, status: isFinal ? 'BAIXADO' : 'PENDENTE' },
          { op_id: opId, tipo_embalagem: 'TAMPA', insumo_id: tampa.id, insumo_nome: tampa.descricao_interna, quantidade_planejada: qtdF, status: isFinal ? 'BAIXADO' : 'PENDENTE' },
        );
      }

      // Assinatura RT (apenas OPs concluídas)
      if (isFinal) {
        const assId = uid(13000 + cfg.i, 'as');
        const hashOp = await sha256(`${opId}|${rt.id}|${loteNumero}|${new Date().toISOString().slice(0, 10)}`);
        opAssinaturas.push({
          id: assId, op_id: opId,
          responsavel_tecnico_id: rt.id,
          rt_nome: rt.nome_completo, rt_cpf: rt.cpf,
          rt_tipo_conselho: rt.tipo_conselho,
          rt_numero_registro: rt.numero_registro,
          rt_uf_conselho: rt.uf_conselho,
          ip_address: '192.168.1.10', user_agent: 'Demo Browser',
          hash_op: hashOp,
          declaracao_aceita: true,
        });
        // Atualizar OP com assinatura
        ops[ops.length - 1].assinatura_rt_id = assId;
        ops[ops.length - 1].assinatura_rt_hash = hashOp;
        ops[ops.length - 1].rt_assinatura_timestamp = new Date().toISOString();

        // Lote de produto acabado (apenas OPs concluídas geram lote PA)
        const codAud = `AUD-${opId.slice(-12).toUpperCase()}`;
        const loteHash = await sha256(`${loteNumero}:${opId}:LOVABLE_LOTE`);
        lotesPA.push({
          id: uid(14000 + cfg.i, 'lp'), op_id: opId,
          numero_lote: loteNumero, codigo_auditoria: codAud,
          qr_code_hash: loteHash,
          produto_id: pa.id, produto_nome: pa.descricao_interna,
          data_fabricacao: addDays(-15 + cfg.i * 3),
          data_validade: addDays(720 + cfg.i * 10),
          quantidade_produzida: 100 + cfg.i * 50,
          quantidade_aprovada: 100 + cfg.i * 50,
          quantidade_rejeitada: 0,
          status: 'APROVADO',
          responsavel_tecnico_id: rt.id,
          rt_nome: rt.nome_completo,
          rt_tipo_conselho: rt.tipo_conselho,
          rt_numero_registro: rt.numero_registro,
          rt_uf_conselho: rt.uf_conselho,
          assinatura_liberacao_id: assId,
          liberado_em: new Date().toISOString(),
          white_label: cfg.whiteLabel,
          white_label_cliente_id: cfg.attribuido ? clientesIds[5] : null,
          marca_cliente: cfg.attribuido ? 'BioVitta Premium' : null,
          white_label_atribuido_em: cfg.attribuido ? new Date().toISOString() : null,
        });
      }
    }

    const { error: opErr } = await supabase.from('ordens_producao_industrial').insert(ops);
    if (opErr) log.push(`OP err: ${opErr.message}`); else log.push(`OP: ${ops.length}`);
    await supabase.from('op_materias_primas').insert(opMPs);
    await supabase.from('op_embalagens').insert(opEmbs);
    const { error: assErr } = await supabase.from('op_assinaturas_rt').insert(opAssinaturas);
    if (assErr) log.push(`AssRT err: ${assErr.message}`); else log.push(`Assinaturas RT: ${opAssinaturas.length}`);

    // Checklist Simulado para as OPs
    const checklists: any[] = [];
    for (const op of ops) {
      const categorias = ['PRE_PRODUCAO', 'DURANTE_PRODUCAO', 'POS_PRODUCAO', 'QC'];
      categorias.forEach((cat, idx) => {
        checklists.push({
          op_id: op.id,
          company_id: c,
          categoria: cat,
          descricao: `Verificação de ${cat.toLowerCase().replace('_', ' ')} concluída conforme POP`,
          verificado: op.status === 'CONCLUIDA',
          verificado_em: op.status === 'CONCLUIDA' ? addDays(-10) : null,
          responsavel_nome: op.status === 'CONCLUIDA' ? 'Operador Demo' : null,
        });
      });
    }
    await supabase.from('op_checklist').insert(checklists);

    // Após inserir assinaturas, atualizar refs nas OPs
    for (const op of ops.filter((o) => o.assinatura_rt_id)) {
      await supabase.from('ordens_producao_industrial').update({
        assinatura_rt_id: op.assinatura_rt_id,
        assinatura_rt_hash: op.assinatura_rt_hash,
        rt_assinatura_timestamp: op.rt_assinatura_timestamp,
      }).eq('id', op.id);
    }
    await supabase.from('op_pesagens_criticas').insert(opPesagens);
    log.push(`OP MPs: ${opMPs.length} | Embalagens: ${opEmbs.length} | Pesagens críticas: ${opPesagens.length} | Checklist: ${checklists.length}`);

    const { error: lpErr } = await supabase.from('lotes_produto_acabado').insert(lotesPA);
    if (lpErr) log.push(`LotePA err: ${lpErr.message}`); else log.push(`Lotes PA: ${lotesPA.length} (white_label: ${lotesPA.filter((l) => l.white_label).length})`);

    // ───────────────── 14. QC Analises (Qualidade) ─────────────────
    const qcAnalises = [];
    for (let i = 0; i < 20; i++) {
      const lote = lotes[i % lotes.length];
      qcAnalises.push({
        company_id: c,
        lote_id: lote.id,
        tipo_analise: i % 2 === 0 ? 'FISICO_QUIMICO' : 'MICROBIOLOGICO',
        parametro: i % 2 === 0 ? 'Teor de Ativo' : 'Contagem Total',
        resultado_encontrado: i % 2 === 0 ? '99.8%' : '<10 UFC/g',
        status: 'APROVADO',
        data_analise: addDays(-20),
        responsavel: 'Analista Demo Camila',
      });
    }
    await supabase.from('qc_analises').insert(qcAnalises);
    log.push(`QC Analises: ${qcAnalises.length}`);

    // ───────────────── 15. Inteligência Industrial (Dashboard Executivo) ─────────────────
    const hojeKpi = new Date().toISOString().split('T')[0];
    const kpisExec = {
      company_id: c,
      data_referencia: hojeKpi,
      ops_finalizadas: 12,
      ops_bloqueadas: 1,
      rendimento_medio_percent: 97.5,
      custo_medio_unitario: 12.40,
      taxa_aprovacao_qc: 99.2,
      total_anomalias: 4,
      anomalias_criticas: 0,
      fornecedores_risco: 2,
      nao_conformidades: 1,
      margem_media_percent: 28.5,
      custo_total_producao: 45000,
    };
    await supabase.from('kpis_executivos').upsert(kpisExec, { onConflict: 'data_referencia' });

    const alertasExec = [
      { company_id: c, tipo_alerta: 'ESTOQUE_CRITICO', nivel: 'ALTO', titulo: 'Insumo Crítico: Magnésio', descricao: 'Estoque abaixo do ponto de reposição (5 dias restantes).', acao_sugerida: 'Acionar fornecedor Vitalfarma', status: 'ATIVO' },
      { company_id: c, tipo_alerta: 'VENCIMENTO_PROXIMO', nivel: 'MEDIO', titulo: 'Lote Vencendo: Vitamina C', descricao: 'Lote L2026075 vence em 28 dias.', acao_sugerida: 'Priorizar na próxima OP', status: 'ATIVO' },
    ];
    await supabase.from('alertas_executivos').insert(alertasExec);

    const previsoes = [];
    paItens.slice(0, 5).forEach((pa, i) => {
      previsoes.push({
        company_id: c,
        produto_id: pa.id,
        periodo: '2026-06',
        demanda_prevista: 1200 + i * 100,
        lote_sugerido: 1500,
        ponto_reposicao: 300,
        confianca_percentual: 88,
        prioridade: i === 0 ? 'URGENTE' : 'MEDIA',
        alerta: i === 0 ? 'Ruptura de estoque prevista em 4 dias' : null,
      });
    });
    await supabase.from('previsoes_producao').insert(previsoes);

    const anomalias = [
      { company_id: c, tipo_anomalia: 'RENDIMENTO_BAIXO', descricao: 'Perda de 5% acima do padrão na mistura', valor_esperado: 100, valor_real: 95, desvio_percentual: -5, severidade: 'ALTA', status: 'PENDENTE', op_id: ops[0].id },
    ];
    await supabase.from('anomalias_operacionais').insert(anomalias);
    log.push(`Executivo: KPIs, Alertas, Previsões e Anomalias gerados`);

    // ───────────────── 16. Monitoramento Ambiental ─────────────────
    // Deletar para evitar duplicados
    await supabase.from('monitoramento_ambiental').delete().eq('company_id', c);
    const monitoramento_v2 = [];
    for (let i = 0; i < 48; i++) {
      const hora = new Date();
      hora.setHours(hora.getHours() - i);
      ['Almoxarifado MP', 'Sala de Pesagem', 'Produção Líquidos'].forEach((sala) => {
        monitoramento_v2.push({
          company_id: c,
          sensor_id: `SNSR-${sala.substring(0,3).toUpperCase()}`,
          local_nome: sala,
          temperatura: 18 + Math.random() * 4,
          umidade: 40 + Math.random() * 15,
          timestamp: hora.toISOString(),
          status: 'NORMAL',
        });
      });
    }
    await supabase.from('monitoramento_ambiental').insert(monitoramento_v2);
    log.push(`Monitoramento: ${monitoramento_v2.length} registros (48h)`);

    // ───────────────── 17. SaaS Comunicados (Avisos/Propaganda) ─────────────────
    const comunicados = [
      {
        company_id: c,
        titulo: 'Bem-vindo à Nova Era do BrainX ERP',
        mensagem: 'Explore todas as funcionalidades industriais, desde a pesagem crítica até a emissão de NF-e integrada.',
        tipo: 'INFO',
        ativo: true,
        data_publicacao: new Date().toISOString(),
        label_acao: 'Ver Novidades',
        link_acao: '/roadmap',
      },
      {
        company_id: c,
        titulo: 'Treinamento BPF Disponível',
        mensagem: 'Garanta que sua equipe esteja em conformidade com as Boas Práticas de Fabricação.',
        tipo: 'ALERTA',
        ativo: true,
        data_publicacao: new Date().toISOString(),
        label_acao: 'Acessar Curso',
        link_acao: 'https://brainxerp.com/treinamento',
      }
    ];
    await supabase.from('saas_comunicados').insert(comunicados);
    log.push(`Comunicados: ${comunicados.length}`);

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