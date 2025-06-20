#!/usr/bin/env node
/**
 * Servidor MCP Persistente - BiancaTools
 * 
 * Roda em background mantendo o navegador aberto entre comandos
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Iniciando servidor MCP persistente...');

// Caminho para o servidor compilado
const serverPath = path.join(__dirname, 'build', 'index.js');

// Spawn do servidor em background
const server = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'inherit'], // stdin/stdout como pipe, stderr herdado
  detached: false // Manter vinculado ao processo pai
});

console.log(`📡 Servidor MCP iniciado com PID: ${server.pid}`);
console.log('🌐 Navegador será mantido aberto entre comandos');
console.log('📝 Para parar: Ctrl+C ou kill do processo');

// Manter o processo vivo
server.on('close', (code) => {
  console.log(`❌ Servidor MCP encerrado com código: ${code}`);
  process.exit(code);
});

server.on('error', (error) => {
  console.error('❌ Erro no servidor MCP:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor MCP...');
  server.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  console.log('🛑 Encerrando servidor MCP...');
  server.kill('SIGTERM');
});

// Exportar stdin/stdout para comunicação MCP
process.stdin.pipe(server.stdin);
server.stdout.pipe(process.stdout);

console.log('✅ Servidor MCP persistente ativo'); 