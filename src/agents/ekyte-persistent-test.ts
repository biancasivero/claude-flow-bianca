import { spawn, ChildProcess } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { WebSocket } from 'ws';

interface EkyteTestSession {
  timestamp: string;
  steps: Array<{
    step: number;
    action: string;
    success: boolean;
    details?: any;
    error?: string;
  }>;
  screenshots: string[];
  learnings: string[];
}

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params: any;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: any;
}

class EkytePersistentTest {
  private baseDir = '../ekyte';
  private screenshotsDir = join(this.baseDir, 'screenshots');
  private dataDir = join(this.baseDir, 'data');
  private session: EkyteTestSession;
  private mcpProcess: ChildProcess | null = null;
  private ws: WebSocket | null = null;
  private requestId = 1;
  private isConnected = false;

  // Credenciais de login
  private readonly credentials = {
    email: 'bianca_sivero@v4company.com',
    password: 'Cancela@1'
  };

  constructor() {
    this.ensureDirectories();
    this.session = {
      timestamp: new Date().toISOString(),
      steps: [],
      screenshots: [],
      learnings: []
    };
  }

  private ensureDirectories() {
    if (!existsSync(this.baseDir)) mkdirSync(this.baseDir, { recursive: true });
    if (!existsSync(this.screenshotsDir)) mkdirSync(this.screenshotsDir, { recursive: true });
    if (!existsSync(this.dataDir)) mkdirSync(this.dataDir, { recursive: true });
  }

  private async startMCPServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🚀 Iniciando servidor MCP persistente...');
      
      // Iniciar o servidor MCP
      this.mcpProcess = spawn('node', ['build/index.js'], {
        cwd: '/Users/phiz/Desktop/claude-flow-bianca/mcp-bianca-tools',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let serverStarted = false;

      this.mcpProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log(`[MCP] ${output.trim()}`);
        
        if (output.includes('✅ Servidor iniciado') && !serverStarted) {
          serverStarted = true;
          // Aguardar um pouco mais para garantir que o servidor está pronto
          setTimeout(() => {
            this.connectWebSocket().then(resolve).catch(reject);
          }, 2000);
        }
      });

      this.mcpProcess.stderr?.on('data', (data) => {
        console.error(`[MCP Error] ${data.toString()}`);
      });

      this.mcpProcess.on('error', (error) => {
        console.error('Erro ao iniciar servidor MCP:', error);
        reject(error);
      });

      this.mcpProcess.on('exit', (code) => {
        console.log(`Servidor MCP encerrado com código ${code}`);
        this.isConnected = false;
      });

      // Timeout de segurança
      setTimeout(() => {
        if (!serverStarted) {
          reject(new Error('Timeout: Servidor MCP não iniciou'));
        }
      }, 30000);
    });
  }

  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log('🔌 Conectando ao servidor MCP via WebSocket...');
      
      // Tentar conectar via WebSocket (assumindo que o MCP usa WebSocket)
      // Se não funcionar, vamos usar HTTP
      this.ws = new WebSocket('ws://localhost:3000');

      this.ws.on('open', () => {
        console.log('✅ Conectado ao servidor MCP');
        this.isConnected = true;
        resolve();
      });

      this.ws.on('error', (error) => {
        console.log('❌ WebSocket falhou, tentando HTTP direto...');
        this.ws = null;
        this.isConnected = true; // Usar HTTP direto
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const response: MCPResponse = JSON.parse(data.toString());
          console.log('[MCP Response]', response);
        } catch (error) {
          console.error('Erro ao parsear resposta MCP:', error);
        }
      });
    });
  }

  private async executeMCPTool(tool: string, params: any = {}): Promise<any> {
    if (!this.isConnected) {
      throw new Error('Servidor MCP não está conectado');
    }

    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        // Usar WebSocket se disponível
        return await this.executeMCPViaWebSocket(tool, params);
      } else {
        // Usar execução direta via processo
        return await this.executeMCPViaProcess(tool, params);
      }
    } catch (error) {
      console.error(`Erro ao executar ${tool}:`, error);
      throw error;
    }
  }

  private async executeMCPViaWebSocket(tool: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: this.requestId++,
        method: 'tools/call',
        params: {
          name: tool,
          arguments: params
        }
      };

      const timeout = setTimeout(() => {
        reject(new Error(`Timeout executando ${tool}`));
      }, 30000);

      const messageHandler = (data: Buffer) => {
        try {
          const response: MCPResponse = JSON.parse(data.toString());
          if (response.id === request.id) {
            clearTimeout(timeout);
            this.ws?.off('message', messageHandler);
            
            if (response.error) {
              reject(new Error(response.error.message || 'Erro MCP'));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // Ignorar mensagens que não são para este request
        }
      };

      this.ws?.on('message', messageHandler);
      this.ws?.send(JSON.stringify(request));
    });
  }

  private async executeMCPViaProcess(tool: string, params: any): Promise<any> {
    // Usar o método original como fallback
    const { execSync } = require('child_process');
    const paramsStr = Object.keys(params).length > 0 ? JSON.stringify(params) : '{}';
    const command = `cd /Users/phiz/Desktop/claude-flow-bianca/mcp-bianca-tools && node run-mcp-tool.js ${tool} '${paramsStr}'`;
    const result = execSync(command, { encoding: 'utf8', timeout: 30000 });
    return JSON.parse(result);
  }

  private addStep(step: number, action: string, success: boolean, details?: any, error?: string) {
    this.session.steps.push({ step, action, success, details, error });
    console.log(`Passo ${step}: ${action} - ${success ? 'SUCESSO' : 'FALHA'}`);
    if (error) console.error(`Erro: ${error}`);
  }

  private async takeScreenshot(filename: string): Promise<string> {
    const screenshotPath = join(this.screenshotsDir, filename);
    try {
      const result = await this.executeMCPTool('puppeteer_screenshot', { 
        path: screenshotPath,
        fullPage: true 
      });
      this.session.screenshots.push(screenshotPath);
      return screenshotPath;
    } catch (error) {
      console.error(`Erro ao capturar screenshot: ${error}`);
      return '';
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    try {
      console.log('🚀 Iniciando teste do eKyte Navigator Persistente...');

      // Iniciar servidor MCP
      await this.startMCPServer();

      // Passo 1: Navegar para eKyte
      try {
        await this.executeMCPTool('puppeteer_navigate', { 
          url: 'https://app.ekyte.com/' 
        });
        this.addStep(1, 'Navegação inicial para eKyte', true);
        console.log('⏳ Aguardando carregamento da página...');
        await this.sleep(8000);
      } catch (error: any) {
        this.addStep(1, 'Navegação inicial para eKyte', false, null, error.message);
        return;
      }

      // Passo 2: Screenshot inicial
      const initialScreenshot = await this.takeScreenshot(`ekyte-login-page-${Date.now()}.png`);
      this.addStep(2, 'Screenshot da página de login', !!initialScreenshot, { path: initialScreenshot });

      // Passo 3: Analisar conteúdo da página de login
      try {
        const result = await this.executeMCPTool('puppeteer_get_content');
        const content = result.data?.content || result.content || '';
        this.addStep(3, 'Captura de conteúdo da página de login', true, { 
          contentLength: content.length,
          hasLoginForm: content.includes('login') || content.includes('email') || content.includes('password'),
          contentPreview: content.substring(0, 200)
        });
      } catch (error: any) {
        this.addStep(3, 'Captura de conteúdo da página de login', false, null, error.message);
      }

      // Passo 4: Realizar login
      try {
        console.log('🔐 Tentando realizar login...');
        
        // Aguardar um pouco mais para garantir que a página carregou
        await this.sleep(3000);

        // Tentar diferentes seletores para email
        const emailSelectors = [
          'input[type="email"]',
          'input[name="email"]',
          'input[id="email"]',
          'input[placeholder*="email"]',
          'input[placeholder*="Email"]',
          'input[class*="email"]',
          'input[type="text"]' // Fallback
        ];

        let emailFieldFound = false;
        for (const selector of emailSelectors) {
          try {
            await this.executeMCPTool('puppeteer_type', { 
              selector: selector, 
              text: this.credentials.email 
            });
            console.log(`✅ Email inserido com seletor: ${selector}`);
            emailFieldFound = true;
            break;
          } catch (error) {
            console.log(`❌ Seletor ${selector} não funcionou`);
          }
        }

        if (!emailFieldFound) {
          throw new Error('Campo de email não encontrado');
        }

        // Aguardar antes de inserir a senha
        await this.sleep(1500);

        // Tentar diferentes seletores para senha
        const passwordSelectors = [
          'input[type="password"]',
          'input[name="password"]',
          'input[id="password"]',
          'input[placeholder*="password"]',
          'input[placeholder*="Password"]',
          'input[placeholder*="senha"]',
          'input[class*="password"]'
        ];

        let passwordFieldFound = false;
        for (const selector of passwordSelectors) {
          try {
            await this.executeMCPTool('puppeteer_type', { 
              selector: selector, 
              text: this.credentials.password 
            });
            console.log(`✅ Senha inserida com seletor: ${selector}`);
            passwordFieldFound = true;
            break;
          } catch (error) {
            console.log(`❌ Seletor ${selector} não funcionou`);
          }
        }

        if (!passwordFieldFound) {
          throw new Error('Campo de senha não encontrado');
        }

        // Aguardar antes de clicar no botão de login
        await this.sleep(1500);

        // Tentar diferentes seletores para botão de login
        const loginButtonSelectors = [
          'button[type="submit"]',
          'input[type="submit"]',
          'button:contains("Login")',
          'button:contains("Entrar")',
          'button:contains("Sign in")',
          'button[class*="login"]',
          'button[class*="submit"]',
          '.login-button',
          '.btn-login',
          '.submit-button',
          'form button' // Fallback
        ];

        let loginButtonClicked = false;
        for (const selector of loginButtonSelectors) {
          try {
            await this.executeMCPTool('puppeteer_click', { selector: selector });
            console.log(`✅ Botão de login clicado com seletor: ${selector}`);
            loginButtonClicked = true;
            break;
          } catch (error) {
            console.log(`❌ Seletor ${selector} não funcionou`);
          }
        }

        if (!loginButtonClicked) {
          // Tentar pressionar Enter no campo de senha
          try {
            await this.executeMCPTool('puppeteer_type', { 
              selector: 'input[type="password"]', 
              text: '\n' 
            });
            console.log('✅ Enter pressionado no campo de senha');
            loginButtonClicked = true;
          } catch (error) {
            throw new Error('Botão de login não encontrado e Enter não funcionou');
          }
        }

        this.addStep(4, 'Processo de login', true, { 
          emailField: emailFieldFound,
          passwordField: passwordFieldFound,
          loginButton: loginButtonClicked
        });

        // Aguardar redirecionamento após login
        console.log('⏳ Aguardando redirecionamento após login...');
        await this.sleep(8000);

      } catch (error: any) {
        this.addStep(4, 'Processo de login', false, null, error.message);
      }

      // Passo 5: Screenshot após login
      const postLoginScreenshot = await this.takeScreenshot(`ekyte-post-login-${Date.now()}.png`);
      this.addStep(5, 'Screenshot após login', !!postLoginScreenshot, { path: postLoginScreenshot });

      // Passo 6: Navegar para a lista de tarefas
      try {
        const tasksUrl = 'https://app.ekyte.com/#/tasks/list?actualSelectSort=10&executorId=60f5aa2f-a7f4-4408-855e-b0936950cc37&limited=1&situation=10&textKey=100&groupBy=800';
        await this.executeMCPTool('puppeteer_navigate', { url: tasksUrl });
        this.addStep(6, 'Navegação para lista de tarefas', true);
        console.log('⏳ Aguardando carregamento da lista de tarefas...');
        await this.sleep(10000); // Aguardar mais tempo para JavaScript carregar
      } catch (error: any) {
        this.addStep(6, 'Navegação para lista de tarefas', false, null, error.message);
      }

      // Passo 7: Screenshot da lista de tarefas
      const tasksScreenshot = await this.takeScreenshot(`ekyte-tasks-list-${Date.now()}.png`);
      this.addStep(7, 'Screenshot da lista de tarefas', !!tasksScreenshot, { path: tasksScreenshot });

      // Passo 8: Analisar conteúdo da lista de tarefas
      try {
        const result = await this.executeMCPTool('puppeteer_get_content');
        const content = result.data?.content || result.content || '';
        const analysis = this.analyzeTasksContent(content);
        this.addStep(8, 'Análise do conteúdo da lista de tarefas', true, analysis);
        
        // Adicionar aprendizados baseados na análise
        if (analysis.hasTasks) {
          this.session.learnings.push('Sistema possui lista de tarefas visível');
        }
        if (analysis.hasFilters) {
          this.session.learnings.push('Interface possui sistema de filtros');
        }
        if (analysis.hasTable) {
          this.session.learnings.push('Tarefas são exibidas em formato de tabela');
        }
        if (analysis.hasAngular) {
          this.session.learnings.push('Sistema usa Angular/JavaScript dinâmico');
        }
      } catch (error: any) {
        this.addStep(8, 'Análise do conteúdo da lista de tarefas', false, null, error.message);
      }

      // Passo 9: Tentar interagir com elementos da interface
      try {
        const interactionResults = await this.tryInteractions();
        this.addStep(9, 'Tentativas de interação com interface', true, interactionResults);
      } catch (error: any) {
        this.addStep(9, 'Tentativas de interação com interface', false, null, error.message);
      }

      // Passo 10: Screenshot final
      const finalScreenshot = await this.takeScreenshot(`ekyte-final-state-${Date.now()}.png`);
      this.addStep(10, 'Screenshot final', !!finalScreenshot, { path: finalScreenshot });

      // Salvar sessão
      this.saveSession();
      
      console.log('✅ Teste concluído com sucesso!');
      console.log(`📊 Passos executados: ${this.session.steps.length}`);
      console.log(`📸 Screenshots capturados: ${this.session.screenshots.length}`);
      console.log(`🧠 Aprendizados: ${this.session.learnings.length}`);

      // Manter o navegador aberto por mais tempo para inspeção
      console.log('🔍 Mantendo navegador aberto por 30 segundos para inspeção...');
      await this.sleep(30000);

    } finally {
      await this.cleanup();
    }
  }

  private analyzeTasksContent(content: string): any {
    return {
      contentLength: content.length,
      hasTasks: content.includes('task') || content.includes('tarefa'),
      hasFilters: content.includes('filter') || content.includes('filtro'),
      hasTable: content.includes('<table') || content.includes('tbody'),
      hasButtons: content.includes('<button'),
      hasInputs: content.includes('<input'),
      hasDropdowns: content.includes('<select') || content.includes('dropdown'),
      hasAngular: content.includes('ng-') || content.includes('angular') || content.includes('app-'),
      hasReact: content.includes('react') || content.includes('jsx'),
      hasVue: content.includes('v-') || content.includes('vue'),
      taskCount: (content.match(/task|tarefa/gi) || []).length,
      buttonCount: (content.match(/<button/gi) || []).length,
      scriptCount: (content.match(/<script/gi) || []).length,
      contentPreview: content.substring(0, 500)
    };
  }

  private async tryInteractions(): Promise<any> {
    const interactions: Array<{selector: string, success: boolean, error?: string}> = [];
    
    // Aguardar um pouco para garantir que a página está carregada
    await this.sleep(3000);
    
    // Tentar clicar em diferentes elementos
    const selectors = [
      'button',
      '.btn',
      '[role="button"]',
      'input[type="checkbox"]',
      'select',
      '.filter',
      '.sort',
      'a[href]',
      '.clickable'
    ];

    for (const selector of selectors) {
      try {
        await this.executeMCPTool('puppeteer_click', { selector });
        interactions.push({ selector, success: true });
        console.log(`✅ Interação bem-sucedida: ${selector}`);
        await this.sleep(2000); // Aguardar entre interações
      } catch (error: any) {
        interactions.push({ selector, success: false, error: error.message });
        console.log(`❌ Interação falhou: ${selector}`);
      }
    }

    return { interactions, totalAttempts: interactions.length };
  }

  private saveSession() {
    const sessionFile = join(this.dataDir, `persistent-session-${Date.now()}.json`);
    writeFileSync(sessionFile, JSON.stringify(this.session, null, 2));
    console.log(`💾 Sessão salva em: ${sessionFile}`);
  }

  private async cleanup() {
    console.log('🧹 Limpando recursos...');
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.mcpProcess) {
      this.mcpProcess.kill('SIGTERM');
      
      // Aguardar o processo encerrar graciosamente
      setTimeout(() => {
        if (this.mcpProcess && !this.mcpProcess.killed) {
          this.mcpProcess.kill('SIGKILL');
        }
      }, 5000);
    }
  }
}

// Executar o teste
async function main() {
  const test = new EkytePersistentTest();
  await test.run();
}

// Lidar com sinais de interrupção
process.on('SIGINT', async () => {
  console.log('\n🛑 Interrompido pelo usuário');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Encerrando aplicação');
  process.exit(0);
});

main().catch(console.error); 