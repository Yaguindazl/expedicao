import type { CommandAction } from "../contracts/contrato-smart40-v0.1";
import type { ConsoleState } from "../domain/store";
import { Button, fmtInt, MockTag, Section, Stat } from "./ui";

/** Posto de expedição (R6): palete, fila e o comando simulado de fechar palete. */
export function ExpeditionPanel({
  state,
  canCommand,
  blockReason,
  send,
}: {
  state: ConsoleState;
  canCommand: boolean;
  blockReason?: string;
  send: (action: CommandAction) => void;
}) {
  const e = state.expedition?.data;
  const hasPallet = !!e?.pallet;
  // 28 = posições da expedição no CLP (DB9, pos1–pos28); usado só para desenhar enquanto não chega dado
  const cap = e?.pallet?.capacity ?? 28;
  const count = e?.pallet?.currentCount ?? 0;
  const full = hasPallet && count >= cap;
  const simulated = !state.expedition || state.expedition.source === "mock";
  const pending = state.commands.find((c) => c.action === "PALLETIZE" && !c.result);
  const last = state.commands.find((c) => c.action === "PALLETIZE" && c.result);
  const lastFailed = last && (last.result === "REJECTED" || last.result === "TIMEOUT");

  return (
    <Section title="Expedição" aside={simulated ? <MockTag /> : null}>
      <div className="exp:flex exp:items-baseline exp:justify-between">
        <span className="exp:text-sm exp:text-smart-text2">Palete atual</span>
        {full ? <span className="exp:text-sm exp:font-medium exp:text-smart-warn">Cheio</span> : null}
      </div>
      <div className="exp:mt-1 exp:text-4xl exp:font-semibold exp:leading-none exp:text-smart-text">
        {hasPallet ? fmtInt(count) : "N/D"}
        {hasPallet ? <span className="exp:ml-1.5 exp:text-base exp:font-normal exp:text-smart-text2">de {fmtInt(cap)} peças</span> : null}
      </div>
      {e && !hasPallet ? <p className="exp:mt-2 exp:text-sm exp:text-smart-text2">A fonte atual não informa o palete.</p> : null}
      <div className="exp:mt-4 exp:grid exp:gap-1" style={{ display: hasPallet ? undefined : "none", gridTemplateColumns: `repeat(${cap}, minmax(0, 1fr))` }} role="progressbar" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={count} aria-label="Ocupação do palete">
        {Array.from({ length: cap }, (_, i) => (
          <div key={i} className={`exp:h-2.5 exp:rounded-sm exp:transition-colors ${i < count ? (full ? "exp:bg-smart-warn" : "exp:bg-smart-primary") : "exp:bg-smart-raised"}`} />
        ))}
      </div>

      <div className="exp:mt-6 exp:grid exp:grid-cols-2 exp:gap-6">
        <Stat label="Na fila" value={fmtInt(e?.outputQueue)} unit="peças" origin="expedition.metrics.outputQueue" tone={e && e.outputQueue >= 5 ? "atencao" : "normal"} />
        <Stat label="Ordens ativas" value={fmtInt(e?.activeOrders)} origin="expedition.metrics.activeOrders" />
      </div>

      <div className="exp:mt-6">
        <Button onClick={() => send("PALLETIZE")} disabled={!canCommand || !!pending} title={canCommand ? "Envia o comando com simulation: true" : `Indisponível: ${blockReason}`}>
          {pending ? "Fechando palete…" : "Fechar palete"}
        </Button>
        <p className={`exp:mt-2 exp:min-h-5 exp:text-sm ${!canCommand ? "exp:text-smart-warn" : lastFailed ? "exp:text-smart-warn" : "exp:text-smart-text2"}`}>
          {!canCommand
            ? `Indisponível: ${blockReason}.`
            : last
              ? lastFailed
                ? `Não executado: ${last.message ?? "sem resposta do simulador"}.`
                : `${last.message ?? "Comando confirmado"}.`
              : "O comando é apenas simulado."}
        </p>
      </div>
    </Section>
  );
}
