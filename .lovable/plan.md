## Visão geral

Quatro entregas integradas no módulo fiscal (Nuvem Fiscal), todas isoladas por `company_id`:

1. **Numeração atômica** — eliminar duplicidade da próxima NF-e/NFC-e em chamadas simultâneas.
2. **Tela "Status do Certificado A1"** — validar CNPJ, ambiente e próxima numeração antes de emitir.
3. **Página "Auditoria Fiscal"** — registrar transmissão, protocolo, cancelamento, CC-e e reimpressão por tenant.
4. **Prévia em tempo real do DANFE/DANFCE** — renderizar com branding + dados fiscais da `company` antes de transmitir/reimprimir.

---

## 1. Numeração atômica por tenant (sem duplicidade)

**Problema atual:** a "próxima numeração" é lida e gravada em `company` via duas chamadas (SELECT + UPDATE). Duas emissões simultâneas no mesmo tenant podem reservar o mesmo número.

**Solução:**

- Nova tabela `nfe_numeracao` (por `company_id` + `modelo` + `serie`): `proximo_numero`, `ultimo_emitido`, `lock_token`, `updated_at`.
- Função RPC `reservar_proximo_numero_nfe(modelo, serie)` com `SECURITY DEFINER`, `SET search_path = public`, usando `SELECT ... FOR UPDATE` + `UPDATE ... RETURNING` numa única transação. Garante reserva atômica por tenant.
- Função `liberar_numero_nfe(numero, modelo, serie, motivo)` para inutilização quando a SEFAZ rejeita após reserva.
- Edge function `nuvem-fiscal` passa a chamar a RPC ao invés de ler/gravar `company.proxima_numeracao_*` diretamente.
- Migração inicial popula `nfe_numeracao` a partir dos campos atuais de `company` (preservando a sequência em uso).

**RLS:** policies por `company_id = get_user_company_id()` para SELECT; mutações apenas via RPC (sem policy de INSERT/UPDATE para `authenticated`). GRANT EXECUTE da RPC para `authenticated`.

---

## 2. Tela "Status do Certificado A1"

**Rota:** `/configuracoes/empresa/certificado-status` (e card resumido em `/vendas/emissor-nfe` no topo).

**Verificações exibidas (semelhantes ao diagnóstico de tenant):**

- Empresa ativa e CNPJ cadastrado.
- Certificado A1 presente (existe ciphertext em `company`).
- CNPJ do certificado bate com CNPJ da empresa (chamada à edge `validate-certificate` já existente).
- Validade do certificado (verde > 60 d, amarelo 30–60 d, vermelho < 30 d / expirado).
- Ambiente configurado (homologação / produção) + alerta se produção sem certificado válido.
- Última numeração emitida e próxima numeração reservada (lê `nfe_numeracao`) por modelo/série (NF-e 55, NFC-e 65).
- Status da conexão com Nuvem Fiscal (ping/token OAuth2).

Botão "Revalidar" reexecuta tudo. Botão "Abrir configurações" leva ao upload de certificado / edição de série.

---

## 3. Página "Auditoria Fiscal"

**Rota:** `/vendas/auditoria-fiscal` (e botão "Auditoria" no header de Notas de Saída).

- Nova tabela `nfe_auditoria` (por `company_id`): `nota_id`, `evento` (`EMISSAO`, `PROTOCOLO`, `REJEICAO`, `CANCELAMENTO`, `CC_E`, `INUTILIZACAO`, `REIMPRESSAO`, `PREVIEW`), `usuario_id`, `usuario_nome`, `protocolo`, `chave_acesso`, `payload` (jsonb), `ip_address`, `user_agent`, `created_at`.
- Hooks de auditoria inseridos: na edge `nuvem-fiscal` (após cada chamada SEFAZ) e no front (reimpressão + preview do DANFE).
- UI: tabela com filtros por período, evento, série, usuário, chave de acesso. Detalhe expandido mostra `payload` (request/response). Export CSV.
- RLS: SELECT/INSERT escopados por `company_id`.

---

## 4. Prévia em tempo real do DANFE/DANFCE

- Componente `DANFEPreview` (e `DANFCEPreview`) reaproveitando o layout do `NFeVisualizacaoDialog` existente, mas **sem precisar de XML autorizado**: monta o DOM A4 (Courier) a partir do formulário em edição + dados da `company` (logo via signed URL, razão social, CNPJ, IE, endereço fiscal, regime, série/próximo número reservado).
- Aba "Prévia" no `/vendas/emissor-nfe` ao lado das abas de produtos/transporte/pagamento, atualizando em tempo real (debounce 250 ms).
- Marca d'água diagonal "PRÉ-VISUALIZAÇÃO — SEM VALOR FISCAL" quando ainda não há protocolo.
- Botão "Imprimir prévia" usa o `PrintLayout` existente (sem `window.open`). Cada preview impresso registra evento `PREVIEW` em `nfe_auditoria`.
- Em reimpressão de nota já transmitida, a prévia reaproveita o componente, sem marca d'água, e dispara evento `REIMPRESSAO`.

---

## Detalhes técnicos

**Migrations (1 migration, ordem):**

1. `CREATE TABLE public.nfe_numeracao` + GRANT SELECT/INSERT/UPDATE para `authenticated`, ALL para `service_role` + RLS por `company_id`.
2. `CREATE TABLE public.nfe_auditoria` + GRANTs + RLS.
3. RPCs `reservar_proximo_numero_nfe`, `liberar_numero_nfe`, `registrar_evento_nfe` (security definer, search_path public).
4. GRANT EXECUTE das RPCs para `authenticated`.
5. Seed inicial de `nfe_numeracao` a partir de `company.proxima_numero_nfe` / `proxima_numero_nfce`.

**Edge function `nuvem-fiscal`:**

- Substitui leitura/escrita direta de `company.proxima_*` por `reservar_proximo_numero_nfe`.
- Em qualquer resposta SEFAZ, chama `registrar_evento_nfe` com o payload.
- Em rejeição definitiva, chama `liberar_numero_nfe` (mantém histórico de inutilização).

**Front:**

- `src/hooks/use-nfe-numeracao.ts` (status + próximo número visível).
- `src/hooks/use-nfe-auditoria.ts` (listar + registrar evento).
- `src/components/fiscal/CertificadoStatusCard.tsx`.
- `src/pages/settings/CertificadoStatusPage.tsx`.
- `src/pages/vendas/AuditoriaFiscalPage.tsx`.
- `src/components/fiscal/DANFEPreview.tsx` (e `DANFCEPreview`).
- Integração nas rotas em `App.tsx` e no header de `EmissorNFePage` / `NotasSaidaPage`.

**Compatibilidade:** os campos `proxima_numero_*` em `company` ficam como histórico/leitura; a fonte de verdade passa a ser `nfe_numeracao`.

**Observabilidade:** todo evento gravado em `nfe_auditoria` também espelha em `audit_trail_imutavel` (já existente) usando `registrar_evento_auditoria`, mantendo o hash-chain forense.
