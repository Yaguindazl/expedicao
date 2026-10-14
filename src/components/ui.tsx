import type { ReactNode } from "react";

export const fmtInt = (n: number | null | undefined) => (n === null || n === undefined ? "N/D" : n.toLocaleString("pt-BR"));
export const fmtDec = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined ? "N/D" : n.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
export const fmtPct = (n: number | null | undefined, digits = 1) => (n === null || n === undefined ? "N/D" : `${fmtDec(n * 100, digits)}%`);
export const fmtDur = (ms: number | null | undefined) => {
  if (ms === null || ms === undefined) return "N/D";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
};
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour12: false });

/**
 * Princípio visual (inspirado na ISA-101, norma de IHM de alto desempenho):
 * o normal é neutro e silencioso; cor forte só aparece quando algo sai do normal.
 */
export type Tone = "normal" | "atencao" | "alarme" | "inativo";

export const TONE_TEXT: Record<Tone, string> = {
  normal: "exp:text-smart-text",
  atencao: "exp:text-smart-warn",
  alarme: "exp:text-smart-danger",
  inativo: "exp:text-smart-muted",
};
export const TONE_DOT: Record<Tone, string> = {
  normal: "exp:bg-smart-ok",
  atencao: "exp:bg-smart-warn",
  alarme: "exp:bg-smart-danger",
  inativo: "exp:bg-smart-off",
};

export function Dot({ tone }: { tone: Tone }) {
  return <span aria-hidden="true" className={`exp:inline-block exp:h-2 exp:w-2 exp:shrink-0 exp:rounded-full ${TONE_DOT[tone]}`} />;
}

/** Bloco de conteúdo: superfície única, sem borda; título em caixa normal. */
export function Section({ title, aside, children, className = "" }: { title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`exp:rounded-xl exp:bg-smart-surface exp:p-5 ${className}`}>
      <header className="exp:mb-4 exp:flex exp:items-baseline exp:justify-between exp:gap-3">
        <h2 className="exp:text-base exp:font-semibold exp:text-smart-text">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Marca discreta de valor sintético (runbook: todo valor simulado é identificado). */
export function MockTag({ label = "simulado" }: { label?: string }) {
  return (
    <span title="Valor gerado pelo simulador — não é medição da Planta N2" className="exp:rounded-full exp:bg-smart-raised exp:px-2 exp:py-0.5 exp:text-xs exp:text-smart-text2">
      {label}
    </span>
  );
}

/** Número com rótulo; a origem do dado fica no tooltip para não poluir a tela. */
export function Stat({ label, value, unit, origin, tone = "normal", size = "md" }: { label: string; value: string; unit?: string; origin: string; tone?: Tone; size?: "md" | "lg" }) {
  return (
    <div title={`Origem: ${origin}`}>
      <div className="exp:text-sm exp:text-smart-text2">{label}</div>
      <div className={`exp:mt-1 exp:font-semibold exp:leading-none ${size === "lg" ? "exp:text-4xl" : "exp:text-2xl"} ${TONE_TEXT[tone]}`}>
        {value}
        {unit && value !== "N/D" ? <span className="exp:ml-1 exp:text-sm exp:font-normal exp:text-smart-text2">{unit}</span> : null}
      </div>
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
  title,
  variant = "primary",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "primary" | "quiet";
}) {
  const base =
    "exp:inline-flex exp:items-center exp:justify-center exp:gap-2 exp:rounded-lg exp:px-4 exp:py-2 exp:text-sm exp:font-medium exp:transition-colors exp:cursor-pointer exp:disabled:cursor-not-allowed exp:disabled:opacity-40";
  const look =
    variant === "primary"
      ? "exp:border-0 exp:bg-smart-primary exp:text-white exp:hover:enabled:bg-smart-primary-hover"
      : "exp:border exp:border-smart-line exp:bg-transparent exp:text-smart-text exp:hover:enabled:bg-smart-raised";
  return (
    <button type="button" className={`${base} ${look}`} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}
