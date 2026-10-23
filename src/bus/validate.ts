/**
 * Validação em tempo de execução dos eventos recebidos do barramento.
 * O TypeScript só protege em tempo de compilação; aqui garantimos que um payload
 * inválido é descartado (e registrado) sem travar a tela — critério do runbook, seção 7.
 */
import {
  SCHEMA_VERSION,
  type Smart40Event,
  type MachineStatus,
  type OperatingMode,
  type RobotProgramStatus,
  type GripperState,
  type InspectionResult,
  type ConnectionState,
} from "../contracts/contrato-smart40-v0.1";

export type ValidationResult =
  | { ok: true; event: Smart40Event }
  | { ok: false; reason: string };

const MACHINE_STATUS: MachineStatus[] = ["IDLE", "RUNNING", "ALARM", "MAINTENANCE", "EMERGENCY", "SAFETY_FAULT", "UNKNOWN"];
const MODES: OperatingMode[] = ["MANUAL", "AUTOMATIC", "MAINTENANCE"];
const PROGRAM: RobotProgramStatus[] = ["IDLE", "RUNNING", "PAUSED", "FAULT", "UNKNOWN"];
const GRIPPER: GripperState[] = ["OPEN", "CLOSED", "UNKNOWN"];
const INSPECTION: InspectionResult[] = ["PENDING", "APPROVED", "REJECTED"];
const CONNECTION: ConnectionState[] = ["CONNECTING", "CONNECTED", "DISCONNECTED", "STALE"];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const isBool = (v: unknown): v is boolean => typeof v === "boolean";
const isIso = (v: unknown): v is string => isStr(v) && !Number.isNaN(Date.parse(v));
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
const optNum = (v: unknown) => v === undefined || isNum(v);
const optStr = (v: unknown) => v === undefined || typeof v === "string";

function checkData(type: string, d: Record<string, unknown>): string | null {
  switch (type) {
    case "machine.telemetry":
      if (!oneOf(MACHINE_STATUS, d.status)) return "status inválido";
      if (!oneOf(MODES, d.mode)) return "mode inválido";
      if (!isBool(d.emergencyActive) || !isBool(d.safetyInterlockOk)) return "flags de segurança ausentes";
      if (!optNum(d.cycleTimeMs)) return "cycleTimeMs inválido";
      if (!Array.isArray(d.alarmCodes) || !d.alarmCodes.every((a) => typeof a === "string")) return "alarmCodes inválido";
      return null;
    case "robot.telemetry": {
      const j = d.jointAnglesDeg;
      if (!Array.isArray(j) || j.length !== 6 || !j.every(isNum)) return "jointAnglesDeg precisa de 6 números";
      const c = d.cartesianMm;
      if (!isObj(c) || !isNum(c.x) || !isNum(c.y) || !isNum(c.z)) return "cartesianMm inválido";
      if (!oneOf(GRIPPER, d.gripper)) return "gripper inválido";
      // Sprint 2: o simulador do professor não manda a velocidade do robô → opcional aqui (N/D na tela)
      if (!optNum(d.speedPercent)) return "speedPercent inválido";
      if (!oneOf(PROGRAM, d.programStatus)) return "programStatus inválido";
      if (!optStr(d.programName)) return "programName inválido";
      return null;
    }
    case "traceability.piece-scanned":
      if (!isStr(d.pieceId) || !isStr(d.code)) return "pieceId/code ausentes";
      if (!isIso(d.scannedAt)) return "scannedAt não é ISO 8601";
      if (!oneOf(INSPECTION, d.result)) return "result inválido";
      if (!optStr(d.lotId) || !optStr(d.reason)) return "lotId/reason inválido";
      return null;
    case "expedition.metrics": {
      for (const k of ["producedTotal", "piecesPerMinute", "outputQueue"]) {
        if (!isNum(d[k])) return `${k} inválido`;
      }
      // Sprint 2: o simulador do professor não tem palete nem ordens → aceitamos ausentes (N/D na tela),
      // mas se vierem, precisam estar certos
      if (!optNum(d.activeOrders)) return "activeOrders inválido";
      const p = d.pallet;
      if (p !== undefined && (!isObj(p) || !isNum(p.currentCount) || !isNum(p.capacity) || !optNum(p.occupiedSlots))) return "pallet inválido";
      if (!optNum(d.approvedTotal) || !optNum(d.rejectedTotal)) return "extras v0.2 inválidos";
      return null;
    }
    case "command.requested":
      if (!isStr(d.commandId) || !isStr(d.target) || !isStr(d.action) || !isStr(d.sourceModule)) return "comando incompleto";
      if (d.simulation !== true) return "comando sem simulation:true é proibido na Sprint 1";
      return null;
    case "command.ack":
      if (!isStr(d.commandId)) return "commandId ausente";
      if (!oneOf(["SIMULATED", "ACCEPTED", "REJECTED"] as const, d.result)) return "result inválido";
      return null;
    case "connection.state":
      if (!oneOf(CONNECTION, d.state)) return "state inválido";
      if (!optNum(d.latencyMs)) return "latencyMs inválido";
      if (d.lastTelemetryAt !== undefined && !isIso(d.lastTelemetryAt)) return "lastTelemetryAt inválido";
      return null;
    default:
      return `tipo desconhecido: ${type}`;
  }
}

export function validateEvent(raw: unknown): ValidationResult {
  if (!isObj(raw)) return { ok: false, reason: "payload não é um objeto" };
  if (raw.schemaVersion !== SCHEMA_VERSION) return { ok: false, reason: `schemaVersion ${String(raw.schemaVersion)} ≠ ${SCHEMA_VERSION}` };
  if (!isStr(raw.eventId)) return { ok: false, reason: "eventId ausente" };
  if (!isStr(raw.type)) return { ok: false, reason: "type ausente" };
  if (!isIso(raw.timestamp)) return { ok: false, reason: "timestamp não é ISO 8601" };
  if (raw.source !== "mock" && raw.source !== "gateway") return { ok: false, reason: "source inválido" };
  if (!isObj(raw.data)) return { ok: false, reason: "data ausente" };
  const err = checkData(raw.type, raw.data);
  if (err) return { ok: false, reason: `${raw.type}: ${err}` };
  return { ok: true, event: raw as unknown as Smart40Event };
}
