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

export const PPM_WINDOW_MS = 60_000;
/** abaixo disso a amostra é pequena demais para falar em "peças por minuto" */
export const PPM_MIN_WINDOW_MS = 10_000;

/**
 * Sprint 2 — Peças Por Minuto (PPM) calculado pelo próprio console, em janela móvel de 60 s:
 * PPM = peças inspecionadas nos últimos 60 s ÷ 1 min.
 * No começo da sessão (menos de 60 s) a janela é o tempo que já passou; com menos de 10 s → null (N/D).
 * Não usamos o ritmo que vem pronto do simulador do professor porque ele é um valor fixo (12,4).
 */
export function ppmJanela(scanTimes: number[], now: number, sessionStart: number): number | null {
  const window = Math.min(PPM_WINDOW_MS, now - sessionStart);
  if (window < PPM_MIN_WINDOW_MS) return null;
  const from = now - window;
  const count = scanTimes.filter((t) => t > from && t <= now).length;
  return count / (window / 60_000);
}
