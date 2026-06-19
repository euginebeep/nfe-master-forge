// Motivational phrases by role and gender, rotating daily

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador' | 'saas_owner' | 'saas_suporte' | 'saas_financeiro';
type Sexo = 'MASCULINO' | 'FEMININO' | 'NAO_INFORMADO';

const phrasesByRole: Record<AppRole, string[]> = {
  admin: [
    "Liderar é inspirar pessoas a alcançarem o que não sabiam que podiam.",
    "O sucesso da empresa é o reflexo das suas decisões estratégicas.",
    "Grandes líderes criam mais líderes, não seguidores.",
    "A visão de hoje constrói o legado de amanhã.",
    "Sua liderança transforma desafios em oportunidades.",
    "Inovação começa com coragem para mudar.",
    "O melhor investimento é em pessoas.",
  ],
  gerente: [
    "Gerenciar é a arte de fazer acontecer através das pessoas.",
    "Resultados excepcionais vêm de equipes bem coordenadas.",
    "Seu exemplo inspira toda a equipe.",
    "Cada processo otimizado é um passo rumo à excelência.",
    "A comunicação clara é a base da gestão eficiente.",
    "Delegar não é perder controle, é multiplicar resultados.",
    "Sua organização mantém a empresa no caminho certo.",
  ],
  supervisor: [
    "A qualidade do trabalho reflete a qualidade da supervisão.",
    "Seu olhar atento faz a diferença nos detalhes.",
    "Supervisionar é cuidar para que tudo funcione bem.",
    "Cada orientação sua desenvolve um profissional melhor.",
    "A excelência operacional começa com você.",
    "Seu acompanhamento garante resultados consistentes.",
    "Times bem supervisionados superam expectativas.",
  ],
  operador: [
    "Cada tarefa bem feita é um passo para o sucesso.",
    "A excelência está nos detalhes do seu trabalho.",
    "Você é a engrenagem que faz a empresa funcionar.",
    "Sua dedicação diária constrói grandes resultados.",
    "Operações eficientes começam com profissionais dedicados.",
    "Qualidade não é um ato, é um hábito.",
    "Seu trabalho faz a diferença todos os dias.",
  ],
  visualizador: [
    "Conhecimento é poder. Continue aprendendo.",
    "Observar com atenção é o primeiro passo para contribuir.",
    "Cada informação absorvida te prepara para novos desafios.",
    "Aprender hoje é liderar amanhã.",
    "A curiosidade é o motor do crescimento profissional.",
    "Grandes jornadas começam observando o caminho.",
    "Seu desenvolvimento é importante para nós.",
  ],
  saas_owner: [
    "Visão de produto que transforma mercados.",
    "Sua estratégia define o futuro da plataforma.",
    "Liderar inovação é o seu diferencial.",
    "Decisões inteligentes constroem ecossistemas.",
    "O sucesso dos clientes começa com você.",
    "Cada melhoria sua impacta milhares de usuários.",
    "Empreender com propósito é a sua marca.",
  ],
  saas_suporte: [
    "Resolver problemas é transformar frustração em satisfação.",
    "Cada chamado bem atendido fortalece a relação.",
    "Sua paciência e expertise fazem toda a diferença.",
    "Suporte de excelência é o coração do SaaS.",
    "Você é a ponte entre o cliente e a solução.",
    "Cada ticket resolvido é uma vitória.",
    "A confiança do cliente começa com o seu atendimento.",
  ],
  saas_financeiro: [
    "Números precisos geram decisões assertivas.",
    "Sua análise financeira sustenta o crescimento.",
    "Controlar receitas é garantir o futuro.",
    "Cada relatório seu traz clareza estratégica.",
    "Excelência financeira é o alicerce da escala.",
    "Você transforma dados em direção.",
    "Gestão financeira rigorosa cria empresas duradouras.",
  ],
};

// Frases motivacionais femininas por cargo
const phrasesFemininas: Record<AppRole, string[]> = {
  admin: [
    "Mulheres que lideram inspiram gerações inteiras.",
    "Seu poder de decisão transforma vidas e negócios.",
    "A liderança feminina é força, empatia e visão de futuro.",
    "Você prova todos os dias que competência não tem gênero.",
    "Uma líder que cuida das pessoas constrói empresas eternas.",
    "Sua presença nesse espaço é conquista e inspiração.",
    "Grandes empresas têm grandes mulheres por trás delas.",
  ],
  gerente: [
    "Gerir com inteligência emocional é o seu diferencial.",
    "Você une resultados e pessoas com maestria.",
    "A sua gestão é um exemplo de força e sensibilidade.",
    "Cada equipe que você lidera cresce mais forte.",
    "Mulheres que gerenciam bem criam times extraordinários.",
    "Sua liderança inspira outras mulheres a sonharem mais alto.",
    "A excelência na gestão é a sua assinatura.",
  ],
  supervisor: [
    "Sua atenção aos detalhes garante a qualidade de tudo.",
    "Supervisionar com cuidado é a sua arte.",
    "Você eleva o padrão de todos ao seu redor.",
    "Cada orientação sua faz a diferença na operação.",
    "A precisão do seu trabalho é admirável.",
    "Você é o elo que mantém a equipe unida e forte.",
    "Times supervisionados com amor e firmeza prosperam.",
  ],
  operador: [
    "Sua dedicação é a base de tudo que funciona bem aqui.",
    "Você realiza com perfeição o que muitos não conseguem.",
    "Cada detalhe do seu trabalho tem seu valor.",
    "A excelência começa com profissionais como você.",
    "Sua presença faz a diferença no time todo dia.",
    "Trabalhar com propósito é o que você demonstra.",
    "Você é essencial para o sucesso desta empresa.",
  ],
  visualizador: [
    "Aprender é o primeiro passo para conquistar novos espaços.",
    "Seu olhar curioso abre portas incríveis.",
    "Cada conhecimento que você absorve te fortalece.",
    "Mulheres que aprendem sempre vão mais longe.",
    "Você está construindo o caminho para um futuro brilhante.",
    "A curiosidade é a centelha que acende grandes carreiras.",
    "Seu potencial é enorme — continue crescendo.",
  ],
  saas_owner: [
    "Mulheres que inovam transformam indústrias inteiras.",
    "Sua visão estratégica abre caminhos para milhares.",
    "Liderar com propósito é a sua essência.",
    "Cada decisão sua impulsiona o ecossistema.",
    "Você prova que tecnologia e empatia caminham juntas.",
    "Sua presença inspira outras mulheres a empreenderem.",
    "O futuro do SaaS tem a sua inteligência.",
  ],
  saas_suporte: [
    "Sua empatia transforma cada ticket em uma conexão real.",
    "Resolver com cuidado é o seu superpoder.",
    "Você é a voz humana por trás da tecnologia.",
    "Cada cliente satisfeito carrega o seu toque.",
    "Paciência e expertise — sua combinação vencedora.",
    "Você constrói confiança uma interação de cada vez.",
    "Suporte com alma é o que você entrega.",
  ],
  saas_financeiro: [
    "Números precisos e intuição afiada — sua dupla perfeita.",
    "Sua análise traz clareza para decisões complexas.",
    "Você transforma planilhas em estratégia.",
    "Cada relatório seu é um mapa para o crescimento.",
    "Gestão financeira com visão é a sua marca.",
    "Você equilibra rigor e inovação com maestria.",
    "A saúde financeira da empresa passa pelas suas mãos.",
  ],
};

// Get phrase based on role, gender and current date
export function getDailyPhrase(
  role: AppRole | null | undefined,
  sexo?: Sexo | null
): string {
  const safeRole = role || 'visualizador';

  const phrases =
    sexo === 'FEMININO'
      ? phrasesFemininas[safeRole] || phrasesFemininas.visualizador
      : phrasesByRole[safeRole] || phrasesByRole.visualizador;

  // Use date to get consistent daily rotation
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      (1000 * 60 * 60 * 24)
  );

  const index = dayOfYear % phrases.length;
  return phrases[index];
}

// Get greeting based on time of day and gender
export function getGreeting(sexo?: Sexo | null): string {
  const hour = new Date().getHours();
  if (sexo === 'FEMININO') {
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

// Role display names
export const roleDisplayNames: Record<AppRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  operador: 'Operador',
  visualizador: 'Visualizador',
  saas_owner: 'Proprietário SaaS',
  saas_suporte: 'Suporte SaaS',
  saas_financeiro: 'Financeiro SaaS',
};
