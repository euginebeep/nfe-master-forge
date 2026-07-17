# Fonte única ANVISA — anvisa_consultar (18/07/2026)

Toda tela de consulta usa `rpc('anvisa_consultar', { p_termo, p_grupo?, p_dose_mg? })`.

## Status → UI
- encontrado / conforme → verde
- acima_limite / proibido / nao_autorizado_grupo → vermelho
- nao_encontrado → cinza PENDENTE_RT

## Aceitação
- b12 / creatina / vitamina d3 → encontrado
- creatina + gestantes → nao_autorizado_grupo
- creatina + 19_mais + 6000mg → acima_limite
