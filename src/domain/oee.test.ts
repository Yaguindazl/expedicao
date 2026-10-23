import { calcularOee, mtbfMs, ppmJanela, taxaRefugo } from "./oee";

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

describe("PPM em janela de 60 s", () => {
  const T = 1_000_000;
  it("conta só as peças do último minuto", () => {
    const scans = [T - 70_000, T - 50_000, T - 30_000, T - 10_000, T - 1];
    expect(ppmJanela(scans, T, T - 600_000)).toBe(4);
  });
  it("no começo da sessão usa o tempo que já passou", () => {
    expect(ppmJanela([T - 15_000, T - 5_000], T, T - 20_000)).toBe(6); // 2 peças em 20 s = 6/min
  });
  it("com menos de 10 s de sessão devolve N/D", () => {
    expect(ppmJanela([T - 1_000], T, T - 5_000)).toBeNull();
  });
});
