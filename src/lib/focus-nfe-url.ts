/**
 * Focus devolve caminho_xml_nota_fiscal / caminho_danfe relativos (/arquivos/...).
 * Sem o host, o browser/fetch resolve no domínio do ERP e volta HTML —
 * mesmo sintoma do Unexpected token '<' do bug de Content-Type, causa diferente.
 *
 * Host padrão: https://api.focusnfe.com.br (produção).
 * Passar ambiente homologacao → https://homologacao.focusnfe.com.br.
 * URL já absoluta: inalterada.
 */

const HOST_PROD = "https://api.focusnfe.com.br";
const HOST_HOMOLOG = "https://homologacao.focusnfe.com.br";

export function urlArquivoFocus(
  caminho: string | null | undefined,
  ambiente?: string | null,
): string {
  const c = String(caminho ?? "").trim();
  if (!c) return c;
  if (/^https?:\/\//i.test(c)) return c;
  if (!c.startsWith("/")) return c;
  const n = String(ambiente ?? "").trim().toLowerCase();
  const base = n === "homologacao" ? HOST_HOMOLOG : HOST_PROD;
  return `${base}${c}`;
}
