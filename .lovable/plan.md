# Conta Demo BrainX ERP — Plano de Implementação

Conta única `demo@brainxerp.com` com empresa isolada, dados robustos pré-carregados, reset automático a cada 24h e bloqueios de operações que custam dinheiro ou enviam comunicações reais.

## 1. Marcação `is_demo` (migration)

Adicionar coluna `is_demo BOOLEAN DEFAULT false` em:
- `company` — marca a empresa demo (usado por RLS extras e por edge fns para bloqueio)
- `profiles` — facilita checagem no front sem JOIN

Função helper `public.is_demo_company(_cid uuid)` SECURITY DEFINER para uso em edge functions e triggers.

## 2. Empresa + usuário demo

Migration de bootstrap:
- INSERT em `company` com nome "Demo BrainX — Suplementos Modelo", CNPJ fictício `00.000.000/0001-00`, `is_demo=true`, ID fixo (`'00000000-0000-0000-0000-000000000001'`)
- Edge function `bootstrap-demo-user` (rodada uma vez via curl manual) que cria `demo@brainxerp.com` / `BrainXDemo2026!` via `admin.createUser`, vincula `company_id` no profile, dá role `admin`, define `is_demo=true`

## 3. Seed robusto (edge function `seed-demo-data`)

Função idempotente — apaga tudo da company demo e recria. Conteúdo:

```text
- 60 entidades (30 clientes PJ/PF, 20 fornecedores, 10 transportadoras)
- 120 itens (60 MP vitaminas/minerais/aminoácidos, 30 cápsulas/embalagens, 30 PA)
- 80 lotes de estoque (60 aprovados, 10 quarentena, 10 vencendo)
- 25 NFes de entrada (com XML mock + contas a pagar atreladas)
- 15 NFes de saída
- 18 OPs em fases variadas (planejada, pesagem, encapsulamento, QC, liberada)
- 12 fórmulas reais (multivitamínico, whey, colágeno, magnésio dimalato, etc.)
- 40 contas a receber, 30 contas a pagar
- 8 RTs (CRN, CRQ, CRF) com hashes de assinatura
- 5 CAPAs, 10 desvios QC, 20 análises físico-químicas
- Histórico de movimentações dos últimos 90 dias
- Vendedores externos, comissões, pedidos em expedição
```

Ordem de DELETE respeita FKs. Ordem de INSERT idem.

## 4. Reset automático (pg_cron)

`cron.schedule('reset-demo', '0 4 * * *', ...)` — chama `seed-demo-data` todo dia às 04:00 BRT via `net.http_post`.

## 5. Bloqueios operacionais

Em cada edge function sensível, no início:
```ts
const isDemo = await supabase.from('company').select('is_demo').eq('id', companyId).maybeSingle();
if (isDemo?.is_demo) return new Response(JSON.stringify({ error: 'Operação bloqueada no modo demo', demo: true }), { status: 403 });
```

Funções afetadas:
- `nuvem-fiscal-emitir-nfe` / `nuvem-fiscal-emitir-nfce`
- `send-email` / qualquer função SMTP
- `create-checkout` / `customer-portal` (Stripe)

No front, interceptar nos hooks correspondentes e mostrar toast amigável: *"Esta ação está desabilitada na conta demo."*

## 6. UI da conta demo

**Tela `/auth`:** card destacado "🎬 Experimente a Demo" com botão "Entrar na Demo" que faz `signInWithPassword` direto e leva ao dashboard. Credenciais visíveis também (caso queira compartilhar URL).

**Banner global `<DemoModeBanner />`** no topo do `AppLayout` quando `profile.is_demo`:
> ⚠️ Modo Demonstração — Empresa fictícia. Dados são reiniciados todo dia às 04:00. NF-e, e-mails e pagamentos estão desabilitados.

**Badge no avatar/sidebar** "DEMO" para deixar óbvio.

## 7. Compartilhamento

Página pública `/demo` (rota fora do auth guard) com:
- Pitch curto do ERP
- Credenciais demo
- Botão grande "Acessar Demo Agora"
- Lista do que está bloqueado

URL final: `https://www.brainxerp.com/demo`

---

## Detalhes técnicos

- **RLS:** mantém isolamento — demo company só vê seus próprios dados como qualquer outro tenant. Não precisa policy nova, só os bloqueios procedurais em edge fns.
- **Idempotência do seed:** DELETE WHERE company_id = DEMO_ID em todas as tabelas antes do INSERT. Logs detalhados.
- **Performance:** seed em transação única; ~5-10s de execução.
- **Segurança:** `bootstrap-demo-user` só cria se o usuário não existir; roda com `service_role`.
- **Custo:** zero recorrente. Reset é uma chamada HTTP/dia.

## Arquivos a criar/editar

```text
Migrations:
  + adiciona is_demo em company/profiles + função is_demo_company + bootstrap da empresa demo

Edge functions (novas):
  + supabase/functions/bootstrap-demo-user/index.ts
  + supabase/functions/seed-demo-data/index.ts

Edge functions (editar — adicionar guard is_demo):
  ~ nuvem-fiscal-emitir-nfe, nuvem-fiscal-emitir-nfce
  ~ send-email (se existir)
  ~ create-checkout, customer-portal

Front:
  + src/components/demo/DemoModeBanner.tsx
  + src/components/demo/DemoLoginCard.tsx
  + src/pages/DemoLandingPage.tsx (rota /demo)
  ~ src/pages/Auth.tsx (adicionar DemoLoginCard)
  ~ src/components/layout/AppLayout.tsx (adicionar banner)
  ~ src/contexts/AuthContext.tsx (expor is_demo do profile)
  ~ src/App.tsx (rota /demo)

pg_cron:
  + agendamento diário 04:00 BRT chamando seed-demo-data
```

## Confirmação antes de seguir

Por favor confirme:
1. **CNPJ fictício** `00.000.000/0001-00` está OK ou prefere outro?
2. **Credenciais:** `demo@brainxerp.com` / `BrainXDemo2026!` — pode ser?
3. **Horário do reset:** 04:00 BRT (07:00 UTC) — OK?
4. **Rota pública `/demo`** — quer mesmo ou prefere só o card na tela de login?