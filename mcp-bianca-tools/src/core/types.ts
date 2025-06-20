/**
 * Type definitions for MCP Tools Server
 */

import { Browser, Page } from 'puppeteer';

// ==================== Enums ====================

export enum ToolName {
  // Puppeteer Tools
  PUPPETEER_NAVIGATE = 'puppeteer_navigate',
  PUPPETEER_SCREENSHOT = 'puppeteer_screenshot',
  PUPPETEER_CLICK = 'puppeteer_click',
  PUPPETEER_TYPE = 'puppeteer_type',
  PUPPETEER_GET_CONTENT = 'puppeteer_get_content',
  PUPPETEER_NEW_TAB = 'puppeteer_new_tab',
  
  // Browser Tools
  OPEN_BROWSER = 'open_browser',
  BROWSER_OPEN_URL = 'browser_open_url',
  
  // Agents Tools
  AGENTS_LIST = 'agents_list',
  AGENTS_GET_DETAILS = 'agents_get_details',
  AGENTS_ANALYZE = 'agents_analyze',
  AGENTS_SEARCH = 'agents_search',
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

// ==================== Configuration Types ====================

export interface ServerConfig {
  name: string;
  version: string;
  description: string;
  logLevel?: LogLevel;
}

export interface PuppeteerConfig {
  headless?: boolean;
  defaultTimeout?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}

// ==================== Tool Parameter Types ====================

// Puppeteer Tool Parameters
export interface NavigateParams {
  url: string;
}

export interface ScreenshotParams {
  path: string;
  fullPage?: boolean;
}

export interface ClickParams {
  selector: string;
}

export interface TypeParams {
  selector: string;
  text: string;
}

export interface NewTabParams {
  url: string;
}

// Browser Tool Parameters
export interface OpenBrowserParams {
  url: string;
}

export interface BrowserOpenUrlParams {
  url: string;
  browser?: 'default' | 'chrome' | 'safari' | 'firefox';
}

// Agents Tool Parameters
export interface AgentsListParams {
  path?: string;
  filter?: {
    type?: 'researcher' | 'implementer' | 'analyst' | 'coordinator' | 'custom';
    name?: string;
    hasTools?: string[];
  };
}

export interface AgentsGetDetailsParams {
  agentFile: string;
  agentName?: string;
}

export interface AgentsAnalyzeParams {
  agentFile: string;
  analysisType: 'dependencies' | 'tools' | 'structure' | 'usage';
}

export interface AgentsSearchParams {
  query: string;
  path?: string;
}

// ==================== Response Types ====================

export type ToolResult<T = any> = 
  | { success: true; data: T; content: ContentBlock[] }
  | { success: false; error: MCPError; content: ContentBlock[] };

export interface ContentBlock {
  type: 'text' | 'image' | 'resource';
  text?: string;
  uri?: string;
  mimeType?: string;
}

// ==================== Error Types ====================

export enum ErrorCode {
  // General errors
  UNKNOWN = 'UNKNOWN',
  INVALID_PARAMS = 'INVALID_PARAMS',
  NOT_FOUND = 'NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  METHOD_NOT_FOUND = 'METHOD_NOT_FOUND',
  
  // Puppeteer errors
  BROWSER_NOT_INITIALIZED = 'BROWSER_NOT_INITIALIZED',
  PAGE_LOAD_FAILED = 'PAGE_LOAD_FAILED',
  ELEMENT_NOT_FOUND = 'ELEMENT_NOT_FOUND',
  SCREENSHOT_FAILED = 'SCREENSHOT_FAILED',
}

export class MCPError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// ==================== State Management Types ====================

export interface ServerState {
  browser?: Browser;
  page?: Page;
  lastActivity: number;
  requestCount: number;
}

// ==================== Tool Definition Types ====================

export interface ToolDefinition {
  name: ToolName;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  handler: (args: any) => Promise<ToolResult>;
}

// ==================== Type Guards ====================

export function isNavigateParams(params: any): params is NavigateParams {
  return typeof params?.url === 'string';
}

export function isScreenshotParams(params: any): params is ScreenshotParams {
  return typeof params?.path === 'string';
}

export function isMCPError(error: any): error is MCPError {
  return error instanceof MCPError;
}

// ==================== Utility Types ====================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncReturnType<T extends (...args: any) => Promise<any>> = 
  T extends (...args: any) => Promise<infer U> ? U : never;

export type ExtractToolParams<T extends ToolName> = 
  T extends ToolName.PUPPETEER_NAVIGATE ? NavigateParams :
  T extends ToolName.PUPPETEER_SCREENSHOT ? ScreenshotParams :
  T extends ToolName.PUPPETEER_CLICK ? ClickParams :
  T extends ToolName.PUPPETEER_TYPE ? TypeParams :
  T extends ToolName.PUPPETEER_NEW_TAB ? NewTabParams :
  T extends ToolName.OPEN_BROWSER ? OpenBrowserParams :
  T extends ToolName.BROWSER_OPEN_URL ? BrowserOpenUrlParams :
  T extends ToolName.AGENTS_LIST ? AgentsListParams :
  T extends ToolName.AGENTS_GET_DETAILS ? AgentsGetDetailsParams :
  T extends ToolName.AGENTS_ANALYZE ? AgentsAnalyzeParams :
  T extends ToolName.AGENTS_SEARCH ? AgentsSearchParams :
  never;