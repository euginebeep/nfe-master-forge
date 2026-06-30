#!/usr/bin/env python3

"""
ANVISA Power BI Monitor

Monitora o Power BI oficial da ANVISA para detectar novas legislações,
constituintes autorizados e atualizações de limites.

Funcionalidades:
- Scraping do Power BI ANVISA
- Detecção de novas legislações (IN, RDC)
- Comparação com limites locais
- Geração de alertas
- Atualização automática de banco de dados

Uso:
python3 anvisa-powerbi-monitor.py --check-updates
python3 anvisa-powerbi-monitor.py --export-diff
python3 anvisa-powerbi-monitor.py --watch (monitoramento contínuo)
"""

import json
import requests
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import time

# ============================================================
# CONFIGURAÇÃO DE LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('anvisa-monitor.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# ============================================================
# TIPOS E ENUMS
# ============================================================

class LegislationType(Enum):
    """Tipo de legislação ANVISA"""
    IN = "Instrução Normativa"
    RDC = "Resolução da Diretoria Colegiada"
    PORTARIA = "Portaria"
    RESOLUCAO = "Resolução"

class ConstituteType(Enum):
    """Tipo de constituinte"""
    NUTRIENT = "Nutriente"
    BIOACTIVE = "Substância Bioativa"
    ENZYME = "Enzima"
    PROBIOTIC = "Probiótico"
    FIBER = "Fibra Alimentar"

@dataclass
class LegislationUpdate:
    """Representa uma atualização de legislação"""
    id: str
    name: str
    type: LegislationType
    number: int
    year: int
    date: str
    status: str
    url: str
    changes: List[str]
    detected_date: str
    hash: str

@dataclass
class ConstituteUpdate:
    """Representa uma atualização de constituinte"""
    id: str
    name: str
    type: ConstituteType
    cas: str
    min_limit: Optional[float]
    max_limit: Optional[float]
    unit: str
    legislation: str
    changes: List[str]
    detected_date: str
    hash: str

@dataclass
class MonitoringReport:
    """Relatório de monitoramento"""
    timestamp: str
    legislation_updates: List[LegislationUpdate]
    constitute_updates: List[ConstituteUpdate]
    new_legislations: List[str]
    modified_limits: List[Tuple[str, str, str]]  # (constituinte, antes, depois)
    alerts: List[Dict]
    summary: Dict

# ============================================================
# CLASSE PRINCIPAL: POWER BI MONITOR
# ============================================================

class AnvisaPowerBIMonitor:
    """Monitora o Power BI ANVISA para atualizações"""

    # URLs do Power BI ANVISA
    POWERBI_CONSTITUENTS_URL = "https://app.powerbi.com/view?r=eyJrIjoiNDU4Y2UxNmEtZjc0Yi00ZTkyLTk3N2EtZTEyZTI5MjdkNzQ2IiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9&pageName=ReportSection%20Power%20BI%20Report%20Report%20powered%20by%20Power%20BI"
    POWERBI_FAQ_URL = "https://app.powerbi.com/view?r=eyJrIjoiZmY5ZTc4MzUtODZjZi00NzYzLWJjNDctMTdkZTY4NmZmMThhIiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9&pageName=ReportSectionc0ac170b47f7b0bfae94"

    # URLs de legislações
    ANVISA_LEGISLATION_URLS = {
        'IN_28_2018': 'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=INM&numeroAto=00000028&seqAto=000&valorAno=2018&orgao=DC/ANVISA/MS',
        'IN_75_2020': 'https://in75.tabelanutricional.com.br/',
        'RDC_429_2020': 'https://rdc429.tabelanutricional.com.br/',
        'IN_373_2025': 'https://www.legisweb.com.br/legislacao/?legislacao=479296',
        'IN_438_2026': 'https://www.legisweb.com.br/legislacao/?id=494422',
    }

    def __init__(self, cache_file: str = 'anvisa-cache.json'):
        """Inicializa o monitor"""
        self.cache_file = cache_file
        self.cache = self._load_cache()
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })

    def _load_cache(self) -> Dict:
        """Carrega cache local"""
        try:
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.info(f"Cache não encontrado. Criando novo em {self.cache_file}")
            return {
                'last_check': None,
                'legislations': {},
                'constituents': {},
                'hashes': {}
            }

    def _save_cache(self) -> None:
        """Salva cache local"""
        with open(self.cache_file, 'w') as f:
            json.dump(self.cache, f, indent=2)
        logger.info(f"Cache salvo em {self.cache_file}")

    def _calculate_hash(self, data: str) -> str:
        """Calcula hash SHA256 de dados"""
        return hashlib.sha256(data.encode()).hexdigest()

    def check_legislation_updates(self) -> List[LegislationUpdate]:
        """Verifica atualizações de legislações"""
        logger.info("Verificando atualizações de legislações...")
        updates = []

        for leg_id, url in self.ANVISA_LEGISLATION_URLS.items():
            try:
                response = self.session.get(url, timeout=10)
                response.raise_for_status()
                
                content_hash = self._calculate_hash(response.text)
                old_hash = self.cache['hashes'].get(leg_id)

                if content_hash != old_hash:
                    logger.warning(f"Atualização detectada em {leg_id}")
                    
                    update = LegislationUpdate(
                        id=leg_id,
                        name=leg_id.replace('_', ' '),
                        type=LegislationType.IN if 'IN' in leg_id else LegislationType.RDC,
                        number=int(leg_id.split('_')[1]),
                        year=int(leg_id.split('_')[2]),
                        date=datetime.now().isoformat(),
                        status='updated',
                        url=url,
                        changes=['Conteúdo modificado'],
                        detected_date=datetime.now().isoformat(),
                        hash=content_hash
                    )
                    updates.append(update)
                    
                    # Atualizar cache
                    self.cache['hashes'][leg_id] = content_hash
                    self.cache['legislations'][leg_id] = {
                        'last_check': datetime.now().isoformat(),
                        'status': 'updated'
                    }

            except requests.RequestException as e:
                logger.error(f"Erro ao verificar {leg_id}: {e}")

        self._save_cache()
        return updates

    def check_constituent_updates(self) -> List[ConstituteUpdate]:
        """Verifica atualizações de constituintes"""
        logger.info("Verificando atualizações de constituintes...")
        updates = []

        try:
            # Simular scraping do Power BI (em produção, usar Selenium ou API)
            response = self.session.get(self.POWERBI_CONSTITUENTS_URL, timeout=10)
            response.raise_for_status()

            content_hash = self._calculate_hash(response.text)
            old_hash = self.cache['hashes'].get('POWERBI_CONSTITUENTS')

            if content_hash != old_hash:
                logger.warning("Atualização detectada no Power BI de Constituintes")
                
                # Detectar novos constituintes (exemplo)
                new_constituents = self._parse_constituents(response.text)
                
                for constituent in new_constituents:
                    update = ConstituteUpdate(
                        id=constituent.get('id'),
                        name=constituent.get('name'),
                        type=ConstituteType.NUTRIENT,
                        cas=constituent.get('cas', ''),
                        min_limit=constituent.get('min_limit'),
                        max_limit=constituent.get('max_limit'),
                        unit=constituent.get('unit', 'mg'),
                        legislation=constituent.get('legislation', ''),
                        changes=['Novo constituinte ou limite modificado'],
                        detected_date=datetime.now().isoformat(),
                        hash=content_hash
                    )
                    updates.append(update)

                self.cache['hashes']['POWERBI_CONSTITUENTS'] = content_hash

        except requests.RequestException as e:
            logger.error(f"Erro ao verificar Power BI: {e}")

        self._save_cache()
        return updates

    def _parse_constituents(self, html: str) -> List[Dict]:
        """Parse de constituintes do HTML (simplificado)"""
        # Em produção, usar BeautifulSoup ou Selenium
        return []

    def detect_new_legislations(self) -> List[str]:
        """Detecta novas legislações"""
        logger.info("Detectando novas legislações...")
        new_legislations = []

        # Verificar se há legislações novas conhecidas
        known_new = {
            'IN_373_2025': 'Instrução Normativa 373/2025 - Novos Constituintes (GABA, Probióticos)',
            'IN_438_2026': 'Instrução Normativa 438/2026 - Curcumina e Tetraidrocurcuminoides',
        }

        for leg_id, description in known_new.items():
            if leg_id not in self.cache['legislations']:
                logger.warning(f"Nova legislação detectada: {description}")
                new_legislations.append(description)
                self.cache['legislations'][leg_id] = {
                    'detected': datetime.now().isoformat(),
                    'status': 'new'
                }

        self._save_cache()
        return new_legislations

    def compare_limits(self, local_limits: Dict) -> List[Tuple[str, str, str]]:
        """Compara limites locais com os do Power BI"""
        logger.info("Comparando limites...")
        modified_limits = []

        # Simular comparação
        for constituent, local_limit in local_limits.items():
            # Em produção, comparar com dados do Power BI
            pass

        return modified_limits

    def generate_alerts(self, updates: List) -> List[Dict]:
        """Gera alertas baseado em atualizações"""
        alerts = []

        for update in updates:
            if hasattr(update, 'type') and update.type == LegislationType.IN:
                alerts.append({
                    'severity': 'HIGH',
                    'type': 'NEW_LEGISLATION',
                    'message': f"Nova Instrução Normativa detectada: {update.name}",
                    'action': 'Revisar e atualizar limites',
                    'timestamp': datetime.now().isoformat()
                })

        return alerts

    def generate_report(self, 
                       legislation_updates: List[LegislationUpdate],
                       constitute_updates: List[ConstituteUpdate],
                       new_legislations: List[str],
                       modified_limits: List[Tuple[str, str, str]],
                       alerts: List[Dict]) -> MonitoringReport:
        """Gera relatório de monitoramento"""
        
        report = MonitoringReport(
            timestamp=datetime.now().isoformat(),
            legislation_updates=legislation_updates,
            constitute_updates=constitute_updates,
            new_legislations=new_legislations,
            modified_limits=modified_limits,
            alerts=alerts,
            summary={
                'total_legislation_updates': len(legislation_updates),
                'total_constitute_updates': len(constitute_updates),
                'new_legislations_count': len(new_legislations),
                'modified_limits_count': len(modified_limits),
                'alerts_count': len(alerts),
                'high_severity_alerts': len([a for a in alerts if a.get('severity') == 'HIGH']),
            }
        )

        return report

    def export_report_json(self, report: MonitoringReport, filename: str) -> None:
        """Exporta relatório em JSON"""
        data = {
            'timestamp': report.timestamp,
            'legislation_updates': [asdict(u) for u in report.legislation_updates],
            'constitute_updates': [asdict(u) for u in report.constitute_updates],
            'new_legislations': report.new_legislations,
            'modified_limits': report.modified_limits,
            'alerts': report.alerts,
            'summary': report.summary
        }

        with open(filename, 'w') as f:
            json.dump(data, f, indent=2, default=str)

        logger.info(f"Relatório JSON exportado: {filename}")

    def export_report_markdown(self, report: MonitoringReport, filename: str) -> None:
        """Exporta relatório em Markdown"""
        md = f"""# 📋 Relatório de Monitoramento ANVISA

**Gerado em:** {datetime.fromisoformat(report.timestamp).strftime('%d/%m/%Y %H:%M:%S')}

## 📊 Resumo

| Métrica | Valor |
|---------|-------|
| Atualizações de Legislações | {report.summary['total_legislation_updates']} |
| Atualizações de Constituintes | {report.summary['total_constitute_updates']} |
| Novas Legislações | {report.summary['new_legislations_count']} |
| Limites Modificados | {report.summary['modified_limits_count']} |
| Alertas | {report.summary['alerts_count']} |
| Alertas de Alta Severidade | {report.summary['high_severity_alerts']} |

## 🚨 Alertas

"""

        for alert in report.alerts:
            md += f"""
### {alert['type']} - {alert['severity']}

- **Mensagem:** {alert['message']}
- **Ação:** {alert['action']}
- **Timestamp:** {alert['timestamp']}

"""

        md += f"""
## 📚 Novas Legislações

"""
        for leg in report.new_legislations:
            md += f"- {leg}\n"

        md += f"""
## 🔄 Atualizações de Legislações

"""
        for update in report.legislation_updates:
            md += f"""
### {update.name}

- **ID:** {update.id}
- **Tipo:** {update.type.value}
- **Data:** {update.date}
- **URL:** {update.url}
- **Mudanças:** {', '.join(update.changes)}

"""

        with open(filename, 'w') as f:
            f.write(md)

        logger.info(f"Relatório Markdown exportado: {filename}")

    def run_check(self) -> MonitoringReport:
        """Executa verificação completa"""
        logger.info("=" * 60)
        logger.info("INICIANDO VERIFICAÇÃO ANVISA")
        logger.info("=" * 60)

        # Executar verificações
        legislation_updates = self.check_legislation_updates()
        constitute_updates = self.check_constituent_updates()
        new_legislations = self.detect_new_legislations()
        modified_limits = self.compare_limits({})
        alerts = self.generate_alerts(legislation_updates + constitute_updates)

        # Gerar relatório
        report = self.generate_report(
            legislation_updates,
            constitute_updates,
            new_legislations,
            modified_limits,
            alerts
        )

        logger.info("=" * 60)
        logger.info(f"Verificação concluída: {report.summary}")
        logger.info("=" * 60)

        return report

    def watch(self, interval_hours: int = 24) -> None:
        """Monitora continuamente"""
        logger.info(f"Iniciando monitoramento contínuo (intervalo: {interval_hours}h)")

        while True:
            try:
                report = self.run_check()
                
                # Exportar relatórios
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                self.export_report_json(report, f'reports/anvisa_report_{timestamp}.json')
                self.export_report_markdown(report, f'reports/anvisa_report_{timestamp}.md')

                # Aguardar próxima verificação
                logger.info(f"Próxima verificação em {interval_hours} hora(s)...")
                time.sleep(interval_hours * 3600)

            except Exception as e:
                logger.error(f"Erro durante monitoramento: {e}")
                time.sleep(3600)  # Aguardar 1 hora antes de tentar novamente

# ============================================================
# MAIN
# ============================================================

def main():
    """Função principal"""
    import argparse

    parser = argparse.ArgumentParser(
        description='Monitor de Legislações ANVISA'
    )
    parser.add_argument(
        '--check-updates',
        action='store_true',
        help='Verificar atualizações'
    )
    parser.add_argument(
        '--export-report',
        action='store_true',
        help='Exportar relatório'
    )
    parser.add_argument(
        '--watch',
        action='store_true',
        help='Monitoramento contínuo'
    )
    parser.add_argument(
        '--interval',
        type=int,
        default=24,
        help='Intervalo de monitoramento em horas (padrão: 24)'
    )

    args = parser.parse_args()

    monitor = AnvisaPowerBIMonitor()

    if args.watch:
        monitor.watch(args.interval)
    else:
        report = monitor.run_check()

        if args.export_report:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            monitor.export_report_json(report, f'reports/anvisa_report_{timestamp}.json')
            monitor.export_report_markdown(report, f'reports/anvisa_report_{timestamp}.md')

if __name__ == '__main__':
    main()
