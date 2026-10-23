import { subscribe } from "./eventBus";
import { traduzirTelemetria } from "./telemetriaAdapter";
import { validateEvent } from "./validate";
import type { Smart40Event } from "../contracts/contrato-smart40-v0.1";

/** Pacote igual ao que o mock_server_smart40.js do professor manda a cada 500 ms */
const pacote = (over: Record<string, unknown> = {}) => ({
  timestamp: "2026-10-23T22:00:00.000Z",
  estadoGlobal: "EM_EXECUCAO",
  modoOperacao: "AUTOMATICO",
  velocidadeEsteiraAtual: 65,
  estacaoIhm: { travaSegurancaAtiva: false, pressaoPneumaticaBar: 6.2 },
  roboUR: {
    conectado: true,
    programaAtivo: "ROTINA_PALETIZACAO_MAIN",
    executandoRotina: true,
    garraFechada: false,
    temperaturaMotoresC: 42.5,
    posicaoCartesiana: { x: 350, y: -120, z: 215, rx: 0, ry: 180, rz: 45 },
    posicaoJuntas: { j1: 0, j2: -90, j3: 90, j4: -90, j5: -90, j6: 0 },
  },
  ultimaPecaLida: { idPeca: "PECA-143", codigoLote: "LOTE-2026-A9", timestampLeitura: "2026-10-23T22:00:00.000Z", qualidadeSuperficie: 72.1, statusInspecao: "REJEITADA" },
  metricasExpedicao: { pecasProcessadasTotal: 143, pecasAprovadasCount: 138, pecasRejeitadasCount: 5, tamanhoFilaSaida: 3, ritmoProducaoPecasPorMinuto: 12.4, oeePercentual: 88.5 },
  ...over,
});

describe("tradutor da telemetria do professor", () => {
  it("gera eventos do contrato que passam na validação", () => {
    const events = traduzirTelemetria(pacote())!;
    expect(events.map((e: any) => e.type)).toEqual(["machine.telemetry", "robot.telemetry", "traceability.piece-scanned", "expedition.metrics"]);
    for (const e of events) expect(validateEvent(e)).toMatchObject({ ok: true });
    const [m, r, s, x] = events as any[];
    expect(m.data).toMatchObject({ status: "RUNNING", mode: "AUTOMATIC", emergencyActive: false, safetyInterlockOk: true });
    expect(r.data.jointAnglesDeg).toEqual([0, -90, 90, -90, -90, 0]);
    expect(r.data.speedPercent).toBeUndefined(); // o simulador não manda: N/D, nunca zero
    expect(s.data).toMatchObject({ pieceId: "PECA-143", result: "REJECTED" });
    expect(x.data).toMatchObject({ producedTotal: 143, approvedTotal: 138, rejectedTotal: 5, outputQueue: 3 });
    expect(x.data.pallet).toBeUndefined();
  });

  it("traduz a parada de emergência", () => {
    const [m] = traduzirTelemetria(pacote({ estadoGlobal: "PARADA_EMERGENCIA", estacaoIhm: { travaSegurancaAtiva: true } }))! as any[];
    expect(m.data).toMatchObject({ status: "EMERGENCY", emergencyActive: true, safetyInterlockOk: false });
  });

  it("recusa um pacote fora do formato", () => {
    expect(traduzirTelemetria({ qualquer: 1 })).toBeNull();
    expect(traduzirTelemetria("texto")).toBeNull();
  });

  it("o barramento escuta smart40:telemetria e entrega eventos já traduzidos", () => {
    const bus = new EventTarget();
    const got: Smart40Event[] = [];
    const invalid: string[] = [];
    const off = subscribe({ onEvent: (e) => got.push(e), onInvalid: (r) => invalid.push(r) }, bus);
    bus.dispatchEvent(new CustomEvent("smart40:telemetria", { detail: pacote() }));
    bus.dispatchEvent(new CustomEvent("smart40:telemetria", { detail: { lixo: true } }));
    off();
    bus.dispatchEvent(new CustomEvent("smart40:telemetria", { detail: pacote() })); // depois do unmount: ignorado
    expect(got).toHaveLength(4);
    expect(invalid).toHaveLength(1);
  });
});
