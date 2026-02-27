import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  Rocket,
  Building2,
  Users,
  FileText,
  Package,
  Boxes,
  Factory,
  FlaskConical,
  ShoppingCart,
  DollarSign,
  BarChart3,
  Shield,
  Settings,
  Smartphone,
  HelpCircle,
  FileInput,
  ArrowRightLeft,
} from "lucide-react";

interface FAQSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  items: { q: string; a: string }[];
}

const faqSections: FAQSection[] = [
  {
    id: "primeiros-passos",
    icon: <Rocket className="h-5 w-5" />,
    title: "1. Primeiros Passos",
    items: [
      {
        q: "Como criar minha conta no ERP?",
        a: "Acesse a tela de login e clique em 'Criar conta'. Preencha seu e-mail e senha (mínimo 6 caracteres). Você receberá um e-mail de verificação — clique no link para ativar sua conta. Após confirmar, faça login normalmente.",
      },
      {
        q: "O que acontece no primeiro login?",
        a: "No primeiro acesso, você será redirecionado para a tela de Onboarding, onde deverá cadastrar os dados da sua empresa (CNPJ, Razão Social, Endereço). Este passo é obrigatório para usar o ERP.",
      },
      {
        q: "Posso usar o ERP sem cadastrar a empresa?",
        a: "Não. O cadastro da empresa é obrigatório. Sem ele, o sistema não permite o acesso aos módulos. Isso garante que todos os documentos fiscais, notas e relatórios tenham os dados corretos da empresa.",
      },
    ],
  },
  {
    id: "configuracoes-empresa",
    icon: <Building2 className="h-5 w-5" />,
    title: "2. Configurações da Empresa",
    items: [
      {
        q: "Como acessar as configurações da empresa?",
        a: "No menu lateral, clique em 'Configurações' → 'Empresa'. Lá você encontra todos os dados cadastrais, fiscais, logo e certificado digital. Apenas administradores têm acesso.",
      },
      {
        q: "O que é o Regime Tributário e como preencher?",
        a: "O Regime Tributário define como sua empresa calcula os impostos: Simples Nacional (faturamento até R$ 4,8M/ano), Lucro Presumido ou Lucro Real. Selecione o regime correto conforme orientação do seu contador. Isso afeta diretamente os cálculos fiscais das NF-e.",
      },
      {
        q: "Como fazer upload do Logo da empresa?",
        a: "Em Configurações → Empresa, há um campo para upload de logo. Aceita imagens PNG ou JPG. O logo aparecerá nos documentos impressos (Ordens de Produção, NF-e, contratos).",
      },
      {
        q: "Como configurar o Certificado Digital A1?",
        a: "Em Configurações → Empresa, na seção 'Certificado Digital': 1) Primeiro preencha a senha do certificado; 2) Clique para fazer upload do arquivo .pfx; 3) O sistema valida automaticamente se o CNPJ do certificado é igual ao da empresa; 4) Se válido, mostra a data de vencimento. IMPORTANTE: o certificado A1 tem validade de 1 ano — o sistema alerta quando faltar 30 dias para vencer.",
      },
      {
        q: "O que são CSC e Token NFC-e?",
        a: "CSC (Código de Segurança do Contribuinte) e Token são credenciais fornecidas pela SEFAZ do seu estado para emissão de NFC-e (Nota Fiscal ao Consumidor). Você obtém esses dados no portal da SEFAZ. Configure em Configurações → Empresa na seção fiscal.",
      },
      {
        q: "Qual a diferença entre Homologação e Produção?",
        a: "Homologação é o ambiente de testes da SEFAZ — as notas emitidas não têm valor fiscal. Produção é o ambiente real. Comece em Homologação para testar, e quando tudo estiver correto, mude para Produção. Essa configuração fica em Configurações → Empresa.",
      },
      {
        q: "O que é o CEP automático (ViaCEP)?",
        a: "Ao digitar o CEP no cadastro de endereço, o sistema consulta automaticamente o serviço ViaCEP e preenche logradouro, bairro, cidade e UF. Isso economiza tempo e evita erros de digitação.",
      },
    ],
  },
  {
    id: "usuarios",
    icon: <Users className="h-5 w-5" />,
    title: "3. Gestão de Usuários",
    items: [
      {
        q: "Como criar novos usuários?",
        a: "Menu lateral → Usuários. Apenas administradores podem criar novos usuários. Informe nome, e-mail e selecione o perfil (admin, gerente, supervisor, operador). Cada perfil tem permissões diferentes nos módulos.",
      },
      {
        q: "Quais são os perfis disponíveis?",
        a: "• Admin: acesso total, pode criar usuários e alterar configurações\n• Gerente: acesso ao financeiro, dashboards executivos\n• Supervisor: acesso à produção, fórmulas, ordens de produção\n• Operador: acesso básico a compras, vendas e cadastros",
      },
      {
        q: "O que é o timeout por inatividade?",
        a: "Por segurança, se o usuário ficar 2 horas sem interagir com o sistema (sem mover mouse, digitar ou rolar a tela), o logout é feito automaticamente. Isso protege dados sensíveis em computadores compartilhados.",
      },
    ],
  },
  {
    id: "xml-vs-manual",
    icon: <FileInput className="h-5 w-5" />,
    title: "4. Duas Formas de Cadastrar: XML vs Manual",
    badge: "IMPORTANTE",
    items: [
      {
        q: "Qual a diferença entre importar XML e cadastrar manualmente?",
        a: "Ao importar um XML de NF-e de entrada, o sistema cria AUTOMATICAMENTE: Fornecedor, Itens (matérias-primas), Lotes com validade, dados fiscais completos e até Contas a Pagar. É o caminho mais rápido. O cadastro manual é para quando não se tem o XML disponível.",
      },
      {
        q: "O que exatamente é extraído do XML automaticamente?",
        a: "FORNECEDOR: Razão Social, CNPJ, IE, IM, CNAE, CRT, endereço completo, telefone, e-mail.\nTRANSPORTADORA: Se houver dados de frete (CNPJ, razão, placa, ANTT).\nITENS: Descrição, NCM, CFOP, EAN/GTIN, unidade, valor unitário — para cada produto da nota.\nLOTES: Número do lote, fabricação, validade, quantidade, custo unitário.\nFISCAL: ICMS (base, alíquota, valor, CST, ST), IPI, PIS, COFINS — tudo por item.\nFINANCEIRO: Duplicatas/faturas geram Contas a Pagar automaticamente.\nNOTA: Chave de acesso (44 dígitos), série, número, natureza da operação, protocolo SEFAZ.",
      },
      {
        q: "Se eu importar o XML, preciso cadastrar o fornecedor manualmente?",
        a: "NÃO! Esse é o grande benefício. Ao importar o XML, o fornecedor é criado automaticamente com todos os dados fiscais corretos. Se o fornecedor já existir (mesmo CNPJ), o sistema apenas vincula a nota a ele sem duplicar.",
      },
      {
        q: "E as matérias-primas, preciso cadastrar uma a uma?",
        a: "NÃO, se você importar o XML! Cada item da nota fiscal é criado automaticamente como item no sistema (com NCM, EAN, unidade e valor). Se o item já existir (por EAN ou NCM+descrição), ele não duplica — apenas vincula.",
      },
      {
        q: "Os lotes também são criados automaticamente?",
        a: "SIM. Cada item da NF-e gera um lote com: número do lote, data de fabricação, data de validade, quantidade e custo unitário. Os lotes ficam disponíveis no estoque para uso em Ordens de Produção.",
      },
      {
        q: "E as Contas a Pagar?",
        a: "Se o XML contiver dados de fatura/duplicatas (campo cobr/dup), as Contas a Pagar são geradas automaticamente com valores e datas de vencimento. Caso contrário, você pode cadastrá-las manualmente.",
      },
      {
        q: "Quando devo usar o cadastro manual?",
        a: "Use o cadastro manual quando: 1) Não tem o XML disponível; 2) O fornecedor é informal e não emite NF-e; 3) Precisa cadastrar clientes (que não vêm de XML de entrada); 4) Quer adicionar informações complementares que não estão no XML (como classificação, tags, CRM).",
      },
      {
        q: "Como importar o XML?",
        a: "Menu lateral → Compras → Importar NF-e. Arraste o arquivo .xml ou clique para selecionar. O sistema mostra uma pré-visualização tipo DANFE. Confira os dados e confirme a importação. Todos os cadastros são criados automaticamente.",
      },
    ],
  },
  {
    id: "cadastros",
    icon: <Package className="h-5 w-5" />,
    title: "5. Cadastros de Entidades",
    items: [
      {
        q: "O que são Entidades no ERP?",
        a: "Entidade é qualquer pessoa ou empresa com quem você se relaciona: Fornecedor, Cliente, Transportadora, Terceirizado, Vendedor, Afiliado, Representante. Uma mesma entidade pode ter múltiplos papéis (ex: ser fornecedor E cliente).",
      },
      {
        q: "Quais abas estão disponíveis no cadastro de entidade?",
        a: "São 9 abas: Identificação (dados básicos, CNPJ/CPF), Endereços (múltiplos), Contatos (múltiplos com WhatsApp), Fiscal (IE, CNAE, contribuinte ICMS), Financeiro (limite de crédito, condição pagamento), Logística (prazo entrega, frete), Comercial/CRM (pipeline, score, comissão), Documentos (upload de contratos e certidões) e Auditoria (histórico imutável).",
      },
      {
        q: "O que é a busca automática por CNPJ?",
        a: "Ao digitar um CNPJ no cadastro de entidade, o sistema consulta a ReceitaWS e preenche automaticamente: Razão Social, Nome Fantasia, CNAE, endereço e telefone. Economiza tempo e garante dados atualizados.",
      },
      {
        q: "Posso cadastrar pessoa física e estrangeiro?",
        a: "Sim! O sistema suporta PJ (Pessoa Jurídica com CNPJ), PF (Pessoa Física com CPF) e Estrangeiro (com documento e país de origem). O formulário se adapta conforme o tipo selecionado.",
      },
    ],
  },
  {
    id: "itens",
    icon: <Package className="h-5 w-5" />,
    title: "6. Itens e Produtos",
    items: [
      {
        q: "Quais tipos de itens posso cadastrar?",
        a: "Matéria-prima, Produto Acabado, Embalagem, Rótulo, Excipiente e outros. Cada tipo tem campos específicos. Lembre-se: se importar XML, os itens são criados automaticamente.",
      },
      {
        q: "O que é SKU e por que é importante?",
        a: "SKU (Stock Keeping Unit) é o código único do item no seu sistema. Nunca pode haver dois itens com o mesmo SKU. É usado para rastreabilidade, pesquisa rápida e integração entre módulos.",
      },
      {
        q: "O que são NCM, CFOP e EAN?",
        a: "NCM: classificação fiscal do produto (8 dígitos) — define os impostos aplicáveis. CFOP: código da operação fiscal (4 dígitos) — define se é venda, compra, devolução, etc. EAN/GTIN: código de barras do produto. Todos são preenchidos automaticamente via XML.",
      },
    ],
  },
  {
    id: "estoque",
    icon: <Boxes className="h-5 w-5" />,
    title: "7. Estoque e Lotes",
    items: [
      {
        q: "Como funciona o controle de lotes?",
        a: "Cada entrada de material gera lotes individuais com: número do lote, fabricação, validade, quantidade e custo. Os lotes são rastreáveis do XML de entrada até o produto final. O sistema usa FEFO (First Expire, First Out) para priorizar lotes mais próximos do vencimento.",
      },
      {
        q: "O que é Quarentena?",
        a: "Lotes recém-recebidos podem ficar em Quarentena aguardando liberação do Controle de Qualidade. Até serem aprovados, não podem ser usados em Ordens de Produção.",
      },
      {
        q: "O que é Rastreabilidade?",
        a: "É a capacidade de rastrear todo o caminho do material: XML de entrada → lote → separação → Ordem de Produção → produto final. Essencial para recalls e auditorias ANVISA.",
      },
      {
        q: "Como são os alertas de vencimento?",
        a: "O Dashboard principal mostra lotes próximos do vencimento. Lotes vencidos são destacados em vermelho. Isso ajuda a evitar o uso de materiais fora da validade.",
      },
    ],
  },
  {
    id: "producao",
    icon: <Factory className="h-5 w-5" />,
    title: "8. Produção Industrial",
    items: [
      {
        q: "Como criar uma fórmula?",
        a: "Menu → Produção → Fórmulas → Nova Fórmula. Adicione os ativos (com dosagem por cápsula), excipientes e selecione o tipo de cápsula. O sistema calcula automaticamente a massa total e o percentual de cada componente.",
      },
      {
        q: "O que é uma Ordem de Produção (OP)?",
        a: "A OP é o documento que autoriza a fabricação. Ela é criada a partir de uma fórmula aprovada e passa por etapas: Separação → Pesagem → Pré-Mix → Mistura → Encapsulamento → Embalagem → QC. Cada etapa é registrada com data, hora e responsável.",
      },
      {
        q: "O que é o Pick List / Separação?",
        a: "É a lista de lotes que devem ser separados para a produção. O sistema sugere automaticamente os lotes usando FEFO (primeiro a vencer, primeiro a sair), otimizando o uso do estoque.",
      },
      {
        q: "Como funciona o Controle de Qualidade da OP?",
        a: "Na etapa de QC, são verificados: peso médio das cápsulas, variação de peso, aspecto visual, umidade e outros parâmetros. Os resultados são registrados e vinculados à OP para auditoria.",
      },
      {
        q: "Posso imprimir a OP?",
        a: "Sim! O sistema gera um documento PDF completo com todas as folhas: Capa, Separação, Pesagem, Mistura, Encapsulamento, Embalagem e Checklist. Pronto para impressão e assinatura manual.",
      },
    ],
  },
  {
    id: "conversor",
    icon: <ArrowRightLeft className="h-5 w-5" />,
    title: "9. Conversor de Unidades (UI → mg)",
    badge: "TÉCNICO",
    items: [
      {
        q: "O que é o Conversor UI → mg?",
        a: "Muitas vitaminas e nutrientes são dosados em UI (Unidades Internacionais), mas na produção industrial a pesagem é feita em mg (miligramas) ou mcg (microgramas). O conversor traduz automaticamente a dosagem de UI para a unidade de pesagem correta.",
      },
      {
        q: "Como funciona na prática?",
        a: "Exemplo: Vitamina D3 — o fator de conversão é 1 UI = 0,025 mcg. Se a fórmula pede '1000 UI de Vitamina D3', o sistema calcula automaticamente: 1000 × 0,025 = 25 mcg (0,025 mg) por cápsula. Isso é o que será pesado na produção.",
      },
      {
        q: "De onde vêm os fatores de conversão?",
        a: "O sistema já vem com uma tabela pré-carregada de fatores de conversão por substância, baseada em referências farmacêuticas oficiais (USP, farmacopeias). O farmacêutico responsável pode editar esses fatores na aba 'Conversões UI' do módulo de Fórmulas.",
      },
      {
        q: "O que é classificação de risco do ativo?",
        a: "Alguns ativos têm faixas de potência muito estreitas (ex: Vitamina A, Selênio). Esses são classificados como 'ultra-críticos' porque um pequeno erro de pesagem pode causar superdose. O sistema alerta o operador e exige conferência dupla na pesagem desses ativos.",
      },
      {
        q: "Posso adicionar substâncias novas ao conversor?",
        a: "Sim. Na aba de Conversões do Formulador, você pode adicionar novas substâncias com seu fator de conversão UI→mg, fonte técnica de referência e classificação de risco.",
      },
    ],
  },
  {
    id: "formulador",
    icon: <FlaskConical className="h-5 w-5" />,
    title: "10. Regulatório e ANVISA",
    items: [
      {
        q: "O que é a Consulta Regulatória ANVISA?",
        a: "O sistema possui uma base de dados dos constituintes autorizados pela ANVISA (vitaminas, minerais, aminoácidos, etc.) com limites por faixa etária. Ao criar uma fórmula, você pode consultar se o ativo é permitido e quais são os limites máximos.",
      },
      {
        q: "O que são Alegações de Saúde?",
        a: "São textos específicos aprovados pela ANVISA que podem constar na rotulagem do produto (ex: 'Fonte de Vitamina C'). O sistema lista as alegações permitidas para cada constituinte da fórmula.",
      },
      {
        q: "A base ANVISA é atualizada automaticamente?",
        a: "Sim, o sistema possui sincronização automática com a base regulatória. O painel de Regulatório mostra a data da última sincronização e permite disparar atualizações manuais.",
      },
    ],
  },
  {
    id: "vendas",
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "11. Vendas e NF-e de Saída",
    items: [
      {
        q: "Como funciona o CRM?",
        a: "O CRM mostra um pipeline visual (Kanban) com as etapas: Lead → Contatado → Apresentação → Proposta → Fechado/Perdido. Cada cliente tem score, origem do lead, canal preferido e histórico de interações.",
      },
      {
        q: "Como emitir uma NF-e de saída?",
        a: "Menu → Vendas → Emissor NF-e. O formulário tem múltiplas abas: Identificação, Destinatário, Itens (com cálculo de impostos), Cobrança/Pagamento e Transporte. Requer certificado digital A1 válido e configuração da SEFAZ.",
      },
      {
        q: "O que são Orçamentos com templates de contrato?",
        a: "Você pode criar orçamentos para clientes e gerar contratos a partir de templates personalizáveis. Os templates aceitam variáveis dinâmicas (nome do cliente, valores, condições) e podem ser enviados por e-mail.",
      },
    ],
  },
  {
    id: "financeiro",
    icon: <DollarSign className="h-5 w-5" />,
    title: "12. Financeiro",
    items: [
      {
        q: "Como funcionam as Contas a Pagar?",
        a: "Podem ser geradas automaticamente pela importação de XML (quando há duplicatas/faturas no XML) ou cadastradas manualmente. Mostram valor, vencimento, fornecedor e status (aberta/paga/vencida).",
      },
      {
        q: "O que é o Fluxo de Caixa?",
        a: "Mostra a previsão de entradas e saídas financeiras ao longo do tempo, baseada nas Contas a Receber e Contas a Pagar. Ajuda a planejar a saúde financeira da empresa.",
      },
      {
        q: "O que é DRE?",
        a: "Demonstrativo de Resultado do Exercício. Resume receitas, custos, despesas e lucro/prejuízo em um período. Essencial para análise financeira e tomada de decisão.",
      },
    ],
  },
  {
    id: "dashboard",
    icon: <BarChart3 className="h-5 w-5" />,
    title: "13. Dashboards e Inteligência",
    items: [
      {
        q: "O que tem no Dashboard principal?",
        a: "Boas-vindas personalizado, KPIs do dia (estoque, produção, financeiro), aniversariantes da equipe, lotes vencendo, cotações de mercado (dólar, euro), índices econômicos e feed de notícias do setor.",
      },
      {
        q: "O que é o Dashboard Industrial?",
        a: "Mostra KPIs de produção (OPs abertas, concluídas, eficiência), alertas executivos, anomalias operacionais, ranking de fornecedores, previsão de demanda e sugestões de otimização.",
      },
    ],
  },
  {
    id: "qualidade",
    icon: <Shield className="h-5 w-5" />,
    title: "14. Qualidade",
    items: [
      {
        q: "O que são Desvios / Não Conformidades?",
        a: "Qualquer ocorrência fora do padrão é registrada como desvio: peso fora da faixa, aspecto inadequado, contaminação, etc. Cada desvio tem investigação, ação corretiva e prazo de resolução (CAPA).",
      },
      {
        q: "Como funciona a Calibração de Equipamentos?",
        a: "O módulo registra as calibrações de balanças, termômetros e outros equipamentos. Controla datas de vencimento das calibrações e alerta quando algum equipamento precisa ser recalibrado.",
      },
    ],
  },
  {
    id: "ferramentas",
    icon: <Settings className="h-5 w-5" />,
    title: "15. Ferramentas e Recursos",
    items: [
      {
        q: "O que é a Busca Global (Ctrl+K)?",
        a: "Pressione Ctrl+K (ou Cmd+K no Mac) em qualquer tela para abrir a busca global. Ela pesquisa em todos os módulos: entidades, itens, lotes, ordens de produção, notas fiscais, etc. É a forma mais rápida de encontrar qualquer informação.",
      },
      {
        q: "Como funciona o Chat Interno?",
        a: "O ERP tem um chat integrado para comunicação entre usuários da mesma empresa. Útil para coordenar atividades de produção, compras e qualidade sem sair do sistema.",
      },
      {
        q: "O que é a Auditoria Imutável com QR Code?",
        a: "Toda alteração em dados críticos (lotes, OPs, entidades) é registrada com hash criptográfico encadeado — como um blockchain. Cada registro gera um QR Code que pode ser verificado publicamente, garantindo que os dados não foram adulterados.",
      },
      {
        q: "Posso instalar o ERP como App (PWA)?",
        a: "Sim! O ERP pode ser instalado no celular ou desktop como um Progressive Web App. Acesse Menu → Instalar App. Ele funciona como um app nativo com ícone na tela inicial.",
      },
    ],
  },
  {
    id: "admin",
    icon: <Settings className="h-5 w-5" />,
    title: "16. Administração Avançada",
    items: [
      {
        q: "O que é o Backup de XMLs?",
        a: "Em Admin Master, você pode fazer backup de todos os XMLs de NF-e importados. Útil para migração ou para manter cópias de segurança dos documentos fiscais.",
      },
      {
        q: "Como funciona a Importação CSV?",
        a: "Em Admin Master → Importar Dados, você pode importar planilhas CSV com dados de entidades, itens ou lotes. O sistema permite mapear as colunas da planilha para os campos do ERP.",
      },
      {
        q: "O que é a Migração de Dados?",
        a: "Se você começou usando o ERP em modo local (sem conexão com a nuvem), pode migrar todos os dados para o ambiente cloud. O processo é automático e mostra um relatório de sucesso/erros.",
      },
    ],
  },
  {
    id: "assinatura",
    icon: <HelpCircle className="h-5 w-5" />,
    title: "17. Assinatura e Planos",
    items: [
      {
        q: "Quais planos estão disponíveis?",
        a: "O ERP oferece diferentes planos com funcionalidades crescentes. Acesse Menu → Assinatura para ver os planos disponíveis, comparar funcionalidades e gerenciar sua assinatura.",
      },
      {
        q: "Como acessar o Portal do Cliente?",
        a: "Em Menu → Assinatura, clique em 'Gerenciar Assinatura' para acessar o portal onde você pode alterar plano, atualizar dados de pagamento e ver histórico de faturas.",
      },
    ],
  },
  {
    id: "fluxo-resumo",
    icon: <Smartphone className="h-5 w-5" />,
    title: "18. Resumo da Jornada Completa",
    items: [
      {
        q: "Qual o fluxo completo de uso do ERP?",
        a: "1️⃣ Criar conta → 2️⃣ Cadastrar empresa (Onboarding) → 3️⃣ Configurar certificado digital e dados fiscais → 4️⃣ Importar XMLs de NF-e (caminho rápido) OU cadastrar manualmente fornecedores/itens → 5️⃣ Criar fórmulas no Formulador → 6️⃣ Abrir Ordens de Produção → 7️⃣ Executar produção (separação, pesagem, mistura, encapsulamento) → 8️⃣ Controle de Qualidade → 9️⃣ Vendas e emissão de NF-e de saída → 🔟 Financeiro (contas a pagar/receber, fluxo de caixa) → 📊 Relatórios e Dashboards.",
      },
      {
        q: "Preciso seguir essa ordem exatamente?",
        a: "Não necessariamente. Os módulos são independentes. Você pode começar apenas com compras e estoque, e ir adicionando produção, vendas e financeiro conforme a necessidade. O único passo obrigatório é o cadastro da empresa.",
      },
    ],
  },
];

export default function FAQPage() {
  const [search, setSearch] = useState("");

  const filteredSections = search.trim()
    ? faqSections
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.q.toLowerCase().includes(search.toLowerCase()) ||
              item.a.toLowerCase().includes(search.toLowerCase())
          ),
        }))
        .filter((section) => section.items.length > 0)
    : faqSections;

  const totalQuestions = faqSections.reduce((acc, s) => acc + s.items.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="📖 Manual do ERP — FAQ Completo"
        description={`${totalQuestions} perguntas organizadas em ${faqSections.length} seções cobrindo toda a jornada de uso`}
      />

      {/* Search */}
      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no manual... (ex: XML, certificado, fórmula, lote)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Sections */}
      <ScrollArea className="h-[calc(100vh-240px)]">
        <div className="space-y-4 pr-4">
          {filteredSections.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum resultado encontrado para "{search}"
            </div>
          )}

          {filteredSections.map((section) => (
            <div key={section.id} className="rounded-lg border bg-card">
              <Accordion type="single" collapsible>
                <AccordionItem value={section.id} className="border-0">
                  <AccordionTrigger className="px-6 py-4 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        {section.icon}
                      </div>
                      <span className="text-lg font-semibold text-left">
                        {section.title}
                      </span>
                      {section.badge && (
                        <Badge variant="secondary" className="ml-2">
                          {section.badge}
                        </Badge>
                      )}
                      <Badge variant="outline" className="ml-auto mr-4">
                        {section.items.length} perguntas
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-4">
                    <Accordion type="multiple">
                      {section.items.map((item, idx) => (
                        <AccordionItem
                          key={idx}
                          value={`${section.id}-${idx}`}
                          className="border-b last:border-0"
                        >
                          <AccordionTrigger className="text-left py-3 text-sm font-medium hover:no-underline">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-muted-foreground whitespace-pre-line pb-4 leading-relaxed">
                            {item.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
