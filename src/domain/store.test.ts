import type { Smart40Event } from "../contracts/contrato-smart40-v0.1";
import { buildCommand } from "../bus/eventBus";
import { ACK_TIMEOUT_MS, FEED_LIMIT, initialState, isStale, reducer, statusTimes, type ConsoleState } from "./store";

const T0 = Date.parse("2026-10-09T21:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
let n = 0;
const env = <T extends Smart40Event["type"]>(type: T, data: unknown, at = T0): Smart40Event =>
  ({ schemaVersion: "0.1.0", eventId: `e-${++n}`, type, timestamp: iso(at), source: "mock", data }) as Smart40Event;

const machine = (status: string, at: number, emergencyActive = false) =>
  env("machine.telemetry", { status, mode: "AUTOMATIC", emergencyActive, safetyInterlockOk: !emergencyActive, alarmCodes: [] }, at);
const scan = (pieceId: string, result: string, at = T0) => env("traceability.piece-scanned", { pieceId, code: `QR-${pieceId}`, scannedAt: iso(at), result }, at);

const apply = (s: ConsoleState, ev: Smart40Event, at = T0) => reducer(s, { kind: "event", event: ev, receivedAt: at });

describe("reducer do console", () => {
  it("não conta duas vezes a mesma peça (QR repetido) nem o mesmo eventId", () => {
    let s = initialState(T0);
    const ev = scan("PECA-1", "APPROVED");
    s = apply(s, ev);
    s = apply(s, ev); // mesmo eventId
    s = apply(s, scan("PECA-1", "APPROVED")); // mesma peça, outro eventId
    s = apply(s, scan("PECA-2", "REJECTED"));
    expect(s.session).toEqual({ produced: 2, approved: 1, rejected: 1 });
    expect(s.feed.filter((f) => f.station === "QR Code")).toHaveLength(2);
  });

  it("acumula tempo por estado e conta falhas pelas entradas em EMERGENCY/ALARM", () => {
    let s = initialState(T0);
    s = apply(s, machine("RUNNING", T0));
    s = apply(s, machine("RUNNING", T0 + 500)); // telemetria repetida: sem frase nova
    s = apply(s, machine("EMERGENCY", T0 + 10_000, true));
    s = apply(s, machine("IDLE", T0 + 12_000));
    const t = statusTimes(s, T0 + 15_000);
    expect(t.RUNNING).toBe(10_000);
    expect(t.EMERGENCY).toBe(2_000);
    expect(t.IDLE).toBe(3_000);
    expect(s.failures).toBe(1);
    expect(s.feed.some((f) => f.severity === "critico" && f.text.includes("emergência"))).toBe(true);
  });

  it("marca dado vencido quando a telemetria para de chegar", () => {
    let s = initialState(T0);
    expect(s.connection).toBe("UNKNOWN");
    s = apply(s, machine("RUNNING", T0), T0);
    expect(s.connection).toBe("CONNECTED"); // montou depois do connection.state: telemetria prova que a fonte está viva
    expect(isStale(s, T0 + 1_000)).toBe(false);
    expect(isStale(s, T0 + 5_000)).toBe(true);
  });

  it("libera a ordem só quando o ACK simulado chega, e registra timeout sem ACK", () => {
    let s = initialState(T0);
    const cmd = buildCommand("ORDER_RELEASE", { orderCode: "OP-2026-0143" });
    s = reducer(s, { kind: "command-sent", command: cmd, orderCode: "OP-2026-0143", sentAt: T0 });
    expect(s.orders.find((o) => o.code === "OP-2026-0143")?.status).toBe("NA FILA");
    s = apply(s, env("command.ack", { commandId: cmd.data.commandId, result: "SIMULATED", message: "ok" }));
    expect(s.orders.find((o) => o.code === "OP-2026-0143")?.status).toBe("LIBERADA");

    const cmd2 = buildCommand("PALLETIZE");
    s = reducer(s, { kind: "command-sent", command: cmd2, sentAt: T0 });
    s = reducer(s, { kind: "tick", now: T0 + ACK_TIMEOUT_MS + 1 });
    expect(s.commands.find((c) => c.commandId === cmd2.data.commandId)?.result).toBe("TIMEOUT");
  });

  it("limita o feed para não vazar memória", () => {
    let s = initialState(T0);
    for (let i = 0; i < FEED_LIMIT + 50; i++) s = reducer(s, { kind: "invalid", reason: "x", receivedAt: T0 + i });
    expect(s.feed).toHaveLength(FEED_LIMIT);
    expect(s.invalidCount).toBe(FEED_LIMIT + 50);
  });
});
