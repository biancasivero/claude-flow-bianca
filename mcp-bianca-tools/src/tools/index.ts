/**
 * Tools Index
 * 
 * Exporta todas as ferramentas organizadas por categoria
 */

// Puppeteer Tools
export {
  puppeteerTools,
  handleNavigate,
  handleScreenshot,
  handleClick,
  handleType,
  handleGetContent,
  handleNewTab,
  handleOpenBrowser,
  handleNavigateAndScreenshot,
  startBrowserCleanup
} from './puppeteer/index.js';

// Browser Tools
export {
  browserTools,
  handleOpenUrl
} from './browser/index.js';

// Agents Tools
export {
  agentsTools,
  handleListAgents,
  handleGetAgentDetails,
  handleAnalyzeAgent,
  handleSearchAgents
} from './agents/index.js';

// Combinar todas as ferramentas
import { puppeteerTools } from './puppeteer/index.js';
import { browserTools } from './browser/index.js';
import { agentsTools } from './agents/index.js';

export const allTools = [
  ...puppeteerTools,
  ...browserTools,
  ...agentsTools
];

// Mapa de handlers por nome da ferramenta
import {
  handleNavigate,
  handleScreenshot,
  handleClick,
  handleType,
  handleGetContent,
  handleNewTab,
  handleOpenBrowser,
  handleNavigateAndScreenshot
} from './puppeteer/index.js';

import {
  handleOpenUrl
} from './browser/index.js';

import {
  handleListAgents,
  handleGetAgentDetails,
  handleAnalyzeAgent,
  handleSearchAgents
} from './agents/index.js';

export const toolHandlers = {
  // Puppeteer
  'puppeteer_navigate': handleNavigate,
  'puppeteer_screenshot': handleScreenshot,
  'puppeteer_click': handleClick,
  'puppeteer_type': handleType,
  'puppeteer_get_content': handleGetContent,
  'puppeteer_new_tab': handleNewTab,
  'open_browser': handleOpenBrowser,
  'puppeteer_navigate_and_screenshot': handleNavigateAndScreenshot,
  
  // Browser
  'browser_open_url': handleOpenUrl,
  
  // Agents
  'agents_list': handleListAgents,
  'agents_get_details': handleGetAgentDetails,
  'agents_analyze': handleAnalyzeAgent,
  'agents_search': handleSearchAgents
} as const;