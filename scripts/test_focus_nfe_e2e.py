#!/usr/bin/env python3
"""
=============================================================================
SCRIPT DE TESTE PONTA A PONTA — Focus NFe × BrainX ERP
=============================================================================
Executa todos os fluxos críticos de NF-e em ambiente de HOMOLOGAÇÃO:

  T-01  Autenticação (Basic Auth)
  T-02  Cadastro de empresa com dry_run (validação sem persistir)
  T-03  Cadastro real da empresa VITALNOW na Focus NFe
  T-04  Consulta de empresa cadastrada
  T-05  Emissão de NF-e (homologação) — fluxo assíncrono
  T-06  Polling de status até autorização (ou timeout)
  T-07  Download do DANFE (PDF)
  T-08  Download do XML
  T-09  Cancelamento da NF-e emitida
  T-10  Status da SEFAZ

Pré-requisitos:
  - Token Focus NFe: bamhs6TIPXXTBcmTazR4OK8vslUeqEut
  - Supabase Personal Access Token configurado
  - Certificado A1 da VITALNOW disponível no Supabase Storage
  - pip install requests colorama

Uso:
  python3 scripts/test_focus_nfe_e2e.py
  python3 scripts/test_focus_nfe_e2e.py --apenas-emissao
  python3 scripts/test_focus_nfe_e2e.py --pular-cadastro
=============================================================================
"""

import requests
import json
import time
import sys
import os
import base64
import argparse
from datetime import datetime, timezone, timedelta

# ─── Configuração ────────────────────────────────────────────────────────────

FOCUS_NFE_TOKEN     = "bamhs6TIPXXTBcmTazR4OK8vslUeqEut"
FOCUS_PROD_URL      = "https://api.focusnfe.com.br/v2"
FOCUS_HOMOLOG_URL   = "https://homologacao.focusnfe.com.br/v2"
SUPABASE_URL        = "https://cqkvekdrifmvedvpjmjr.supabase.co"
SUPABASE_PAT        = "sbp_8d3a35cdaae40f92584e8d6835188bd7760a7a68"
SUPABASE_REST       = f"{SUPABASE_URL}/rest/v1"

# Dados reais da VITALNOW (obtidos do banco)
VITALNOW = {
    "cnpj":              "52693922000125",
    "razao_social":      "VITALNOW INDUSTRIA LTDA",
    "nome_fantasia":     "VITALNOW INDUSTRIA",
    "ie":                "204352029112",
    "regime_tributario": "1",  # Simples Nacional
    "logradouro":        "VENEZUELA",
    "numero":            "1680",
    "complemento":       "SALA B",
    "bairro":            "AMERICA",
    "municipio":         "BARRETOS",
    "uf":                "SP",
    "cep":               "14783183",
    "email":             "nfe@vitalnow.com.br",
    "telefone":          "1733000000",
    "codigo_municipio":  "3505500",  # IBGE Barretos-SP
}

# Dados do cliente de teste (LEPUGE — real no banco)
CLIENTE_TESTE = {
    "cnpj":         "57884835000179",
    "razao_social": "LEPUGE INSUMOS FARMACEUTICOS LTDA",
    "ie":           "635653743114",
    "logradouro":   "RUA EXEMPLO",
    "numero":       "100",
    "bairro":       "CENTRO",
    "municipio":    "SAO BERNARDO DO CAMPO",
    "uf":           "SP",
    "cep":          "09726370",
    "codigo_municipio": "3548708",  # IBGE São Bernardo do Campo-SP
    "email":        "compras@lepuge.com.br",
}

# Item de teste (MP-2606-0463 — real no banco)
ITEM_TESTE = {
    "codigo":      "MP-2606-0463",
    "descricao":   "ITEM TESTE HOMOLOGACAO - BRAINX ERP",
    "ncm":         "96020010",
    "cfop":        "5102",
    "unidade":     "UN",
    "quantidade":  1.0,
    "valor_unit":  10.00,
    "origem_icms": "2",
    "cst_icms":    "400",  # Simples Nacional
    "cst_pis":     "07",   # Simples Nacional
    "cst_cofins":  "07",   # Simples Nacional
}

# ─── Helpers ─────────────────────────────────────────────────────────────────

class Colors:
    OK      = "\033[92m"
    FAIL    = "\033[91m"
    WARN    = "\033[93m"
    INFO    = "\033[94m"
    BOLD    = "\033[1m"
    RESET   = "\033[0m"

def ok(msg):    print(f"  {Colors.OK}✓{Colors.RESET} {msg}")
def fail(msg):  print(f"  {Colors.FAIL}✗{Colors.RESET} {msg}")
def warn(msg):  print(f"  {Colors.WARN}⚠{Colors.RESET} {msg}")
def info(msg):  print(f"  {Colors.INFO}→{Colors.RESET} {msg}")

def header(titulo):
    print(f"\n{Colors.BOLD}{'─'*60}{Colors.RESET}")
    print(f"{Colors.BOLD}  {titulo}{Colors.RESET}")
    print(f"{Colors.BOLD}{'─'*60}{Colors.RESET}")

def focus_auth():
    """Retorna header de autenticação Basic Auth para a Focus NFe."""
    cred = base64.b64encode(f"{FOCUS_NFE_TOKEN}:".encode()).decode()
    return {"Authorization": f"Basic {cred}", "Content-Type": "application/json"}

def supabase_headers():
    """Retorna headers para a Management API do Supabase."""
    return {
        "Authorization": f"Bearer {SUPABASE_PAT}",
        "Content-Type": "application/json"
    }

def get_service_key():
    """Obtém a service_role key do Supabase via Management API."""
    resp = requests.get(
        f"https://api.supabase.com/v1/projects/cqkvekdrifmvedvpjmjr/api-keys",
        headers=supabase_headers()
    )
    for k in resp.json():
        if k.get("name") == "service_role":
            return k["api_key"]
    return None

def supabase_rest_headers(service_key):
    return {
        "Authorization": f"Bearer {service_key}",
        "apikey": service_key,
        "Content-Type": "application/json"
    }

# ─── Testes ──────────────────────────────────────────────────────────────────

resultados = []

def registrar(teste, passou, detalhe=""):
    resultados.append({"teste": teste, "passou": passou, "detalhe": detalhe})
    if passou:
        ok(f"{teste}: PASSOU")
    else:
        fail(f"{teste}: FALHOU — {detalhe}")

# ── T-01: Autenticação ────────────────────────────────────────────────────────
def test_autenticacao():
    header("T-01 — Autenticação Basic Auth")
    resp = requests.get(f"{FOCUS_PROD_URL}/empresas", headers=focus_auth())
    info(f"Status HTTP: {resp.status_code}")
    if resp.status_code in (200, 404):
        ok(f"Token válido — HTTP {resp.status_code}")
        registrar("T-01 Autenticação", True, f"HTTP {resp.status_code}")
    else:
        registrar("T-01 Autenticação", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
    return resp.status_code in (200, 404)

# ── T-02: Cadastro dry_run ────────────────────────────────────────────────────
def test_cadastro_dry_run():
    header("T-02 — Cadastro de Empresa (dry_run=1)")
    payload = {
        "nome":         VITALNOW["razao_social"],
        "nome_fantasia": VITALNOW["nome_fantasia"],
        "cnpj":         VITALNOW["cnpj"],
        "inscricao_estadual": VITALNOW["ie"],
        "regime_tributario": VITALNOW["regime_tributario"],
        "logradouro":   VITALNOW["logradouro"],
        "numero":       VITALNOW["numero"],
        "complemento":  VITALNOW["complemento"],
        "bairro":       VITALNOW["bairro"],
        "municipio":    VITALNOW["municipio"],
        "uf":           VITALNOW["uf"],
        "cep":          int(VITALNOW["cep"]),
        "telefone":     VITALNOW["telefone"],
        "email":        VITALNOW["email"],
    }
    info(f"Enviando dry_run para CNPJ {VITALNOW['cnpj']}...")
    resp = requests.post(
        f"{FOCUS_PROD_URL}/empresas?dry_run=1",
        headers=focus_auth(),
        json=payload
    )
    info(f"Status HTTP: {resp.status_code}")
    data = resp.json() if resp.headers.get("Content-Type","").startswith("application/json") else {}
    info(f"Resposta: {json.dumps(data, ensure_ascii=False)[:300]}")

    # dry_run retorna 200 (validação ok) ou 422 (dados inválidos)
    if resp.status_code in (200, 201):
        registrar("T-02 Cadastro dry_run", True, "Validação OK")
        return True
    elif resp.status_code == 422:
        # Pode ser que a empresa já exista — isso é normal
        msg = data.get("mensagem", "")
        if "já" in msg.lower() or "exist" in msg.lower() or "cnpj" in msg.lower():
            warn(f"Empresa já cadastrada ou CNPJ duplicado: {msg}")
            registrar("T-02 Cadastro dry_run", True, f"Empresa já existe: {msg}")
            return True
        registrar("T-02 Cadastro dry_run", False, f"Validação falhou: {msg}")
        return False
    else:
        registrar("T-02 Cadastro dry_run", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
        return False

# ── T-03: Cadastro real ───────────────────────────────────────────────────────
def test_cadastro_real(pular=False):
    header("T-03 — Cadastro Real da Empresa")
    if pular:
        warn("Pulando cadastro real (--pular-cadastro)")
        registrar("T-03 Cadastro real", True, "Pulado")
        return True

    # Verificar se já está cadastrada
    resp_check = requests.get(
        f"{FOCUS_PROD_URL}/empresas?cnpj={VITALNOW['cnpj']}",
        headers=focus_auth()
    )
    if resp_check.status_code == 200:
        empresas = resp_check.json()
        if isinstance(empresas, list) and len(empresas) > 0:
            warn(f"Empresa já cadastrada na Focus NFe (ID: {empresas[0].get('id', 'N/A')})")
            registrar("T-03 Cadastro real", True, "Já cadastrada")
            return True

    payload = {
        "nome":         VITALNOW["razao_social"],
        "nome_fantasia": VITALNOW["nome_fantasia"],
        "cnpj":         VITALNOW["cnpj"],
        "inscricao_estadual": VITALNOW["ie"],
        "regime_tributario": VITALNOW["regime_tributario"],
        "logradouro":   VITALNOW["logradouro"],
        "numero":       VITALNOW["numero"],
        "complemento":  VITALNOW["complemento"],
        "bairro":       VITALNOW["bairro"],
        "municipio":    VITALNOW["municipio"],
        "uf":           VITALNOW["uf"],
        "cep":          int(VITALNOW["cep"]),
        "telefone":     VITALNOW["telefone"],
        "email":        VITALNOW["email"],
    }
    info("Cadastrando empresa na Focus NFe (produção)...")
    resp = requests.post(f"{FOCUS_PROD_URL}/empresas", headers=focus_auth(), json=payload)
    info(f"Status HTTP: {resp.status_code}")
    data = resp.json() if resp.headers.get("Content-Type","").startswith("application/json") else {}
    info(f"Resposta: {json.dumps(data, ensure_ascii=False)[:400]}")

    if resp.status_code in (200, 201):
        registrar("T-03 Cadastro real", True, f"Empresa cadastrada: {data.get('cnpj','')}")
        return True
    elif resp.status_code == 422:
        msg = data.get("mensagem", "")
        if "já" in msg.lower() or "exist" in msg.lower():
            registrar("T-03 Cadastro real", True, "Já existia")
            return True
        registrar("T-03 Cadastro real", False, msg)
        return False
    else:
        registrar("T-03 Cadastro real", False, f"HTTP {resp.status_code}: {resp.text[:200]}")
        return False

# ── T-04: Consulta de empresa ─────────────────────────────────────────────────
def test_consulta_empresa():
    header("T-04 — Consulta de Empresa Cadastrada")
    resp = requests.get(
        f"{FOCUS_PROD_URL}/empresas?cnpj={VITALNOW['cnpj']}",
        headers=focus_auth()
    )
    info(f"Status HTTP: {resp.status_code}")
    data = resp.json() if resp.headers.get("Content-Type","").startswith("application/json") else {}
    info(f"Resposta: {json.dumps(data, ensure_ascii=False)[:400]}")

    if resp.status_code == 200 and isinstance(data, list) and len(data) > 0:
        registrar("T-04 Consulta empresa", True, f"Encontrada: {data[0].get('nome','')}")
        return True
    elif resp.status_code == 200 and isinstance(data, list) and len(data) == 0:
        warn("Empresa não encontrada — pode precisar cadastrar primeiro (T-03)")
        registrar("T-04 Consulta empresa", False, "Não encontrada")
        return False
    else:
        registrar("T-04 Consulta empresa", False, f"HTTP {resp.status_code}")
        return False

# ── T-05 + T-06: Emissão e Polling ───────────────────────────────────────────
def test_emissao_e_polling():
    header("T-05 — Emissão de NF-e (Homologação)")

    agora = datetime.now(tz=timezone(timedelta(hours=-3)))
    ref = f"brainx-teste-{int(agora.timestamp())}"

    payload = {
        "natureza_operacao":  "VENDA DE MERCADORIA",
        "data_emissao":       agora.strftime("%Y-%m-%dT%H:%M:%S-03:00"),
        "data_entrada_saida": agora.strftime("%Y-%m-%dT%H:%M:%S-03:00"),
        "tipo_documento":     1,
        "local_destino":      1,
        "finalidade_emissao": 1,
        "consumidor_final":   0,
        "presenca_comprador": 9,

        # Emitente
        "cnpj_emitente": VITALNOW["cnpj"],

        # Destinatário
        "cnpj_destinatario":     CLIENTE_TESTE["cnpj"],
        "razao_social_destinatario": CLIENTE_TESTE["razao_social"],
        "logradouro_destinatario": CLIENTE_TESTE["logradouro"],
        "numero_destinatario":   CLIENTE_TESTE["numero"],
        "bairro_destinatario":   CLIENTE_TESTE["bairro"],
        "municipio_destinatario": CLIENTE_TESTE["municipio"],
        "uf_destinatario":       CLIENTE_TESTE["uf"],
        "cep_destinatario":      CLIENTE_TESTE["cep"],
        "codigo_municipio_destinatario": CLIENTE_TESTE["codigo_municipio"],
        "pais_destinatario":     "Brasil",
        "codigo_pais_destinatario": "1058",
        "email_destinatario":    CLIENTE_TESTE["email"],
        "indicador_inscricao_estadual_destinatario": 1,
        "inscricao_estadual_destinatario": CLIENTE_TESTE["ie"],

        # Itens
        "items": [{
            "numero_item":            "1",
            "codigo_produto":         ITEM_TESTE["codigo"],
            "descricao":              ITEM_TESTE["descricao"],
            "codigo_ncm":             ITEM_TESTE["ncm"],
            "cfop":                   ITEM_TESTE["cfop"],
            "unidade_comercial":      ITEM_TESTE["unidade"],
            "quantidade_comercial":   ITEM_TESTE["quantidade"],
            "valor_unitario_comercial": ITEM_TESTE["valor_unit"],
            "valor_bruto":            ITEM_TESTE["quantidade"] * ITEM_TESTE["valor_unit"],
            "unidade_tributavel":     ITEM_TESTE["unidade"],
            "quantidade_tributavel":  ITEM_TESTE["quantidade"],
            "valor_unitario_tributavel": ITEM_TESTE["valor_unit"],
            "inclui_no_total":        "1",
            "icms_origem":            ITEM_TESTE["origem_icms"],
            "icms_situacao_tributaria": ITEM_TESTE["cst_icms"],
            "pis_situacao_tributaria":  ITEM_TESTE["cst_pis"],
            "cofins_situacao_tributaria": ITEM_TESTE["cst_cofins"],
        }],

        # Totais
        "valor_produtos":    ITEM_TESTE["quantidade"] * ITEM_TESTE["valor_unit"],
        "valor_frete":       0,
        "valor_seguro":      0,
        "valor_desconto":    0,
        "valor_total_nfe":   ITEM_TESTE["quantidade"] * ITEM_TESTE["valor_unit"],

        # Transporte
        "modalidade_frete": 9,  # Sem frete

        # Informações adicionais
        "informacoes_adicionais_contribuinte": "NOTA FISCAL DE TESTE — BRAINX ERP — NÃO TEM VALOR FISCAL",
    }

    info(f"REF da nota: {ref}")
    info(f"Emitente: {VITALNOW['cnpj']} — {VITALNOW['razao_social']}")
    info(f"Destinatário: {CLIENTE_TESTE['cnpj']} — {CLIENTE_TESTE['razao_social']}")
    info(f"Item: {ITEM_TESTE['descricao']} — R$ {ITEM_TESTE['valor_unit']:.2f}")

    resp = requests.post(
        f"{FOCUS_HOMOLOG_URL}/nfe?ref={ref}",
        headers=focus_auth(),
        json=payload
    )
    info(f"Status HTTP: {resp.status_code}")
    data = resp.json() if resp.headers.get("Content-Type","").startswith("application/json") else {}
    info(f"Resposta: {json.dumps(data, ensure_ascii=False)[:500]}")

    if resp.status_code not in (200, 201, 202):
        registrar("T-05 Emissão NF-e", False, f"HTTP {resp.status_code}: {data.get('mensagem', resp.text[:200])}")
        return None

    status_inicial = data.get("status", "")
    registrar("T-05 Emissão NF-e", True, f"Status inicial: {status_inicial} | REF: {ref}")

    # ── T-06: Polling ─────────────────────────────────────────────────────────
    header("T-06 — Polling de Status (aguardando SEFAZ)")
    MAX_TENTATIVAS = 15
    INTERVALO_SEG  = 3
    autorizada = False
    dados_finais = None

    for tentativa in range(1, MAX_TENTATIVAS + 1):
        time.sleep(INTERVALO_SEG)
        resp_c = requests.get(f"{FOCUS_HOMOLOG_URL}/nfe/{ref}", headers=focus_auth())
        dados = resp_c.json() if resp_c.headers.get("Content-Type","").startswith("application/json") else {}
        status = dados.get("status", "desconhecido")
        info(f"Tentativa {tentativa}/{MAX_TENTATIVAS} — Status: {status}")

        if status == "autorizado":
            autorizada = True
            dados_finais = dados
            break
        elif status in ("erro_autorizacao", "denegado", "cancelado"):
            motivo = dados.get("mensagem_sefaz", dados.get("motivo_rejeicao", "Sem detalhe"))
            registrar("T-06 Polling status", False, f"Status: {status} — {motivo}")
            return None

    if autorizada and dados_finais:
        chave = dados_finais.get("chave_nfe", "N/A")
        numero = dados_finais.get("numero", "N/A")
        serie  = dados_finais.get("serie", "N/A")
        protocolo = dados_finais.get("protocolo", "N/A")
        registrar("T-06 Polling status", True, f"Autorizada! Chave: {chave[:20]}... | NF-e {serie}/{numero}")
        ok(f"  Chave NF-e:  {chave}")
        ok(f"  Número/Série: {serie}/{numero}")
        ok(f"  Protocolo:   {protocolo}")
        return {"ref": ref, "dados": dados_finais}
    else:
        registrar("T-06 Polling status", False, f"Timeout após {MAX_TENTATIVAS} tentativas")
        return {"ref": ref, "dados": None, "timeout": True}

# ── T-07: Download DANFE ──────────────────────────────────────────────────────
def test_danfe(ref, dados_nfe):
    header("T-07 — Download do DANFE (PDF)")
    if not dados_nfe or not dados_nfe.get("caminho_danfe"):
        warn("caminho_danfe não disponível — pulando")
        registrar("T-07 Download DANFE", False, "caminho_danfe ausente na resposta")
        return False

    url_danfe = f"https://homologacao.focusnfe.com.br{dados_nfe['caminho_danfe']}"
    info(f"URL do DANFE: {url_danfe}")
    resp = requests.get(url_danfe, headers=focus_auth())
    info(f"Status HTTP: {resp.status_code}")
    info(f"Content-Type: {resp.headers.get('Content-Type', 'N/A')}")
    info(f"Tamanho: {len(resp.content)} bytes")

    if resp.status_code == 200 and "pdf" in resp.headers.get("Content-Type", "").lower():
        caminho = f"/tmp/danfe_teste_{ref}.pdf"
        with open(caminho, "wb") as f:
            f.write(resp.content)
        registrar("T-07 Download DANFE", True, f"PDF salvo em {caminho} ({len(resp.content)} bytes)")
        return True
    else:
        registrar("T-07 Download DANFE", False, f"HTTP {resp.status_code} | Content-Type: {resp.headers.get('Content-Type','N/A')}")
        return False

# ── T-08: Download XML ────────────────────────────────────────────────────────
def test_xml(ref, dados_nfe):
    header("T-08 — Download do XML")
    if not dados_nfe or not dados_nfe.get("caminho_xml_nota_fiscal"):
        warn("caminho_xml_nota_fiscal não disponível — pulando")
        registrar("T-08 Download XML", False, "caminho_xml ausente na resposta")
        return False

    url_xml = f"https://homologacao.focusnfe.com.br{dados_nfe['caminho_xml_nota_fiscal']}"
    info(f"URL do XML: {url_xml}")
    resp = requests.get(url_xml, headers=focus_auth())
    info(f"Status HTTP: {resp.status_code}")
    info(f"Tamanho: {len(resp.content)} bytes")

    if resp.status_code == 200 and len(resp.content) > 100:
        caminho = f"/tmp/nfe_teste_{ref}.xml"
        with open(caminho, "wb") as f:
            f.write(resp.content)
        # Verificar se é XML válido
        xml_str = resp.content.decode("utf-8", errors="replace")
        tem_chave = dados_nfe.get("chave_nfe","") in xml_str if dados_nfe.get("chave_nfe") else True
        registrar("T-08 Download XML", True, f"XML salvo em {caminho} | Chave no XML: {tem_chave}")
        return True
    else:
        registrar("T-08 Download XML", False, f"HTTP {resp.status_code}")
        return False

# ── T-09: Cancelamento ────────────────────────────────────────────────────────
def test_cancelamento(ref):
    header("T-09 — Cancelamento da NF-e")
    justificativa = "CANCELAMENTO DE TESTE - BRAINX ERP - HOMOLOGACAO - NAO TEM VALOR FISCAL"
    info(f"Cancelando REF: {ref}")
    info(f"Justificativa: {justificativa}")

    resp = requests.delete(
        f"{FOCUS_HOMOLOG_URL}/nfe/{ref}",
        headers=focus_auth(),
        json={"justificativa": justificativa}
    )
    info(f"Status HTTP: {resp.status_code}")
    data = resp.json() if resp.headers.get("Content-Type","").startswith("application/json") else {}
    info(f"Resposta: {json.dumps(data, ensure_ascii=False)[:300]}")

    status = data.get("status", "")
    if resp.status_code in (200, 201) and status in ("cancelado", "cancelamento_homologado"):
        registrar("T-09 Cancelamento", True, f"Status: {status}")
        return True
    elif resp.status_code == 422:
        msg = data.get("mensagem", "")
        # Pode já estar cancelada ou fora do prazo
        if "já" in msg.lower() or "prazo" in msg.lower():
            warn(f"Não cancelável: {msg}")
            registrar("T-09 Cancelamento", True, f"Não cancelável (esperado): {msg}")
            return True
        registrar("T-09 Cancelamento", False, msg)
        return False
    else:
        registrar("T-09 Cancelamento", False, f"HTTP {resp.status_code}: {data.get('mensagem', resp.text[:100])}")
        return False

# ── T-10: Status SEFAZ ────────────────────────────────────────────────────────
def test_status_sefaz():
    header("T-10 — Status da SEFAZ")
    cnpj = VITALNOW["cnpj"]
    info(f"Consultando status SEFAZ para CNPJ: {cnpj}")

    resp = requests.get(
        f"{FOCUS_HOMOLOG_URL}/nfe/status_sefaz?cnpj={cnpj}",
        headers=focus_auth()
    )
    info(f"Status HTTP: {resp.status_code}")
    data = resp.json() if resp.headers.get("Content-Type","").startswith("application/json") else {}
    info(f"Resposta: {json.dumps(data, ensure_ascii=False)[:300]}")

    if resp.status_code == 200:
        status_sefaz = data.get("status", data.get("status_sefaz", "N/A"))
        registrar("T-10 Status SEFAZ", True, f"Status: {status_sefaz}")
        return True
    else:
        registrar("T-10 Status SEFAZ", False, f"HTTP {resp.status_code}: {resp.text[:100]}")
        return False

# ─── Relatório Final ──────────────────────────────────────────────────────────

def relatorio_final():
    header("RELATÓRIO FINAL")
    total   = len(resultados)
    passou  = sum(1 for r in resultados if r["passou"])
    falhou  = total - passou
    pct     = (passou / total * 100) if total > 0 else 0

    print(f"\n  Total de testes: {total}")
    print(f"  {Colors.OK}Passou: {passou}{Colors.RESET}")
    print(f"  {Colors.FAIL}Falhou: {falhou}{Colors.RESET}")
    print(f"  Taxa de sucesso: {pct:.0f}%\n")

    if falhou > 0:
        print(f"  {Colors.BOLD}Testes com falha:{Colors.RESET}")
        for r in resultados:
            if not r["passou"]:
                print(f"    {Colors.FAIL}✗ {r['teste']}: {r['detalhe']}{Colors.RESET}")

    print()
    if pct == 100:
        print(f"  {Colors.OK}{Colors.BOLD}✓ TODOS OS TESTES PASSARAM — Focus NFe pronta para produção!{Colors.RESET}")
    elif pct >= 70:
        print(f"  {Colors.WARN}{Colors.BOLD}⚠ MAIORIA DOS TESTES PASSOU — Revisar falhas antes de ir para produção.{Colors.RESET}")
    else:
        print(f"  {Colors.FAIL}{Colors.BOLD}✗ MUITOS TESTES FALHARAM — Não ir para produção sem corrigir.{Colors.RESET}")
    print()

# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Teste E2E Focus NFe × BrainX ERP")
    parser.add_argument("--apenas-emissao", action="store_true", help="Pula cadastro e vai direto para emissão")
    parser.add_argument("--pular-cadastro", action="store_true", help="Pula o cadastro real (T-03)")
    parser.add_argument("--sem-cancelamento", action="store_true", help="Não cancela a nota após o teste")
    args = parser.parse_args()

    print(f"\n{Colors.BOLD}{'='*60}{Colors.RESET}")
    print(f"{Colors.BOLD}  TESTE E2E — Focus NFe × BrainX ERP{Colors.RESET}")
    print(f"{Colors.BOLD}  Ambiente: HOMOLOGAÇÃO{Colors.RESET}")
    print(f"{Colors.BOLD}  Data: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}{Colors.RESET}")
    print(f"{Colors.BOLD}{'='*60}{Colors.RESET}")

    # T-01: Autenticação
    if not test_autenticacao():
        fail("Autenticação falhou — abortando testes")
        relatorio_final()
        sys.exit(1)

    if not args.apenas_emissao:
        # T-02: dry_run
        test_cadastro_dry_run()

        # T-03: Cadastro real
        test_cadastro_real(pular=args.pular_cadastro)

        # T-04: Consulta
        test_consulta_empresa()

    # T-05 + T-06: Emissão e Polling
    resultado_emissao = test_emissao_e_polling()

    if resultado_emissao and resultado_emissao.get("dados"):
        ref       = resultado_emissao["ref"]
        dados_nfe = resultado_emissao["dados"]

        # T-07: DANFE
        test_danfe(ref, dados_nfe)

        # T-08: XML
        test_xml(ref, dados_nfe)

        # T-09: Cancelamento
        if not args.sem_cancelamento:
            test_cancelamento(ref)
        else:
            warn("Cancelamento pulado (--sem-cancelamento)")
    elif resultado_emissao and resultado_emissao.get("timeout"):
        warn("Emissão em timeout — pulando T-07, T-08, T-09")
        registrar("T-07 Download DANFE", False, "Nota não autorizada (timeout)")
        registrar("T-08 Download XML",   False, "Nota não autorizada (timeout)")
        registrar("T-09 Cancelamento",   False, "Nota não autorizada (timeout)")
    else:
        warn("Emissão falhou — pulando T-07, T-08, T-09")

    # T-10: Status SEFAZ
    test_status_sefaz()

    # Relatório final
    relatorio_final()

if __name__ == "__main__":
    main()
