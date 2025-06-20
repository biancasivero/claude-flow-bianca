#!/usr/bin/env node
/**
 * Agente Ekyte Simplificado - BiancaTools
 * 
 * Usa abordagem simples para manter navegador persistente
 */

const { spawn } = require('child_process');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

class EkyteAgentSimple {
  constructor() {
    this.serverProcess = null;
    this.client = null;
  }

  /**
   * Inicia servidor MCP e conecta
   */
  async iniciar() {
    console.log('🚀 Iniciando servidor MCP...');
    
    // Iniciar servidor
    this.serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd: __dirname
    });

    console.log(`📡 Servidor PID: ${this.serverProcess.pid}`);

    // Criar cliente MCP
    const transport = new StdioClientTransport({
      stdin: this.serverProcess.stdin,
      stdout: this.serverProcess.stdout
    });

    this.client = new Client(
      { name: 'ekyte-agent', version: '1.0.0' },
      { capabilities: {} }
    );

    // Conectar
    await this.client.connect(transport);
    console.log('🔗 Conectado ao MCP');

    // Aguardar estabilização
    await this.sleep(2000);
  }

  /**
   * Executa ferramenta MCP
   */
  async executar(nome, args = {}) {
    console.log(`🔧 ${nome}:`, JSON.stringify(args));
    
    try {
      const resultado = await this.client.request(
        { method: 'tools/call' },
        { name: nome, arguments: args }
      );
      
      console.log(`✅ ${nome} OK`);
      return resultado;
    } catch (erro) {
      console.error(`❌ ${nome} ERRO:`, erro.message);
      throw erro;
    }
  }

  /**
   * Fluxo principal do Ekyte
   */
  async fluxoEkyte() {
    console.log('\n🎯 === FLUXO EKYTE ===');
    
    try {
      // 1. Navegar para Ekyte
      console.log('\n🌐 Navegando para Ekyte...');
      await this.executar('puppeteer_navigate', { 
        url: 'https://app.ekyte.com' 
      });
      
      await this.sleep(5000); // Aguardar carregamento
      
      // 2. Screenshot inicial
      await this.executar('puppeteer_screenshot', { 
        path: 'ekyte-inicial.png',
        fullPage: true 
      });
      
      // 3. Tentar encontrar e preencher campos de login
      console.log('\n🔐 Tentando fazer login...');
      
      const email = 'bianca_sivero@v4company.com';
      const senha = 'Cancela@1';
      
      // Tentar diferentes seletores para email
      const seletoresEmail = [
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        '#email',
        '[placeholder*="email" i]'
      ];
      
      let emailOk = false;
      for (const seletor of seletoresEmail) {
        try {
          await this.executar('puppeteer_type', { 
            selector: seletor, 
            text: email 
          });
          console.log(`✅ Email preenchido: ${seletor}`);
          emailOk = true;
          break;
        } catch (erro) {
          console.log(`❌ Email falhou: ${seletor}`);
        }
      }
      
      if (!emailOk) {
        console.log('⚠️ Não encontrou campo de email, continuando...');
      }
      
      // Tentar diferentes seletores para senha
      const seletoresSenha = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id="password"]',
        '#password',
        '[placeholder*="password" i]'
      ];
      
      let senhaOk = false;
      for (const seletor of seletoresSenha) {
        try {
          await this.executar('puppeteer_type', { 
            selector: seletor, 
            text: senha 
          });
          console.log(`✅ Senha preenchida: ${seletor}`);
          senhaOk = true;
          break;
        } catch (erro) {
          console.log(`❌ Senha falhou: ${seletor}`);
        }
      }
      
      if (!senhaOk) {
        console.log('⚠️ Não encontrou campo de senha, continuando...');
      }
      
      // Tentar botão de login
      const seletoresBotao = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Login")',
        'button:contains("Entrar")',
        '.btn-login',
        '#login'
      ];
      
      let botaoOk = false;
      for (const seletor of seletoresBotao) {
        try {
          await this.executar('puppeteer_click', { selector: seletor });
          console.log(`✅ Botão clicado: ${seletor}`);
          botaoOk = true;
          break;
        } catch (erro) {
          console.log(`❌ Botão falhou: ${seletor}`);
        }
      }
      
      if (!botaoOk) {
        console.log('⚠️ Não encontrou botão de login');
      }
      
      // Aguardar resultado
      await this.sleep(5000);
      
      // Screenshot final
      await this.executar('puppeteer_screenshot', { 
        path: 'ekyte-final.png',
        fullPage: true 
      });
      
      console.log('\n🎉 Fluxo concluído!');
      console.log('📸 Screenshots salvos: ekyte-inicial.png, ekyte-final.png');
      console.log('🔄 Navegador mantido ativo');
      
      // Manter ativo
      console.log('\n💡 Pressione Ctrl+C para encerrar');
      await new Promise(() => {}); // Mantém ativo indefinidamente
      
    } catch (erro) {
      console.error('💥 Erro no fluxo:', erro.message);
      throw erro;
    }
  }

  /**
   * Utilitário para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Encerra tudo
   */
  async encerrar() {
    console.log('🛑 Encerrando...');
    
    if (this.client) {
      try {
        await this.client.close();
      } catch (e) {}
    }
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
    }
    
    console.log('✅ Encerrado');
  }
}

// Função principal
async function main() {
  const agent = new EkyteAgentSimple();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n');
    await agent.encerrar();
    process.exit(0);
  });
  
  try {
    await agent.iniciar();
    await agent.fluxoEkyte();
  } catch (erro) {
    console.error('💥 Erro fatal:', erro.message);
    await agent.encerrar();
    process.exit(1);
  }
}

// Executar
if (require.main === module) {
  main();
}

module.exports = EkyteAgentSimple; 