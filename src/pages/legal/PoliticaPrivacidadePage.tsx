import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PoliticaPrivacidadePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Link to="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0d6efd', textDecoration: 'none', fontSize: 14, fontWeight: 500, marginBottom: 32 }}>
          <ArrowLeft size={16} /> Voltar ao login
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#212529', marginBottom: 8 }}>Política de Privacidade</h1>
        <p style={{ color: '#6c757d', fontSize: 14, marginBottom: 32 }}>Última atualização: 27 de fevereiro de 2026</p>

        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: '32px 28px', lineHeight: 1.75, color: '#495057', fontSize: 15 }}>
          <Section title="1. Introdução">
            O BrainX ERP ("nós", "nosso") respeita a privacidade dos seus usuários e está comprometido com a proteção dos
            dados pessoais, em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018).
            Esta Política descreve como coletamos, usamos, armazenamos e protegemos suas informações.
          </Section>

          <Section title="2. Dados Coletados">
            <strong>2.1. Dados fornecidos pelo usuário:</strong>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Nome completo e e-mail (cadastro de conta)</li>
              <li>CNPJ, razão social, endereço e dados fiscais da empresa</li>
              <li>Dados de contatos, fornecedores, clientes e colaboradores cadastrados</li>
              <li>Fórmulas, ordens de produção, lotes e demais dados operacionais</li>
            </ul>
            <strong>2.2. Dados coletados automaticamente:</strong>
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Endereço IP e informações do navegador</li>
              <li>Dados de uso e navegação na Plataforma</li>
              <li>Logs de auditoria (ações realizadas no sistema)</li>
            </ul>
          </Section>

          <Section title="3. Finalidade do Tratamento">
            Utilizamos os dados coletados para:
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Prover e manter as funcionalidades da Plataforma</li>
              <li>Autenticar e gerenciar o acesso dos usuários</li>
              <li>Garantir conformidade regulatória (ANVISA, fiscal, etc.)</li>
              <li>Gerar relatórios, dashboards e análises operacionais</li>
              <li>Emitir documentos fiscais (NF-e) quando aplicável</li>
              <li>Comunicar atualizações, manutenções e alertas do sistema</li>
              <li>Melhorar a experiência do usuário e a qualidade do serviço</li>
            </ul>
          </Section>

          <Section title="4. Base Legal">
            O tratamento de dados é realizado com base nas seguintes hipóteses legais da LGPD:
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Execução de contrato:</strong> para prestação do serviço contratado</li>
              <li><strong>Cumprimento de obrigação legal:</strong> obrigações fiscais, tributárias e regulatórias</li>
              <li><strong>Legítimo interesse:</strong> melhoria do serviço e segurança da Plataforma</li>
              <li><strong>Consentimento:</strong> quando expressamente solicitado</li>
            </ul>
          </Section>

          <Section title="5. Compartilhamento de Dados">
            Não vendemos, alugamos ou compartilhamos dados pessoais com terceiros para fins comerciais. Podemos compartilhar dados com:
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li><strong>Processadores de pagamento:</strong> Stripe, para processamento de assinaturas</li>
              <li><strong>Órgãos reguladores:</strong> quando exigido por lei (ANVISA, Receita Federal, etc.)</li>
              <li><strong>Provedores de infraestrutura:</strong> serviços de hospedagem e armazenamento em nuvem</li>
            </ul>
          </Section>

          <Section title="6. Segurança dos Dados">
            Adotamos medidas técnicas e organizacionais para proteger os dados:
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Criptografia em trânsito (TLS/SSL) e em repouso</li>
              <li>Controle de acesso baseado em perfis (RBAC)</li>
              <li>Row Level Security (RLS) para isolamento de dados entre empresas</li>
              <li>Trilha de auditoria imutável para rastreabilidade de ações</li>
              <li>Backups automáticos e periódicos</li>
              <li>Monitoramento contínuo de segurança</li>
            </ul>
          </Section>

          <Section title="7. Retenção de Dados">
            Os dados são mantidos enquanto a conta estiver ativa ou conforme necessário para cumprir obrigações legais.
            Dados fiscais e regulatórios são mantidos pelos prazos exigidos pela legislação vigente (mínimo de 5 anos).
            Após encerramento da conta, os dados serão anonimizados ou excluídos em até 90 dias, exceto quando a
            retenção for legalmente obrigatória.
          </Section>

          <Section title="8. Direitos do Titular">
            Conforme a LGPD, você tem direito a:
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Confirmar a existência de tratamento de dados</li>
              <li>Acessar seus dados pessoais</li>
              <li>Solicitar correção de dados incompletos ou desatualizados</li>
              <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários</li>
              <li>Solicitar portabilidade dos dados</li>
              <li>Revogar consentimento quando aplicável</li>
            </ul>
            Para exercer seus direitos, entre em contato pelo e-mail: <strong>privacidade@brainxerp.com.br</strong>
          </Section>

          <Section title="9. Cookies">
            A Plataforma utiliza cookies essenciais para funcionamento (autenticação e sessão). Não utilizamos
            cookies de rastreamento ou publicidade de terceiros.
          </Section>

          <Section title="10. Alterações nesta Política">
            Esta Política poderá ser atualizada periodicamente. As alterações serão comunicadas pela Plataforma
            e a data de atualização será modificada no topo do documento.
          </Section>

          <Section title="11. Encarregado de Dados (DPO)">
            Para questões relacionadas à proteção de dados pessoais, entre em contato com nosso Encarregado de Dados:
            <br /><strong>E-mail:</strong> dpo@brainxerp.com.br
          </Section>

          <Section title="12. Foro">
            Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer questões oriundas desta Política de Privacidade.
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: '#212529', marginBottom: 8 }}>{title}</h2>
      <div>{children}</div>
    </div>
  );
}
