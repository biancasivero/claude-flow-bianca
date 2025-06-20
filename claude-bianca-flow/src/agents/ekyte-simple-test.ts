#!/usr/bin/env tsx

/**
 * Teste simples de navegação no eKyte
 * Usa diretamente as ferramentas MCP sem classes complexas
 */

import { execSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

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

class EkyteSimpleTest {
  private baseDir = '../ekyte';
  private screenshotsDir = join(this.baseDir, 'screenshots');
  private dataDir = join(this.baseDir, 'data');
  private session: EkyteTestSession;

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

  private executeMCPTool(tool: string, params: any = {}): any {
    try {
      const paramsStr = Object.keys(params).length > 0 ? JSON.stringify(params) : '{}';
      const command = `cd ../mcp-bianca-tools && node run-mcp-tool.js ${tool} '${paramsStr}'`;
      const result = execSync(command, { encoding: 'utf8', timeout: 30000 });
      return JSON.parse(result);
    } catch (error) {
      console.error(`Erro ao executar ${tool}:`, error);
      throw error;
    }
  }

  private addStep(step: number, action: string, success: boolean, details?: any, error?: string) {
    this.session.steps.push({ step, action, success, details, error });
    console.log(`Passo ${step}: ${action} - ${success ? 'SUCESSO' : 'FALHA'}`);
    if (error) console.error(`Erro: ${error}`);
  }

  private takeScreenshot(filename: string): string {
    const screenshotPath = join(this.screenshotsDir, filename);
    try {
      this.executeMCPTool('puppeteer_screenshot', { 
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

  private async waitForElement(selector: string, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      try {
        const content = this.executeMCPTool('puppeteer_get_content');
        if (content.includes(selector) || content.includes('id="' + selector.replace('#', '') + '"') || 
            content.includes('class="' + selector.replace('.', '') + '"')) {
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`Aguardando elemento ${selector}...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return false;
  }

  async run() {
    console.log('🚀 Iniciando teste do eKyte Navigator com Login...');

    // Passo 1: Navegar para eKyte
    try {
      await this.executeMCPTool('puppeteer_navigate', { 
        url: 'https://app.ekyte.com/' 
      });
      this.addStep(1, 'Navegação inicial para eKyte', true);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Aguardar carregamento
    } catch (error) {
      this.addStep(1, 'Navegação inicial para eKyte', false, null, error.message);
      return;
    }

    // Passo 2: Screenshot inicial
    const initialScreenshot = this.takeScreenshot(`ekyte-login-page-${Date.now()}.png`);
    this.addStep(2, 'Screenshot da página de login', !!initialScreenshot, { path: initialScreenshot });

    // Passo 3: Analisar conteúdo da página de login
    let loginPageContent = '';
    try {
      const content = this.executeMCPTool('puppeteer_get_content');
      loginPageContent = content;
      this.addStep(3, 'Captura de conteúdo da página de login', true, { 
        contentLength: content.length,
        hasLoginForm: content.includes('login') || content.includes('email') || content.includes('password')
      });
    } catch (error) {
      this.addStep(3, 'Captura de conteúdo da página de login', false, null, error.message);
    }

    // Passo 4: Realizar login
    try {
      console.log('🔐 Tentando realizar login...');
      
      // Tentar diferentes seletores para email
      const emailSelectors = [
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        'input[placeholder*="email"]',
        'input[placeholder*="Email"]',
        'input[class*="email"]'
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

      // Aguardar um pouco antes de inserir a senha
      await new Promise(resolve => setTimeout(resolve, 1000));

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

      // Aguardar um pouco antes de clicar no botão de login
      await new Promise(resolve => setTimeout(resolve, 1000));

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
        '.submit-button'
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
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      this.addStep(4, 'Processo de login', false, null, error.message);
    }

    // Passo 5: Screenshot após login
    const postLoginScreenshot = this.takeScreenshot(`ekyte-post-login-${Date.now()}.png`);
    this.addStep(5, 'Screenshot após login', !!postLoginScreenshot, { path: postLoginScreenshot });

    // Passo 6: Navegar para a lista de tarefas
    try {
      const tasksUrl = 'https://app.ekyte.com/#/tasks/list?actualSelectSort=10&executorId=60f5aa2f-a7f4-4408-855e-b0936950cc37&limited=1&situation=10&textKey=100&groupBy=800';
      await this.executeMCPTool('puppeteer_navigate', { url: tasksUrl });
      this.addStep(6, 'Navegação para lista de tarefas', true);
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      this.addStep(6, 'Navegação para lista de tarefas', false, null, error.message);
    }

    // Passo 7: Screenshot da lista de tarefas
    const tasksScreenshot = this.takeScreenshot(`ekyte-tasks-list-${Date.now()}.png`);
    this.addStep(7, 'Screenshot da lista de tarefas', !!tasksScreenshot, { path: tasksScreenshot });

    // Passo 8: Analisar conteúdo da lista de tarefas
    try {
      const content = this.executeMCPTool('puppeteer_get_content');
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
    } catch (error) {
      this.addStep(8, 'Análise do conteúdo da lista de tarefas', false, null, error.message);
    }

    // Passo 9: Tentar interagir com elementos da interface
    try {
      const interactionResults = await this.tryInteractions();
      this.addStep(9, 'Tentativas de interação com interface', true, interactionResults);
    } catch (error) {
      this.addStep(9, 'Tentativas de interação com interface', false, null, error.message);
    }

    // Passo 10: Screenshot final
    const finalScreenshot = this.takeScreenshot(`ekyte-final-state-${Date.now()}.png`);
    this.addStep(10, 'Screenshot final', !!finalScreenshot, { path: finalScreenshot });

    // Salvar sessão
    this.saveSession();
    
    console.log('✅ Teste concluído com sucesso!');
    console.log(`📊 Passos executados: ${this.session.steps.length}`);
    console.log(`📸 Screenshots capturados: ${this.session.screenshots.length}`);
    console.log(`🧠 Aprendizados: ${this.session.learnings.length}`);
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
      taskCount: (content.match(/task|tarefa/gi) || []).length,
      buttonCount: (content.match(/<button/gi) || []).length
    };
  }

  private async tryInteractions(): Promise<any> {
    const interactions: Array<{selector: string, success: boolean, error?: string}> = [];
    
    // Tentar clicar em diferentes elementos
    const selectors = [
      'button',
      '.btn',
      '[role="button"]',
      'input[type="checkbox"]',
      'select',
      '.filter',
      '.sort'
    ];

    for (const selector of selectors) {
      try {
        await this.executeMCPTool('puppeteer_click', { selector });
        interactions.push({ selector, success: true });
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error: any) {
        interactions.push({ selector, success: false, error: error.message });
      }
    }

    return { interactions, totalAttempts: interactions.length };
  }

  private saveSession() {
    const sessionFile = join(this.dataDir, `session-${Date.now()}.json`);
    writeFileSync(sessionFile, JSON.stringify(this.session, null, 2));
    console.log(`💾 Sessão salva em: ${sessionFile}`);
  }
}

// Executar o teste
async function main() {
  const test = new EkyteSimpleTest();
  await test.run();
}

main().catch(console.error); 