// Simulador do professor (mock_server_smart40.js), copiado sem alterações. Extensão .cjs porque o projeto usa ES modules.
/**
 * SIMULADOR WEBSOCKET COM AUTENTICAÇÃO - ESTAÇÃO SMART 4.0
 * 
 * Dependência: npm install ws
 * Execução: node mock_server_smart40.js
 * Endpoint: ws://localhost:8080?token=smart40-token-2026
 */

const http = require('http');
const { WebSocketServer, WebSocket } = require('ws');

// ==========================================
// CONFIGURAÇÕES & SEGURANÇA
// ==========================================
const PORT = process.env.PORT || 8080;
const TOKENS_VALIDOS = new Set([
  'smart40-token-2026',
  'aluno-token-grupo1',
  'aluno-token-grupo2',
  'aluno-token-grupo3',
  'aluno-token-grupo4',
  'aluno-token-grupo5',
]);

const ORIGENS_PERMITIDAS = [
  'http://localhost:9000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:8084',
  'https://smart40-shell.vercel.app',
];

// ==========================================
// ESTADO DA SIMULAÇÃO DA MÁQUINA
// ==========================================
let estadoSimulacao = {
  estadoGlobal: 'EM_EXECUCAO', // 'PRONTA' | 'EM_EXECUCAO' | 'PARADA_EMERGENCIA'
  modoOperacao: 'AUTOMATICO',  // 'MANUAL' | 'AUTOMATICO' | 'MANUTENCAO'
  velocidadeEsteiraAtual: 65,  // 0 a 100%
  travaSegurancaAtiva: false,
  pressaoPneumaticaBar: 6.2,

  // Braço Robótico Universal Robots
  roboUR: {
    conectado: true,
    programaAtivo: 'ROTINA_PALETIZACAO_MAIN',
    executandoRotina: true,
    garraFechada: false,
    temperaturaMotoresC: 42.5,
    posicaoCartesiana: { x: 350.0, y: -120.0, z: 215.0, rx: 0.0, ry: 180.0, rz: 45.0 },
    posicaoJuntas: { j1: 0.0, j2: -90.0, j3: 90.0, j4: -90.0, j5: -90.0, j6: 0.0 }
  },

  // Última Peça Lida pelo QR Code
  ultimaPecaLida: {
    idPeca: 'PECA-001',
    codigoLote: 'LOTE-2026-A9',
    timestampLeitura: new Date().toISOString(),
    qualidadeSuperficie: 98.5,
    statusInspecao: 'APROVADA'
  },

  // Métricas do Posto de Expedição
  metricasExpedicao: {
    pecasProcessadasTotal: 142,
    pecasAprovadasCount: 138,
    pecasRejeitadasCount: 4,
    tamanhoFilaSaida: 3,
    ritmoProducaoPecasPorMinuto: 12.4,
    oeePercentual: 88.5
  }
};

// ==========================================
// SERVIDORES HTTP & WEBSOCKET
// ==========================================
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Servidor Mock WebSocket SMART 4.0 ativo. Conecte via ws:// (com token de autenticação).\n');
});

const wss = new WebSocketServer({ noServer: true });

// ------------------------------------------
// AUTENTICAÇÃO NO HANDSHAKE (UPGRADE)
// ------------------------------------------
server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const token = requestUrl.searchParams.get('token') || request.headers['x-api-key'];
  const origem = request.headers.origin;

  console.log(`\n[HANDSHAKE] Tentativa de conexão recebida.`);
  console.log(` -> Origem: ${origem || 'Desconhecida/Local'}`);
  console.log(` -> Token fornecido: ${token || 'Nenhum'}`);

  // 1. Validar Token de Autenticação
  if (!token || !TOKENS_VALIDOS.has(token)) {
    console.log(` ❌ RECUSADO: Token inválido ou ausente!`);
    socket.write('HTTP/1.1 401 Unauthorized\r\nContent-Type: text/plain\r\n\r\nToken de autenticacao invalido ou ausente.\r\n');
    socket.destroy();
    return;
  }

  // 2. Validar Origem (se presente no cabeçalho)
  if (origem && !ORIGENS_PERMITIDAS.some(o => origem.startsWith(o)) && !origem.includes('localhost') && !origem.includes('127.0.0.1')) {
    console.log(` ❌ RECUSADO: Origem não permitida (${origem})`);
    socket.write('HTTP/1.1 403 Forbidden\r\nContent-Type: text/plain\r\n\r\nOrigem nao autorizada.\r\n');
    socket.destroy();
    return;
  }

  console.log(` ✅ AUTENTICADO: Conexão aceita com sucesso.`);
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// ==========================================
// GERENCIAMENTO DAS CONEXÕES E MENSAGENS
// ==========================================
let contadorPecas = 142;

wss.on('connection', (ws, req) => {
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  console.log(` [CLIENTE CONECTADO] Total de clientes ativos: ${wss.clients.size}`);

  // Trata mensagens de comando enviadas pelos grupos (ex.: IHM Siemens)
  ws.on('message', (messageBuffer) => {
    try {
      const comando = JSON.parse(messageBuffer.toString());
      console.log(`\n📩 [COMANDO RECEBIDO] de ${comando.origem || 'Desconhecido'}:`, comando);

      switch (comando.acao) {
        case 'EMERGENCY_STOP':
          estadoSimulacao.estadoGlobal = 'PARADA_EMERGENCIA';
          estadoSimulacao.velocidadeEsteiraAtual = 0;
          estadoSimulacao.travaSegurancaAtiva = true;
          estadoSimulacao.roboUR.executandoRotina = false;
          console.log(` 🚨 PARADA DE EMERGÊNCIA ATIVADA VIA FRONT-END!`);
          break;

        case 'START':
          if (!estadoSimulacao.travaSegurancaAtiva) {
            estadoSimulacao.estadoGlobal = 'EM_EXECUCAO';
            estadoSimulacao.velocidadeEsteiraAtual = 65;
            estadoSimulacao.roboUR.executandoRotina = true;
            console.log(` ▶️ MÁQUINA INICIADA.`);
          } else {
            console.log(` ⚠️ Não é possível iniciar: Trava de emergência ativa! Acione RESET.`);
          }
          break;

        case 'STOP':
          estadoSimulacao.estadoGlobal = 'PRONTA';
          estadoSimulacao.velocidadeEsteiraAtual = 0;
          estadoSimulacao.roboUR.executandoRotina = false;
          console.log(` ⏸️ MÁQUINA PARADA.`);
          break;

        case 'RESET':
          estadoSimulacao.estadoGlobal = 'PRONTA';
          estadoSimulacao.travaSegurancaAtiva = false;
          console.log(` 🔄 SISTEMA REINICIALIZADO. Pronto para partida.`);
          break;

        default:
          console.log(` ❓ Comando não reconhecido: ${comando.acao}`);
      }
    } catch (err) {
      console.error(' ❌ Erro ao processar mensagem JSON recebida:', err.message);
    }
  });

  ws.on('close', () => {
    console.log(` [CLIENTE DESCONECTADO] Clientes restantes: ${wss.clients.size}`);
  });
});

// ------------------------------------------
// HEARTBEAT (PING/PONG) PARA CONEXÕES ZUMBIS
// ------------------------------------------
const intervalPing = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(intervalPing);
});

// ==========================================
// LAÇO DE SIMULAÇÃO DE TELEMETRIA (500ms)
// ==========================================
let passoAnimacao = 0;

setInterval(() => {
  // Só anima dados dinâmicos se a máquina estiver EM_EXECUCAO
  if (estadoSimulacao.estadoGlobal === 'EM_EXECUCAO') {
    passoAnimacao += 0.1;

    // Simula movimento suave das articulações do robô
    estadoSimulacao.roboUR.posicaoJuntas.j1 = Number((Math.sin(passoAnimacao) * 45).toFixed(1));
    estadoSimulacao.roboUR.posicaoJuntas.j2 = Number((-90 + Math.cos(passoAnimacao) * 20).toFixed(1));
    estadoSimulacao.roboUR.posicaoJuntas.j3 = Number((90 + Math.sin(passoAnimacao) * 15).toFixed(1));

    // Simula pulso na temperatura dos motores
    estadoSimulacao.roboUR.temperaturaMotoresC = Number((42.0 + Math.sin(passoAnimacao) * 1.5).toFixed(1));

    // A cada ~10 segundos simula a leitura de uma nova peça na esteira
    if (Math.floor(passoAnimacao * 10) % 20 === 0) {
      contadorPecas++;
      const aprovada = Math.random() > 0.08; // 92% de taxa de aprovação
      
      estadoSimulacao.ultimaPecaLida = {
        idPeca: `PECA-${String(contadorPecas).padStart(3, '0')}`,
        codigoLote: 'LOTE-2026-A9',
        timestampLeitura: new Date().toISOString(),
        qualidadeSuperficie: Number((aprovada ? 95 + Math.random() * 5 : 70 + Math.random() * 15).toFixed(1)),
        statusInspecao: aprovada ? 'APROVADA' : 'REJEITADA'
      };

      // Atualiza contadores da expedição
      estadoSimulacao.metricasExpedicao.pecasProcessadasTotal++;
      if (aprovada) {
        estadoSimulacao.metricasExpedicao.pecasAprovadasCount++;
      } else {
        estadoSimulacao.metricasExpedicao.pecasRejeitadasCount++;
      }
    }
  }

  // Prepara o payload completo da telemetria
  const payloadTelemetria = JSON.stringify({
    timestamp: new Date().toISOString(),

    estadoGlobal: estadoSimulacao.estadoGlobal,
    modoOperacao: estadoSimulacao.modoOperacao,
    velocidadeEsteiraAtual: estadoSimulacao.velocidadeEsteiraAtual,

    estacaoIhm: {
      travaSegurancaAtiva: estadoSimulacao.travaSegurancaAtiva,
      pressaoPneumaticaBar: estadoSimulacao.pressaoPneumaticaBar
    },

    roboUR: estadoSimulacao.roboUR,
    ultimaPecaLida: estadoSimulacao.ultimaPecaLida,
    metricasExpedicao: estadoSimulacao.metricasExpedicao
  });

  // Transmite para todos os clientes autenticados e conectados
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payloadTelemetria);
    }
  });

}, 500);

// ==========================================
// INICIALIZAÇÃO
// ==========================================
server.listen(PORT, () => {
  console.log(`
================================================================
🚀 SIMULADOR WEBSOCKET SMART 4.0 (COM AUTENTICAÇÃO)
================================================================
Servidor rodando na porta: ${PORT}
URL de Conexão (com Token):
 -> ws://localhost:${PORT}?token=smart40-token-2026

Tokens Autorizados:
 - smart40-token-2026 (Padrão)
 - aluno-token-grupo1 ate aluno-token-grupo5

Origens Permitidas: Localhost e Vercel
================================================================
  `);
});
