/**
 * Modo ISOLADO (npm run dev → http://localhost:8084).
 * Faz o papel do App Shell para o grupo trabalhar sem depender dos outros. Duas fontes de dados:
 *   - http://localhost:8084                    → simulador interno do Grupo 5 (padrão, funciona offline)
 *   - http://localhost:8084/?fonte=professor   → WebSocket do simulador do professor (Sprint 2),
 *                                                rodando antes `npm run simulador` em outro terminal
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, type StandaloneInfo } from "./App";
import { DEFAULT_WS_URL, WsBridge } from "./dev/wsBridge";
import { MockProducer } from "./mocks/mockProducer";
import "./styles/theme.css"; // no Shell quem importa é o Grupo 1; aqui importamos para rodar sozinho
import "./styles/g5.css";

const fonte = new URLSearchParams(location.search).get("fonte") === "professor" ? "professor" : "interno";
const wsUrl = import.meta.env.VITE_SMART40_WS_URL || DEFAULT_WS_URL;

const mock = fonte === "interno" ? new MockProducer() : undefined;
const bridge = fonte === "professor" ? new WsBridge(wsUrl) : undefined;
const standalone: StandaloneInfo = { fonte, mock, wsUrl: bridge?.url };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App standalone={standalone} />
  </StrictMode>,
);

// a fonte começa depois que o React montou e assinou o barramento
setTimeout(() => (mock ? mock.start() : bridge?.start()), 0);
