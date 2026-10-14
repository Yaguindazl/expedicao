import { buildCommand, publish, subscribe } from "../bus/eventBus";
import type { Smart40Event } from "../contracts/contrato-smart40-v0.1";
import { MockProducer } from "./mockProducer";

function collect(seed: number, steps: number) {
  const bus = new EventTarget();
  const events: Smart40Event[] = [];
  const invalid: string[] = [];
  const off = subscribe({ onEvent: (e) => events.push(e), onInvalid: (r) => invalid.push(r) }, bus);
  const mock = new MockProducer({ seed, target: bus, now: () => Date.parse("2026-10-09T21:00:00Z") });
  for (let i = 0; i < steps; i++) mock.step();
  off();
  return { events, invalid, mock, bus };
}

describe("MockProducer", () => {
  it("é determinístico: mesma semente, mesma sequência de peças", () => {
    const a = collect(7, 200).events.filter((e) => e.type === "traceability.piece-scanned").map((e) => e.data);
    const b = collect(7, 200).events.filter((e) => e.type === "traceability.piece-scanned").map((e) => e.data);
    expect(a.length).toBeGreaterThan(20);
    expect(a).toEqual(b);
  });

  it("só publica eventos válidos pelo contrato", () => {
    const { events, invalid } = collect(2026, 100);
    expect(invalid).toEqual([]);
    expect(new Set(events.map((e) => e.type))).toEqual(new Set(["machine.telemetry", "robot.telemetry", "traceability.piece-scanned", "expedition.metrics", "connection.state"]));
    expect(events.every((e) => e.source === "mock")).toBe(true);
  });

  it("responde comando simulado com ACK e recusa durante emergência", async () => {
    vi.useFakeTimers();
    const bus = new EventTarget();
    const acks: Smart40Event[] = [];
    const off = subscribe({ onEvent: (e) => e.type === "command.ack" && acks.push(e) }, bus);
    const mock = new MockProducer({ target: bus });
    mock.start();
    publish(buildCommand("ORDER_RELEASE", { orderCode: "OP-1" }), bus);
    mock.setEmergency(true);
    publish(buildCommand("PALLETIZE"), bus);
    await vi.advanceTimersByTimeAsync(400);
    mock.stop();
    off();
    vi.useRealTimers();
    expect(acks.map((a) => (a.type === "command.ack" ? a.data.result : null))).toEqual(["SIMULATED", "REJECTED"]);
  });
});
