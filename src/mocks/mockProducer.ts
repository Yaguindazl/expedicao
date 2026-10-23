/**
 * Simulador local (MOCK) — faz o papel do App Shell/gateway enquanto o Grupo 1 não publica o dele.
 *
 * - Publica eventos tipados do contrato v0.1 no barramento `smart40:*` (source: "mock").
 * - Responde comandos `simulation: true` com `command.ack` SIMULATED/REJECTED.
 * - É determinístico (PRNG com semente): a mesma sequência de peças a cada execução, útil para testes e demo.
 * - Nada aqui fala com CLP, robô ou rede industrial.
 */
import type {
  CommandAckEvent,
  CommandRequestedEvent,
  ConnectionStateEvent,
  ExpeditionMetricsEvent,
  MachineStatus,
  MachineTelemetryEvent,
  RobotTelemetryEvent,
  TraceabilityScanEvent,
} from "../contracts/contrato-smart40-v0.1";
import { BUS_PREFIX, publish } from "../bus/eventBus";

/** PRNG mulberry32 — determinístico por semente */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MockOptions {
  seed?: number;
  tickMs?: number;
  /** a cada quantos ticks uma peça passa pelo QR Code quando a máquina está rodando */
  ticksPerPiece?: number;
  /** probabilidade de rejeição na inspeção */
  rejectRate?: number;
  palletCapacity?: number;
  target?: EventTarget;
  now?: () => number;
}

export class MockProducer {
  private rand: () => number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private tick = 0;
  private evt = 0;
  private status: MachineStatus = "RUNNING";
  private emergency = false;
  private connected = true;
  private pieceSeq = 0;
  private produced = 0;
  private approved = 0;
  private rejected = 0;
  private queue = 0;
  private pallet = 0;
  private activeOrders = 2;
  private scanTimes: number[] = [];
  private lastScan: TraceabilityScanEvent | null = null;
  private readonly o: Required<Omit<MockOptions, "target" | "now">>;
  private readonly target: EventTarget;
  private readonly now: () => number;
  private readonly onCommand = (e: Event) => this.handleCommand((e as CustomEvent).detail as CommandRequestedEvent);

  constructor(opts: MockOptions = {}) {
    this.o = {
      seed: opts.seed ?? 2026,
      tickMs: opts.tickMs ?? 500,
      ticksPerPiece: opts.ticksPerPiece ?? 8,
      rejectRate: opts.rejectRate ?? 0.08,
      palletCapacity: opts.palletCapacity ?? 28, // posições da expedição no CLP (pos1–pos28)
    };
    this.target = opts.target ?? window;
    this.now = opts.now ?? Date.now;
    this.rand = mulberry32(this.o.seed);
  }

  start() {
    if (this.timer) return;
    this.target.addEventListener(BUS_PREFIX + "command.requested", this.onCommand);
    this.emitConnection("CONNECTED");
    this.step();
    this.timer = setInterval(() => this.step(), this.o.tickMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.target.removeEventListener(BUS_PREFIX + "command.requested", this.onCommand);
  }

  // ---------- controles do painel de teste (modo isolado) ----------
  setRunning(running: boolean) {
    if (this.emergency) return;
    this.status = running ? "RUNNING" : "IDLE";
  }
  setEmergency(active: boolean) {
    this.emergency = active;
    this.status = active ? "EMERGENCY" : "IDLE";
  }
  setConnected(connected: boolean) {
    this.connected = connected;
    this.emitConnection(connected ? "CONNECTED" : "DISCONNECTED");
  }
  sendInvalidPayload() {
    publish({ schemaVersion: "0.1.0", eventId: this.id(), type: "expedition.metrics", timestamp: this.iso(), source: "mock", data: { producedTotal: "muitas" } }, this.target);
  }
  repeatLastScan() {
    if (this.lastScan) publish(this.lastScan, this.target);
  }

  // ---------- laço da simulação ----------
  /** Avança um passo (público para testes). */
  step() {
    this.tick++;
    if (!this.connected) return;
    const running = this.status === "RUNNING";
    // heartbeat do estado da conexão: um módulo que montar depois do início também recebe o estado
    if (this.tick % 10 === 0) this.emitConnection("CONNECTED");

    if (running && this.tick % this.o.ticksPerPiece === 0) this.scanPiece();
    if (this.tick % 3 === 0 && this.queue > 0 && this.pallet < this.o.palletCapacity) {
      this.queue--;
      this.pallet++;
    }

    this.emitMachine(running);
    this.emitRobot(running);
    if (this.tick % 2 === 0) this.emitExpedition();
  }

  private scanPiece() {
    this.pieceSeq++;
    const ok = this.rand() >= this.o.rejectRate;
    const pieceId = `PECA-${String(this.pieceSeq).padStart(4, "0")}`;
    const ev: TraceabilityScanEvent = {
      schemaVersion: "0.1.0",
      eventId: this.id(),
      type: "traceability.piece-scanned",
      timestamp: this.iso(),
      source: "mock",
      data: {
        pieceId,
        code: `QR-${pieceId}`,
        lotId: "LOTE-2026-A9",
        scannedAt: this.iso(),
        result: ok ? "APPROVED" : "REJECTED",
        reason: ok ? undefined : "superfície fora da tolerância",
      },
    };
    this.lastScan = ev;
    this.produced++;
    this.scanTimes.push(this.now());
    if (ok) {
      this.approved++;
      this.queue++;
    } else this.rejected++;
    publish(ev, this.target);
  }

  private emitMachine(running: boolean) {
    const ev: MachineTelemetryEvent = {
      schemaVersion: "0.1.0",
      eventId: this.id(),
      type: "machine.telemetry",
      timestamp: this.iso(),
      source: "mock",
      data: {
        status: this.status,
        mode: "AUTOMATIC",
        emergencyActive: this.emergency,
        safetyInterlockOk: !this.emergency,
        cycleTimeMs: running ? this.o.ticksPerPiece * this.o.tickMs : undefined,
        alarmCodes: this.emergency ? ["E-STOP-SIM"] : [],
      },
    };
    publish(ev, this.target);
  }

  private emitRobot(running: boolean) {
    const t = this.tick / 10;
    const ev: RobotTelemetryEvent = {
      schemaVersion: "0.1.0",
      eventId: this.id(),
      type: "robot.telemetry",
      timestamp: this.iso(),
      source: "mock",
      data: {
        jointAnglesDeg: [r1(Math.sin(t) * 45), r1(-90 + Math.cos(t) * 20), r1(90 + Math.sin(t) * 15), -90, -90, 0],
        cartesianMm: { x: 350, y: -120, z: 215 },
        gripper: running && this.tick % 4 < 2 ? "CLOSED" : "OPEN",
        speedPercent: running ? 65 : 0,
        programStatus: this.emergency ? "FAULT" : running ? "RUNNING" : "IDLE",
        programName: "ROTINA_PALETIZACAO_MAIN",
      },
    };
    publish(ev, this.target);
  }

  private emitExpedition() {
    const now = this.now();
    this.scanTimes = this.scanTimes.filter((t) => now - t <= 60_000);
    const ev: ExpeditionMetricsEvent & { data: { approvedTotal: number; rejectedTotal: number } } = {
      schemaVersion: "0.1.0",
      eventId: this.id(),
      type: "expedition.metrics",
      timestamp: this.iso(),
      source: "mock",
      data: {
        producedTotal: this.produced,
        piecesPerMinute: this.scanTimes.length,
        outputQueue: this.queue,
        activeOrders: this.activeOrders,
        pallet: { currentCount: this.pallet, capacity: this.o.palletCapacity },
        // campos da PROPOSTA v0.2 (opcionais)
        approvedTotal: this.approved,
        rejectedTotal: this.rejected,
      },
    };
    publish(ev, this.target);
  }

  private emitConnection(state: ConnectionStateEvent["data"]["state"]) {
    const ev: ConnectionStateEvent = {
      schemaVersion: "0.1.0",
      eventId: this.id(),
      type: "connection.state",
      timestamp: this.iso(),
      source: "mock",
      data: { state, latencyMs: state === "CONNECTED" ? 12 : undefined },
    };
    publish(ev, this.target);
  }

  private handleCommand(cmd: CommandRequestedEvent) {
    if (!cmd?.data || cmd.data.simulation !== true) return; // nunca responde comando "real"
    let result: CommandAckEvent["data"]["result"] = "SIMULATED";
    let message = "Executado apenas na simulação";
    if (!this.connected) return; // sem conexão, sem ACK — a interface mostra o timeout
    if (this.emergency) {
      result = "REJECTED";
      message = "emergência ativa";
    } else if (cmd.data.action === "PALLETIZE") {
      if (this.pallet === 0) {
        result = "REJECTED";
        message = "o palete está vazio";
      } else {
        message = `Palete fechado com ${this.pallet} peça(s)`;
        this.pallet = 0;
      }
    } else if (cmd.data.action === "ORDER_RELEASE") {
      this.activeOrders++;
      message = `Ordem ${String(cmd.data.parameters?.orderCode ?? "")} liberada`;
    }
    setTimeout(() => {
      const ack: CommandAckEvent = {
        schemaVersion: "0.1.0",
        eventId: this.id(),
        type: "command.ack",
        timestamp: this.iso(),
        source: "mock",
        data: { commandId: cmd.data.commandId, result, message },
      };
      publish(ack, this.target);
    }, 300);
  }

  private id() {
    return `mock-${++this.evt}`;
  }
  private iso() {
    return new Date(this.now()).toISOString();
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
