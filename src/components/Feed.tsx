import { useMemo, useState } from "react";
import type { FeedItem } from "../domain/narrator";
import { fmtTime, Section } from "./ui";

type Filter = "tudo" | "alertas";

/** "A conversa" do processo (C2): uma linha por acontecimento, o mais recente no topo. */
export function Feed({ items }: { items: FeedItem[] }) {
  const [filter, setFilter] = useState<Filter>("tudo");
  const alerts = useMemo(() => items.filter((i) => i.severity !== "info"), [items]);
  const shown = filter === "tudo" ? items : alerts;

  const tab = (value: Filter, label: string) => (
    <button
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`exp:cursor-pointer exp:whitespace-nowrap exp:rounded-md exp:border-0 exp:px-3 exp:py-1 exp:text-sm exp:transition-colors ${
        filter === value ? "exp:bg-smart-surface exp:text-smart-text exp:shadow" : "exp:bg-transparent exp:text-smart-text2 exp:hover:text-smart-text"
      }`}
    >
      {label}
    </button>
  );

  return (
    <Section
      title="Acontecimentos"
      className="exp:flex exp:h-full exp:flex-col"
      aside={
        <div className="exp:flex exp:rounded-lg exp:bg-smart-raised exp:p-0.5" role="group" aria-label="Filtrar mensagens">
          {tab("tudo", "Tudo")}
          {tab("alertas", `Alertas${alerts.length ? ` (${alerts.length})` : ""}`)}
        </div>
      }
    >
      <ol className="exp:-mx-5 exp:m-0 exp:flex-1 exp:list-none exp:overflow-y-auto exp:p-0 exp:lg:max-h-[640px]" aria-live="polite">
        {shown.length === 0 ? (
          <li className="exp:px-5 exp:py-8 exp:text-sm exp:text-smart-muted">{filter === "alertas" ? "Nenhum alerta até agora." : "As mensagens aparecem aqui assim que a linha começar a mandar dados."}</li>
        ) : (
          shown.map((i) => (
            <li key={i.id} className="exp:grid exp:grid-cols-[4.5rem_1fr] exp:gap-3 exp:border-t exp:border-smart-line exp:px-5 exp:py-3 exp:first:border-t-0">
              <time className="exp:pt-0.5 exp:text-sm exp:text-smart-muted" dateTime={i.at}>
                {fmtTime(i.at)}
              </time>
              <div>
                <p className={`exp:text-sm exp:leading-snug ${i.severity === "critico" ? "exp:font-medium exp:text-smart-danger" : i.severity === "alerta" ? "exp:text-smart-warn" : "exp:text-smart-text"}`}>{i.text}</p>
                <p className="exp:mt-0.5 exp:text-xs exp:text-smart-muted">{i.station}</p>
              </div>
            </li>
          ))
        )}
      </ol>
    </Section>
  );
}
