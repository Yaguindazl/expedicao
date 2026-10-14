/**
 * Fixtures MOCK — valores sintéticos, NÃO são da Planta N2.
 * Os nomes dos campos das ordens espelham o Swagger da F4 API (ProductionOrderViewModel),
 * para não precisar renomear quando a integração real for aprovada.
 */

export type OrderStatus = "EM PRODUÇÃO" | "NA FILA" | "LIBERADA" | "CONCLUÍDA";

export interface ProductionOrderMock {
  code: string;
  productCode: string;
  productName: string;
  priority: number;
  dueDate: string; // ISO 8601
  destination: string;
  quantity: number;
  status: OrderStatus;
}

export const ORDERS_MOCK: ProductionOrderMock[] = [
  { code: "OP-2026-0141", productCode: "SM40-CX-A", productName: "Caixa montada A", priority: 1, dueDate: "2026-10-14T18:00:00Z", destination: "Doca 1", quantity: 24, status: "EM PRODUÇÃO" },
  { code: "OP-2026-0142", productCode: "SM40-CX-B", productName: "Caixa montada B", priority: 2, dueDate: "2026-10-15T18:00:00Z", destination: "Doca 2", quantity: 12, status: "EM PRODUÇÃO" },
  { code: "OP-2026-0143", productCode: "SM40-CX-A", productName: "Caixa montada A", priority: 3, dueDate: "2026-10-16T18:00:00Z", destination: "Estoque", quantity: 36, status: "NA FILA" },
  { code: "OP-2026-0144", productCode: "SM40-CX-C", productName: "Caixa montada C", priority: 4, dueDate: "2026-10-17T18:00:00Z", destination: "Doca 1", quantity: 12, status: "NA FILA" },
];

/**
 * Parâmetros HIPOTÉTICOS do turno para o protótipo de OEE.
 * Precisam ser substituídos pelos valores aprovados pelo responsável técnico (proposta v0.2: expedition.shift-config).
 */
export const SHIFT_CONFIG_HIPOTETICO = {
  idealCycleTimeMs: 3_500,
};
