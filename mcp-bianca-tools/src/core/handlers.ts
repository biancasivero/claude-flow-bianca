/**
 * Request handlers for MCP Tools
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { 
  ServerState, 
  MCPError, 
  ErrorCode, 
  NavigateParams,
  ScreenshotParams,
  ClickParams,
  TypeParams
} from './types.js';
import { config } from '../config/index.js';

// ==================== State Management ====================

export const state: ServerState = {
  lastActivity: Date.now(),
  requestCount: 0
};

// ==================== Utility Functions ====================

export async function withTimeout<T>(
  promise: () => Promise<T>,
  timeout: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new MCPError(ErrorCode.TIMEOUT, message)), timeout)
    )
  ]);
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries: number; delay: number } = { retries: 3, delay: 1000 }
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i <= options.retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < options.retries) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
    }
  }
  
  throw lastError!;
}

export async function ensureBrowser(): Promise<{ browser: Browser; page: Page }> {
  if (!state.browser || !state.browser.connected) {
    state.browser = await puppeteer.launch({
      headless: config.puppeteer.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  
  if (!state.page || state.page.isClosed()) {
    state.page = await state.browser.newPage();
    await state.page.setViewport({ width: 1280, height: 720 });
  }
  
  state.lastActivity = Date.now();
  return { browser: state.browser, page: state.page };
}

// ==================== Puppeteer Handlers ====================

export async function handleNavigate(params: NavigateParams) {
  const { page } = await ensureBrowser();
  
  await withTimeout(
    async () => {
      await page.goto(params.url, { waitUntil: 'networkidle2' });
    },
    config.puppeteer.defaultTimeout,
    `Navigation to ${params.url} timed out`
  );
  
  return successResponse(null, `Navigated to ${params.url}`);
}

export async function handleScreenshot(params: ScreenshotParams) {
  const { page } = await ensureBrowser();
  
  let path = params.path;
  if (!path.match(/\.(png|jpg|jpeg|webp)$/i)) {
    path = `${path}.png`;
  }
  
  await page.screenshot({
    path: path as any,
    fullPage: params.fullPage
  });
  
  return successResponse({ path }, `Screenshot saved to ${path}`);
}

export async function handleClick(params: ClickParams) {
  const { page } = await ensureBrowser();
  
  await withTimeout(
    async () => {
      await page.waitForSelector(params.selector, { visible: true });
      await page.click(params.selector);
    },
    5000,
    `Element ${params.selector} not found or not clickable`
  );
  
  return successResponse(null, `Clicked on element: ${params.selector}`);
}

export async function handleType(params: TypeParams) {
  const { page } = await ensureBrowser();
  
  await withTimeout(
    async () => {
      await page.waitForSelector(params.selector, { visible: true });
      await page.type(params.selector, params.text);
    },
    5000,
    `Element ${params.selector} not found`
  );
  
  return successResponse(null, `Typed text into element: ${params.selector}`);
}

export async function handleGetContent() {
  const { page } = await ensureBrowser();
  const content = await page.content();
  return successResponse(content);
}

// ==================== Response Helpers ====================

export function successResponse(data: any = null, message?: string) {
  return {
    success: true,
    data,
    content: message ? [{ type: 'text' as const, text: message }] : []
  };
}

export function errorResponse(error: MCPError) {
  return {
    success: false,
    error,
    content: [{ type: 'text' as const, text: error.message }]
  };
}

// ==================== Cleanup ====================

export async function cleanup() {
  if (state.browser) {
    await state.browser.close();
    state.browser = undefined;
    state.page = undefined;
  }      
}
