import { ORDERS_MOCK } from "../mocks/fixtures";
import { nomeArquivoCsv, ordensParaCsv } from "./csv";

describe("exportação CSV das ordens", () => {
  const csv = ordensParaCsv(ORDERS_MOCK);
  const linhas = csv.replace("﻿", "").trimEnd().split("\r\n");

  it("começa com BOM para o Excel ler os acentos", () => {
    expect(csv.startsWith("﻿")).toBe(true);
  });
  it("tem cabeçalho e situação em português, separados por ponto e vírgula", () => {
    expect(linhas[0]).toBe("Ordem;Produto;Código do produto;Quantidade;Destino;Entrega;Prioridade;Situação");
    expect(linhas).toHaveLength(ORDERS_MOCK.length + 1);
    expect(linhas[1]).toMatch(/^OP-2026-0141;Caixa montada A;SM40-CX-A;24;Doca 1;\d{2}\/10\/2026 \d{2}:\d{2};1;Em produção$/);
  });
  it("põe aspas em texto com ponto e vírgula", () => {
    const [, l] = ordensParaCsv([{ ...ORDERS_MOCK[0], productName: 'Caixa "A"; especial' }]).trimEnd().split("\r\n");
    expect(l).toContain('"Caixa ""A""; especial"');
  });
  it("nome do arquivo com data e hora da exportação", () => {
    expect(nomeArquivoCsv(new Date(2026, 9, 23, 19, 56))).toBe("ordens-expedicao_23-10-2026_19h56.csv");
  });
});
