// Barrel export for all validation schemas
export { cpfSchema, cnpjSchema, cpfCnpjSchema } from './documento';
export { cepSchema, enderecoSchema, type Endereco } from './endereco';
export { emailSchema, telefoneSchema, celularSchema } from './contato';
export { inscricaoEstadualSchema, ncmSchema, cfopSchema, cstSchema, chaveNFeSchema } from './fiscal';
export { entidadeSchema, entidadePessoaFisicaSchema, entidadePessoaJuridicaSchema, type EntidadePF, type EntidadePJ, type Entidade } from './entidade';
export { itemSchema, type Item } from './item';
export { orcamentoSchema, orcamentoItemSchema, type Orcamento, type OrcamentoItem } from './orcamento';
export { companySchema, type Company } from './company';
