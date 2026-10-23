import type { ConsoleState } from "../domain/store";
import { fmtInt, TONE_TEXT, type Tone } from "./ui";

interface Step {
  name: string;
  owner: string;
  href: string;
  tone: Tone;
  state: string;
  detail: string;
}

/**
 * A linha de produção em uma faixa só, na ordem em que a peça percorre a bancada (C1).
 * Cada etapa leva à tela do grupo responsável — o console só resume, não comanda.
 */
export function LineStrip({ state, stale }: { state: ConsoleState; stale: boolean }) {
  const m = state.machine?.data;
  const r = state.robot?.data;
  const s = state.lastScan?.data;
  const e = state.expedition?.data;
  const waiting = (name: string, owner: string, href: string): Step => ({ name, owner, href, tone: "inativo", state: "Sem dados", detail: "Aguardando o primeiro evento" });
  const machineAbnormal = !!m && (m.emergencyActive || ["ALARM", "EMERGENCY", "SAFETY_FAULT"].includes(m.status));
  const running = !!m && m.status === "RUNNING" && !m.emergencyActive;

  const steps: Step[] = [
    m
      ? {
          name: "IHM",
          owner: "Grupo 2",
          href: "/ihm",
          tone: machineAbnormal ? "alarme" : running ? "normal" : "atencao",
          state: m.emergencyActive ? "Emergência" : running ? "Produzindo" : m.status === "IDLE" ? "Parada" : m.status === "MAINTENANCE" ? "Manutenção" : m.status === "UNKNOWN" ? "Desconhecido" : "Alarme",
          detail: m.mode === "AUTOMATIC" ? "Modo automático" : m.mode === "MANUAL" ? "Modo manual" : "Modo manutenção",
        }
      : waiting("IHM", "Grupo 2", "/ihm"),
    r
      ? {
          name: "Robô",
          owner: "Grupo 3",
          href: "/robo",
          tone: r.programStatus === "FAULT" ? "alarme" : r.programStatus === "RUNNING" ? "normal" : "atencao",
          state: r.programStatus === "FAULT" ? "Falha" : r.programStatus === "RUNNING" ? "Executando" : r.programStatus === "PAUSED" ? "Pausado" : r.programStatus === "IDLE" ? "Parado" : "Desconhecido",
          detail: `Garra ${r.gripper === "CLOSED" ? "fechada" : r.gripper === "OPEN" ? "aberta" : "sem leitura"}`,
        }
      : waiting("Robô", "Grupo 3", "/robo"),
    s
      ? {
          name: "QR Code",
          owner: "Grupo 4",
          href: "/rastreabilidade",
          tone: s.result === "REJECTED" ? "atencao" : "normal",
          state: s.result === "APPROVED" ? "Aprovada" : s.result === "REJECTED" ? "Rejeitada" : "Em inspeção",
          detail: s.pieceId,
        }
      : waiting("QR Code", "Grupo 4", "/rastreabilidade"),
    m
      ? {
          name: "Esteira",
          owner: "estimado pela IHM",
          href: "/ihm",
          tone: running ? "normal" : "atencao",
          state: running ? "Em movimento" : "Parada",
          detail: "Estimado pelo estado da máquina",
        }
      : waiting("Esteira", "estimado pela IHM", "/ihm"),
    e
      ? {
          name: "Expedição",
          owner: "Grupo 5",
          href: "/expedicao",
          tone: e.pallet && e.pallet.currentCount >= e.pallet.capacity ? "atencao" : "normal",
          state: e.pallet && e.pallet.currentCount >= e.pallet.capacity ? "Palete cheio" : "Recebendo",
          detail: `${fmtInt(e.outputQueue)} na fila`,
        }
      : waiting("Expedição", "Grupo 5", "/expedicao"),
  ];

  return (
    <nav aria-label="Linha de produção" className="exp:rounded-xl exp:bg-smart-surface exp:px-5 exp:py-4">
      <ol className="exp:m-0 exp:grid exp:list-none exp:grid-cols-2 exp:gap-x-4 exp:gap-y-5 exp:p-0 exp:sm:grid-cols-3 exp:lg:grid-cols-5">
        {steps.map((st, i) => {
          const tone: Tone = stale ? "inativo" : st.tone;
          return (
            <li key={st.name} className="exp:relative exp:min-w-0">
              {i < steps.length - 1 ? (
                <span aria-hidden="true" className="exp:absolute exp:top-[7px] exp:left-5 exp:right-0 exp:hidden exp:h-px exp:bg-smart-line exp:lg:block" />
              ) : null}
              <a href={st.href} title={`Abrir a tela da ${st.name} (${st.owner})`} className="exp:group exp:relative exp:block exp:rounded-lg exp:no-underline">
                <span className="exp:relative exp:z-10 exp:inline-flex exp:bg-smart-surface exp:pr-2">
                  <span className={`exp:inline-block exp:h-3.5 exp:w-3.5 exp:rounded-full exp:border-2 exp:border-smart-surface ${tone === "normal" ? "exp:bg-smart-ok" : tone === "atencao" ? "exp:bg-smart-warn" : tone === "alarme" ? "exp:bg-smart-danger" : "exp:bg-smart-off"}`} />
                </span>
                <span className="exp:mt-2 exp:block exp:text-sm exp:text-smart-text2 exp:group-hover:text-smart-text">{st.name}</span>
                <span className={`exp:mt-0.5 exp:block exp:text-lg exp:font-semibold ${tone === "normal" ? "exp:text-smart-text" : TONE_TEXT[tone]}`}>{stale ? "Sem atualização" : st.state}</span>
                <span className="exp:mt-0.5 exp:block exp:truncate exp:text-sm exp:text-smart-muted">{st.detail}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

