#!/usr/bin/env node
/**
 * Agente Coordenador Ekyte - BiancaTools
 * 
 * Coordena interações automatizadas com o Ekyte mantendo o navegador persistente
 */

const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { spawn } = require('child_process');

class EkyteAgent {
  constructor() {
    this.client = null;
    this.transport = null;
    this.serverProcess = null;
  }

  /**
   * Inicia o servidor MCP em background
   */
  async startServer() {
    console.log('🚀 Iniciando servidor MCP em background...');
    
    this.serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd: __dirname
    });

    // Aguardar um pouco para o servidor inicializar
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`📡 Servidor iniciado com PID: ${this.serverProcess.pid}`);
  }

  /**
   * Conecta ao servidor MCP
   */
  async connect() {
    if (!this.serverProcess) {
      await this.startServer();
    }

    this.transport = new StdioClientTransport({
      stdin: this.serverProcess.stdin,
      stdout: this.serverProcess.stdout
    });

    this.client = new Client(
      { name: 'ekyte-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    await this.client.connect(this.transport);
    console.log('🔗 Conectado ao servidor MCP');
  }

  /**
   * Executa uma ferramenta
   */
  async executeTool(name, args = {}) {
    if (!this.client) {
      throw new Error('Cliente não conectado');
    }

    console.log(`🔧 Executando: ${name}`, args);
    
    try {
      const result = await this.client.request(
        { method: 'tools/call' },
        { name, arguments: args }
      );
      
      console.log(`✅ ${name} executado com sucesso`);
      return result;
    } catch (error) {
      console.error(`❌ Erro em ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Navega para o Ekyte
   */
  async navegarEkyte() {
    console.log('\n🌐 === NAVEGANDO PARA EKYTE ===');
    
    // Tentar diferentes URLs do Ekyte
    const urls = [
      'https://app.ekyte.com',
      'https://ekyte.com/login',
      'https://ekyte.com'
    ];

    for (const url of urls) {
      try {
        console.log(`🔍 Tentando: ${url}`);
        await this.executeTool('puppeteer_navigate', { url });
        
        // Aguardar carregamento
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Tirar screenshot para verificar
        await this.executeTool('puppeteer_screenshot', { 
          path: `ekyte-${Date.now()}.png`,
          fullPage: true 
        });
        
        // Tentar obter conteúdo
        const content = await this.executeTool('puppeteer_get_content');
        
        if (content && content.content && content.content.length > 100) {
          console.log(`✅ Página carregada com sucesso: ${url}`);
          return url;
        }
        
      } catch (error) {
        console.log(`❌ Falha em ${url}: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('Não foi possível carregar nenhuma página do Ekyte');
  }

  /**
   * Tenta fazer login no Ekyte
   */
  async fazerLogin(email, senha) {
    console.log('\n🔐 === FAZENDO LOGIN ===');
    console.log(`📧 Email: ${email}`);
    
    // Seletores comuns para campos de login
    const seletores = {
      email: [
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        'input[placeholder*="email" i]',
        'input[placeholder*="e-mail" i]',
        '#email',
        '#username',
        '.email-input',
        '[data-testid="email"]'
      ],
      senha: [
        'input[type="password"]',
        'input[name="password"]',
        'input[id="password"]',
        'input[placeholder*="senha" i]',
        'input[placeholder*="password" i]',
        '#password',
        '.password-input',
        '[data-testid="password"]'
      ],
      botao: [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Entrar")',
        'button:contains("Login")',
        'button:contains("Sign in")',
        '.login-button',
        '.btn-login',
        '#login-btn',
        '[data-testid="login"]'
      ]
    };

    // Tentar preencher email
    let emailPreenchido = false;
    for (const seletor of seletores.email) {
      try {
        await this.executeTool('puppeteer_type', { 
          selector: seletor, 
          text: email 
        });
        console.log(`✅ Email preenchido com seletor: ${seletor}`);
        emailPreenchido = true;
        break;
      } catch (error) {
        console.log(`❌ Seletor de email falhou: ${seletor}`);
        continue;
      }
    }

    if (!emailPreenchido) {
      throw new Error('Não foi possível encontrar campo de email');
    }

    // Tentar preencher senha
    let senhaPreenchida = false;
    for (const seletor of seletores.senha) {
      try {
        await this.executeTool('puppeteer_type', { 
          selector: seletor, 
          text: senha 
        });
        console.log(`✅ Senha preenchida com seletor: ${seletor}`);
        senhaPreenchida = true;
        break;
      } catch (error) {
        console.log(`❌ Seletor de senha falhou: ${seletor}`);
        continue;
      }
    }

    if (!senhaPreenchida) {
      throw new Error('Não foi possível encontrar campo de senha');
    }

    // Tentar clicar no botão de login
    let loginClicado = false;
    for (const seletor of seletores.botao) {
      try {
        await this.executeTool('puppeteer_click', { selector: seletor });
        console.log(`✅ Botão de login clicado: ${seletor}`);
        loginClicado = true;
        break;
      } catch (error) {
        console.log(`❌ Seletor de botão falhou: ${seletor}`);
        continue;
      }
    }

    if (!loginClicado) {
      throw new Error('Não foi possível encontrar botão de login');
    }

    // Aguardar resultado do login
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Tirar screenshot do resultado
    await this.executeTool('puppeteer_screenshot', { 
      path: `ekyte-pos-login-${Date.now()}.png`,
      fullPage: true 
    });

    console.log('✅ Tentativa de login concluída');
  }

  /**
   * Executa fluxo completo de login no Ekyte
   */
  async executarFluxoEkyte(email, senha) {
    try {
      console.log('🎯 === INICIANDO FLUXO EKYTE ===');
      
      // 1. Conectar ao servidor
      await this.connect();
      
      // 2. Navegar para Ekyte
      await this.navegarEkyte();
      
      // 3. Fazer login
      await this.fazerLogin(email, senha);
      
      console.log('🎉 Fluxo Ekyte concluído com sucesso!');
      
      // Manter conexão ativa para comandos adicionais
      console.log('🔄 Mantendo navegador ativo para próximos comandos...');
      console.log('💡 Use Ctrl+C para encerrar');
      
      // Manter processo vivo
      return new Promise(() => {}); // Never resolves, mantém ativo
      
    } catch (error) {
      console.error('❌ Erro no fluxo Ekyte:', error.message);
      throw error;
    }
  }

  /**
   * Encerra conexões
   */
  async disconnect() {
    if (this.client) {
      await this.client.close();
    }
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
    }
    console.log('🔌 Desconectado do servidor MCP');
  }
}

// Função principal
async function main() {
  const agent = new EkyteAgent();
  
  // Credenciais do Ekyte
  const email = 'bianca_sivero@v4company.com';
  const senha = 'Cancela@1';
  
  try {
    await agent.executarFluxoEkyte(email, senha);
  } catch (error) {
    console.error('💥 Erro fatal:', error.message);
    await agent.disconnect();
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Encerrando agente Ekyte...');
  process.exit(0);
});

// Executar se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = EkyteAgent; 