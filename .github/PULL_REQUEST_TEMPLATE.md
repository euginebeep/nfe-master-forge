## O que muda

## Banco de dados
- [ ] Este PR **não** toca o banco
- [ ] Este PR contém migration em `supabase/migrations/` e ela **já foi aplicada**
      ao banco (apply_migration / Cursor / Supabase CLI)
- [ ] Migration commitada **verbatim**, sem reescrita

## Verificação
- [ ] `tsc --noEmit -p tsconfig.app.json` passa
- [ ] Toda RPC nova/alterada teve o **corpo** lido, não só o nome
- [ ] Nenhum objeto referenciado no frontend está ausente do banco
