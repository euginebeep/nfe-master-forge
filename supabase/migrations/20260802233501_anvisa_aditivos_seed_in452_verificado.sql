-- Linhas transcritas do texto INTEGRAL da IN 452/2026, lido no DataLegis em
-- 02/08/2026. Nao e resumo nem inferencia: cada linha esta no Anexo I, II ou III
-- da norma. Publicada no DOU em 12/06/2026.

INSERT INTO public.anvisa_aditivos
 (tipo, categoria, funcao, ins, nome, limite_texto, limite_num, limite_unidade, notas, norma_origem, anexo_origem, verificado_em)
VALUES
-- ── 14.2 sólidos: edulcorante ──────────────────────────────────────────
('ADITIVO','14.2','Edulcorante','959','Neohesperidina dihidrochalcona','400',400,'mg/kg',
 'Limite para suplementos nas formas mastigaveis. NAO permitido em capsulas, capsulas gelatinosas, comprimidos e drageas, exceto formas mastigaveis.',
 'IN 452/2026','Anexo II (inclusoes no Anexo III da IN 211)','2026-08-02'),
('ADITIVO','14.2','Edulcorante','959','Neohesperidina dihidrochalcona','100',100,'mg/kg',
 'Limite para suplementos solidos exceto formas mastigaveis. NAO permitido em capsulas, capsulas gelatinosas, comprimidos e drageas.',
 'IN 452/2026','Anexo II (inclusoes no Anexo III da IN 211)','2026-08-02'),
-- ── 14.2 sólidos: reguladores de acidez (fosfatos) ─────────────────────
('ADITIVO','14.2','Regulador de acidez','341(i)','di-hidrogenofosfato de calcio','2200',2200,'mg/kg',
 'Limite expresso como fosforo para INS 338, 339(ii), 339(iii), 340(i), 340(ii), 341(i), 341(ii), 341(iii) e 452(i) sozinhos ou combinados, no produto pronto para consumo.',
 'IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','341(ii)','Hidrogenofosfato de di-calcio','2200',2200,'mg/kg',
 'Limite expresso como fosforo, sozinhos ou combinados.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','341(iii)','Fosfato tricalcico','2200',2200,'mg/kg',
 'Limite expresso como fosforo, sozinhos ou combinados.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','338','Acido fosforico, acido orto-fosforico','2200',2200,'mg/kg',
 'Alterado pela IN 452. Limite expresso como fosforo, sozinhos ou combinados.','IN 452/2026','Anexo I (alteracoes)','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','339(ii)','hidrogenofosfato de di-sodio','2200',2200,'mg/kg',
 'Alterado pela IN 452. Limite expresso como fosforo.','IN 452/2026','Anexo I','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','339(iii)','Fosfato trissodico','2200',2200,'mg/kg',
 'Alterado pela IN 452. Limite expresso como fosforo.','IN 452/2026','Anexo I','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','340(i)','Acido fosforico, acido orto-fosforico','2200',2200,'mg/kg',
 'Alterado pela IN 452. Limite expresso como fosforo.','IN 452/2026','Anexo I','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','340(ii)','Hidrogenofosfato de di-potassio','2200',2200,'mg/kg',
 'Alterado pela IN 452. Limite expresso como fosforo.','IN 452/2026','Anexo I','2026-08-02'),
('ADITIVO','14.2','Regulador de acidez','452(i)','Polifosfato de sodio','2200',2200,'mg/kg',
 'Alterado pela IN 452. Limite expresso como fosforo.','IN 452/2026','Anexo I','2026-08-02'),
-- ── 14.1 líquidos ──────────────────────────────────────────────────────
('ADITIVO','14.1','Edulcorante','959','Neohesperidina dihidrochalcona','400',400,'mg/L',
 'Limite para suplementos na forma de xarope. NAO permitido para conteudo liquido de capsulas gelatinosas.',
 'IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','14.1','Edulcorante','959','Neohesperidina dihidrochalcona','50',50,'mg/L',
 'Suplementos liquidos exceto xarope. NAO permitido para conteudo liquido de capsulas gelatinosas.',
 'IN 452/2026','Anexo II','2026-08-02'),
-- ── 22.0 ingredientes ──────────────────────────────────────────────────
('ADITIVO','22.0','Antiumectante','551','Dioxido de silicio, silica','Quantum satis',NULL,NULL,
 'Somente para uso em aditivos alimentares em po e misturas de aditivos em po.',
 'IN 452/2026','Anexo I (alteracoes)','2026-08-02'),
('ADITIVO','22.0','Antiespumante','900a','Polidimetilsiloxano','400',400,'mg/kg',
 'Somente para ingredientes obtidos por fermentacao.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Antiespumante','551','Dioxido de silicio, silica','5000',5000,'mg/kg',
 'Somente para ingredientes obtidos por fermentacao.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Conservante','200','Acido sorbico','1300',1300,'mg/kg',
 'Somente para produtos formulados com funcao de agente desmoldante.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Emulsificante','435','Monoestearato de polioxietileno (20) sorbitana, polisorbato 60','68000',68000,'mg/kg',
 'Somente para produtos formulados com funcao de agente desmoldante.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Emulsificante','471','Mono e digliceridos de acidos graxos','43000',43000,'mg/kg',
 'Somente para produtos formulados com funcao de agente desmoldante.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Regulador de acidez','260','Acido acetico (glacial)','7,6',7.6,'mg/kg',
 'Somente para produtos formulados com funcao de agente desmoldante.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Regulador de acidez','507','Acido cloridrico','Quantum satis',NULL,NULL,
 'Somente para aditivos formulados.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Regulador de acidez','507','Acido cloridrico','67000',67000,'mg/kg',
 'Somente para ingredientes obtidos por fermentacao.','IN 452/2026','Anexo II','2026-08-02'),
('ADITIVO','22.0','Regulador de acidez','524','Hidroxido de sodio','Quantum satis',NULL,NULL,
 'Somente para oligossacarideos, ingredientes fontes de fibras alimentares e aditivos formulados.',
 'IN 452/2026','Anexo II','2026-08-02'),
-- ── Coadjuvante (Anexo IV da IN 211) ───────────────────────────────────
('COADJUVANTE','22.0','Lubrificantes, agentes de desmoldagem, antiaderentes, auxiliares de moldagem','322(i)','Lecitina','19500',19500,'mg/kg',
 'Limite maximo de RESIDUO. Somente para produtos formulados com funcao de agente desmoldante.',
 'IN 452/2026','Anexo III (inclusoes no Anexo IV da IN 211)','2026-08-02');

UPDATE public.anvisa_in211_completude c
   SET linhas_ingeridas = (SELECT count(*) FROM anvisa_aditivos a WHERE a.categoria = c.categoria);