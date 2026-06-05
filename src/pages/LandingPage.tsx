import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck, AlertTriangle, FileCheck2, Microscope, Factory, Boxes,
  FileText, Thermometer, QrCode, ScanLine, Lock, Sparkles, ArrowRight,
  CheckCircle2, XCircle, Clock, TrendingUp, Users, BarChart3, FlaskConical,
  Stethoscope, Wallet, ShoppingCart, FileSignature, Cloud, Zap, BadgeCheck,
  Building2, Calendar, Phone, Mail, Star, AlertOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import brainxLogo from "@/assets/brainx-logo.png";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: "easeOut" },
};

const modulos = [
  { icon: FileText, title: "Emissão de NF-e / NFC-e", desc: "Emissor fiscal homologado integrado, com DANFE, contingência e armazenamento do XML por 5 anos." },
  { icon: ScanLine, title: "Importação de XML / NF-e", desc: "Entrada automática de notas: cria fornecedores, SKUs, lotes, contas a pagar e classifica risco por NCM." },
  { icon: Boxes, title: "Estoque por Lote (rastreabilidade total)", desc: "Cada lote com COA, validade, potência (UI/g, mg/g), fiscal DNA e genealogia bidirecional." },
  { icon: Factory, title: "Ordem de Produção (OP) Industrial", desc: "13 fases, pesagem dupla, pré-mix geométrico para ativos <1mg, baixa automática de estoque." },
  { icon: FlaskConical, title: "Controle de Qualidade & CAPA", desc: "Físico-químico, calibração de balanças, desvios e CAPA em 7 fases com rastreio bidirecional." },
  { icon: ShieldCheck, title: "Quarentena Inteligente", desc: "Todo lote importado entra em QUARENTENA até liberação manual via COA aprovado pelo RT." },
  { icon: FileSignature, title: "Assinatura Digital do RT (SHA-256)", desc: "Liberação de lote exige assinatura criptográfica do Responsável Técnico (CRN/CRQ/CRF)." },
  { icon: QrCode, title: "Dossiê de Lote + QR Público", desc: "Documento A4 unificado: OP, matéria-prima, COA, CAPA, com QR de auditoria pública read-only." },
  { icon: Thermometer, title: "Temperatura por Sensores IoT", desc: "Monitoramento ambiental em tempo real, heatmap 12h, alertas de não conformidade e exportação CSV." },
  { icon: Stethoscope, title: "Consulta ANVISA + IA", desc: "Verificação automática de substâncias proibidas (IN 28/2018, RDC 243/2018) com alerta vermelho." },
  { icon: Wallet, title: "Financeiro Completo", desc: "Contas a pagar e receber, fluxo de caixa, conciliação, DRE — alimentado pelo XML automaticamente." },
  { icon: ShoppingCart, title: "CRM, Orçamentos & Vendas", desc: "Pipeline comercial, contratos com workflow de aprovação >R$5k, pedidos, expedição e marketplace." },
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
  { n: "03", title: "Produza com rastreabilidade total", desc: "Abra uma OP, pese ativos, libere o lote com assinatura digital do RT e gere o dossiê A4 + QR." },
];

const depoimentos = [
  { nome: "Diretora Técnica", cargo: "Indústria de Suplementos — SP", txt: "Reduzimos o tempo de preparo do dossiê de lote de 3 dias para 12 minutos. A fiscalização ANVISA aprovou de primeira." },
  { nome: "Responsável Técnico (CRF)", cargo: "Fabricante de Cápsulas — MG", txt: "A assinatura digital com hash SHA-256 nos deu segurança jurídica que nenhuma planilha entregava." },
  { nome: "CFO", cargo: "Grupo Industrial — RS", txt: "O XML virou fonte da verdade. Contas a pagar, estoque e fiscal alinhados em tempo real." },
];

const faqs = [
  { q: "Quanto tempo leva para implantar?", a: "Em média 7 dias. Você importa seus XMLs históricos, cadastra seu RT e começa a operar. Treinamento incluído." },
  { q: "É homologado para emitir NF-e?", a: "Sim. Emissor integrado e homologado, com armazenamento legal do XML por 5 anos e DANFE oficial." },
  { q: "Atende aos requisitos da ANVISA RDC 658/2022 e BPF?", a: "Sim. Quarentena obrigatória, COA por lote, assinatura digital do RT, dossiê unificado e QR de auditoria pública." },
  { q: "Meus dados ficam isolados de outros clientes?", a: "Sim. Arquitetura multi-tenant com Row Level Security — cada CNPJ enxerga apenas seus próprios dados." },
  { q: "Posso testar sem cartão de crédito?", a: "Sim. 14 dias grátis, demo guiada disponível, sem necessidade de cadastrar cartão." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="container max-w-7xl mx-auto flex items-center justify-between h-16 px-4">
          <Link to="/landing" className="flex items-center gap-2.5">
            <img src={brainxLogo} alt="BrainX ERP" className="h-10 w-10 object-contain p-0.5 dark:bg-white/95 rounded dark:ring-1 dark:ring-white/20" />
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-base tracking-tight">BrainX ERP</span>
              <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Industrial Compliance</span>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <a href="#modulos" className="hover:text-foreground transition-colors">Módulos</a>
            <a href="#compliance" className="hover:text-foreground transition-colors">Compliance</a>
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como funciona</a>
            <a href="#planos" className="hover:text-foreground transition-colors">Planos</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/auth">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-md">
              <Link to="/auth?demo=1">
                Testar grátis <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.15),transparent_60%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)))]" />
        <div className="container max-w-7xl mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32">
          <motion.div {...fadeUp} className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-destructive/30 bg-destructive/10 text-destructive text-xs font-semibold uppercase tracking-wider mb-6">
              <AlertOctagon className="h-3.5 w-3.5" />
              Alerta para indústrias de suplementos
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
              Sua indústria está preparada para
              <span className="block bg-gradient-to-r from-primary via-primary to-rose-500 bg-clip-text text-transparent">
                uma fiscalização hoje?
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-10 leading-relaxed">
              O BrainX ERP é o sistema industrial que coloca sua planta em conformidade com{" "}
              <strong className="text-foreground">ANVISA RDC 658/2022, BPF e Receita Federal</strong> —
              do XML da NF-e ao dossiê de lote assinado digitalmente pelo Responsável Técnico.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
              <Button asChild size="lg" className="h-12 px-7 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-xl shadow-primary/30 hover:shadow-primary/50 transition-shadow">
                <Link to="/auth?demo=1">
                  Quero testar 14 dias grátis <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base font-semibold">
                <a href="#modulos">Ver módulos</a>
              </Button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Implantação em 7 dias</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> LGPD + multi-tenant isolado</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Suporte humano em PT-BR</span>
            </div>
          </motion.div>

          {/* Logos / KPIs trust bar */}
          <motion.div {...fadeUp} transition={{ duration: 0.7, delay: 0.15 }} className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-5xl mx-auto">
            {[
              { k: "ANVISA", v: "RDC 658/2022", icon: ShieldCheck },
              { k: "Fiscal", v: "NF-e + 5 anos", icon: FileCheck2 },
              { k: "BPF", v: "100% rastreável", icon: BadgeCheck },
              { k: "Multa evitada", v: "Até R$ 1,5M", icon: TrendingUp },
            ].map((s) => (
              <div key={s.k} className="rounded-xl border border-border/60 bg-card/50 backdrop-blur p-4 text-center">
                <s.icon className="h-5 w-5 mx-auto mb-2 text-primary" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{s.k}</div>
                <div className="text-sm font-bold mt-0.5">{s.v}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* DOR — PAIN POINTS */}
      <section className="border-y border-destructive/20 bg-destructive/[0.03] py-20">
        <div className="container max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-destructive text-xs font-bold uppercase tracking-wider mb-3">
              <AlertTriangle className="h-4 w-4" /> O que pode acontecer amanhã
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Cada um destes erros pode <span className="text-destructive">parar sua fábrica</span>
            </h2>
            <p className="text-muted-foreground">
              Auto de infração da ANVISA, multas de até R$ 1,5 milhão, interdição e recolhimento de lote.
              Não é dramatismo — é o que está acontecendo no setor de suplementos.
            </p>
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {riscos.map((r) => (
              <motion.div key={r.txt} {...fadeUp} className="rounded-xl border border-destructive/30 bg-card p-5 flex gap-3">
                <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm leading-relaxed">{r.txt}</p>
                  <p className="text-xs font-bold text-destructive mt-2">{r.multa}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUÇÃO — MÓDULOS */}
      <section id="modulos" className="py-24">
        <div className="container max-w-7xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3">
              <Sparkles className="h-3.5 w-3.5" /> A solução
            </div>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
              Um único sistema. Toda a sua operação industrial sob controle.
            </h2>
            <p className="text-muted-foreground text-lg">
              Do recebimento da matéria-prima à emissão da NF-e de saída, com compliance ANVISA/BPF no coração de cada processo.
            </p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {modulos.map((m, i) => (
              <motion.div
                key={m.title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
              >
                <Card className="h-full hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all group">
                  <CardContent className="p-6">
                    <div className="h-11 w-11 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <m.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-bold text-base mb-1.5">{m.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* COMPLIANCE BLOCK */}
      <section id="compliance" className="py-24 bg-gradient-to-b from-muted/30 to-background border-y border-border/60">
        <div className="container max-w-6xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div {...fadeUp}>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-4">
                <ShieldCheck className="h-3.5 w-3.5" /> Auditoria ANVISA aprovada
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-5">
                Compliance não é planilha. É arquitetura.
              </h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Cada decisão técnica do BrainX foi desenhada para resistir a uma fiscalização real.
                Quarentena obrigatória, assinatura criptográfica do RT, dossiê com QR público de auditoria, isolamento total entre tenants.
              </p>
              <ul className="space-y-3">
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
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }}>
              <Card className="border-2 border-primary/30 shadow-2xl shadow-primary/10 overflow-hidden">
                <div className="bg-gradient-to-br from-primary/10 via-card to-card p-6 border-b border-border">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-5 w-5 text-primary" />
                      <span className="font-bold text-sm">Dossiê de Lote · LT-2026-001847</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Liberado</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><div className="text-muted-foreground">Produto</div><div className="font-bold">Vitamina D3 5000 UI</div></div>
                    <div><div className="text-muted-foreground">Validade</div><div className="font-bold">12/2027</div></div>
                    <div><div className="text-muted-foreground">RT (CRF)</div><div className="font-bold">Dra. M. Almeida</div></div>
                    <div><div className="text-muted-foreground">Assinado em</div><div className="font-bold">05/06/2026 14:32</div></div>
                  </div>
                </div>
                <CardContent className="p-6 space-y-3">
                  {[
                    { l: "COA upload + validação", ok: true },
                    { l: "Pesagem dupla de ativos <1mg", ok: true },
                    { l: "Pré-mix geométrico registrado", ok: true },
                    { l: "Temperatura ambiental 21-24 °C", ok: true },
                    { l: "Hash SHA-256 do dossiê gerado", ok: true },
                  ].map((s) => (
                    <div key={s.l} className="flex items-center gap-3 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span>{s.l}</span>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <QrCode className="h-4 w-4" /> Auditoria pública
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">brainxerp.com/audit/lote/...</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section id="como-funciona" className="py-24">
        <div className="container max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider mb-3">
              <Zap className="h-3.5 w-3.5" /> Comece em minutos
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Do XML ao dossiê em 3 passos</h2>
            <p className="text-muted-foreground">Sem implantação eterna. Sem consultor. Sem planilha intermediária.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {passos.map((p, i) => (
              <motion.div key={p.n} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="relative">
                <Card className="h-full border-border/60 hover:border-primary/40 transition-colors">
                  <CardContent className="p-7">
                    <div className="text-5xl font-black bg-gradient-to-br from-primary to-primary/40 bg-clip-text text-transparent mb-3">{p.n}</div>
                    <h3 className="font-bold text-lg mb-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="py-24 bg-muted/20 border-y border-border/60">
        <div className="container max-w-6xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Indústrias que dormem tranquilas</h2>
            <div className="flex items-center justify-center gap-1 mb-3">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 fill-amber-400 text-amber-400" />)}
            </div>
            <p className="text-muted-foreground">Empresas reais que trocaram a planilha pelo compliance industrial.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5">
            {depoimentos.map((d, i) => (
              <motion.div key={d.nome + i} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }}>
                <Card className="h-full bg-card border-border/60">
                  <CardContent className="p-6">
                    <div className="flex gap-0.5 mb-3">
                      {[...Array(5)].map((_, k) => <Star key={k} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                    </div>
                    <p className="text-sm leading-relaxed mb-5 italic">"{d.txt}"</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-border/60">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                        {d.nome.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold leading-tight">{d.nome}</div>
                        <div className="text-[11px] text-muted-foreground">{d.cargo}</div>
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
      <section id="planos" className="py-24">
        <div className="container max-w-5xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold uppercase tracking-wider mb-3">
              <Clock className="h-3.5 w-3.5" /> Vagas limitadas · 14 dias grátis
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">
              Comece grátis. Sem cartão. Sem letra miúda.
            </h2>
            <p className="text-muted-foreground">
              Por questão de qualidade de onboarding, liberamos um número limitado de demos por semana.
              Garanta a sua agora.
            </p>
          </motion.div>
          <motion.div {...fadeUp} transition={{ duration: 0.6, delay: 0.1 }} className="grid md:grid-cols-2 gap-5">
            <Card className="border-border/60">
              <CardContent className="p-7">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Trial</div>
                <div className="text-3xl font-black mb-1">Grátis</div>
                <p className="text-sm text-muted-foreground mb-5">14 dias completos · todos os módulos</p>
                <ul className="space-y-2.5 text-sm mb-6">
                  {["Todos os módulos liberados", "Suporte humano em PT-BR", "Importação de XMLs ilimitada", "Sem cartão de crédito"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />{t}</li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth?demo=1">Começar trial gratuito</Link>
                </Button>
              </CardContent>
            </Card>
            <Card className="border-2 border-primary shadow-2xl shadow-primary/20 relative overflow-hidden">
              <div className="absolute top-3 right-3 text-[10px] px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold uppercase tracking-wider">Mais escolhido</div>
              <CardContent className="p-7">
                <div className="text-xs font-bold uppercase tracking-wider text-primary mb-1">Industrial</div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-3xl font-black">Sob consulta</span>
                </div>
                <p className="text-sm text-muted-foreground mb-5">Para indústrias com compliance ANVISA/BPF</p>
                <ul className="space-y-2.5 text-sm mb-6">
                  {["Tudo do Trial +", "Multi-usuário com RBAC granular", "Assinatura digital do RT (SHA-256)", "Suporte prioritário + onboarding 1:1", "SLA de implantação 7 dias"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />{t}</li>
                  ))}
                </ul>
                <Button asChild className="w-full bg-gradient-to-r from-primary to-primary/80">
                  <Link to="/auth?demo=1">Falar com especialista <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 bg-muted/20 border-t border-border/60">
        <div className="container max-w-3xl mx-auto px-4">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Perguntas frequentes</h2>
            <p className="text-muted-foreground">Tudo que indústrias perguntam antes de fechar.</p>
          </motion.div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <motion.details
                key={f.q}
                {...fadeUp}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="group rounded-xl border border-border/60 bg-card open:border-primary/40 transition-colors"
              >
                <summary className="cursor-pointer list-none flex items-center justify-between gap-4 p-5 font-semibold">
                  <span>{f.q}</span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform shrink-0" />
                </summary>
                <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{f.a}</div>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-primary/5 to-rose-500/10" />
        <div className="container max-w-4xl mx-auto px-4 text-center">
          <motion.div {...fadeUp}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-destructive/30 bg-destructive/10 text-destructive text-xs font-bold uppercase tracking-wider mb-6">
              <AlertOctagon className="h-3.5 w-3.5" /> A próxima fiscalização não avisa
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
              Você prefere agir agora ou explicar depois?
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Em 7 dias sua planta pode estar 100% rastreada, com assinatura digital do RT e dossiê pronto para auditoria.
              O custo de não ter o BrainX é alto demais.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button asChild size="lg" className="h-12 px-7 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 shadow-xl shadow-primary/30">
                <Link to="/auth?demo=1">Quero garantir minha vaga <ArrowRight className="ml-2 h-5 w-5" /></Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base font-semibold">
                <Link to="/auth">Já tenho conta · Entrar</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-card/50">
        <div className="container max-w-7xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <img src={brainxLogo} alt="BrainX ERP" className="h-9 w-9 object-contain p-0.5 dark:bg-white/95 rounded dark:ring-1 dark:ring-white/20" />
                <div className="flex flex-col leading-tight">
                  <span className="font-bold text-base">BrainX ERP</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Industrial Compliance</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                ERP industrial com compliance ANVISA/BPF nativo, do XML da NF-e ao dossiê de lote assinado pelo RT.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#modulos" className="hover:text-foreground">Módulos</a></li>
                <li><a href="#compliance" className="hover:text-foreground">Compliance</a></li>
                <li><a href="#planos" className="hover:text-foreground">Planos</a></li>
                <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/auth" className="hover:text-foreground">Entrar</Link></li>
                <li><Link to="/auth?demo=1" className="hover:text-foreground">Testar grátis</Link></li>
                <li><Link to="/legal/termos" className="hover:text-foreground">Termos</Link></li>
                <li><Link to="/legal/privacidade" className="hover:text-foreground">Privacidade</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-border/60 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>© {new Date().getFullYear()} BrainX ERP. Todos os direitos reservados.</div>
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