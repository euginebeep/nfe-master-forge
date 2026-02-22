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
      alegacoes_anvisa: {
        Row: {
          created_at: string | null
          fonte_anvisa: string | null
          formula_id: string
          id: string
          permitido: boolean | null
          texto_alegacao: string
        }
        Insert: {
          created_at?: string | null
          fonte_anvisa?: string | null
          formula_id: string
          id?: string
          permitido?: boolean | null
          texto_alegacao: string
        }
        Update: {
          created_at?: string | null
          fonte_anvisa?: string | null
          formula_id?: string
          id?: string
          permitido?: boolean | null
          texto_alegacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "alegacoes_anvisa_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      alertas_executivos: {
        Row: {
          acao_sugerida: string | null
          created_at: string | null
          dados_contexto: Json | null
          descricao: string
          entidade_codigo: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          expires_at: string | null
          id: string
          impacto_financeiro: number | null
          nivel: Database["public"]["Enums"]["nivel_alerta"]
          resolucao_observacoes: string | null
          resolvido_em: string | null
          resolvido_por: string | null
          status: string | null
          tipo_alerta: Database["public"]["Enums"]["tipo_alerta_executivo"]
          titulo: string
          valor_atual: number | null
          valor_referencia: number | null
          visualizado_em: string | null
          visualizado_por: string | null
        }
        Insert: {
          acao_sugerida?: string | null
          created_at?: string | null
          dados_contexto?: Json | null
          descricao: string
          entidade_codigo?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          expires_at?: string | null
          id?: string
          impacto_financeiro?: number | null
          nivel?: Database["public"]["Enums"]["nivel_alerta"]
          resolucao_observacoes?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string | null
          tipo_alerta: Database["public"]["Enums"]["tipo_alerta_executivo"]
          titulo: string
          valor_atual?: number | null
          valor_referencia?: number | null
          visualizado_em?: string | null
          visualizado_por?: string | null
        }
        Update: {
          acao_sugerida?: string | null
          created_at?: string | null
          dados_contexto?: Json | null
          descricao?: string
          entidade_codigo?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          expires_at?: string | null
          id?: string
          impacto_financeiro?: number | null
          nivel?: Database["public"]["Enums"]["nivel_alerta"]
          resolucao_observacoes?: string | null
          resolvido_em?: string | null
          resolvido_por?: string | null
          status?: string | null
          tipo_alerta?: Database["public"]["Enums"]["tipo_alerta_executivo"]
          titulo?: string
          valor_atual?: number | null
          valor_referencia?: number | null
          visualizado_em?: string | null
          visualizado_por?: string | null
        }
        Relationships: []
      }
      anomalias_operacionais: {
        Row: {
          analise_observacoes: string | null
          created_at: string | null
          descricao: string
          desvio_percentual: number | null
          formula_id: string | null
          id: string
          lote_id: string | null
          op_id: string | null
          resolvido_em: string | null
          responsavel_analise: string | null
          severidade: Database["public"]["Enums"]["severidade_anomalia"]
          status: string | null
          tipo_anomalia: Database["public"]["Enums"]["tipo_anomalia"]
          valor_esperado: number | null
          valor_real: number | null
        }
        Insert: {
          analise_observacoes?: string | null
          created_at?: string | null
          descricao: string
          desvio_percentual?: number | null
          formula_id?: string | null
          id?: string
          lote_id?: string | null
          op_id?: string | null
          resolvido_em?: string | null
          responsavel_analise?: string | null
          severidade?: Database["public"]["Enums"]["severidade_anomalia"]
          status?: string | null
          tipo_anomalia: Database["public"]["Enums"]["tipo_anomalia"]
          valor_esperado?: number | null
          valor_real?: number | null
        }
        Update: {
          analise_observacoes?: string | null
          created_at?: string | null
          descricao?: string
          desvio_percentual?: number | null
          formula_id?: string | null
          id?: string
          lote_id?: string | null
          op_id?: string | null
          resolvido_em?: string | null
          responsavel_analise?: string | null
          severidade?: Database["public"]["Enums"]["severidade_anomalia"]
          status?: string | null
          tipo_anomalia?: Database["public"]["Enums"]["tipo_anomalia"]
          valor_esperado?: number | null
          valor_real?: number | null
        }
        Relationships: []
      }
      anvisa_alegacoes_detalhadas: {
        Row: {
          ativo: boolean | null
          constituinte_id: string | null
          created_at: string | null
          grupo_populacional: string[] | null
          id: string
          norma_aprovacao: string | null
          requisitos_composicao: string | null
          requisitos_rotulagem: string | null
          texto_alegacao: string
        }
        Insert: {
          ativo?: boolean | null
          constituinte_id?: string | null
          created_at?: string | null
          grupo_populacional?: string[] | null
          id?: string
          norma_aprovacao?: string | null
          requisitos_composicao?: string | null
          requisitos_rotulagem?: string | null
          texto_alegacao: string
        }
        Update: {
          ativo?: boolean | null
          constituinte_id?: string | null
          created_at?: string | null
          grupo_populacional?: string[] | null
          id?: string
          norma_aprovacao?: string | null
          requisitos_composicao?: string | null
          requisitos_rotulagem?: string | null
          texto_alegacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "anvisa_alegacoes_detalhadas_constituinte_id_fkey"
            columns: ["constituinte_id"]
            isOneToOne: false
            referencedRelation: "anvisa_constituintes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anvisa_alegacoes_detalhadas_constituinte_id_fkey"
            columns: ["constituinte_id"]
            isOneToOne: false
            referencedRelation: "vw_anvisa_constituintes_completo"
            referencedColumns: ["id"]
          },
        ]
      }
      anvisa_constituintes: {
        Row: {
          advertencias: string[] | null
          alegacoes: string[] | null
          anexo_origem: string
          ativo: boolean | null
          cas_number: string | null
          categoria: string
          created_at: string | null
          data_inclusao: string | null
          fonte_de: string | null
          fonte_url: string | null
          grupos_nao_autorizados: string[] | null
          grupos_permitidos: string[] | null
          id: string
          is_proibido: boolean | null
          limites_0_6_meses: Json | null
          limites_1_3_anos: Json | null
          limites_19_mais: Json | null
          limites_4_8_anos: Json | null
          limites_7_11_meses: Json | null
          limites_9_18_anos: Json | null
          limites_gestantes: Json | null
          limites_lactantes: Json | null
          motivo_proibicao: string | null
          nome_generico: string | null
          nome_popular: string[] | null
          nome_rotulo: string | null
          nome_tecnico: string
          norma_inclusao: string
          norma_ultima_alteracao: string | null
          referencias_especificacao: string[] | null
          restricoes_uso: string | null
          rotulagem_complementar: string[] | null
          search_vector: unknown
          sinonimos: string[] | null
          subcategoria: string | null
          sync_id: string | null
          updated_at: string | null
          verificado_em: string | null
        }
        Insert: {
          advertencias?: string[] | null
          alegacoes?: string[] | null
          anexo_origem?: string
          ativo?: boolean | null
          cas_number?: string | null
          categoria: string
          created_at?: string | null
          data_inclusao?: string | null
          fonte_de?: string | null
          fonte_url?: string | null
          grupos_nao_autorizados?: string[] | null
          grupos_permitidos?: string[] | null
          id?: string
          is_proibido?: boolean | null
          limites_0_6_meses?: Json | null
          limites_1_3_anos?: Json | null
          limites_19_mais?: Json | null
          limites_4_8_anos?: Json | null
          limites_7_11_meses?: Json | null
          limites_9_18_anos?: Json | null
          limites_gestantes?: Json | null
          limites_lactantes?: Json | null
          motivo_proibicao?: string | null
          nome_generico?: string | null
          nome_popular?: string[] | null
          nome_rotulo?: string | null
          nome_tecnico: string
          norma_inclusao?: string
          norma_ultima_alteracao?: string | null
          referencias_especificacao?: string[] | null
          restricoes_uso?: string | null
          rotulagem_complementar?: string[] | null
          search_vector?: unknown
          sinonimos?: string[] | null
          subcategoria?: string | null
          sync_id?: string | null
          updated_at?: string | null
          verificado_em?: string | null
        }
        Update: {
          advertencias?: string[] | null
          alegacoes?: string[] | null
          anexo_origem?: string
          ativo?: boolean | null
          cas_number?: string | null
          categoria?: string
          created_at?: string | null
          data_inclusao?: string | null
          fonte_de?: string | null
          fonte_url?: string | null
          grupos_nao_autorizados?: string[] | null
          grupos_permitidos?: string[] | null
          id?: string
          is_proibido?: boolean | null
          limites_0_6_meses?: Json | null
          limites_1_3_anos?: Json | null
          limites_19_mais?: Json | null
          limites_4_8_anos?: Json | null
          limites_7_11_meses?: Json | null
          limites_9_18_anos?: Json | null
          limites_gestantes?: Json | null
          limites_lactantes?: Json | null
          motivo_proibicao?: string | null
          nome_generico?: string | null
          nome_popular?: string[] | null
          nome_rotulo?: string | null
          nome_tecnico?: string
          norma_inclusao?: string
          norma_ultima_alteracao?: string | null
          referencias_especificacao?: string[] | null
          restricoes_uso?: string | null
          rotulagem_complementar?: string[] | null
          search_vector?: unknown
          sinonimos?: string[] | null
          subcategoria?: string | null
          sync_id?: string | null
          updated_at?: string | null
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anvisa_constituintes_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "anvisa_sync_history"
            referencedColumns: ["id"]
          },
        ]
      }
      anvisa_consultas_log: {
        Row: {
          constituinte_encontrado_id: string | null
          created_at: string | null
          id: string
          resultado_encontrado: boolean | null
          termo_buscado: string
          user_id: string | null
        }
        Insert: {
          constituinte_encontrado_id?: string | null
          created_at?: string | null
          id?: string
          resultado_encontrado?: boolean | null
          termo_buscado: string
          user_id?: string | null
        }
        Update: {
          constituinte_encontrado_id?: string | null
          created_at?: string | null
          id?: string
          resultado_encontrado?: boolean | null
          termo_buscado?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "anvisa_consultas_log_constituinte_encontrado_id_fkey"
            columns: ["constituinte_encontrado_id"]
            isOneToOne: false
            referencedRelation: "anvisa_constituintes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anvisa_consultas_log_constituinte_encontrado_id_fkey"
            columns: ["constituinte_encontrado_id"]
            isOneToOne: false
            referencedRelation: "vw_anvisa_constituintes_completo"
            referencedColumns: ["id"]
          },
        ]
      }
      anvisa_sync_history: {
        Row: {
          detalhes: Json | null
          erro_mensagem: string | null
          finalizado_em: string | null
          fonte_url: string | null
          hash_conteudo: string | null
          id: string
          iniciado_em: string
          iniciado_por: string | null
          registros_atualizados: number | null
          registros_novos: number | null
          registros_removidos: number | null
          status: string
          tipo: string
          versao_legislacao: string | null
        }
        Insert: {
          detalhes?: Json | null
          erro_mensagem?: string | null
          finalizado_em?: string | null
          fonte_url?: string | null
          hash_conteudo?: string | null
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          registros_atualizados?: number | null
          registros_novos?: number | null
          registros_removidos?: number | null
          status?: string
          tipo?: string
          versao_legislacao?: string | null
        }
        Update: {
          detalhes?: Json | null
          erro_mensagem?: string | null
          finalizado_em?: string | null
          fonte_url?: string | null
          hash_conteudo?: string | null
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          registros_atualizados?: number | null
          registros_novos?: number | null
          registros_removidos?: number | null
          status?: string
          tipo?: string
          versao_legislacao?: string | null
        }
        Relationships: []
      }
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
      audit_trail_imutavel: {
        Row: {
          created_at: string
          dados_anteriores: Json | null
          dados_evento: Json
          dados_novos: Json | null
          descricao: string
          entidade_codigo: string | null
          entidade_id: string
          entidade_tipo: string
          hash_anterior: string | null
          hash_atual: string
          id: string
          ip_address: string | null
          sequencia: number
          tipo_evento: Database["public"]["Enums"]["tipo_evento_auditoria"]
          user_agent: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_evento?: Json
          dados_novos?: Json | null
          descricao: string
          entidade_codigo?: string | null
          entidade_id: string
          entidade_tipo: string
          hash_anterior?: string | null
          hash_atual: string
          id?: string
          ip_address?: string | null
          sequencia: number
          tipo_evento: Database["public"]["Enums"]["tipo_evento_auditoria"]
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          created_at?: string
          dados_anteriores?: Json | null
          dados_evento?: Json
          dados_novos?: Json | null
          descricao?: string
          entidade_codigo?: string | null
          entidade_id?: string
          entidade_tipo?: string
          hash_anterior?: string | null
          hash_atual?: string
          id?: string
          ip_address?: string | null
          sequencia?: number
          tipo_evento?: Database["public"]["Enums"]["tipo_evento_auditoria"]
          user_agent?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      avaliacoes_fornecedor: {
        Row: {
          avaliado_por: string | null
          created_at: string | null
          fornecedor_id: string
          id: string
          lote_id: string | null
          nota_entrada_id: string | null
          observacoes: string | null
          score: number
          tipo_avaliacao: string
        }
        Insert: {
          avaliado_por?: string | null
          created_at?: string | null
          fornecedor_id: string
          id?: string
          lote_id?: string | null
          nota_entrada_id?: string | null
          observacoes?: string | null
          score: number
          tipo_avaliacao: string
        }
        Update: {
          avaliado_por?: string | null
          created_at?: string | null
          fornecedor_id?: string
          id?: string
          lote_id?: string | null
          nota_entrada_id?: string | null
          observacoes?: string | null
          score?: number
          tipo_avaliacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_fornecedor_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      catalogo_precos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          item_id: string
          margem_contribuicao: number | null
          preco_minimo: number | null
          preco_venda: number
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          item_id: string
          margem_contribuicao?: number | null
          preco_minimo?: number | null
          preco_venda: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          item_id?: string
          margem_contribuicao?: number | null
          preco_minimo?: number | null
          preco_venda?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalogo_precos_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel: string | null
          content: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          channel?: string | null
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          channel?: string | null
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      config_capacidade_producao: {
        Row: {
          encapsuladora_caps_min: number
          fator_eficiencia: number
          id: string
          misturador_capacidade_kg: number
          operadores_disponiveis: number
          tecnicos_disponiveis: number
          tempo_diluicao_geometrica_min: number
          tempo_limpeza_min: number
          tempo_mistura_base_min: number
          tempo_pesagem_item_critico_min: number
          tempo_pesagem_item_padrao_min: number
          tempo_qc_min: number
          tempo_setup_encapsulamento_min: number
          tempo_setup_pesagem_min: number
          updated_at: string
        }
        Insert: {
          encapsuladora_caps_min?: number
          fator_eficiencia?: number
          id?: string
          misturador_capacidade_kg?: number
          operadores_disponiveis?: number
          tecnicos_disponiveis?: number
          tempo_diluicao_geometrica_min?: number
          tempo_limpeza_min?: number
          tempo_mistura_base_min?: number
          tempo_pesagem_item_critico_min?: number
          tempo_pesagem_item_padrao_min?: number
          tempo_qc_min?: number
          tempo_setup_encapsulamento_min?: number
          tempo_setup_pesagem_min?: number
          updated_at?: string
        }
        Update: {
          encapsuladora_caps_min?: number
          fator_eficiencia?: number
          id?: string
          misturador_capacidade_kg?: number
          operadores_disponiveis?: number
          tecnicos_disponiveis?: number
          tempo_diluicao_geometrica_min?: number
          tempo_limpeza_min?: number
          tempo_mistura_base_min?: number
          tempo_pesagem_item_critico_min?: number
          tempo_pesagem_item_padrao_min?: number
          tempo_qc_min?: number
          tempo_setup_encapsulamento_min?: number
          tempo_setup_pesagem_min?: number
          updated_at?: string
        }
        Relationships: []
      }
      config_custos_producao: {
        Row: {
          custo_capsula_vazia: number
          custo_frasco_padrao: number
          custo_hora_operador: number
          custo_hora_tecnico: number
          custo_lacre_padrao: number
          custo_overhead_hora: number
          custo_rotulo_padrao: number
          id: string
          percentual_overhead: number
          percentual_perda_padrao: number
          updated_at: string
        }
        Insert: {
          custo_capsula_vazia?: number
          custo_frasco_padrao?: number
          custo_hora_operador?: number
          custo_hora_tecnico?: number
          custo_lacre_padrao?: number
          custo_overhead_hora?: number
          custo_rotulo_padrao?: number
          id?: string
          percentual_overhead?: number
          percentual_perda_padrao?: number
          updated_at?: string
        }
        Update: {
          custo_capsula_vazia?: number
          custo_frasco_padrao?: number
          custo_hora_operador?: number
          custo_hora_tecnico?: number
          custo_lacre_padrao?: number
          custo_overhead_hora?: number
          custo_rotulo_padrao?: number
          id?: string
          percentual_overhead?: number
          percentual_perda_padrao?: number
          updated_at?: string
        }
        Relationships: []
      }
      contas_receber: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data_emissao: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          numero_documento: string | null
          observacoes: string | null
          pedido_venda_id: string | null
          status: string | null
          updated_at: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          numero_documento?: string | null
          observacoes?: string | null
          pedido_venda_id?: string | null
          status?: string | null
          updated_at?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data_emissao?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          numero_documento?: string | null
          observacoes?: string | null
          pedido_venda_id?: string | null
          status?: string | null
          updated_at?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_receber_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos_templates: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          logo_url: string | null
          nome: string
          texto_template: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome: string
          texto_template: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          logo_url?: string | null
          nome?: string
          texto_template?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversoes_unidades: {
        Row: {
          ativo: boolean | null
          classificacao_risco: string | null
          conversao_ui_mcg: number | null
          created_at: string | null
          fator_ui_para_mg: number
          fonte_tecnica: string | null
          id: string
          potencia_faixa_max: number | null
          potencia_faixa_min: number | null
          substancia: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          classificacao_risco?: string | null
          conversao_ui_mcg?: number | null
          created_at?: string | null
          fator_ui_para_mg: number
          fonte_tecnica?: string | null
          id?: string
          potencia_faixa_max?: number | null
          potencia_faixa_min?: number | null
          substancia: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          classificacao_risco?: string | null
          conversao_ui_mcg?: number | null
          created_at?: string | null
          fator_ui_para_mg?: number
          fonte_tecnica?: string | null
          id?: string
          potencia_faixa_max?: number | null
          potencia_faixa_min?: number | null
          substancia?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      custos_op: {
        Row: {
          created_at: string
          custo_embalagem: number
          custo_excipientes: number
          custo_mao_obra: number
          custo_materia_prima_real: number
          custo_overhead: number
          custo_perdas: number
          custo_total_real: number
          custo_unitario_real: number
          fechado_em: string | null
          fechado_por: string | null
          id: string
          impostos_cofins_rateado: number
          impostos_icms_rateado: number
          impostos_ipi_rateado: number
          impostos_pis_rateado: number
          impostos_total_rateado: number
          op_codigo: string
          op_id: string
          quantidade_perdas: number
          quantidade_produzida: number
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_embalagem?: number
          custo_excipientes?: number
          custo_mao_obra?: number
          custo_materia_prima_real?: number
          custo_overhead?: number
          custo_perdas?: number
          custo_total_real?: number
          custo_unitario_real?: number
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          impostos_cofins_rateado?: number
          impostos_icms_rateado?: number
          impostos_ipi_rateado?: number
          impostos_pis_rateado?: number
          impostos_total_rateado?: number
          op_codigo: string
          op_id: string
          quantidade_perdas?: number
          quantidade_produzida?: number
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_embalagem?: number
          custo_excipientes?: number
          custo_mao_obra?: number
          custo_materia_prima_real?: number
          custo_overhead?: number
          custo_perdas?: number
          custo_total_real?: number
          custo_unitario_real?: number
          fechado_em?: string | null
          fechado_por?: string | null
          id?: string
          impostos_cofins_rateado?: number
          impostos_icms_rateado?: number
          impostos_ipi_rateado?: number
          impostos_pis_rateado?: number
          impostos_total_rateado?: number
          op_codigo?: string
          op_id?: string
          quantidade_perdas?: number
          quantidade_produzida?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      custos_op_lotes: {
        Row: {
          cofins_valor: number | null
          created_at: string
          custo_op_id: string
          custo_total_lote: number
          custo_unitario_lote: number
          icms_valor: number | null
          id: string
          insumo_nome: string
          ipi_valor: number | null
          lote_id: string
          numero_lote: string
          pis_valor: number | null
          quantidade_consumida_g: number
        }
        Insert: {
          cofins_valor?: number | null
          created_at?: string
          custo_op_id: string
          custo_total_lote: number
          custo_unitario_lote: number
          icms_valor?: number | null
          id?: string
          insumo_nome: string
          ipi_valor?: number | null
          lote_id: string
          numero_lote: string
          pis_valor?: number | null
          quantidade_consumida_g: number
        }
        Update: {
          cofins_valor?: number | null
          created_at?: string
          custo_op_id?: string
          custo_total_lote?: number
          custo_unitario_lote?: number
          icms_valor?: number | null
          id?: string
          insumo_nome?: string
          ipi_valor?: number | null
          lote_id?: string
          numero_lote?: string
          pis_valor?: number | null
          quantidade_consumida_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "custos_op_lotes_custo_op_id_fkey"
            columns: ["custo_op_id"]
            isOneToOne: false
            referencedRelation: "custos_op"
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
      estoque_movimentacoes: {
        Row: {
          created_at: string | null
          custo_unitario: number | null
          documento_ref: string | null
          documento_ref_id: string | null
          id: string
          item_id: string
          lote_id: string | null
          motivo: string
          observacoes: string | null
          origem: string | null
          quantidade: number
          tipo: string
          unidade: string
          usuario_id: string | null
        }
        Insert: {
          created_at?: string | null
          custo_unitario?: number | null
          documento_ref?: string | null
          documento_ref_id?: string | null
          id?: string
          item_id: string
          lote_id?: string | null
          motivo: string
          observacoes?: string | null
          origem?: string | null
          quantidade: number
          tipo?: string
          unidade?: string
          usuario_id?: string | null
        }
        Update: {
          created_at?: string | null
          custo_unitario?: number | null
          documento_ref?: string | null
          documento_ref_id?: string | null
          id?: string
          item_id?: string
          lote_id?: string | null
          motivo?: string
          observacoes?: string | null
          origem?: string | null
          quantidade?: number
          tipo?: string
          unidade?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_itens: {
        Row: {
          alerta_exibido: boolean | null
          ativo_critico: boolean | null
          classificacao_risco: string | null
          created_at: string | null
          exige_premix: boolean | null
          formula_id: string
          id: string
          metodo_distribuicao: string | null
          nome_insumo: string
          ordem_mistura: number | null
          percentual_na_capsula: number | null
          produto_materia_prima_id: string | null
          quantidade_convertida_mg: number
          quantidade_informada: number
          unidade_informada: Database["public"]["Enums"]["unidade_informada_formula"]
        }
        Insert: {
          alerta_exibido?: boolean | null
          ativo_critico?: boolean | null
          classificacao_risco?: string | null
          created_at?: string | null
          exige_premix?: boolean | null
          formula_id: string
          id?: string
          metodo_distribuicao?: string | null
          nome_insumo: string
          ordem_mistura?: number | null
          percentual_na_capsula?: number | null
          produto_materia_prima_id?: string | null
          quantidade_convertida_mg: number
          quantidade_informada: number
          unidade_informada?: Database["public"]["Enums"]["unidade_informada_formula"]
        }
        Update: {
          alerta_exibido?: boolean | null
          ativo_critico?: boolean | null
          classificacao_risco?: string | null
          created_at?: string | null
          exige_premix?: boolean | null
          formula_id?: string
          id?: string
          metodo_distribuicao?: string | null
          nome_insumo?: string
          ordem_mistura?: number | null
          percentual_na_capsula?: number | null
          produto_materia_prima_id?: string | null
          quantidade_convertida_mg?: number
          quantidade_informada?: number
          unidade_informada?: Database["public"]["Enums"]["unidade_informada_formula"]
        }
        Relationships: [
          {
            foreignKeyName: "formula_itens_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "formula_itens_produto_materia_prima_id_fkey"
            columns: ["produto_materia_prima_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      formula_versoes: {
        Row: {
          alterado_em: string | null
          alterado_por: string | null
          formula_id: string
          id: string
          motivo_alteracao: string | null
          snapshot_json: Json
          versao: number
        }
        Insert: {
          alterado_em?: string | null
          alterado_por?: string | null
          formula_id: string
          id?: string
          motivo_alteracao?: string | null
          snapshot_json: Json
          versao: number
        }
        Update: {
          alterado_em?: string | null
          alterado_por?: string | null
          formula_id?: string
          id?: string
          motivo_alteracao?: string | null
          snapshot_json?: Json
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "formula_versoes_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      formulas: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          codigo_formula: string
          criado_em: string | null
          criado_por: string | null
          densidade_media: number | null
          doses_por_frasco: number | null
          doses_por_pote: number | null
          excipiente_padrao:
            | Database["public"]["Enums"]["tipo_excipiente_formula"]
            | null
          gotas_por_dose: number | null
          gotas_por_ml: number | null
          id: string
          nome_formula: string
          observacoes_tecnicas: string | null
          peso_capsula_alvo_mg: number | null
          peso_capsula_nominal_mg: number | null
          peso_por_dose_g: number | null
          peso_total_pote_g: number | null
          produto_acabado_id: string | null
          status:
            | Database["public"]["Enums"]["status_formula_industrial"]
            | null
          tipo_apresentacao: Database["public"]["Enums"]["tipo_apresentacao_formula"]
          tipo_capsula: string | null
          updated_at: string | null
          versao: number | null
          volume_frasco_ml: number | null
          volume_por_dose_ml: number | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_formula: string
          criado_em?: string | null
          criado_por?: string | null
          densidade_media?: number | null
          doses_por_frasco?: number | null
          doses_por_pote?: number | null
          excipiente_padrao?:
            | Database["public"]["Enums"]["tipo_excipiente_formula"]
            | null
          gotas_por_dose?: number | null
          gotas_por_ml?: number | null
          id?: string
          nome_formula: string
          observacoes_tecnicas?: string | null
          peso_capsula_alvo_mg?: number | null
          peso_capsula_nominal_mg?: number | null
          peso_por_dose_g?: number | null
          peso_total_pote_g?: number | null
          produto_acabado_id?: string | null
          status?:
            | Database["public"]["Enums"]["status_formula_industrial"]
            | null
          tipo_apresentacao?: Database["public"]["Enums"]["tipo_apresentacao_formula"]
          tipo_capsula?: string | null
          updated_at?: string | null
          versao?: number | null
          volume_frasco_ml?: number | null
          volume_por_dose_ml?: number | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          codigo_formula?: string
          criado_em?: string | null
          criado_por?: string | null
          densidade_media?: number | null
          doses_por_frasco?: number | null
          doses_por_pote?: number | null
          excipiente_padrao?:
            | Database["public"]["Enums"]["tipo_excipiente_formula"]
            | null
          gotas_por_dose?: number | null
          gotas_por_ml?: number | null
          id?: string
          nome_formula?: string
          observacoes_tecnicas?: string | null
          peso_capsula_alvo_mg?: number | null
          peso_capsula_nominal_mg?: number | null
          peso_por_dose_g?: number | null
          peso_total_pote_g?: number | null
          produto_acabado_id?: string | null
          status?:
            | Database["public"]["Enums"]["status_formula_industrial"]
            | null
          tipo_apresentacao?: Database["public"]["Enums"]["tipo_apresentacao_formula"]
          tipo_capsula?: string | null
          updated_at?: string | null
          versao?: number | null
          volume_frasco_ml?: number | null
          volume_por_dose_ml?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "formulas_produto_acabado_id_fkey"
            columns: ["produto_acabado_id"]
            isOneToOne: false
            referencedRelation: "itens"
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
          bloquear_entrada_mg_manual: boolean | null
          categoria_operacional: string | null
          classificacao_risco: string | null
          controla_lote: boolean
          controla_validade: boolean
          controle_especial: boolean | null
          conversao_ui_mcg: number | null
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
          metodo_distribuicao: string | null
          ncm: string | null
          potencia_compra: number | null
          potencia_rotulo: number | null
          sku_interno: string | null
          texto_alerta_padrao: string | null
          tipo_item: string
          unidade_declaracao: string | null
          unidade_interna: string
          unidade_pesagem: string | null
          updated_at: string
        }
        Insert: {
          armazenamento?: string | null
          ativo?: boolean
          bloquear_entrada_mg_manual?: boolean | null
          categoria_operacional?: string | null
          classificacao_risco?: string | null
          controla_lote?: boolean
          controla_validade?: boolean
          controle_especial?: boolean | null
          conversao_ui_mcg?: number | null
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
          metodo_distribuicao?: string | null
          ncm?: string | null
          potencia_compra?: number | null
          potencia_rotulo?: number | null
          sku_interno?: string | null
          texto_alerta_padrao?: string | null
          tipo_item?: string
          unidade_declaracao?: string | null
          unidade_interna?: string
          unidade_pesagem?: string | null
          updated_at?: string
        }
        Update: {
          armazenamento?: string | null
          ativo?: boolean
          bloquear_entrada_mg_manual?: boolean | null
          categoria_operacional?: string | null
          classificacao_risco?: string | null
          controla_lote?: boolean
          controla_validade?: boolean
          controle_especial?: boolean | null
          conversao_ui_mcg?: number | null
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
          metodo_distribuicao?: string | null
          ncm?: string | null
          potencia_compra?: number | null
          potencia_rotulo?: number | null
          sku_interno?: string | null
          texto_alerta_padrao?: string | null
          tipo_item?: string
          unidade_declaracao?: string | null
          unidade_interna?: string
          unidade_pesagem?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      kpis_executivos: {
        Row: {
          alertas_regulatorios: number | null
          anomalias_criticas: number | null
          created_at: string | null
          custo_medio_unitario: number | null
          custo_total_producao: number | null
          dados_detalhados: Json | null
          data_referencia: string
          fornecedores_risco: number | null
          id: string
          margem_media_percent: number | null
          nao_conformidades: number | null
          ops_bloqueadas: number | null
          ops_finalizadas: number | null
          rendimento_medio_percent: number | null
          taxa_aprovacao_qc: number | null
          total_anomalias: number | null
          validacoes_bloqueio: number | null
        }
        Insert: {
          alertas_regulatorios?: number | null
          anomalias_criticas?: number | null
          created_at?: string | null
          custo_medio_unitario?: number | null
          custo_total_producao?: number | null
          dados_detalhados?: Json | null
          data_referencia: string
          fornecedores_risco?: number | null
          id?: string
          margem_media_percent?: number | null
          nao_conformidades?: number | null
          ops_bloqueadas?: number | null
          ops_finalizadas?: number | null
          rendimento_medio_percent?: number | null
          taxa_aprovacao_qc?: number | null
          total_anomalias?: number | null
          validacoes_bloqueio?: number | null
        }
        Update: {
          alertas_regulatorios?: number | null
          anomalias_criticas?: number | null
          created_at?: string | null
          custo_medio_unitario?: number | null
          custo_total_producao?: number | null
          dados_detalhados?: Json | null
          data_referencia?: string
          fornecedores_risco?: number | null
          id?: string
          margem_media_percent?: number | null
          nao_conformidades?: number | null
          ops_bloqueadas?: number | null
          ops_finalizadas?: number | null
          rendimento_medio_percent?: number | null
          taxa_aprovacao_qc?: number | null
          total_anomalias?: number | null
          validacoes_bloqueio?: number | null
        }
        Relationships: []
      }
      log_validacoes_anvisa: {
        Row: {
          acao_sistema: string | null
          created_at: string
          dados_validacao: Json | null
          descricao: string
          entidade_codigo: string
          entidade_id: string
          fonte_legal: string | null
          id: string
          regra_aplicada: string
          resultado: string
          tipo_entidade: string
          usuario_responsavel: string | null
        }
        Insert: {
          acao_sistema?: string | null
          created_at?: string
          dados_validacao?: Json | null
          descricao: string
          entidade_codigo: string
          entidade_id: string
          fonte_legal?: string | null
          id?: string
          regra_aplicada: string
          resultado: string
          tipo_entidade: string
          usuario_responsavel?: string | null
        }
        Update: {
          acao_sistema?: string | null
          created_at?: string
          dados_validacao?: Json | null
          descricao?: string
          entidade_codigo?: string
          entidade_id?: string
          fonte_legal?: string | null
          id?: string
          regra_aplicada?: string
          resultado?: string
          tipo_entidade?: string
          usuario_responsavel?: string | null
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
      lote_materias_primas: {
        Row: {
          created_at: string
          fornecedor_id: string | null
          fornecedor_nome: string
          id: string
          insumo_id: string | null
          insumo_lote: string
          insumo_nome: string
          lote_produto_acabado_id: string
          quantidade_utilizada_g: number
        }
        Insert: {
          created_at?: string
          fornecedor_id?: string | null
          fornecedor_nome: string
          id?: string
          insumo_id?: string | null
          insumo_lote: string
          insumo_nome: string
          lote_produto_acabado_id: string
          quantidade_utilizada_g: number
        }
        Update: {
          created_at?: string
          fornecedor_id?: string | null
          fornecedor_nome?: string
          id?: string
          insumo_id?: string | null
          insumo_lote?: string
          insumo_nome?: string
          lote_produto_acabado_id?: string
          quantidade_utilizada_g?: number
        }
        Relationships: [
          {
            foreignKeyName: "lote_materias_primas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_materias_primas_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lote_materias_primas_lote_produto_acabado_id_fkey"
            columns: ["lote_produto_acabado_id"]
            isOneToOne: false
            referencedRelation: "lotes_produto_acabado"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_produto_acabado: {
        Row: {
          assinatura_liberacao_id: string | null
          codigo_auditoria: string
          created_at: string
          data_fabricacao: string
          data_validade: string
          id: string
          liberado_em: string | null
          liberado_por: string | null
          motivo_bloqueio: string | null
          numero_lote: string
          op_id: string
          produto_codigo: string | null
          produto_id: string | null
          produto_nome: string
          qr_code_hash: string
          quantidade_aprovada: number | null
          quantidade_produzida: number
          quantidade_rejeitada: number | null
          responsavel_tecnico_id: string | null
          rt_nome: string
          rt_numero_registro: string
          rt_tipo_conselho: Database["public"]["Enums"]["tipo_conselho_profissional"]
          rt_uf_conselho: string
          status: string
          updated_at: string
        }
        Insert: {
          assinatura_liberacao_id?: string | null
          codigo_auditoria: string
          created_at?: string
          data_fabricacao: string
          data_validade: string
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          motivo_bloqueio?: string | null
          numero_lote: string
          op_id: string
          produto_codigo?: string | null
          produto_id?: string | null
          produto_nome: string
          qr_code_hash: string
          quantidade_aprovada?: number | null
          quantidade_produzida: number
          quantidade_rejeitada?: number | null
          responsavel_tecnico_id?: string | null
          rt_nome: string
          rt_numero_registro: string
          rt_tipo_conselho: Database["public"]["Enums"]["tipo_conselho_profissional"]
          rt_uf_conselho: string
          status?: string
          updated_at?: string
        }
        Update: {
          assinatura_liberacao_id?: string | null
          codigo_auditoria?: string
          created_at?: string
          data_fabricacao?: string
          data_validade?: string
          id?: string
          liberado_em?: string | null
          liberado_por?: string | null
          motivo_bloqueio?: string | null
          numero_lote?: string
          op_id?: string
          produto_codigo?: string | null
          produto_id?: string | null
          produto_nome?: string
          qr_code_hash?: string
          quantidade_aprovada?: number | null
          quantidade_produzida?: number
          quantidade_rejeitada?: number | null
          responsavel_tecnico_id?: string | null
          rt_nome?: string
          rt_numero_registro?: string
          rt_tipo_conselho?: Database["public"]["Enums"]["tipo_conselho_profissional"]
          rt_uf_conselho?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lotes_produto_acabado_assinatura_liberacao_id_fkey"
            columns: ["assinatura_liberacao_id"]
            isOneToOne: false
            referencedRelation: "op_assinaturas_rt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produto_acabado_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_produto_acabado_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
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
      notas_saida: {
        Row: {
          chave_acesso: string | null
          cliente_id: string
          created_at: string | null
          data_emissao: string | null
          id: string
          natureza_operacao: string | null
          numero: number | null
          pedido_venda_id: string | null
          protocolo_autorizacao: string | null
          serie: string | null
          status: string | null
          valor_cofins: number | null
          valor_icms: number | null
          valor_ipi: number | null
          valor_pis: number | null
          valor_total: number
          xml_autorizado: string | null
        }
        Insert: {
          chave_acesso?: string | null
          cliente_id: string
          created_at?: string | null
          data_emissao?: string | null
          id?: string
          natureza_operacao?: string | null
          numero?: number | null
          pedido_venda_id?: string | null
          protocolo_autorizacao?: string | null
          serie?: string | null
          status?: string | null
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          valor_total?: number
          xml_autorizado?: string | null
        }
        Update: {
          chave_acesso?: string | null
          cliente_id?: string
          created_at?: string | null
          data_emissao?: string | null
          id?: string
          natureza_operacao?: string | null
          numero?: number | null
          pedido_venda_id?: string | null
          protocolo_autorizacao?: string | null
          serie?: string | null
          status?: string | null
          valor_cofins?: number | null
          valor_icms?: number | null
          valor_ipi?: number | null
          valor_pis?: number | null
          valor_total?: number
          xml_autorizado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_saida_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_saida_itens: {
        Row: {
          cfop: string | null
          cofins_aliquota: number | null
          cofins_valor: number | null
          descricao: string
          icms_aliquota: number | null
          icms_valor: number | null
          id: string
          item_id: string
          lote_id: string | null
          ncm: string | null
          nota_saida_id: string | null
          pis_aliquota: number | null
          pis_valor: number | null
          quantidade: number
          unidade: string | null
          valor_total: number
          valor_unitario: number
        }
        Insert: {
          cfop?: string | null
          cofins_aliquota?: number | null
          cofins_valor?: number | null
          descricao: string
          icms_aliquota?: number | null
          icms_valor?: number | null
          id?: string
          item_id: string
          lote_id?: string | null
          ncm?: string | null
          nota_saida_id?: string | null
          pis_aliquota?: number | null
          pis_valor?: number | null
          quantidade: number
          unidade?: string | null
          valor_total: number
          valor_unitario: number
        }
        Update: {
          cfop?: string | null
          cofins_aliquota?: number | null
          cofins_valor?: number | null
          descricao?: string
          icms_aliquota?: number | null
          icms_valor?: number | null
          id?: string
          item_id?: string
          lote_id?: string | null
          ncm?: string | null
          nota_saida_id?: string | null
          pis_aliquota?: number | null
          pis_valor?: number | null
          quantidade?: number
          unidade?: string | null
          valor_total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_saida_itens_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_saida_itens_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_saida_itens_nota_saida_id_fkey"
            columns: ["nota_saida_id"]
            isOneToOne: false
            referencedRelation: "notas_saida"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          module: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          module?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          module?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      op_anexos: {
        Row: {
          congelado_em: string | null
          congelado_por: string | null
          created_at: string | null
          hash_sha256: string
          id: string
          mime_type: string | null
          nome_arquivo: string
          observacoes: string | null
          op_id: string
          storage_key: string
          tamanho_bytes: number | null
          tipo_anexo: string
          versao: number
        }
        Insert: {
          congelado_em?: string | null
          congelado_por?: string | null
          created_at?: string | null
          hash_sha256: string
          id?: string
          mime_type?: string | null
          nome_arquivo: string
          observacoes?: string | null
          op_id: string
          storage_key: string
          tamanho_bytes?: number | null
          tipo_anexo: string
          versao?: number
        }
        Update: {
          congelado_em?: string | null
          congelado_por?: string | null
          created_at?: string | null
          hash_sha256?: string
          id?: string
          mime_type?: string | null
          nome_arquivo?: string
          observacoes?: string | null
          op_id?: string
          storage_key?: string
          tamanho_bytes?: number | null
          tipo_anexo?: string
          versao?: number
        }
        Relationships: []
      }
      op_assinaturas_rt: {
        Row: {
          assinatura_timestamp: string
          created_at: string
          declaracao_aceita: boolean
          hash_op: string
          id: string
          ip_address: string | null
          op_id: string
          responsavel_tecnico_id: string
          rt_cpf: string
          rt_nome: string
          rt_numero_registro: string
          rt_tipo_conselho: Database["public"]["Enums"]["tipo_conselho_profissional"]
          rt_uf_conselho: string
          user_agent: string | null
        }
        Insert: {
          assinatura_timestamp?: string
          created_at?: string
          declaracao_aceita?: boolean
          hash_op: string
          id?: string
          ip_address?: string | null
          op_id: string
          responsavel_tecnico_id: string
          rt_cpf: string
          rt_nome: string
          rt_numero_registro: string
          rt_tipo_conselho: Database["public"]["Enums"]["tipo_conselho_profissional"]
          rt_uf_conselho: string
          user_agent?: string | null
        }
        Update: {
          assinatura_timestamp?: string
          created_at?: string
          declaracao_aceita?: boolean
          hash_op?: string
          id?: string
          ip_address?: string | null
          op_id?: string
          responsavel_tecnico_id?: string
          rt_cpf?: string
          rt_nome?: string
          rt_numero_registro?: string
          rt_tipo_conselho?: Database["public"]["Enums"]["tipo_conselho_profissional"]
          rt_uf_conselho?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_assinaturas_rt_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
        ]
      }
      op_checklist: {
        Row: {
          categoria: string
          created_at: string | null
          id: string
          item: string
          obrigatorio: boolean | null
          observacoes: string | null
          op_id: string
          ordem: number
          verificado: boolean | null
          verificado_em: string | null
          verificado_por: string | null
        }
        Insert: {
          categoria: string
          created_at?: string | null
          id?: string
          item: string
          obrigatorio?: boolean | null
          observacoes?: string | null
          op_id: string
          ordem: number
          verificado?: boolean | null
          verificado_em?: string | null
          verificado_por?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          id?: string
          item?: string
          obrigatorio?: boolean | null
          observacoes?: string | null
          op_id?: string
          ordem?: number
          verificado?: boolean | null
          verificado_em?: string | null
          verificado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_checklist_op_id_fkey"
            columns: ["op_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao_industrial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_checklist_verificado_por_fkey"
            columns: ["verificado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      op_controle_perdas: {
        Row: {
          acrescimo_percentual: number
          created_at: string | null
          id: string
          justificativa_perdas: string | null
          op_id: string
          perda_percentual: number | null
          perda_total: number | null
          quantidade_aprovada: number | null
          quantidade_com_acrescimo: number
          quantidade_planejada: number
          quantidade_produzida: number | null
          quantidade_rejeitada: number | null
          rendimento_percentual: number | null
          updated_at: string | null
        }
        Insert: {
          acrescimo_percentual: number
          created_at?: string | null
          id?: string
          justificativa_perdas?: string | null
          op_id: string
          perda_percentual?: number | null
          perda_total?: number | null
          quantidade_aprovada?: number | null
          quantidade_com_acrescimo: number
          quantidade_planejada: number
          quantidade_produzida?: number | null
          quantidade_rejeitada?: number | null
          rendimento_percentual?: number | null
          updated_at?: string | null
        }
        Update: {
          acrescimo_percentual?: number
          created_at?: string | null
          id?: string
          justificativa_perdas?: string | null
          op_id?: string
          perda_percentual?: number | null
          perda_total?: number | null
          quantidade_aprovada?: number | null
          quantidade_com_acrescimo?: number
          quantidade_planejada?: number
          quantidade_produzida?: number | null
          quantidade_rejeitada?: number | null
          rendimento_percentual?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_controle_perdas_op_id_fkey"
            columns: ["op_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao_industrial"
            referencedColumns: ["id"]
          },
        ]
      }
      op_controle_qualidade: {
        Row: {
          aparencia_conforme: boolean | null
          aparencia_po: string | null
          avaliado_em: string | null
          avaliado_por: string | null
          created_at: string | null
          desvio_padrao_peso: number | null
          fluidez: string | null
          fluidez_conforme: boolean | null
          homogeneidade: string | null
          homogeneidade_conforme: boolean | null
          id: string
          motivo_reprovacao: string | null
          observacoes: string | null
          op_id: string
          peso_conforme: boolean | null
          peso_maximo_capsulas_mg: number | null
          peso_medio_capsulas_mg: number | null
          peso_minimo_capsulas_mg: number | null
          status: string | null
        }
        Insert: {
          aparencia_conforme?: boolean | null
          aparencia_po?: string | null
          avaliado_em?: string | null
          avaliado_por?: string | null
          created_at?: string | null
          desvio_padrao_peso?: number | null
          fluidez?: string | null
          fluidez_conforme?: boolean | null
          homogeneidade?: string | null
          homogeneidade_conforme?: boolean | null
          id?: string
          motivo_reprovacao?: string | null
          observacoes?: string | null
          op_id: string
          peso_conforme?: boolean | null
          peso_maximo_capsulas_mg?: number | null
          peso_medio_capsulas_mg?: number | null
          peso_minimo_capsulas_mg?: number | null
          status?: string | null
        }
        Update: {
          aparencia_conforme?: boolean | null
          aparencia_po?: string | null
          avaliado_em?: string | null
          avaliado_por?: string | null
          created_at?: string | null
          desvio_padrao_peso?: number | null
          fluidez?: string | null
          fluidez_conforme?: boolean | null
          homogeneidade?: string | null
          homogeneidade_conforme?: boolean | null
          id?: string
          motivo_reprovacao?: string | null
          observacoes?: string | null
          op_id?: string
          peso_conforme?: boolean | null
          peso_maximo_capsulas_mg?: number | null
          peso_medio_capsulas_mg?: number | null
          peso_minimo_capsulas_mg?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_controle_qualidade_avaliado_por_fkey"
            columns: ["avaliado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_controle_qualidade_op_id_fkey"
            columns: ["op_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao_industrial"
            referencedColumns: ["id"]
          },
        ]
      }
      op_embalagens: {
        Row: {
          created_at: string | null
          custo_total: number | null
          custo_unitario: number | null
          id: string
          insumo_id: string | null
          insumo_nome: string
          lote_id: string | null
          numero_lote: string | null
          op_id: string
          quantidade_consumida: number | null
          quantidade_planejada: number
          status: string | null
          tipo_embalagem: string
        }
        Insert: {
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          id?: string
          insumo_id?: string | null
          insumo_nome: string
          lote_id?: string | null
          numero_lote?: string | null
          op_id: string
          quantidade_consumida?: number | null
          quantidade_planejada: number
          status?: string | null
          tipo_embalagem: string
        }
        Update: {
          created_at?: string | null
          custo_total?: number | null
          custo_unitario?: number | null
          id?: string
          insumo_id?: string | null
          insumo_nome?: string
          lote_id?: string | null
          numero_lote?: string | null
          op_id?: string
          quantidade_consumida?: number | null
          quantidade_planejada?: number
          status?: string | null
          tipo_embalagem?: string
        }
        Relationships: []
      }
      op_historico_etapas: {
        Row: {
          created_at: string | null
          etapa: string
          finalizada_em: string | null
          id: string
          iniciada_em: string
          observacoes: string | null
          op_id: string
          operador_id: string | null
          operador_nome: string | null
        }
        Insert: {
          created_at?: string | null
          etapa: string
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string
          observacoes?: string | null
          op_id: string
          operador_id?: string | null
          operador_nome?: string | null
        }
        Update: {
          created_at?: string | null
          etapa?: string
          finalizada_em?: string | null
          id?: string
          iniciada_em?: string
          observacoes?: string | null
          op_id?: string
          operador_id?: string | null
          operador_nome?: string | null
        }
        Relationships: []
      }
      op_materias_primas: {
        Row: {
          categoria: string
          coa_arquivo_id: string | null
          coa_hash: string | null
          conferido_em: string | null
          conferido_por: string | null
          created_at: string | null
          dentro_tolerancia: boolean | null
          fornecedor_id: string | null
          fornecedor_nome: string | null
          id: string
          insumo_id: string | null
          insumo_nome: string
          lote_id: string | null
          motivo_critico: string | null
          numero_lote: string | null
          observacoes: string | null
          op_id: string
          ordem_mistura: number
          pesado_em: string | null
          pesado_por: string | null
          pesagem_critica: boolean | null
          quantidade_maxima_g: number | null
          quantidade_minima_g: number | null
          quantidade_real_g: number | null
          quantidade_teorica_g: number
          quantidade_teorica_kg: number | null
          quantidade_teorica_mg: number
          tolerancia_percentual: number | null
          unidade: string | null
        }
        Insert: {
          categoria?: string
          coa_arquivo_id?: string | null
          coa_hash?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          created_at?: string | null
          dentro_tolerancia?: boolean | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          insumo_id?: string | null
          insumo_nome: string
          lote_id?: string | null
          motivo_critico?: string | null
          numero_lote?: string | null
          observacoes?: string | null
          op_id: string
          ordem_mistura: number
          pesado_em?: string | null
          pesado_por?: string | null
          pesagem_critica?: boolean | null
          quantidade_maxima_g?: number | null
          quantidade_minima_g?: number | null
          quantidade_real_g?: number | null
          quantidade_teorica_g: number
          quantidade_teorica_kg?: number | null
          quantidade_teorica_mg: number
          tolerancia_percentual?: number | null
          unidade?: string | null
        }
        Update: {
          categoria?: string
          coa_arquivo_id?: string | null
          coa_hash?: string | null
          conferido_em?: string | null
          conferido_por?: string | null
          created_at?: string | null
          dentro_tolerancia?: boolean | null
          fornecedor_id?: string | null
          fornecedor_nome?: string | null
          id?: string
          insumo_id?: string | null
          insumo_nome?: string
          lote_id?: string | null
          motivo_critico?: string | null
          numero_lote?: string | null
          observacoes?: string | null
          op_id?: string
          ordem_mistura?: number
          pesado_em?: string | null
          pesado_por?: string | null
          pesagem_critica?: boolean | null
          quantidade_maxima_g?: number | null
          quantidade_minima_g?: number | null
          quantidade_real_g?: number | null
          quantidade_teorica_g?: number
          quantidade_teorica_kg?: number | null
          quantidade_teorica_mg?: number
          tolerancia_percentual?: number | null
          unidade?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_materias_primas_conferido_por_fkey"
            columns: ["conferido_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_materias_primas_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_materias_primas_insumo_id_fkey"
            columns: ["insumo_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_materias_primas_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_materias_primas_op_id_fkey"
            columns: ["op_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao_industrial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_materias_primas_pesado_por_fkey"
            columns: ["pesado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      op_pesagens_criticas: {
        Row: {
          assinatura_conferente: string | null
          assinatura_operador: string | null
          conferente_id: string | null
          conferente_nome: string | null
          created_at: string | null
          data_conferencia: string | null
          data_pesagem: string | null
          id: string
          insumo_nome: string
          materia_prima_id: string
          observacoes: string | null
          op_id: string
          operador_pesagem_id: string | null
          operador_pesagem_nome: string | null
          quantidade_pesada_mg: number | null
          quantidade_teorica_mg: number
          status: string | null
        }
        Insert: {
          assinatura_conferente?: string | null
          assinatura_operador?: string | null
          conferente_id?: string | null
          conferente_nome?: string | null
          created_at?: string | null
          data_conferencia?: string | null
          data_pesagem?: string | null
          id?: string
          insumo_nome: string
          materia_prima_id: string
          observacoes?: string | null
          op_id: string
          operador_pesagem_id?: string | null
          operador_pesagem_nome?: string | null
          quantidade_pesada_mg?: number | null
          quantidade_teorica_mg: number
          status?: string | null
        }
        Update: {
          assinatura_conferente?: string | null
          assinatura_operador?: string | null
          conferente_id?: string | null
          conferente_nome?: string | null
          created_at?: string | null
          data_conferencia?: string | null
          data_pesagem?: string | null
          id?: string
          insumo_nome?: string
          materia_prima_id?: string
          observacoes?: string | null
          op_id?: string
          operador_pesagem_id?: string | null
          operador_pesagem_nome?: string | null
          quantidade_pesada_mg?: number | null
          quantidade_teorica_mg?: number
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "op_pesagens_criticas_conferente_id_fkey"
            columns: ["conferente_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_pesagens_criticas_materia_prima_id_fkey"
            columns: ["materia_prima_id"]
            isOneToOne: false
            referencedRelation: "op_materias_primas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_pesagens_criticas_op_id_fkey"
            columns: ["op_id"]
            isOneToOne: false
            referencedRelation: "ordens_producao_industrial"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "op_pesagens_criticas_operador_pesagem_id_fkey"
            columns: ["operador_pesagem_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          capsula_cor: string | null
          created_at: string
          desconto_percentual: number | null
          formula_id: string | null
          id: string
          incluir_silica: boolean
          orcamento_id: string
          ordem: number | null
          peso_unidade_mg: number | null
          pote_cor: string | null
          preco_final: number
          preco_unitario: number
          produto_codigo: string | null
          produto_descricao: string | null
          produto_id: string | null
          produto_nome: string
          quantidade: number
          rotulo: string | null
          tampa_cor: string | null
          unidade: string | null
          unidades_por_frasco: number | null
          valor_total: number
        }
        Insert: {
          capsula_cor?: string | null
          created_at?: string
          desconto_percentual?: number | null
          formula_id?: string | null
          id?: string
          incluir_silica?: boolean
          orcamento_id: string
          ordem?: number | null
          peso_unidade_mg?: number | null
          pote_cor?: string | null
          preco_final?: number
          preco_unitario?: number
          produto_codigo?: string | null
          produto_descricao?: string | null
          produto_id?: string | null
          produto_nome: string
          quantidade?: number
          rotulo?: string | null
          tampa_cor?: string | null
          unidade?: string | null
          unidades_por_frasco?: number | null
          valor_total?: number
        }
        Update: {
          capsula_cor?: string | null
          created_at?: string
          desconto_percentual?: number | null
          formula_id?: string | null
          id?: string
          incluir_silica?: boolean
          orcamento_id?: string
          ordem?: number | null
          peso_unidade_mg?: number | null
          pote_cor?: string | null
          preco_final?: number
          preco_unitario?: number
          produto_codigo?: string | null
          produto_descricao?: string | null
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          rotulo?: string | null
          tampa_cor?: string | null
          unidade?: string | null
          unidades_por_frasco?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          cliente_documento: string | null
          cliente_email: string | null
          cliente_endereco: string | null
          cliente_id: string | null
          cliente_nome: string
          cliente_telefone: string | null
          cliente_whatsapp: string | null
          codigo: string
          comprovante_pagamento_em: string | null
          comprovante_pagamento_obs: string | null
          condicao_pagamento: string | null
          contrato_assinado_em: string | null
          contrato_conferido_em: string | null
          contrato_conferido_por: string | null
          contrato_enviado_em: string | null
          contrato_enviado_por: string | null
          contrato_enviado_via: string | null
          contrato_status: string | null
          created_at: string
          created_by: string | null
          data_orcamento: string
          data_validade: string | null
          desconto_percentual: number | null
          desconto_valor: number | null
          forma_pagamento: string | null
          gerencia_aprovado_em: string | null
          gerencia_aprovado_por: string | null
          gerencia_observacoes: string | null
          id: string
          observacoes: string | null
          prazo_entrega_dias: number | null
          status: string
          updated_at: string
          validade_dias: number | null
          valor_final: number
          valor_limite_aprovacao_simples: number | null
          valor_total: number
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          cliente_whatsapp?: string | null
          codigo: string
          comprovante_pagamento_em?: string | null
          comprovante_pagamento_obs?: string | null
          condicao_pagamento?: string | null
          contrato_assinado_em?: string | null
          contrato_conferido_em?: string | null
          contrato_conferido_por?: string | null
          contrato_enviado_em?: string | null
          contrato_enviado_por?: string | null
          contrato_enviado_via?: string | null
          contrato_status?: string | null
          created_at?: string
          created_by?: string | null
          data_orcamento?: string
          data_validade?: string | null
          desconto_percentual?: number | null
          desconto_valor?: number | null
          forma_pagamento?: string | null
          gerencia_aprovado_em?: string | null
          gerencia_aprovado_por?: string | null
          gerencia_observacoes?: string | null
          id?: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          status?: string
          updated_at?: string
          validade_dias?: number | null
          valor_final?: number
          valor_limite_aprovacao_simples?: number | null
          valor_total?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_endereco?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          cliente_whatsapp?: string | null
          codigo?: string
          comprovante_pagamento_em?: string | null
          comprovante_pagamento_obs?: string | null
          condicao_pagamento?: string | null
          contrato_assinado_em?: string | null
          contrato_conferido_em?: string | null
          contrato_conferido_por?: string | null
          contrato_enviado_em?: string | null
          contrato_enviado_por?: string | null
          contrato_enviado_via?: string | null
          contrato_status?: string | null
          created_at?: string
          created_by?: string | null
          data_orcamento?: string
          data_validade?: string | null
          desconto_percentual?: number | null
          desconto_valor?: number | null
          forma_pagamento?: string | null
          gerencia_aprovado_em?: string | null
          gerencia_aprovado_por?: string | null
          gerencia_observacoes?: string | null
          id?: string
          observacoes?: string | null
          prazo_entrega_dias?: number | null
          status?: string
          updated_at?: string
          validade_dias?: number | null
          valor_final?: number
          valor_limite_aprovacao_simples?: number | null
          valor_total?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_producao_geradas: {
        Row: {
          dados_op: Json
          data_geracao: string | null
          formula_id: string
          id: string
          op_codigo: string
          tipo_documento: string | null
        }
        Insert: {
          dados_op?: Json
          data_geracao?: string | null
          formula_id: string
          id?: string
          op_codigo: string
          tipo_documento?: string | null
        }
        Update: {
          dados_op?: Json
          data_geracao?: string | null
          formula_id?: string
          id?: string
          op_codigo?: string
          tipo_documento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_producao_geradas_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      ordens_producao_industrial: {
        Row: {
          acrescimo_percentual: number | null
          assinatura_rt_hash: string | null
          assinatura_rt_id: string | null
          capsula_item_id: string | null
          capsula_item_nome: string | null
          capsulas_por_frasco: number
          cliente_id: string | null
          cliente_nome: string | null
          codigo: string
          cor_capsula: string | null
          cor_tampa: string | null
          created_at: string | null
          created_by: string | null
          data_fabricacao: string
          data_fim_producao: string | null
          data_inicio_producao: string | null
          data_validade: string
          descricao_rotulo: string | null
          especificacoes_embalagem: Json | null
          etapa_atualizada_em: string | null
          etapa_producao_atual: string | null
          excipiente_base: string | null
          finalizado_por: string | null
          formula_codigo: string | null
          formula_id: string | null
          formula_versao: number | null
          id: string
          incluir_silica: boolean | null
          linha_producao: string | null
          lote_produto_acabado: string
          maquina: string | null
          motivo_bloqueio: string | null
          observacoes: string | null
          operadores: Json | null
          pedido_id: string | null
          pedido_numero: string | null
          peso_capsula_mg: number | null
          pote_item_id: string | null
          pote_item_nome: string | null
          produto_id: string | null
          produto_nome: string
          qr_code_hash: string | null
          qr_code_lote: string | null
          qr_code_token: string | null
          quantidade_frascos: number
          quantidade_silica_sache: string | null
          responsavel_producao_id: string | null
          responsavel_producao_nome: string | null
          responsavel_tecnico_id: string | null
          rt_assinatura_timestamp: string | null
          rt_nome: string | null
          rt_numero_registro: string | null
          rt_tipo_conselho:
            | Database["public"]["Enums"]["tipo_conselho_profissional"]
            | null
          rt_uf_conselho: string | null
          rt_vinculado_em: string | null
          silica_item_id: string | null
          silica_item_nome: string | null
          status: string
          tampa_item_id: string | null
          tampa_item_nome: string | null
          tipo_apresentacao: string
          tipo_capsula: string | null
          tipo_pote: string | null
          tipo_tampa: string | null
          total_capsulas: number
          total_capsulas_com_acrescimo: number
          turno: string | null
          updated_at: string | null
        }
        Insert: {
          acrescimo_percentual?: number | null
          assinatura_rt_hash?: string | null
          assinatura_rt_id?: string | null
          capsula_item_id?: string | null
          capsula_item_nome?: string | null
          capsulas_por_frasco: number
          cliente_id?: string | null
          cliente_nome?: string | null
          codigo: string
          cor_capsula?: string | null
          cor_tampa?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fabricacao: string
          data_fim_producao?: string | null
          data_inicio_producao?: string | null
          data_validade: string
          descricao_rotulo?: string | null
          especificacoes_embalagem?: Json | null
          etapa_atualizada_em?: string | null
          etapa_producao_atual?: string | null
          excipiente_base?: string | null
          finalizado_por?: string | null
          formula_codigo?: string | null
          formula_id?: string | null
          formula_versao?: number | null
          id?: string
          incluir_silica?: boolean | null
          linha_producao?: string | null
          lote_produto_acabado: string
          maquina?: string | null
          motivo_bloqueio?: string | null
          observacoes?: string | null
          operadores?: Json | null
          pedido_id?: string | null
          pedido_numero?: string | null
          peso_capsula_mg?: number | null
          pote_item_id?: string | null
          pote_item_nome?: string | null
          produto_id?: string | null
          produto_nome: string
          qr_code_hash?: string | null
          qr_code_lote?: string | null
          qr_code_token?: string | null
          quantidade_frascos: number
          quantidade_silica_sache?: string | null
          responsavel_producao_id?: string | null
          responsavel_producao_nome?: string | null
          responsavel_tecnico_id?: string | null
          rt_assinatura_timestamp?: string | null
          rt_nome?: string | null
          rt_numero_registro?: string | null
          rt_tipo_conselho?:
            | Database["public"]["Enums"]["tipo_conselho_profissional"]
            | null
          rt_uf_conselho?: string | null
          rt_vinculado_em?: string | null
          silica_item_id?: string | null
          silica_item_nome?: string | null
          status?: string
          tampa_item_id?: string | null
          tampa_item_nome?: string | null
          tipo_apresentacao?: string
          tipo_capsula?: string | null
          tipo_pote?: string | null
          tipo_tampa?: string | null
          total_capsulas: number
          total_capsulas_com_acrescimo: number
          turno?: string | null
          updated_at?: string | null
        }
        Update: {
          acrescimo_percentual?: number | null
          assinatura_rt_hash?: string | null
          assinatura_rt_id?: string | null
          capsula_item_id?: string | null
          capsula_item_nome?: string | null
          capsulas_por_frasco?: number
          cliente_id?: string | null
          cliente_nome?: string | null
          codigo?: string
          cor_capsula?: string | null
          cor_tampa?: string | null
          created_at?: string | null
          created_by?: string | null
          data_fabricacao?: string
          data_fim_producao?: string | null
          data_inicio_producao?: string | null
          data_validade?: string
          descricao_rotulo?: string | null
          especificacoes_embalagem?: Json | null
          etapa_atualizada_em?: string | null
          etapa_producao_atual?: string | null
          excipiente_base?: string | null
          finalizado_por?: string | null
          formula_codigo?: string | null
          formula_id?: string | null
          formula_versao?: number | null
          id?: string
          incluir_silica?: boolean | null
          linha_producao?: string | null
          lote_produto_acabado?: string
          maquina?: string | null
          motivo_bloqueio?: string | null
          observacoes?: string | null
          operadores?: Json | null
          pedido_id?: string | null
          pedido_numero?: string | null
          peso_capsula_mg?: number | null
          pote_item_id?: string | null
          pote_item_nome?: string | null
          produto_id?: string | null
          produto_nome?: string
          qr_code_hash?: string | null
          qr_code_lote?: string | null
          qr_code_token?: string | null
          quantidade_frascos?: number
          quantidade_silica_sache?: string | null
          responsavel_producao_id?: string | null
          responsavel_producao_nome?: string | null
          responsavel_tecnico_id?: string | null
          rt_assinatura_timestamp?: string | null
          rt_nome?: string | null
          rt_numero_registro?: string | null
          rt_tipo_conselho?:
            | Database["public"]["Enums"]["tipo_conselho_profissional"]
            | null
          rt_uf_conselho?: string | null
          rt_vinculado_em?: string | null
          silica_item_id?: string | null
          silica_item_nome?: string | null
          status?: string
          tampa_item_id?: string | null
          tampa_item_nome?: string | null
          tipo_apresentacao?: string
          tipo_capsula?: string | null
          tipo_pote?: string | null
          tipo_tampa?: string | null
          total_capsulas?: number
          total_capsulas_com_acrescimo?: number
          turno?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ordens_producao_industrial_assinatura_rt_id_fkey"
            columns: ["assinatura_rt_id"]
            isOneToOne: false
            referencedRelation: "op_assinaturas_rt"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_capsula_item_id_fkey"
            columns: ["capsula_item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_finalizado_por_fkey"
            columns: ["finalizado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_pote_item_id_fkey"
            columns: ["pote_item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_responsavel_producao_id_fkey"
            columns: ["responsavel_producao_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_responsavel_tecnico_id_fkey"
            columns: ["responsavel_tecnico_id"]
            isOneToOne: false
            referencedRelation: "responsaveis_tecnicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_silica_item_id_fkey"
            columns: ["silica_item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ordens_producao_industrial_tampa_item_id_fkey"
            columns: ["tampa_item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          capsula_cor: string | null
          created_at: string
          desconto_percentual: number | null
          formula_id: string | null
          id: string
          incluir_silica: boolean
          lote_produto_acabado_id: string | null
          orcamento_item_id: string | null
          ordem: number | null
          pedido_id: string
          peso_unidade_mg: number | null
          pote_cor: string | null
          preco_final: number
          preco_unitario: number
          produto_codigo: string | null
          produto_descricao: string | null
          produto_id: string | null
          produto_nome: string
          quantidade: number
          quantidade_entregue: number | null
          quantidade_faturada: number | null
          quantidade_produzida: number | null
          rotulo: string | null
          status: string | null
          tampa_cor: string | null
          unidade: string | null
          unidades_por_frasco: number | null
          valor_total: number
        }
        Insert: {
          capsula_cor?: string | null
          created_at?: string
          desconto_percentual?: number | null
          formula_id?: string | null
          id?: string
          incluir_silica?: boolean
          lote_produto_acabado_id?: string | null
          orcamento_item_id?: string | null
          ordem?: number | null
          pedido_id: string
          peso_unidade_mg?: number | null
          pote_cor?: string | null
          preco_final?: number
          preco_unitario?: number
          produto_codigo?: string | null
          produto_descricao?: string | null
          produto_id?: string | null
          produto_nome: string
          quantidade?: number
          quantidade_entregue?: number | null
          quantidade_faturada?: number | null
          quantidade_produzida?: number | null
          rotulo?: string | null
          status?: string | null
          tampa_cor?: string | null
          unidade?: string | null
          unidades_por_frasco?: number | null
          valor_total?: number
        }
        Update: {
          capsula_cor?: string | null
          created_at?: string
          desconto_percentual?: number | null
          formula_id?: string | null
          id?: string
          incluir_silica?: boolean
          lote_produto_acabado_id?: string | null
          orcamento_item_id?: string | null
          ordem?: number | null
          pedido_id?: string
          peso_unidade_mg?: number | null
          pote_cor?: string | null
          preco_final?: number
          preco_unitario?: number
          produto_codigo?: string | null
          produto_descricao?: string | null
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          quantidade_entregue?: number | null
          quantidade_faturada?: number | null
          quantidade_produzida?: number | null
          rotulo?: string | null
          status?: string | null
          tampa_cor?: string | null
          unidade?: string | null
          unidades_por_frasco?: number | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_lote_produto_acabado_id_fkey"
            columns: ["lote_produto_acabado_id"]
            isOneToOne: false
            referencedRelation: "lotes_produto_acabado"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_orcamento_item_id_fkey"
            columns: ["orcamento_item_id"]
            isOneToOne: false
            referencedRelation: "orcamento_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos_venda"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos_venda: {
        Row: {
          cliente_documento: string | null
          cliente_email: string | null
          cliente_id: string | null
          cliente_nome: string
          cliente_telefone: string | null
          codigo: string
          condicao_pagamento: string | null
          confirmado_em: string | null
          confirmado_por: string | null
          created_at: string
          created_by: string | null
          data_entrega_prevista: string | null
          data_entrega_realizada: string | null
          data_pedido: string
          desconto_percentual: number | null
          desconto_valor: number | null
          endereco_entrega_id: string | null
          endereco_entrega_texto: string | null
          enviado_em: string | null
          faturado_em: string | null
          forma_pagamento: string | null
          frete_tipo: string | null
          id: string
          observacoes: string | null
          observacoes_internas: string | null
          op_id: string | null
          orcamento_id: string | null
          status: string
          transportadora_id: string | null
          updated_at: string
          valor_frete: number | null
          valor_produtos: number
          valor_total: number
        }
        Insert: {
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          codigo: string
          condicao_pagamento?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_prevista?: string | null
          data_entrega_realizada?: string | null
          data_pedido?: string
          desconto_percentual?: number | null
          desconto_valor?: number | null
          endereco_entrega_id?: string | null
          endereco_entrega_texto?: string | null
          enviado_em?: string | null
          faturado_em?: string | null
          forma_pagamento?: string | null
          frete_tipo?: string | null
          id?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          op_id?: string | null
          orcamento_id?: string | null
          status?: string
          transportadora_id?: string | null
          updated_at?: string
          valor_frete?: number | null
          valor_produtos?: number
          valor_total?: number
        }
        Update: {
          cliente_documento?: string | null
          cliente_email?: string | null
          cliente_id?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          codigo?: string
          condicao_pagamento?: string | null
          confirmado_em?: string | null
          confirmado_por?: string | null
          created_at?: string
          created_by?: string | null
          data_entrega_prevista?: string | null
          data_entrega_realizada?: string | null
          data_pedido?: string
          desconto_percentual?: number | null
          desconto_valor?: number | null
          endereco_entrega_id?: string | null
          endereco_entrega_texto?: string | null
          enviado_em?: string | null
          faturado_em?: string | null
          forma_pagamento?: string | null
          frete_tipo?: string | null
          id?: string
          observacoes?: string | null
          observacoes_internas?: string | null
          op_id?: string | null
          orcamento_id?: string | null
          status?: string
          transportadora_id?: string | null
          updated_at?: string
          valor_frete?: number | null
          valor_produtos?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_venda_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venda_endereco_entrega_id_fkey"
            columns: ["endereco_entrega_id"]
            isOneToOne: false
            referencedRelation: "entidade_enderecos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venda_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_venda_transportadora_id_fkey"
            columns: ["transportadora_id"]
            isOneToOne: false
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      previsoes_producao: {
        Row: {
          alerta: string | null
          confianca_percentual: number | null
          created_at: string | null
          dados_historico: Json | null
          demanda_prevista: number
          gerado_em: string | null
          id: string
          lote_sugerido: number
          periodo: string
          ponto_reposicao: number | null
          prioridade: string | null
          produto_id: string | null
          valido_ate: string | null
        }
        Insert: {
          alerta?: string | null
          confianca_percentual?: number | null
          created_at?: string | null
          dados_historico?: Json | null
          demanda_prevista?: number
          gerado_em?: string | null
          id?: string
          lote_sugerido?: number
          periodo: string
          ponto_reposicao?: number | null
          prioridade?: string | null
          produto_id?: string | null
          valido_ate?: string | null
        }
        Update: {
          alerta?: string | null
          confianca_percentual?: number | null
          created_at?: string | null
          dados_historico?: Json | null
          demanda_prevista?: number
          gerado_em?: string | null
          id?: string
          lote_sugerido?: number
          periodo?: string
          ponto_reposicao?: number | null
          prioridade?: string | null
          produto_id?: string | null
          valido_ate?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "previsoes_producao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cargo: string | null
          created_at: string
          data_nascimento: string | null
          departamento: Database["public"]["Enums"]["app_departamento"] | null
          id: string
          nome_completo: string
          sexo: string | null
          status: string | null
          telefone: string | null
          ultimo_acesso: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          data_nascimento?: string | null
          departamento?: Database["public"]["Enums"]["app_departamento"] | null
          id: string
          nome_completo: string
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          cargo?: string | null
          created_at?: string
          data_nascimento?: string | null
          departamento?: Database["public"]["Enums"]["app_departamento"] | null
          id?: string
          nome_completo?: string
          sexo?: string | null
          status?: string | null
          telefone?: string | null
          ultimo_acesso?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      qc_analises: {
        Row: {
          analista_id: string | null
          created_at: string | null
          data_analise: string | null
          especificacao: string
          id: string
          lote_id: string
          observacoes: string | null
          parametro: string
          resultado: string | null
          status: string | null
          tipo_analise: string
        }
        Insert: {
          analista_id?: string | null
          created_at?: string | null
          data_analise?: string | null
          especificacao: string
          id?: string
          lote_id: string
          observacoes?: string | null
          parametro: string
          resultado?: string | null
          status?: string | null
          tipo_analise?: string
        }
        Update: {
          analista_id?: string | null
          created_at?: string | null
          data_analise?: string | null
          especificacao?: string
          id?: string
          lote_id?: string
          observacoes?: string | null
          parametro?: string
          resultado?: string | null
          status?: string | null
          tipo_analise?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_analises_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      qc_calibracoes: {
        Row: {
          certificado_url: string | null
          codigo_equipamento: string
          created_at: string | null
          data_calibracao: string
          equipamento: string
          id: string
          proxima_calibracao: string
          responsavel: string | null
          status: string | null
          tipo_calibracao: string
        }
        Insert: {
          certificado_url?: string | null
          codigo_equipamento: string
          created_at?: string | null
          data_calibracao: string
          equipamento: string
          id?: string
          proxima_calibracao: string
          responsavel?: string | null
          status?: string | null
          tipo_calibracao: string
        }
        Update: {
          certificado_url?: string | null
          codigo_equipamento?: string
          created_at?: string | null
          data_calibracao?: string
          equipamento?: string
          id?: string
          proxima_calibracao?: string
          responsavel?: string | null
          status?: string | null
          tipo_calibracao?: string
        }
        Relationships: []
      }
      qc_desvios: {
        Row: {
          acao_corretiva: string | null
          acao_preventiva: string | null
          causa_raiz: string | null
          codigo: string
          created_at: string | null
          descricao: string
          id: string
          lote_id: string | null
          op_id: string | null
          prazo: string | null
          responsavel_id: string | null
          severidade: string
          status: string | null
          tipo: string
        }
        Insert: {
          acao_corretiva?: string | null
          acao_preventiva?: string | null
          causa_raiz?: string | null
          codigo: string
          created_at?: string | null
          descricao: string
          id?: string
          lote_id?: string | null
          op_id?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          severidade?: string
          status?: string | null
          tipo?: string
        }
        Update: {
          acao_corretiva?: string | null
          acao_preventiva?: string | null
          causa_raiz?: string | null
          codigo?: string
          created_at?: string | null
          descricao?: string
          id?: string
          lote_id?: string | null
          op_id?: string | null
          prazo?: string | null
          responsavel_id?: string | null
          severidade?: string
          status?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "qc_desvios_lote_id_fkey"
            columns: ["lote_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
        ]
      }
      ranking_fornecedores: {
        Row: {
          classificacao: string | null
          created_at: string | null
          custo_medio_kg: number | null
          dados_historico: Json | null
          fornecedor_id: string
          id: string
          score_conformidade: number | null
          score_custo: number | null
          score_pontualidade: number | null
          score_qualidade: number | null
          score_total: number | null
          score_variacao_preco: number | null
          total_entregas_atrasadas: number | null
          total_lotes_recebidos: number | null
          total_nao_conformidades: number | null
          ultima_avaliacao: string | null
          updated_at: string | null
        }
        Insert: {
          classificacao?: string | null
          created_at?: string | null
          custo_medio_kg?: number | null
          dados_historico?: Json | null
          fornecedor_id: string
          id?: string
          score_conformidade?: number | null
          score_custo?: number | null
          score_pontualidade?: number | null
          score_qualidade?: number | null
          score_total?: number | null
          score_variacao_preco?: number | null
          total_entregas_atrasadas?: number | null
          total_lotes_recebidos?: number | null
          total_nao_conformidades?: number | null
          ultima_avaliacao?: string | null
          updated_at?: string | null
        }
        Update: {
          classificacao?: string | null
          created_at?: string | null
          custo_medio_kg?: number | null
          dados_historico?: Json | null
          fornecedor_id?: string
          id?: string
          score_conformidade?: number | null
          score_custo?: number | null
          score_pontualidade?: number | null
          score_qualidade?: number | null
          score_total?: number | null
          score_variacao_preco?: number | null
          total_entregas_atrasadas?: number | null
          total_lotes_recebidos?: number | null
          total_nao_conformidades?: number | null
          ultima_avaliacao?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ranking_fornecedores_fornecedor_id_fkey"
            columns: ["fornecedor_id"]
            isOneToOne: true
            referencedRelation: "entidades"
            referencedColumns: ["id"]
          },
        ]
      }
      rastreabilidade_lote_mp: {
        Row: {
          created_at: string | null
          id: string
          item_mp_id: string
          lote_mp_id: string
          lote_produto_acabado_id: string
          op_id: string
          quantidade_utilizada: number
          unidade: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_mp_id: string
          lote_mp_id: string
          lote_produto_acabado_id: string
          op_id: string
          quantidade_utilizada: number
          unidade?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          item_mp_id?: string
          lote_mp_id?: string
          lote_produto_acabado_id?: string
          op_id?: string
          quantidade_utilizada?: number
          unidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "rastreabilidade_lote_mp_item_mp_id_fkey"
            columns: ["item_mp_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreabilidade_lote_mp_lote_mp_id_fkey"
            columns: ["lote_mp_id"]
            isOneToOne: false
            referencedRelation: "estoque_lotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rastreabilidade_lote_mp_lote_produto_acabado_id_fkey"
            columns: ["lote_produto_acabado_id"]
            isOneToOne: false
            referencedRelation: "lotes_produto_acabado"
            referencedColumns: ["id"]
          },
        ]
      }
      regras_anvisa: {
        Row: {
          alegacoes_permitidas: string[] | null
          alegacoes_proibidas: string[] | null
          ativo: boolean
          avisos_rotulo: string[] | null
          created_at: string
          data_publicacao: string | null
          dose_maxima_diaria_mg: number | null
          dose_maxima_por_porcao_mg: number | null
          fonte_legal: string
          formas_permitidas: string[] | null
          id: string
          substancia: string
          substancia_normalizada: string
          updated_at: string
        }
        Insert: {
          alegacoes_permitidas?: string[] | null
          alegacoes_proibidas?: string[] | null
          ativo?: boolean
          avisos_rotulo?: string[] | null
          created_at?: string
          data_publicacao?: string | null
          dose_maxima_diaria_mg?: number | null
          dose_maxima_por_porcao_mg?: number | null
          fonte_legal: string
          formas_permitidas?: string[] | null
          id?: string
          substancia: string
          substancia_normalizada: string
          updated_at?: string
        }
        Update: {
          alegacoes_permitidas?: string[] | null
          alegacoes_proibidas?: string[] | null
          ativo?: boolean
          avisos_rotulo?: string[] | null
          created_at?: string
          data_publicacao?: string | null
          dose_maxima_diaria_mg?: number | null
          dose_maxima_por_porcao_mg?: number | null
          fonte_legal?: string
          formas_permitidas?: string[] | null
          id?: string
          substancia?: string
          substancia_normalizada?: string
          updated_at?: string
        }
        Relationships: []
      }
      responsaveis_tecnicos: {
        Row: {
          cpf: string
          created_at: string
          created_by: string | null
          documento_comprobatorio_id: string | null
          email: string
          id: string
          nome_completo: string
          numero_registro: string
          status: string
          telefone: string | null
          tipo_conselho: Database["public"]["Enums"]["tipo_conselho_profissional"]
          uf_conselho: string
          updated_at: string
          validade_registro: string
        }
        Insert: {
          cpf: string
          created_at?: string
          created_by?: string | null
          documento_comprobatorio_id?: string | null
          email: string
          id?: string
          nome_completo: string
          numero_registro: string
          status?: string
          telefone?: string | null
          tipo_conselho: Database["public"]["Enums"]["tipo_conselho_profissional"]
          uf_conselho: string
          updated_at?: string
          validade_registro: string
        }
        Update: {
          cpf?: string
          created_at?: string
          created_by?: string | null
          documento_comprobatorio_id?: string | null
          email?: string
          id?: string
          nome_completo?: string
          numero_registro?: string
          status?: string
          telefone?: string | null
          tipo_conselho?: Database["public"]["Enums"]["tipo_conselho_profissional"]
          uf_conselho?: string
          updated_at?: string
          validade_registro?: string
        }
        Relationships: [
          {
            foreignKeyName: "responsaveis_tecnicos_documento_comprobatorio_id_fkey"
            columns: ["documento_comprobatorio_id"]
            isOneToOne: false
            referencedRelation: "arquivos"
            referencedColumns: ["id"]
          },
        ]
      }
      simulacoes_producao: {
        Row: {
          created_at: string
          custo_mao_obra_estimado: number
          custo_mp_estimado: number
          custo_overhead_estimado: number
          custo_real: number | null
          custo_total_estimado: number
          custo_unitario_estimado: number
          desvio_custo_percent: number | null
          desvio_tempo_percent: number | null
          formula_codigo: string
          formula_id: string
          gargalos: Json | null
          id: string
          op_id: string | null
          perdas_estimadas_unidades: number
          quantidade_unidades: number
          rendimento_esperado_percent: number
          sugestoes: Json | null
          tempo_encapsulamento_estimado: number
          tempo_mistura_estimado: number
          tempo_pesagem_estimado: number
          tempo_qc_estimado: number
          tempo_real_min: number | null
          tempo_total_estimado: number
        }
        Insert: {
          created_at?: string
          custo_mao_obra_estimado: number
          custo_mp_estimado: number
          custo_overhead_estimado: number
          custo_real?: number | null
          custo_total_estimado: number
          custo_unitario_estimado: number
          desvio_custo_percent?: number | null
          desvio_tempo_percent?: number | null
          formula_codigo: string
          formula_id: string
          gargalos?: Json | null
          id?: string
          op_id?: string | null
          perdas_estimadas_unidades: number
          quantidade_unidades: number
          rendimento_esperado_percent: number
          sugestoes?: Json | null
          tempo_encapsulamento_estimado: number
          tempo_mistura_estimado: number
          tempo_pesagem_estimado: number
          tempo_qc_estimado: number
          tempo_real_min?: number | null
          tempo_total_estimado: number
        }
        Update: {
          created_at?: string
          custo_mao_obra_estimado?: number
          custo_mp_estimado?: number
          custo_overhead_estimado?: number
          custo_real?: number | null
          custo_total_estimado?: number
          custo_unitario_estimado?: number
          desvio_custo_percent?: number | null
          desvio_tempo_percent?: number | null
          formula_codigo?: string
          formula_id?: string
          gargalos?: Json | null
          id?: string
          op_id?: string | null
          perdas_estimadas_unidades?: number
          quantidade_unidades?: number
          rendimento_esperado_percent?: number
          sugestoes?: Json | null
          tempo_encapsulamento_estimado?: number
          tempo_mistura_estimado?: number
          tempo_pesagem_estimado?: number
          tempo_qc_estimado?: number
          tempo_real_min?: number | null
          tempo_total_estimado?: number
        }
        Relationships: []
      }
      sugestoes_otimizacao: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          created_at: string | null
          dados_analise: Json | null
          descricao: string
          entidade_codigo: string | null
          entidade_id: string
          entidade_tipo: string
          id: string
          impacto_estimado: number | null
          impacto_unidade: string | null
          implementado_em: string | null
          justificativa_tecnica: string
          observacoes_implementacao: string | null
          status: string | null
          tipo_sugestao: Database["public"]["Enums"]["tipo_sugestao_otimizacao"]
          titulo: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          dados_analise?: Json | null
          descricao: string
          entidade_codigo?: string | null
          entidade_id: string
          entidade_tipo: string
          id?: string
          impacto_estimado?: number | null
          impacto_unidade?: string | null
          implementado_em?: string | null
          justificativa_tecnica: string
          observacoes_implementacao?: string | null
          status?: string | null
          tipo_sugestao: Database["public"]["Enums"]["tipo_sugestao_otimizacao"]
          titulo: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          created_at?: string | null
          dados_analise?: Json | null
          descricao?: string
          entidade_codigo?: string | null
          entidade_id?: string
          entidade_tipo?: string
          id?: string
          impacto_estimado?: number | null
          impacto_unidade?: string | null
          implementado_em?: string | null
          justificativa_tecnica?: string
          observacoes_implementacao?: string | null
          status?: string | null
          tipo_sugestao?: Database["public"]["Enums"]["tipo_sugestao_otimizacao"]
          titulo?: string
        }
        Relationships: []
      }
      tabelas_nutricionais: {
        Row: {
          data_geracao: string | null
          formula_id: string
          id: string
          porcao: number
          porcao_unidade: string
          tabela_json_padrao_anvisa: Json
        }
        Insert: {
          data_geracao?: string | null
          formula_id: string
          id?: string
          porcao: number
          porcao_unidade: string
          tabela_json_padrao_anvisa?: Json
        }
        Update: {
          data_geracao?: string | null
          formula_id?: string
          id?: string
          porcao?: number
          porcao_unidade?: string
          tabela_json_padrao_anvisa?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tabelas_nutricionais_formula_id_fkey"
            columns: ["formula_id"]
            isOneToOne: false
            referencedRelation: "formulas"
            referencedColumns: ["id"]
          },
        ]
      }
      trilha_auditoria_tecnica: {
        Row: {
          acao: string
          dados_anteriores: Json | null
          dados_novos: Json | null
          diff_resumo: string | null
          entidade_codigo: string | null
          entidade_id: string
          entidade_tipo: string
          hash_integridade: string | null
          id: string
          ip_origem: string | null
          motivo: string | null
          timestamp: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          diff_resumo?: string | null
          entidade_codigo?: string | null
          entidade_id: string
          entidade_tipo: string
          hash_integridade?: string | null
          id?: string
          ip_origem?: string | null
          motivo?: string | null
          timestamp?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          dados_anteriores?: Json | null
          dados_novos?: Json | null
          diff_resumo?: string | null
          entidade_codigo?: string | null
          entidade_id?: string
          entidade_tipo?: string
          hash_integridade?: string | null
          id?: string
          ip_origem?: string | null
          motivo?: string | null
          timestamp?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      user_permissions: {
        Row: {
          created_at: string | null
          id: string
          modulo: string
          pode_criar: boolean | null
          pode_editar: boolean | null
          pode_excluir: boolean | null
          pode_visualizar: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          modulo: string
          pode_criar?: boolean | null
          pode_editar?: boolean | null
          pode_excluir?: boolean | null
          pode_visualizar?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          modulo?: string
          pode_criar?: boolean | null
          pode_editar?: boolean | null
          pode_excluir?: boolean | null
          pode_visualizar?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      versoes_parametros_industriais: {
        Row: {
          alterado_em: string | null
          alterado_por: string | null
          ativo: boolean | null
          dados: Json
          id: string
          motivo_alteracao: string | null
          tipo_parametro: string
          versao: number
        }
        Insert: {
          alterado_em?: string | null
          alterado_por?: string | null
          ativo?: boolean | null
          dados: Json
          id?: string
          motivo_alteracao?: string | null
          tipo_parametro: string
          versao?: number
        }
        Update: {
          alterado_em?: string | null
          alterado_por?: string | null
          ativo?: boolean | null
          dados?: Json
          id?: string
          motivo_alteracao?: string | null
          tipo_parametro?: string
          versao?: number
        }
        Relationships: []
      }
    }
    Views: {
      vw_anvisa_constituintes_completo: {
        Row: {
          advertencias: string | null
          alegacoes: string | null
          anexo_origem: string | null
          ativo: boolean | null
          cas_number: string | null
          categoria: string | null
          dose_max_adulto: string | null
          dose_max_gestante: string | null
          dose_min_adulto: string | null
          dose_min_gestante: string | null
          fonte_de: string | null
          grupos_nao_autorizados: string | null
          grupos_permitidos: string | null
          id: string | null
          is_proibido: boolean | null
          motivo_proibicao: string | null
          nome_generico: string | null
          nome_tecnico: string | null
          nomes_populares: string | null
          norma_inclusao: string | null
          norma_ultima_alteracao: string | null
          restricoes_uso: string | null
          rotulagem: string | null
          subcategoria: string | null
          unidade_adulto: string | null
        }
        Insert: {
          advertencias?: never
          alegacoes?: never
          anexo_origem?: string | null
          ativo?: boolean | null
          cas_number?: string | null
          categoria?: string | null
          dose_max_adulto?: never
          dose_max_gestante?: never
          dose_min_adulto?: never
          dose_min_gestante?: never
          fonte_de?: string | null
          grupos_nao_autorizados?: never
          grupos_permitidos?: never
          id?: string | null
          is_proibido?: boolean | null
          motivo_proibicao?: string | null
          nome_generico?: string | null
          nome_tecnico?: string | null
          nomes_populares?: never
          norma_inclusao?: string | null
          norma_ultima_alteracao?: string | null
          restricoes_uso?: string | null
          rotulagem?: never
          subcategoria?: string | null
          unidade_adulto?: never
        }
        Update: {
          advertencias?: never
          alegacoes?: never
          anexo_origem?: string | null
          ativo?: boolean | null
          cas_number?: string | null
          categoria?: string | null
          dose_max_adulto?: never
          dose_max_gestante?: never
          dose_min_adulto?: never
          dose_min_gestante?: never
          fonte_de?: string | null
          grupos_nao_autorizados?: never
          grupos_permitidos?: never
          id?: string | null
          is_proibido?: boolean | null
          motivo_proibicao?: string | null
          nome_generico?: string | null
          nome_tecnico?: string | null
          nomes_populares?: never
          norma_inclusao?: string | null
          norma_ultima_alteracao?: string | null
          restricoes_uso?: string | null
          rotulagem?: never
          subcategoria?: string | null
          unidade_adulto?: never
        }
        Relationships: []
      }
    }
    Functions: {
      baixar_estoque_op_embalagens: {
        Args: { p_op_id: string }
        Returns: undefined
      }
      baixar_estoque_op_materias_primas: {
        Args: { p_op_id: string }
        Returns: undefined
      }
      buscar_constituinte_fuzzy: {
        Args: { termo_busca: string }
        Returns: {
          advertencias: string[]
          alegacoes: string[]
          anexo_origem: string
          ativo: boolean
          cas_number: string
          categoria: string
          created_at: string
          data_inclusao: string
          fonte_de: string
          fonte_url: string
          grupos_nao_autorizados: string[]
          grupos_permitidos: string[]
          id: string
          is_proibido: boolean
          limites_0_6_meses: Json
          limites_1_3_anos: Json
          limites_19_mais: Json
          limites_4_8_anos: Json
          limites_7_11_meses: Json
          limites_9_18_anos: Json
          limites_gestantes: Json
          limites_lactantes: Json
          motivo_proibicao: string
          nome_generico: string
          nome_popular: string[]
          nome_rotulo: string
          nome_tecnico: string
          norma_inclusao: string
          norma_ultima_alteracao: string
          referencias_especificacao: string[]
          restricoes_uso: string
          rotulagem_complementar: string[]
          search_vector: unknown
          similaridade: number
          sinonimos: string[]
          subcategoria: string
          sync_id: string
          updated_at: string
          verificado_em: string
        }[]
      }
      buscar_constituinte_por_nome_popular: {
        Args: { termo_busca: string }
        Returns: {
          advertencias: string[] | null
          alegacoes: string[] | null
          anexo_origem: string
          ativo: boolean | null
          cas_number: string | null
          categoria: string
          created_at: string | null
          data_inclusao: string | null
          fonte_de: string | null
          fonte_url: string | null
          grupos_nao_autorizados: string[] | null
          grupos_permitidos: string[] | null
          id: string
          is_proibido: boolean | null
          limites_0_6_meses: Json | null
          limites_1_3_anos: Json | null
          limites_19_mais: Json | null
          limites_4_8_anos: Json | null
          limites_7_11_meses: Json | null
          limites_9_18_anos: Json | null
          limites_gestantes: Json | null
          limites_lactantes: Json | null
          motivo_proibicao: string | null
          nome_generico: string | null
          nome_popular: string[] | null
          nome_rotulo: string | null
          nome_tecnico: string
          norma_inclusao: string
          norma_ultima_alteracao: string | null
          referencias_especificacao: string[] | null
          restricoes_uso: string | null
          rotulagem_complementar: string[] | null
          search_vector: unknown
          sinonimos: string[] | null
          subcategoria: string | null
          sync_id: string | null
          updated_at: string | null
          verificado_em: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "anvisa_constituintes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      gerar_codigo_orcamento: { Args: never; Returns: string }
      gerar_codigo_pedido: { Args: never; Returns: string }
      gerar_hash_auditoria: { Args: { dados: Json }; Returns: string }
      gerar_hash_qr_code_op: {
        Args: { p_lote_pa: string; p_op_id: string; p_secret?: string }
        Returns: string
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_module_permission: {
        Args: { _modulo: string; _permission?: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_expiring_lots: { Args: never; Returns: undefined }
      notify_low_stock: { Args: never; Returns: undefined }
      registrar_evento_auditoria: {
        Args: {
          p_dados_anteriores?: Json
          p_dados_evento?: Json
          p_dados_novos?: Json
          p_descricao: string
          p_entidade_codigo?: string
          p_entidade_id: string
          p_entidade_tipo: string
          p_ip_address?: string
          p_tipo_evento: Database["public"]["Enums"]["tipo_evento_auditoria"]
          p_user_agent?: string
          p_usuario_id?: string
          p_usuario_nome?: string
        }
        Returns: string
      }
      rt_valido_para_producao: { Args: { p_rt_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
      update_ultimo_acesso: { Args: { p_user_id: string }; Returns: undefined }
      validar_compatibilidade_rt: {
        Args: {
          p_tipo_conselho: Database["public"]["Enums"]["tipo_conselho_profissional"]
          p_tipo_produto: string
        }
        Returns: boolean
      }
      validar_qr_code_op: {
        Args: { p_hash: string; p_op_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_departamento:
        | "DIRETORIA"
        | "COMERCIAL"
        | "COMPRAS"
        | "FINANCEIRO"
        | "ESTOQUE"
        | "PRODUCAO"
        | "QUALIDADE"
        | "RH"
        | "TI"
      app_role: "admin" | "gerente" | "supervisor" | "operador" | "visualizador"
      nivel_alerta: "CRITICO" | "ALTO" | "MEDIO" | "BAIXO"
      severidade_anomalia: "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" | "INFO"
      status_formula_industrial: "RASCUNHO" | "APROVADA" | "BLOQUEADA"
      tipo_alerta_executivo:
        | "MARGEM_BAIXA"
        | "FORNECEDOR_RISCO"
        | "PROCESSO_FORA_PADRAO"
        | "RISCO_REGULATORIO"
        | "ESTOQUE_CRITICO"
        | "CUSTO_ELEVADO"
        | "QUALIDADE_COMPROMETIDA"
        | "VENCIMENTO_PROXIMO"
        | "PRODUCAO_ATRASADA"
        | "ANOMALIA_DETECTADA"
      tipo_anomalia:
        | "PESO_FORA_PADRAO"
        | "CONSUMO_EXCESSIVO"
        | "TEMPO_ANORMAL"
        | "RENDIMENTO_BAIXO"
        | "PERDA_ELEVADA"
        | "DESVIO_CUSTO"
        | "DESVIO_QUALIDADE"
      tipo_apresentacao_formula: "CAPSULA" | "LIQUIDO" | "PO"
      tipo_conselho_profissional: "CRN" | "CRQ" | "CRF"
      tipo_evento_auditoria:
        | "FORMULA_CRIADA"
        | "FORMULA_APROVADA"
        | "FORMULA_ALTERADA"
        | "OP_CRIADA"
        | "OP_INICIADA"
        | "OP_ALTERADA"
        | "OP_FINALIZADA"
        | "OP_BLOQUEADA"
        | "RT_ASSINATURA"
        | "LOTE_LIBERADO"
        | "LOTE_BLOQUEADO"
        | "QC_APROVADO"
        | "QC_REPROVADO"
        | "PESAGEM_REGISTRADA"
        | "CHECKLIST_VERIFICADO"
      tipo_excipiente_formula: "AMIDO" | "CELULOSE" | "PRE_BLEND"
      tipo_sugestao_otimizacao:
        | "AJUSTE_EXCIPIENTE"
        | "ORDEM_MISTURA"
        | "REDUCAO_PERDA"
        | "MELHORIA_RENDIMENTO"
        | "SUBSTITUICAO_INSUMO"
        | "ALTERACAO_PROCESSO"
        | "ECONOMIA_CUSTO"
      unidade_informada_formula: "MG" | "MCG" | "UI"
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
    Enums: {
      app_departamento: [
        "DIRETORIA",
        "COMERCIAL",
        "COMPRAS",
        "FINANCEIRO",
        "ESTOQUE",
        "PRODUCAO",
        "QUALIDADE",
        "RH",
        "TI",
      ],
      app_role: ["admin", "gerente", "supervisor", "operador", "visualizador"],
      nivel_alerta: ["CRITICO", "ALTO", "MEDIO", "BAIXO"],
      severidade_anomalia: ["CRITICA", "ALTA", "MEDIA", "BAIXA", "INFO"],
      status_formula_industrial: ["RASCUNHO", "APROVADA", "BLOQUEADA"],
      tipo_alerta_executivo: [
        "MARGEM_BAIXA",
        "FORNECEDOR_RISCO",
        "PROCESSO_FORA_PADRAO",
        "RISCO_REGULATORIO",
        "ESTOQUE_CRITICO",
        "CUSTO_ELEVADO",
        "QUALIDADE_COMPROMETIDA",
        "VENCIMENTO_PROXIMO",
        "PRODUCAO_ATRASADA",
        "ANOMALIA_DETECTADA",
      ],
      tipo_anomalia: [
        "PESO_FORA_PADRAO",
        "CONSUMO_EXCESSIVO",
        "TEMPO_ANORMAL",
        "RENDIMENTO_BAIXO",
        "PERDA_ELEVADA",
        "DESVIO_CUSTO",
        "DESVIO_QUALIDADE",
      ],
      tipo_apresentacao_formula: ["CAPSULA", "LIQUIDO", "PO"],
      tipo_conselho_profissional: ["CRN", "CRQ", "CRF"],
      tipo_evento_auditoria: [
        "FORMULA_CRIADA",
        "FORMULA_APROVADA",
        "FORMULA_ALTERADA",
        "OP_CRIADA",
        "OP_INICIADA",
        "OP_ALTERADA",
        "OP_FINALIZADA",
        "OP_BLOQUEADA",
        "RT_ASSINATURA",
        "LOTE_LIBERADO",
        "LOTE_BLOQUEADO",
        "QC_APROVADO",
        "QC_REPROVADO",
        "PESAGEM_REGISTRADA",
        "CHECKLIST_VERIFICADO",
      ],
      tipo_excipiente_formula: ["AMIDO", "CELULOSE", "PRE_BLEND"],
      tipo_sugestao_otimizacao: [
        "AJUSTE_EXCIPIENTE",
        "ORDEM_MISTURA",
        "REDUCAO_PERDA",
        "MELHORIA_RENDIMENTO",
        "SUBSTITUICAO_INSUMO",
        "ALTERACAO_PROCESSO",
        "ECONOMIA_CUSTO",
      ],
      unidade_informada_formula: ["MG", "MCG", "UI"],
    },
  },
} as const
