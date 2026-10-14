import { calcularOee, mtbfMs, taxaRefugo } from "./oee";

describe("calcularOee", () => {
  it("reproduz o exemplo do documento: 60 min, 6 min parado, ciclo 4 s, 729 peças, 15 rejeitadas → 79,3%", () => {
    const r = calcularOee({ elapsedMs: 60 * 60_000, runningMs: 54 * 60_000, produced: 729, approved: 714, idealCycleTimeMs: 4_000 });
    expect(r.availability).toBeCloseTo(0.9, 5);
    expect(r.performance).toBeCloseTo(0.9, 5);
    expect(r.quality).toBeCloseTo(714 / 729, 5);
    expect(r.oee).toBeCloseTo(0.7933, 3);
    expect(r.performanceCapped).toBe(false);
  });

  it("não inventa valor quando falta base (N/D em vez de zero)", () => {
    const r = calcularOee({ elapsedMs: 0, runningMs: 0, produced: 0, approved: 0, idealCycleTimeMs: 4_000 });
    expect(r).toEqual({ availability: null, performance: null, quality: null, oee: null, performanceCapped: false });
  });

  it("limita a performance a 100% e sinaliza ciclo ideal mal configurado", () => {
    const r = calcularOee({ elapsedMs: 10_000, runningMs: 10_000, produced: 10, approved: 10, idealCycleTimeMs: 5_000 });
    expect(r.performance).toBe(1);
    expect(r.performanceCapped).toBe(true);
  });
});

describe("taxaRefugo e MTBF", () => {
  it("calcula refugo e devolve null sem produção", () => {
    expect(taxaRefugo(15, 729)).toBeCloseTo(0.0206, 3);
    expect(taxaRefugo(0, 0)).toBeNull();
  });
  it("MTBF é null sem falhas", () => {
    expect(mtbfMs(60_000, 0)).toBeNull();
    expect(mtbfMs(60_000, 3)).toBe(20_000);
  });
});
