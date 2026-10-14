/**
 * Modo ISOLADO (npm run dev → http://localhost:8084).
 * Sobe o simulador local no lugar do App Shell, para o grupo trabalhar sem depender dos outros.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { MockProducer } from "./mocks/mockProducer";
import "./styles/theme.css"; // no Shell quem importa é o Grupo 1; aqui importamos para rodar sozinho
import "./styles/g5.css";

const mock = new MockProducer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App standaloneMock={mock} />
  </StrictMode>,
);

// o mock começa depois que o React montou e assinou o barramento
setTimeout(() => mock.start(), 0);
