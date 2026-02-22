import { useState, useMemo, useEffect } from "react";
import { 
  FileText, Plus, Search, Eye, CheckCircle, X, ArrowRight, 
  Calendar, User, Building2, DollarSign, Clock, UserPlus, Phone, Mail, MapPin, Palette, Hash,
  FileSignature, Pencil, AlertTriangle
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { EntidadeFormDialogComplete } from "@/components/entidades/EntidadeFormDialogComplete";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { maskCNPJ, maskCPF, maskPhone } from "@/lib/masks";
import { ContratoWorkflowDialog } from "@/components/orcamentos/ContratoWorkflowDialog";

interface Orcamento {
  id: string;
  codigo: string;
  cliente_id?: string;
  cliente_nome: string;
  cliente_documento?: string;
  cliente_endereco?: string;
  cliente_telefone?: string;
  cliente_email?: string;
  cliente_whatsapp?: string;
  vendedor_id?: string;
  vendedor_nome?: string;
  valor_total: number;
  valor_final: number;
  data_orcamento: string;
  data_validade?: string;
  status: string;
  observacoes?: string;
  created_at: string;
}

interface ClienteCompleto {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  documento: string;
  tipo_pessoa: string;
  endereco_completo?: string;
  telefone?: string;
  email?: string;
  whatsapp?: string;
  entidade_contatos?: Array<{
    telefone?: string;
    email?: string;
    whatsapp?: string;
    preferencial: boolean;
  }>;
  entidade_enderecos?: Array<{
    logradouro?: string;
    nro?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
    tipo: string;
    principal: boolean;
  }>;
}

interface Formula {
  id: string;
  codigo_formula: string;
  nome_formula: string;
  tipo_apresentacao: string;
  peso_capsula_alvo_mg?: number;
  doses_por_frasco?: number;
  doses_por_pote?: number;
}

interface ItemOrcamento {
  id?: string;
  formula_id?: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  unidades_por_frasco: number;
  // Campos de embalagem
  rotulo?: string;
  tampa_cor?: string;
  capsula_cor?: string;
  pote_cor?: string;
  incluir_silica: boolean;
}

const CORES_CAPSULA = [
  "Transparente", "Branca", "Verde", "Vermelha", "Azul", "Preta", 
  "Amarela", "Laranja", "Rosa", "Roxa", "Marrom", "Cinza"
];

const CORES_POTE = [
  "Âmbar", "Transparente", "Branco", "Preto", "Verde", "Azul"
];

const CORES_TAMPA = [
  "Preta", "Branca", "Dourada", "Prata", "Verde", "Azul", "Vermelha"
];

export default function OrcamentosPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [contratoDialogOpen, setContratoDialogOpen] = useState(false);
  const [editConfirmOpen, setEditConfirmOpen] = useState(false);
  const [orcamentoParaEditar, setOrcamentoParaEditar] = useState<Orcamento | null>(null);
  const [editingOrcamentoId, setEditingOrcamentoId] = useState<string | null>(null);
  
  // Auth & profile
  const { profile } = useAuth();
  
  // Form state
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteCompleto | null>(null);
  const [showClienteNotFound, setShowClienteNotFound] = useState(false);
  const [clienteComboOpen, setClienteComboOpen] = useState(false);
  const [showCadastroClienteDialog, setShowCadastroClienteDialog] = useState(false);
  const [vendedorNome, setVendedorNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("A_VISTA");
  const [descontoPercentual, setDescontoPercentual] = useState(0);
  const [itens, setItens] = useState<ItemOrcamento[]>([
    { 
      produto_nome: "", 
      quantidade: 1, 
      preco_unitario: 0, 
      valor_total: 0, 
      unidades_por_frasco: 60,
      incluir_silica: true,
      capsula_cor: "Transparente",
      pote_cor: "Âmbar",
      tampa_cor: "Preta",
    }
  ]);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Set vendedor name from profile when dialog opens
  useEffect(() => {
    if (dialogOpen && profile?.nome_completo) {
      setVendedorNome(profile.nome_completo);
    }
  }, [dialogOpen, profile]);

  // Auto-generate next code preview
  const { data: nextCodigo } = useQuery({
    queryKey: ["next-orcamento-codigo"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gerar_codigo_orcamento");
      if (error) throw error;
      return data as string;
    },
    enabled: dialogOpen,
  });

  // Buscar vendedores (profiles)
  const { data: vendedores } = useQuery({
    queryKey: ["vendedores-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .order("nome_completo");
      if (error) throw error;
      return data || [];
    },
  });

  // Buscar orçamentos
  const { data: orcamentos, isLoading } = useQuery({
    queryKey: ["orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Orcamento[];
    },
  });

  // Buscar itens do orçamento selecionado
  const { data: orcamentoItens } = useQuery({
    queryKey: ["orcamento-itens", selectedOrcamento?.id],
    queryFn: async () => {
      if (!selectedOrcamento?.id) return [];
      const { data, error } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", selectedOrcamento.id)
        .order("ordem");
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrcamento?.id && viewDialogOpen,
  });

  // Buscar clientes com dados completos (contatos e endereços)
  const { data: clientes } = useQuery({
    queryKey: ["clientes-orcamento-completo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select(`
          id, razao_social, nome_fantasia, documento, tipo_pessoa,
          entidade_contatos (telefone, email, whatsapp, preferencial),
          entidade_enderecos (logradouro, nro, bairro, cidade, uf, cep, tipo, principal)
        `)
        .order("razao_social");
      
      if (error) throw error;
      
      // Processar dados para facilitar acesso
      return (data || []).map((cliente: any) => {
        const contatoPreferencial = cliente.entidade_contatos?.find((c: any) => c.preferencial) 
          || cliente.entidade_contatos?.[0];
        const enderecoFiscal = cliente.entidade_enderecos?.find((e: any) => e.tipo === 'FISCAL' && e.principal)
          || cliente.entidade_enderecos?.find((e: any) => e.tipo === 'FISCAL')
          || cliente.entidade_enderecos?.[0];
        
        let endereco_completo = "";
        if (enderecoFiscal) {
          const partes = [
            enderecoFiscal.logradouro,
            enderecoFiscal.nro,
            enderecoFiscal.bairro,
            enderecoFiscal.cidade,
            enderecoFiscal.uf,
            enderecoFiscal.cep
          ].filter(Boolean);
          endereco_completo = partes.join(", ");
        }
        
        return {
          ...cliente,
          telefone: contatoPreferencial?.telefone,
          email: contatoPreferencial?.email,
          whatsapp: contatoPreferencial?.whatsapp,
          endereco_completo,
        } as ClienteCompleto;
      });
    },
  });

  // Buscar fórmulas aprovadas
  const { data: formulas } = useQuery({
    queryKey: ["formulas-orcamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formulas")
        .select("id, codigo_formula, nome_formula, tipo_apresentacao, peso_capsula_alvo_mg, doses_por_frasco, doses_por_pote")
        .eq("status", "APROVADA")
        .order("nome_formula");
      
      if (error) throw error;
      return data as Formula[];
    },
  });

  // Filtrar clientes pelo termo de busca
  const clientesFiltrados = useMemo(() => {
    if (!clienteSearch || clienteSearch.length < 2) return clientes || [];
    const termo = clienteSearch.toLowerCase();
    return (clientes || []).filter(c => 
      c.razao_social.toLowerCase().includes(termo) ||
      c.nome_fantasia?.toLowerCase().includes(termo) ||
      c.documento.includes(termo.replace(/\D/g, ""))
    );
  }, [clientes, clienteSearch]);

  // Verificar se cliente não foi encontrado
  const clienteNaoEncontrado = useMemo(() => {
    if (!clienteSearch || clienteSearch.length < 3) return false;
    return clientesFiltrados.length === 0;
  }, [clienteSearch, clientesFiltrados]);

  // Criar orçamento
  const criarOrcamento = useMutation({
    mutationFn: async () => {
      if (!clienteSelecionado) {
        throw new Error("Selecione um cliente cadastrado");
      }

      // Gerar código via DB function
      const { data: codigo, error: codeError } = await supabase.rpc("gerar_codigo_orcamento");
      if (codeError || !codigo) throw codeError || new Error("Erro ao gerar código");

      // Encontrar vendedor_id pelo nome
      const vendedor = vendedores?.find(v => v.nome_completo === vendedorNome);

      const valorTotal = itens.reduce((sum, item) => sum + item.valor_total, 0);
      const valorDesconto = valorTotal * (descontoPercentual / 100);
      const valorFinal = valorTotal - valorDesconto;

      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          codigo,
          cliente_id: clienteSelecionado.id,
          cliente_nome: clienteSelecionado.razao_social,
          cliente_documento: clienteSelecionado.documento || null,
          cliente_endereco: clienteSelecionado.endereco_completo || null,
          cliente_telefone: clienteSelecionado.telefone || null,
          cliente_email: clienteSelecionado.email || null,
          cliente_whatsapp: clienteSelecionado.whatsapp || null,
          vendedor_id: vendedor?.id || null,
          vendedor_nome: vendedorNome || null,
          valor_total: valorTotal,
          valor_final: valorFinal,
          forma_pagamento: formaPagamento,
          desconto_percentual: descontoPercentual,
          data_orcamento: format(new Date(), "yyyy-MM-dd"),
          data_validade: format(addDays(new Date(), 30), "yyyy-MM-dd"),
          status: "RASCUNHO",
          observacoes,
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Inserir itens
      if (data && itens.length > 0) {
        const itensData = itens.filter(i => i.produto_nome).map((item, idx) => ({
          orcamento_id: data.id,
          formula_id: item.formula_id || null,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          preco_final: item.preco_unitario,
          valor_total: item.valor_total,
          unidades_por_frasco: item.unidades_por_frasco,
          rotulo: item.rotulo || null,
          tampa_cor: item.tampa_cor || null,
          capsula_cor: item.capsula_cor || null,
          pote_cor: item.pote_cor || null,
          incluir_silica: item.incluir_silica,
          ordem: idx + 1,
        }));

        if (itensData.length > 0) {
          await supabase.from("orcamento_itens").insert(itensData);
        }
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Orçamento criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["next-orcamento-codigo"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao criar orçamento");
      console.error(error);
    },
  });

  // Converter em pedido
  const converterEmPedido = useMutation({
    mutationFn: async (orcamento: Orcamento) => {
      // Gerar código do pedido
      const { data: lastPed } = await supabase
        .from("pedidos_venda")
        .select("codigo")
        .order("created_at", { ascending: false })
        .limit(1);

      const ano = new Date().getFullYear();
      let seq = 1;
      if (lastPed && lastPed.length > 0) {
        const partes = lastPed[0].codigo.split("-");
        if (partes[1] === String(ano)) {
          seq = parseInt(partes[2] || "0", 10) + 1;
        }
      }
      const codigo = `PED-${ano}-${String(seq).padStart(4, "0")}`;

      // Criar pedido
      const { data: pedido, error: pedError } = await supabase
        .from("pedidos_venda")
        .insert({
          codigo,
          orcamento_id: orcamento.id,
          cliente_id: orcamento.cliente_id || null,
          cliente_nome: orcamento.cliente_nome,
          cliente_documento: orcamento.cliente_documento || null,
          valor_produtos: orcamento.valor_total,
          valor_total: orcamento.valor_final,
          data_pedido: format(new Date(), "yyyy-MM-dd"),
          status: "CONFIRMADO",
          observacoes: orcamento.observacoes,
        })
        .select()
        .single();

      if (pedError) throw pedError;

      // Buscar itens do orçamento
      const { data: orcItens } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", orcamento.id);

      // Copiar itens para o pedido
      if (pedido && orcItens && orcItens.length > 0) {
        const pedidoItens = orcItens.map((item: any) => ({
          pedido_id: pedido.id,
          orcamento_item_id: item.id,
          formula_id: item.formula_id,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          preco_final: item.preco_final,
          valor_total: item.valor_total,
          unidades_por_frasco: item.unidades_por_frasco,
          rotulo: item.rotulo || null,
          tampa_cor: item.tampa_cor || null,
          capsula_cor: item.capsula_cor || null,
          pote_cor: item.pote_cor || null,
          incluir_silica: item.incluir_silica ?? true,
          ordem: item.ordem,
          status: "PENDENTE",
        }));

        await supabase.from("pedido_itens").insert(pedidoItens);
      }

      // Atualizar status do orçamento
      await supabase
        .from("orcamentos")
        .update({ status: "CONVERTIDO" })
        .eq("id", orcamento.id);

      return pedido;
    },
    onSuccess: (pedido) => {
      toast.success(`Pedido ${pedido.codigo} criado!`, {
        description: "O orçamento foi convertido em pedido de venda.",
      });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      setViewDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao converter orçamento");
      console.error(error);
    },
  });

  // Carregar orçamento para edição
  const carregarOrcamentoParaEdicao = async (orcamento: Orcamento) => {
    // Buscar itens do orçamento
    const { data: itensOrc } = await supabase
      .from("orcamento_itens")
      .select("*")
      .eq("orcamento_id", orcamento.id)
      .order("ordem");

    // Buscar cliente completo
    const clienteEncontrado = clientes?.find(c => c.id === orcamento.cliente_id);
    if (clienteEncontrado) {
      setClienteId(clienteEncontrado.id);
      setClienteSelecionado(clienteEncontrado);
      setClienteSearch(clienteEncontrado.razao_social);
    } else {
      setClienteSearch(orcamento.cliente_nome);
    }

    setVendedorNome((orcamento as any).vendedor_nome || "");
    setObservacoes(orcamento.observacoes || "");
    setFormaPagamento((orcamento as any).forma_pagamento || "A_VISTA");
    setDescontoPercentual(Number((orcamento as any).desconto_percentual || 0));

    if (itensOrc && itensOrc.length > 0) {
      setItens(itensOrc.map((item: any) => ({
        id: item.id,
        formula_id: item.formula_id || undefined,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        valor_total: item.valor_total,
        unidades_por_frasco: item.unidades_por_frasco || 60,
        rotulo: item.rotulo || "",
        tampa_cor: item.tampa_cor || "Preta",
        capsula_cor: item.capsula_cor || "Transparente",
        pote_cor: item.pote_cor || "Âmbar",
        incluir_silica: item.incluir_silica ?? true,
      })));
    }

    setEditingOrcamentoId(orcamento.id);
    setDialogOpen(true);
  };

  // Editar (sobrescrever) orçamento
  const editarOrcamento = useMutation({
    mutationFn: async () => {
      if (!editingOrcamentoId || !clienteSelecionado) {
        throw new Error("Dados inválidos para edição");
      }

      const vendedor = vendedores?.find(v => v.nome_completo === vendedorNome);
      const valorTotal = itens.reduce((sum, item) => sum + item.valor_total, 0);
      const valorDesconto = valorTotal * (descontoPercentual / 100);
      const valorFinal = valorTotal - valorDesconto;

      // Atualizar orçamento e resetar workflow do contrato
      const { error } = await supabase
        .from("orcamentos")
        .update({
          cliente_id: clienteSelecionado.id,
          cliente_nome: clienteSelecionado.razao_social,
          cliente_documento: clienteSelecionado.documento || null,
          cliente_endereco: clienteSelecionado.endereco_completo || null,
          cliente_telefone: clienteSelecionado.telefone || null,
          cliente_email: clienteSelecionado.email || null,
          cliente_whatsapp: clienteSelecionado.whatsapp || null,
          vendedor_id: vendedor?.id || null,
          vendedor_nome: vendedorNome || null,
          valor_total: valorTotal,
          valor_final: valorFinal,
          forma_pagamento: formaPagamento,
          desconto_percentual: descontoPercentual,
          data_orcamento: format(new Date(), "yyyy-MM-dd"),
          data_validade: format(addDays(new Date(), 30), "yyyy-MM-dd"),
          observacoes,
          // Resetar todo o workflow do contrato para forçar nova geração
          contrato_status: null,
          contrato_enviado_em: null,
          contrato_enviado_via: null,
          contrato_enviado_por: null,
          comprovante_pagamento_em: null,
          comprovante_pagamento_obs: null,
          gerencia_aprovado_por: null,
          gerencia_aprovado_em: null,
          gerencia_observacoes: null,
          contrato_assinado_em: null,
          contrato_conferido_por: null,
          contrato_conferido_em: null,
        } as any)
        .eq("id", editingOrcamentoId);

      if (error) throw error;

      // Deletar itens antigos
      await supabase.from("orcamento_itens").delete().eq("orcamento_id", editingOrcamentoId);

      // Inserir novos itens
      const itensData = itens.filter(i => i.produto_nome).map((item, idx) => ({
        orcamento_id: editingOrcamentoId,
        formula_id: item.formula_id || null,
        produto_nome: item.produto_nome,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        preco_final: item.preco_unitario,
        valor_total: item.valor_total,
        unidades_por_frasco: item.unidades_por_frasco,
        rotulo: item.rotulo || null,
        tampa_cor: item.tampa_cor || null,
        capsula_cor: item.capsula_cor || null,
        pote_cor: item.pote_cor || null,
        incluir_silica: item.incluir_silica,
        ordem: idx + 1,
      }));

      if (itensData.length > 0) {
        await supabase.from("orcamento_itens").insert(itensData);
      }
    },
    onSuccess: () => {
      toast.success("Orçamento atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["contrato-orcamento-itens"] });
      setDialogOpen(false);
      setEditingOrcamentoId(null);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error?.message || "Erro ao atualizar orçamento");
    },
  });

  const resetForm = () => {
    setClienteId("");
    setClienteSearch("");
    setClienteSelecionado(null);
    setShowClienteNotFound(false);
    setVendedorNome(profile?.nome_completo || "");
    setObservacoes("");
    setFormaPagamento("A_VISTA");
    setDescontoPercentual(0);
    setEditingOrcamentoId(null);
    setItens([{ 
      produto_nome: "", 
      quantidade: 1, 
      preco_unitario: 0, 
      valor_total: 0, 
      unidades_por_frasco: 60,
      incluir_silica: true,
      capsula_cor: "Transparente",
      pote_cor: "Âmbar",
      tampa_cor: "Preta",
    }]);
  };

  const handleEditClick = (orcamento: Orcamento) => {
    setOrcamentoParaEditar(orcamento);
    setEditConfirmOpen(true);
  };

  const confirmarEdicao = async () => {
    if (orcamentoParaEditar) {
      setEditConfirmOpen(false);
      setViewDialogOpen(false);
      await carregarOrcamentoParaEdicao(orcamentoParaEditar);
      setOrcamentoParaEditar(null);
    }
  };

  const addItem = () => {
    setItens([...itens, { 
      produto_nome: "", 
      quantidade: 1, 
      preco_unitario: 0, 
      valor_total: 0, 
      unidades_por_frasco: 60,
      incluir_silica: true,
      capsula_cor: "Transparente",
      pote_cor: "Âmbar",
      tampa_cor: "Preta",
    }]);
  };

  const updateItem = (index: number, field: keyof ItemOrcamento, value: any) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    if (field === "quantidade" || field === "preco_unitario") {
      newItens[index].valor_total = newItens[index].quantidade * newItens[index].preco_unitario;
    }
    setItens(newItens);
  };

  const selectFormula = (index: number, formulaId: string) => {
    const formula = formulas?.find(f => f.id === formulaId);
    if (formula) {
      const newItens = [...itens];
      newItens[index] = {
        ...newItens[index],
        formula_id: formula.id,
        produto_nome: formula.nome_formula,
        unidades_por_frasco: formula.doses_por_frasco || formula.doses_por_pote || 60,
      };
      setItens(newItens);
    }
  };

  const removeItem = (index: number) => {
    if (itens.length > 1) {
      setItens(itens.filter((_, i) => i !== index));
    }
  };

  const selecionarCliente = (cliente: ClienteCompleto) => {
    setClienteId(cliente.id);
    setClienteSelecionado(cliente);
    setClienteSearch(cliente.razao_social);
    setShowClienteNotFound(false);
    setClienteComboOpen(false);
  };

  const getStatusVariant = (status: string): "success" | "warning" | "error" | "info" | "muted" | "default" => {
    switch (status) {
      case "RASCUNHO": return "muted";
      case "ENVIADO": return "info";
      case "APROVADO": return "success";
      case "RECUSADO": return "error";
      case "CONVERTIDO": return "default";
      case "EXPIRADO": return "warning";
      default: return "muted";
    }
  };

  const formatDocumento = (doc: string, tipo: string) => {
    if (tipo === "PJ" || doc.length === 14) {
      return maskCNPJ(doc);
    }
    return maskCPF(doc);
  };

  const filteredOrcamentos = orcamentos?.filter(o =>
    o.codigo.toLowerCase().includes(search.toLowerCase()) ||
    o.cliente_nome.toLowerCase().includes(search.toLowerCase())
  );

  const valorTotalItens = itens.reduce((sum, item) => sum + item.valor_total, 0);
  const valorDescontoItens = valorTotalItens * (descontoPercentual / 100);
  const valorFinalItens = valorTotalItens - valorDescontoItens;

  const FORMAS_PAGAMENTO = [
    { value: "A_VISTA", label: "À Vista" },
    { value: "50_50", label: "50/50" },
    { value: "CARTAO", label: "Cartão" },
    { value: "BOLETO", label: "Boleto" },
    { value: "30_60_90", label: "30/60/90" },
  ];

  const getFormaPagamentoLabel = (value: string) => {
    return FORMAS_PAGAMENTO.find(f => f.value === value)?.label || value;
  };

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        description="Crie orçamentos e converta em pedidos de venda"
        icon={FileText}
        actions={
          <Button onClick={() => setDialogOpen(true)} className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{orcamentos?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">
                  {orcamentos?.filter(o => o.status === "RASCUNHO" || o.status === "ENVIADO").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">
                  {orcamentos?.filter(o => o.status === "CONVERTIDO").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Convertidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">
                  R$ {(orcamentos?.reduce((sum, o) => sum + Number(o.valor_final || 0), 0) || 0).toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar orçamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredOrcamentos?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum orçamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredOrcamentos?.map((orcamento) => (
                <TableRow key={orcamento.id}>
                  <TableCell className="font-mono font-medium">{orcamento.codigo}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{orcamento.cliente_nome}</p>
                      {orcamento.cliente_documento && (
                        <p className="text-xs text-muted-foreground">{orcamento.cliente_documento}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{(orcamento as any).vendedor_nome || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {orcamento.data_orcamento && format(new Date(orcamento.data_orcamento), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {orcamento.data_validade && format(new Date(orcamento.data_validade), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {Number(orcamento.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={getStatusVariant(orcamento.status)}>{orcamento.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedOrcamento(orcamento);
                          setViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {orcamento.status !== "CONVERTIDO" && orcamento.status !== "RECUSADO" && orcamento.status !== "EXPIRADO" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEditClick(orcamento)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOrcamento(orcamento);
                              setContratoDialogOpen(true);
                            }}
                          >
                            <FileSignature className="h-4 w-4 mr-1" />
                            Contrato
                          </Button>
                        </>
                      )}
                      {(orcamento as any).contrato_status === "ASSINADO" && orcamento.status !== "CONVERTIDO" && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => converterEmPedido.mutate(orcamento)}
                          disabled={converterEmPedido.isPending}
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Converter
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog Criar Orçamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {editingOrcamentoId ? "Editar Orçamento" : "Novo Orçamento"}
              {!editingOrcamentoId && nextCodigo && (
                <Badge variant="outline" className="ml-2 font-mono text-xs">
                  <Hash className="h-3 w-3 mr-1" />
                  {nextCodigo}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Vendedor */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vendedor</Label>
                <Select value={vendedorNome} onValueChange={setVendedorNome}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores?.map((v) => (
                      <SelectItem key={v.id} value={v.nome_completo}>
                        {v.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data</Label>
                <Input value={format(new Date(), "dd/MM/yyyy")} disabled />
              </div>
            </div>

            {/* Seção Cliente */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Dados do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Busca de Cliente */}
                <div className="space-y-2">
                  <Label>Buscar Cliente</Label>
                  <Popover open={clienteComboOpen} onOpenChange={setClienteComboOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between"
                      >
                        {clienteSelecionado ? clienteSelecionado.razao_social : "Digite para buscar cliente..."}
                        <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[500px] p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput 
                          placeholder="Buscar por nome, fantasia ou documento..." 
                          value={clienteSearch}
                          onValueChange={setClienteSearch}
                        />
                        <CommandList>
                          {clientesFiltrados.length === 0 && (!clienteSearch || clienteSearch.length < 2) ? (
                            <CommandEmpty>
                              <p className="text-sm text-muted-foreground py-2">
                                Digite ao menos 2 caracteres...
                              </p>
                            </CommandEmpty>
                          ) : clientesFiltrados.length === 0 ? (
                            <CommandEmpty className="py-4">
                              <div className="text-center space-y-3">
                                <p className="text-sm text-muted-foreground">Nenhum cliente encontrado para "{clienteSearch}"</p>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => {
                                    setClienteComboOpen(false);
                                    setShowCadastroClienteDialog(true);
                                  }}
                                >
                                  <UserPlus className="h-4 w-4 mr-2" />
                                  Cadastrar Novo Cliente
                                </Button>
                              </div>
                            </CommandEmpty>
                          ) : (
                            <CommandGroup>
                              {clientesFiltrados.slice(0, 10).map((cliente) => (
                                <CommandItem
                                  key={cliente.id}
                                  value={cliente.id}
                                  onSelect={() => selecionarCliente(cliente)}
                                  className="cursor-pointer"
                                >
                                  <div className="flex flex-col">
                                    <span className="font-medium">{cliente.razao_social}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDocumento(cliente.documento, cliente.tipo_pessoa)}
                                      {cliente.nome_fantasia && ` • ${cliente.nome_fantasia}`}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                              {/* Botão cadastrar sempre visível no final da lista */}
                              {clienteSearch && clienteSearch.length >= 2 && (
                                <CommandItem
                                  value="__cadastrar_novo__"
                                  onSelect={() => {
                                    setClienteComboOpen(false);
                                    setShowCadastroClienteDialog(true);
                                  }}
                                  className="cursor-pointer border-t mt-1 pt-2"
                                >
                                  <UserPlus className="h-4 w-4 mr-2 text-primary" />
                                  <span className="text-primary font-medium">Cadastrar Novo Cliente</span>
                                </CommandItem>
                              )}
                            </CommandGroup>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Dados do cliente selecionado */}
                {clienteSelecionado && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Razão Social</p>
                      <p className="font-medium">{clienteSelecionado.razao_social}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        {clienteSelecionado.tipo_pessoa === "PJ" ? "CNPJ" : "CPF"}
                      </p>
                      <p className="font-medium font-mono">
                        {formatDocumento(clienteSelecionado.documento, clienteSelecionado.tipo_pessoa)}
                      </p>
                    </div>
                    {clienteSelecionado.endereco_completo && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Endereço
                        </p>
                        <p className="text-sm">{clienteSelecionado.endereco_completo}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-3 col-span-2 gap-4">
                      {clienteSelecionado.telefone && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Phone className="h-3 w-3" /> Telefone
                          </p>
                          <p className="text-sm">{maskPhone(clienteSelecionado.telefone)}</p>
                        </div>
                      )}
                      {clienteSelecionado.email && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Mail className="h-3 w-3" /> E-mail
                          </p>
                          <p className="text-sm">{clienteSelecionado.email}</p>
                        </div>
                      )}
                      {clienteSelecionado.whatsapp && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">WhatsApp</p>
                          <p className="text-sm">{maskPhone(clienteSelecionado.whatsapp)}</p>
                        </div>
                      )}
                    </div>
                    <div className="col-span-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setClienteId("");
                          setClienteSelecionado(null);
                          setClienteSearch("");
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Limpar seleção
                      </Button>
                    </div>
                  </div>
                )}

                {/* Alerta cliente não encontrado */}
                {clienteNaoEncontrado && !clienteComboOpen && (
                  <Alert variant="destructive">
                    <UserPlus className="h-4 w-4" />
                    <AlertDescription className="flex items-center justify-between">
                      <span>Cliente não encontrado no cadastro.</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/cadastros/entidades")}
                      >
                        Cadastrar Cliente
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Itens do Orçamento */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Produtos e Embalagem
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar Item
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {itens.map((item, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Item {index + 1}</span>
                      {itens.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeItem(index)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {/* Produto (Fórmula) */}
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-5">
                        <Label className="text-xs">Produto (Fórmula)</Label>
                        <Select
                          value={item.formula_id || ""}
                          onValueChange={(v) => selectFormula(index, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecionar fórmula..." />
                          </SelectTrigger>
                          <SelectContent>
                            {formulas?.map((formula) => (
                              <SelectItem key={formula.id} value={formula.id}>
                                {formula.nome_formula} ({formula.tipo_apresentacao})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Qtd (potes)</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => updateItem(index, "quantidade", parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Caps/pote</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.unidades_por_frasco}
                          onChange={(e) => updateItem(index, "unidades_por_frasco", parseInt(e.target.value) || 60)}
                        />
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">Preço Unit.</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.preco_unitario}
                          onChange={(e) => updateItem(index, "preco_unitario", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-1 flex flex-col justify-end">
                        <Label className="text-xs">Total</Label>
                        <p className="font-semibold text-sm h-10 flex items-center">
                          R$ {item.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Campos de Embalagem */}
                    <div className="grid grid-cols-5 gap-3 pt-2 border-t">
                      <div>
                        <Label className="text-xs">Rótulo</Label>
                        <Input
                          placeholder="Descrição do rótulo"
                          value={item.rotulo || ""}
                          onChange={(e) => updateItem(index, "rotulo", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cor Cápsula</Label>
                        <Select
                          value={item.capsula_cor || "Transparente"}
                          onValueChange={(v) => updateItem(index, "capsula_cor", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CORES_CAPSULA.map((cor) => (
                              <SelectItem key={cor} value={cor}>{cor}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Cor Pote</Label>
                        <Select
                          value={item.pote_cor || "Âmbar"}
                          onValueChange={(v) => updateItem(index, "pote_cor", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CORES_POTE.map((cor) => (
                              <SelectItem key={cor} value={cor}>{cor}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Cor Tampa</Label>
                        <Select
                          value={item.tampa_cor || "Preta"}
                          onValueChange={(v) => updateItem(index, "tampa_cor", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CORES_TAMPA.map((cor) => (
                              <SelectItem key={cor} value={cor}>{cor}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-end">
                        <div className="flex items-center space-x-2 h-10">
                          <Checkbox
                            id={`silica-${index}`}
                            checked={item.incluir_silica}
                            onCheckedChange={(checked) => updateItem(index, "incluir_silica", !!checked)}
                          />
                          <Label htmlFor={`silica-${index}`} className="text-xs cursor-pointer">
                            Incluir Sílica
                          </Label>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="pt-4 border-t space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Forma de Pagamento</Label>
                      <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FORMAS_PAGAMENTO.map((fp) => (
                            <SelectItem key={fp.value} value={fp.value}>{fp.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Desconto (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={descontoPercentual}
                        onChange={(e) => setDescontoPercentual(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-sm text-muted-foreground">
                      Subtotal: R$ {valorTotalItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                    {descontoPercentual > 0 && (
                      <div className="text-sm text-destructive">
                        Desconto ({descontoPercentual}%): - R$ {valorDescontoItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    <div className="text-lg font-bold">
                      Total Final: R$ {valorFinalItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações do orçamento..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); setEditingOrcamentoId(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button 
              onClick={() => editingOrcamentoId ? editarOrcamento.mutate() : criarOrcamento.mutate()} 
              disabled={(editingOrcamentoId ? editarOrcamento.isPending : criarOrcamento.isPending) || !clienteSelecionado || !itens.some(i => i.produto_nome)}
            >
              {(editingOrcamentoId ? editarOrcamento.isPending : criarOrcamento.isPending) 
                ? "Salvando..." 
                : editingOrcamentoId ? "Salvar Alterações" : "Criar Orçamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Visualizar Completo */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Orçamento {selectedOrcamento?.codigo}
              {selectedOrcamento && (
                <StatusBadge variant={getStatusVariant(selectedOrcamento.status)} className="ml-2">
                  {selectedOrcamento.status}
                </StatusBadge>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedOrcamento && (
            <div className="space-y-6">
              {/* Cabeçalho: Datas e Vendedor */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Data do Orçamento</p>
                  <p className="font-medium">
                    {selectedOrcamento.data_orcamento && format(new Date(selectedOrcamento.data_orcamento), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Validade</p>
                  <p className="font-medium">
                    {selectedOrcamento.data_validade && format(new Date(selectedOrcamento.data_validade), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vendedor</p>
                  <p className="font-medium">{(selectedOrcamento as any).vendedor_nome || "—"}</p>
                </div>
              </div>

              {/* Pagamento e Valores */}
              <div className="grid grid-cols-4 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Forma de Pagamento</p>
                  <p className="font-semibold">{getFormaPagamentoLabel((selectedOrcamento as any).forma_pagamento || "A_VISTA")}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Subtotal</p>
                  <p className="font-medium">
                    R$ {Number(selectedOrcamento.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Desconto</p>
                  <p className="font-medium text-destructive">
                    {Number((selectedOrcamento as any).desconto_percentual || 0)}%
                    {Number((selectedOrcamento as any).desconto_percentual || 0) > 0 && (
                      <span className="text-xs ml-1">
                        (- R$ {(Number(selectedOrcamento.valor_total || 0) * Number((selectedOrcamento as any).desconto_percentual || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Valor Final</p>
                  <p className="text-2xl font-bold text-secondary">
                    R$ {Number(selectedOrcamento.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Dados do Cliente */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Dados do Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Razão Social</p>
                      <p className="font-medium">{selectedOrcamento.cliente_nome}</p>
                    </div>
                    {selectedOrcamento.cliente_documento && (
                      <div>
                        <p className="text-xs text-muted-foreground">CNPJ/CPF</p>
                        <p className="font-medium font-mono">{selectedOrcamento.cliente_documento}</p>
                      </div>
                    )}
                    {selectedOrcamento.cliente_endereco && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> Endereço
                        </p>
                        <p className="text-sm">{selectedOrcamento.cliente_endereco}</p>
                      </div>
                    )}
                    {selectedOrcamento.cliente_telefone && (
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Telefone
                        </p>
                        <p className="text-sm">{maskPhone(selectedOrcamento.cliente_telefone)}</p>
                      </div>
                    )}
                    {selectedOrcamento.cliente_email && (
                      <div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" /> E-mail
                        </p>
                        <p className="text-sm">{selectedOrcamento.cliente_email}</p>
                      </div>
                    )}
                    {selectedOrcamento.cliente_whatsapp && (
                      <div>
                        <p className="text-xs text-muted-foreground">WhatsApp</p>
                        <p className="text-sm">{maskPhone(selectedOrcamento.cliente_whatsapp)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Itens do Orçamento */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Palette className="h-4 w-4" />
                    Produtos e Embalagem ({orcamentoItens?.length || 0} {(orcamentoItens?.length || 0) === 1 ? 'item' : 'itens'})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!orcamentoItens || orcamentoItens.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum item registrado</p>
                  ) : (
                    <div className="space-y-4">
                      {orcamentoItens.map((item: any, idx: number) => (
                        <div key={item.id} className="border rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold">Item {idx + 1}: {item.produto_nome}</span>
                            <span className="font-bold text-secondary">
                              R$ {Number(item.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="grid grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Quantidade</p>
                              <p className="font-medium">{item.quantidade} potes</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Caps/Pote</p>
                              <p className="font-medium">{item.unidades_por_frasco || 60}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Preço Unitário</p>
                              <p className="font-medium">
                                R$ {Number(item.preco_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Preço Final</p>
                              <p className="font-medium">
                                R$ {Number(item.preco_final || item.preco_unitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                          {/* Dados de Embalagem */}
                          <div className="grid grid-cols-5 gap-3 text-sm pt-2 border-t">
                            {item.rotulo && (
                              <div>
                                <p className="text-xs text-muted-foreground">Rótulo</p>
                                <p className="font-medium">{item.rotulo}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground">Cor Cápsula</p>
                              <p className="font-medium">{item.capsula_cor || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Cor Pote</p>
                              <p className="font-medium">{item.pote_cor || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Cor Tampa</p>
                              <p className="font-medium">{item.tampa_cor || "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Sílica</p>
                              <p className="font-medium">{item.incluir_silica ? "Sim" : "Não"}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Total geral */}
                      <div className="text-right pt-2 border-t space-y-1">
                        <div className="text-sm text-muted-foreground">
                          Subtotal: R$ {Number(selectedOrcamento.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                        {Number((selectedOrcamento as any).desconto_percentual || 0) > 0 && (
                          <div className="text-sm text-destructive">
                            Desconto ({(selectedOrcamento as any).desconto_percentual}%): - R$ {(Number(selectedOrcamento.valor_total || 0) * Number((selectedOrcamento as any).desconto_percentual || 0) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </div>
                        )}
                        <div className="text-lg font-bold">
                          Total Final: R$ {Number(selectedOrcamento.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Observações */}
              {selectedOrcamento.observacoes && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{selectedOrcamento.observacoes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            {selectedOrcamento && selectedOrcamento.status !== "CONVERTIDO" && selectedOrcamento.status !== "RECUSADO" && selectedOrcamento.status !== "EXPIRADO" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleEditClick(selectedOrcamento)}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewDialogOpen(false);
                    setContratoDialogOpen(true);
                  }}
                >
                  <FileSignature className="h-4 w-4 mr-2" />
                  Abrir Contrato
                </Button>
              </>
            )}
            {selectedOrcamento && (selectedOrcamento as any).contrato_status === "ASSINADO" && selectedOrcamento.status !== "CONVERTIDO" && (
              <Button 
                onClick={() => converterEmPedido.mutate(selectedOrcamento)}
                disabled={converterEmPedido.isPending}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Converter em Pedido
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Dialog Cadastrar Cliente inline */}
      <EntidadeFormDialogComplete
        open={showCadastroClienteDialog}
        onOpenChange={setShowCadastroClienteDialog}
        initialPapel="CLIENTE"
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["clientes-orcamento-completo"] });
          setShowCadastroClienteDialog(false);
        }}
      />
      {/* Dialog Contrato Workflow */}
      <ContratoWorkflowDialog
        open={contratoDialogOpen}
        onOpenChange={setContratoDialogOpen}
        orcamento={selectedOrcamento as any}
        onUpdate={() => {
          queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
        }}
      />
      {/* Dialog Confirmar Edição */}
      <ConfirmDialog
        open={editConfirmOpen}
        onOpenChange={setEditConfirmOpen}
        title="⚠️ Editar Orçamento"
        description={`Tem certeza que deseja editar o orçamento ${orcamentoParaEditar?.codigo}? Todos os dados atuais serão sobrescritos com as novas informações. Esta ação não pode ser desfeita.`}
        confirmLabel="Sim, Editar"
        cancelLabel="Cancelar"
        variant="destructive"
        onConfirm={confirmarEdicao}
      />
    </div>
  );
}
