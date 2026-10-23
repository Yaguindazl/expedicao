import { useEffect, useState } from "react";
import type { MachineStatus } from "../contracts/contrato-smart40-v0.1";
import { mtbfMs, taxaRefugo, type OeeResult } from "../domain/oee";
import type { ConsoleState } from "../domain/store";
import { fmtDec, fmtDur, fmtInt, fmtPct, MockTag, Section, Stat } from "./ui";

/**
 * Sprint 2 — "função de reset dos contadores". Dois cliques (sem janela do navegador, que trava o Shell):
 * o primeiro pede confirmação por 4 s, o segundo zera. Só zera a tela; nada vai para a máquina.
 */
function ResetButton({ onReset }: { onReset: () => void }) {
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(false), 4_000);
    return () => clearTimeout(t);
  }, [confirm]);
  return (
    <button
      type="button"
      onClick={() => {
        if (confirm) {
          onReset();
          setConfirm(false);
        } else setConfirm(true);
      }}
      title="Zera peças, tempos, falhas e gráficos desta tela. Não envia nada para a máquina."
      className={`exp:cursor-pointer exp:rounded-md exp:border exp:px-2.5 exp:py-1 exp:text-xs exp:font-medium exp:transition-colors ${
        confirm ? "exp:border-smart-warn exp:bg-transparent exp:text-smart-warn" : "exp:border-smart-line exp:bg-transparent exp:text-smart-text2 exp:hover:text-smart-text"
      }`}
    >
      {confirm ? "Confirmar: zerar?" : "Zerar contadores"}
    </button>
  );
}

const STATE_COLOR: Record<MachineStatus, string> = {
  RUNNING: "var(--smart-status-ok)",
  IDLE: "var(--smart-status-off)",
  MAINTENANCE: "var(--smart-accent-primary)",
  ALARM: "var(--smart-status-warning)",
  EMERGENCY: "var(--smart-status-danger)",
  SAFETY_FAULT: "var(--smart-status-danger)",
  UNKNOWN: "var(--smart-text-muted)",
};
const STATE_PT: Record<MachineStatus, string> = {
  RUNNING: "Produzindo",
  IDLE: "Parada",
  MAINTENANCE: "Manutenção",
  ALARM: "Alarme",
  EMERGENCY: "Emergência",
  SAFETY_FAULT: "Falha de segurança",
  UNKNOWN: "Desconhecido",
};

function Factor({ label, value, hint }: { label: string; value: number | null; hint: string }) {
  return (
    <div title={hint}>
      <div className="exp:flex exp:items-baseline exp:justify-between exp:text-sm">
        <span className="exp:text-smart-text2">{label}</span>
        <span className="exp:font-medium exp:text-smart-text">{fmtPct(value)}</span>
      </div>
      <div className="exp:mt-1.5 exp:h-1.5 exp:w-full exp:overflow-hidden exp:rounded-full exp:bg-smart-raised">
        <div className="exp:h-full exp:rounded-full exp:bg-smart-primary exp:transition-[width] exp:duration-500" style={{ width: `${(value ?? 0) * 100}%` }} />
      </div>
    </div>
  );
}

/** Distribuição do tempo por estado: uma barra única, mais fácil de ler que uma pizza pequena (R4). */
function TimeBar({ times }: { times: Partial<Record<MachineStatus, number>> }) {
  const entries = (Object.entries(times) as [MachineStatus, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  return (
    <div>
      <div className="exp:flex exp:items-baseline exp:justify-between exp:text-sm">
        <span className="exp:text-smart-text2">Tempo da sessão</span>
        <span className="exp:text-smart-text2">{fmtDur(total)}</span>
      </div>
      <div className="exp:mt-2 exp:flex exp:h-2.5 exp:w-full exp:overflow-hidden exp:rounded-full exp:bg-smart-raised" role="img" aria-label="Distribuição do tempo por estado da máquina">
        {entries.map(([st, v]) => (
          <div key={st} style={{ width: `${(v / total) * 100}%`, background: STATE_COLOR[st] }} />
        ))}
      </div>
      <ul className="exp:m-0 exp:mt-2 exp:flex exp:list-none exp:flex-wrap exp:gap-x-4 exp:gap-y-1 exp:p-0 exp:text-sm">
        {entries.map(([st, v]) => (
          <li key={st} className="exp:flex exp:items-center exp:gap-1.5">
            <span aria-hidden="true" className="exp:inline-block exp:h-2 exp:w-2 exp:rounded-full" style={{ background: STATE_COLOR[st] }} />
            <span className="exp:text-smart-text2">{STATE_PT[st]}</span>
            <span className="exp:text-smart-text">{fmtPct(v / total, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Desempenho: o OEE em destaque, seus três fatores logo ao lado e os números de produção embaixo.
 * O OEE é PROTÓTIPO (runbook): fórmula e ciclo ideal ainda não aprovados.
 */
export function PerformancePanel({
  state,
  oee,
  times,
  runningMs,
  idealCycleTimeMs,
  ppm,
  onReset,
}: {
  state: ConsoleState;
  oee: OeeResult;
  times: Partial<Record<MachineStatus, number>>;
  runningMs: number;
  idealCycleTimeMs: number;
  /** peças por minuto calculadas pelo console (janela de 60 s) */
  ppm: number | null;
  onReset: () => void;
}) {
  // Sprint 2: todos os números do painel usam a MESMA base (a sessão), para o reset zerar tudo junto
  const refugo = taxaRefugo(state.session.rejected, state.session.produced);
  const mtbf = mtbfMs(runningMs, state.failures);

  return (
    <Section
      title="Desempenho"
      aside={
        <div className="exp:flex exp:items-center exp:gap-2">
          <MockTag label={state.machine?.source === "gateway" ? "protótipo" : "protótipo, dados simulados"} />
          <ResetButton onReset={onReset} />
        </div>
      }
    >
      <div className="exp:grid exp:grid-cols-1 exp:items-center exp:gap-6 exp:sm:grid-cols-[auto_1fr]">
        <div title="OEE = Disponibilidade × Performance × Qualidade">
          <div className="exp:text-sm exp:text-smart-text2">OEE</div>
          <div className="exp:text-6xl exp:font-semibold exp:leading-none exp:tracking-tight exp:text-smart-text">{fmtPct(oee.oee)}</div>
        </div>
        <div className="exp:flex exp:flex-col exp:gap-3 exp:sm:border-l exp:sm:border-smart-line exp:sm:pl-6">
          <Factor label="Disponibilidade" value={oee.availability} hint="Tempo produzindo ÷ tempo decorrido" />
          <Factor label="Performance" value={oee.performance} hint={`Peças × ciclo ideal (${idealCycleTimeMs / 1000} s) ÷ tempo produzindo`} />
          <Factor label="Qualidade" value={oee.quality} hint="Peças aprovadas ÷ peças inspecionadas" />
        </div>
      </div>
      {oee.performanceCapped ? <p className="exp:mt-3 exp:text-sm exp:text-smart-warn">A performance passou de 100%: revise o ciclo ideal.</p> : null}

      <div className="exp:mt-6 exp:grid exp:grid-cols-2 exp:gap-x-6 exp:gap-y-5 exp:border-t exp:border-smart-line exp:pt-5 exp:md:grid-cols-4">
        <Stat label="Produzidas" value={fmtInt(state.session.produced)} unit="peças" origin="peças inspecionadas nesta sessão (traceability.piece-scanned, sem repetir a mesma peça)" />
        <Stat label="Ritmo (PPM)" value={fmtDec(ppm)} unit="por min" origin="calculado pelo console: peças inspecionadas nos últimos 60 s" />
        <Stat label="Refugo" value={fmtPct(refugo)} origin="peças rejeitadas ÷ peças inspecionadas nesta sessão" tone={refugo !== null && refugo > 0.1 ? "atencao" : "normal"} />
        <Stat label="Falhas" value={fmtInt(state.failures)} unit={state.failures > 0 ? `a cada ${fmtDur(mtbf)}` : "na sessão"} origin="histórico de machine.telemetry.status (MTBF = tempo produzindo ÷ falhas)" tone={state.failures > 0 ? "atencao" : "normal"} />
      </div>

      <div className="exp:mt-6">
        <TimeBar times={times} />
      </div>

      <p className="exp:mt-5 exp:text-xs exp:leading-relaxed exp:text-smart-muted">
        Calculado com {state.session.produced} peças inspecionadas nesta sessão e um ciclo ideal hipotético de {idealCycleTimeMs / 1000} s. Não é medição da Planta N2.
      </p>
    </Section>
  );
}
