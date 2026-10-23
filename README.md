# SMART 4.0 · Grupo 5 · Console de Produção (Expedição & OEE)

Micro-frontend do **Grupo 5** da Planta N2: acompanha o processo inteiro, narra o que acontece em frases simples e mostra os resultados da expedição (OEE, ritmo, refugo, palete, ordens).
**Somente dados simulados.** Nenhum comando chega ao CLP, ao robô ou à esteira. Todo comando sai com `simulation: true`.

Stack: **React 18 + TypeScript + Vite + Tailwind CSS v4 + Recharts**, integrável ao App Shell por **Single-SPA** (`single-spa-react`).

## Sprint 2: o que entrou

O PDF da Sprint 2 pede ao Grupo 5: cartões de KPI, biblioteca de gráficos, cálculo dinâmico do OEE %, função de reset dos contadores e deploy na Vercel (porta 8084). Também pede para testar com o simulador WebSocket do professor, usando o token do grupo.

| Pedido do professor | Onde está |
| --- | --- |
| Cartões de KPI | painel **Desempenho**: OEE, produzidas, ritmo (PPM), refugo e falhas |
| Biblioteca de gráficos (Chart.js ou Recharts) | **Recharts**, em `components/ChartsPanel.tsx`: pizza de aprovadas × rejeitadas, PPM e OEE nos últimos 10 min |
| Cálculo dinâmico do OEE % e do PPM | `domain/oee.ts` (`calcularOee` e `ppmJanela`), recalculados a cada atualização |
| Função de reset dos contadores | botão **Zerar contadores** (pede confirmação). Zera só a tela, nada vai para a máquina |
| WebSocket com token (`?token=aluno-token-grupo5`) | `dev/wsBridge.ts`, só no modo isolado. No Shell, quem conecta é o Grupo 1 |
| Formato do simulador do professor | `bus/telemetriaAdapter.ts` traduz `smart40:telemetria` para os eventos do contrato |
| Codespaces e deploy automático | `.devcontainer/devcontainer.json`, `.github/workflows/deploy-vercel.yml`, `vercel.json` |

Sobre a fórmula: o exemplo do PDF calcula `aprovadas ÷ (aprovadas + rejeitadas)`. Isso é o fator **Qualidade** do OEE. O console mostra esse fator e o OEE completo (Disponibilidade × Performance × Qualidade).

O que o simulador do professor **não** manda aparece como `N/D`, nunca como zero: palete, ordens ativas e velocidade do robô. O `oeePercentual` e o `ritmoProducaoPecasPorMinuto` dele são valores fixos, então o console calcula os seus a partir das peças que passam.

### Testar com o simulador do professor

Em dois terminais:

```bash
npm run simulador   # simulador do professor em ws://localhost:8080
npm run dev         # console em http://localhost:8084
```

Abra **http://localhost:8084/?fonte=professor** (ou use o botão "Simulador" → "WebSocket"). Sem o `?fonte=professor`, a tela usa o simulador interno do Grupo 5, que funciona sem internet.

No Codespaces ou com o simulador no Render, crie um arquivo `.env` com a URL pública (veja `.env.example`).

### Deploy na Vercel (GitHub Actions)

Cada `git push` na `main` roda os testes, gera o build e publica. Antes do primeiro push, cadastre em **Settings → Secrets and variables → Actions** do repositório: `VERCEL_TOKEN`, `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID`.

O build publica duas coisas: a tela isolada (`/`) e o módulo para o App Shell (`/smart40-expedicao-oee.js`, com CORS liberado no `vercel.json`).

## Como rodar

Use Node 20.19 ou mais novo (https://nodejs.org).

```bash
npm install
npm run dev        # modo isolado em http://localhost:8084, com o simulador local
npm test           # testes unitários (Vitest)
npm run lint       # checagem de tipos (tsc)
npm run simulador  # simulador WebSocket do professor (porta 8080)
npm run build      # tela isolada + módulo do Shell, tudo na pasta dist/
npm run build:mfe  # só o módulo para o App Shell (dist-mfe/smart40-expedicao-oee.js)
```

## O que a tela entrega (runbook, Grupo 5)

| Item do runbook | Onde está |
| --- | --- |
| Estação visual "EXPEDIÇÃO" com palete e fila | `PalletPanel` |
| Cards de peças/min, fila, total e palete, cada um com unidade e origem | `Kpis` |
| Selo MOCK em todo valor sintético | `MockBadge` em cards, palete, ordens |
| Lista mock de pedidos com destino; liberação e paletização simuladas | `OrdersTable`, `PalletPanel` → `command.requested` + `command.ack` |
| Fórmula de OEE proposta, sem apresentar como medição real | `domain/oee.ts` + `OeePanel` com selo PROTÓTIPO |
| Sinais faltantes para o OEE | `contracts/proposta-g5-v0.2.ts` |
| Proposta do grupo: linha das 5 estações + "conversa" do processo | `LineStrip`, `Feed`, `domain/narrator.ts` |

## Como a tela é organizada

A leitura vai de cima para baixo, do geral para o detalhe:

1. **Linha de produção:** as 5 etapas na ordem da peça (IHM → Robô → QR Code → Esteira → Expedição). Cada etapa leva à tela do grupo responsável.
2. **Desempenho:** o OEE em destaque, os três fatores ao lado e, embaixo, peças produzidas, ritmo, refugo, falhas e o tempo por estado.
3. **Expedição:** o palete, a fila e o botão "Fechar palete".
4. **Ordens de produção:** a tabela com o botão "Liberar".
5. **Acontecimentos** (coluna da direita): a "conversa" do processo, com filtro de alertas.

Princípio visual, inspirado na ISA-101 (norma de IHM de alto desempenho): o que está normal fica neutro, e a cor forte aparece só quando algo sai do normal (amarelo para atenção, vermelho para alarme). A origem de cada número aparece ao passar o mouse sobre ele. A fonte é a IBM Plex Sans, e sem internet a tela usa a fonte do `theme.css`.

## Regras de integração seguidas

- **Não abre conexão própria.** O módulo só escuta o barramento `smart40:<tipo>`, publicado pelo App Shell como `CustomEvent` no `window`, com o envelope do contrato em `detail`. Se o Grupo 1 escolher outro mecanismo, só `src/bus/eventBus.ts` muda.
- **Contrato v0.1 sem alterações** (`src/contracts/contrato-smart40-v0.1.ts`). Os extras da proposta v0.2 são opcionais. Sem eles a tela mostra `N/D`, nunca zero.
- **Payload inválido é descartado e registrado no feed**, sem travar a tela (`src/bus/validate.ts`).
- **Leitura de QR repetida não conta duas vezes.** A deduplicação usa `eventId` e `pieceId`.
- **Sem telemetria por mais de 3 s, a tela marca "DADO VENCIDO".** Desconectado, o módulo mostra um aviso e mantém os últimos valores.
- **Comandos ficam bloqueados** com o módulo desconectado, com dado vencido ou em emergência. Comando sem resposta vira `TIMEOUT` depois de 3 s.
- **Tailwind sem preflight e com prefixo `exp:`.** O CSS do grupo não altera a página dos outros módulos, e as cores vêm do `theme.css` (`exp:bg-smart-surface` etc.).
- **No `unmount`**, o módulo remove listeners, relógio e o `<style>` que injetou.

## Integração com o App Shell (Grupo 1)

```json
{ "imports": { "@smart40/expedicao-oee": "http://localhost:8084/smart40-expedicao-oee.js" } }
```

Depois do deploy, o Grupo 1 troca o endereço pela URL da Vercel: `https://<nosso-projeto>.vercel.app/smart40-expedicao-oee.js`.

O módulo escuta os eventos do contrato (`smart40:machine.telemetry` etc.) **e** o pacote do simulador do professor repassado como `smart40:telemetria`, como no código do Grupo 1 no PDF da Sprint 2. Funciona com qualquer um dos dois.

Para servir o módulo localmente: `npm run build:mfe && npx vite preview --outDir dist-mfe --port 8084`.

```js
registerApplication({
  name: "@smart40/expedicao-oee",
  app: () => System.import("@smart40/expedicao-oee"),
  activeWhen: ["/expedicao"],
});
```

Pedido ao Grupo 1: o módulo pode montar depois que o Shell publicou `connection.state`. Por isso, o Shell deve republicar o último estado quando um módulo monta, ou mandar um heartbeat. Enquanto isso não acontece, o módulo considera a conexão ativa assim que recebe telemetria.

## Roteiro de testes com o simulador local (seção 7 do runbook)

O botão "Simulador", no canto inferior direito, aparece só no modo isolado.

| Cenário | Como testar | Resultado esperado |
| --- | --- | --- |
| Telemetria | abrir a página | estações, cards e feed atualizam sozinhos |
| Comando simulado | "Fechar palete" ou "Liberar" uma ordem | feed mostra a solicitação e o ACK; OP vira LIBERADA |
| Emergência | "Acionar emergência" | aviso vermelho, comandos bloqueados, mensagem crítica, 1 falha contada |
| Queda de conexão | "Derrubar conexão" | aviso de conexão perdida, estações "DADO VENCIDO"; volta com "Reconectar" |
| Payload inválido | "Enviar dado inválido" | descartado e registrado no feed; tela segue funcionando |
| QR repetido | "Repetir a última leitura de QR" | nenhuma frase ou contagem duplicada |

## Estrutura

```
src/
  contracts/   contrato v0.1 (oficial) + proposta v0.2 do G5
  bus/         barramento smart40:*, validação e tradutor da telemetria do professor
  dev/         ponte WebSocket (só no modo isolado)
  mocks/       simulador determinístico e fixtures (ordens, ciclo ideal HIPOTÉTICO)
  domain/      OEE, narrador (evento → frase), estado (reducer) e hook
  components/  telas (inclui ChartsPanel, com os gráficos)
tools/         simulador do professor (mock_server_smart40.cjs)
  App.tsx                    console
  main.tsx                   entrada do modo isolado
  smart40-expedicao-oee.tsx  lifecycles do Single-SPA
```

## Pendências para validar com o responsável técnico

- Ciclo ideal e tempo planejado do turno. O protótipo usa um ciclo **hipotético** de 3,5 s.
- Aprovação da proposta v0.2: aprovadas/rejeitadas, `shift-config`, `piece-dispatched` e `pieceId` no robô.
- Se uma parada por STOP conta como parada não planejada no OEE.
- A esteira não tem evento próprio no v0.1. O estado dela é **inferido** do estado da máquina e aparece marcado como tal.
