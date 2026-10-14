import { mockMachineTelemetry } from "../contracts/contrato-smart40-v0.1";
import { buildCommand } from "./eventBus";
import { validateEvent } from "./validate";

const metrics = {
  schemaVersion: "0.1.0",
  eventId: "m-1",
  type: "expedition.metrics",
  timestamp: "2026-10-09T21:00:00.000Z",
  source: "mock",
  data: { producedTotal: 10, piecesPerMinute: 4, outputQueue: 1, activeOrders: 2, pallet: { currentCount: 3, capacity: 12 } },
};

describe("validateEvent", () => {
  it("aceita o mock oficial do contrato v0.1", () => {
    expect(validateEvent(mockMachineTelemetry).ok).toBe(true);
  });

  it("aceita expedition.metrics v0.1 e também com os extras da proposta v0.2", () => {
    expect(validateEvent(metrics).ok).toBe(true);
    expect(validateEvent({ ...metrics, data: { ...metrics.data, approvedTotal: 9, rejectedTotal: 1 } }).ok).toBe(true);
  });

  it("descarta campo com tipo errado", () => {
    const r = validateEvent({ ...metrics, data: { ...metrics.data, producedTotal: "muitas" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain("producedTotal");
  });

  it("descarta versão de schema diferente e timestamp inválido", () => {
    expect(validateEvent({ ...metrics, schemaVersion: "9.9.9" }).ok).toBe(false);
    expect(validateEvent({ ...metrics, timestamp: "ontem" }).ok).toBe(false);
  });

  it("recusa comando sem simulation:true (proibido na Sprint 1)", () => {
    const cmd = buildCommand("PALLETIZE");
    expect(validateEvent(cmd).ok).toBe(true);
    expect(validateEvent({ ...cmd, data: { ...cmd.data, simulation: false } }).ok).toBe(false);
  });

  it("descarta lixo sem lançar exceção", () => {
    expect(validateEvent(null).ok).toBe(false);
    expect(validateEvent("texto").ok).toBe(false);
    expect(validateEvent({ ...metrics, type: "tipo.inexistente" }).ok).toBe(false);
  });
});
