import { useCallback, useEffect, useReducer, useState } from "react";
import { buildCommand, publish, subscribe } from "../bus/eventBus";
import type { CommandAction } from "../contracts/contrato-smart40-v0.1";
import { initialState, reducer } from "./store";

/**
 * Liga o console ao barramento. Todos os listeners e o relógio são removidos no unmount
 * (critério do checklist: nada de setInterval/addEventListener sobrando ao trocar de rota).
 */
export function useConsole(bus: EventTarget = window) {
  const [state, dispatch] = useReducer(reducer, Date.now(), initialState);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const unsubscribe = subscribe(
      {
        onEvent: (event) => dispatch({ kind: "event", event, receivedAt: Date.now() }),
        onInvalid: (reason, raw) => {
          console.warn("[G5] payload inválido descartado:", reason, raw);
          dispatch({ kind: "invalid", reason, receivedAt: Date.now() });
        },
      },
      bus,
    );
    const clock = setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ kind: "tick", now: t });
    }, 500);
    return () => {
      unsubscribe();
      clearInterval(clock);
    };
  }, [bus]);

  const sendCommand = useCallback(
    (action: CommandAction, parameters?: Record<string, string | number | boolean>, orderCode?: string) => {
      const cmd = buildCommand(action, parameters);
      dispatch({ kind: "command-sent", command: cmd, orderCode, sentAt: Date.now() });
      publish(cmd, bus);
    },
    [bus],
  );

  const resetCounters = useCallback(() => dispatch({ kind: "reset", now: Date.now() }), []);

  return { state, now, sendCommand, resetCounters };
}
