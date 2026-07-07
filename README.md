# BrainX ERP — NFe Master Forge

ERP industrial e fiscal para gestão de operações com produção, estoque, rastreabilidade, qualidade, financeiro, vendas, compras, NF-e, monitoramento ambiental e estrutura SaaS multiempresa.

Este repositório contém o código-fonte do projeto BrainX ERP / NFe Master Forge, desenvolvido com foco em empresas que precisam controlar processos industriais, fiscais, regulatórios e operacionais em uma única plataforma.

---

## Objetivo do projeto

O BrainX ERP foi desenvolvido para centralizar a operação de empresas industriais, especialmente operações que exigem controle de produção, lotes, rastreabilidade, documentos fiscais, qualidade, estoque e gestão financeira.

O projeto está sendo organizado como ativo digital comercializável, com documentação técnica, estrutura de propriedade intelectual, histórico de desenvolvimento e materiais de apoio para eventual venda, licenciamento, entrada de sócios, investidores ou processo de due diligence por comprador.

---

## Escopo do sistema

O sistema contempla módulos para:

- Cadastros de clientes, fornecedores, transportadoras, produtos, itens e responsáveis técnicos
- Produção industrial, fórmulas, ordens de produção e parâmetros produtivos
- Estoque, lotes, quarentena, movimentações e rastreabilidade
- Compras, notas fiscais de entrada e importação de XML
- Vendas, CRM, orçamentos, pedidos, expedição e notas fiscais de saída
- Emissão e auditoria fiscal de NF-e
- Financeiro, contas a pagar, contas a receber, fluxo de caixa, conciliação e DRE
- Qualidade, análises, desvios, calibrações e POPs
- Regulatório, consulta ANVISA, checker regulatório e biblioteca técnica
- Monitoramento ambiental por sensores
- Usuários, permissões, auditoria e configurações
- Estrutura SaaS multiempresa
- Backup XML, migrações e rotinas técnicas

---

## Principais módulos

### Dashboard

Painel principal para acompanhamento da operação, indicadores, atalhos e visão geral do negócio.

### Cadastros

Gestão de entidades, clientes, fornecedores, transportadoras, produtos, itens e responsáveis técnicos.

### Produção

Controle de fórmulas industriais, ordens de produção, impressão de OP, parâmetros industriais, requisições de compra e dashboards produtivos.

### Estoque

Gestão de lotes, quarentena, lotes reservados, movimentações, produtos sem COA e rastreabilidade.

### Compras

Importação de NF-e, notas fiscais de entrada, fator de conversão e controle de requisições.

### Vendas

CRM, orçamentos, pedidos de venda, marketplace, expedição, notas fiscais de saída, emissor de NF-e e auditoria fiscal.

### Financeiro

Contas a pagar, contas a receber, fluxo de caixa, conciliação financeira e DRE.

### Qualidade

Gestão de análises, desvios, calibrações, POPs e documentos de qualidade.

### Regulatório

Consulta ANVISA, checker regulatório, biblioteca RT e apoio para validação de ingredientes, advertências, alegações e requisitos aplicáveis.

### Ambiental

Monitoramento de temperatura e umidade por sensores ambientais, com páginas de configuração, detalhe de sensor e acompanhamento operacional.

### SaaS e administração

Estrutura para multiempresa, painel SaaS, assinatura, usuários, permissões, auditoria e administração do sistema.

---

## Tecnologias utilizadas

- React
- Vite
- TypeScript
- Supabase
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- Zustand
- Zod
- Recharts
- PWA
- GitHub
- Vercel
- Focus NFe
- XML
- Vitest

---

## Estrutura do projeto

```sh
src/
  components/
  contexts/
  hooks/
  integrations/
  lib/
  pages/
  services/
  types/

supabase/
  migrations/

public/
  imagens, ícones, manifest, PWA e arquivos públicos

scripts/
  scripts auxiliares, backup, migrações, ANVISA, testes e automações
