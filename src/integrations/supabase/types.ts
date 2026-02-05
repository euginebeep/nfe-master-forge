export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      arquivos: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          id: string
          mime_type: string
          nome_original: string
          sensivel: boolean
          storage_key: string
          tamanho: number
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          mime_type: string
          nome_original: string
          sensivel?: boolean
          storage_key: string
          tamanho?: number
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          id?: string
          mime_type?: string
          nome_original?: string
          sensivel?: boolean
          storage_key?: string
          tamanho?: number
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          entidade: string
          entidade_id: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          acao: string
          created_at?: string
          entidade: string
          entidade_id?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          acao?: string
          created_at?: string
          entidade?: string
          entidade_id?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      company: {
        Row: {
          certificado_a1_file_id: string | null
          certificado_senha_encrypted: string | null
          cnae: string | null
          cnpj: string
          created_at: string
          crt: string | null
          csc_idtoken: string | null
          csc_token: string | null
          email_financeiro: string | null
          email_fiscal: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_cmun: string | null
          endereco_compl: string | null
          endereco_cpais: string | null
          endereco_logradouro: string | null
          endereco_nro: string | null
          endereco_pais: string | null
          endereco_uf: string | null
          id: string
          ie: string | null
          im: string | null
          logo_file_id: string | null
          nfe_ambiente: string | null
          nfe_numero_inicial: number | null
          nfe_serie_padrao: number | null
          nome_fantasia: string | null
          razao_social: string
          regime_apuracao: string | null
          regime_tributario: string | null
          site: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          certificado_a1_file_id?: string | null
          certificado_senha_encrypted?: string | null
          cnae?: string | null
          cnpj: string
          created_at?: string
          crt?: string | null
          csc_idtoken?: string | null
          csc_token?: string | null
          email_financeiro?: string | null
          email_fiscal?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_cmun?: string | null
          endereco_compl?: string | null
          endereco_cpais?: string | null
          endereco_logradouro?: string | null
          endereco_nro?: string | null
          endereco_pais?: string | null
          endereco_uf?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logo_file_id?: string | null
          nfe_ambiente?: string | null
          nfe_numero_inicial?: number | null
          nfe_serie_padrao?: number | null
          nome_fantasia?: string | null
          razao_social: string
          regime_apuracao?: string | null
          regime_tributario?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          certificado_a1_file_id?: string | null
          certificado_senha_encrypted?: string | null
          cnae?: string | null
          cnpj?: string
          created_at?: string
          crt?: string | null
          csc_idtoken?: string | null
          csc_token?: string | null
          email_financeiro?: string | null
          email_fiscal?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_cmun?: string | null
          endereco_compl?: string | null
          endereco_cpais?: string | null
          endereco_logradouro?: string | null
          endereco_nro?: string | null
          endereco_pais?: string | null
          endereco_uf?: string | null
          id?: string
          ie?: string | null
          im?: string | null
          logo_file_id?: string | null
          nfe_ambiente?: string | null
          nfe_numero_inicial?: number | null
          nfe_serie_padrao?: number | null
          nome_fantasia?: string | null
          razao_social?: string
          regime_apuracao?: string | null
          regime_tributario?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_certificado_a1_file_id_fkey"
            columns: ["certificado_a1_file_id"]
            isOneToOne: false
            referencedRelation: "arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_logo_file_id_fkey"
            columns: ["logo_file_id"]
            isOneToOne: false
            referencedRelation: "arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_comercial_crm: {
        Row: {
          canal_preferido: string | null
          comissao_padrao_percent: number | null
          desconto_maximo_percent: number | null
          entidade_id: string
          etapa_funil: string | null
          observacoes_comerciais: string | null
          origem_lead: string | null
          responsavel_usuario_id: string | null
          score: number | null
          tabela_preco_padrao: string | null
          updated_at: string | null
        }
        Insert: {
          canal_preferido?: string | null
          comissao_padrao_percent?: number | null
          desconto_maximo_percent?: number | null
          entidade_id: string
          etapa_funil?: string | null
          observacoes_comerciais?: string | null
          origem_lead?: string | null
          responsavel_usuario_id?: string | null
          score?: number | null
          tabela_preco_padrao?: string | null
          updated_at?: string | null
        }
        Update: {
          canal_preferido?: string | null
          comissao_padrao_percent?: number | null
          desconto_maximo_percent?: number | null
          entidade_id?: string
          etapa_funil?: string | null
          observacoes_comerciais?: string | null
          origem_lead?: string | null
          responsavel_usuario_id?: string | null
          score?: number | null
          tabela_preco_padrao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entidade_comercial_crm_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: true
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_contatos: {
        Row: {
          aceita_whatsapp: boolean | null
          cargo: string | null
          created_at: string
          departamento: string | null
          email: string | null
          entidade_id: string
          id: string
          nome: string
          observacoes: string | null
          origem: string | null
          preferencia_contato: string | null
          preferencial: boolean | null
          telefone: string | null
          whatsapp: string | null
        }
        Insert: {
          aceita_whatsapp?: boolean | null
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          email?: string | null
          entidade_id: string
          id?: string
          nome: string
          observacoes?: string | null
          origem?: string | null
          preferencia_contato?: string | null
          preferencial?: boolean | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Update: {
          aceita_whatsapp?: boolean | null
          cargo?: string | null
          created_at?: string
          departamento?: string | null
          email?: string | null
          entidade_id?: string
          id?: string
          nome?: string
          observacoes?: string | null
          origem?: string | null
          preferencia_contato?: string | null
          preferencial?: boolean | null
          telefone?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entidade_contatos_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_documentos: {
        Row: {
          created_at: string | null
          entidade_id: string
          hash_arquivo: string | null
          id: string
          mime_type: string | null
          nome_arquivo: string
          observacoes: string | null
          storage_key: string
          tamanho_bytes: number | null
          tipo: string | null
        }
        Insert: {
          created_at?: string | null
          entidade_id: string
          hash_arquivo?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          observacoes?: string | null
          storage_key: string
          tamanho_bytes?: number | null
          tipo?: string | null
        }
        Update: {
          created_at?: string | null
          entidade_id?: string
          hash_arquivo?: string | null
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          observacoes?: string | null
          storage_key?: string
          tamanho_bytes?: number | null
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entidade_documentos_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_enderecos: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cmun: string | null
          compl: string | null
          contato_local_fone: string | null
          contato_local_nome: string | null
          cpais: string | null
          created_at: string
          entidade_id: string
          id: string
          logradouro: string | null
          nro: string | null
          pais: string | null
          principal: boolean | null
          referencia: string | null
          tipo: string
          uf: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cmun?: string | null
          compl?: string | null
          contato_local_fone?: string | null
          contato_local_nome?: string | null
          cpais?: string | null
          created_at?: string
          entidade_id: string
          id?: string
          logradouro?: string | null
          nro?: string | null
          pais?: string | null
          principal?: boolean | null
          referencia?: string | null
          tipo?: string
          uf?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cmun?: string | null
          compl?: string | null
          contato_local_fone?: string | null
          contato_local_nome?: string | null
          cpais?: string | null
          created_at?: string
          entidade_id?: string
          id?: string
          logradouro?: string | null
          nro?: string | null
          pais?: string | null
          principal?: boolean | null
          referencia?: string | null
          tipo?: string
          uf?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entidade_enderecos_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_financeiro_config: {
        Row: {
          bloquear_inadimplencia: boolean | null
          categoria_financeira_padrao: string | null
          centro_custo_padrao: string | null
          condicao_pagamento_padrao: string | null
          dias_tolerancia: number | null
          email_boleto: string | null
          email_nfe: string | null
          entidade_id: string
          forma_pagamento_padrao: string | null
          importar_duplicatas_xml_gera_contas_pagar: boolean | null
          limite_credito: number | null
          updated_at: string | null
        }
        Insert: {
          bloquear_inadimplencia?: boolean | null
          categoria_financeira_padrao?: string | null
          centro_custo_padrao?: string | null
          condicao_pagamento_padrao?: string | null
          dias_tolerancia?: number | null
          email_boleto?: string | null
          email_nfe?: string | null
          entidade_id: string
          forma_pagamento_padrao?: string | null
          importar_duplicatas_xml_gera_contas_pagar?: boolean | null
          limite_credito?: number | null
          updated_at?: string | null
        }
        Update: {
          bloquear_inadimplencia?: boolean | null
          categoria_financeira_padrao?: string | null
          centro_custo_padrao?: string | null
          condicao_pagamento_padrao?: string | null
          dias_tolerancia?: number | null
          email_boleto?: string | null
          email_nfe?: string | null
          entidade_id?: string
          forma_pagamento_padrao?: string | null
          importar_duplicatas_xml_gera_contas_pagar?: boolean | null
          limite_credito?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entidade_financeiro_config_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: true
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_fiscal_config: {
        Row: {
          bloquear_sem_cpf_cnpj_valido: boolean | null
          bloquear_sem_ie_quando_exigido: boolean | null
          cfop_padrao_entrada: string | null
          cfop_padrao_saida: string | null
          cst_cofins_padrao: string | null
          cst_icms_padrao: string | null
          cst_pis_padrao: string | null
          entidade_id: string
          natureza_operacao_padrao: string | null
          observacao_fiscal_padrao: string | null
          updated_at: string | null
        }
        Insert: {
          bloquear_sem_cpf_cnpj_valido?: boolean | null
          bloquear_sem_ie_quando_exigido?: boolean | null
          cfop_padrao_entrada?: string | null
          cfop_padrao_saida?: string | null
          cst_cofins_padrao?: string | null
          cst_icms_padrao?: string | null
          cst_pis_padrao?: string | null
          entidade_id: string
          natureza_operacao_padrao?: string | null
          observacao_fiscal_padrao?: string | null
          updated_at?: string | null
        }
        Update: {
          bloquear_sem_cpf_cnpj_valido?: boolean | null
          bloquear_sem_ie_quando_exigido?: boolean | null
          cfop_padrao_entrada?: string | null
          cfop_padrao_saida?: string | null
          cst_cofins_padrao?: string | null
          cst_icms_padrao?: string | null
          cst_pis_padrao?: string | null
          entidade_id?: string
          natureza_operacao_padrao?: string | null
          observacao_fiscal_padrao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entidade_fiscal_config_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: true
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_logistica_config: {
        Row: {
          entidade_id: string
          frete_padrao: string | null
          janela_recebimento: string | null
          lead_time_dias: number | null
          observacoes_entrega: string | null
          pedido_minimo: number | null
          prazo_medio_entrega_dias: number | null
          transportadora_preferencial_entidade_id: string | null
          updated_at: string | null
        }
        Insert: {
          entidade_id: string
          frete_padrao?: string | null
          janela_recebimento?: string | null
          lead_time_dias?: number | null
          observacoes_entrega?: string | null
          pedido_minimo?: number | null
          prazo_medio_entrega_dias?: number | null
          transportadora_preferencial_entidade_id?: string | null
          updated_at?: string | null
        }
        Update: {
          entidade_id?: string
          frete_padrao?: string | null
          janela_recebimento?: string | null
          lead_time_dias?: number | null
          observacoes_entrega?: string | null
          pedido_minimo?: number | null
          prazo_medio_entrega_dias?: number | null
          transportadora_preferencial_entidade_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entidade_logistica_config_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: true
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entidade_logistica_config_transportadora_preferencial_enti_fkey"
            columns: ["transportadora_preferencial_entidade_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidade_papeis: {
        Row: {
          created_at: string
          dados_especificos: Json | null
          entidade_id: string
          id: string
          papel: string
        }
        Insert: {
          created_at?: string
          dados_especificos?: Json | null
          entidade_id: string
          id?: string
          papel: string
        }
        Update: {
          created_at?: string
          dados_especificos?: Json | null
          entidade_id?: string
          id?: string
          papel?: string
        }
        Relationships: [
          {
            foreignKeyName: "entidade_papeis_entidade_id_fkey"
            columns: ["entidade_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      entidades: {
        Row: {
          classificacao: string | null
          cnae: string | null
          codigo_interno: string | null
          condicao_frete_padrao: string | null
          contribuinte_icms: string | null
          created_at: string
          crt: string | null
          documento: string
          id: string
          ie: string | null
          im: string | null
          limite_credito: number | null
          nome_fantasia: string | null
          observacoes: string | null
          prazo_pagamento_padrao_dias: number | null
          razao_social: string
          score_risco: number | null
          site: string | null
          status: string
          tags: Json | null
          tipo_pessoa: string
          updated_at: string
        }
        Insert: {
          classificacao?: string | null
          cnae?: string | null
          codigo_interno?: string | null
          condicao_frete_padrao?: string | null
          contribuinte_icms?: string | null
          created_at?: string
          crt?: string | null
          documento: string
          id?: string
          ie?: string | null
          im?: string | null
          limite_credito?: number | null
          nome_fantasia?: string | null
          observacoes?: string | null
          prazo_pagamento_padrao_dias?: number | null
          razao_social: string
          score_risco?: number | null
          site?: string | null
          status?: string
          tags?: Json | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Update: {
          classificacao?: string | null
          cnae?: string | null
          codigo_interno?: string | null
          condicao_frete_padrao?: string | null
          contribuinte_icms?: string | null
          created_at?: string
          crt?: string | null
          documento?: string
          id?: string
          ie?: string | null
          im?: string | null
          limite_credito?: number | null
          nome_fantasia?: string | null
          observacoes?: string | null
          prazo_pagamento_padrao_dias?: number | null
          razao_social?: string
          score_risco?: number | null
          site?: string | null
          status?: string
          tags?: Json | null
          tipo_pessoa?: string
          updated_at?: string
        }
        Relationships: []
      }
      estoque_lotes: {
        Row: {
          created_at: string
          custo_unitario_interno: number | null
          custo_unitario_original: number | null
          data_fab: string | null
          data_val: string | null
          fornecedor_id: string | null
          id: string
          item_id: string
          nota_entrada_item_id: string | null
          numero_lote: string
          observacoes_qc: string | null
          quantidade_interna: number
          quantidade_original: number
          status: string
          unidade_original: string
        }
        Insert: {
          created_at?: string
          custo_unitario_interno?: number | null
          custo_unitario_original?: number | null
          data_fab?: string | null
          data_val?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id: string
          nota_entrada_item_id?: string | null
          numero_lote: string
          observacoes_qc?: string | null
          quantidade_interna: number
          quantidade_original: number
          status?: string
          unidade_original: string
        }
        Update: {
          created_at?: string
          custo_unitario_interno?: number | null
          custo_unitario_original?: number | null
          data_fab?: string | null
          data_val?: string | null
          fornecedor_id?: string | null
          id?: string
          item_id?: string
          nota_entrada_item_id?: string | null
          numero_lote?: string
          observacoes_qc?: string | null
          quantidade_interna?: number
          quantidade_original?: number
          status?: string
          unidade_original?: string
        }
        Relationships: [
          {
            foreignKeyName: "estoque_lotes_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lotes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_lotes_nota_entrada_item_id_fkey"
            columns: ["nota_entrada_item_id"]
            isOneToOne: false
            referencedRelation: "notas_entrada_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      item_alias: {
        Row: {
          created_at: string
          fornecedor_id: string | null
          id: string
          item_id: string
          texto: string
          tipo: string | null
        }
        Insert: {
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          item_id: string
          texto: string
          tipo?: string | null
        }
        Update: {
          created_at?: string
          fornecedor_id?: string | null
          id?: string
          item_id?: string
          texto?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_alias_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_alias_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      item_fornecedores: {
        Row: {
          codigo_fornecedor: string | null
          created_at: string
          descricao_fornecedor: string | null
          fator_para_unidade_interna: number | null
          fornecedor_id: string
          fornecedor_preferencial: boolean | null
          id: string
          item_id: string
          lead_time_dias: number | null
          moq: number | null
          preco_referencia: number | null
          unidade_compra_padrao: string | null
        }
        Insert: {
          codigo_fornecedor?: string | null
          created_at?: string
          descricao_fornecedor?: string | null
          fator_para_unidade_interna?: number | null
          fornecedor_id: string
          fornecedor_preferencial?: boolean | null
          id?: string
          item_id: string
          lead_time_dias?: number | null
          moq?: number | null
          preco_referencia?: number | null
          unidade_compra_padrao?: string | null
        }
        Update: {
          codigo_fornecedor?: string | null
          created_at?: string
          descricao_fornecedor?: string | null
          fator_para_unidade_interna?: number | null
          fornecedor_id?: string
          fornecedor_preferencial?: boolean | null
          id?: string
          item_id?: string
          lead_time_dias?: number | null
          moq?: number | null
          preco_referencia?: number | null
          unidade_compra_padrao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "item_fornecedores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_fornecedores_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      itens: {
        Row: {
          armazenamento: string | null
          ativo: boolean
          categoria_operacional: string | null
          controla_lote: boolean
          controla_validade: boolean
          created_at: string
          criticidade: string | null
          densidade_aparente: number | null
          descricao_comercial: string | null
          descricao_interna: string
          ean: string | null
          exige_premix: boolean | null
          fator_conversao: number | null
          higroscopico: boolean | null
          id: string
          ncm: string | null
          potencia_compra: number | null
          potencia_rotulo: number | null
          sku_interno: string | null
          tipo_item: string
          unidade_declaracao: string | null
          unidade_interna: string
          unidade_pesagem: string | null
          updated_at: string
        }
        Insert: {
          armazenamento?: string | null
          ativo?: boolean
          categoria_operacional?: string | null
          controla_lote?: boolean
          controla_validade?: boolean
          created_at?: string
          criticidade?: string | null
          densidade_aparente?: number | null
          descricao_comercial?: string | null
          descricao_interna: string
          ean?: string | null
          exige_premix?: boolean | null
          fator_conversao?: number | null
          higroscopico?: boolean | null
          id?: string
          ncm?: string | null
          potencia_compra?: number | null
          potencia_rotulo?: number | null
          sku_interno?: string | null
          tipo_item?: string
          unidade_declaracao?: string | null
          unidade_interna?: string
          unidade_pesagem?: string | null
          updated_at?: string
        }
        Update: {
          armazenamento?: string | null
          ativo?: boolean
          categoria_operacional?: string | null
          controla_lote?: boolean
          controla_validade?: boolean
          created_at?: string
          criticidade?: string | null
          densidade_aparente?: number | null
          descricao_comercial?: string | null
          descricao_interna?: string
          ean?: string | null
          exige_premix?: boolean | null
          fator_conversao?: number | null
          higroscopico?: boolean | null
          id?: string
          ncm?: string | null
          potencia_compra?: number | null
          potencia_rotulo?: number | null
          sku_interno?: string | null
          tipo_item?: string
          unidade_declaracao?: string | null
          unidade_interna?: string
          unidade_pesagem?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lote_documentos: {
        Row: {
          arquivo_id: string | null
          created_at: string
          data_emissao: string | null
          hash_arquivo: string | null
          id: string
          lote_id: string
          observacoes: string | null
          status_validacao: string | null
          tipo_documento: string
          versao: number | null
        }
        Insert: {
          arquivo_id?: string | null
          created_at?: string
          data_emissao?: string | null
          hash_arquivo?: string | null
          id?: string
          lote_id: string
          observacoes?: string | null
          status_validacao?: string | null
          tipo_documento?: string
          versao?: number | null
        }
        Update: {
          arquivo_id?: string | null
          created_at?: string
          data_emissao?: string | null
          hash_arquivo?: string | null
          id?: string
          lote_id?: string
          observacoes?: string | null
          status_validacao?: string | null
          tipo_documento?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lote_documentos_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_documentos_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_entrada: {
        Row: {
          chave_nfe: string
          company_id: string | null
          created_at: string
          dh_emissao: string | null
          fornecedor_id: string | null
          id: string
          modelo: string | null
          numero: string | null
          serie: string | null
          status: string
          total_nota: number | null
          total_produtos: number | null
          xml_raw: string | null
        }
        Insert: {
          chave_nfe: string
          company_id?: string | null
          created_at?: string
          dh_emissao?: string | null
          fornecedor_id?: string | null
          id?: string
          modelo?: string | null
          numero?: string | null
          serie?: string | null
          status?: string
          total_nota?: number | null
          total_produtos?: number | null
          xml_raw?: string | null
        }
        Update: {
          chave_nfe?: string
          company_id?: string | null
          created_at?: string
          dh_emissao?: string | null
          fornecedor_id?: string | null
          id?: string
          modelo?: string | null
          numero?: string | null
          serie?: string | null
          status?: string
          total_nota?: number | null
          total_produtos?: number | null
          xml_raw?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_entrada_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_entrada_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_entrada_itens: {
        Row: {
          cfop: string | null
          codigo_fornecedor: string | null
          created_at: string
          descricao: string | null
          ean: string | null
          id: string
          item_id: string | null
          ncm: string | null
          nota_entrada_id: string
          qcom: number | null
          ucom: string | null
          vprod: number | null
          vuncom: number | null
        }
        Insert: {
          cfop?: string | null
          codigo_fornecedor?: string | null
          created_at?: string
          descricao?: string | null
          ean?: string | null
          id?: string
          item_id?: string | null
          ncm?: string | null
          nota_entrada_id: string
          qcom?: number | null
          ucom?: string | null
          vprod?: number | null
          vuncom?: number | null
        }
        Update: {
          cfop?: string | null
          codigo_fornecedor?: string | null
          created_at?: string
          descricao?: string | null
          ean?: string | null
          id?: string
          item_id?: string | null
          ncm?: string | null
          nota_entrada_id?: string
          qcom?: number | null
          ucom?: string | null
          vprod?: number | null
          vuncom?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_entrada_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_entrada_itens_nota_entrada_id_fkey"
            columns: ["nota_entrada_id"]
            isOneToOne: false
            referencedRelation: "notas_entrada"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
