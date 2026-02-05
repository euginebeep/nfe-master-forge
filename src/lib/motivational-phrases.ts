// Motivational phrases by role, rotating daily

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';

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
};

// Get phrase based on role and current date
export function getDailyPhrase(role: AppRole | null | undefined): string {
  const safeRole = role || 'visualizador';
  const phrases = phrasesByRole[safeRole] || phrasesByRole.visualizador;
  
  // Use date to get consistent daily rotation
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  
  const index = dayOfYear % phrases.length;
  return phrases[index];
}

// Get greeting based on time of day
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// Role display names
export const roleDisplayNames: Record<AppRole, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  supervisor: 'Supervisor',
  operador: 'Operador',
  visualizador: 'Visualizador',
};
