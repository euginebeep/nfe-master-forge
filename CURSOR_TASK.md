# TAREFA CURSOR — BrainX ERP: Módulo Regulatório (núcleo Datalegis)

> **Repositório:** `euginebeep/nfe-master-forge`
> **Stack:** React + TypeScript + Vite + Supabase + Vercel
> **Data do brief:** 14/07/2026

---

## ⛔ REGRAS INEGOCIÁVEIS (leia antes de escrever qualquer linha)

1. **NÃO delete, NÃO renomeie e NÃO altere o conteúdo de `src/lib/anvisa-limits.ts` neste trabalho.** Ele continua sendo a fonte da verdade em produção até o shadow mode provar equivalência. Quem apaga esse arquivo agora quebra os laudos.
2. **NÃO toque em** `exportLaudoA4.ts`, `formulador-industrial-rules.ts`, `use-company-branding.ts`, no módulo de OP/Pesagem, nem em nada de NF-e. Escopo é aditivo.
3. **Antes de cada commit, mostre o `git diff` completo** e aguarde aprovação. Sem exceção.
4. **Um PR por fase.** Não junte PR1 e PR2.
5. **Não invente valores de legislação.** Nenhum número de limite de nutriente pode ser digitado por você. Todos vêm do banco, extraídos do texto oficial e homologados por humano.
6. Se algum arquivo/função citado aqui não existir com esse nome no repo (ex.: helpers de RLS), **pergunte — não improvise**.

---

## CONTEXTO (por que isso existe)

Hoje os limites da ANVISA estão hardcoded em `anvisa-limits.ts`. Três problemas fatais:

- **Não auditável:** não conseguimos provar qual limite estava vigente na data em que um laudo foi emitido.
- **Não monitorável:** se a ANVISA altera uma IN, ninguém descobre.
- **Não multi-tenant:** cada cliente white-label depende de um deploy nosso para ficar em conformidade.

**Princípio:** legislação é **dado versionado**, não constante de código.
**Princípio 2:** a IA propõe, o **Responsável Técnico homologa**. Nada entra em vigor sozinho.
**Princípio 3:** o **DOU** é a fonte com fé pública. O **Datalegis** é a conveniência (texto consolidado + status de vigência). Persistir sempre os dois links.

---

# PR1 — Fundação (arquivos prontos, você só integra)

Os 4 arquivos deste pacote vão exatamente para:

```
supabase/migrations/20260714120000_regulatorio.sql
supabase/functions/_shared/datalegis.ts
supabase/functions/reg-datalegis-sync/index.ts      ← arquivo "index.ts" do pacote
scripts/test-datalegis.ts
```

### Passo 1.1 — Ajustar a RLS antes do push

A migration usa dois helpers genéricos que **provavelmente têm outro nome no BrainX**:

- `public.has_role(auth.uid(), 'rt')`
- `public.current_company_id()`

**Localize os helpers reais de multi-tenancy/roles no repo e substitua.** Se não existirem, pare e reporte — não crie helpers novos por conta própria.

### Passo 1.2 — Aplicar

```bash
supabase db push
```

### Passo 1.3 — GATE OBRIGATÓRIO: rodar o teste

```bash
deno run --allow-net --allow-env scripts/test-datalegis.ts
```

Os 5 testes precisam passar. **Se falharem, corrija o parser — não relaxe o teste.**

O mais importante é o **teste [3]**: o parser tem que descobrir sozinho, lendo o texto consolidado da RDC 843/2024, que a **RDC 990/2025 deu nova redação ao Art. 32**. Isso é fato verificado no site em 13/07/2026. Se o parser não acha isso, ele não serve.

O **teste [4]** (hash determinístico) protege contra o pior bug possível: hash que oscila por ruído gera alerta falso todo dia, e em duas semanas ninguém olha mais para os alertas — o módulo inteiro morre.

O **teste [5]** vai descobrir o `sgl_orgao` e `seq_ato` reais da IN 28/2018. **Anote o output e fixe esses valores no seed da migration** (hoje é chute educado: `IN/DC/ANVISA/MS`).

### Passo 1.4 — Deploy + cron

```bash
supabase secrets set CRON_SECRET=<gere um uuid>
supabase functions deploy reg-datalegis-sync
```

Depois, no SQL editor:

```sql
select cron.schedule(
  'reg-datalegis-diario',
  '0 9 * * *',                       -- 06:00 BRT
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.supabase.co/functions/v1/reg-datalegis-sync',
    headers := jsonb_build_object(
                 'Content-Type','application/json',
                 'x-cron-secret', '<CRON_SECRET>'
               )
  );
  $$
);
```

### Critérios de aceite do PR1

- [ ] `scripts/test-datalegis.ts` passa 5/5
- [ ] `reg_atos` tem 9 linhas com `hash_texto` preenchido e `status_vigencia` ≠ `desconhecido`
- [ ] `reg_ato_alteracoes` contém a aresta **RDC 990/2025 → RDC 843/2024, Art. 32, altera**
- [ ] `sgl_orgao`/`seq_ato` reais fixados no seed
- [ ] **Zero alteração em arquivos fora de `supabase/` e `scripts/`**

---

# PR2 — Migração do `anvisa-limits.ts` em SHADOW MODE

> ⚠️ Esta é a fase perigosa. Um erro aqui muda silenciosamente um limite de nutriente num laudo assinado por RT. Por isso: shadow mode.

### Passo 2.1 — Cliente de leitura

Criar `src/lib/regulatorio/reg-client.ts`:

```ts
export interface RegraVigente {
  id: string;
  chave: string;
  entidade: string;
  valorMin: number | null;
  valorMax: number | null;
  unidade: string | null;
  fatorConversao: Record<string, number> | null;
  ato: { tipo: string; numero: number; ano: number; dispositivo: string; urlDou: string | null };
  vigenciaInicio: string;
}

/** Regra vigente NA DATA. Nunca "a atual". A data é obrigatória. */
export async function getRegraVigente(chave: string, data: Date): Promise<RegraVigente | null>;

/** Batch — usar sempre que possível: 1 query, não N. */
export async function getRegrasVigentes(chaves: string[], data: Date): Promise<Map<string, RegraVigente>>;
```

Usar a função SQL `public.reg_regra_vigente(chave, data)` já criada na migration.
Cache com react-query, `staleTime` de 1h.

### Passo 2.2 — Popular `reg_regras` a partir do arquivo atual

Escrever `scripts/seed-regras-from-limits.ts` que lê `anvisa-limits.ts` e gera INSERTs em `reg_regras`.

Para cada valor:
- `status = 'proposta'` (**nunca `homologada` — o gate está no CHECK do banco, respeite**)
- `proposta_por = 'migracao-anvisa-limits-v1'`
- `ato_id` = FK para o ato correspondente em `reg_atos`
- `dispositivo` = preencher com o anexo/artigo. **Se você não souber de qual dispositivo veio o número, deixe `'A CONFIRMAR'` e liste no relatório final.** Não invente.
- `chave` no padrão: `nutriente.vitamina_d.limite_max.adulto`

**Entregue um relatório** com: quantos valores migrados, quantos ficaram `A CONFIRMAR`, e a lista deles. Esse relatório vai para a RT (Camila Paula da Fonseca, CRN-3 56584) homologar.

### Passo 2.3 — SHADOW MODE (o coração do PR2)

Criar `src/lib/regulatorio/shadow.ts`. O ANVISA Checker passa a calcular **pelas duas fontes** e comparar:

```ts
const legado = getLimiteLegado(chave);                 // anvisa-limits.ts — DECIDE
const novo   = await getRegraVigente(chave, dataRef);  // banco — apenas observa

if (novo && !valoresEquivalentes(legado, novo)) {
  console.warn('[REG-SHADOW] divergência', { chave, legado, novo });
  await logDivergencia({ chave, legado, novo, dataRef });  // tabela reg_shadow_log
}

return legado;   // ⚠️ O LEGADO CONTINUA DECIDINDO. Sempre.
```

- Criar tabela `reg_shadow_log` (company_id, chave, valor_legado, valor_novo, criado_em).
- Rodar **no mínimo 7 dias em produção**.
- **Zero divergências não explicadas** por 7 dias → aí, e só aí, num PR separado, o legado é cortado.

### Critérios de aceite do PR2

- [ ] `reg-client.ts` exige `data` como parâmetro obrigatório (não tem default `new Date()`)
- [ ] Nenhuma regra entra com `status = 'homologada'` via script
- [ ] O checker continua retornando o valor do `anvisa-limits.ts` — comportamento em produção **idêntico**
- [ ] `reg_shadow_log` registrando
- [ ] Relatório de `A CONFIRMAR` entregue

---

# PR3 — Tela de homologação do RT

`src/features/regulatorio/HomologacaoRegras.tsx`

- Lista `reg_regras` com `status = 'proposta'`
- Para cada uma: diff lado a lado (regra vigente × proposta), link para o dispositivo no Datalegis **e no DOU**
- Botões: Homologar / Rejeitar / Editar valor
- Ao homologar: grava `homologada_por` (nome + registro do conselho do usuário logado) e `homologada_em`; a regra anterior da mesma `chave` recebe `vigencia_fim`
- Acesso restrito a role `rt` / `admin`

**Não implemente "homologar todas".** A homologação é ato pessoal do RT, item a item.

---

# PR4 — Alertas

`src/features/regulatorio/PainelAlertas.tsx` + envio WhatsApp via Evolution API (VPS Contabo) para alertas `severidade = 'critica'`.

Alerta crítico = ato que tem regras homologadas dependentes mudou de texto ou de status de vigência.

---

# PR5 — Snapshot no laudo

Ao emitir laudo: gravar `reg_snapshots` com todas as regras usadas + hash. Rodapé do PDF passa a imprimir:

> *Limites conforme IN nº 28/2018 (texto consolidado, verificado em DD/MM/AAAA). Snapshot: a3f9…*

`reg_snapshots` é append-only (trigger já criada na migration). Não tente dar update nela.

---

# PR6 — Painel de notificação ANVISA (gancho comercial)

Campo `numero_notificacao_anvisa` no cadastro de produto + painel "notificados × pendentes" com contagem regressiva.

**Prazo:** 1º de setembro de 2026 (art. 32 da RDC 843/2024, redação dada pela RDC 990/2025 — verificado em 13/07/2026).

---

## ORDEM DE EXECUÇÃO

**PR1 → gate do teste → PR2 (shadow 7 dias) → PR3 → PR4 → PR5 → PR6.**

Não pule o shadow mode. Não corte o `anvisa-limits.ts` antes dos 7 dias limpos.
