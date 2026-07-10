import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { LucideIcon } from "lucide-react";
import { 
  Search, Bot, ThumbsUp, ThumbsDown, Send, Loader2, BookOpen, 
  ChevronRight, Sparkles, Rocket, Building2, Users, FileText, 
  Package, Boxes, Factory, FlaskConical, ShoppingCart, DollarSign, 
  BarChart3, Shield, Settings, Smartphone, HelpCircle, FileInput, FileCheck,
  ArrowRightLeft, Copy, Check, MessageSquare, Trash2, AlertCircle
} from "lucide-react";

interface MensagemChat {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  fallbackManual?: boolean;
}

interface FAQSection {
  id: string;
  icon: React.ReactNode;
  title: string;
  badge?: string;
  items: { q: string; a: string }[];
}

type ManualSecaoRow = {
  id: string;
  ordem: number;
  titulo: string;
  subtitulo: string | null;
  icon: string | null;
  badge: string | null;
};

type ManualPerguntaRow = {
  id: string;
  secao_id: string | null;
  ordem: number;
  pergunta: string;
  resposta: string;
};

function erroMsg(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; code?: string };
    return e.message || e.code || "Erro desconhecido";
  }
  return "Erro desconhecido";
}

const HEALTH_CHECK_TIMEOUT_MS = 5000;
const HEALTH_CHECK_PERGUNTA = "oi";
const BRAINX_MASCOT_SRC = "/brainx-mascot.png";
const MENSAGEM_FALLBACK_MANUAL =
  "No momento não consigo responder, mas você encontra tudo no Manual & FAQ ao lado — ele funciona sem a IA.";

type AssistenteStatus = "checking" | "online" | "offline";

function isRespostaErroIA(texto: string): boolean {
  const normalizado = texto.toLowerCase();
  return (
    normalizado.includes("não consegui processar") ||
    normalizado.includes("nao consegui processar") ||
    normalizado.includes("não consegui carregar o manual oficial") ||
    normalizado.includes("erro ao conectar com a ia")
  );
}

async function healthCheckManualIa(): Promise<boolean> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("timeout")), HEALTH_CHECK_TIMEOUT_MS);
  });

  try {
    const { data, error } = await Promise.race([
      supabase.functions.invoke("manual-ia", {
        body: {
          pergunta: HEALTH_CHECK_PERGUNTA,
          historico_chat: [],
          secao_contexto: null,
        },
      }),
      timeout,
    ]);

    if (error) return false;
    const resposta = typeof data?.resposta === "string" ? data.resposta : "";
    if (!resposta.trim()) return false;
    return !isRespostaErroIA(resposta);
  } catch {
    return false;
  }
}

function BrainXMascotTabIcon() {
  return (
    <span
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white p-[2px] shadow-lg ring-2 ring-white"
      aria-hidden
    >
      <img
        src={BRAINX_MASCOT_SRC}
        alt=""
        className="h-full w-full rounded-full object-cover object-center"
      />
    </span>
  );
}

function BrainXMascotIcon({
  size = 18,
  className = "",
  framed = false,
}: {
  size?: number;
  className?: string;
  framed?: boolean;
}) {
  const image = (
    <img
      src={BRAINX_MASCOT_SRC}
      alt=""
      aria-hidden
      className={`rounded-full object-cover ${framed ? "h-full w-full" : `shrink-0 ${className}`}`}
      style={framed ? undefined : { width: size, height: size }}
    />
  );

  if (!framed) return image;

  const frameSize = size + 8;
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-white shadow-md ring-2 ring-white shrink-0 overflow-hidden ${className}`}
      style={{ width: frameSize, height: frameSize, padding: 2 }}
      aria-hidden
    >
      {image}
    </span>
  );
}

function BrainXMascotAvatar({
  className = "",
  sizeClass = "w-14 h-14",
}: {
  className?: string;
  sizeClass?: string;
}) {
  return (
    <img
      src={BRAINX_MASCOT_SRC}
      alt="BrainX Assistente"
      className={`rounded-full object-cover shrink-0 border-2 border-white/40 bg-white shadow-sm ${sizeClass} ${className}`}
    />
  );
}

const MANUAL_ICON_MAP: Record<string, LucideIcon> = {
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
  FileCheck,
  ArrowRightLeft,
  BookOpen,
  MessageSquare,
  Bot,
};

function renderManualIcon(iconName: string | null | undefined): React.ReactNode {
  const Icon = MANUAL_ICON_MAP[(iconName || "").trim()] ?? HelpCircle;
  return <Icon className="h-5 w-5" />;
}

function buildFaqSectionsFromDb(
  secoes: ManualSecaoRow[],
  perguntas: ManualPerguntaRow[]
): FAQSection[] {
  const perguntasPorSecao = new Map<string, ManualPerguntaRow[]>();
  for (const pergunta of perguntas) {
    if (!pergunta.secao_id) continue;
    const lista = perguntasPorSecao.get(pergunta.secao_id) ?? [];
    lista.push(pergunta);
    perguntasPorSecao.set(pergunta.secao_id, lista);
  }

  return secoes.map((secao) => ({
    id: secao.id,
    icon: renderManualIcon(secao.icon),
    title: secao.titulo,
    badge: secao.badge ?? undefined,
    items: (perguntasPorSecao.get(secao.id) ?? [])
      .sort((a, b) => a.ordem - b.ordem)
      .map((p) => ({ q: p.pergunta, a: p.resposta })),
  }));
}

async function fetchManualFaq(): Promise<FAQSection[] | null> {
  const [secoesRes, perguntasRes] = await Promise.all([
    supabase
      .from("manual_secoes")
      .select("id, ordem, titulo, subtitulo, icon, badge")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
    supabase
      .from("manual_perguntas")
      .select("id, secao_id, ordem, pergunta, resposta")
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
  ]);

  if (secoesRes.error) throw secoesRes.error;
  if (perguntasRes.error) throw perguntasRes.error;

  const secoes = (secoesRes.data ?? []) as ManualSecaoRow[];
  if (secoes.length === 0) return null;

  const perguntas = (perguntasRes.data ?? []) as ManualPerguntaRow[];
  return buildFaqSectionsFromDb(secoes, perguntas);
}

// FALLBACK temporário: usado apenas se a query ao banco falhar ou retornar vazio.
const faqSectionsFallback: FAQSection[] = [
  {
    id: "primeiros-passos",
    icon: <Rocket className="h-5 w-5" />,
    title: "1. Primeiros Passos",
    items: [
      { q: "Como criar minha conta no ERP?", a: "Acesse a tela de login e clique em 'Criar conta'. Preencha seu e-mail e senha (mínimo 6 caracteres). Você receberá um e-mail de verificação — clique no link para ativar sua conta. Após confirmar, faça login normalmente." },
      { q: "O que acontece no primeiro login?", a: "No primeiro acesso, você será redirecionado para a tela de Onboarding, onde deverá cadastrar os dados da sua empresa (CNPJ, Razão Social, Endereço). Este passo é obrigatório para usar o ERP." },
      { q: "Posso usar o ERP sem cadastrar a empresa?", a: "Não. O cadastro da empresa é obrigatório. Sem ele, o sistema não permite o acesso aos módulos." }
    ]
  },
  {
    id: "configuracoes-empresa",
    icon: <Building2 className="h-5 w-5" />,
    title: "2. Configurações da Empresa",
    items: [
      { q: "Como acessar as configurações da empresa?", a: "No menu lateral, clique em 'Configurações' → 'Empresa'. Lá você encontra todos os dados cadastrais, fiscais, logo e certificado digital. Apenas administradores têm acesso." },
      { q: "O que é o Regime Tributário e como preencher?", a: "O Regime Tributário define como sua empresa calcula os impostos: Simples Nacional, Lucro Presumido ou Lucro Real. Selecione o regime correto conforme orientação do seu contador." }
    ]
  },
  {
    id: "estoque-lotes",
    icon: <Boxes className="h-5 w-5" />,
    title: "3. Estoque e Lotes (FEFO)",
    items: [
      { q: "Como o sistema gerencia lotes?", a: "O BrainX ERP utiliza a metodologia FEFO (First Expired, First Out). Consulte lotes em Estoque → Lotes (e reservas em Estoque → Lotes Reservados). Ao realizar uma venda ou ordem de produção, o sistema sugere automaticamente o lote com vencimento mais próximo para garantir a rotatividade e evitar perdas." },
      { q: "Como fazer uma entrada de estoque manual?", a: "Vá em Cadastros → Produtos/Insumos, selecione o item e use Estoque → Movimentações, ou gere entradas via XML em Suprimentos → Importar NF-e." }
    ]
  },
  {
    id: "producao-ops",
    icon: <Factory className="h-5 w-5" />,
    title: "4. Produção e OPs",
    items: [
      { q: "Como criar uma Ordem de Produção (OP)?", a: "No módulo de Produção, clique em 'Nova OP'. Selecione o produto acabado, a quantidade e o sistema carregará a fórmula automaticamente, reservando os insumos necessários no estoque." },
      { q: "Como registrar o apontamento de produção?", a: "Dentro da OP, utilize a aba de 'Apontamentos' para informar a quantidade produzida e as matérias-primas consumidas (conforme o lote utilizado)." }
    ]
  },
  {
    id: "anvisa-checker",
    icon: <Shield className="h-5 w-5" />,
    title: "5. ANVISA Checker",
    badge: "Exclusivo",
    items: [
      { q: "O que é o ANVISA Checker?", a: "É um módulo que valida se as substâncias e dosagens da sua fórmula estão em conformidade com as Instruções Normativas da ANVISA (como a IN 28/2018). Ele alerta sobre limites excedidos para diferentes grupos (adultos, gestantes, etc)." }
    ]
  },
  {
    id: "excipientes-config",
    icon: <FlaskConical className="h-5 w-5" />,
    title: "6. Excipientes Configuráveis",
    items: [
      { q: "O que são excipientes configuráveis?", a: "Excipientes são substâncias inertes adicionadas à fórmula (deslizantes, lubrificantes, bases). No BrainX, você configura quais excipientes usar, suas percentagens e se devem ser adicionados por último. Vá em Produção → Parâmetros → Excipientes." },
      { q: "Como adicionar um novo excipiente?", a: "Em Parâmetros → Excipientes, clique em '+ Adicionar'. Preencha nome, categoria (Técnico ou Base), função, percentual e selecione o item do cadastro. Clique Salvar." },
      { q: "Qual é a diferença entre Base e Excipiente Técnico?", a: "Base (QSP) é o excipiente que completa a fórmula até atingir 100% (ex: Amido). Excipientes Técnicos são aditivos em percentual fixo (ex: Talco 5%, SiO₂ 2%)." }
    ]
  },
  {
    id: "recalcular-materiais",
    icon: <ArrowRightLeft className="h-5 w-5" />,
    title: "7. Recalcular Materiais da OP",
    items: [
      { q: "Quando devo usar 'Recalcular Materiais'?", a: "Use quando a fórmula foi alterada APÓS criar a OP, ou quando novos excipientes foram configurados. O sistema vai reexplodir a fórmula usando as novas regras e gerar requisição de compra para itens faltantes." },
      { q: "O que acontece ao clicar 'Recalcular'?", a: "O sistema chama a RPC preparar_op_materiais, que: (1) Limpa os materiais antigos, (2) Explode a fórmula com novos excipientes, (3) Reserva do estoque (FEFO), (4) Gera requisição de compra se houver falta." },
      { q: "Posso recalcular uma OP em produção?", a: "Não. O botão 'Recalcular' só aparece em OPs no status PLANEJADA. Após iniciar a produção, os materiais são fixos." }
    ]
  },
  {
    id: "quarentena-lotes",
    icon: <Package className="h-5 w-5" />,
    title: "8. Quarentena de Lotes",
    items: [
      { q: "O que é quarentena de lotes?", a: "Quarentena é um status temporário para lotes recém-recebidos que aguardam liberação do RT (Responsável Técnico) antes de serem usados em produção. O sistema marca como QUARENTENA até aprovação." },
      { q: "Como liberar um lote da quarentena?", a: "A liberação é feita pela RT em Qualidade → Controle de COA: validando o COA do lote, ou usando 'Liberar com ressalva' quando o fornecedor não fornece laudo. Apenas usuários com acesso ao módulo Qualidade podem liberar. Após a liberação, o lote passa para DISPONÍVEL." },
      { q: "O que acontece se usar um lote em quarentena?", a: "O sistema bloqueia — aparece um alerta âmbar na tela de pesagem: '⚠️ Quarentena - Liberar RT'. Você não consegue finalizar a pesagem até liberar o lote." }
    ]
  },
  {
    id: "controle-coa",
    icon: <FileCheck className="h-5 w-5" />,
    title: "9. Controle de COA (Qualidade / RT)",
    items: [
      { q: "O que é o Controle de COA?", a: "É a área em Qualidade → Controle de COA onde a RT gerencia os certificados de análise (COA) dos lotes de matéria-prima recebidos. A tela mostra produto, nº da nota, lote, quantidade, validade e status do COA — sem dados financeiros." },
      { q: "Quais os status de COA de um lote?", a: "• Sem COA — nenhum laudo anexado ao lote.\n• Pendente — COA anexado, aguardando validação pela RT.\n• Validado — COA aprovado pela RT." },
      { q: "Como importar o COA?", a: "Na tela Controle de COA, clique no botão \"Importar COA da nota\", selecione a nota fiscal e envie o PDF COMPILADO da nota inteira. O sistema fatia o documento e distribui cada certificado no lote correto, casando pelo número de lote." },
      { q: "Como ver o laudo em PDF?", a: "Clique no botão \"Ver PDF\" na linha do lote. O laudo abre dentro do ERP, com opção de imprimir." },
      { q: "Como validar o COA?", a: "Em lotes com status Pendente, clique no botão \"Validar\". O sistema registra quem validou e quando." },
      { q: "O fornecedor não forneceu COA. E agora?", a: "Use o botão \"Liberar com ressalva\": exige justificativa (mínimo de 30 caracteres), libera o lote e registra a justificativa na rastreabilidade. Disponível apenas para lotes em quarentena sem COA validado." },
      { q: "Como corrigir o número de um lote?", a: "Clique no botão \"Editar lote\", ajuste o número do lote e/ou datas de fabricação e validade, e confirme. A correção fica registrada no histórico (observações do lote)." },
    ]
  },
  {
    id: "nfe-import",
    icon: <FileInput className="h-5 w-5" />,
    title: "10. Importação de NF-e",
    items: [
      { q: "Como importar uma NF-e de entrada?", a: "Vá em Suprimentos → Importar NF-e (ou Notas de Entrada). Selecione o arquivo XML. O sistema lê automaticamente: itens, quantidades, preços, fornecedor, lote, validade e cria a entrada de estoque." },
      { q: "O que acontece se reimportar a mesma NF-e?", a: "O sistema detecta a chave_nfe duplicada e bloqueia. Aparece mensagem: 'Esta NF-e já foi importada'. Você não consegue duplicar entradas." },
      { q: "Como o sistema trata lotes e validade da NF-e?", a: "Se a NF-e contém <rastro> (lote, fab, validade), o sistema cria automaticamente um lote em QUARENTENA com essas informações. Caso contrário, cria um lote genérico." }
    ]
  },
  {
    id: "requisicoes-compra",
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "11. Requisições de Compra",
    items: [
      { q: "Como é gerada uma requisição de compra?", a: "Quando você cria uma OP e há insumos sem estoque, o sistema gera automaticamente uma requisição de compra com status ABERTA. Você pode visualizar em Suprimentos → Requisições de Compra." },
      { q: "Posso editar uma requisição após criada?", a: "Sim. Em Suprimentos → Requisições de Compra, clique na requisição e edite quantidade, fornecedor ou observações. Clique Salvar. Apenas requisições em ABERTA podem ser editadas." },
      { q: "Como converter requisição em pedido de compra?", a: "Selecione a requisição e clique 'Converter em Pedido'. O sistema cria um pedido com os mesmos itens e muda o status da requisição para CONVERTIDA." }
    ]
  },
  {
    id: "impressao-op",
    icon: <FileText className="h-5 w-5" />,
    title: "12. Impressão da OP",
    items: [
      { q: "Como imprimir uma OP?", a: "Na tela da OP, clique no botão 'Imprimir' (ou ícone de impressora). O sistema abre um template profissional com 7 páginas: Capa, Separação, Pesagem, Mistura, Encapsulamento, Embalagem e Checklist. Pressione Ctrl+P para imprimir." },
      { q: "O que aparece no rodapé de cada página?", a: "Rodapé padrão: Nome da empresa · RT · Lote · Data de fabricação · 'Gerado por www.brainx.erp' · Número da página (ex: Pág 3/7)." },
      { q: "Posso customizar o template de impressão?", a: "Atualmente, o template é fixo. Futuras versões permitirão customização. Para mudanças, entre em contato com suporte." }
    ]
  }
];

export default function FAQPage() {
  const [busca, setBusca] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<'manual' | 'ia'>('manual');
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([
    { role: 'assistant', content: 'Olá! Sou o BrainX Assistente. Posso responder qualquer dúvida sobre o ERP — produção, estoque, ANVISA, NF-e, configurações ou qualquer funcionalidade. Como posso ajudar?', timestamp: new Date() }
  ]);
  const [inputChat, setInputChat] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const [assistenteStatus, setAssistenteStatus] = useState<AssistenteStatus>("checking");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const healthCheckRef = useRef(0);
  const queryClient = useQueryClient();

  const {
    data: manualDb,
    isLoading: isLoadingManual,
    isError: isManualError,
    error: manualError,
  } = useQuery({
    queryKey: ["manual-faq"],
    queryFn: fetchManualFaq,
    staleTime: 5 * 60 * 1000,
  });

  const sectionsExibidas = useMemo(() => {
    if (manualDb && manualDb.length > 0) return manualDb;
    return faqSectionsFallback;
  }, [manualDb]);

  const filteredSections = useMemo(
    () =>
      sectionsExibidas
        .map((section) => ({
          ...section,
          items: section.items.filter(
            (item) =>
              item.q.toLowerCase().includes(busca.toLowerCase()) ||
              item.a.toLowerCase().includes(busca.toLowerCase())
          ),
        }))
        .filter((section) => section.items.length > 0),
    [sectionsExibidas, busca]
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensagens]);

  useEffect(() => {
    if (isManualError && manualError) {
      toast.error(erroMsg(manualError));
    }
  }, [isManualError, manualError]);

  useEffect(() => {
    if (abaAtiva !== "ia") return;

    const checkId = ++healthCheckRef.current;
    setAssistenteStatus("checking");

    healthCheckManualIa()
      .then((online) => {
        if (healthCheckRef.current !== checkId) return;
        setAssistenteStatus(online ? "online" : "offline");
      })
      .catch((err) => {
        if (healthCheckRef.current !== checkId) return;
        console.error("Health check manual-ia:", err);
        setAssistenteStatus("offline");
      });
  }, [abaAtiva]);

  const irParaManual = () => setAbaAtiva("manual");

  const enviarParaIA = async (perguntaInput?: string) => {
    const pergunta = perguntaInput || inputChat.trim();
    if (!pergunta || enviando) return;
    
    setInputChat('');
    setEnviando(true);
    setAbaAtiva('ia');
    setMensagens(prev => [...prev, { role: 'user', content: pergunta, timestamp: new Date() }]);

    try {
      const historico = mensagens.slice(-6).map(m => ({ role: m.role, content: m.content }));
      const timeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), HEALTH_CHECK_TIMEOUT_MS);
      });
      const { data, error } = await Promise.race([
        supabase.functions.invoke('manual-ia', {
          body: { pergunta, historico_chat: historico, secao_contexto: secaoAtiva }
        }),
        timeout,
      ]);
      if (error) throw error;

      const resposta = typeof data?.resposta === "string" ? data.resposta : "";
      if (!resposta.trim() || isRespostaErroIA(resposta)) {
        setAssistenteStatus("offline");
        setMensagens(prev => [
          ...prev,
          { role: 'assistant', content: MENSAGEM_FALLBACK_MANUAL, timestamp: new Date(), fallbackManual: true },
        ]);
        return;
      }

      setAssistenteStatus("online");
      setMensagens(prev => [...prev, { role: 'assistant', content: resposta, timestamp: new Date() }]);
    } catch (e) {
      setAssistenteStatus("offline");
      toast.error(erroMsg(e));
      setMensagens(prev => [
        ...prev,
        { role: 'assistant', content: MENSAGEM_FALLBACK_MANUAL, timestamp: new Date(), fallbackManual: true },
      ]);
    } finally {
      setEnviando(false);
    }
  };

  const registrarFeedback = async (secaoId: string, itemIdx: number, util: boolean) => {
    try {
      await supabase.from('manual_feedback').insert({
        secao_id: secaoId,
        pergunta_idx: itemIdx,
        util: util
      });
    } catch (e) {
      console.error('Erro ao registrar feedback', e);
    }
  };

  const buscaAtiva = busca.trim().length >= 2;

  const statusAssistente = {
    checking: {
      dot: "bg-slate-300",
      pulse: false,
      label: "Verificando disponibilidade...",
    },
    online: {
      dot: "bg-green-400",
      pulse: true,
      label: "Me pergunte — estou online",
    },
    offline: {
      dot: "bg-red-500",
      pulse: false,
      label: "Assistente fora do ar no momento",
    },
  }[assistenteStatus];

  return (
    <div className="space-y-6">
      <PageHeader 
        title="📖 Manual do ERP — BrainX IA" 
        description="Manual oficial do sistema (funciona sem IA) + assistente opcional para dúvidas." 
      />

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Buscar no manual... (ex: XML, certificado, ANVISA)" 
          value={busca} 
          onChange={e => setBusca(e.target.value)} 
          className="pl-10 h-12" 
        />
      </div>

      <div className="flex flex-col gap-2 max-w-lg">
        <div className="flex gap-1.5 p-1.5 bg-muted rounded-lg">
          <Button 
            variant={abaAtiva === 'manual' ? 'default' : 'ghost'} 
            className="flex-1 gap-2 h-12 text-sm" 
            onClick={() => setAbaAtiva('manual')}
            title="Conteúdo oficial do sistema — funciona sem IA"
          >
            <BookOpen className="h-5 w-5 shrink-0" /> Manual & FAQ
          </Button>
          <Button 
            variant={abaAtiva === 'ia' ? 'default' : 'ghost'} 
            className="flex-1 gap-2 h-12 px-3 text-sm" 
            onClick={() => setAbaAtiva('ia')}
          >
            <BrainXMascotTabIcon />
            <span className="truncate">Pergunte à IA</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground px-1">
          {abaAtiva === 'manual'
            ? "Manual & FAQ lê o conteúdo oficial do sistema — não depende da IA."
            : "A IA é opcional. Se estiver indisponível, use Manual & FAQ ao lado."}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ÍNDICE LATERAL — apenas desktop e aba manual */}
        {abaAtiva === 'manual' && (
          <aside className="hidden lg:block space-y-2">
            <h3 className="font-semibold px-3 py-2 text-sm text-muted-foreground uppercase tracking-wider">Seções</h3>
            <ScrollArea className="h-[calc(100vh-320px)]">
              {isLoadingManual ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full mb-1.5" />
                ))
              ) : (
                sectionsExibidas.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSecaoAtiva(s.id);
                      document.getElementById(`secao-${s.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors mb-0.5 flex items-center gap-2 ${
                      secaoAtiva === s.id
                        ? 'bg-blue-600/10 text-blue-600 border-l-2 border-blue-600 font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {s.icon}
                    <span className="truncate">{s.title.replace(/^\d+\.\s/, '')}</span>
                  </button>
                ))
              )}
            </ScrollArea>
          </aside>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <div className={abaAtiva === 'manual' ? "lg:col-span-3" : "lg:col-span-4"}>
          {abaAtiva === 'manual' ? (
            <ScrollArea className="h-[calc(100vh-280px)] pr-4">
              {isLoadingManual ? (
                <div className="space-y-6">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-3">
                      <Skeleton className="h-8 w-1/2" />
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))}
                </div>
              ) : sectionsExibidas.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">Manual ainda não disponível</p>
                  <p className="text-sm text-muted-foreground">
                    Não encontramos seções do manual no momento. Tente novamente mais tarde ou use a aba Pergunte à IA.
                  </p>
                </Card>
              ) : (
                <>
              {buscaAtiva && filteredSections.length === 0 && (
                <Card className="p-8 text-center border-dashed">
                  <BrainXMascotIcon size={48} framed className="mx-auto mb-4 shadow-lg" />
                  <p className="font-medium">Não encontrei no manual</p>
                  <p className="text-sm text-muted-foreground mb-4">A IA pode responder sua dúvida com base no contexto completo do sistema.</p>
                  <Button variant="default" onClick={() => enviarParaIA(busca)} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Perguntar à IA: "{busca}"
                  </Button>
                </Card>
              )}

              {!isLoadingManual && filteredSections.map((section) => (
                <div key={section.id} id={`secao-${section.id}`} className="mb-6">
                  <div className="flex items-center gap-3 mb-4 sticky top-0 bg-background/95 py-2 z-10">
                    <div className="p-2 rounded-lg bg-blue-600/10 text-blue-600">
                      {section.icon}
                    </div>
                    <h2 className="text-xl font-bold">{section.title}</h2>
                    {section.badge && <Badge className="bg-blue-600 text-white border-0">{section.badge}</Badge>}
                  </div>

                  <Accordion type="single" collapsible className="space-y-3">
                    {section.items.map((item, idx) => (
                      <AccordionItem key={idx} value={`${section.id}-${idx}`} className="border rounded-lg bg-card px-4">
                        <AccordionTrigger className="hover:no-underline py-4 text-left font-medium">
                          {item.q}
                        </AccordionTrigger>
                        <AccordionContent className="pb-4">
                          <p className="text-muted-foreground whitespace-pre-line leading-relaxed mb-4">
                            {item.a}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/50">
                            <span className="text-xs font-medium text-muted-foreground">Foi útil?</span>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 gap-2"
                                onClick={() => registrarFeedback(section.id, idx, true)}
                              >
                                <ThumbsUp className="h-3 w-3" /> Sim
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 px-3 gap-2"
                                onClick={() => registrarFeedback(section.id, idx, false)}
                              >
                                <ThumbsDown className="h-3 w-3" /> Não
                              </Button>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 gap-2 ml-auto text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => enviarParaIA(`Explique melhor: ${item.q}`)}
                            >
                              <Sparkles className="h-3 w-3" /> Aprofundar análise
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              ))}
                </>
              )}
            </ScrollArea>
          ) : (
            /* ABA IA — CHAT COMPLETO */
            <Card className="flex flex-col h-[calc(100vh-280px)] shadow-lg overflow-hidden border-blue-100">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <BrainXMascotAvatar sizeClass="w-16 h-16" className="border-white shadow-md" />
                  <div>
                    <h3 className="text-white font-bold text-base">BrainX Assistente</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${statusAssistente.dot} ${
                          statusAssistente.pulse ? "animate-pulse" : ""
                        }`}
                      />
                      <span className="text-xs text-white/90">{statusAssistente.label}</span>
                    </div>
                  </div>
                </div>
                {mensagens.length > 1 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-white hover:bg-white/10 h-8 gap-2"
                    onClick={() => setMensagens([mensagens[0]])}
                  >
                    <Trash2 className="h-3 w-3" /> Limpar
                  </Button>
                )}
              </div>

              <ScrollArea className="flex-1 p-4 bg-slate-100">
                <div className="space-y-5">
                  {assistenteStatus === "offline" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-3 items-start">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-2 text-xs text-amber-900">
                        <p>{MENSAGEM_FALLBACK_MANUAL}</p>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={irParaManual}>
                          <BookOpen className="h-3 w-3 mr-1" />
                          Abrir Manual & FAQ
                        </Button>
                      </div>
                    </div>
                  )}
                  {mensagens.map((msg, i) => (
                    <div key={i} className={`flex gap-3 items-end ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      {msg.role === 'user' ? (
                        <div className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                          <Users className="h-5 w-5 text-white" />
                        </div>
                      ) : (
                        <BrainXMascotAvatar
                          sizeClass="w-12 h-12"
                          className="border-blue-200 shadow-sm mb-1"
                        />
                      )}
                      <div className="flex flex-col max-w-[85%] gap-1">
                        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          msg.role === 'user' 
                            ? 'bg-primary text-primary-foreground rounded-tr-none' 
                            : 'bg-white text-slate-900 rounded-tl-none border border-slate-200'
                        }`}>
                          <p className="whitespace-pre-wrap">{msg.content}</p>
                          {msg.fallbackManual && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="mt-3 h-8 text-xs w-full"
                              onClick={irParaManual}
                            >
                              <BookOpen className="h-3 w-3 mr-1" />
                              Abrir Manual & FAQ
                            </Button>
                          )}
                        </div>
                        <div className={`text-[10px] text-muted-foreground ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                          {msg.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          {msg.role === 'assistant' && (
                            <button 
                              className="ml-2 hover:text-blue-600"
                              onClick={() => {
                                navigator.clipboard.writeText(msg.content);
                                setCopiadoIdx(i);
                                setTimeout(() => setCopiadoIdx(null), 2000);
                              }}
                            >
                              {copiadoIdx === i ? <Check className="h-3 w-3 inline" /> : <Copy className="h-3 w-3 inline" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {enviando && (
                    <div className="flex gap-3 items-end">
                      <BrainXMascotAvatar sizeClass="w-12 h-12" className="border-blue-200 shadow-sm mb-1" />
                      <div className="bg-white border border-blue-50 rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center shadow-sm">
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-white">
                <div className="flex gap-2 items-end max-w-4xl mx-auto">
                  <div className="flex-1 relative">
                    <Textarea 
                      placeholder="Digite sua dúvida sobre o sistema..." 
                      value={inputChat} 
                      onChange={e => setInputChat(e.target.value)} 
                      className="min-h-[44px] max-h-[120px] pr-10 resize-none py-3" 
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          enviarParaIA();
                        }
                      }}
                    />
                  </div>
                  <Button 
                    size="icon" 
                    className="h-11 w-11 shrink-0 shadow-md transition-all active:scale-95" 
                    onClick={() => enviarParaIA()} 
                    disabled={!inputChat.trim() || enviando}
                  >
                    {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  A IA pode cometer erros. O Manual & FAQ funciona sem IA e traz o conteúdo oficial.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}