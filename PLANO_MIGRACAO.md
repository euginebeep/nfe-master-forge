# Plano de Migração Zero Downtime: Lovable → Vercel + Supabase Próprio

Este documento detalha o processo de migração do BrainX ERP (NFe Master Forge) da infraestrutura atual (Lovable) para uma infraestrutura 100% independente, utilizando **Vercel** para o Frontend e **Supabase Próprio** para o Backend, garantindo **zero downtime** para os clientes atuais.

## Arquitetura Alvo
- **Frontend**: Vercel (conectado ao repositório GitHub `euginebeep/nfe-master-forge`).
- **Backend**: Supabase (Conta própria, isolada).
- **IA Gateway**: OpenAI / Anthropic APIs diretas (substituindo o Lovable Gateway).
- **IDE**: Cursor (para desenvolvimento local com IA e preview em tempo real).

---

## Fases da Migração (Estratégia Blue/Green)

A estratégia de "Zero Downtime" consiste em manter o ambiente antigo (Lovable) rodando perfeitamente enquanto configuramos o novo (Vercel + Novo Supabase). A virada de chave só acontece no DNS quando o novo ambiente estiver 100% validado.

### Fase 1: Preparação da Nova Infraestrutura (Backend)
*Nesta fase, o sistema antigo continua rodando normalmente.*

1. **Criar Conta e Projeto no Supabase**:
   - Acesse [Supabase](https://supabase.com) e crie um novo projeto.
   - Anote a senha do banco de dados (será usada no script de migração).
   - Obtenha as novas credenciais: `URL`, `Anon Key`, `Service Role Key` e `Database Connection String`.

2. **Obter Chaves de APIs Externas**:
   - Como o Lovable não permite exportar os secrets, você precisará gerar ou recuperar as chaves:
     - `STRIPE_SECRET_KEY` (Painel do Stripe)
     - `NUVEM_FISCAL_CLIENT_ID` e `NUVEM_FISCAL_CLIENT_SECRET` (Painel Nuvem Fiscal)
     - `OPENAI_API_KEY` e/ou `ANTHROPIC_API_KEY` (Para substituir a IA do Lovable)
     - `FIRECRAWL_API_KEY` (Para o módulo da Anvisa)

3. **Configurar Secrets no Novo Supabase**:
   - Vá em *Project Settings > Edge Functions* no novo Supabase e adicione todas as chaves acima.

### Fase 2: Sincronização de Dados (A Migração em si)
*O script do repositório fará o trabalho pesado.*

1. Configurar o arquivo `scripts/.env.migrate` com as credenciais do Supabase antigo (Lovable) e do novo.
2. Executar o script `./scripts/migrate-to-own-supabase.sh`.
   - *O que ele faz:* Copia o Schema (117 migrations), copia todos os dados (clientes, notas, etc.), copia os arquivos do Storage (buckets) e faz o deploy das 30 Edge Functions.
3. **Refatoração da IA**:
   - Alterar as Edge Functions (`anvisa-ai-verify`, `brainx-assistente`, `manual-ia`, etc.) para apontar para `api.openai.com` ou `api.anthropic.com` em vez de `ai.gateway.lovable.dev`.
   - Fazer o push dessas mudanças para o GitHub.

### Fase 3: Setup do Frontend na Vercel (Staging)
*Criamos um clone do frontend apontando para o novo backend.*

1. Criar conta na [Vercel](https://vercel.com) e importar o repositório GitHub `euginebeep/nfe-master-forge`.
2. Configurar as **Environment Variables** na Vercel:
   - `VITE_SUPABASE_PROJECT_ID` = *<novo_id>*
   - `VITE_SUPABASE_URL` = *<nova_url>*
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = *<nova_anon_key>*
   - `VITE_APP_URL` = *https://seu-dominio-temporario.vercel.app*
3. Fazer o Deploy. A Vercel vai gerar uma URL temporária (ex: `nfe-master-forge.vercel.app`).

### Fase 4: Validação (Quality Assurance)
*Testamos o novo ambiente sem afetar os clientes.*

1. Acesse a URL da Vercel gerada.
2. Faça login com um usuário existente (as senhas foram migradas).
3. Teste os fluxos críticos:
   - Emissão de NFe (em homologação).
   - Upload de arquivo (para testar o Storage).
   - Chatbot de IA (para testar as novas chaves OpenAI/Anthropic).
   - Disparo de e-mail.

### Fase 5: A Virada de Chave (Zero Downtime) e Sincronização Final
*O momento de colocar o novo sistema no ar.*

1. **Sincronização Delta (Opcional, se o banco for muito ativo)**:
   - Se passaram muitos dias entre a Fase 2 e a Fase 5, execute o script de migração novamente (apenas dados) em um horário de baixo movimento (ex: madrugada) para pegar os últimos registros inseridos no Lovable.
2. **Configuração de Domínio**:
   - Na Vercel, adicione o seu **Domínio Próprio** (ex: `app.brainxerp.com.br`).
   - A Vercel fornecerá os registros CNAME/A para você configurar no seu provedor de DNS (Cloudflare, Registro.br, etc.).
3. **Propagação DNS**:
   - Assim que você alterar o DNS, os clientes passarão a acessar a Vercel (novo backend) em vez do Lovable.
   - Como o DNS propaga gradativamente, alguns clientes ainda podem cair no Lovable por algumas horas. Como os dados base são os mesmos, não haverá erro na tela deles.

### Fase 6: Remoção do Lovable
1. Após 48h da virada de DNS, confirme na Vercel se 100% do tráfego está lá.
2. Remova as dependências do Lovable no código:
   - Remover `lovable-tagger` do `vite.config.ts` e `package.json`.
   - Limpar as lógicas de preview do Lovable no `src/main.tsx`.
   - Fazer commit e push (A Vercel atualizará automaticamente).
3. Cancele o projeto no Lovable.

---

## Configuração do Cursor (Para Desenvolvimento em Tempo Real)

O Cursor substituirá a interface visual do Lovable, oferecendo uma experiência superior e local.

1. **Instalação**: Baixe o [Cursor](https://cursor.sh/).
2. **Abrir Projeto**: Abra a pasta `nfe-master-forge` clonada no seu computador.
3. **Configurar IA**: Pressione `Cmd/Ctrl + J` para abrir o painel do Cursor Chat. Em *Settings*, você pode usar a IA nativa do Cursor (recomendado) ou colocar sua própria chave da OpenAI/Anthropic.
4. **Rodar Localmente**:
   - Crie um arquivo `.env` local com as chaves do seu **Novo Supabase**.
   - Rode `npm install` e depois `npm run dev`.
   - O projeto abrirá em `http://localhost:8080`.
5. **O Workflow "Lovable-like" no Cursor**:
   - Deixe o navegador aberto ao lado do Cursor.
   - Selecione um arquivo (ex: `src/pages/vendas/CRMPage.tsx`).
   - Pressione `Cmd/Ctrl + K` (Generate/Edit).
   - Digite o prompt: *"Adicione um botão de exportar para Excel no topo da tabela"*.
   - O Cursor escreverá o código. Pressione `Enter` para aceitar.
   - O navegador recarregará **instantaneamente** (Hot Reload do Vite) mostrando a alteração.
   - Quando estiver satisfeito, faça `git commit` e `git push`. A Vercel fará o deploy para produção automaticamente em ~1 minuto.
