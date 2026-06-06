import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ShieldCheck, AlertTriangle, FileCheck2, Factory, Boxes,
  FileText, Thermometer, QrCode, ScanLine, Lock, Sparkles, ArrowRight,
  CheckCircle2, Clock, TrendingUp, FlaskConical,
  Stethoscope, Wallet, ShoppingCart, FileSignature, Cloud, Zap, BadgeCheck,
  Star, AlertOctagon, Plus, Minus, ShieldAlert, FileBadge2, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import brainxLogo from "@/assets/brainx-logo.png";

const fadeUp: any = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const modulosCore = [
  { icon: Factory, title: "Ordem de Produção (OP) Industrial", desc: "13 fases, pesagem dupla, pré-mix geométrico para ativos <1mg, baixa automática de estoque.", badge: "BPF" },
  { icon: Boxes, title: "Estoque por Lote (rastreabilidade total)", desc: "Cada lote com COA, validade, potência (UI/g, mg/g), fiscal DNA e genealogia bidirecional.", badge: "ANVISA" },
  { icon: FlaskConical, title: "Controle de Qualidade & CAPA", desc: "Físico-químico, calibração de balanças, desvios e CAPA em 7 fases com rastreio bidirecional.", badge: "BPF" },
  { icon: ShieldCheck, title: "Quarentena Inteligente", desc: "Todo lote importado entra em QUARENTENA até liberação manual via COA aprovado pelo RT.", badge: "ANVISA" },
  { icon: FileSignature, title: "Assinatura Digital do RT (SHA-256)", desc: "Liberação de lote exige assinatura criptográfica do Responsável Técnico (CRN/CRQ/CRF).", badge: "BPF" },
  { icon: QrCode, title: "Dossiê de Lote + QR Público", desc: "Documento A4 unificado: OP, matéria-prima, COA, CAPA, com QR de auditoria pública read-only.", badge: "ANVISA" },
];

const modulosComplementares = [
  { icon: FileText, title: "Emissão de NF-e / NFC-e", desc: "Emissor fiscal homologado integrado, com DANFE, contingência e armazenamento do XML por 5 anos." },
  { icon: ScanLine, title: "Importação de XML / NF-e", desc: "Entrada automática de notas: cria fornecedores, SKUs, lotes, contas a pagar e classifica risco por NCM." },
  { icon: Wallet, title: "Financeiro Completo", desc: "Contas a pagar e receber, fluxo de caixa, conciliação, DRE — alimentado pelo XML automaticamente." },
  { icon: ShoppingCart, title: "CRM, Orçamentos & Vendas", desc: "Pipeline comercial, contratos com workflow de aprovação >R$5k, pedidos, expedição e marketplace." },
  { icon: Thermometer, title: "Temperatura por Sensores IoT", desc: "Monitoramento ambiental em tempo real, heatmap 12h, alertas de não conformidade e exportação CSV." },
  { icon: Stethoscope, title: "Consulta ANVISA + IA", desc: "Verificação automática de substâncias proibidas (IN 28/2018, RDC 243/2018) com alerta vermelho." },
];

const riscos = [
  { txt: "Liberar um lote sem COA validado pelo Responsável Técnico", multa: "Até R$ 1.500.000" },
  { txt: "Não rastrear matéria-prima usada em cada lote fabricado", multa: "Interdição da planta" },
  { txt: "Não conseguir apresentar o dossiê de lote em até 24h", multa: "Auto de infração ANVISA" },
  { txt: "Usar substância proibida (IN 28/2018) sem alerta automático", multa: "Recolhimento + processo" },
  { txt: "Ordem de Produção sem assinatura digital do RT", multa: "Não conformidade BPF" },
  { txt: "Perder o XML de uma NF-e dentro do prazo legal de 5 anos", multa: "Multa fiscal Receita" },
];

const passos = [
  { n: "01", title: "Crie sua conta em 60s", desc: "14 dias grátis, sem cartão. Cadastro do CNPJ via consulta automática Receita Federal." },
  { n: "02", title: "Importe seu primeiro XML", desc: "Upload de qualquer NF-e — o sistema cria fornecedor, SKU, lote, COA pendente e conta a pagar." },
  { n: "03", title: "Produza com rastreabilidade total", desc: "Abra a OP, execute pesagem dupla dos ativos, libere o lote com assinatura SHA-256 do RT e gere o Dossiê A4 + QR Code para auditoria ANVISA em um clique." },
];

const depoimentos = [
  {
    inicial: "C",
    nome: "Dra. C. Mendes",
    cargo: "Diretora Técnica · Indústria de Suplementos · Interior SP",
    bg: "#1E3A5F",
    txt: "Antes de implantar o BrainX, preparar o dossiê de um lote levava até 3 dias. Hoje são 14 minutos. Na última visita da ANVISA não houve nenhuma ressalva relacionada a rastreabilidade.",
  },
  {
    inicial: "R",
    nome: "Farm. R. Costa",
    cargo: "RT (CRF-MG) · Fabricante de Cápsulas · Belo Horizonte MG",
    bg: "#064E3B",
    txt: "A assinatura digital SHA-256 do RT resolveu um problema que nenhuma planilha resolvia: prova irrefutável de quando e quem liberou cada lote. Isso vale mais do que qualquer certificação.",
  },
  {
    inicial: "M",
    nome: "M. Oliveira",
    cargo: "CFO · Grupo Industrial de Nutracêuticos · Porto Alegre RS",
    bg: "#7C2D12",
    txt: "O XML da NF-e entrar automaticamente no estoque, nas contas a pagar e no dossiê de fornecedor foi o que nos fez migrar. Integração real, não exportação de planilha.",
  },
];

const faqs = [
  { q: "Quanto tempo leva para implantar?", a: "Em média 7 dias. Você importa seus XMLs históricos, cadastra seu RT e começa a operar. Treinamento incluído." },
  { q: "É homologado para emitir NF-e?", a: "Sim. Emissor integrado e homologado, com armazenamento legal do XML por 5 anos e DANFE oficial." },
  { q: "Atende aos requisitos da ANVISA RDC 658/2022 e BPF?", a: "Sim. Quarentena obrigatória, COA por lote, assinatura digital do RT, dossiê unificado e QR de auditoria pública." },
  { q: "Meus dados ficam isolados de outros clientes?", a: "Sim. Arquitetura multi-tenant com Row Level Security — cada CNPJ enxerga apenas seus próprios dados." },
  { q: "Posso testar sem cartão de crédito?", a: "Sim. 14 dias grátis, demo guiada disponível, sem necessidade de cadastrar cartão." },
  { q: "O sistema emite DANFE e funciona em contingência SEFAZ?", a: "Sim. O BrainX emite NF-e com DANFE em PDF, suporta contingência off-line (DPEC) e armazena o XML autorizado por 5 anos conforme exigência da Receita Federal." },
  { q: "Como funciona a assinatura digital do Responsável Técnico?", a: "O RT assina o dossiê de lote usando hash SHA-256 vinculado ao seu login (CRQ/CRF/CRN cadastrado). Cada assinatura gera um registro imutável na trilha de auditoria com timestamp, IP e conteúdo do documento assinado." },
  { q: "Como migro meu histórico do sistema atual?", a: "Fornecemos template de importação em CSV/XLSX para SKUs, fornecedores e lotes históricos. A migração é acompanhada pela nossa equipe durante o SLA de 7 dias de implantação." },
  { q: "O sistema atende indústrias com múltiplos CNPJs (grupo industrial)?", a: "Sim. Cada CNPJ opera como um tenant isolado com Row Level Security no banco de dados. Um usuário pode ter acesso a múltiplos tenants sem que os dados se misturem." },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const ModuleCard = ({ m, core }: { m: any; core?: boolean }) => (
    <Card
      className="h-full border transition-all bg-white relative"
      style={{ borderColor: "#E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <CardContent className="p-6">
        {core && m.badge && (
          <span
            className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: "#DCFCE7", color: "#15803D" }}
          >
            {m.badge}
          </span>
        )}
        <div
          className="h-10 w-10 rounded-lg flex items-center justify-center mb-4"
          style={{ background: "#EFF6FF" }}
        >
          <m.icon className="h-5 w-5" style={{ color: "#1E3A5F", width: 20, height: 20 }} />
        </div>
        <h3 className="font-bold text-base mb-1.5" style={{ color: "#0F172A" }}>{m.title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{m.desc}</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen antialiased overflow-x-hidden w-full" style={{ background: "#FFFFFF", color: "#0F172A" }}>
      {/* NAV */}
      <header
        className="sticky top-0 z-50 transition-shadow"
        style={{
          background: "#FFFFFF",
          borderBottom: scrolled ? "1px solid #E5E7EB" : "1px solid transparent",
          boxShadow: scrolled ? "0 1px 3px rgba(0,0,0,0.04)" : "none",
        }}
      >
        <div className="container max-w-7xl mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/landing" className="flex items-center gap-2.5">
            <img src={brainxLogo} alt="BrainX ERP" className="h-10 w-10 object-contain rounded" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-base tracking-tight" style={{ color: "#0F172A" }}>BrainX ERP</span>
              <span className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: "#6B7280" }}>
                Industrial Compliance
              </span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium" style={{ color: "#374151" }}>
            <a href="#modulos" className="hover:opacity-70 transition-opacity">Módulos</a>
            <a href="#compliance" className="hover:opacity-70 transition-opacity">Compliance</a>
            <a href="#como-funciona" className="hover:opacity-70 transition-opacity">Como funciona</a>
            <a href="#planos" className="hover:opacity-70 transition-opacity">Planos</a>
            <a href="#faq" className="hover:opacity-70 transition-opacity">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex" style={{ color: "#0F172A" }}>
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="text-white hover:opacity-90 shadow-sm"
              style={{ background: "#0F172A" }}
            >
              <Link to="/auth?demo=1">
                Ver demonstração <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden" style={{ background: "#FFFFFF" }}>
        <div className="container max-w-7xl mx-auto px-4 pt-20 pb-24 md:pt-24 md:pb-28">
          <motion.div {...fadeUp} className="max-w-4xl mx-auto text-center">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-6"
              style={{ border: "1px solid #DC2626", background: "#FEF2F2", color: "#DC2626" }}
            >
              <AlertOctagon className="h-4 w-4" />
              Alerta para indústrias de suplementos
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.1] mb-6" style={{ color: "#0F172A" }}>
              Sua indústria está preparada para
              <span className="block" style={{ color: "#0F172A" }}>
                uma fiscalização hoje?
              </span>
            </h1>
            <p className="text-lg md:text-xl max-w-3xl mx-auto mb-10 leading-relaxed" style={{ color: "#374151" }}>
              O BrainX ERP é o sistema industrial que coloca sua planta em conformidade com{" "}
              <strong style={{ color: "#0F172A" }}>ANVISA RDC 658/2022, BPF e Receita Federal</strong> —
              do XML da NF-e ao dossiê de lote assinado digitalmente pelo Responsável Técnico.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <Button asChild size="lg" className="h-12 px-7 text-base font-semibold text-white hover:opacity-90" style={{ background: "#0F172A" }}>
                <Link to="/auth?demo=1">
                  Quero testar 14 dias grátis <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-12 px-7 text-base font-semibold"
                style={{ borderColor: "#0F172A", color: "#0F172A", background: "transparent" }}
              >
                <a href="#modulos">Ver módulos</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium" style={{ color: "#374151" }}>
              <span className="flex items-center gap-1.5"><Lock className="h-4 w-4" style={{ color: "#1E3A5F" }} /> Dados isolados por tenant (Row Level Security)</span>
              <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" style={{ color: "#16A34A" }} /> Emissor NF-e homologado SEFAZ</span>
              <span className="flex items-center gap-1.5"><Factory className="h-4 w-4" style={{ color: "#1E3A5F" }} /> Desenvolvido para RDC 658/2022</span>
              <span className="flex items-center gap-1.5"><FileBadge2 className="h-4 w-4" style={{ color: "#1E3A5F" }} /> LGPD compliant</span>
            </div>
          </motion.div>

          {/* KPIs */}
          <motion.div {...fadeUp} transition={{ duration: 0.7, delay: 0.15 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-5xl mx-auto">
            {[
              { k: "ANVISA", v: "RDC 658/2022", icon: ShieldCheck },
              { k: "Fiscal", v: "NF-e + 5 anos", icon: FileCheck2 },
              { k: "BPF", v: "100% rastreável", icon: BadgeCheck },
              { k: "Multa evitada", v: "Até R$ 1,5M", icon: TrendingUp },
            ].map((s) => (
              <div
                key={s.k}
                className="rounded-xl p-5 text-center transition-colors"
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#0F172A")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#E5E7EB")}
              >
                <s.icon className="h-5 w-5 mx-auto mb-2" style={{ color: "#1E3A5F" }} />
                <div
                  className="text-[11px] uppercase font-bold"
                  style={{ color: "#6B7280", letterSpacing: "0.08em" }}
                >
                  {s.k}
                </div>
                <div className="font-bold mt-1" style={{ color: "#0F172A", fontSize: 24, lineHeight: 1.2 }}>{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* DOR — PAIN POINTS */}
      <section className="py-20" style={{ background: "#FFF8F8" }}>
        <div className="container max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-3" style={{ color: "#DC2626" }}>
              <AlertTriangle className="h-4 w-4" /> O que pode acontecer amanhã
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" style={{ color: "#0F172A" }}>
              Cada um destes erros pode <span style={{ color: "#DC2626" }}>parar sua fábrica</span>
            </h2>
            <p style={{ color: "#374151" }}>
              Auto de infração da ANVISA, multas de até R$ 1,5 milhão, interdição e recolhimento de lote.
              Não é dramatismo — é o que está acontecendo no setor de suplementos.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {riscos.map((r) => (
              <motion.div
                key={r.txt}
                {...fadeUp}
                className="rounded-lg p-5"
                style={{
                  background: "#FFFFFF",
                  borderLeft: "3px solid #DC2626",
                  border: "1px solid #E5E7EB",
                  borderLeftWidth: 3,
                  borderLeftColor: "#DC2626",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                }}
              >
                <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{r.txt}</p>
                <p className="text-xs font-bold mt-2" style={{ color: "#DC2626" }}>{r.multa}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÃO — MÓDULOS */}
      <section id="modulos" className="py-24" style={{ background: "#FFFFFF" }}>
        <div className="container max-w-7xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ background: "#EFF6FF", color: "#1E3A5F" }}>
              <Sparkles className="h-3.5 w-3.5" /> A solução
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold tracking-tight mb-4" style={{ color: "#0F172A" }}>
              Um único sistema. Toda a sua operação industrial sob controle.
            </h2>
            <p className="text-lg" style={{ color: "#374151" }}>
              Do recebimento da matéria-prima à emissão da NF-e de saída, com compliance ANVISA/BPF no coração de cada processo.
            </p>
          </motion.div>

          {/* GRUPO A — Core */}
          <div
            className="rounded-2xl p-6 md:p-8 mb-10"
            style={{ background: "#F0F9FF", border: "1px solid #BFDBFE" }}
          >
            <div className="flex items-center gap-2 mb-6">
              <ShieldAlert className="h-5 w-5" style={{ color: "#1E3A5F" }} />
              <h3 className="text-xl font-bold" style={{ color: "#0F172A" }}>Core Compliance</h3>
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: "#DCFCE7", color: "#15803D" }}>
                Módulos ANVISA / BPF
              </span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulosCore.map((m, i) => (
                <motion.div key={m.title} {...fadeUp} transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}>
                  <ModuleCard m={m} core />
                </motion.div>
              ))}
            </div>
          </div>

          {/* GRUPO B — Complementares */}
          <div>
            <div className="flex items-center gap-2 mb-6">
              <Boxes className="h-5 w-5" style={{ color: "#1E3A5F" }} />
              <h3 className="text-xl font-bold" style={{ color: "#0F172A" }}>Gestão Industrial Completa</h3>
              <span className="text-xs font-medium" style={{ color: "#6B7280" }}>· Módulos complementares</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {modulosComplementares.map((m, i) => (
                <motion.div key={m.title} {...fadeUp} transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}>
                  <ModuleCard m={m} />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* COMPLIANCE BLOCK */}
      <section id="compliance" className="py-24 overflow-hidden" style={{ background: "#F8FAFC" }}>
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-4" style={{ background: "#DCFCE7", color: "#15803D" }}>
                <ShieldCheck className="h-3.5 w-3.5" /> Auditoria ANVISA aprovada
              </div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight mb-5" style={{ color: "#0F172A" }}>
                Compliance não é planilha. É arquitetura.
              </h2>
              <p className="mb-6 leading-relaxed" style={{ color: "#374151" }}>
                Cada decisão técnica do BrainX foi desenhada para resistir a uma fiscalização real.
                Quarentena obrigatória, assinatura criptográfica do RT, dossiê com QR público de auditoria, isolamento total entre tenants.
              </p>
              <ul className="space-y-3" style={{ rowGap: 12 }}>
                {[
                  "Lotes em QUARENTENA até COA aprovado pelo Responsável Técnico",
                  "Assinatura digital SHA-256 do RT em cada liberação de lote",
                  "Dossiê A4 unificado: OP + matéria-prima + COA + CAPA + RT",
                  "QR Code público read-only para auditor escanear in loco",
                  "Alerta vermelho automático para substâncias da IN 28/2018",
                  "Trilha de auditoria imutável (registrarAuditoria) em cada ação",
                  "Multi-tenant com Row Level Security — zero vazamento entre empresas",
                ].map((t) => (
                  <li key={t} className="flex gap-3 text-sm">
                    <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" style={{ color: "#16A34A" }} />
                    <span style={{ color: "#374151" }}>{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="mt-16 md:mt-0 w-full max-w-md mx-auto md:max-w-none">
              <Card
                className="overflow-hidden bg-white"
                style={{ border: "1px solid #E5E7EB", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
              >
                <div className="p-6 border-b" style={{ background: "#F8FAFC", borderColor: "#E5E7EB" }}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-5 w-5" style={{ color: "#1E3A5F" }} />
                      <span className="font-bold text-sm" style={{ color: "#0F172A" }}>Dossiê de Lote · LT-2026-001847</span>
                    </div>
                    <span className="w-fit text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider" style={{ background: "#DCFCE7", color: "#15803D" }}>Liberado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><div style={{ color: "#6B7280" }}>Produto</div><div className="font-bold text-[13px] break-words" style={{ color: "#0F172A" }}>Vitamina D3 2000 UI</div></div>
                    <div><div style={{ color: "#6B7280" }}>Validade</div><div className="font-bold text-[13px]" style={{ color: "#0F172A" }}>12/2027</div></div>
                    <div><div style={{ color: "#6B7280" }}>RT (CRF)</div><div className="font-bold text-[13px]" style={{ color: "#0F172A" }}>Dra. M. Almeida</div></div>
                    <div><div style={{ color: "#6B7280" }}>Assinado em</div><div className="font-bold text-[13px]" style={{ color: "#0F172A" }}>05/06/2026 14:32</div></div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-3 bg-white">
                  {[
                    { l: "COA upload + validação", ok: true },
                    { l: "Pesagem dupla de ativos <1mg", ok: true },
                    { l: "Pré-mix geométrico registrado", ok: true },
                    { l: "Temperatura ambiental 21-24 °C", ok: true },
                    { l: "Hash SHA-256 do dossiê gerado", ok: true },
                  ].map((s) => (
                    <div key={s.l} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4" style={{ color: "#16A34A" }} />
                      <span style={{ color: "#374151" }}>{s.l}</span>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t flex items-center justify-between" style={{ borderColor: "#E5E7EB" }}>
                    <div className="flex items-center gap-2 text-xs" style={{ color: "#6B7280" }}>
                      <QrCode className="h-4 w-4" /> Auditoria pública
                    </div>
                    <span className="text-[10px] font-mono" style={{ color: "#6B7280" }}>brainxerp.com/audit/lote/...</span>
                  </div>
                </CardContent>
              </Card>
              <p className="text-center text-xs mt-4" style={{ color: "#6B7280" }}>
                Documento gerado automaticamente pelo BrainX · Auditável a qualquer momento via QR
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-24" style={{ background: "#FFFFFF" }}>
        <div className="container max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ background: "#EFF6FF", color: "#1E3A5F" }}>
              <Zap className="h-3.5 w-3.5" /> Comece em minutos
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: "#0F172A" }}>Do XML ao dossiê em 3 passos</h2>
            <p style={{ color: "#374151" }}>Sem implantação eterna. Sem consultor. Sem planilha intermediária.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {passos.map((p, i) => (
              <motion.div key={p.n} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}>
                <Card className="h-full bg-white" style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <CardContent className="p-7 relative overflow-hidden">
                    <span
                      aria-hidden
                      className="absolute font-black select-none pointer-events-none"
                      style={{
                        color: "#E5E7EB",
                        fontSize: 140,
                        lineHeight: 1,
                        top: -10,
                        right: -4,
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {p.n}
                    </span>
                    <div className="relative">
                      <h3 className="font-bold text-lg mb-2" style={{ color: "#0F172A" }}>{p.title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: "#374151" }}>{p.desc}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-24" style={{ background: "#F8FAFC" }}>
        <div className="container max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: "#0F172A" }}>Indústrias que dormem tranquilas</h2>
            <div className="flex items-center justify-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5" style={{ fill: "#F59E0B", color: "#F59E0B" }} />)}
            </div>
            <p style={{ color: "#374151" }}>Empresas reais que trocaram a planilha pelo compliance industrial.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {depoimentos.map((d, i) => (
              <motion.div key={d.nome + i} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }}>
                <Card className="h-full bg-white" style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                  <CardContent className="p-6">
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(5)].map((_, k) => <Star key={k} className="h-3.5 w-3.5" style={{ fill: "#F59E0B", color: "#F59E0B" }} />)}
                    </div>
                    <p className="text-sm leading-relaxed mb-5 italic" style={{ color: "#374151" }}>"{d.txt}"</p>
                    <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: "#E5E7EB" }}>
                      <div
                        className="flex items-center justify-center text-white font-bold"
                        style={{ background: d.bg, width: 44, height: 44, borderRadius: "50%", fontSize: 16 }}
                      >
                        {d.inicial}
                      </div>
                      <div>
                        <div className="text-sm font-bold leading-tight" style={{ color: "#0F172A" }}>{d.nome}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: "#6B7280" }}>{d.cargo}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* PLANOS / CTA SCARCITY */}
      <section id="planos" className="py-24" style={{ background: "#FFFFFF" }}>
        <div className="container max-w-5xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3" style={{ background: "#FEF3C7", color: "#B45309" }}>
              <Clock className="h-3.5 w-3.5" /> Vagas limitadas · 14 dias grátis
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: "#0F172A" }}>
              Comece grátis. Sem cartão. Sem letra miúda.
            </h2>
            <p style={{ color: "#374151" }}>
              Por questão de qualidade de onboarding, liberamos um número limitado de demos por semana.
              Garanta a sua agora.
            </p>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="grid md:grid-cols-2 gap-5">
            <Card className="bg-white" style={{ border: "1px solid #E5E7EB", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
              <CardContent className="p-7">
                <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#6B7280" }}>Trial</div>
                <div className="text-3xl font-black mb-1" style={{ color: "#0F172A" }}>Grátis</div>
                <p className="text-sm mb-5" style={{ color: "#374151" }}>14 dias completos · todos os módulos</p>
                <ul className="space-y-2.5 text-sm mb-6" style={{ color: "#374151" }}>
                  {["Todos os módulos liberados", "Suporte humano em PT-BR", "Importação de XMLs ilimitada", "Sem cartão de crédito"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#16A34A" }} />{t}</li>
                  ))}
                </ul>
                <Button
                  asChild
                  variant="outline"
                  className="w-full transition-colors duration-200"
                  style={{ borderColor: "#0F172A", color: "#0F172A", background: "transparent" }}
                  onMouseEnter={(e: any) => { e.currentTarget.style.background = "#0F172A"; e.currentTarget.style.color = "#FFFFFF"; }}
                  onMouseLeave={(e: any) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#0F172A"; }}
                >
                  <Link to="/auth?demo=1">Começar trial gratuito</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="bg-white relative overflow-hidden" style={{ border: "2px solid #0F172A", boxShadow: "0 10px 40px rgba(15,23,42,0.15)" }}>
              <div className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full text-white font-bold uppercase tracking-wider" style={{ background: "#0F172A" }}>Mais escolhido</div>
              <CardContent className="p-7">
                <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: "#1E3A5F" }}>Industrial</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black" style={{ color: "#0F172A" }}>Sob consulta</span>
                </div>
                <p className="text-sm mb-2" style={{ color: "#374151" }}>Para indústrias com compliance ANVISA/BPF</p>
                <p className="mb-5" style={{ fontSize: 13, color: "#6B7280" }}>
                  Planos a partir de R$ 890/mês · Baseado em volume de OPs e SKUs
                </p>
                <ul className="space-y-2.5 text-sm mb-6" style={{ color: "#374151" }}>
                  {["Tudo do Trial +", "Multi-usuário com RBAC granular", "Assinatura digital do RT (SHA-256)", "Suporte prioritário + onboarding 1:1", "SLA de implantação 7 dias"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#16A34A" }} />{t}</li>
                  ))}
                </ul>
                <Button asChild className="w-full text-white hover:opacity-90" style={{ background: "#0F172A" }}>
                  <Link to="/auth?demo=1">Falar com especialista <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
          <p className="text-center mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1" style={{ fontSize: 12, color: "#6B7280" }}>
            <Lock className="h-3.5 w-3.5 inline" /> Sem fidelidade · Cancele quando quiser · Dados exportáveis a qualquer momento · Emissor NF-e homologado em ambiente de produção SEFAZ
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24" style={{ background: "#F8FAFC" }}>
        <div className="container max-w-3xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3" style={{ color: "#0F172A" }}>Perguntas frequentes</h2>
            <p style={{ color: "#374151" }}>Tudo que indústrias perguntam antes de fechar.</p>
          </motion.div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <motion.details
                key={f.q}
                {...fadeUp}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group rounded-xl bg-white transition-all duration-200"
                style={{ border: "1px solid #E5E7EB" }}
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5 font-semibold" style={{ color: "#0F172A" }}>
                  <span>{f.q}</span>
                  <Plus className="h-4 w-4 shrink-0 group-open:hidden transition-all duration-200" style={{ color: "#6B7280" }} />
                  <Minus className="h-4 w-4 shrink-0 hidden group-open:block transition-all duration-200" style={{ color: "#0F172A" }} />
                </summary>
                <div className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "#374151" }}>{f.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24" style={{ background: "#FFFFFF" }}>
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-6" style={{ border: "1px solid #DC2626", background: "#FEF2F2", color: "#DC2626" }}>
              <AlertOctagon className="h-3.5 w-3.5" /> A próxima fiscalização não avisa
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5" style={{ color: "#0F172A" }}>
              Você prefere agir agora ou explicar depois?
            </h2>
            <p className="text-lg max-w-2xl mx-auto mb-8" style={{ color: "#374151" }}>
              Em 7 dias sua planta pode estar 100% rastreada, com assinatura digital do RT e dossiê pronto para auditoria.
              O custo de não ter o BrainX é alto demais.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-7 text-base font-semibold text-white hover:opacity-90" style={{ background: "#0F172A" }}>
                <Link to="/auth?demo=1">Agendar demonstração técnica <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base font-semibold" style={{ borderColor: "#0F172A", color: "#0F172A", background: "transparent" }}>
                <Link to="/auth">Já tenho conta · Entrar</Link>
              </Button>
            </div>
            <p className="mt-6" style={{ fontSize: 13, color: "#6B7280" }}>
              Demonstração de 30 min com especialista · Sem compromisso · Respondemos em até 2h úteis
            </p>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#F8FAFC", borderTop: "1px solid #E5E7EB" }}>
        <div className="container max-w-7xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-5 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src={brainxLogo} alt="BrainX ERP" className="h-9 w-9 object-contain rounded" />
                <div className="flex flex-col leading-tight">
                  <span className="font-bold text-base" style={{ color: "#0F172A" }}>BrainX ERP</span>
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "#6B7280" }}>Industrial Compliance</span>
                </div>
              </div>
              <p className="text-sm max-w-md leading-relaxed mb-3" style={{ color: "#374151" }}>
                ERP industrial com compliance ANVISA/BPF nativo, do XML da NF-e ao dossiê de lote assinado pelo RT.
              </p>
              <a href="mailto:contato@brainxerp.com.br" className="text-sm flex items-center gap-2 mb-1 hover:opacity-70" style={{ color: "#0F172A" }}>
                <Mail className="h-4 w-4" /> contato@brainxerp.com.br
              </a>
              <p className="text-xs mt-2" style={{ color: "#6B7280" }}>© 2026 BrainX ERP · Todos os direitos reservados</p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3" style={{ color: "#0F172A" }}>Produto</h4>
              <ul className="space-y-2 text-sm" style={{ color: "#374151" }}>
                <li><a href="#modulos" className="hover:opacity-70">Módulos</a></li>
                <li><a href="#compliance" className="hover:opacity-70">Compliance</a></li>
                <li><a href="#planos" className="hover:opacity-70">Planos</a></li>
                <li><a href="#faq" className="hover:opacity-70">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3" style={{ color: "#0F172A" }}>Empresa</h4>
              <ul className="space-y-2 text-sm" style={{ color: "#374151" }}>
                <li><Link to="/auth" className="hover:opacity-70">Entrar</Link></li>
                <li><Link to="/auth?demo=1" className="hover:opacity-70">Ver demonstração</Link></li>
                <li><Link to="/legal/termos" className="hover:opacity-70">Termos</Link></li>
                <li><Link to="/legal/privacidade" className="hover:opacity-70">Privacidade</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3" style={{ color: "#0F172A" }}>Conformidade</h4>
              <ul className="space-y-2 text-sm" style={{ color: "#374151" }}>
                <li><a href="#compliance" className="hover:opacity-70">ANVISA RDC 658/2022</a></li>
                <li><a href="#compliance" className="hover:opacity-70">BPF Suplementos</a></li>
                <li><Link to="/legal/privacidade" className="hover:opacity-70">Política de Privacidade</Link></li>
                <li><Link to="/legal/termos" className="hover:opacity-70">Termos de Uso</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs" style={{ borderTop: "1px solid #E5E7EB", color: "#6B7280" }}>
            <div>BrainX ERP · Industrial Compliance Platform</div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> LGPD compliant</span>
              <span className="flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> Hospedagem nacional</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}