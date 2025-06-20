#!/usr/bin/env node
/**
 * Workflow Ekyte - BiancaTools
 * 
 * Executa sequência de comandos mantendo o navegador persistente
 */

const { spawn } = require('child_process');
const { promisify } = require('util');
const sleep = promisify(setTimeout);

class EkyteWorkflow {
  constructor() {
    this.serverProcess = null;
  }

  /**
   * Inicia servidor MCP em background
   */
  async iniciarServidor() {
    console.log('🚀 Iniciando servidor MCP em background...');
    
    this.serverProcess = spawn('node', ['build/index.js'], {
      stdio: ['pipe', 'pipe', 'inherit'],
      cwd: __dirname
    });

    console.log(`📡 Servidor iniciado com PID: ${this.serverProcess.pid}`);
    
    // Aguardar servidor estabilizar
    await sleep(3000);
    
    return this.serverProcess;
  }

  /**
   * Executa comando MCP via stdin/stdout
   */
  async executarComando(ferramenta, args = {}) {
    if (!this.serverProcess) {
      throw new Error('Servidor não iniciado');
    }

    console.log(`🔧 Executando: ${ferramenta}`, args);

    return new Promise((resolve, reject) => {
      // Preparar comando MCP
      const comando = {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: ferramenta,
          arguments: args
        }
      };

      let resposta = '';
      let timeout;

      // Handler para resposta
      const onData = (data) => {
        resposta += data.toString();
        
        // Tentar parsear JSON completo
        try {
          const linhas = resposta.split('\n').filter(l => l.trim());
          for (const linha of linhas) {
            if (linha.startsWith('{')) {
              const json = JSON.parse(linha);
              if (json.id === comando.id) {
                clearTimeout(timeout);
                this.serverProcess.stdout.off('data', onData);
                
                if (json.error) {
                  console.error(`❌ ${ferramenta} ERRO:`, json.error.message);
                  reject(new Error(json.error.message));
                } else {
                  console.log(`✅ ${ferramenta} OK`);
                  resolve(json.result);
                }
                return;
              }
            }
          }
        } catch (e) {
          // JSON incompleto, continuar aguardando
        }
      };

      // Timeout
      timeout = setTimeout(() => {
        this.serverProcess.stdout.off('data', onData);
        reject(new Error(`Timeout em ${ferramenta}`));
      }, 30000);

      // Registrar listener
      this.serverProcess.stdout.on('data', onData);

      // Enviar comando
      this.serverProcess.stdin.write(JSON.stringify(comando) + '\n');
    });
  }

  /**
   * Fluxo principal do Ekyte
   */
  async executarFluxoEkyte() {
    console.log('\n🎯 === INICIANDO FLUXO EKYTE ===');
    
    try {
      // 1. Iniciar servidor
      await this.iniciarServidor();
      
      // 2. Navegar para Ekyte
      console.log('\n🌐 Navegando para Ekyte...');
      await this.executarComando('puppeteer_navigate', { 
        url: 'https://app.ekyte.com' 
      });
      
      // 3. Aguardar carregamento
      console.log('⏳ Aguardando carregamento...');
      await sleep(8000);
      
      // 4. Screenshot inicial
      await this.executarComando('puppeteer_screenshot', { 
        path: 'ekyte-inicial.png',
        fullPage: true 
      });
      
      // 5. Tentar fazer login
      console.log('\n🔐 Tentando fazer login...');
      
      const email = 'bianca_sivero@v4company.com';
      const senha = 'Cancela@1';
      
      // Tentar preencher email
      const seletoresEmail = [
        'input[type="email"]',
        'input[name="email"]',
        'input[id="email"]',
        '#email',
        '[data-testid="email"]'
      ];
      
      let emailOk = false;
      for (const seletor of seletoresEmail) {
        try {
          await this.executarComando('puppeteer_type', { 
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
      
      // Tentar preencher senha
      const seletoresSenha = [
        'input[type="password"]',
        'input[name="password"]',
        'input[id="password"]',
        '#password',
        '[data-testid="password"]'
      ];
      
      let senhaOk = false;
      if (emailOk) {
        for (const seletor of seletoresSenha) {
          try {
            await this.executarComando('puppeteer_type', { 
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
      }
      
      // Tentar clicar no botão de login
      const seletoresBotao = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:contains("Login")',
        'button:contains("Entrar")',
        '.btn-login',
        '#login-btn'
      ];
      
      let botaoOk = false;
      if (senhaOk) {
        for (const seletor of seletoresBotao) {
          try {
            await this.executarComando('puppeteer_click', { 
              selector: seletor 
            });
            console.log(`✅ Botão clicado: ${seletor}`);
            botaoOk = true;
            break;
          } catch (erro) {
            console.log(`❌ Botão falhou: ${seletor}`);
          }
        }
      }
      
      // Aguardar resultado do login
      if (botaoOk) {
        console.log('⏳ Aguardando resultado do login...');
        await sleep(5000);
      }
      
      // Screenshot final
      await this.executarComando('puppeteer_screenshot', { 
        path: 'ekyte-final.png',
        fullPage: true 
      });
      
      // Obter conteúdo para análise
      const conteudo = await this.executarComando('puppeteer_get_content');
      
      console.log('\n🎉 Fluxo concluído!');
      console.log('📸 Screenshots: ekyte-inicial.png, ekyte-final.png');
      console.log(`📧 Email preenchido: ${emailOk ? '✅' : '❌'}`);
      console.log(`🔒 Senha preenchida: ${senhaOk ? '✅' : '❌'}`);
      console.log(`🔘 Login clicado: ${botaoOk ? '✅' : '❌'}`);
      
      if (conteudo && conteudo.content) {
        const html = conteudo.content.find(c => c.text)?.text || '';
        if (html.length > 100) {
          console.log('📄 Conteúdo carregado com sucesso');
        } else {
          console.log('⚠️ Conteúdo vazio ou muito pequeno');
        }
      }
      
      console.log('\n🔄 Navegador mantido ativo');
      console.log('💡 Pressione Ctrl+C para encerrar');
      
      // Manter ativo
      await new Promise(() => {});
      
    } catch (erro) {
      console.error('💥 Erro no fluxo:', erro.message);
      throw erro;
    }
  }

  /**
   * Encerra o servidor
   */
  async encerrar() {
    console.log('\n🛑 Encerrando servidor...');
    
    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');
      console.log('✅ Servidor encerrado');
    }
  }
}

// Função principal
async function main() {
  const workflow = new EkyteWorkflow();
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    await workflow.encerrar();
    process.exit(0);
  });
  
  try {
    await workflow.executarFluxoEkyte();
  } catch (erro) {
    console.error('💥 Erro fatal:', erro.message);
    await workflow.encerrar();
    process.exit(1);
  }
}

// Executar
if (require.main === module) {
  main();
}

module.exports = EkyteWorkflow; 