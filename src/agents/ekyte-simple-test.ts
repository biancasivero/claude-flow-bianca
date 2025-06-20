#!/usr/bin/env tsx

/**
 * Teste simples de navegação no eKyte
 * Usa diretamente as ferramentas MCP sem classes complexas
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// URL do eKyte
const EKYTE_URL = 'https://app.ekyte.com/#/tasks/list?actualSelectSort=10&executorId=60f5aa2f-a7f4-4408-855e-b0936950cc37&limited=1&situation=10&textKey=100&groupBy=800';

// Diretórios
const EKYTE_DIR = join(process.cwd(), '..', 'ekyte');
const SCREENSHOTS_DIR = join(EKYTE_DIR, 'screenshots');
const DATA_DIR = join(EKYTE_DIR, 'data');

// Caminho para as ferramentas MCP
const MCP_TOOLS_PATH = join(process.cwd(), '..', 'mcp-bianca-tools');

/**
 * Executa uma ferramenta MCP
 */
async function executeMCPTool(toolName: string, params: any = {}): Promise<any> {
  try {
    const toolData = {
      tool: toolName,
      params
    };
    
    const jsonData = JSON.stringify(toolData).replace(/'/g, "'\\'''");
    const command = `cd "${MCP_TOOLS_PATH}" && npm run execute-tool -- '${jsonData}'`;
    
    console.log(`🔨 Executando: ${toolName}`);
    const output = execSync(command, {
      encoding: 'utf8',
      env: { ...process.env }
    });
    
    // Extrair resultado JSON
    const lines = output.split('\n').filter(line => line.trim());
    const jsonLine = lines.find(line => {
      try {
        JSON.parse(line);
        return true;
      } catch {
        return false;
      }
    });
    
    if (jsonLine) {
      const result = JSON.parse(jsonLine);
      if (result.success) {
        console.log(`✅ ${toolName} executado com sucesso`);
        return result.data;
      } else {
        console.error(`❌ Erro em ${toolName}:`, result.error);
        throw new Error(result.error);
      }
    }
    
    throw new Error('Resposta inválida da ferramenta MCP');
    
  } catch (error) {
    console.error(`❌ Erro ao executar ${toolName}:`, error);
    throw error;
  }
}

/**
 * Inicializa diretórios
 */
function initializeDirectories(): void {
  [EKYTE_DIR, SCREENSHOTS_DIR, DATA_DIR].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`📁 Diretório criado: ${dir}`);
    }
  });
}

/**
 * Salva log da sessão
 */
function saveSessionLog(sessionData: any): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logPath = join(DATA_DIR, `ekyte-session-${timestamp}.json`);
  
  writeFileSync(logPath, JSON.stringify(sessionData, null, 2));
  console.log(`📄 Log da sessão salvo: ${logPath}`);
}

/**
 * Executa sessão de aprendizado no eKyte
 */
async function runEkyteSession(): Promise<void> {
  console.log('🚀 Iniciando sessão de aprendizado no eKyte...\n');
  
  const sessionData = {
    id: Date.now().toString(),
    startTime: new Date().toISOString(),
    url: EKYTE_URL,
    steps: [] as string[],
    observations: [] as string[],
    screenshots: [] as string[],
    errors: [] as string[],
    endTime: undefined as string | undefined,
    duration: undefined as number | undefined
  };

  try {
    // Passo 1: Navegar para eKyte
    console.log('🌐 Passo 1: Navegando para eKyte...');
    await executeMCPTool('puppeteer_navigate', { url: EKYTE_URL });
    
    sessionData.steps.push('Navegação inicial');
    sessionData.observations.push('Navegação para eKyte bem-sucedida');
    
    // Aguardar carregamento
    console.log('⏳ Aguardando carregamento...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Passo 2: Screenshot inicial
    console.log('📸 Passo 2: Capturando screenshot inicial...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = join(SCREENSHOTS_DIR, `ekyte-initial-${timestamp}.png`);
    
    await executeMCPTool('puppeteer_screenshot', {
      path: screenshotPath,
      fullPage: true
    });
    
    sessionData.steps.push('Screenshot inicial');
    sessionData.screenshots.push(screenshotPath);
    sessionData.observations.push(`Screenshot salvo: ${screenshotPath}`);
    
    // Passo 3: Capturar conteúdo da página
    console.log('📄 Passo 3: Capturando conteúdo da página...');
    const content = await executeMCPTool('puppeteer_get_content', {});
    
    if (content && content.content) {
      const htmlPath = join(DATA_DIR, `ekyte-content-${timestamp}.html`);
      writeFileSync(htmlPath, content.content);
      
      sessionData.steps.push('Captura de conteúdo');
      sessionData.observations.push(`Conteúdo HTML salvo: ${htmlPath}`);
      
      // Análise básica do conteúdo
      const htmlContent = content.content;
      const hasTaskList = htmlContent.includes('task') || htmlContent.includes('tarefa');
      const hasFilters = htmlContent.includes('filter') || htmlContent.includes('filtro');
      const hasTables = htmlContent.includes('<table') || htmlContent.includes('tbody');
      
      sessionData.observations.push(`Análise do conteúdo:`);
      sessionData.observations.push(`- Lista de tarefas detectada: ${hasTaskList ? 'Sim' : 'Não'}`);
      sessionData.observations.push(`- Filtros detectados: ${hasFilters ? 'Sim' : 'Não'}`);
      sessionData.observations.push(`- Tabelas detectadas: ${hasTables ? 'Sim' : 'Não'}`);
    }
    
    // Passo 4: Tentativas de interação
    console.log('🎯 Passo 4: Tentando interações...');
    
    // Tentativa 1: Procurar elementos clicáveis
    const clickableSelectors = [
      'button',
      'a',
      '.btn',
      '[role="button"]',
      'tr',
      '.clickable'
    ];
    
    for (const selector of clickableSelectors) {
      try {
        console.log(`  🖱️  Tentando clicar em: ${selector}`);
        await executeMCPTool('puppeteer_click', { selector });
        
        sessionData.observations.push(`Clique bem-sucedido em: ${selector}`);
        
        // Screenshot após clique
        const clickScreenshot = join(SCREENSHOTS_DIR, `ekyte-click-${selector.replace(/[^a-zA-Z0-9]/g, '_')}-${timestamp}.png`);
        await executeMCPTool('puppeteer_screenshot', { path: clickScreenshot });
        sessionData.screenshots.push(clickScreenshot);
        
        break; // Sair do loop se conseguiu clicar
        
      } catch (error) {
        console.log(`  ⚠️ Falha ao clicar em ${selector}`);
        // Continuar tentando outros seletores
      }
    }
    
    // Passo 5: Screenshot final
    console.log('📸 Passo 5: Screenshot final...');
    const finalScreenshot = join(SCREENSHOTS_DIR, `ekyte-final-${timestamp}.png`);
    await executeMCPTool('puppeteer_screenshot', {
      path: finalScreenshot,
      fullPage: true
    });
    
    sessionData.steps.push('Screenshot final');
    sessionData.screenshots.push(finalScreenshot);
    
    // Finalizar sessão
    sessionData.endTime = new Date().toISOString();
    sessionData.duration = new Date().getTime() - new Date(sessionData.startTime).getTime();
    
    console.log('\n✅ Sessão concluída com sucesso!');
    console.log(`📊 Resumo:`);
    console.log(`   - Duração: ${Math.round(sessionData.duration / 1000)}s`);
    console.log(`   - Screenshots: ${sessionData.screenshots.length}`);
    console.log(`   - Observações: ${sessionData.observations.length}`);
    
    // Salvar log
    saveSessionLog(sessionData);
    
  } catch (error) {
    console.error('❌ Erro na sessão:', error);
    sessionData.errors.push(error instanceof Error ? error.message : String(error));
    sessionData.endTime = new Date().toISOString();
    
    // Salvar log mesmo com erro
    saveSessionLog(sessionData);
    throw error;
  }
}

/**
 * Função principal
 */
async function main(): Promise<void> {
  try {
    console.log('🎯 eKyte Navigator - Teste Simples\n');
    
    // Inicializar diretórios
    initializeDirectories();
    
    // Executar sessão
    await runEkyteSession();
    
    console.log('\n🎉 Teste concluído! Verifique os arquivos em:', EKYTE_DIR);
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

export { runEkyteSession, executeMCPTool }; 