/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL do WebSocket do simulador (com ?token=...). Padrão: ws://localhost:8080?token=aluno-token-grupo5 */
  readonly VITE_SMART40_WS_URL?: string;
}
