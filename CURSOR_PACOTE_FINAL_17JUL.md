# CURSOR — PACOTE FINAL BRAINX (sessão 17/07/2026)

Instruções completas para versionar e travar tudo  
Repositório: euginebeep/nfe-master-forge  
Projeto Supabase: cqkvekdrifmvedvpjmjr (nome: brainx-erp)

## 🎯 O QUE VOCÊ (CURSOR) DEVE ENTENDER ANTES DE COMEÇAR

Tudo em SQL e edge functions abaixo **JÁ ESTÁ APLICADO** no banco de produção. Sua tarefa é versionar no Git (deixar o repositório idêntico ao banco), **NÃO** reaplicar mudando dados.

**REGRA DE OURO:** merge/deploy no Vercel não aplica SQL no banco nem edge functions — só publica o frontend. Por isso, ao versionar, você **NÃO** deve apagar nem sobrescrever o que já está no banco. Use exatamente os códigos deste documento.

**NUNCA** remova ou sobrescreva a edge function `coa-densidade-parser`. Ela já está deployada (v7) e funcionando. Já se perdeu uma vez numa regressão — se você deployar sem ela no repo, ela some. Preserve-a idêntica.

Todas as funções SQL usam `CREATE OR REPLACE` e são idempotentes. Rodar de novo não quebra nada nem apaga dados.

Ao chamar função de extensão (`digest`, `unaccent`, `gen_random_uuid`) dentro de função com `search_path` restrito, **SEMPRE** prefixe o schema: `extensions.digest(...)`. Isso é regra permanente (causou bug recorrente).

## 📋 ORDEM DE APLICAÇÃO

### ✅ BLOCO 0 — Já versionado por Fabio

`CURSOR_REGRAS_SESSAO_17JUL.md` (digest fix, check-subscription v6, pré-mix, proximo_codigo_formula). Nada a fazer.

### BLOCO 1 — Migration: conta da cápsula (fonte única)

Arquivo no repo: `supabase/migrations/20260717170000_calcular_capsula_industrial.sql`

Regra de negócio: parte da **DOSE** de ativo, não do peso. Alvo 500mg (+5% só QSP), teto físico = 0,68×densidade×1000, o menor manda. Ativo distribuído igualmente entre cápsulas. Ex: arginina 500mg → 2 cápsulas × 250mg.

### BLOCO 2 — Migration: densidade resolvida por item

Arquivo: `supabase/migrations/20260717170100_densidade_item_resolvida.sql`

### BLOCO 3 — Migration: densidade estimada do blend

Arquivo: `supabase/migrations/20260717170200_densidade_blend_estimada.sql`  
(DROP overload de 2 parâmetros antes do CREATE.)

### BLOCO 4 — Migration: tabela de controle do COA

Arquivo: `supabase/migrations/20260717170300_coa_densidade_processados.sql`

### BLOCO 5 — Edge function: coa-densidade-parser (v7)

Arquivo: `supabase/functions/coa-densidade-parser/index.ts`  
Config: `verify_jwt = false` em `supabase/config.toml`.

⚠️ NÃO altere a lógica. NÃO use `laudos_notas.item_id` (órfão). Casamento via `nota_entrada_itens` → `estoque_lotes` → `itens`.

### BLOCO 6 — Migration: scan automático + cron

Arquivo: `supabase/migrations/20260717170400_coa_densidade_scan_cron.sql`  
Cron: `*/30 * * * *` → `coa_densidade_scan_pendentes()`.

### BLOCO 7 — Frontend

- `fmtMassaAtivos` — nunca `toFixed(0)` em massa de ativos
- Fonte única: `rpc('calcular_capsula_industrial')` na aprovação e OP
- Densidade: campo no cadastro, estimar blend, selos, bloquear aprovação se default 0,65
- Ficha: grupo, %VDR, RT no rodapé, selo densidade, pré-mix

Constantes FE↔banco: excipientes 8% (2+1+5), cápsula 0 = 0,68 mL, densidade default 0,65, alvo 500 mg, fração ativo 0,92.

### Deploy v20

Merge do PR → Vercel publica → Ctrl+F5 em brainxerp.com (resolve B12 “NÃO AUTORIZADO” de cache antigo).

## 🔒 DADOS JÁ CONSOLIDADOS EM PRODUÇÃO (NÃO MEXER)

- 35 insumos com densidade real
- 55+ `qc_analises` tipo `COA_DENSIDADE`
- 62 itens em `coa_densidade_processados`
- laudos órfãos já limpos

## ⛔ O QUE NUNCA FAZER

- Nunca apagar/sobrescrever `coa-densidade-parser`
- Nunca usar `laudos_notas.item_id`
- Nunca reprocessar densidades já em `coa_densidade_processados`
- Nunca `digest()` sem `extensions.` com search_path restrito
- Nunca contar código de fórmula no client — usar `rpc('proximo_codigo_formula')`
