import { useState, useEffect, useCallback } from 'react';
import { LocalDb } from '@/lib/local-db';
import { toast } from 'sonner';

export interface LocalEntidade {
  id: string;
  tipo_pessoa: 'PJ' | 'PF';
  documento: string;
  razao_social: string;
  nome_fantasia?: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  status: 'ATIVO' | 'BLOQUEADO' | 'HOMOLOGACAO';
  classificacao: 'VIP' | 'REGULAR' | 'PROBLEMA';
  tags: string[];
  papeis: ('FORNECEDOR' | 'CLIENTE' | 'TRANSPORTADORA' | 'AFILIADO' | 'VENDEDOR' | 'OUTRO')[];
  site?: string;
  observacoes?: string;
  created_at?: string;
  updated_at?: string;
  _primaryContact?: LocalEntidadeContato;
}

export interface LocalEntidadeContato {
  id: string;
  entidade_id: string;
  nome: string;
  cargo: 'COMPRADOR' | 'VENDEDOR' | 'FINANCEIRO' | 'LOGISTICA' | 'QUALIDADE' | 'FISCAL' | 'OUTRO';
  whatsapp?: string;
  telefone?: string;
  email?: string;
  preferencial: boolean;
  aceita_whatsapp: boolean;
  created_at?: string;
}

export interface LocalEntidadeEndereco {
  id: string;
  entidade_id: string;
  tipo: 'FISCAL' | 'ENTREGA' | 'COBRANCA';
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  pais?: string;
  created_at?: string;
}

export function useLocalEntidades(filters?: { papel?: string; status?: string }) {
  const [entidades, setEntidades] = useState<LocalEntidade[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<LocalEntidade>('entidades');
    
    if (filters?.papel) {
      data = data.filter(e => e.papeis?.includes(filters.papel as any));
    }
    if (filters?.status) {
      data = data.filter(e => e.status === filters.status);
    }
    
    // Enrich with primary contact
    const contatos = LocalDb.getCollection<LocalEntidadeContato>('entidade_contatos');
    const enriched = data.map(ent => {
      const primaryContact = contatos.find(c => c.entidade_id === ent.id && c.preferencial) 
        || contatos.find(c => c.entidade_id === ent.id);
      return { ...ent, _primaryContact: primaryContact };
    });
    
    setEntidades(enriched);
    setLoading(false);
  }, [filters?.papel, filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data: entidades, isLoading: loading, refresh };
}

export function useLocalEntidade(id: string | undefined) {
  const [entidade, setEntidade] = useState<LocalEntidade | null>(null);
  const [contatos, setContatos] = useState<LocalEntidadeContato[]>([]);
  const [enderecos, setEnderecos] = useState<LocalEntidadeEndereco[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const ent = LocalDb.getById<LocalEntidade>('entidades', id);
    const conts = LocalDb.query<LocalEntidadeContato>('entidade_contatos', c => c.entidade_id === id);
    const ends = LocalDb.query<LocalEntidadeEndereco>('entidade_enderecos', e => e.entidade_id === id);
    
    setEntidade(ent);
    setContatos(conts);
    setEnderecos(ends);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { entidade, contatos, enderecos, isLoading: loading, refresh };
}

export function useCreateEntidade() {
  const create = useCallback((data: Omit<LocalEntidade, 'id'>, initialPapel?: string) => {
    // Check for duplicate document
    const existing = LocalDb.query<LocalEntidade>('entidades', e => e.documento === data.documento);
    if (existing.length > 0) {
      toast.error('Já existe uma entidade com este documento');
      return null;
    }

    const papeis = data.papeis || [];
    if (initialPapel && !papeis.includes(initialPapel as any)) {
      papeis.push(initialPapel as any);
    }

    const entidade = LocalDb.insert<LocalEntidade>('entidades', {
      ...data,
      papeis,
      status: data.status || 'ATIVO',
      classificacao: data.classificacao || 'REGULAR',
      tags: data.tags || [],
    });

    toast.success('Entidade criada com sucesso');
    return entidade;
  }, []);

  return { create };
}

export function useUpdateEntidade() {
  const update = useCallback((id: string, data: Partial<LocalEntidade>) => {
    // Check for duplicate document if changing
    if (data.documento) {
      const existing = LocalDb.query<LocalEntidade>('entidades', e => e.documento === data.documento && e.id !== id);
      if (existing.length > 0) {
        toast.error('Já existe outra entidade com este documento');
        return null;
      }
    }

    const updated = LocalDb.update<LocalEntidade>('entidades', id, data);
    if (updated) {
      toast.success('Entidade atualizada com sucesso');
    }
    return updated;
  }, []);

  return { update };
}

export function useDeleteEntidade() {
  const deleteEntidade = useCallback((id: string) => {
    // Delete related records
    const contatos = LocalDb.query<LocalEntidadeContato>('entidade_contatos', c => c.entidade_id === id);
    contatos.forEach(c => LocalDb.remove('entidade_contatos', c.id));
    
    const enderecos = LocalDb.query<LocalEntidadeEndereco>('entidade_enderecos', e => e.entidade_id === id);
    enderecos.forEach(e => LocalDb.remove('entidade_enderecos', e.id));
    
    LocalDb.remove('entidades', id);
    toast.success('Entidade excluída com sucesso');
  }, []);

  return { deleteEntidade };
}

// Contatos CRUD
export function useEntidadeContatos(entidadeId: string | undefined) {
  const [contatos, setContatos] = useState<LocalEntidadeContato[]>([]);

  const refresh = useCallback(() => {
    if (!entidadeId) return;
    const data = LocalDb.query<LocalEntidadeContato>('entidade_contatos', c => c.entidade_id === entidadeId);
    setContatos(data);
  }, [entidadeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((data: Omit<LocalEntidadeContato, 'id'>) => {
    // If this is first contact or marked preferencial, ensure only one preferencial
    const existing = LocalDb.query<LocalEntidadeContato>('entidade_contatos', c => c.entidade_id === data.entidade_id);
    
    let isPreferencial = data.preferencial;
    if (existing.length === 0) {
      isPreferencial = true; // First contact is always preferencial
    } else if (isPreferencial) {
      // Unmark others
      existing.forEach(c => {
        if (c.preferencial) {
          LocalDb.update<LocalEntidadeContato>('entidade_contatos', c.id, { preferencial: false });
        }
      });
    }

    const contato = LocalDb.insert<LocalEntidadeContato>('entidade_contatos', {
      ...data,
      preferencial: isPreferencial,
    });
    refresh();
    toast.success('Contato adicionado');
    return contato;
  }, [refresh]);

  const update = useCallback((id: string, data: Partial<LocalEntidadeContato>) => {
    if (data.preferencial) {
      // Unmark others
      contatos.forEach(c => {
        if (c.id !== id && c.preferencial) {
          LocalDb.update<LocalEntidadeContato>('entidade_contatos', c.id, { preferencial: false });
        }
      });
    }
    LocalDb.update<LocalEntidadeContato>('entidade_contatos', id, data);
    refresh();
    toast.success('Contato atualizado');
  }, [contatos, refresh]);

  const remove = useCallback((id: string) => {
    LocalDb.remove('entidade_contatos', id);
    refresh();
    toast.success('Contato removido');
  }, [refresh]);

  return { contatos, create, update, remove, refresh };
}

// Enderecos CRUD
export function useEntidadeEnderecos(entidadeId: string | undefined) {
  const [enderecos, setEnderecos] = useState<LocalEntidadeEndereco[]>([]);

  const refresh = useCallback(() => {
    if (!entidadeId) return;
    const data = LocalDb.query<LocalEntidadeEndereco>('entidade_enderecos', e => e.entidade_id === entidadeId);
    setEnderecos(data);
  }, [entidadeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((data: Omit<LocalEntidadeEndereco, 'id'>) => {
    const endereco = LocalDb.insert<LocalEntidadeEndereco>('entidade_enderecos', data);
    refresh();
    toast.success('Endereço adicionado');
    return endereco;
  }, [refresh]);

  const update = useCallback((id: string, data: Partial<LocalEntidadeEndereco>) => {
    LocalDb.update<LocalEntidadeEndereco>('entidade_enderecos', id, data);
    refresh();
    toast.success('Endereço atualizado');
  }, [refresh]);

  const remove = useCallback((id: string) => {
    LocalDb.remove('entidade_enderecos', id);
    refresh();
    toast.success('Endereço removido');
  }, [refresh]);

  return { enderecos, create, update, remove, refresh };
}
