import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download, FileText, Shield } from "lucide-react";
import brainxLogo from "@/assets/brainx-logo.png";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface POPVisualizerProps {
  pop: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const POP_CONTENTS: Record<string, any> = {
  A_HIGIENIZACAO: {
    objetivo: "Estabelecer procedimentos para higienização de equipamentos e utensílios, visando evitar a contaminação cruzada e garantir a segurança dos produtos fabricados.",
    campo_aplicacao: "Aplica-se a todos os setores de produção e áreas de manipulação direta.",
    responsaveis: "Auxiliares de produção e supervisores de qualidade.",
    materiais: "Detergente neutro hospitalar, álcool 70%, panos descartáveis, escovas de cerdas macias.",
    procedimento: [
      "Retirar resíduos sólidos grosseiros com auxílio de espátula ou papel descartável.",
      "Lavar com solução de detergente neutro e água potável.",
      "Enxaguar abundantemente até a remoção completa do detergente.",
      "Aplicar álcool 70% por aspersão e deixar secar naturalmente.",
      "Verificar visualmente a ausência de resíduos ou odores."
    ],
    monitoramento: "Inspeção visual antes de cada turno e teste de swab semanal.",
    acoes_corretivas: "Refazer a higienização imediata em caso de não conformidade.",
    verificacao: "Supervisão da qualidade via check-list diário.",
    registros: "Planilha de Controle de Higienização (MOD-HIG-001).",
    referencias: "RDC 275/2002, RDC 658/2022."
  },
  B_PRAGAS: {
    objetivo: "Implementar medidas preventivas e corretivas de controle integrado de pragas e vetores.",
    campo_aplicacao: "Toda a unidade fabril e áreas externas.",
    responsaveis: "Equipe de manutenção e empresa terceirizada especializada.",
    materiais: "Iscas atrativas (em locais seguros), armadilhas luminosas, telas milimétricas.",
    procedimento: [
      "Manter portas e janelas fechadas ou teladas.",
      "Vistoriar semanalmente os pontos de iscagem externos.",
      "Realizar a limpeza perimetral externa (afastamento de mato e entulhos).",
      "Monitorar armadilhas luminosas para insetos voadores.",
      "Executar desinsetização trimestral por empresa certificada."
    ],
    monitoramento: "Vistorias semanais e relatórios mensais da terceirizada.",
    acoes_corretivas: "Instalação de barreiras físicas extras ou reforço químico localizado.",
    verificacao: "Certificados de execução e vistorias técnicas.",
    registros: "Relatório de Controle Integrado de Pragas.",
    referencias: "RDC 275/2002."
  },
  C_AGUA: {
    objetivo: "Garantir a potabilidade da água utilizada no processo industrial e higienização.",
    campo_aplicacao: "Reservatórios central e pontos de uso.",
    responsaveis: "Manutenção e laboratório de controle de qualidade.",
    materiais: "Kit de medição de cloro residual, frascos estéreis para coleta.",
    procedimento: [
      "Medir o teor de cloro residual livre diariamente (ideal entre 0,5 e 2,0 ppm).",
      "Verificar a integridade das tampas dos reservatórios mensalmente.",
      "Realizar limpeza e desinfecção semestral das caixas d'água.",
      "Coletar amostra para análise físico-química e microbiológica completa semestralmente."
    ],
    monitoramento: "Controle diário de cloro e pH.",
    acoes_corretivas: "Interrupção do uso e cloração de choque se fora dos padrões.",
    verificacao: "Laudos laboratoriais externos.",
    registros: "Planilha de Controle de Potabilidade da Água.",
    referencias: "Portaria GM/MS 888/2021."
  },
  D_MANIPULADORES: {
    objetivo: "Padronizar o comportamento e a higiene pessoal dos colaboradores.",
    campo_aplicacao: "Todos os funcionários que acessam a área produtiva.",
    responsaveis: "Recursos Humanos e Garantia da Qualidade.",
    materiais: "Uniformes completos, toucas, máscaras (se necessário), sabonete antisséptico.",
    procedimento: [
      "Lavar as mãos seguindo a técnica correta ao entrar na área e após cada interrupção.",
      "Utilizar uniforme limpo e trocado diariamente.",
      "Manter unhas curtas, limpas e sem esmalte.",
      "É proibido o uso de adornos (anéis, relógios, brincos) na produção.",
      "Relatar qualquer sintoma de enfermidade (tosse, febre, lesões cutâneas)."
    ],
    monitoramento: "Acompanhamento diário na entrada do turno.",
    acoes_corretivas: "Afastamento temporário ou treinamento de reciclagem.",
    verificacao: "Exames de saúde (ASO) anuais.",
    registros: "Controle de Higiene e Comportamento Pessoal.",
    referencias: "RDC 275/2002."
  },
  E_CALIBRACAO: {
    objetivo: "Assegurar a confiabilidade das medições dos equipamentos críticos.",
    campo_aplicacao: "Balanças, termômetros e medidores de pH.",
    responsaveis: "Metrologia interna e laboratórios acreditados RBC.",
    materiais: "Pesos padrão certificados, termômetro padrão.",
    procedimento: [
      "Realizar calibração diária (ajuste/verificação) antes do uso.",
      "Identificar equipamentos com etiquetas de calibração vigentes.",
      "Manter os equipamentos em superfícies estáveis e niveladas.",
      "Executar calibração externa anual por laboratório certificado."
    ],
    monitoramento: "Check-list diário de pesagem e temperatura.",
    acoes_corretivas: "Bloqueio do equipamento e recalibração imediata.",
    verificacao: "Certificados de calibração externos.",
    registros: "Plano Mestre de Calibração.",
    referencias: "RDC 658/2022."
  },
  F_TEMPERATURA: {
    objetivo: "Monitorar e registrar as condições ambientais de armazenamento e produção.",
    campo_aplicacao: "Almoxarifados, salas limpas e expedição.",
    responsaveis: "Supervisores de setor e sistema IoT automatizado.",
    materiais: "Dataloggers calibrados, sensores IoT BrainX.",
    procedimento: [
      "Registrar a temperatura e umidade a cada 1 hora via sistema.",
      "Verificar alarmes de desvio no painel central.",
      "Manter a umidade relativa abaixo de 60% em áreas de pós.",
      "Garantir temperatura entre 15°C e 25°C nos estoques."
    ],
    monitoramento: "Monitoramento contínuo com geração de gráficos diários.",
    acoes_corretivas: "Ajuste de HVAC ou remanejamento de carga se necessário.",
    verificacao: "Relatórios mensais de telemetria.",
    registros: "Mapas térmicos e histórico de sensores.",
    referencias: "RDC 430/2022."
  },
  MANUAL_GERAL: {
    objetivo: "Estabelecer as diretrizes gerais de funcionamento da fábrica fictícia, consolidando todos os procedimentos de Boas Práticas de Fabricação (BPF) em um único guia mestre de operação.",
    campo_aplicacao: "Abrange todas as áreas da unidade fabril: recepção, estoque, pesagem, produção, laboratório e expedição.",
    responsaveis: "Diretoria, Gerência de Produção e Departamento de Garantia da Qualidade.",
    materiais: "Documentação do sistema BrainX ERP, infraestrutura física da fábrica, equipamentos produtivos.",
    procedimento: [
      "Fluxo de Produção: Seguir rigorosamente a sequência lógica de fabricação para evitar cruzamento de fluxos.",
      "Controle de Acesso: Apenas pessoal autorizado e devidamente uniformizado pode acessar as áreas classificadas.",
      "Execução de POPs: Todos os colaboradores devem consultar e executar os POPs específicos (A a L) conforme o cronograma do sistema.",
      "Registros em Tempo Real: Toda operação de pesagem e mistura deve ser registrada instantaneamente no ERP para garantir a rastreabilidade.",
      "Limpeza e Organização: Aplicar o conceito de 'limpeza concorrente' durante todo o turno de trabalho.",
      "Gestão de Resíduos: Descartar materiais conforme o plano de gerenciamento de resíduos sólidos de saúde (PGRSS)."
    ],
    monitoramento: "Auditorias internas mensais e acompanhamento diário via indicadores (KPIs) no dashboard do sistema.",
    acoes_corretivas: "Abertura de Relatório de Desvio e plano de ação (CAPA) para qualquer processo fora do padrão estabelecido.",
    verificacao: "Verificação sistêmica via trilha de auditoria digital (Logs) e revisão anual do manual.",
    registros: "Registros digitais de produção, qualidade e telemetria armazenados na nuvem.",
    referencias: "RDC 658/2022, RDC 275/2002, ISO 22716, Guia 34/2023 ANVISA."
  }
};

export function POPVisualizer({ pop, open, onOpenChange }: POPVisualizerProps) {
  if (!pop) return null;

  const content = POP_CONTENTS[pop.categoria] || {
    objetivo: "Objetivo não definido.",
    campo_aplicacao: "Geral.",
    responsaveis: pop.responsavel_elaboracao || "Qualidade",
    materiais: "Diversos.",
    procedimento: ["Procedimento em fase de elaboração."],
    monitoramento: "Regular.",
    acoes_corretivas: "Avaliar desvio.",
    verificacao: "Garantia da Qualidade.",
    registros: "Digitais.",
    referencias: "Legislação Vigente."
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 border-none shadow-2xl">
        <DialogHeader className="p-6 bg-slate-50 border-b flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Visualização do POP</DialogTitle>
              <p className="text-sm text-muted-foreground">{pop.codigo} - {pop.titulo}</p>
            </div>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
            </Button>
            <Button size="sm" className="hidden sm:flex" onClick={handlePrint}>
              <Download className="w-4 h-4 mr-2" /> Salvar Cópia
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto bg-white p-12 print:p-0" id="pop-printable">
          {/* Document Header Table Style */}
          <div className="border-2 border-black w-full mb-8 font-sans">
            <div className="flex divide-x-2 divide-black border-b-2 border-black">
              <div className="w-1/4 p-4 flex items-center justify-center">
                <img src={brainxLogo} alt="BrainX Logo" className="w-24 object-contain" />
              </div>
              <div className="w-2/4 p-4 text-center flex flex-col justify-center gap-1">
                <h1 className="font-black text-lg leading-tight uppercase">BrainX Industrial ERP</h1>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Gestão da Qualidade · BPF</p>
                <div className="h-0.5 bg-slate-200 my-1"></div>
                <h2 className="font-black text-xl uppercase">{pop.titulo}</h2>
              </div>
              <div className="w-1/4 flex flex-col divide-y-2 divide-black">
                <div className="p-2 flex justify-between gap-2 text-[10px]">
                  <span className="font-bold uppercase text-slate-500">Código:</span>
                  <span className="font-black">{pop.codigo}</span>
                </div>
                <div className="p-2 flex justify-between gap-2 text-[10px]">
                  <span className="font-bold uppercase text-slate-500">Versão:</span>
                  <span className="font-black">{pop.versao}</span>
                </div>
                <div className="p-2 flex justify-between gap-2 text-[10px]">
                  <span className="font-bold uppercase text-slate-500">Vigência:</span>
                  <span className="font-black">{format(new Date(), "dd/MM/yyyy")}</span>
                </div>
                <div className="p-2 flex justify-between gap-2 text-[10px]">
                  <span className="font-bold uppercase text-slate-500">Página:</span>
                  <span className="font-black">1 de 1</span>
                </div>
              </div>
            </div>
          </div>

          {/* Sections Body */}
          <div className="space-y-6 text-sm text-slate-900 leading-relaxed font-sans">
            <section className="space-y-2">
              <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">01</span>
                Objetivo
              </h3>
              <p className="px-2">{content.objetivo}</p>
            </section>

            <section className="space-y-2">
              <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">02</span>
                Campo de Aplicação
              </h3>
              <p className="px-2">{content.campo_aplicacao}</p>
            </section>

            <section className="space-y-2">
              <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">03</span>
                Responsabilidades
              </h3>
              <p className="px-2">{content.responsaveis}</p>
            </section>

            <section className="space-y-2">
              <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">04</span>
                Materiais Necessários
              </h3>
              <p className="px-2">{content.materiais}</p>
            </section>

            <section className="space-y-2">
              <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">05</span>
                Descrição do Procedimento
              </h3>
              <ol className="list-decimal list-inside space-y-2 px-2">
                {content.procedimento.map((step: string, i: number) => (
                  <li key={i} className="pl-2">{step}</li>
                ))}
              </ol>
            </section>

            <div className="grid grid-cols-2 gap-6">
              <section className="space-y-2">
                <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">06</span>
                  Monitoramento
                </h3>
                <p className="px-2 text-xs">{content.monitoramento}</p>
              </section>

              <section className="space-y-2">
                <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">07</span>
                  Ações Corretivas
                </h3>
                <p className="px-2 text-xs">{content.acoes_corretivas}</p>
              </section>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <section className="space-y-2">
                <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">08</span>
                  Verificação
                </h3>
                <p className="px-2 text-xs">{content.verificacao}</p>
              </section>

              <section className="space-y-2">
                <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">09</span>
                  Registros
                </h3>
                <p className="px-2 text-xs">{content.registros}</p>
              </section>
            </div>

            <section className="space-y-2">
              <h3 className="bg-slate-100 p-2 border-l-4 border-black font-black uppercase text-xs tracking-wider flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px]">10</span>
                Referências
              </h3>
              <p className="px-2 text-xs italic text-slate-500">{content.referencias}</p>
            </section>
          </div>

          {/* Footer Signatures */}
          <div className="mt-16 pt-8 border-t border-slate-300">
            <div className="grid grid-cols-2 gap-12">
              <div className="text-center space-y-2">
                <div className="h-0.5 bg-slate-900 mx-12"></div>
                <p className="font-bold text-[10px] uppercase">Elaborado por: {pop.responsavel_elaboracao || "Departamento de Qualidade"}</p>
                <p className="text-[9px] text-slate-500 italic">Data: ____/____/_______</p>
              </div>
              <div className="text-center space-y-2">
                <div className="h-0.5 bg-slate-900 mx-12"></div>
                <p className="font-bold text-[10px] uppercase">Aprovado por: {pop.responsavel_aprovacao || "Responsável Técnico"}</p>
                <p className="text-[9px] text-slate-500 italic">Data: ____/____/_______</p>
              </div>
            </div>
            
            <div className="mt-12 flex items-center justify-center gap-2 text-emerald-600 font-bold text-[10px] uppercase border p-4 bg-emerald-50 rounded-lg">
              <Shield className="w-4 h-4" />
              Documento validado via BrainX ERP · Autenticação em conformidade com RDC 658/2022
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t print:hidden">
          <p className="text-[10px] text-muted-foreground mr-auto">Este documento é fictício e gerado para fins de demonstração da plataforma BrainX ERP.</p>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar Visualização</Button>
        </DialogFooter>
      </DialogContent>
      
      {/* Styles for printing */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 1.5cm;
          }
          body * {
            visibility: hidden;
          }
          #pop-printable, #pop-printable * {
            visibility: visible;
          }
          #pop-printable {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </Dialog>
  );
}
