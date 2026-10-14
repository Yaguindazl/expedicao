/**
 * Cálculo do OEE — PROTÓTIPO.
 * Função pura (sem React, sem relógio), para poder ser testada isoladamente.
 *
 *   OEE = Disponibilidade × Performance × Qualidade
 *   Disponibilidade = tempo em RUNNING / tempo decorrido
 *   Performance     = (peças produzidas × ciclo ideal) / tempo em RUNNING
 *   Qualidade       = peças aprovadas / peças produzidas
 *
 * O runbook proíbe apresentar OEE como medição real enquanto a fórmula e os sinais não forem
 * aprovados: a tela sempre mostra este resultado com o selo "PROTÓTIPO".
 */

export interface OeeInput {
  runningMs: number;
  elapsedMs: number;
  produced: number;
  approved: number;
  idealCycleTimeMs: number;
}

export interface OeeResult {
  availability: number | null;
  performance: number | null;
  quality: number | null;
  oee: number | null;
  /** true quando a performance passou de 100% (ciclo ideal provavelmente mal configurado) */
  performanceCapped: boolean;
}

const ratio = (num: number, den: number) => (den > 0 ? num / den : null);

export function calcularOee(i: OeeInput): OeeResult {
  const availability = ratio(i.runningMs, i.elapsedMs);
  const rawPerf = ratio(i.produced * i.idealCycleTimeMs, i.runningMs);
  const performanceCapped = rawPerf !== null && rawPerf > 1;
  const performance = rawPerf === null ? null : Math.min(rawPerf, 1);
  const quality = ratio(i.approved, i.produced);
  const oee =
    availability !== null && performance !== null && quality !== null ? availability * performance * quality : null;
  return { availability, performance, quality, oee, performanceCapped };
}

/** Taxa de refugo = rejeitadas / produzidas */
export const taxaRefugo = (rejected: number, produced: number) => ratio(rejected, produced);

/** MTBF = tempo em operação / nº de falhas (entradas em ALARM, EMERGENCY ou SAFETY_FAULT) */
export const mtbfMs = (runningMs: number, failures: number) => (failures > 0 ? runningMs / failures : null);
