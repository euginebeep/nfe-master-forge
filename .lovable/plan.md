## Sistema de Desbloqueio Crítico (Challenge-Response)

Operador gera um **código de desafio** → envia ao admin SaaS → admin devolve uma **senha temporária** → operador insere a senha → desbloqueia **janela de 30 min** para executar ações destrutivas.

---

### 1. Banco de dados

Nova tabela `public.unlock_challenges`:

| coluna | tipo | descrição |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK | tenant solicitante |
| `challenge_code` | text UNIQUE | formato `BRX-XXXX-XXXX` (12 chars + hifens), apresentado ao operador |
| `requested_by` | uuid | user_id do operador |
| `requested_by_nome` | text | snapshot |
| `motivo` | text | justificativa obrigatória |
| `escopo` | text[] | `DELETE_DADOS`, `EDITAR_BLOQUEADOS`, `RESET_TENANT`, `OUTRAS_ACOES` |
| `status` | text | `AGUARDANDO_ADMIN`, `LIBERADO`, `CONSUMIDO`, `EXPIRADO`, `CANCELADO` |
| `temp_password_hash` | text | SHA-256 da senha de 8 dígitos (nunca o plaintext) |
| `temp_password_visualizada_em` | timestamptz | quando admin SaaS viu (uso único) |
| `aprovado_por` | uuid | admin SaaS |
| `aprovado_por_nome` | text | snapshot |
| `aprovado_em` | timestamptz | |
| `consumido_em` | timestamptz | quando operador validou a senha |
| `desbloqueio_expira_em` | timestamptz | `consumido_em + 30min` |
| `expira_em` | timestamptz | 6h após criação |
| `ip_solicitante` / `ip_aprovador` | text | auditoria |
| `created_at` | timestamptz default now() | |

**RLS:**
- Operador (qualquer authenticated com `company_id`) vê só os desafios do próprio tenant.
- Admin SaaS (role global `saas_admin` — já existe via `has_role`) vê todos.
- INSERT só com `company_id = get_user_company_id()`.

**Trigger** `notify_unlock_*`: emite notification para admins do tenant ao consumir, e para `saas_admin` ao criar.

---

### 2. Edge Functions (3)

**`unlock-request`** (POST — operador)
- Body: `{ motivo, escopo[] }`
- Valida JWT, cria registro `AGUARDANDO_ADMIN` com código aleatório `BRX-XXXX-XXXX` (alfanumérico maiúsculo sem 0/O/1/I).
- Notifica admin SaaS (insert em `saas_notifications`).
- Retorna `{ challenge_code, expira_em }`.

**`unlock-approve`** (POST — admin SaaS)
- Body: `{ challenge_code }`
- Valida JWT + `has_role('saas_admin')`.
- Gera senha 8 dígitos numéricos, grava `sha256(senha)` + `aprovado_*`, status `LIBERADO`.
- Retorna `{ temp_password, expira_em }` **uma única vez** (próximas chamadas para o mesmo código retornam erro).

**`unlock-consume`** (POST — operador)
- Body: `{ challenge_code, temp_password }`
- Valida JWT, compara hash, exige status `LIBERADO`, não expirado.
- Marca `CONSUMIDO`, seta `desbloqueio_expira_em = now() + 30min`.
- Registra em `audit_trail_imutavel`.
- Notifica todos admins do tenant.
- Retorna `{ unlock_token, expira_em }`. Token = JWT curto assinado com `LOVABLE_OP_MASTER_SECRET` contendo `{ challenge_id, company_id, user_id, exp }`.

Todas com `verify_jwt = false` no `config.toml` (validamos em código).

---

### 3. Frontend

**Hook `useUnlockSession()`** (`src/hooks/use-unlock-session.ts`)
- Lê `unlock_token` de `sessionStorage` (não localStorage — escopo de aba).
- Decodifica `exp`, retorna `{ isUnlocked, expiresAt, remainingMs, clearUnlock() }`.
- Timer atualiza a cada 1s e dispara `clearUnlock()` ao expirar.

**Componente `<UnlockGuard>`** (`src/components/security/UnlockGuard.tsx`)
- Wrappa botões/ações destrutivas. Se não desbloqueado, mostra o `UnlockDialog` em vez de executar.

**`UnlockDialog`** — fluxo em 3 abas:
1. **Solicitar código** → form com motivo + escopo[] → POST `unlock-request` → exibe código grande com botão copiar e timer 6h.
2. **Aguardando admin** → polling a cada 10s no status do desafio.
3. **Inserir senha** → input 8 dígitos → POST `unlock-consume` → grava token, fecha dialog, executa ação pendente.

**Banner global** `<UnlockBanner>` no `AppLayout`: barra fixa no topo (vermelha) enquanto `isUnlocked` exibindo "MODO DESBLOQUEIO ATIVO · 27:42 restantes · [Encerrar agora]".

**Página SaaS Admin** `/saas/admin/desbloqueios`:
- Lista de challenges com filtro de status.
- Ação "Liberar" → cola/lê o código → POST `unlock-approve` → exibe senha de 8 dígitos em modal com countdown 30min e botão "Copiar para enviar ao cliente".

**Integração com Admin Master** (`/settings/admin-master`):
- Novo card "Operações Críticas Desbloqueadas" mostrando status atual + botão "Solicitar Desbloqueio".
- Todas as ações destrutivas existentes (limpar localStorage, reset demo, etc.) passam por `<UnlockGuard>`.

---

### 4. Auditoria

- `audit_trail_imutavel` recebe eventos: `UNLOCK_REQUESTED`, `UNLOCK_APPROVED`, `UNLOCK_CONSUMED`, `UNLOCK_EXPIRED`.
- Hash encadeado já existe via `registrar_evento_auditoria`.
- Notificações: admins do tenant (sino + e-mail via `send-email`) + admin SaaS (sino interno).

---

### 5. Onde NÃO mexer agora

Não vou aplicar o `<UnlockGuard>` automaticamente em todos os DELETEs do app nesta rodada — só nos botões já presentes em `/settings/admin-master`. Os demais módulos (apagar lote, apagar OP encerrada, etc.) ficam para uma segunda passada quando você confirmar que o fluxo está fluindo, para evitar quebrar workflows existentes.

---

### Detalhes técnicos

- Geração do código: 8 chars do alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem ambíguos), no formato `BRX-XXXX-XXXX`.
- Senha temporária: 8 dígitos numéricos `crypto.getRandomValues`.
- Hash: `SHA-256` via `crypto.subtle.digest`.
- `unlock_token`: JWT HS256 com secret `UNLOCK_SIGNING_SECRET` (novo — pedirei pra você adicionar).
- Detecção de role `saas_admin`: usa o `has_role` existente; se ainda não houver esse enum value, adiciono junto da migration.

Quer que eu siga? Se sim, primeiro mando a migration pra aprovar, depois as edge functions + UI.