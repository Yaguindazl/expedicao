/**
 * Tradutor da telemetria do simulador do professor (mock_server_smart40.js) — Sprint 2.
 *
 * O simulador manda, a cada 500 ms, UM objeto grande em português (estadoGlobal, roboUR,
 * ultimaPecaLida, metricasExpedicao). O App Shell do exemplo do professor repassa esse objeto
 * como `smart40:telemetria`. Este arquivo converte esse objeto nos eventos do nosso contrato
 * (machine.telemetry, robot.telemetry, traceability.piece-scanned, expedition.metrics),
 * para o resto do console continuar igual.
 *
 * O que o simulador NÃO manda fica de fora (aparece como N/D na tela, nunca como zero):
 * palete, ordens ativas e velocidade do robô.
 * O `oeePercentual` do simulador é fixo (88,5) — ignoramos e calculamos o nosso.
 */
import type {
  ExpeditionMetricsEvent,
  MachineStatus,
  MachineTelemetryEvent,
  OperatingMode,
  RobotTelemetryEvent,
  TraceabilityScanEvent,
} from "../contracts/contrato-smart40-v0.1";

export const TELEMETRIA_EVENT = "telemetria";

const ESTADO: Record<string, MachineStatus> = {
  EM_EXECUCAO: "RUNNING",
  PRONTA: "IDLE",
  PARADA_EMERGENCIA: "EMERGENCY",
};
const MODO: Record<string, OperatingMode> = {
  AUTOMATICO: "AUTOMATIC",
  MANUAL: "MANUAL",
  MANUTENCAO: "MAINTENANCE",
};

const isObj = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);

type Envelope = { schemaVersion: "0.1.0"; eventId: string; timestamp: string; source: "mock" };

/**
 * Converte um pacote de telemetria do professor em eventos do contrato.
 * Devolve `null` se o pacote nem tem o formato esperado (o chamador registra como inválido).
 * Os eventos devolvidos ainda passam pelo validate.ts antes de entrar no console.
 */
export function traduzirTelemetria(raw: unknown): unknown[] | null {
  if (!isObj(raw) || typeof raw.timestamp !== "string" || typeof raw.estadoGlobal !== "string") return null;
  const ts = raw.timestamp;
  const env = (type: string, id: string): Envelope & { type: string } => ({ schemaVersion: "0.1.0", eventId: `prof-${id}`, type, timestamp: ts, source: "mock" });
  const out: unknown[] = [];

  // 1) Máquina (IHM)
  const emergencia = raw.estadoGlobal === "PARADA_EMERGENCIA";
  const machine: MachineTelemetryEvent = {
    ...env("machine.telemetry", `mt-${ts}`),
    type: "machine.telemetry",
    data: {
      status: ESTADO[raw.estadoGlobal] ?? "UNKNOWN",
      mode: MODO[raw.modoOperacao] ?? "AUTOMATIC",
      emergencyActive: emergencia,
      safetyInterlockOk: !(isObj(raw.estacaoIhm) && raw.estacaoIhm.travaSegurancaAtiva === true),
      alarmCodes: [],
    },
  };
  out.push(machine);

  // 2) Robô UR
  const r = raw.roboUR;
  if (isObj(r) && isObj(r.posicaoJuntas) && isObj(r.posicaoCartesiana)) {
    const j = r.posicaoJuntas;
    const robot: Omit<RobotTelemetryEvent, "data"> & { data: Omit<RobotTelemetryEvent["data"], "speedPercent"> } = {
      ...env("robot.telemetry", `rb-${ts}`),
      type: "robot.telemetry",
      data: {
        jointAnglesDeg: [j.j1, j.j2, j.j3, j.j4, j.j5, j.j6],
        cartesianMm: { x: r.posicaoCartesiana.x, y: r.posicaoCartesiana.y, z: r.posicaoCartesiana.z },
        gripper: r.garraFechada === true ? "CLOSED" : r.garraFechada === false ? "OPEN" : "UNKNOWN",
        programStatus: r.executandoRotina === true ? "RUNNING" : r.conectado === false ? "UNKNOWN" : "IDLE",
        programName: typeof r.programaAtivo === "string" ? r.programaAtivo : undefined,
      },
    };
    out.push(robot);
  }

  // 3) Peça lida no QR Code — o simulador repete a mesma peça a cada 500 ms;
  //    o eventId fixo por peça + o dedupe por pieceId do store garantem que ela conta uma vez só.
  const p = raw.ultimaPecaLida;
  if (isObj(p) && typeof p.idPeca === "string") {
    const scan: TraceabilityScanEvent = {
      ...env("traceability.piece-scanned", `scan-${p.idPeca}`),
      type: "traceability.piece-scanned",
      data: {
        pieceId: p.idPeca,
        code: p.idPeca,
        lotId: typeof p.codigoLote === "string" ? p.codigoLote : undefined,
        scannedAt: typeof p.timestampLeitura === "string" ? p.timestampLeitura : ts,
        result: p.statusInspecao === "APROVADA" ? "APPROVED" : p.statusInspecao === "REJEITADA" ? "REJECTED" : "PENDING",
        reason: p.statusInspecao === "REJEITADA" && num(p.qualidadeSuperficie) !== undefined ? `qualidade da superfície ${p.qualidadeSuperficie.toLocaleString("pt-BR")}%` : undefined,
      },
    };
    out.push(scan);
  }

  // 4) Expedição — sem palete e sem ordens ativas (o simulador não tem esses dados)
  const m = raw.metricasExpedicao;
  if (isObj(m) && num(m.pecasProcessadasTotal) !== undefined) {
    const exp: Omit<ExpeditionMetricsEvent, "data"> & { data: Partial<ExpeditionMetricsEvent["data"]> & Record<string, unknown> } = {
      ...env("expedition.metrics", `ex-${ts}`),
      type: "expedition.metrics",
      data: {
        producedTotal: m.pecasProcessadasTotal,
        piecesPerMinute: num(m.ritmoProducaoPecasPorMinuto) ?? 0,
        outputQueue: num(m.tamanhoFilaSaida) ?? 0,
        approvedTotal: num(m.pecasAprovadasCount),
        rejectedTotal: num(m.pecasRejeitadasCount),
      },
    };
    out.push(exp);
  }
  return out;
}
