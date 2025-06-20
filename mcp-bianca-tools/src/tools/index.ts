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
  handleEkyteLogin,
  handleEkyteLoginAndNavigate,
  handleEkyteProcessNotifications,
  handleEkyteExploreSection,
  handleEkyteManageTask,
  handleEkyteAnalyzeMetrics,
  handleEkyteSmartSearch,
  startBrowserCleanup
} from './puppeteer/index.js';

export {
  handleManageSkills
} from './agents/index.js';

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
  handleNavigateAndScreenshot,
  handleEkyteLogin,
  handleEkyteLoginAndNavigate,
  handleEkyteProcessNotifications,
  handleEkyteExploreSection,
  handleEkyteManageTask,
  handleEkyteAnalyzeMetrics,
  handleEkyteSmartSearch
} from './puppeteer/index.js';

import {
  handleOpenUrl
} from './browser/index.js';

import {
  handleListAgents,
  handleGetAgentDetails,
  handleAnalyzeAgent,
  handleSearchAgents,
  handleManageSkills
} from './agents/index.js';

export const toolHandlers = {
  // Puppeteer Básico
  'puppeteer_navigate': handleNavigate,
  'puppeteer_screenshot': handleScreenshot,
  'puppeteer_click': handleClick,
  'puppeteer_type': handleType,
  'puppeteer_get_content': handleGetContent,
  'puppeteer_new_tab': handleNewTab,
  'open_browser': handleOpenBrowser,
  'puppeteer_navigate_and_screenshot': handleNavigateAndScreenshot,
  
  // Habilidades Ekyte
  'ekyte_login': handleEkyteLogin,                           // HABILIDADE 1: Login
  'ekyte_login_and_navigate': handleEkyteLoginAndNavigate,   // HABILIDADE 2: Login + Navegação
  'ekyte_process_notifications': handleEkyteProcessNotifications, // HABILIDADE 3: Processamento de Notificações
  'ekyte_explore_section': handleEkyteExploreSection,       // HABILIDADE 4: Exploração de Seções
  'ekyte_manage_task': handleEkyteManageTask,               // HABILIDADE 5: Gerenciamento de Tarefas
  'ekyte_analyze_metrics': handleEkyteAnalyzeMetrics,       // HABILIDADE 6: Análise de Métricas
  'ekyte_smart_search': handleEkyteSmartSearch,             // HABILIDADE 7: Busca Inteligente
  
  // Browser
  'browser_open_url': handleOpenUrl,
  
  // Agents
  'agents_list': handleListAgents,
  'agents_get_details': handleGetAgentDetails,
  'agents_analyze': handleAnalyzeAgent,
  'agents_search': handleSearchAgents,
  'agents_manage_skills': handleManageSkills                   // NOVA: Gerenciamento de Habilidades Dinâmicas
} as const;