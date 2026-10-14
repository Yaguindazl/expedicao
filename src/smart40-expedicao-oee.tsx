/**
 * Entrada do micro-frontend para o App Shell (Single-SPA + import map).
 *
 * No import map do Grupo 1:
 *   "@smart40/expedicao-oee": "http://localhost:8084/smart40-expedicao-oee.js"   (dev: npm run build:mfe && npm run preview)
 *
 * No root-config do Grupo 1:
 *   registerApplication({ name: "@smart40/expedicao-oee", app: () => System.import("@smart40/expedicao-oee"), activeWhen: ["/expedicao"] });
 *
 * Neste modo NÃO existe mock: os eventos vêm do barramento `smart40:*` publicado pelo App Shell.
 */
import React from "react";
import ReactDOMClient from "react-dom/client";
import singleSpaReact from "single-spa-react";
import { App } from "./App";
import css from "./styles/g5.css?inline";

const STYLE_ID = "smart40-g5-styles";

const lifecycles = singleSpaReact({
  React,
  ReactDOMClient,
  rootComponent: App,
  errorBoundary(err: Error) {
    // uma falha na nossa tela não pode derrubar o Shell nem os outros módulos
    console.error("[G5] erro no módulo de expedição:", err);
    return <div className="expedicao-oee-scope" style={{ padding: 16, color: "var(--smart-status-danger)" }}>Módulo Expedição & OEE indisponível. Os demais módulos continuam funcionando.</div>;
  },
});

export const bootstrap = lifecycles.bootstrap;

// mount/unmount injetam e removem o CSS do grupo junto com a tela
export const mount = [
  async () => {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = css;
      document.head.appendChild(style);
    }
  },
  lifecycles.mount,
];

export const unmount = [
  lifecycles.unmount,
  async () => {
    document.getElementById(STYLE_ID)?.remove();
  },
];
