import { useState } from "react";
import type { MockProducer } from "../mocks/mockProducer";
import { Button } from "./ui";

/**
 * Controles do simulador — só no modo isolado (porta 8084), recolhidos num botão no canto
 * para não disputar espaço com a tela. Servem para rodar os cenários de teste do runbook.
 */
export function SimPanel({ mock }: { mock: MockProducer }) {
  const [open, setOpen] = useState(false);
  const [running, setRunning] = useState(true);
  const [emergency, setEmergency] = useState(false);
  const [connected, setConnected] = useState(true);

  return (
    <div className="exp:fixed exp:right-4 exp:bottom-4 exp:z-50 exp:flex exp:flex-col exp:items-end exp:gap-2">
      {open ? (
        <div id="g5-sim" className="exp:w-72 exp:rounded-xl exp:border exp:border-smart-line exp:bg-smart-surface exp:p-4 exp:shadow-2xl">
          <p className="exp:text-sm exp:font-semibold exp:text-smart-text">Simulador de testes</p>
          <p className="exp:mt-1 exp:text-xs exp:leading-relaxed exp:text-smart-text2">Substitui o App Shell no modo isolado. Nada aqui chega à Planta N2.</p>
          <div className="exp:mt-3 exp:grid exp:grid-cols-1 exp:gap-2">
            <Button
              variant="quiet"
              disabled={emergency}
              onClick={() => {
                mock.setRunning(!running);
                setRunning(!running);
              }}
            >
              {running ? "Parar a máquina" : "Ligar a máquina"}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                mock.setEmergency(!emergency);
                setEmergency(!emergency);
                setRunning(false);
              }}
            >
              {emergency ? "Liberar emergência" : "Acionar emergência"}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                mock.setConnected(!connected);
                setConnected(!connected);
              }}
            >
              {connected ? "Derrubar conexão" : "Reconectar"}
            </Button>
            <Button variant="quiet" onClick={() => mock.sendInvalidPayload()}>
              Enviar dado inválido
            </Button>
            <Button variant="quiet" onClick={() => mock.repeatLastScan()}>
              Repetir a última leitura de QR
            </Button>
          </div>
        </div>
      ) : null}
      <Button variant="primary" onClick={() => setOpen(!open)} title="Controles do simulador local">
        {open ? "Fechar simulador" : "Simulador"}
      </Button>
    </div>
  );
}
