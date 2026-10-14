/**
 * Estado do console (reducer puro). Recebe eventos já validados e guarda só o necessário,
 * com limites de tamanho para não vazar memória na renderização contínua (DoD do Grupo 5).
 */
import type {
  CommandRequestedEvent,
  ConnectionState,
  EventSource,
  ExpeditionMetricsEvent,
  MachineStatus,
  MachineTelemetryEvent,
  RobotTelemetryEvent,
  Smart40Event,
  TraceabilityScanEvent,
} from "../contracts/contrato-smart40-v0.1";
import type { ExpeditionMetricsExtrasV02 } from "../contracts/proposta-g5-v0.2";
import { ORDERS_MOCK, type ProductionOrderMock } from "../mocks/fixtures";
import { narrate, QUEUE_HIGH, type FeedItem } from "./narrator";

export const FEED_LIMIT = 200;
export const SEEN_LIMIT = 500;
export const STALE_AFTER_MS = 3_000;
export const ACK_TIMEOUT_MS = 3_000;

interface Stamped<T> {
  data: T;
  at: number; // quando chegou (relógio local)
  source: EventSource;
}

export interface CommandEntry {
  commandId: string;
  action: string;
  sentAt: number;
  orderCode?: string;
  result?: "SIMULATED" | "ACCEPTED" | "REJECTED" | "TIMEOUT";
  message?: string;
}

export interface ConsoleState {
  sessionStart: number;
  connection: ConnectionState | "UNKNOWN";
  latencyMs?: number;
  machine?: Stamped<MachineTelemetryEvent["data"]>;
  robot?: Stamped<RobotTelemetryEvent["data"]>;
  lastScan?: Stamped<TraceabilityScanEvent["data"]>;
  expedition?: Stamped<ExpeditionMetricsEvent["data"] & ExpeditionMetricsExtrasV02>;
  /** peças vistas nesta sessão (dedupe por pieceId) */
  seenPieces: string[];
  seenEvents: string[];
  session: { produced: number; approved: number; rejected: number };
  statusSince?: { status: MachineStatus; at: number };
  statusTimeMs: Partial<Record<MachineStatus, number>>;
  failures: number;
  feed: FeedItem[];
  commands: CommandEntry[];
  orders: ProductionOrderMock[];
  invalidCount: number;
}

export type Action =
  | { kind: "event"; event: Smart40Event; receivedAt: number }
  | { kind: "invalid"; reason: string; receivedAt: number }
  | { kind: "command-sent"; command: CommandRequestedEvent; orderCode?: string; sentAt: number }
  | { kind: "tick"; now: number };

export function initialState(now: number): ConsoleState {
  return {
    sessionStart: now,
    connection: "UNKNOWN",
    seenPieces: [],
    seenEvents: [],
    session: { produced: 0, approved: 0, rejected: 0 },
    statusTimeMs: {},
    failures: 0,
    feed: [],
    commands: [],
    orders: ORDERS_MOCK.map((o) => ({ ...o })),
    invalidCount: 0,
  };
}

const FAILURE: MachineStatus[] = ["ALARM", "EMERGENCY", "SAFETY_FAULT"];
const pushBounded = <T>(list: T[], item: T, limit: number) => [item, ...list].slice(0, limit);
const tailBounded = (list: string[], item: string, limit: number) => (list.length >= limit ? [...list.slice(1), item] : [...list, item]);

export function reducer(state: ConsoleState, action: Action): ConsoleState {
  switch (action.kind) {
    case "tick":
      return expireCommands(state, action.now);
    case "invalid":
      return {
        ...state,
        invalidCount: state.invalidCount + 1,
        feed: pushBounded(state.feed, { id: `invalid-${action.receivedAt}-${state.invalidCount}`, at: new Date(action.receivedAt).toISOString(), station: "Sistema", severity: "alerta", text: `Dado inválido descartado (${action.reason})` }, FEED_LIMIT),
      };
    case "command-sent":
      return {
        ...state,
        commands: [{ commandId: action.command.data.commandId, action: action.command.data.action, sentAt: action.sentAt, orderCode: action.orderCode }, ...state.commands].slice(0, 50),
      };
    case "event":
      return applyEvent(state, action.event, action.receivedAt);
  }
}

function applyEvent(state: ConsoleState, ev: Smart40Event, now: number): ConsoleState {
  if (state.seenEvents.includes(ev.eventId)) return state; // idempotência por eventId

  const item = narrate(ev, {
    machineStatus: state.machine?.data.status,
    emergencyActive: state.machine?.data.emergencyActive,
    robotProgram: state.robot?.data.programStatus,
    palletFull: state.expedition ? state.expedition.data.pallet.currentCount >= state.expedition.data.pallet.capacity : undefined,
    queueHigh: state.expedition ? state.expedition.data.outputQueue >= QUEUE_HIGH : undefined,
    connection: state.connection,
    seenPieces: new Set(state.seenPieces),
    ownCommands: new Map(state.commands.map((c) => [c.commandId, c.action])),
  });

  let next: ConsoleState = {
    ...state,
    seenEvents: tailBounded(state.seenEvents, ev.eventId, SEEN_LIMIT),
    feed: item ? pushBounded(state.feed, item, FEED_LIMIT) : state.feed,
  };

  // O módulo pode montar depois que o Shell publicou `connection.state`. Se ainda não sabemos o estado
  // e chegou telemetria, a fonte está viva: tratamos como CONNECTED até o Shell dizer o contrário.
  if (next.connection === "UNKNOWN" && (ev.type === "machine.telemetry" || ev.type === "expedition.metrics")) {
    next.connection = "CONNECTED";
  }

  switch (ev.type) {
    case "machine.telemetry": {
      const at = Date.parse(ev.timestamp);
      const prev = next.statusSince;
      if (!prev) next.statusSince = { status: ev.data.status, at };
      else if (prev.status !== ev.data.status) {
        next.statusTimeMs = { ...next.statusTimeMs, [prev.status]: (next.statusTimeMs[prev.status] ?? 0) + Math.max(0, at - prev.at) };
        next.statusSince = { status: ev.data.status, at };
        if (FAILURE.includes(ev.data.status) && !FAILURE.includes(prev.status)) next.failures += 1;
      }
      next.machine = { data: ev.data, at: now, source: ev.source };
      break;
    }
    case "robot.telemetry":
      next.robot = { data: ev.data, at: now, source: ev.source };
      break;
    case "traceability.piece-scanned": {
      if (next.seenPieces.includes(ev.data.pieceId)) break; // QR repetido não conta duas vezes
      next.seenPieces = tailBounded(next.seenPieces, ev.data.pieceId, SEEN_LIMIT);
      next.lastScan = { data: ev.data, at: now, source: ev.source };
      if (ev.data.result !== "PENDING") {
        next.session = {
          produced: next.session.produced + 1,
          approved: next.session.approved + (ev.data.result === "APPROVED" ? 1 : 0),
          rejected: next.session.rejected + (ev.data.result === "REJECTED" ? 1 : 0),
        };
      }
      break;
    }
    case "expedition.metrics":
      next.expedition = { data: ev.data as ExpeditionMetricsEvent["data"] & ExpeditionMetricsExtrasV02, at: now, source: ev.source };
      break;
    case "command.ack": {
      const cmd = next.commands.find((c) => c.commandId === ev.data.commandId);
      if (!cmd) break;
      next.commands = next.commands.map((c) => (c.commandId === ev.data.commandId ? { ...c, result: ev.data.result, message: ev.data.message } : c));
      if (cmd.action === "ORDER_RELEASE" && cmd.orderCode && ev.data.result !== "REJECTED") {
        next.orders = next.orders.map((o) => (o.code === cmd.orderCode ? { ...o, status: "LIBERADA" } : o));
      }
      break;
    }
    case "connection.state":
      next.connection = ev.data.state;
      next.latencyMs = ev.data.latencyMs;
      break;
    case "command.requested":
      break;
  }
  return next;
}

function expireCommands(state: ConsoleState, now: number): ConsoleState {
  const expired = state.commands.filter((c) => !c.result && now - c.sentAt > ACK_TIMEOUT_MS);
  if (expired.length === 0) return state;
  const ids = new Set(expired.map((c) => c.commandId));
  let feed = state.feed;
  for (const c of expired) {
    feed = pushBounded(feed, { id: `timeout-${c.commandId}`, at: new Date(now).toISOString(), station: "Expedição", severity: "alerta", text: `Sem resposta do simulador para ${c.action} após ${ACK_TIMEOUT_MS / 1000} s` }, FEED_LIMIT);
  }
  return { ...state, feed, commands: state.commands.map((c) => (ids.has(c.commandId) ? { ...c, result: "TIMEOUT" } : c)) };
}

// ---------- seletores (leituras derivadas para a tela) ----------

/** tempo acumulado em cada estado, incluindo o trecho atual até `now` */
export function statusTimes(state: ConsoleState, now: number): Partial<Record<MachineStatus, number>> {
  const t = { ...state.statusTimeMs };
  if (state.statusSince) t[state.statusSince.status] = (t[state.statusSince.status] ?? 0) + Math.max(0, now - state.statusSince.at);
  return t;
}

/** Dado vencido: sem telemetria da máquina há mais de STALE_AFTER_MS, ou o Shell avisou STALE */
export function isStale(state: ConsoleState, now: number): boolean {
  if (state.connection === "STALE") return true;
  if (!state.machine) return false;
  return now - state.machine.at > STALE_AFTER_MS;
}

export function effectiveConnection(state: ConsoleState, now: number): ConsoleState["connection"] {
  if (state.connection === "DISCONNECTED") return "DISCONNECTED";
  if (isStale(state, now)) return "STALE";
  return state.connection;
}
