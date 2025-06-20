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
    await page.click('button[type="submit"], .btn-login, #login-btn, [class*="login"], [class*="entrar"]');
    
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
    await page.click('button[type="submit"], .btn-login, #login-btn, [class*="login"], [class*="entrar"]');
    
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
  }
];