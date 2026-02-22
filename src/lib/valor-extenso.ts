/**
 * Converte um valor numérico em reais para texto por extenso em português.
 * Ex: 26400.00 → "VINTE E SEIS MIL E QUATROCENTOS REAIS"
 */

const UNIDADES = ['', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE'];
const ESPECIAIS = ['DEZ', 'ONZE', 'DOZE', 'TREZE', 'QUATORZE', 'QUINZE', 'DEZESSEIS', 'DEZESSETE', 'DEZOITO', 'DEZENOVE'];
const DEZENAS = ['', '', 'VINTE', 'TRINTA', 'QUARENTA', 'CINQUENTA', 'SESSENTA', 'SETENTA', 'OITENTA', 'NOVENTA'];
const CENTENAS = ['', 'CENTO', 'DUZENTOS', 'TREZENTOS', 'QUATROCENTOS', 'QUINHENTOS', 'SEISCENTOS', 'SETECENTOS', 'OITOCENTOS', 'NOVECENTOS'];

function grupoParaExtenso(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'CEM';

  const partes: string[] = [];
  const centena = Math.floor(n / 100);
  const resto = n % 100;
  const dezena = Math.floor(resto / 10);
  const unidade = resto % 10;

  if (centena > 0) partes.push(CENTENAS[centena]);

  if (resto >= 10 && resto <= 19) {
    partes.push(ESPECIAIS[resto - 10]);
  } else {
    if (dezena > 0) partes.push(DEZENAS[dezena]);
    if (unidade > 0) partes.push(UNIDADES[unidade]);
  }

  return partes.join(' E ');
}

export function valorPorExtenso(valor: number): string {
  if (valor === 0) return 'ZERO REAIS';

  const inteiro = Math.floor(Math.abs(valor));
  const centavos = Math.round((Math.abs(valor) - inteiro) * 100);

  const grupos: number[] = [];
  let temp = inteiro;
  while (temp > 0) {
    grupos.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const sufixos = [
    ['', ''],
    ['MIL', 'MIL'],
    ['MILHÃO', 'MILHÕES'],
    ['BILHÃO', 'BILHÕES'],
  ];

  const partes: string[] = [];
  for (let i = grupos.length - 1; i >= 0; i--) {
    if (grupos[i] === 0) continue;
    const texto = grupoParaExtenso(grupos[i]);
    const sufixo = i === 0 ? '' : (grupos[i] === 1 ? sufixos[i][0] : sufixos[i][1]);
    partes.push(sufixo ? `${texto} ${sufixo}` : texto);
  }

  let resultado = partes.join(' E ');

  if (inteiro === 1) {
    resultado += ' REAL';
  } else if (inteiro > 0) {
    resultado += ' REAIS';
  }

  if (centavos > 0) {
    const centavosTexto = grupoParaExtenso(centavos);
    if (inteiro > 0) resultado += ' E ';
    resultado += centavos === 1 ? `${centavosTexto} CENTAVO` : `${centavosTexto} CENTAVOS`;
  }

  return resultado;
}
