/**
 * PROPOSTA do Grupo 5 para o contrato v0.2 — AINDA NÃO APROVADA.
 *
 * Tudo aqui é opcional e só complementa o contrato v0.1 (que continua sendo a fonte oficial).
 * O módulo funciona sem estes campos: quando faltam, mostra "N/D" em vez de inventar valores.
 * Discussão: campos necessários para calcular OEE e seguir a peça entre estações.
 */
import type { EventEnvelope, ISODateTime } from "./contrato-smart40-v0.1";

/** Campos extras propostos para `expedition.metrics.data` */
export interface ExpeditionMetricsExtrasV02 {
  approvedTotal?: number;
  rejectedTotal?: number;
  currentOrderCode?: string;
}

/** Parâmetros do turno — sem eles não existe Disponibilidade nem Performance */
export type ShiftConfigEvent = EventEnvelope<
  "expedition.shift-config",
  {
    shiftId: string;
    shiftStart: ISODateTime;
    /** tempo planejado de produção do turno, em ms */
    plannedProductionMs: number;
    /** tempo de ciclo ideal por peça, em ms */
    idealCycleTimeMs: number;
  }
>;

/** Peça saiu da esteira e entrou na expedição */
export type PieceDispatchedEvent = EventEnvelope<
  "expedition.piece-dispatched",
  { pieceId: string; orderCode?: string; palletCount: number }
>;
