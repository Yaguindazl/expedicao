import type { CommandAction } from "../contracts/contrato-smart40-v0.1";
import { nomeArquivoCsv, ordensParaCsv } from "../domain/csv";
import type { ConsoleState } from "../domain/store";
import type { OrderStatus } from "../mocks/fixtures";
import { Button, MockTag, Section } from "./ui";

const STATUS_CLASS: Record<OrderStatus, string> = {
  "EM PRODUÇÃO": "exp:text-smart-text",
  "NA FILA": "exp:text-smart-text2",
  LIBERADA: "exp:text-smart-digital",
  CONCLUÍDA: "exp:text-smart-text2",
};
const STATUS_PT: Record<OrderStatus, string> = { "EM PRODUÇÃO": "Em produção", "NA FILA": "Na fila", LIBERADA: "Liberada", CONCLUÍDA: "Concluída" };

/** Ordens de produção (R7): campos espelham o Swagger da F4 API; liberar é só simulação. */
export function OrdersTable({
  state,
  canCommand,
  blockReason,
  send,
}: {
  state: ConsoleState;
  canCommand: boolean;
  blockReason?: string;
  send: (action: CommandAction, params?: Record<string, string>, orderCode?: string) => void;
}) {
  const pendingFor = new Set(state.commands.filter((c) => c.action === "ORDER_RELEASE" && !c.result).map((c) => c.orderCode));

  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([ordensParaCsv(state.orders)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivoCsv(new Date());
    a.click();
    URL.revokeObjectURL(url);
  };

  const th = "exp:px-5 exp:pb-2 exp:text-left exp:text-sm exp:font-normal exp:text-smart-text2";
  const td = "exp:px-5 exp:py-3 exp:text-sm exp:border-t exp:border-smart-line";

  return (
    <Section
      title="Ordens de produção"
      aside={
        <div className="exp:flex exp:items-center exp:gap-3">
          <MockTag />
          <Button variant="quiet" onClick={exportCsv}>
            Baixar CSV
          </Button>
        </div>
      }
    >
      <div className="exp:-mx-5 exp:overflow-x-auto">
        <table className="exp:w-full exp:border-collapse">
          <thead>
            <tr>
              <th className={th}>Ordem</th>
              <th className={th}>Produto</th>
              <th className={`${th} exp:text-right`}>Qtd.</th>
              <th className={th}>Destino</th>
              <th className={th}>Entrega</th>
              <th className={th}>Situação</th>
              <th className={th}>
                <span className="exp:sr-only">Ação</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.orders.map((o) => (
              <tr key={o.code}>
                <td className={`${td} exp:whitespace-nowrap exp:text-smart-text`}>{o.code}</td>
                <td className={`${td} exp:text-smart-text`}>{o.productName}</td>
                <td className={`${td} exp:text-right exp:text-smart-text`}>{o.quantity}</td>
                <td className={`${td} exp:text-smart-text2`}>{o.destination}</td>
                <td className={`${td} exp:whitespace-nowrap exp:text-smart-text2`}>{new Date(o.dueDate).toLocaleDateString("pt-BR")}</td>
                <td className={`${td} exp:whitespace-nowrap ${STATUS_CLASS[o.status]}`}>{STATUS_PT[o.status]}</td>
                <td className={`${td} exp:py-2 exp:text-right`}>
                  {o.status === "NA FILA" ? (
                    <Button
                      variant="quiet"
                      disabled={!canCommand || pendingFor.has(o.code)}
                      title={canCommand ? "Envia ORDER_RELEASE com simulation: true" : `Indisponível: ${blockReason}`}
                      onClick={() => send("ORDER_RELEASE", { orderCode: o.code }, o.code)}
                    >
                      {pendingFor.has(o.code) ? "Liberando…" : "Liberar"}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
