/**
 * Sprint 2 — gráficos com Recharts (pedido do professor: "integração com biblioteca de gráficos").
 *
 *  1. Pizza (rosca) de aprovadas × rejeitadas na sessão — a "pizza do gerente".
 *  2. Ritmo de produção (PPM) nos últimos 10 min.
 *  3. OEE nos últimos 10 min.
 * PPM e OEE ficam em gráficos SEPARADOS: têm escalas diferentes (peças/min × %),
 * e dois eixos no mesmo gráfico confundem a leitura.
 */
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ConsoleState } from "../domain/store";
import { fmtDec, fmtInt, fmtPct, Section } from "./ui";

/** O SVG do Recharts não entende var(--x) em atributos; lemos as cores do theme.css do professor em tempo real. */
function useThemeColors() {
  const ref = useRef<HTMLDivElement>(null);
  const [c, setC] = useState({ primary: "#0284c7", danger: "#ef4444", text2: "#94a3b8", muted: "#64748b", surface: "#1e293b", line: "#334155", app: "#0f172a" });
  useLayoutEffect(() => {
    if (!ref.current) return;
    const cs = getComputedStyle(ref.current);
    const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
    setC((old) => ({
      primary: v("--smart-accent-primary", old.primary),
      danger: v("--smart-status-danger", old.danger),
      text2: v("--smart-text-secondary", old.text2),
      muted: v("--smart-text-muted", old.muted),
      surface: v("--smart-bg-surface", old.surface),
      line: v("--smart-border-color", old.line),
      app: v("--smart-bg-app", old.app),
    }));
  }, []);
  return { ref, c };
}

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

function TipBox({ children }: { children: ReactNode }) {
  return <div className="exp:rounded-lg exp:border exp:border-smart-line exp:bg-smart-app exp:px-3 exp:py-2 exp:text-sm exp:text-smart-text exp:shadow-xl">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="exp:flex exp:h-full exp:items-center exp:justify-center exp:text-sm exp:text-smart-muted">{text}</div>;
}

function TrendChart({
  title,
  data,
  dataKey,
  format,
  axisFormat,
  domainMax,
  colors,
  empty,
}: {
  title: string;
  data: { at: number; v: number | null }[];
  dataKey: "v";
  format: (v: number | null) => string;
  axisFormat: (v: number) => string;
  domainMax?: number;
  colors: ReturnType<typeof useThemeColors>["c"];
  empty: string;
}) {
  const hasData = data.some((d) => d.v !== null);
  const last = [...data].reverse().find((d) => d.v !== null)?.v ?? null;
  const gid = `g5-grad-${title.replace(/\W/g, "")}`;
  return (
    <figure className="exp:m-0 exp:min-w-0">
      <figcaption className="exp:flex exp:items-baseline exp:justify-between exp:text-sm">
        <span className="exp:text-smart-text2">{title}</span>
        <span className="exp:font-medium exp:text-smart-text">{format(last)}</span>
      </figcaption>
      <div className="exp:mt-2 exp:h-36">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 30, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.primary} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={colors.line} strokeOpacity={0.6} />
              <XAxis dataKey="at" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(t) => hhmm(t)} tick={{ fill: colors.muted, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={56} />
              <YAxis domain={[0, domainMax ?? "auto"]} tickFormatter={axisFormat} tick={{ fill: colors.muted, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
              <Tooltip
                cursor={{ stroke: colors.text2, strokeWidth: 1 }}
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TipBox>
                      <div className="exp:text-xs exp:text-smart-text2">{hhmm(payload[0].payload.at)}</div>
                      <div className="exp:font-medium">{format(payload[0].payload.v)}</div>
                    </TipBox>
                  ) : null
                }
              />
              <Area type="monotone" dataKey={dataKey} stroke={colors.primary} strokeWidth={2} fill={`url(#${gid})`} connectNulls isAnimationActive={false} dot={false} activeDot={{ r: 4, stroke: colors.surface, strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Empty text={empty} />
        )}
      </div>
    </figure>
  );
}

export function ChartsPanel({ state }: { state: ConsoleState }) {
  const { ref, c } = useThemeColors();
  const { approved, rejected, produced } = state.session;
  const pie = [
    { name: "Aprovadas", value: approved, color: c.primary },
    { name: "Rejeitadas", value: rejected, color: c.danger },
  ];
  const ppm = state.history.map((h) => ({ at: h.at, v: h.ppm }));
  const oee = state.history.map((h) => ({ at: h.at, v: h.oee }));

  return (
    <Section title="Gráficos da sessão">
      <div ref={ref} className="exp:grid exp:grid-cols-1 exp:gap-6 exp:md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <figure className="exp:m-0">
          <figcaption className="exp:text-sm exp:text-smart-text2">Qualidade das peças</figcaption>
          <div className="exp:relative exp:mt-2 exp:h-36">
            {produced > 0 ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" stroke={c.surface} strokeWidth={2} startAngle={90} endAngle={-270} isAnimationActive={false}>
                      {pie.map((p) => (
                        <Cell key={p.name} fill={p.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <TipBox>
                            {payload[0].name}: <b>{fmtInt(payload[0].value as number)}</b> ({fmtPct((payload[0].value as number) / produced)})
                          </TipBox>
                        ) : null
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="exp:pointer-events-none exp:absolute exp:inset-0 exp:flex exp:flex-col exp:items-center exp:justify-center">
                  <span className="exp:text-xl exp:font-semibold exp:text-smart-text">{fmtInt(produced)}</span>
                  <span className="exp:text-xs exp:text-smart-text2">peças</span>
                </div>
              </>
            ) : (
              <Empty text="Nenhuma peça inspecionada ainda" />
            )}
          </div>
          <ul className="exp:m-0 exp:mt-3 exp:flex exp:list-none exp:justify-center exp:gap-4 exp:p-0 exp:text-sm">
            {pie.map((p) => (
              <li key={p.name} className="exp:flex exp:items-center exp:gap-1.5">
                <span aria-hidden="true" className="exp:inline-block exp:h-2.5 exp:w-2.5 exp:rounded-sm" style={{ background: p.color }} />
                <span className="exp:text-smart-text2">{p.name}</span>
                <span className="exp:text-smart-text">{fmtInt(p.value)}</span>
              </li>
            ))}
          </ul>
        </figure>

        <TrendChart
          title="Ritmo (peças por minuto)"
          data={ppm}
          dataKey="v"
          format={(v) => (v === null ? "N/D" : `${fmtDec(v)} /min`)}
          axisFormat={(v) => fmtDec(v, 0)}
          colors={c}
          empty="O gráfico começa após 10 s de dados"
        />
        <TrendChart
          title="OEE ao longo do tempo"
          data={oee}
          dataKey="v"
          format={(v) => fmtPct(v)}
          axisFormat={(v) => `${Math.round(v * 100)}%`}
          domainMax={1}
          colors={c}
          empty="O gráfico começa após 5 s de dados"
        />
      </div>
      <p className="exp:mt-4 exp:text-xs exp:text-smart-muted">Um ponto a cada 5 s, últimos 10 minutos. Os gráficos recomeçam quando os contadores são zerados.</p>
    </Section>
  );
}
