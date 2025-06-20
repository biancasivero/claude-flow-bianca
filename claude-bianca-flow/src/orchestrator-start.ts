/**
 * Script simples para iniciar o Orchestrator
 * Usado pelo Docker container
 */

import { Orchestrator } from './core/orchestrator';

async function main() {
  console.log('🚀 Iniciando Claude Flow Bianca Orchestrator...');
  
  const orchestrator = new Orchestrator();
  
  try {
    // Inicializar com force para limpar dados antigos
    await orchestrator.init({ force: true });
    
    // Obter porta do argumento ou usar padrão
    const port = process.argv.includes('--port') 
      ? parseInt(process.argv[process.argv.indexOf('--port') + 1]) 
      : 3003;
    
    // Iniciar o orchestrator
    await orchestrator.start({ port });
    
  } catch (error) {
    console.error('❌ Erro ao iniciar orchestrator:', error);
    process.exit(1);
  }
}

// Executar
main().catch(console.error);