import { toolHandlers } from '../tools/index.js';

export interface ToolStats {
  total: number;
  categories: {
    puppeteer_basic: number;
    ekyte_skills: number;
    browser: number;
    agents: number;
  };
  evolution: {
    initial_tools: number;
    ekyte_skills_added: number;
    growth_percentage: number;
  };
}

export function getToolStats(): ToolStats {
  const tools = Object.keys(toolHandlers);
  
  const puppeteerBasic = tools.filter(tool => 
    tool.startsWith('puppeteer_') || tool === 'open_browser'
  ).length;
  
  const ekyteSkills = tools.filter(tool => 
    tool.startsWith('ekyte_')
  ).length;
  
  const browser = tools.filter(tool => 
    tool.startsWith('browser_')
  ).length;
  
  const agents = tools.filter(tool => 
    tool.startsWith('agents_')
  ).length;
  
  const initialTools = 12; // Ferramentas iniciais do MCP
  const currentTotal = tools.length;
  const skillsAdded = ekyteSkills;
  const growthPercentage = Math.round(((currentTotal - initialTools) / initialTools) * 100);
  
  return {
    total: currentTotal,
    categories: {
      puppeteer_basic: puppeteerBasic,
      ekyte_skills: ekyteSkills,
      browser: browser,
      agents: agents
    },
    evolution: {
      initial_tools: initialTools,
      ekyte_skills_added: skillsAdded,
      growth_percentage: growthPercentage
    }
  };
}

export function displayToolStats(): string {
  const stats = getToolStats();
  
  return `
🔧 **BIANCA TOOLS - ESTATÍSTICAS EVOLUTIVAS**

📊 **TOTAL DE FERRAMENTAS:** ${stats.total}

📋 **CATEGORIAS:**
   🔹 Puppeteer Básico: ${stats.categories.puppeteer_basic} ferramentas
   🧠 Habilidades Ekyte: ${stats.categories.ekyte_skills} ferramentas
   🌐 Browser: ${stats.categories.browser} ferramentas
   🤖 Agents: ${stats.categories.agents} ferramentas

📈 **EVOLUÇÃO:**
   ⚡ Ferramentas Iniciais: ${stats.evolution.initial_tools}
   🚀 Habilidades Ekyte Adicionadas: ${stats.evolution.ekyte_skills_added}
   📊 Crescimento: +${stats.evolution.growth_percentage}%

🎯 **PRÓXIMAS HABILIDADES PLANEJADAS:**
   • HABILIDADE 8: Gerador de Relatórios
   • HABILIDADE 9: Monitor de Performance
   • HABILIDADE 10: Integração com APIs
   • HABILIDADE 11: Backup de Dados
   • HABILIDADE 12: Análise Preditiva
`;
}

export function logToolEvolution(): void {
  console.log(displayToolStats());
} 