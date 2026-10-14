/**
 * "A conversa" do console: traduz eventos do barramento em frases simples.
 * Só gera frase quando algo MUDA — a telemetria chega a cada 500 ms e repetir tudo afogaria o feed.
 */
import type { MachineStatus, RobotProgramStatus, Smart40Event } from "../contracts/contrato-smart40-v0.1";

export type Station = "IHM" | "Robô" | "QR Code" | "Esteira" | "Expedição" | "Sistema";
export type Severity = "info" | "alerta" | "critico";

export interface FeedItem {
  id: string;
  at: string; // ISO 8601
  station: Station;
  severity: Severity;
  text: string;
}

/** O mínimo do estado anterior que o narrador precisa para saber se algo mudou */
export interface NarratorMemory {
  machineStatus?: MachineStatus;
  emergencyActive?: boolean;
  robotProgram?: RobotProgramStatus;
  palletFull?: boolean;
  queueHigh?: boolean;
  connection?: string;
  seenPieces: ReadonlySet<string>;
  ownCommands: ReadonlyMap<string, string>; // commandId -> action
}

export const QUEUE_HIGH = 5;

const STATUS_PT: Record<MachineStatus, string> = {
  IDLE: "parada (aguardando)",
  RUNNING: "em produção",
  ALARM: "em alarme",
  MAINTENANCE: "em manutenção",
  EMERGENCY: "em emergência",
  SAFETY_FAULT: "com falha de segurança",
  UNKNOWN: "em estado desconhecido",
};

const PROGRAM_PT: Record<RobotProgramStatus, string> = {
  IDLE: "parado",
  RUNNING: "executando",
  PAUSED: "pausado",
  FAULT: "em falha",
  UNKNOWN: "em estado desconhecido",
};

const ACTION_PT: Record<string, string> = {
  START: "partida",
  STOP: "parada",
  RESET: "reset",
  EMERGENCY_STOP: "parada de emergência",
  ROBOT_START: "início do robô",
  ROBOT_PAUSE: "pausa do robô",
  SCAN_SIMULATED: "leitura de QR",
  ORDER_RELEASE: "liberação de ordem",
  PALLETIZE: "fechamento de palete",
  MOVE_LEFT: "movimento à esquerda",
  MOVE_RIGHT: "movimento à direita",
};

const MODULE_STATION: Record<string, Station> = {
  ihm: "IHM",
  robot: "Robô",
  traceability: "QR Code",
  expedition: "Expedição",
};

export function narrate(event: Smart40Event, mem: NarratorMemory): FeedItem | null {
  const base = { id: event.eventId, at: event.timestamp };
  switch (event.type) {
    case "machine.telemetry": {
      const d = event.data;
      if (d.emergencyActive && !mem.emergencyActive)
        return { ...base, station: "IHM", severity: "critico", text: "Parada de emergência acionada" };
      if (!d.emergencyActive && mem.emergencyActive)
        return { ...base, station: "IHM", severity: "info", text: "Emergência liberada, aguardando o reset do operador" };
      if (d.status !== mem.machineStatus) {
        const sev: Severity = ["ALARM", "EMERGENCY", "SAFETY_FAULT"].includes(d.status) ? "critico" : d.status === "IDLE" || d.status === "UNKNOWN" ? "alerta" : "info";
        const extra = d.status === "RUNNING" ? ` em modo ${d.mode === "AUTOMATIC" ? "automático" : d.mode === "MANUAL" ? "manual" : "manutenção"}` : "";
        return { ...base, station: "IHM", severity: sev, text: `Máquina ${STATUS_PT[d.status]}${extra}` };
      }
      return null;
    }
    case "robot.telemetry": {
      const d = event.data;
      if (d.programStatus === mem.robotProgram) return null;
      const prog = d.programName ? ` o programa ${d.programName}` : "";
      return { ...base, station: "Robô", severity: d.programStatus === "FAULT" ? "critico" : "info", text: `Robô ${PROGRAM_PT[d.programStatus]}${d.programStatus === "RUNNING" ? prog : ""}` };
    }
    case "traceability.piece-scanned": {
      const d = event.data;
      if (mem.seenPieces.has(d.pieceId)) return null; // leitura duplicada não vira nova frase
      if (d.result === "REJECTED")
        return { ...base, station: "QR Code", severity: "alerta", text: `${d.pieceId} rejeitada na inspeção${d.reason ? `: ${d.reason.replace(" (mock)", "")}` : ""}` };
      if (d.result === "APPROVED")
        return { ...base, station: "QR Code", severity: "info", text: `${d.pieceId} aprovada e enviada à expedição` };
      return { ...base, station: "QR Code", severity: "info", text: `${d.pieceId} lida, aguardando inspeção` };
    }
    case "expedition.metrics": {
      const d = event.data;
      const full = d.pallet.currentCount >= d.pallet.capacity;
      if (full && !mem.palletFull)
        return { ...base, station: "Expedição", severity: "alerta", text: `Palete cheio com ${d.pallet.currentCount} peças. Feche o palete para liberar a fila` };
      const high = d.outputQueue >= QUEUE_HIGH;
      if (high && !mem.queueHigh)
        return { ...base, station: "Expedição", severity: "alerta", text: `${d.outputQueue} peças acumuladas na fila de saída` };
      return null;
    }
    case "command.requested": {
      const d = event.data;
      const station = MODULE_STATION[d.sourceModule] ?? "Sistema";
      return { ...base, station, severity: "info", text: `Pedido de ${ACTION_PT[d.action] ?? d.action} enviado (simulação)` };
    }
    case "command.ack": {
      const d = event.data;
      const action = mem.ownCommands.get(d.commandId);
      if (!action) return null; // ACK de comando de outro módulo: o dono narra
      const what = ACTION_PT[action] ?? action;
      if (d.result === "REJECTED")
        return { ...base, station: "Expedição", severity: "alerta", text: `Pedido de ${what} recusado${d.message ? `: ${d.message}` : ""}` };
      return { ...base, station: "Expedição", severity: "info", text: `${d.message ?? `Pedido de ${what} confirmado`}` };
    }
    case "connection.state": {
      const d = event.data;
      if (d.state === mem.connection) return null;
      if (d.state === "CONNECTED") return { ...base, station: "Sistema", severity: "info", text: "Conectado ao simulador" };
      if (d.state === "DISCONNECTED") return { ...base, station: "Sistema", severity: "critico", text: "Conexão com a máquina perdida. Tentando reconectar" };
      if (d.state === "STALE") return { ...base, station: "Sistema", severity: "alerta", text: "Sem atualização da máquina nos últimos segundos" };
      return { ...base, station: "Sistema", severity: "info", text: "Conectando…" };
    }
  }
}
