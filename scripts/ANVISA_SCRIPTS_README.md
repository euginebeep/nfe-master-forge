# 📋 Scripts de Monitoramento ANVISA

Automação completa para verificação de legislações ANVISA, validação de suplementos e monitoramento de atualizações.

## 📦 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `anvisa-legislation-checker.ts` | Validador de constituintes e produtos contra legislação ANVISA |
| `anvisa-powerbi-monitor.py` | Monitor do Power BI ANVISA para detectar atualizações |
| `anvisa-config.json` | Configuração centralizada dos scripts |
| `ANVISA_SCRIPTS_README.md` | Este arquivo |

---

## 🚀 Instalação

### Pré-requisitos

```bash
# Node.js 18+
node --version

# Python 3.8+
python3 --version

# Dependências Python
pip3 install requests
```

### Setup

```bash
# 1. Copiar scripts para o projeto
cp anvisa-*.ts scripts/
cp anvisa-*.py scripts/
cp anvisa-config.json scripts/

# 2. Instalar dependências TypeScript
pnpm add node-fetch

# 3. Configurar permissões
chmod +x scripts/anvisa-*.py
chmod +x scripts/anvisa-*.ts
```

---

## 📖 Uso

### 1. Validador de Legislação (TypeScript)

#### Validar constituinte individual

```bash
# Executar script
ts-node scripts/anvisa-legislation-checker.ts

# Exemplo de saída:
# {
#   product: '',
#   constituent: 'Zinco',
#   dose: 25,
#   unit: 'mg',
#   minLimit: 0,
#   maxLimit: 25,
#   status: 'compliant',
#   legislation: 'IN_28_2018',
#   message: 'Dose 25mg está em conformidade...',
#   severity: 'info'
# }
```

#### Integrar no código

```typescript
import { AnvisaLegislationChecker } from '@/scripts/anvisa-legislation-checker';

const checker = new AnvisaLegislationChecker();

// Validar constituinte
const result = checker.validateConstituent('Zinco', 25, 'mg', 'ADULTOS');
console.log(result);

// Validar produto
const product = {
  id: '001',
  name: 'ALPHA PROACTIV',
  manufacturer: 'Vitalnow',
  constituents: [
    { name: 'Zinco', dose: 25, unit: 'mg' },
    { name: 'Vitamina D3', dose: 500, unit: 'UI' },
  ],
  targetAudience: 'ADULTOS',
  status: 'approved',
};

const productResults = checker.validateProduct(product);
productResults.forEach(r => console.log(r));

// Exportar relatórios
const report = checker.generateReport(productResults);
checker.exportJSON('report.json');
checker.exportHTML('report.html');
checker.exportMarkdown('report.md');
```

#### Listar legislações

```typescript
checker.listLegislations();
// Saída:
// 📚 LEGISLAÇÕES ANVISA ATIVAS:
// ✅ Instrução Normativa nº 28/2018
// ✅ Instrução Normativa nº 75/2020
// ✅ Resolução da Diretoria Colegiada nº 429/2020
// ...
```

#### Listar constituintes

```typescript
checker.listConstituents();
// Saída:
// 🧪 CONSTITUINTES AUTORIZADOS:
// Vitamina A (mcg)
//    Limites: Min 0 | Max 3000
//    Legislação: IN_28_2018
// ...
```

---

### 2. Monitor Power BI (Python)

#### Verificação única

```bash
python3 scripts/anvisa-powerbi-monitor.py --check-updates
```

#### Exportar relatório

```bash
python3 scripts/anvisa-powerbi-monitor.py --check-updates --export-report
# Gera: reports/anvisa_report_20260630_150000.json
# Gera: reports/anvisa_report_20260630_150000.md
```

#### Monitoramento contínuo (24 horas)

```bash
python3 scripts/anvisa-powerbi-monitor.py --watch
# Verifica a cada 24 horas
```

#### Monitoramento contínuo (intervalo customizado)

```bash
python3 scripts/anvisa-powerbi-monitor.py --watch --interval 12
# Verifica a cada 12 horas
```

---

## ⚙️ Configuração

Editar `anvisa-config.json`:

```json
{
  "monitoring": {
    "enabled": true,
    "interval_hours": 24,
    "check_on_startup": true,
    "auto_update_limits": false,
    "notification_channels": ["email", "slack", "webhook"]
  },
  "email_notifications": {
    "enabled": true,
    "recipients": ["responsavel-tecnico@empresa.com"],
    "smtp_server": "smtp.gmail.com"
  },
  "legislations_to_monitor": [
    {
      "id": "IN_28_2018",
      "name": "Instrução Normativa nº 28/2018",
      "priority": "HIGH",
      "check_enabled": true
    }
  ]
}
```

---

## 📊 Exemplos de Uso

### Exemplo 1: Validar Produto Completo

```typescript
const checker = new AnvisaLegislationChecker();

const artrivitan = {
  id: '002',
  name: 'ARTRIVITAN ULTRA',
  manufacturer: 'Vitalnow',
  constituents: [
    { name: 'Colageno Tipo 2', dose: 20, unit: 'mg' },  // ❌ ABAIXO DO MÍNIMO
    { name: 'Ácido Hialurônico', dose: 50, unit: 'mg' },
  ],
  targetAudience: 'ADULTOS',
  status: 'pending',
};

const results = checker.validateProduct(artrivitan);
results.forEach(r => {
  if (r.status !== 'compliant') {
    console.error(`❌ ${r.constituent}: ${r.message}`);
  }
});

// Saída:
// ❌ Colageno Tipo 2: Dose 20mg está ABAIXO do mínimo permitido (40mg)
```

### Exemplo 2: Validar Ácido Fólico com Conversão DFE

```typescript
const checker = new AnvisaLegislationChecker();

// Ácido fólico sintético: 300 mcg = 510 mcg DFE (acima do máximo)
const result = checker.validateFolicAcid(300, true);
console.log(result.message);
// Saída: "Ácido fólico: 300mcg sintético = 510mcg DFE. ACIMA do máximo (400mcg DFE)"
```

### Exemplo 3: Monitorar Atualizações

```bash
# Verificar atualizações
python3 scripts/anvisa-powerbi-monitor.py --check-updates --export-report

# Arquivo gerado: reports/anvisa_report_20260630_150000.md
# Conteúdo:
# # 📋 Relatório de Monitoramento ANVISA
# 
# ## 📊 Resumo
# | Métrica | Valor |
# | Atualizações de Legislações | 2 |
# | Novas Legislações | 1 |
# | Alertas | 3 |
# | Alertas de Alta Severidade | 1 |
```

---

## 🔔 Notificações

### Email

```json
{
  "email_notifications": {
    "enabled": true,
    "recipients": ["rt@empresa.com"],
    "smtp_server": "smtp.gmail.com",
    "smtp_port": 587,
    "from_address": "anvisa-monitor@empresa.com"
  }
}
```

### Slack

```json
{
  "slack_notifications": {
    "enabled": true,
    "webhook_url": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
    "channel": "#anvisa-alerts"
  }
}
```

### Webhook Customizado

```json
{
  "webhook_notifications": {
    "enabled": true,
    "url": "https://seu-servidor.com/api/anvisa-alerts",
    "method": "POST",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN"
    }
  }
}
```

---

## 📈 Relatórios

### Formatos Suportados

- **JSON**: Estruturado, para integração com sistemas
- **Markdown**: Legível, para documentação
- **HTML**: Visual, para visualização em navegador

### Exemplo de Relatório JSON

```json
{
  "timestamp": "2026-06-30T15:00:00Z",
  "legislation_updates": [
    {
      "id": "IN_373_2025",
      "name": "Instrução Normativa 373/2025",
      "type": "IN",
      "changes": ["GABA adicionado", "Probióticos adicionados"]
    }
  ],
  "summary": {
    "total_legislation_updates": 2,
    "new_legislations_count": 1,
    "alerts_count": 3,
    "high_severity_alerts": 1
  }
}
```

---

## 🛠️ Troubleshooting

### Erro: "Constituinte não encontrado"

```
Problema: Constituinte não está mapeado
Solução: Adicionar ao array ANVISA_CONSTITUENTS no código
```

### Erro: "Timeout ao verificar Power BI"

```
Problema: Conexão lenta ou Power BI indisponível
Solução: Aumentar timeout em anvisa-config.json
```

### Erro: "Falha ao enviar email"

```
Problema: Credenciais SMTP incorretas
Solução: Verificar configurações em anvisa-config.json
```

---

## 📚 Legislações Monitoradas

| Legislação | Tipo | Data | Status |
|-----------|------|------|--------|
| IN 28/2018 | IN | 2018-07-26 | ✅ Ativa |
| IN 75/2020 | IN | 2020-10-08 | ✅ Ativa |
| RDC 429/2020 | RDC | 2020-10-08 | ✅ Ativa |
| IN 76/2020 | IN | 2020-10-08 | ✅ Ativa |
| IN 102/2021 | IN | 2021-01-01 | ✅ Ativa |
| IN 211/2023 | IN | 2023-01-01 | ✅ Ativa |
| **IN 373/2025** | IN | 2025-06-05 | ✅ Ativa |
| **IN 438/2026** | IN | 2026-04-16 | ✅ Ativa |

---

## 🔐 Segurança

- Não armazenar credenciais no código
- Usar variáveis de ambiente para dados sensíveis
- Validar entrada de usuário
- Usar HTTPS para webhooks
- Rotacionar tokens regularmente

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Verificar logs em `logs/anvisa-monitor.log`
2. Consultar documentação oficial ANVISA: https://www.gov.br/anvisa
3. Acessar Power BI ANVISA: https://app.powerbi.com/

---

## 📝 Changelog

### v1.0.0 (2026-06-30)

- ✅ Validador de constituintes
- ✅ Monitor Power BI
- ✅ Geração de relatórios
- ✅ Suporte a IN 373/2025 e IN 438/2026
- ✅ Notificações por email/Slack/Webhook

---

## 📄 Licença

Propriedade da Vitalnow Indústria Ltda.

---

**Última atualização:** 30 de Junho de 2026
