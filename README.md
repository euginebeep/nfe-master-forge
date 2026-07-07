# BrainX ERP — NFe Master Forge

ERP industrial para gestão de empresas de suplementos, cosméticos, alimentos, manipulação e operações com controle fiscal, produtivo, regulatório e financeiro.

O sistema está sendo evoluído com GitHub, Supabase, Vercel, Cursor/VS Code e integrações externas.

## Objetivo do projeto

O BrainX ERP foi criado para centralizar a operação de uma indústria, desde o cadastro de clientes e fornecedores até a emissão de notas fiscais, produção, estoque, qualidade, rastreabilidade, financeiro e compliance regulatório.

A proposta é ter um sistema completo para empresas que precisam controlar:

- Cadastros de clientes, fornecedores, produtos e transportadoras
- Fórmulas e ordens de produção
- Estoque, lotes, quarentena e rastreabilidade
- Compras e notas fiscais de entrada
- Vendas, orçamentos, pedidos e notas fiscais de saída
- Financeiro, contas a pagar, contas a receber, DRE e fluxo de caixa
- Controle de qualidade, análises, desvios, POPs e calibrações
- Consulta regulatória ANVISA
- Monitoramento ambiental por sensores
- Auditoria, usuários, permissões e painel SaaS

## Principais módulos

### Dashboard
Painel principal para acompanhamento da operação.

### Cadastros
Gestão de entidades, clientes, fornecedores, transportadoras, produtos, itens e responsáveis técnicos.

### Produção
Módulo para fórmulas industriais, ordens de produção, impressão de OP, requisições de compra, parâmetros industriais e dashboards produtivos.

### Estoque
Controle de lotes, quarentena, movimentações, rastreabilidade, lotes reservados e produtos sem COA.

### Compras
Importação de NF-e, notas de entrada, fator de conversão e requisições.

### Vendas
CRM, orçamentos, pedidos de venda, marketplace, expedição, emissor de NF-e, notas de saída e auditoria fiscal.

### Financeiro
Contas a pagar, contas a receber, fluxo de caixa, conciliação e DRE.

### Qualidade
Gestão de desvios, análises, POPs e calibrações.

### Regulatório
Consulta ANVISA, checker regulatório e biblioteca técnica.

### Ambiental
Monitoramento de temperatura e umidade por sensores ambientais.

### SaaS
Painel administrativo SaaS, auditoria ghost mode, assinaturas e controle multiempresa.

## Tecnologias utilizadas

- React
- Vite
- TypeScript
- Supabase
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- PWA
- GitHub
- Vercel


## Como rodar o projeto localmente

Antes de começar, instale o Node.js.

```sh
npm install
npm run dev
