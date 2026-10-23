import { useMemo } from "react";
import { ExpeditionPanel } from "./components/ExpeditionPanel";
import { Feed } from "./components/Feed";
import { LineStrip } from "./components/LineStrip";
import { OrdersTable } from "./components/OrdersTable";
import { PerformancePanel } from "./components/PerformancePanel";
import { SimPanel } from "./components/SimPanel";
import { fmtTime } from "./components/ui";
import { ChartsPanel } from "./components/ChartsPanel";
import { calcularOee, ppmJanela } from "./domain/oee";
import { effectiveConnection, statusTimes } from "./domain/store";
import { useConsole } from "./domain/useConsole";
import { SHIFT_CONFIG_HIPOTETICO } from "./mocks/fixtures";
import type { MockProducer } from "./mocks/mockProducer";

/** Só existe no modo isolado (npm run dev): qual fonte de dados está fazendo o papel do App Shell */
export interface StandaloneInfo {
  fonte: "interno" | "professor";
  mock?: MockProducer;
  wsUrl?: string;
}

const CONN: Record<string, { dot: string; label: string }> = {
  CONNECTED: { dot: "exp:bg-smart-ok", label: "Conectado" },
  CONNECTING: { dot: "exp:bg-smart-warn", label: "Conectando" },
  STALE: { dot: "exp:bg-smart-warn", label: "Sem atualização" },
  DISCONNECTED: { dot: "exp:bg-smart-danger", label: "Desconectado" },
  UNKNOWN: { dot: "exp:bg-smart-off", label: "Aguardando o App Shell" },
};

export interface AppProps {
  /** onde o barramento `smart40:*` é publicado (padrão: window) */
  bus?: EventTarget;
  /** presente só no modo isolado: a fonte de dados e os controles de teste */
  standalone?: StandaloneInfo;
}

export function App({ bus, standalone }: AppProps) {
  const { state, now, sendCommand, resetCounters } = useConsole(bus);
  const conn = effectiveConnection(state, now);
  const stale = conn === "STALE" || conn === "DISCONNECTED";
  const emergency = !!state.machine?.data.emergencyActive;

  const times = statusTimes(state, now);
  const runningMs = times.RUNNING ?? 0;
  const elapsedMs = Object.values(times).reduce((s, v) => s + (v ?? 0), 0);
  const oee = useMemo(
    () => calcularOee({ runningMs, elapsedMs, produced: state.session.produced, approved: state.session.approved, idealCycleTimeMs: SHIFT_CONFIG_HIPOTETICO.idealCycleTimeMs }),
    [runningMs, elapsedMs, state.session.produced, state.session.approved],
  );
  const ppm = ppmJanela(state.scanTimes, now, state.sessionStart);

  // Runbook: sem conexão, com dado vencido ou em emergência, os comandos simulados ficam bloqueados
  const blockReason = conn === "DISCONNECTED" ? "sem conexão" : stale ? "dados desatualizados" : emergency ? "emergência ativa" : conn !== "CONNECTED" ? "aguardando conexão" : undefined;
  const canCommand = !blockReason;
  const lastAt = state.machine ? new Date(state.machine.at).toISOString() : null;

  return (
    <div className="expedicao-oee-scope exp:min-h-full exp:px-4 exp:py-6 exp:md:px-8">
      <div className="exp:mx-auto exp:max-w-[1400px]">
        <header className="exp:mb-6 exp:flex exp:flex-wrap exp:items-end exp:justify-between exp:gap-4">
          <div>
            <h1 className="exp:text-2xl exp:font-semibold exp:tracking-tight exp:text-smart-text">Console de produção</h1>
            <p className="exp:mt-1 exp:text-sm exp:text-smart-text2">Bancada SMART 4.0, da partida na IHM à saída na expedição. {standalone?.fonte === "professor" ? "Dados do simulador do professor (WebSocket)." : "Dados simulados."}</p>
          </div>
          <div className="exp:flex exp:items-center exp:gap-2 exp:text-sm" title={state.latencyMs !== undefined ? `Latência ${state.latencyMs} ms` : undefined}>
            <span aria-hidden="true" className={`exp:inline-block exp:h-2 exp:w-2 exp:rounded-full ${CONN[conn].dot}`} />
            <span className="exp:text-smart-text">{CONN[conn].label}</span>
            {lastAt ? <span className="exp:text-smart-muted">atualizado às {fmtTime(lastAt)}</span> : null}
          </div>
        </header>

        {emergency ? (
          <div role="alert" className="exp:mb-6 exp:rounded-xl exp:bg-smart-danger exp:px-5 exp:py-4 exp:text-white">
            <p className="exp:text-lg exp:font-semibold">Parada de emergência acionada</p>
            <p className="exp:mt-0.5 exp:text-sm exp:opacity-90">Comandos bloqueados até o reset na IHM. Este aviso é simulado e não substitui o botão físico.</p>
          </div>
        ) : conn === "DISCONNECTED" ? (
          <div role="alert" className="exp:mb-6 exp:rounded-xl exp:border exp:border-smart-danger exp:px-5 exp:py-4 exp:text-smart-text">
            <p className="exp:font-semibold exp:text-smart-danger">Conexão perdida</p>
            <p className="exp:mt-0.5 exp:text-sm exp:text-smart-text2">Tentando reconectar. Os números abaixo são os últimos recebidos.</p>
          </div>
        ) : conn === "STALE" ? (
          <div role="status" className="exp:mb-6 exp:rounded-xl exp:border exp:border-smart-warn exp:px-5 exp:py-3 exp:text-sm exp:text-smart-warn">
            Nenhuma atualização da máquina nos últimos segundos.
          </div>
        ) : null}

        <LineStrip state={state} stale={stale} />

        <div className="exp:mt-6 exp:grid exp:grid-cols-1 exp:gap-6 exp:lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className={`exp:flex exp:min-w-0 exp:flex-col exp:gap-6 ${stale ? "exp:opacity-60" : ""}`}>
            <div className="exp:grid exp:grid-cols-1 exp:gap-6 exp:xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <PerformancePanel state={state} oee={oee} times={times} runningMs={runningMs} idealCycleTimeMs={SHIFT_CONFIG_HIPOTETICO.idealCycleTimeMs} ppm={ppm} onReset={resetCounters} />
              <ExpeditionPanel state={state} canCommand={canCommand} blockReason={blockReason} send={(a) => sendCommand(a)} />
            </div>
            <ChartsPanel state={state} />
            <OrdersTable state={state} canCommand={canCommand} blockReason={blockReason} send={sendCommand} />
          </div>
          <Feed items={state.feed} />
        </div>

        <footer className="exp:mt-8 exp:text-xs exp:text-smart-muted">
          Sprint 2, contrato v0.1.0. Nenhum comando físico configurado.
          {state.invalidCount > 0 ? ` ${state.invalidCount} dado(s) inválido(s) descartado(s).` : ""}
        </footer>
      </div>

      {standalone ? <SimPanel standalone={standalone} /> : null}
    </div>
  );
}
