
## Adicionar coluna "Codigo" nas listas de Clientes, Fornecedores e Transportadoras

A pagina de Entidades ja mostra a coluna "Codigo" (codigo_interno como ENT-000030, etc.), mas as paginas de Clientes, Fornecedores e Transportadoras nao possuem essa coluna.

### O que sera feito

Adicionar a coluna **"Codigo"** como primeira coluna nas 3 paginas de listagem:

1. **ClientesListPage.tsx** - Adicionar coluna "Codigo" antes de "CNPJ/CPF"
2. **FornecedoresListPage.tsx** - Adicionar coluna "Codigo" antes de "CNPJ/CPF"  
3. **TransportadorasListPage.tsx** - Adicionar coluna "Codigo" antes de "CNPJ/CPF"

Tambem incluir `codigo_interno` no campo de busca (`searchKeys`) para que seja possivel buscar pelo codigo.

### Detalhes tecnicos

Em cada arquivo, sera adicionada a seguinte coluna no inicio do array `columns`:

```typescript
{
  key: "codigo_interno",
  header: "Codigo",
  sortable: true,
  render: (item: HybridEntidade) => (
    <span className="font-mono text-sm">{(item as any).codigo_interno || '-'}</span>
  ),
},
```

E o `searchKeys` sera atualizado para incluir `"codigo_interno"`:
```typescript
searchKeys={["codigo_interno", "documento", "razao_social", "nome_fantasia"]}
```

A coluna exportada em CSV (Clientes e Fornecedores) tambem sera atualizada para incluir o codigo.
