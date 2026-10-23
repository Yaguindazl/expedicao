/**
 * Exportação das ordens em CSV, pronta para abrir no Excel em português:
 *  - BOM UTF-8 no começo: sem ele o Excel mostra "PRODUÃ‡ÃƒO" no lugar de "PRODUÇÃO";
 *  - ponto e vírgula como separador (padrão do Excel no Brasil);
 *  - cabeçalhos, datas (dd/mm/aaaa hh:mm) e situação em português;
 *  - quebra de linha do Windows (CRLF);
 *  - nome do arquivo com a data e a hora da exportação.
 */
import type { OrderStatus, ProductionOrderMock } from "../mocks/fixtures";

const BOM = "﻿";
const SEP = ";";
const EOL = "\r\n";

const SITUACAO: Record<OrderStatus, string> = { "EM PRODUÇÃO": "Em produção", "NA FILA": "Na fila", LIBERADA: "Liberada", CONCLUÍDA: "Concluída" };

const COLUNAS: { titulo: string; valor: (o: ProductionOrderMock) => string | number }[] = [
  { titulo: "Ordem", valor: (o) => o.code },
  { titulo: "Produto", valor: (o) => o.productName },
  { titulo: "Código do produto", valor: (o) => o.productCode },
  { titulo: "Quantidade", valor: (o) => o.quantity },
  { titulo: "Destino", valor: (o) => o.destination },
  { titulo: "Entrega", valor: (o) => dataHora(new Date(o.dueDate)) },
  { titulo: "Prioridade", valor: (o) => o.priority },
  { titulo: "Situação", valor: (o) => SITUACAO[o.status] ?? o.status },
];

const dois = (n: number) => String(n).padStart(2, "0");

/** 23/10/2026 19:56 (horário local) */
export function dataHora(d: Date): string {
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${d.getFullYear()} ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** Coloca aspas quando o texto tem ; aspas ou quebra de linha (regra do CSV) */
function celula(v: string | number): string {
  const s = String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ordensParaCsv(ordens: ProductionOrderMock[]): string {
  const linhas = [COLUNAS.map((c) => c.titulo), ...ordens.map((o) => COLUNAS.map((c) => c.valor(o)))];
  return BOM + linhas.map((l) => l.map(celula).join(SEP)).join(EOL) + EOL;
}

/** ordens-expedicao_23-10-2026_19h56.csv */
export function nomeArquivoCsv(agora: Date): string {
  return `ordens-expedicao_${dois(agora.getDate())}-${dois(agora.getMonth() + 1)}-${agora.getFullYear()}_${dois(agora.getHours())}h${dois(agora.getMinutes())}.csv`;
}
