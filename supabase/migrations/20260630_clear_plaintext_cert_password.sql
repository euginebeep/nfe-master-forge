-- Remediação de segurança: a coluna certificado_senha_encrypted foi usada
-- pelo CompanySettingsPage.tsx para gravar a senha do certificado digital A1
-- em TEXTO PURO (apesar do nome sugerir criptografia, nenhuma função de
-- criptografia jamais foi implementada para essa coluna — diferente do par
-- smtp_pass_ciphertext / set_company_smtp_password / vault, que está correto).
--
-- Esta migration:
--   1. Limpa qualquer senha de certificado que possa ter sido salva em texto
--      puro até agora (remediação imediata do vazamento).
--   2. Documenta a coluna como obsoleta, para não ser reutilizada por engano.
--      Não foi removida (DROP COLUMN) para evitar quebrar relatórios/backups
--      que ainda possam referenciá-la pelo nome; o app não escreve mais nela.

UPDATE public.company
  SET certificado_senha_encrypted = NULL
  WHERE certificado_senha_encrypted IS NOT NULL;

COMMENT ON COLUMN public.company.certificado_senha_encrypted IS
  'OBSOLETA — não usar. Nunca foi de fato criptografada (sem função de cifra associada, diferente de smtp_pass_ciphertext). A senha do certificado A1 agora vive apenas em memória no frontend durante a sessão de uso, nunca persistida. Mantida apenas para não quebrar referências históricas; sempre deve estar NULL.';
