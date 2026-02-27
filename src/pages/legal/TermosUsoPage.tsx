import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function TermosUsoPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8f9fa', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 780, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Link to="/auth" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0d6efd', textDecoration: 'none', fontSize: 14, fontWeight: 500, marginBottom: 32 }}>
          <ArrowLeft size={16} /> Voltar ao login
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#212529', marginBottom: 8 }}>Termos de Uso</h1>
        <p style={{ color: '#6c757d', fontSize: 14, marginBottom: 32 }}>Última atualização: 27 de fevereiro de 2026</p>

        <div style={{ background: '#fff', border: '1px solid #dee2e6', borderRadius: 8, padding: '32px 28px', lineHeight: 1.75, color: '#495057', fontSize: 15 }}>
          <Section title="1. Aceitação dos Termos">
            Ao acessar e utilizar a plataforma BrainX ERP ("Plataforma"), você declara ter lido, compreendido e concordado
            com estes Termos de Uso. Caso não concorde com qualquer disposição, não utilize a Plataforma.
          </Section>

          <Section title="2. Descrição do Serviço">
            O BrainX ERP é uma plataforma de gestão industrial voltada para indústrias farmacêuticas, suplementos alimentares,
            cosméticos e similares, oferecendo funcionalidades de cadastro, produção, estoque, financeiro, qualidade,
            regulatório e demais módulos integrados.
          </Section>

          <Section title="3. Cadastro e Conta">
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>O usuário deve fornecer informações verdadeiras, completas e atualizadas no momento do cadastro.</li>
              <li>Cada conta é pessoal e intransferível. O usuário é responsável por manter a confidencialidade de suas credenciais.</li>
              <li>É proibido compartilhar credenciais de acesso com terceiros.</li>
              <li>A empresa contratante é responsável pela gestão dos acessos dos seus colaboradores.</li>
            </ul>
          </Section>

          <Section title="4. Uso Aceitável">
            O usuário se compromete a:
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Utilizar a Plataforma apenas para fins legítimos e de acordo com a legislação vigente.</li>
              <li>Não realizar engenharia reversa, descompilar ou tentar acessar o código-fonte da Plataforma.</li>
              <li>Não utilizar a Plataforma para armazenar, transmitir ou processar conteúdo ilegal.</li>
              <li>Não tentar acessar dados de outras empresas ou usuários sem autorização.</li>
            </ul>
          </Section>

          <Section title="5. Propriedade Intelectual">
            Todo o conteúdo da Plataforma, incluindo textos, gráficos, logotipos, ícones, imagens, software e código-fonte,
            é de propriedade exclusiva do BrainX ERP ou de seus licenciadores e está protegido pelas leis de propriedade
            intelectual brasileiras e internacionais.
          </Section>

          <Section title="6. Dados e Responsabilidade">
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>Os dados inseridos na Plataforma são de responsabilidade do usuário e da empresa contratante.</li>
              <li>O BrainX ERP não se responsabiliza por dados incorretos, incompletos ou desatualizados inseridos pelos usuários.</li>
              <li>A Plataforma realiza backups periódicos, mas recomenda-se que o usuário mantenha cópias de segurança próprias.</li>
            </ul>
          </Section>

          <Section title="7. Planos e Pagamento">
            <ul style={{ paddingLeft: 20, margin: '8px 0' }}>
              <li>A Plataforma oferece período de teste gratuito de 14 dias.</li>
              <li>Após o período de teste, é necessário contratar um plano de assinatura para continuar utilizando.</li>
              <li>Os valores e condições dos planos estão disponíveis na página de assinatura.</li>
              <li>O cancelamento pode ser solicitado a qualquer momento pelo portal de gerenciamento.</li>
            </ul>
          </Section>

          <Section title="8. Disponibilidade">
            O BrainX ERP se compromete a manter a disponibilidade da Plataforma em no mínimo 99,9% do tempo (SLA),
            exceto em casos de manutenção programada, previamente comunicada, ou eventos de força maior.
          </Section>

          <Section title="9. Limitação de Responsabilidade">
            O BrainX ERP não será responsável por danos indiretos, incidentais, especiais ou consequenciais decorrentes
            do uso ou impossibilidade de uso da Plataforma, incluindo perda de dados, lucros cessantes ou interrupção de negócios.
          </Section>

          <Section title="10. Modificações">
            Reservamo-nos o direito de alterar estes Termos a qualquer momento. As alterações serão comunicadas
            pela Plataforma e entrarão em vigor na data de publicação. O uso continuado constitui aceitação dos novos termos.
          </Section>

          <Section title="11. Foro">
            Fica eleito o foro da comarca de São Paulo/SP para dirimir quaisquer questões oriundas destes Termos de Uso,
            com renúncia expressa de qualquer outro, por mais privilegiado que seja.
          </Section>

          <Section title="12. Contato">
            Em caso de dúvidas sobre estes Termos de Uso, entre em contato pelo e-mail: <strong>contato@brainxerp.com.br</strong>
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
