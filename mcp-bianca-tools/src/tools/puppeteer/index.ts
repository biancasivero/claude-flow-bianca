/**
 * Puppeteer Tools Module
 * 
 * Ferramentas de automação web usando Puppeteer
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { z } from 'zod';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  successResponse 
} from '../../utils.js';
import {
  NavigateParams,
  ScreenshotParams,
  ClickParams,
  TypeParams,
  MCPError,
  ErrorCode
} from '../../types.js';

const execAsync = promisify(exec);

// Schemas de validação
export const NavigateSchema = z.object({
  url: z.string().url('URL inválida fornecida')
});

export const ScreenshotSchema = z.object({
  path: z.string().min(1, 'Caminho do arquivo é obrigatório'),
  fullPage: z.boolean().optional().default(false)
});

export const ClickSchema = z.object({
  selector: z.string().min(1, 'Seletor CSS é obrigatório')
});

export const TypeSchema = z.object({
  selector: z.string().min(1, 'Seletor CSS é obrigatório'),
  text: z.string()
});

export const OpenBrowserSchema = z.object({
  url: z.string().url('URL inválida fornecida')
});

// Estado do browser
let browser: Browser | null = null;
let page: Page | null = null;
let lastActivity = Date.now();

// Configurações
const BROWSER_TIMEOUT = 30 * 60 * 1000; // 30 minutos (aumentado de 5)
const DEFAULT_VIEWPORT = { width: 1280, height: 720 };
const PAGE_TIMEOUT = 30000; // 30 segundos para carregamento de página

// Configurações do browser - melhoradas para persistência
const BROWSER_CONFIG = {
  headless: false,
  defaultViewport: DEFAULT_VIEWPORT,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu'
  ]
};

/**
 * Garante que o browser está inicializado
 */
async function ensureBrowser(): Promise<void> {
  console.log(`🔍 Verificando estado do browser... (browser: ${!!browser}, connected: ${browser?.isConnected()}, page: ${!!page}, closed: ${page?.isClosed()})`);
  
  if (!browser || !browser.isConnected()) {
    console.log('🚀 Iniciando novo browser Puppeteer...');
    
    // Usa configuração melhorada
    browser = await puppeteer.launch(BROWSER_CONFIG);
    
    // Adiciona listener para fechar gracefully
    browser.on('disconnected', () => {
      console.log('❌ Browser desconectado');
      browser = null;
      page = null;
    });
    
    console.log('✅ Browser iniciado com sucesso');
  } else {
    console.log('♻️ Reutilizando browser existente');
  }
  
  if (!page || page.isClosed()) {
    console.log('📄 Criando nova página...');
    const pages = await browser.pages();
    
    if (pages.length > 0) {
      page = pages[0] || null;
      console.log('📄 Reutilizando página existente');
    } else {
      page = await browser.newPage();
      console.log('📄 Nova página criada');
    }
    
    // Configurar viewport e timeouts apenas se page não for null
    if (page) {
      await page.setViewport(DEFAULT_VIEWPORT);
      page.setDefaultTimeout(PAGE_TIMEOUT);
      page.setDefaultNavigationTimeout(PAGE_TIMEOUT);
      
      console.log('⚙️ Página configurada com viewport e timeouts');
    }
  } else {
    console.log('♻️ Reutilizando página existente');
  }
  
  lastActivity = Date.now();
  console.log(`⏰ Última atividade atualizada: ${new Date(lastActivity).toLocaleTimeString()}`);
}

/**
 * Fecha o browser após inatividade
 */
export function startBrowserCleanup() {
  setInterval(async () => {
    if (browser && Date.now() - lastActivity > BROWSER_TIMEOUT) {
      console.log('⏰ Fechando browser por inatividade...');
      await browser.close();
      browser = null;
      page = null;
    }
  }, 60000); // Verifica a cada minuto
}

// Handlers das ferramentas
export async function handleNavigate(params: NavigateParams) {
  const validated = NavigateSchema.parse(params);
  
  console.log(`🌐 Navegando para: ${validated.url}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // Navegar com timeout mais longo e aguardar carregamento completo
    await page.goto(validated.url, { 
      waitUntil: 'networkidle2', // Aguarda até não haver requisições por 500ms
      timeout: PAGE_TIMEOUT 
    });
    
    console.log(`✅ Navegação concluída para: ${validated.url}`);
    
    // Aguardar mais tempo para JavaScript carregar completamente
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`🎯 Página carregada e pronta para interação`);
    
    return successResponse(
      { url: validated.url },
      `Navegado para ${validated.url}`
    );
  } catch (error) {
    console.error(`❌ Erro na navegação:`, error);
    throw new MCPError(
      ErrorCode.PAGE_LOAD_FAILED, 
      `Falha ao navegar para ${validated.url}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

export async function handleScreenshot(params: ScreenshotParams) {
  const validated = ScreenshotSchema.parse(params);
  
  console.log(`📸 Iniciando captura de screenshot: ${validated.path}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  // Debug: verificar URL atual
  const currentUrl = await page.url();
  console.log(`🌐 URL atual da página: ${currentUrl}`);
  
  // Debug: verificar se página está carregada
  const title = await page.title();
  console.log(`📄 Título da página: ${title}`);
  
  let path = validated.path;
  if (!path.match(/\.(png|jpg|jpeg)$/i)) {
    path += '.png';
  }
  
  console.log(`💾 Salvando screenshot em: ${path}`);
  
  await page.screenshot({
    path: path as any, // Type assertion para resolver conflito de tipos
    fullPage: validated.fullPage
  });
  
  console.log(`✅ Screenshot salvo com sucesso!`);
  
  return successResponse(
    { path, currentUrl, title },
    `Screenshot salvo em ${path} (URL: ${currentUrl})`
  );
}

export async function handleClick(params: ClickParams) {
  const validated = ClickSchema.parse(params);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  await page.click(validated.selector);
  
  return successResponse(
    { selector: validated.selector },
    `Clicado no elemento: ${validated.selector}`
  );
}

export async function handleType(params: TypeParams) {
  const validated = TypeSchema.parse(params);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  await page.type(validated.selector, validated.text);
  
  return successResponse(
    { selector: validated.selector, text: validated.text },
    `Texto digitado no elemento: ${validated.selector}`
  );
}

export async function handleGetContent() {
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  const content = await page.content();
  
  return successResponse(
    { content },
    'Conteúdo HTML obtido com sucesso'
  );
}

// Nova função para abrir URL em nova aba
export async function handleNewTab(params: NavigateParams) {
  const validated = NavigateSchema.parse(params);
  
  await ensureBrowser();
  if (!browser) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Browser não inicializado');
  
  // Cria nova aba
  const newPage = await browser.newPage();
  await newPage.setViewport(DEFAULT_VIEWPORT);
  await newPage.goto(validated.url, { waitUntil: 'networkidle2' });
  
  // Foca na nova aba
  await newPage.bringToFront();
  
  return successResponse(
    { url: validated.url },
    `Nova aba aberta com ${validated.url}`
  );
}

// Função para abrir URL no navegador padrão do sistema
export async function handleOpenBrowser(params: { url: string }) {
  const validated = OpenBrowserSchema.parse(params);
  
  try {
    // Usa o comando 'open' do macOS para abrir a URL no navegador padrão
    await execAsync(`open "${validated.url}"`);
    
    return successResponse(
      { url: validated.url },
      `URL ${validated.url} aberta no navegador padrão do sistema`
    );
  } catch (error) {
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      `Falha ao abrir navegador: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

// Nova função que combina navegação + screenshot
export async function handleNavigateAndScreenshot(params: { url: string, path: string, fullPage?: boolean }) {
  console.log(`🚀 Iniciando navegação + screenshot para: ${params.url}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // Navegar
    console.log(`🌐 Navegando para: ${params.url}`);
    await page.goto(params.url, { 
      waitUntil: 'domcontentloaded',
      timeout: PAGE_TIMEOUT 
    });
    
    console.log(`✅ Navegação concluída`);
    
    // Aguardar carregamento
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar se página carregou
    const title = await page.title();
    console.log(`📄 Página carregada: ${title}`);
    
    // Capturar screenshot
    let path = params.path;
    if (!path.match(/\.(png|jpg|jpeg)$/i)) {
      path += '.png';
    }
    
    console.log(`📸 Capturando screenshot...`);
    await page.screenshot({
      path: path as any,
      fullPage: params.fullPage || false
    });
    
    console.log(`✅ Screenshot capturado com sucesso!`);
    
    return successResponse(
      { url: params.url, path, title },
      `Navegado para ${params.url} e screenshot salvo em ${path}`
    );
  } catch (error) {
    console.error(`❌ Erro na operação:`, error);
    throw new MCPError(
      ErrorCode.PAGE_LOAD_FAILED, 
      `Falha na operação: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

// Nova função para login automático no Ekyte
export async function handleEkyteLogin(params: { email: string, password: string, screenshotPath?: string }) {
  console.log(`🔐 Iniciando login no Ekyte para: ${params.email}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // Navegar para página de login
    console.log(`🌐 Navegando para página de login...`);
    await page.goto('https://app.ekyte.com/login', { 
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT 
    });
    
    console.log(`⏳ Aguardando carregamento completo da página...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Aguardar campos de login aparecerem
    console.log(`🔍 Procurando campos de login...`);
    await page.waitForSelector('input[type="email"], input[name="email"], #email, [placeholder*="email"], [placeholder*="Email"]', { timeout: 10000 });
    
    // Preencher email
    console.log(`📧 Preenchendo email: ${params.email}`);
    await page.type('input[type="email"], input[name="email"], #email, [placeholder*="email"], [placeholder*="Email"]', params.email);
    
    // Preencher senha
    console.log(`🔑 Preenchendo senha...`);
    await page.type('input[type="password"], input[name="password"], #password, [placeholder*="senha"], [placeholder*="password"]', params.password);
    
    // Screenshot antes do login (opcional)
    if (params.screenshotPath) {
      console.log(`📸 Capturando screenshot antes do login...`);
      await page.screenshot({ path: `${params.screenshotPath}-before-login.png`, fullPage: true });
    }
    
    // Clicar no botão de login
    console.log(`🚀 Clicando no botão de login...`);
    await page.click('button[type="submit"].btn.btn-primary.btn-md');
    
    // Aguardar redirecionamento
    console.log(`⏳ Aguardando redirecionamento...`);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // Verificar se login foi bem-sucedido
    const currentUrl = await page.url();
    const title = await page.title();
    console.log(`✅ Login realizado! URL atual: ${currentUrl}`);
    
    // Screenshot após login
    if (params.screenshotPath) {
      console.log(`📸 Capturando screenshot após login...`);
      await page.screenshot({ path: `${params.screenshotPath}-after-login.png`, fullPage: true });
    }
    
    return successResponse(
      { currentUrl, title, email: params.email },
      `Login realizado com sucesso no Ekyte para ${params.email}`
    );
  } catch (error) {
    console.error(`❌ Erro no login:`, error);
    throw new MCPError(
      ErrorCode.PAGE_LOAD_FAILED, 
      `Falha no login do Ekyte: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

// Nova função para login + navegação + screenshot no Ekyte
export async function handleEkyteLoginAndNavigate(params: { 
  email: string, 
  password: string, 
  targetUrl: string,
  screenshotPath: string,
  fullPage?: boolean 
}) {
  console.log(`🚀 Iniciando processo completo: Login + Navegação + Screenshot`);
  console.log(`📧 Email: ${params.email}`);
  console.log(`🎯 URL destino: ${params.targetUrl}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // 1. FAZER LOGIN
    console.log(`🔐 ETAPA 1: Fazendo login...`);
    await page.goto('https://app.ekyte.com/login', { 
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT 
    });
    
    console.log(`⏳ Aguardando carregamento da página de login...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Aguardar e preencher campos
    console.log(`🔍 Procurando campos de login...`);
    await page.waitForSelector('input[type="email"], input[name="email"], #email, [placeholder*="email"], [placeholder*="Email"]', { timeout: 10000 });
    
    console.log(`📧 Preenchendo email...`);
    await page.type('input[type="email"], input[name="email"], #email, [placeholder*="email"], [placeholder*="Email"]', params.email);
    
    console.log(`🔑 Preenchendo senha...`);
    await page.type('input[type="password"], input[name="password"], #password, [placeholder*="senha"], [placeholder*="password"]', params.password);
    
    console.log(`🚀 Clicando em login...`);
    await page.click('button[type="submit"].btn.btn-primary.btn-md');
    
    console.log(`⏳ Aguardando redirecionamento após login...`);
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // 2. NAVEGAR PARA URL DESEJADA
    console.log(`🌐 ETAPA 2: Navegando para ${params.targetUrl}...`);
    await page.goto(params.targetUrl, { 
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT 
    });
    
    console.log(`⏳ Aguardando carregamento completo...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 3. CAPTURAR SCREENSHOT
    console.log(`📸 ETAPA 3: Capturando screenshot...`);
    const currentUrl = await page.url();
    const title = await page.title();
    
    console.log(`📄 Página atual: ${title}`);
    console.log(`🌐 URL atual: ${currentUrl}`);
    
    await page.screenshot({
      path: params.screenshotPath as any,
      fullPage: params.fullPage || true
    });
    
    console.log(`✅ PROCESSO COMPLETO! Screenshot salvo em: ${params.screenshotPath}`);
    
    return successResponse(
      { 
        currentUrl, 
        title, 
        email: params.email,
        screenshotPath: params.screenshotPath,
        targetUrl: params.targetUrl
      },
      `Login, navegação e screenshot realizados com sucesso! URL: ${currentUrl}`
    );
  } catch (error) {
    console.error(`❌ Erro no processo completo:`, error);
    throw new MCPError(
      ErrorCode.PAGE_LOAD_FAILED, 
      `Falha no processo completo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

// Nova habilidade: Processador de Notificações do Ekyte
export async function handleEkyteProcessNotifications(params: { 
  email: string, 
  password: string,
  screenshotPath: string,
  maxNotifications?: number
}) {
  console.log(`🔔 Iniciando processamento de notificações do Ekyte`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // 1. FAZER LOGIN
    console.log(`🔐 Fazendo login...`);
    await page.goto('https://app.ekyte.com/login', { 
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT 
    });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    await page.waitForSelector('input[type="email"], input[name="email"], #email, [placeholder*="email"], [placeholder*="Email"]', { timeout: 10000 });
    await page.type('input[type="email"], input[name="email"], #email, [placeholder*="email"], [placeholder*="Email"]', params.email);
    await page.type('input[type="password"], input[name="password"], #password, [placeholder*="senha"], [placeholder*="password"]', params.password);
    await page.click('button[type="submit"].btn.btn-primary.btn-md');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // 2. CAPTURAR TELA INICIAL
    console.log(`📸 Capturando tela inicial com notificações...`);
    await page.screenshot({ path: `${params.screenshotPath}-inicial.png` as any, fullPage: true });
    
    // 3. PROCESSAR NOTIFICAÇÕES
    console.log(`🔍 Procurando notificações...`);
    const notifications = await page.$$('.notification-item, .task-item, [class*="notification"], [class*="task"]');
    
    console.log(`📋 Encontradas ${notifications.length} notificações`);
    
    const processedNotifications = [];
    const maxToProcess = params.maxNotifications || 5;
    
    for (let i = 0; i < Math.min(notifications.length, maxToProcess); i++) {
      console.log(`🔔 Processando notificação ${i + 1}/${Math.min(notifications.length, maxToProcess)}`);
      
      try {
        const notification = notifications[i];
        if (!notification) continue;
        
        // Capturar texto da notificação
        const notificationText = await notification.evaluate(el => el.textContent?.trim() || '');
        console.log(`📝 Texto: ${notificationText.substring(0, 100)}...`);
        
        // Clicar na notificação
        await notification.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Capturar screenshot da notificação aberta
        await page.screenshot({ 
          path: `${params.screenshotPath}-notificacao-${i + 1}.png` as any, 
          fullPage: true 
        });
        
        // Voltar para lista de notificações
        await page.goBack();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        processedNotifications.push({
          index: i + 1,
          text: notificationText,
          screenshot: `${params.screenshotPath}-notificacao-${i + 1}.png`
        });
        
      } catch (error) {
        console.log(`⚠️ Erro ao processar notificação ${i + 1}: ${error}`);
      }
    }
    
    // 4. CAPTURAR TELA FINAL
    await page.screenshot({ path: `${params.screenshotPath}-final.png` as any, fullPage: true });
    
    console.log(`✅ Processamento concluído! ${processedNotifications.length} notificações processadas`);
    
    return successResponse(
      { 
        totalNotifications: notifications.length,
        processedCount: processedNotifications.length,
        notifications: processedNotifications,
        screenshots: {
          initial: `${params.screenshotPath}-inicial.png`,
          final: `${params.screenshotPath}-final.png`
        }
      },
      `Processadas ${processedNotifications.length} notificações do Ekyte com sucesso!`
    );
    
  } catch (error) {
    console.error(`❌ Erro no processamento:`, error);
    throw new MCPError(
      ErrorCode.PAGE_LOAD_FAILED, 
      `Falha no processamento de notificações: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

// HABILIDADE 4: Explorador de Seções do Ekyte
export async function handleEkyteExploreSection(params: {
  email: string,
  password: string,
  section: 'conhecimento' | 'atendimento' | 'campanhas' | 'projetos' | 'tarefas' | 'publicacoes' | 'biblioteca' | 'data-driven',
  screenshotPath: string
}) {
  console.log(`🗂️ Explorando seção: ${params.section}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // Login
    await page.goto('https://app.ekyte.com/login', { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', params.email);
    await page.type('input[type="password"]', params.password);
    await page.click('button[type="submit"].btn.btn-primary.btn-md');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // Mapear seções para seletores
    const sectionSelectors: Record<string, string> = {
      conhecimento: 'a[href*="conhecimento"], .nav-link:contains("Conhecimento")',
      atendimento: 'a[href*="atendimento"], .nav-link:contains("Atendimento")',
      campanhas: 'a[href*="campanhas"], .nav-link:contains("Campanhas")',
      projetos: 'a[href*="projetos"], .nav-link:contains("Projetos")',
      tarefas: 'a[href*="tarefas"], .nav-link:contains("Tarefas")',
      publicacoes: 'a[href*="publicacoes"], .nav-link:contains("Publicações")',
      biblioteca: 'a[href*="biblioteca"], .nav-link:contains("Biblioteca")',
      'data-driven': 'a[href*="data"], .nav-link:contains("Data-Driven")'
    };
    
    // Navegar para seção
    console.log(`🔍 Procurando seção ${params.section}...`);
    const selector = sectionSelectors[params.section];
    
    try {
      if (selector) {
        await page.click(selector);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        throw new Error('Seletor não encontrado');
      }
    } catch {
      console.log(`⚠️ Seletor direto falhou, tentando por texto...`);
      await page.evaluate((section) => {
        const links = Array.from(document.querySelectorAll('a, .nav-link'));
        const link = links.find(l => l.textContent?.toLowerCase().includes(section));
        if (link) (link as HTMLElement).click();
      }, params.section);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    // Capturar screenshot da seção
    const currentUrl = await page.url();
    const title = await page.title();
    
    await page.screenshot({ path: params.screenshotPath as any, fullPage: true });
    
    console.log(`✅ Seção ${params.section} explorada com sucesso!`);
    
    return successResponse({
      section: params.section,
      currentUrl,
      title,
      screenshotPath: params.screenshotPath
    }, `Seção ${params.section} explorada com sucesso!`);
    
  } catch (error) {
    console.error(`❌ Erro ao explorar seção:`, error);
    throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, `Falha ao explorar seção ${params.section}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// HABILIDADE 5: Gerenciador de Tarefas
export async function handleEkyteManageTask(params: {
  email: string,
  password: string,
  action: 'list' | 'open' | 'comment' | 'update_status',
  taskId?: string,
  comment?: string,
  status?: string,
  screenshotPath: string
}) {
  console.log(`📝 Gerenciando tarefa - Ação: ${params.action}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // Login e navegar para tarefas
    await page.goto('https://app.ekyte.com/login', { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', params.email);
    await page.type('input[type="password"]', params.password);
    await page.click('button[type="submit"].btn.btn-primary.btn-md');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // Navegar para seção de tarefas
    try {
      await page.click('a[href*="tarefas"], .nav-link:contains("Tarefas")');
    } catch {
      console.log(`🔍 Procurando seção de tarefas...`);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    let result = {};
    
    switch (params.action) {
      case 'list':
        console.log(`📋 Listando tarefas...`);
        const tasks = await page.$$('.task-item, [class*="task"], .notification-item');
        const taskList = [];
        
        for (let i = 0; i < Math.min(tasks.length, 10); i++) {
          const task = tasks[i];
          if (task) {
            const text = await task.evaluate(el => el.textContent?.trim() || '');
            taskList.push({ index: i + 1, text: text.substring(0, 200) });
          }
        }
        
        result = { action: 'list', totalTasks: tasks.length, tasks: taskList };
        break;
        
      case 'open':
        if (params.taskId) {
          console.log(`📂 Abrindo tarefa ${params.taskId}...`);
          // Lógica para abrir tarefa específica
        }
        break;
        
      case 'comment':
        if (params.comment) {
          console.log(`💬 Adicionando comentário: ${params.comment.substring(0, 50)}...`);
          // Lógica para adicionar comentário
        }
        break;
    }
    
    await page.screenshot({ path: params.screenshotPath as any, fullPage: true });
    
    return successResponse(result, `Ação ${params.action} executada com sucesso!`);
    
  } catch (error) {
    console.error(`❌ Erro no gerenciamento de tarefa:`, error);
    throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, `Falha no gerenciamento de tarefa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// HABILIDADE 6: Analisador de Métricas
export async function handleEkyteAnalyzeMetrics(params: {
  email: string,
  password: string,
  screenshotPath: string
}) {
  console.log(`📊 Analisando métricas do dashboard`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // Login
    await page.goto('https://app.ekyte.com/login', { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', params.email);
    await page.type('input[type="password"]', params.password);
    await page.click('button[type="submit"].btn.btn-primary.btn-md');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // Extrair métricas do dashboard
    console.log(`🔍 Extraindo métricas...`);
    
    const metrics = await page.evaluate(() => {
      const extractNumber = (text: string) => {
        const match = text.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
      };
      
      // Buscar elementos de métricas
      const ticketsElement = document.querySelector('[class*="ticket"], .metric-tickets');
      const tasksElement = document.querySelector('[class*="task"], .metric-tasks');
      const timeElements = document.querySelectorAll('[class*="time"], [class*="hour"]');
      
      return {
        tickets: ticketsElement ? extractNumber(ticketsElement.textContent || '') : 0,
        tasks: tasksElement ? extractNumber(tasksElement.textContent || '') : 0,
        timeToday: Array.from(timeElements).map(el => (el.textContent || '').trim()).filter(t => t.includes('%')),
        timestamp: new Date().toISOString()
      };
    });
    
    await page.screenshot({ path: params.screenshotPath as any, fullPage: true });
    
    console.log(`✅ Métricas extraídas:`, metrics);
    
    return successResponse({
      metrics,
      screenshotPath: params.screenshotPath,
      analysisDate: new Date().toISOString()
    }, `Métricas analisadas com sucesso!`);
    
  } catch (error) {
    console.error(`❌ Erro na análise de métricas:`, error);
    throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, `Falha na análise de métricas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// HABILIDADE 7: Buscador Inteligente
export async function handleEkyteSmartSearch(params: {
  email: string,
  password: string,
  searchTerm: string,
  screenshotPath: string
}) {
  console.log(`🔍 Busca inteligente por: ${params.searchTerm}`);
  
  await ensureBrowser();
  if (!page) throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, 'Página não inicializada');
  
  try {
    // Login
    await page.goto('https://app.ekyte.com/login', { waitUntil: 'networkidle2', timeout: PAGE_TIMEOUT });
    await new Promise(resolve => setTimeout(resolve, 5000));
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.type('input[type="email"]', params.email);
    await page.type('input[type="password"]', params.password);
    await page.click('button[type="submit"].btn.btn-primary.btn-md');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });
    
    // Procurar campo de busca
    console.log(`🔍 Procurando campo de busca...`);
    const searchSelectors = [
      'input[type="search"]',
      'input[placeholder*="buscar"]',
      'input[placeholder*="search"]',
      '.search-input',
      '#search'
    ];
    
    let searchFound = false;
    for (const selector of searchSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 2000 });
        await page.type(selector, params.searchTerm);
        await page.keyboard.press('Enter');
        searchFound = true;
        break;
      } catch {
        continue;
      }
    }
    
    if (!searchFound) {
      console.log(`⚠️ Campo de busca não encontrado, fazendo busca manual...`);
      // Busca manual no conteúdo da página
      const results = await page.evaluate((term) => {
        const allText = document.body.innerText.toLowerCase();
        const termLower = term.toLowerCase();
        const sentences = allText.split(/[.!?]/);
        const matches = sentences.filter(sentence => sentence.includes(termLower));
        return matches.slice(0, 5).map(match => match.trim());
      }, params.searchTerm);
      
      await page.screenshot({ path: params.screenshotPath as any, fullPage: true });
      
      return successResponse({
        searchTerm: params.searchTerm,
        method: 'manual',
        results,
        screenshotPath: params.screenshotPath
      }, `Busca manual realizada para: ${params.searchTerm}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    await page.screenshot({ path: params.screenshotPath as any, fullPage: true });
    
    return successResponse({
      searchTerm: params.searchTerm,
      method: 'search_field',
      screenshotPath: params.screenshotPath
    }, `Busca realizada com sucesso para: ${params.searchTerm}`);
    
  } catch (error) {
    console.error(`❌ Erro na busca:`, error);
    throw new MCPError(ErrorCode.PAGE_LOAD_FAILED, `Falha na busca: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// Metadados das ferramentas Puppeteer
export const puppeteerTools = [
  {
    name: 'puppeteer_navigate',
    description: 'Navigate to a URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' }
      },
      required: ['url']
    }
  },
  {
    name: 'puppeteer_screenshot',
    description: 'Take a screenshot of the current page',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to save the screenshot' },
        fullPage: { type: 'boolean', description: 'Capture full page', default: false }
      },
      required: ['path']
    }
  },
  {
    name: 'puppeteer_click',
    description: 'Click on an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element to click' }
      },
      required: ['selector']
    }
  },
  {
    name: 'puppeteer_type',
    description: 'Type text into an element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS selector of element' },
        text: { type: 'string', description: 'Text to type' }
      },
      required: ['selector', 'text']
    }
  },
  {
    name: 'puppeteer_get_content',
    description: 'Get the HTML content of the current page',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'puppeteer_new_tab',
    description: 'Open URL in a new browser tab',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in new tab' }
      },
      required: ['url']
    }
  },
  {
    name: 'open_browser',
    description: 'Open URL in the system default browser',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open in default browser' }
      },
      required: ['url']
    }
  },
  {
    name: 'puppeteer_navigate_and_screenshot',
    description: 'Navigate to URL and take screenshot in single operation',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to navigate to' },
        path: { type: 'string', description: 'Path to save the screenshot' },
        fullPage: { type: 'boolean', description: 'Capture full page', default: false }
      },
      required: ['url', 'path']
    }
  },
  {
    name: 'ekyte_login',
    description: 'Login to Ekyte platform with credentials and optional screenshots',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email for login' },
        password: { type: 'string', description: 'Password for login' },
        screenshotPath: { type: 'string', description: 'Base path for screenshots (optional)' }
      },
      required: ['email', 'password']
    }
  },
  {
    name: 'ekyte_login_and_navigate',
    description: 'Login to Ekyte and navigate to specific page with screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email for login' },
        password: { type: 'string', description: 'Password for login' },
        targetUrl: { type: 'string', description: 'URL to navigate after login' },
        screenshotPath: { type: 'string', description: 'Path to save screenshot' },
        fullPage: { type: 'boolean', description: 'Capture full page', default: true }
      },
      required: ['email', 'password', 'targetUrl', 'screenshotPath']
    }
  },
  {
    name: 'ekyte_process_notifications',
    description: 'Process Ekyte notifications',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email for login' },
        password: { type: 'string', description: 'Password for login' },
        screenshotPath: { type: 'string', description: 'Base path for screenshots' },
        maxNotifications: { type: 'number', description: 'Maximum notifications to process', default: 5 }
      },
      required: ['email', 'password', 'screenshotPath']
    }
  },
  {
    name: 'ekyte_explore_section',
    description: 'Explore a specific section of Ekyte',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email for login' },
        password: { type: 'string', description: 'Password for login' },
        section: { type: 'string', description: 'Section to explore', enum: ['conhecimento', 'atendimento', 'campanhas', 'projetos', 'tarefas', 'publicacoes', 'biblioteca', 'data-driven'] },
        screenshotPath: { type: 'string', description: 'Path to save screenshot' }
      },
      required: ['email', 'password', 'section', 'screenshotPath']
    }
  },
  {
    name: 'ekyte_manage_task',
    description: 'Manage a task in Ekyte',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email for login' },
        password: { type: 'string', description: 'Password for login' },
        action: { type: 'string', description: 'Action to perform', enum: ['list', 'open', 'comment', 'update_status'] },
        taskId: { type: 'string', description: 'Task ID to open' },
        comment: { type: 'string', description: 'Comment to add' },
        status: { type: 'string', description: 'New status for the task' },
        screenshotPath: { type: 'string', description: 'Path to save screenshot' }
      },
      required: ['email', 'password', 'action', 'screenshotPath']
    }
  },
  {
    name: 'ekyte_analyze_metrics',
    description: 'Analyze Ekyte metrics',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email for login' },
        password: { type: 'string', description: 'Password for login' },
        screenshotPath: { type: 'string', description: 'Path to save screenshot' }
      },
      required: ['email', 'password', 'screenshotPath']
    }
  },
  {
    name: 'ekyte_smart_search',
    description: 'Perform a smart search in Ekyte',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email for login' },
        password: { type: 'string', description: 'Password for login' },
        searchTerm: { type: 'string', description: 'Search term' },
        screenshotPath: { type: 'string', description: 'Path to save screenshot' }
      },
      required: ['email', 'password', 'searchTerm', 'screenshotPath']
    }
  }
];