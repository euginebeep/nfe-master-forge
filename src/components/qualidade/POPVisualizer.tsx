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
    objetivo: "Estabelecer procedimentos rigorosos para higienização de equipamentos e utensílios, em conformidade com as Boas Práticas de Fabricação (BPF).",
    campo_aplicacao: "Áreas de produção, envase e manipulação de insumos.",
    responsaveis: "Auxiliares de produção, responsáveis pela limpeza e supervisão da qualidade.",
    materiais: "Detergente neutro hospitalar, álcool 70%, solução clorada (100-200 ppm), panos de microfibra, esponjas não abrasivas.",
    procedimento: [
      "1. Preparação: Identificar a área, sinalizar e remover resíduos sólidos grosseiros.",
      "2. Pré-limpeza: Enxaguar com água potável para remover sujidade visível.",
      "3. Aplicação de Detergente: Aplicar detergente neutro e realizar ação mecânica (fricção) por toda a superfície.",
      "4. Enxágue: Remover todo o detergente com água potável corrente.",
      "5. Sanitização: Aplicar solução clorada ou álcool 70% por aspersão.",
      "6. Secagem: Deixar secar naturalmente ou com auxílio de papel toalha descartável."
    ],
    monitoramento: "Monitoramento diário realizado antes do início do turno pelo setor de Qualidade.",
    acoes_corretivas: "Caso a inspeção visual indique resíduo, o item deve ser reaprovado e o ciclo de higienização reiniciado.",
    verificacao: "Check-list diário de higiene e realização de análise microbiológica (swab) mensalmente.",
    registros: "Planilha de Higienização de Equipamentos (MOD-HIG-001).",
    referencias: "RDC 275/2002 (ANVISA), RDC 658/2022."
  },
  B_PRAGAS: {
    objetivo: "Prevenir e controlar o acesso de pragas e vetores na unidade fabril.",
    campo_aplicacao: "Toda a estrutura interna, perímetros externos e áreas de armazenamento.",
    responsaveis: "Empresa de controle de pragas terceirizada e Responsável Técnico da fábrica.",
    materiais: "Iscas, armadilhas luminosas, telas de proteção (malha < 2mm).",
    procedimento: [
      "1. Inspeção: Vistoria semanal de todos os pontos de iscagem externos.",
      "2. Limpeza: Manter o perímetro da fábrica limpo, sem acúmulo de detritos ou vegetação alta.",
      "3. Barreiras: Verificar vedação de portas (rodos de vedação) e janelas (telas).",
      "4. Monitoramento: Verificação semanal das armadilhas luminosas para insetos voadores.",
      "5. Desinsetização: Executar plano de controle químico trimestral por empresa especializada."
    ],
    monitoramento: "Relatórios mensais de monitoramento e inspeções semanais internas.",
    acoes_corretivas: "Reforço na vedação física ou aplicação extra de controle químico em caso de infestação.",
    verificacao: "Certificado de controle de pragas atualizado e vistorias técnicas.",
    registros: "Relatório Mensal de Controle Integrado de Pragas.",
    referencias: "RDC 275/2002."
  },
  C_AGUA: {
    objetivo: "Garantir potabilidade da água em todos os pontos de uso.",
    campo_aplicacao: "Reservatórios, rede de distribuição e torneiras de produção.",
    responsaveis: "Manutenção e Controle de Qualidade.",
    materiais: "Clorímetro, frascos estéreis.",
    procedimento: [
      "1. Monitoramento Diário: Medir cloro residual (0,5 a 2,0 ppm) e pH (6,0 a 9,5).",
      "2. Inspeção: Verificar integridade de tampas e filtros.",
      "3. Limpeza: Lavagem e desinfecção semestral dos reservatórios.",
      "4. Análise: Coleta semestral para laboratório acreditado (Análise completa).",
      "5. Ação: Em caso de ausência de cloro, notificar manutenção imediatamente."
    ],
    monitoramento: "Monitoramento diário de cloro e pH.",
    acoes_corretivas: "Cloração de choque se cloro < 0,5 ppm.",
    verificacao: "Laudos laboratoriais externos.",
    registros: "Planilha de Controle da Água.",
    referencias: "Portaria GM/MS 888/2021."
  },
  D_MANIPULADORES: {
    objetivo: "Assegurar higiene rigorosa dos manipuladores para evitar contaminação.",
    campo_aplicacao: "Áreas de manipulação direta de insumos.",
    responsaveis: "Colaboradores e Liderança de Produção.",
    materiais: "Uniformes completos, toucas, luvas, sabonete bactericida.",
    procedimento: [
      "1. Uniforme: Limpo, trocado diariamente, sem bolsos acima da cintura.",
      "2. Acesso: Lavagem das mãos obrigatória na entrada.",
      "3. Conduta: Proibido adornos, maquiagem, esmaltes.",
      "4. Saúde: Comunicar imediatamente qualquer sintoma infeccioso.",
      "5. Treinamento: Atualização semestral em BPF."
    ],
    monitoramento: "Auditoria diária na entrada da produção.",
    acoes_corretivas: "Afastamento ou treinamento imediato.",
    verificacao: "Exames médicos ocupacionais.",
    registros: "Ficha de Controle de Higiene Pessoal.",
    referencias: "RDC 275/2002."
  },
  E_CALIBRACAO: {
    objetivo: "Garantir exatidão de instrumentos de medição.",
    campo_aplicacao: "Balanças, estufas, medidores de pH.",
    responsaveis: "Metrologia.",
    materiais: "Pesos padrão certificados.",
    procedimento: [
      "1. Verificação: Diária antes do uso.",
      "2. Calibração: Anual externa acreditada.",
      "3. Etiquetagem: Status de calibração visível.",
      "4. Registros: Manter certificados e logs."
    ],
    monitoramento: "Check-list diário.",
    acoes_corretivas: "Bloqueio de equipamento descalibrado.",
    verificacao: "Certificados anuais.",
    registros: "Plano Mestre de Calibração.",
    referencias: "RDC 658/2022."
  },
  F_TEMPERATURA: {
    objetivo: "Manter temperatura e umidade controladas.",
    campo_aplicacao: "Estoques e produção.",
    responsaveis: "Produção.",
    materiais: "Sensores IoT.",
    procedimento: [
      "1. Monitoramento: 24h via sistema.",
      "2. Alarmes: Verificar desvios.",
      "3. Limites: Estoque (15-25°C), Umidade (<60%).",
      "4. Registros: Relatórios diários."
    ],
    monitoramento: "Automático.",
    acoes_corretivas: "Ajuste de climatização.",
    verificacao: "Auditoria de logs.",
    registros: "Mapas de temperatura.",
    referencias: "RDC 430/2022."
  },
  G_RECOLHIMENTO: {
    objetivo: "Estabelecer as diretrizes para o recolhimento (recall) de produtos em caso de desvio de qualidade.",
    campo_aplicacao: "Expedição, logística e SAC.",
    responsaveis: "Garantia da Qualidade e Logística.",
    materiais: "Lista de contatos de clientes, formulário de notificação ANVISA.",
    procedimento: [
      "1. Identificação: Segregar lotes afetados e suspender faturamento.",
      "2. Notificação: Comunicar clientes e órgãos reguladores em até 24h.",
      "3. Recolhimento: Coletar produtos nos pontos de venda ou distribuidores.",
      "4. Investigação: Realizar análise de causa raiz e balanço de massa.",
      "5. Disposição: Destruir ou reprocessar conforme avaliação técnica."
    ],
    monitoramento: "Simulado de recall anual.",
    acoes_corretivas: "Ajuste em processos produtivos conforme causa raiz.",
    verificacao: "Relatório final de eficácia do recall.",
    registros: "Ficha de Rastreabilidade e Recolhimento.",
    referencias: "RDC 655/2022."
  },
  H_MATERIAS_PRIMAS: {
    objetivo: "Garantir a qualidade e conformidade de todos os insumos recebidos.",
    campo_aplicacao: "Almoxarifado e Recebimento.",
    responsaveis: "Almoxarife e Controle de Qualidade.",
    materiais: "Termômetros a laser, laudos técnicos.",
    procedimento: [
      "1. Conferência: Verificar NF vs Pedido.",
      "2. Inspeção Física: Checar integridade de lacres e embalagens.",
      "3. Temperatura: Medir temperatura do transporte se aplicável.",
      "4. Amostragem: Coletar amostra para análise QC conforme plano.",
      "5. Identificação: Etiquetar como 'QUARENTENA' até liberação."
    ],
    monitoramento: "Inspeção de 100% dos lotes recebidos.",
    acoes_corretivas: "Devolução imediata ao fornecedor em caso de não conformidade.",
    verificacao: "Auditoria de documentos e homologação de fornecedores.",
    registros: "Ficha de Recebimento de Insumos.",
    referencias: "RDC 658/2022."
  },
  I_PESAGEM: {
    objetivo: "Assegurar a precisão na pesagem de ativos e componentes da fórmula.",
    campo_aplicacao: "Central de Pesagem.",
    responsaveis: "Operadores de pesagem qualificados.",
    materiais: "Balanças calibradas, espátulas de aço inox, EPIs.",
    procedimento: [
      "1. Preparação: Limpeza da cabine e verificação de balança.",
      "2. Identificação: Conferir ordem de produção (OP).",
      "3. Pesagem: Realizar pesagem com dupla conferência (operador e sistema).",
      "4. Rotulagem: Identificar cada insumo pesado com lote e peso.",
      "5. Registro: Assinar log de pesagem imediatamente."
    ],
    monitoramento: "Verificação diária das balanças com pesos padrão.",
    acoes_corretivas: "Repesagem em caso de erro detectado na conferência.",
    verificacao: "Revisão da OP pelo supervisor de produção.",
    registros: "Log de Pesagem e Ordem de Produção.",
    referencias: "RDC 658/2022."
  },
  J_CONTROLE_QUALIDADE: {
    objetivo: "Padronizar as análises laboratoriais para liberação de produtos.",
    campo_aplicacao: "Laboratório de Controle de Qualidade.",
    responsaveis: "Analistas de laboratório e Farmacêutico RT.",
    materiais: "Equipamentos analíticos (HPLC, Espectrofotômetro, etc).",
    procedimento: [
      "1. Amostragem: Coletar amostra representativa do lote.",
      "2. Análise Físico-Química: Testar pH, densidade, viscosidade, teor.",
      "3. Análise Microbiológica: Pesquisa de patógenos e contagem total.",
      "4. Conferência: Comparar resultados com a especificação técnica.",
      "5. Laudo: Emitir certificado de análise e liberar no sistema."
    ],
    monitoramento: "Acompanhamento de tendências de qualidade.",
    acoes_corretivas: "Abertura de OOS (Out of Specification) para resultados reprovados.",
    verificacao: "Controle de qualidade interlaboratorial.",
    registros: "Certificado de Análise e Livro de Registro QC.",
    referencias: "RDC 658/2022."
  },
  K_ROTULAGEM: {
    objetivo: "Evitar erros de rotulagem e garantir informações corretas ao consumidor.",
    campo_aplicacao: "Setor de Embalagem e Rotulagem.",
    responsaveis: "Equipe de embalagem.",
    materiais: "Rótulos aprovados, datadores.",
    procedimento: [
      "1. Liberação: Conferir modelo de rótulo aprovado.",
      "2. Datação: Programar lote e validade conforme OP.",
      "3. Inspeção Online: Verificar alinhamento e legibilidade.",
      "4. Reconciliação: Contar rótulos usados vs produtos acabados.",
      "5. Descarte: Destruir rótulos datados e não utilizados."
    ],
    monitoramento: "Inspeção visual contínua na linha.",
    acoes_corretivas: "Parada de linha e correção imediata em caso de erro.",
    verificacao: "Auditoria de final de linha pelo QC.",
    registros: "Relatório de Embalagem e Reconciliação.",
    referencias: "RDC 727/2022."
  },
  L_AMOSTRA_RETENCAO: {
    objetivo: "Manter contraprovas para análises futuras ou investigações.",
    campo_aplicacao: "Laboratório de Contraprovas.",
    responsaveis: "Garantia da Qualidade.",
    materiais: "Frascos de retenção, armários climatizados.",
    procedimento: [
      "1. Coleta: Separar quantidade suficiente para duas análises completas.",
      "2. Identificação: Colocar etiqueta de retenção inviolável.",
      "3. Armazenamento: Guardar em local com temperatura controlada.",
      "4. Inventário: Realizar conferência semestral do estoque de retenção.",
      "5. Descarte: Eliminar amostras após 1 ano do vencimento do lote."
    ],
    monitoramento: "Controle de temperatura do local de armazenamento.",
    acoes_corretivas: "Substituição de frascos em caso de avaria.",
    verificacao: "Auditoria anual de contraprovas.",
    registros: "Inventário de Amostras de Retenção.",
    referencias: "RDC 658/2022."
  },
  MANUAL_GERAL: {
    objetivo: "Estabelecer as diretrizes gerais de funcionamento da fábrica fictícia, consolidando todos os procedimentos de Boas Práticas de Fabricação (BPF) em um único guia mestre de operação.",
    campo_aplicacao: "Abrange todas as áreas da unidade fabril: recepção, estoque, pesagem, produção, laboratório e expedição.",
    responsaveis: "Diretoria, Gerência de Produção e Departamento de Garantia da Qualidade.",
    materiais: "Documentação do sistema BrainX ERP, infraestrutura física da fábrica, equipamentos produtivos.",
    paginas: [
      {
        titulo_secao: "01. POLÍTICA DE QUALIDADE E BPF",
        conteudo: [
          "A empresa compromete-se com a segurança máxima dos produtos industrializados.",
          "Todo colaborador é um agente da qualidade e deve zelar pela higiene.",
          "O Manual de Boas Práticas de Fabricação (BPF) é a lei máxima da planta.",
          "Desvios devem ser comunicados imediatamente à Garantia da Qualidade.",
          "A conformidade com as RDC 275/2002 e RDC 658/2022 é obrigatória."
        ]
      },
      {
        titulo_secao: "02. FLUXO PRODUTIVO E ÁREAS",
        conteudo: [
          "Fluxo de Produção: Seguir rigorosamente a sequência lógica para evitar cruzamento.",
          "Controle de Acesso: Apenas pessoal autorizado e devidamente uniformizado.",
          "Identificação de Status: Áreas, máquinas e materiais devem estar sempre identificados.",
          "Áreas Classificadas: Controle rigoroso de pressão, temperatura e umidade.",
          "Manutenção Preventiva: Equipamentos devem estar calibrados e revisados."
        ]
      },
      {
        titulo_secao: "03. HIGIENE E COMPORTAMENTO",
        conteudo: [
          "Higiene Pessoal: Banho diário, unhas cortadas, sem adornos ou maquiagem.",
          "Lavagem de Mãos: Obrigatória na entrada e a cada troca de atividade.",
          "Uniformes: Devem ser trocados diariamente e estar em perfeito estado.",
          "Comportamento: Proibido comer, beber ou fumar em áreas produtivas.",
          "Saúde do Colaborador: Afastamento imediato em caso de sintomas infecciosos."
        ]
      },
      {
        titulo_secao: "04. GESTÃO DE DOCUMENTOS E REGISTROS",
        conteudo: [
          "Execução de POPs: Consultar e executar os POPs (A a L) conforme cronograma.",
          "Registros em Tempo Real: Toda operação deve ser registrada instantaneamente no ERP.",
          "Rastreabilidade: Garantir o rastreio desde o lote da matéria-prima até o produto acabado.",
          "Armazenamento de Dados: Logs digitais e trilha de auditoria são invioláveis.",
          "Revisão de Documentos: Revisão periódica para melhoria contínua dos processos."
        ]
      }
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

        <div className="flex-1 overflow-y-auto bg-white p-12 print:p-0 relative" id="pop-printable">
          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 opacity-10">
            <span className="text-6xl font-black rotate-[-45deg] whitespace-nowrap text-red-600 uppercase select-none">
              Pop Demo Sem Valor
            </span>
          </div>
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
                  <span className="font-bold uppercase text-slate-500">Páginas:</span>
                  <span className="font-black">{content.paginas ? content.paginas.length : "1"} de {content.paginas ? content.paginas.length : "1"}</span>
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
                Descrição do Procedimento / Conteúdo do Manual
              </h3>
              
              {content.paginas ? (
                <div className="space-y-8">
                  {content.paginas.map((pagina: any, pIdx: number) => (
                    <div key={pIdx} className="border border-slate-200 rounded-md p-4 bg-slate-50/30 break-inside-avoid">
                      <h4 className="font-bold text-sm mb-3 text-primary border-b pb-2">{pagina.titulo_secao}</h4>
                      <ul className="list-disc list-inside space-y-2 text-xs">
                        {pagina.conteudo.map((item: string, i: number) => (
                          <li key={i} className="pl-2 leading-relaxed">{item}</li>
                        ))}
                      </ul>
                      <div className="mt-4 text-[8px] text-right text-slate-400 italic">
                        {pop.codigo} - Página {pIdx + 1} de {content.paginas.length}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ol className="list-decimal list-inside space-y-2 px-2">
                  {content.procedimento.map((step: string, i: number) => (
                    <li key={i} className="pl-2">{step}</li>
                  ))}
                </ol>
              )}
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
