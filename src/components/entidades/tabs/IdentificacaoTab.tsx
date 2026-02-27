import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useState } from "react";
import { PAPEL_LABELS, TIPO_PESSOA_LABELS, isEstrangeiro, type PapelEntidadeExtended, type TipoPessoa } from "@/types/entidades";

interface IdentificacaoTabProps {
  data: {
    tipo_pessoa: string;
    documento: string;
    razao_social: string;
    nome_fantasia: string;
    status: string;
    classificacao: string;
    contribuinte_icms: string;
    site: string;
    observacoes: string;
    tags: string[];
    papeis: string[];
    pais?: string;
  };
  onChange: (field: string, value: any) => void;
  errors?: Record<string, string>;
}

const PAPEIS: PapelEntidadeExtended[] = ['CLIENTE', 'FORNECEDOR', 'TRANSPORTADORA', 'TERCEIRIZADO', 'VENDEDOR', 'AFILIADO', 'REPRESENTANTE', 'OUTRO'];

const PAISES_COMUNS = [
  { codigo: 'BR', nome: 'Brasil' },
  { codigo: 'US', nome: 'Estados Unidos' },
  { codigo: 'CN', nome: 'China' },
  { codigo: 'DE', nome: 'Alemanha' },
  { codigo: 'AR', nome: 'Argentina' },
  { codigo: 'PY', nome: 'Paraguai' },
  { codigo: 'UY', nome: 'Uruguai' },
  { codigo: 'CL', nome: 'Chile' },
  { codigo: 'MX', nome: 'México' },
  { codigo: 'IT', nome: 'Itália' },
  { codigo: 'FR', nome: 'França' },
  { codigo: 'ES', nome: 'Espanha' },
  { codigo: 'PT', nome: 'Portugal' },
  { codigo: 'GB', nome: 'Reino Unido' },
  { codigo: 'JP', nome: 'Japão' },
  { codigo: 'KR', nome: 'Coreia do Sul' },
  { codigo: 'IN', nome: 'Índia' },
];

export function IdentificacaoTab({ data, onChange, errors }: IdentificacaoTabProps) {
  const [newTag, setNewTag] = useState("");
  
  const isForeign = isEstrangeiro(data.tipo_pessoa);

  const togglePapel = (papel: string) => {
    const current = data.papeis || [];
    if (current.includes(papel)) {
      onChange("papeis", current.filter(p => p !== papel));
    } else {
      onChange("papeis", [...current, papel]);
    }
  };

  const addTag = () => {
    if (newTag.trim() && !data.tags?.includes(newTag.trim())) {
      onChange("tags", [...(data.tags || []), newTag.trim()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    onChange("tags", (data.tags || []).filter(t => t !== tag));
  };

  return (
    <div className="space-y-6">
      {/* Tipo Pessoa e Documento */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Tipo Pessoa *</Label>
          <Select value={data.tipo_pessoa} onValueChange={(v) => {
            onChange("tipo_pessoa", v);
            if (v === 'ESTRANGEIRO') {
              onChange("contribuinte_icms", "NAO");
            }
          }}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de pessoa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PJ">Pessoa Jurídica</SelectItem>
              <SelectItem value="PF">Pessoa Física</SelectItem>
              <SelectItem value="ESTRANGEIRO">Estrangeiro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="documento">
            {isForeign ? "Documento (Tax ID / Passport)" : data.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"} 
            {!isForeign && " *"}
          </Label>
          <Input
            id="documento"
            value={data.documento}
            onChange={(e) => onChange("documento", e.target.value)}
            placeholder={isForeign ? "Insira o documento estrangeiro (Tax ID, Passport)" : data.tipo_pessoa === "PJ" ? "Insira o CNPJ da empresa" : "Insira o CPF da pessoa"}
            disabled={false}
          />
          {errors?.documento && (
            <p className="text-sm text-destructive">{errors.documento}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="pais">
            País {isForeign && <span className="text-destructive">*</span>}
          </Label>
          <Select 
            value={data.pais || (isForeign ? "" : "BR")} 
            onValueChange={(v) => onChange("pais", v)}
            disabled={!isForeign}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o país de origem" />
            </SelectTrigger>
            <SelectContent>
              {PAISES_COMUNS.map((pais) => (
                <SelectItem key={pais.codigo} value={pais.codigo}>
                  {pais.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isForeign && errors?.pais && (
            <p className="text-sm text-destructive">{errors.pais}</p>
          )}
        </div>
      </div>

      {/* Razao Social e Nome Fantasia */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="razao_social">
            {isForeign ? "Nome / Razão Social" : "Razão Social / Nome"} *
          </Label>
          <Input
            id="razao_social"
            value={data.razao_social}
            onChange={(e) => onChange("razao_social", e.target.value)}
            placeholder={isForeign ? "Insira o nome ou razão social estrangeira" : "Insira a razão social da empresa"}
          />
          {errors?.razao_social && (
            <p className="text-sm text-destructive">{errors.razao_social}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
          <Input
            id="nome_fantasia"
            value={data.nome_fantasia}
            onChange={(e) => onChange("nome_fantasia", e.target.value)}
            placeholder="Insira o nome fantasia ou comercial"
          />
        </div>
      </div>

      {/* Status, Classificação e Contribuinte ICMS */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={data.status} onValueChange={(v) => onChange("status", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ATIVO">Ativo</SelectItem>
              <SelectItem value="INATIVO">Inativo</SelectItem>
              <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Classificação</Label>
          <Select value={data.classificacao} onValueChange={(v) => onChange("classificacao", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a classificação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="REGULAR">Regular</SelectItem>
              <SelectItem value="VIP">VIP</SelectItem>
              <SelectItem value="RISCO">Risco</SelectItem>
              <SelectItem value="RESTRITO">Restrito</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contribuinte ICMS</Label>
          <Select 
            value={isForeign ? "NAO" : data.contribuinte_icms} 
            onValueChange={(v) => onChange("contribuinte_icms", v)}
            disabled={isForeign}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SIM">Sim</SelectItem>
              <SelectItem value="NAO">Não</SelectItem>
              <SelectItem value="ISENTO">Isento</SelectItem>
              <SelectItem value="NAO_INFORMADO">Não Informado</SelectItem>
            </SelectContent>
          </Select>
          {isForeign && (
            <p className="text-xs text-muted-foreground">Estrangeiros não são contribuintes ICMS</p>
          )}
        </div>
      </div>

      {/* Papeis */}
      <div className="space-y-2">
        <Label>Papéis *</Label>
        <div className="flex flex-wrap gap-4 p-3 border rounded-md bg-muted/30">
          {PAPEIS.map((papel) => (
            <div key={papel} className="flex items-center space-x-2">
              <Checkbox
                id={`papel-${papel}`}
                checked={data.papeis?.includes(papel)}
                onCheckedChange={() => togglePapel(papel)}
              />
              <label htmlFor={`papel-${papel}`} className="text-sm cursor-pointer">
                {PAPEL_LABELS[papel]}
              </label>
            </div>
          ))}
        </div>
        {errors?.papeis && (
          <p className="text-sm text-destructive">{errors.papeis}</p>
        )}
      </div>

      {/* Site */}
      <div className="space-y-2">
        <Label htmlFor="site">Site</Label>
        <Input
          id="site"
          value={data.site}
          onChange={(e) => onChange("site", e.target.value)}
          placeholder="Insira o endereço do site (ex: https://empresa.com.br)"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Digite uma tag e pressione Enter"
            className="flex-1"
          />
          <button
            type="button"
            onClick={addTag}
            className="px-3 py-2 text-sm border rounded-md hover:bg-muted"
          >
            Adicionar
          </button>
        </div>
        {data.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="gap-1">
                {tag}
                <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <Label htmlFor="observacoes">Observações</Label>
        <Textarea
          id="observacoes"
          value={data.observacoes}
          onChange={(e) => onChange("observacoes", e.target.value)}
          rows={3}
          placeholder="Insira observações gerais sobre esta entidade"
        />
      </div>
    </div>
  );
}