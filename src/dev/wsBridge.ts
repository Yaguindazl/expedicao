/**
 * Ponte WebSocket — SÓ PARA O MODO ISOLADO (npm run dev, porta 8084). Sprint 2, passos 3 e 4 do professor.
 *
 * Dentro do App Shell quem abre o WebSocket é o Grupo 1 (uma conexão única para todos).
 * Aqui, rodando sozinhos, esta ponte faz o papel do Shell para testarmos com o simulador do professor:
 *   1. conecta em ws://localhost:8080?token=aluno-token-grupo5 (o token do nosso grupo);
 *   2. repassa cada pacote recebido como `smart40:telemetria` (igual ao código do Grupo 1 no PDF);
 *   3. avisa CONNECTING / CONNECTED / DISCONNECTED com `smart40:connection.state`;
 *   4. se cair, tenta de novo (1 s, 2 s, 4 s... até 10 s).
 *
 * Os comandos do nosso módulo (fechar palete, liberar ordem) NÃO são enviados ao simulador:
 * ele não conhece esses comandos e a regra da turma é só simulação. A ponte responde um
 * `command.ack` SIMULATED na hora, para a tela não ficar esperando.
 */
import { BUS_PREFIX, newId, publish } from "../bus/eventBus";
import type { CommandRequestedEvent, ConnectionState } from "../contracts/contrato-smart40-v0.1";

/** URL padrão: simulador local com o token do Grupo 5. Para Codespaces/Render, defina VITE_SMART40_WS_URL. */
export const DEFAULT_WS_URL = "ws://localhost:8080?token=aluno-token-grupo5";

export class WsBridge {
  private ws: WebSocket | null = null;
  private retry = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;
  private readonly onCommand = (e: Event) => this.ackLocal((e as CustomEvent).detail as CommandRequestedEvent);

  constructor(
    readonly url: string = DEFAULT_WS_URL,
    private readonly target: EventTarget = window,
  ) {}

  start() {
    this.stopped = false;
    this.target.addEventListener(BUS_PREFIX + "command.requested", this.onCommand);
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.target.removeEventListener(BUS_PREFIX + "command.requested", this.onCommand);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
  }

  private connect() {
    this.state("CONNECTING");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.state("CONNECTED");
    };
    ws.onmessage = (msg) => {
      let telemetria: unknown;
      try {
        telemetria = JSON.parse(String(msg.data));
      } catch {
        telemetria = { invalido: String(msg.data).slice(0, 80) }; // o tradutor recusa e o console registra
      }
      this.target.dispatchEvent(new CustomEvent(BUS_PREFIX + "telemetria", { detail: telemetria }));
    };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.state("DISCONNECTED");
      if (this.stopped) return;
      const delay = Math.min(10_000, 1_000 * 2 ** this.retry++);
      this.retryTimer = setTimeout(() => this.connect(), delay);
    };
  }

  private state(state: ConnectionState) {
    publish(
      { schemaVersion: "0.1.0", eventId: newId("ws-conn"), type: "connection.state", timestamp: new Date().toISOString(), source: "mock", data: { state } },
      this.target,
    );
  }

  private ackLocal(cmd: CommandRequestedEvent | undefined) {
    if (!cmd?.data?.commandId || cmd.data.sourceModule !== "expedition") return;
    setTimeout(
      () =>
        publish(
          {
            schemaVersion: "0.1.0",
            eventId: newId("ws-ack"),
            type: "command.ack",
            timestamp: new Date().toISOString(),
            source: "mock",
            data: { commandId: cmd.data.commandId, result: "SIMULATED", message: "Registrado só no console (o simulador do professor não tem esse comando)" },
          },
          this.target,
        ),
      300,
    );
  }
}
