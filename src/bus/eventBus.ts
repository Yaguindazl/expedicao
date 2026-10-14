/**
 * Barramento de eventos da SMART 4.0 no navegador.
 *
 * Regra do runbook: o App Shell (Grupo 1) é o ÚNICO que fala com o gateway/mock e publica
 * os eventos como `smart40:<tipo>` (ex.: `smart40:machine.telemetry`). Este módulo apenas
 * escuta esses eventos e publica `smart40:command.requested` — nunca abre conexão própria.
 *
 * Implementação: CustomEvent no `window`, com o envelope do contrato em `event.detail`.
 * Se o Grupo 1 escolher outro mecanismo (ex.: EventEmitter exportado), só este arquivo muda.
 */
import type { Smart40Event, CommandRequestedEvent } from "../contracts/contrato-smart40-v0.1";
import { validateEvent } from "./validate";

export const BUS_PREFIX = "smart40:";

export const SUBSCRIBED_TYPES = [
  "machine.telemetry",
  "robot.telemetry",
  "traceability.piece-scanned",
  "expedition.metrics",
  "command.requested",
  "command.ack",
  "connection.state",
] as const;

export type BusHandlers = {
  onEvent: (event: Smart40Event) => void;
  onInvalid?: (reason: string, raw: unknown) => void;
};

/** Assina os eventos do barramento. Devolve a função que remove TODOS os listeners (usar no unmount). */
export function subscribe(handlers: BusHandlers, target: EventTarget = window): () => void {
  const listener = (e: Event) => {
    const raw = (e as CustomEvent).detail;
    const result = validateEvent(raw);
    if (result.ok) handlers.onEvent(result.event);
    else handlers.onInvalid?.(result.reason, raw);
  };
  for (const type of SUBSCRIBED_TYPES) target.addEventListener(BUS_PREFIX + type, listener);
  return () => {
    for (const type of SUBSCRIBED_TYPES) target.removeEventListener(BUS_PREFIX + type, listener);
  };
}

/** Publica um envelope no barramento (usado pelo mock e pelos comandos simulados). */
export function publish(event: Smart40Event | Record<string, unknown>, target: EventTarget = window): void {
  const type = (event as { type?: unknown }).type;
  const name = BUS_PREFIX + (typeof type === "string" ? type : "unknown");
  target.dispatchEvent(new CustomEvent(name, { detail: event }));
}

let seq = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++seq).toString(36)}`;

/** Monta um comando — na Sprint 1 `simulation` é sempre `true` (o tipo nem permite outro valor). */
export function buildCommand(
  action: CommandRequestedEvent["data"]["action"],
  parameters?: CommandRequestedEvent["data"]["parameters"],
): CommandRequestedEvent {
  return {
    schemaVersion: "0.1.0",
    eventId: newId("g5-cmd-evt"),
    type: "command.requested",
    timestamp: new Date().toISOString(),
    source: "mock",
    data: {
      commandId: newId("g5-cmd"),
      target: "expedition",
      action,
      sourceModule: "expedition",
      simulation: true,
      parameters,
    },
  };
}
