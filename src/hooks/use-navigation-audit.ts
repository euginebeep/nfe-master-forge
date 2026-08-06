import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { registrarAuditoria } from '@/lib/audit-logger';

// Mapeia prefixos de rota para um rótulo legível
const ROUTE_LABELS: Array<[RegExp, string]> = [
  [/^\/$/, 'Dashboard'],
  [/^\/cadastros\/clientes/, 'Clientes'],
  [/^\/cadastros\/fornecedores/, 'Fornecedores'],
  [/^\/cadastros\/transportadoras/, 'Transportadoras'],
  [/^\/cadastros\/entidades/, 'Entidades'],
  [/^\/cadastros\/itens/, 'Itens / Produtos'],
  [/^\/cadastros\/responsaveis-tecnicos/, 'Responsáveis Técnicos'],
  [/^\/estoque\/lotes/, 'Lotes'],
  [/^\/estoque\/movimentacoes/, 'Movimentações de Estoque'],
  [/^\/estoque\/quarentena/, 'Quarentena'],
  [/^\/estoque\/rastreabilidade/, 'Rastreabilidade'],
  [/^\/compras\/nfe-import/, 'Importação de NF-e'],
  [/^\/compras\/notas-entrada/, 'Notas de Entrada'],
  [/^\/producao\/ordens/, 'Ordens de Produção'],
  [/^\/producao\/formulador/, 'Formulador Industrial'],
  [/^\/producao\/dashboard/, 'Dashboard Industrial'],
  [/^\/producao/, 'Produção'],
  [/^\/qualidade\/analises/, 'Análises de Qualidade'],
  [/^\/qualidade\/desvios/, 'Desvios / CAPA'],
  [/^\/qualidade\/rastreabilidade/, 'Rastreabilidade / Dossiê'],
  [/^\/estoque\/rastreabilidade/, 'Rastreabilidade / Dossiê'],
  [/^\/qualidade\/calibracoes/, 'Calibrações'],
  [/^\/qualidade/, 'Qualidade'],
  [/^\/financeiro\/contas-pagar/, 'Contas a Pagar'],
  [/^\/financeiro\/contas-receber/, 'Contas a Receber'],
  [/^\/financeiro\/fluxo-caixa/, 'Fluxo de Caixa'],
  [/^\/financeiro\/dre/, 'DRE'],
  [/^\/financeiro\/conciliacao/, 'Conciliação Bancária'],
  [/^\/financeiro/, 'Financeiro'],
  [/^\/vendas\/orcamentos/, 'Orçamentos'],
  [/^\/vendas\/pedidos/, 'Pedidos de Venda'],
  [/^\/vendas\/crm/, 'CRM'],
  [/^\/vendas\/nfe/, 'Emissor NF-e'],
  [/^\/vendas\/notas-saida/, 'Notas de Saída'],
  [/^\/vendas/, 'Vendas'],
  [/^\/expedicao/, 'Expedição'],
  [/^\/relatorios/, 'Relatórios'],
  [/^\/auditoria/, 'Auditoria'],
  [/^\/usuarios/, 'Usuários e Permissões'],
  [/^\/settings\/empresa/, 'Configurações da Empresa'],
  [/^\/settings\/admin/, 'Admin Master'],
  [/^\/settings/, 'Configurações'],
  [/^\/notificacoes/, 'Notificações'],
  [/^\/chat/, 'Chat Interno'],
  [/^\/regulatorio/, 'Regulatório / ANVISA'],
  [/^\/ambiental/, 'Ambiental'],
];

function labelForPath(pathname: string): string {
  for (const [re, label] of ROUTE_LABELS) {
    if (re.test(pathname)) return label;
  }
  return pathname;
}

/**
 * Registra cada mudança de rota na trilha de auditoria do usuário autenticado.
 * Evita duplicatas para a mesma rota em sequência.
 */
export function useNavigationAudit() {
  const location = useLocation();
  const { user } = useAuthContext();
  const lastPath = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const path = location.pathname;
    if (lastPath.current === path) return;
    lastPath.current = path;

    // Não loga rotas públicas/auth
    if (path.startsWith('/auth') || path.startsWith('/install') || path.startsWith('/legal')) return;

    const label = labelForPath(path);
    registrarAuditoria({
      tipo: 'NAVEGACAO',
      descricao: `Acessou: ${label}`,
      entidade_tipo: 'Navegacao',
      entidade_id: user.id,
      entidade_codigo: path,
      dados_evento: {
        path,
        label,
        referrer: document.referrer || null,
      },
    });
  }, [location.pathname, user]);
}