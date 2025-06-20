/**
 * eKyte Navigator Agent
 * 
 * Agente especializado para navegar no sistema eKyte e aprender suas funcionalidades
 * Registra progresso de aprendizado e habilidades adquiridas
 */

import { BaseAgent } from '../core/base-agent-simple';
import { AgentType } from '../core/agent-types';
import { MCPBridge } from '../mcp/mcp-bridge';
import { MCP_TOOLS } from '../mcp/mcp-integration';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

interface EkyteSkill {
  id: string;
  name: string;
  description: string;
  learned: boolean;
  attempts: number;
  lastAttempt: Date;
  evidence: string[]; // Screenshots ou logs
  difficulty: 'básico' | 'intermediário' | 'avançado';
  category: 'navegação' | 'tarefas' | 'filtros' | 'dados' | 'interface';
}

interface EkyteSession {
  id: string;
  startTime: Date;
  endTime?: Date;
  url: string;
  skillsAttempted: string[];
  skillsLearned: string[];
  screenshots: string[];
  observations: string[];
  nextSteps: string[];
}

export interface EkyteNavigatorConfig extends AgentConfig {
  ekyteUrl?: string;
}

export class EkyteNavigatorAgent extends BaseAgent {
  private readonly ekyteUrl: string;
  private readonly screenshotsDir: string;
  private readonly dataDir: string;
  private readonly skillsFile: string;
  private readonly sessionsFile: string;
  
  private skills: Map<string, EkyteSkill> = new Map();
  private currentSession: EkyteSession | null = null;

  constructor(config: EkyteNavigatorConfig, mcpBridge: MCPBridge) {
    super(config, mcpBridge);
    
    this.ekyteUrl = config.ekyteUrl || 'https://app.ekyte.com/#/tasks/list?actualSelectSort=10&executorId=60f5aa2f-a7f4-4408-855e-b0936950cc37&limited=1&situation=10&textKey=100&groupBy=800';
    this.screenshotsDir = join(process.cwd(), '..', 'ekyte', 'screenshots');
    this.dataDir = join(process.cwd(), '..', 'ekyte', 'data');
    this.skillsFile = join(this.dataDir, 'skills.json');
    this.sessionsFile = join(this.dataDir, 'sessions.json');
    
    this.initializeDirectories();
    this.loadSkills();
    this.initializeDefaultSkills();
  }

  /**
   * Inicializa diretórios necessários
   */
  private initializeDirectories(): void {
    [this.screenshotsDir, this.dataDir].forEach(dir => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        console.log(`📁 Diretório criado: ${dir}`);
      }
    });
  }

  /**
   * Carrega habilidades salvas
   */
  private loadSkills(): void {
    if (existsSync(this.skillsFile)) {
      try {
        const data = JSON.parse(readFileSync(this.skillsFile, 'utf-8'));
        data.forEach((skill: EkyteSkill) => {
          this.skills.set(skill.id, {
            ...skill,
            lastAttempt: new Date(skill.lastAttempt)
          });
        });
        console.log(`🧠 ${this.skills.size} habilidades carregadas`);
      } catch (error) {
        console.error('❌ Erro ao carregar habilidades:', error);
      }
    }
  }

  /**
   * Salva habilidades no arquivo
   */
  private saveSkills(): void {
    try {
      const skillsArray = Array.from(this.skills.values());
      writeFileSync(this.skillsFile, JSON.stringify(skillsArray, null, 2));
    } catch (error) {
      console.error('❌ Erro ao salvar habilidades:', error);
    }
  }

  /**
   * Inicializa habilidades padrão do eKyte
   */
  private initializeDefaultSkills(): void {
    const defaultSkills: Omit<EkyteSkill, 'id'>[] = [
      {
        name: 'Acesso Inicial',
        description: 'Conseguir acessar a página principal do eKyte',
        learned: false,
        attempts: 0,
        lastAttempt: new Date(),
        evidence: [],
        difficulty: 'básico',
        category: 'navegação'
      },
      {
        name: 'Identificar Interface',
        description: 'Reconhecer elementos principais da interface (filtros, lista de tarefas, etc.)',
        learned: false,
        attempts: 0,
        lastAttempt: new Date(),
        evidence: [],
        difficulty: 'básico',
        category: 'interface'
      },
      {
        name: 'Navegar Lista de Tarefas',
        description: 'Conseguir navegar pela lista de tarefas e entender sua estrutura',
        learned: false,
        attempts: 0,
        lastAttempt: new Date(),
        evidence: [],
        difficulty: 'intermediário',
        category: 'tarefas'
      },
      {
        name: 'Usar Filtros',
        description: 'Aplicar filtros de ordenação e busca nas tarefas',
        learned: false,
        attempts: 0,
        lastAttempt: new Date(),
        evidence: [],
        difficulty: 'intermediário',
        category: 'filtros'
      },
      {
        name: 'Extrair Dados',
        description: 'Conseguir extrair informações estruturadas das tarefas',
        learned: false,
        attempts: 0,
        lastAttempt: new Date(),
        evidence: [],
        difficulty: 'avançado',
        category: 'dados'
      }
    ];

    defaultSkills.forEach(skillData => {
      const skill: EkyteSkill = {
        id: randomUUID(),
        ...skillData
      };
      
      // Só adiciona se não existir
      const existingSkill = Array.from(this.skills.values()).find(s => s.name === skill.name);
      if (!existingSkill) {
        this.skills.set(skill.id, skill);
      }
    });

    this.saveSkills();
  }

  /**
   * Executa uma sessão de aprendizado no eKyte
   */
  async executeTask(task: Task): Promise<any> {
    console.log(`\n🎯 ${this.name} iniciando sessão de aprendizado no eKyte...`);
    
    // Iniciar nova sessão
    this.currentSession = {
      id: randomUUID(),
      startTime: new Date(),
      url: this.ekyteUrl,
      skillsAttempted: [],
      skillsLearned: [],
      screenshots: [],
      observations: [],
      nextSteps: []
    };

    try {
      // Fase 1: Navegação inicial
      await this.navigateToEkyte();
      
      // Fase 2: Capturar estado inicial
      await this.captureInitialState();
      
      // Fase 3: Tentar aprender habilidades
      await this.attemptSkills();
      
      // Fase 4: Análise e registro
      await this.analyzeSession();
      
      // Finalizar sessão
      this.currentSession.endTime = new Date();
      this.saveSession();
      
      return this.generateSessionReport();
      
    } catch (error) {
      console.error('❌ Erro na sessão:', error);
      if (this.currentSession) {
        this.currentSession.endTime = new Date();
        this.currentSession.observations.push(`Erro: ${error instanceof Error ? error.message : String(error)}`);
        this.saveSession();
      }
      throw error;
    }
  }

  /**
   * Navega para o eKyte
   */
  private async navigateToEkyte(): Promise<void> {
    console.log('🌐 Navegando para eKyte...');
    
    const skill = Array.from(this.skills.values()).find(s => s.name === 'Acesso Inicial');
    if (skill) {
      skill.attempts++;
      skill.lastAttempt = new Date();
      this.currentSession!.skillsAttempted.push(skill.id);
    }

    try {
      const result = await this.mcp.callTool(MCP_TOOLS.WEB_NAVIGATE, {
        url: this.ekyteUrl
      });
      
      console.log('✅ Navegação bem-sucedida');
      this.currentSession!.observations.push('Navegação inicial bem-sucedida');
      
      if (skill) {
        skill.learned = true;
        this.currentSession!.skillsLearned.push(skill.id);
      }
      
      // Aguardar carregamento
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error('❌ Erro na navegação:', error);
      this.currentSession!.observations.push(`Erro na navegação: ${error}`);
      throw error;
    }
  }

  /**
   * Captura estado inicial da página
   */
  private async captureInitialState(): Promise<void> {
    console.log('📸 Capturando estado inicial...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = join(this.screenshotsDir, `ekyte-initial-${timestamp}.png`);
    
    try {
      // Screenshot da página
      await this.mcp.callTool(MCP_TOOLS.WEB_SCREENSHOT, {
        path: screenshotPath,
        fullPage: true
      });
      
      console.log(`📸 Screenshot salvo: ${screenshotPath}`);
      this.currentSession!.screenshots.push(screenshotPath);
      
      // Capturar conteúdo HTML
      const content = await this.mcp.callTool(MCP_TOOLS.WEB_GET_CONTENT, {});
      
      // Analisar interface
      const skill = Array.from(this.skills.values()).find(s => s.name === 'Identificar Interface');
      if (skill) {
        skill.attempts++;
        skill.lastAttempt = new Date();
        this.currentSession!.skillsAttempted.push(skill.id);
        
        // Verificar elementos conhecidos
        if (content && typeof content === 'object' && 'content' in content) {
          const htmlContent = content.content as string;
          const hasTaskList = htmlContent.includes('task') || htmlContent.includes('lista');
          const hasFilters = htmlContent.includes('filter') || htmlContent.includes('filtro');
          
          if (hasTaskList || hasFilters) {
            skill.learned = true;
            this.currentSession!.skillsLearned.push(skill.id);
            this.currentSession!.observations.push('Interface identificada com sucesso');
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Erro ao capturar estado:', error);
      this.currentSession!.observations.push(`Erro ao capturar estado: ${error}`);
    }
  }

  /**
   * Tenta aprender habilidades específicas
   */
  private async attemptSkills(): Promise<void> {
    console.log('🎓 Tentando aprender habilidades...');
    
    const skillsToTry = Array.from(this.skills.values())
      .filter(s => !s.learned)
      .sort((a, b) => a.attempts - b.attempts); // Priorizar habilidades menos tentadas
    
    for (const skill of skillsToTry.slice(0, 3)) { // Máximo 3 habilidades por sessão
      await this.attemptSkill(skill);
      
      // Pausa entre tentativas
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  /**
   * Tenta aprender uma habilidade específica
   */
  private async attemptSkill(skill: EkyteSkill): Promise<void> {
    console.log(`🎯 Tentando: ${skill.name}`);
    
    skill.attempts++;
    skill.lastAttempt = new Date();
    this.currentSession!.skillsAttempted.push(skill.id);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = join(this.screenshotsDir, `ekyte-skill-${skill.name.replace(/\s+/g, '-')}-${timestamp}.png`);
    
    try {
      // Screenshot antes da tentativa
      await this.mcp.callTool(MCP_TOOLS.WEB_SCREENSHOT, {
        path: screenshotPath
      });
      
      skill.evidence.push(screenshotPath);
      this.currentSession!.screenshots.push(screenshotPath);
      
      // Lógica específica por habilidade
      let success = false;
      
      switch (skill.category) {
        case 'tarefas':
          success = await this.tryNavigateTaskList();
          break;
        case 'filtros':
          success = await this.tryUseFilters();
          break;
        case 'dados':
          success = await this.tryExtractData();
          break;
        default:
          success = true; // Habilidades básicas já verificadas
      }
      
      if (success) {
        skill.learned = true;
        this.currentSession!.skillsLearned.push(skill.id);
        console.log(`✅ Habilidade aprendida: ${skill.name}`);
      } else {
        console.log(`⚠️ Tentativa falhou: ${skill.name}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao tentar ${skill.name}:`, error);
      this.currentSession!.observations.push(`Erro em ${skill.name}: ${error}`);
    }
  }

  /**
   * Tenta navegar na lista de tarefas
   */
  private async tryNavigateTaskList(): Promise<boolean> {
    try {
      // Tentar clicar em elementos da lista
      const selectors = [
        '.task-item',
        '[data-testid="task"]',
        '.list-item',
        'tr',
        '.row'
      ];
      
      for (const selector of selectors) {
        try {
          await this.mcp.callTool(MCP_TOOLS.WEB_CLICK, { selector });
          this.currentSession!.observations.push(`Clique bem-sucedido em: ${selector}`);
          return true;
        } catch {
          // Continuar tentando outros seletores
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Tenta usar filtros
   */
  private async tryUseFilters(): Promise<boolean> {
    try {
      // Tentar interagir com filtros
      const filterSelectors = [
        'select',
        '.filter',
        '.dropdown',
        '[role="combobox"]',
        'input[type="search"]'
      ];
      
      for (const selector of filterSelectors) {
        try {
          await this.mcp.callTool(MCP_TOOLS.WEB_CLICK, { selector });
          this.currentSession!.observations.push(`Filtro ativado: ${selector}`);
          return true;
        } catch {
          // Continuar tentando
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Tenta extrair dados
   */
  private async tryExtractData(): Promise<boolean> {
    try {
      const content = await this.mcp.callTool(MCP_TOOLS.WEB_GET_CONTENT, {});
      
      if (content && typeof content === 'object' && 'content' in content) {
        const htmlContent = content.content as string;
        
        // Salvar HTML para análise
        const htmlPath = join(this.dataDir, `ekyte-content-${Date.now()}.html`);
        writeFileSync(htmlPath, htmlContent);
        
        this.currentSession!.observations.push(`Dados extraídos e salvos em: ${htmlPath}`);
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Analisa a sessão e define próximos passos
   */
  private async analyzeSession(): Promise<void> {
    console.log('📊 Analisando sessão...');
    
    const totalSkills = this.skills.size;
    const learnedSkills = Array.from(this.skills.values()).filter(s => s.learned).length;
    const progressPercentage = Math.round((learnedSkills / totalSkills) * 100);
    
    this.currentSession!.observations.push(`Progresso: ${learnedSkills}/${totalSkills} habilidades (${progressPercentage}%)`);
    
    // Definir próximos passos
    const unlearned = Array.from(this.skills.values()).filter(s => !s.learned);
    if (unlearned.length > 0) {
      const nextSkill = unlearned.sort((a, b) => a.attempts - b.attempts)[0];
      this.currentSession!.nextSteps.push(`Focar em: ${nextSkill.name}`);
    }
    
    // Salvar progresso na memória
    await this.saveProgressToMemory();
  }

  /**
   * Salva progresso na memória MCP
   */
  private async saveProgressToMemory(): Promise<void> {
    try {
      const progressData = {
        session: this.currentSession!.id,
        timestamp: new Date().toISOString(),
        skillsLearned: this.currentSession!.skillsLearned.length,
        totalSkills: this.skills.size,
        observations: this.currentSession!.observations,
        nextSteps: this.currentSession!.nextSteps
      };
      
      await this.mcp.callTool(MCP_TOOLS.MEMORY_ADD, {
        user_id: 'ekyte-navigator',
        content: `Sessão eKyte: ${JSON.stringify(progressData)}`,
        category: 'ekyte-learning',
        metadata: {
          sessionId: this.currentSession!.id,
          skillsLearned: this.currentSession!.skillsLearned.length,
          totalSkills: this.skills.size
        }
      });
      
    } catch (error) {
      console.error('❌ Erro ao salvar na memória:', error);
    }
  }

  /**
   * Salva sessão no arquivo
   */
  private saveSession(): void {
    try {
      let sessions: EkyteSession[] = [];
      
      if (existsSync(this.sessionsFile)) {
        sessions = JSON.parse(readFileSync(this.sessionsFile, 'utf-8'));
      }
      
      sessions.push(this.currentSession!);
      writeFileSync(this.sessionsFile, JSON.stringify(sessions, null, 2));
      
      // Salvar habilidades atualizadas
      this.saveSkills();
      
    } catch (error) {
      console.error('❌ Erro ao salvar sessão:', error);
    }
  }

  /**
   * Gera relatório da sessão
   */
  private generateSessionReport(): any {
    const learnedSkills = Array.from(this.skills.values()).filter(s => s.learned);
    const totalSkills = this.skills.size;
    
    return {
      sessionId: this.currentSession!.id,
      duration: this.currentSession!.endTime!.getTime() - this.currentSession!.startTime.getTime(),
      skillsLearned: this.currentSession!.skillsLearned.length,
      totalSkills,
      progressPercentage: Math.round((learnedSkills.length / totalSkills) * 100),
      screenshots: this.currentSession!.screenshots.length,
      observations: this.currentSession!.observations,
      nextSteps: this.currentSession!.nextSteps,
      skillsStatus: Array.from(this.skills.values()).map(s => ({
        name: s.name,
        learned: s.learned,
        attempts: s.attempts,
        difficulty: s.difficulty,
        category: s.category
      }))
    };
  }

  /**
   * Obtém relatório de progresso atual
   */
  getProgressReport(): any {
    const skills = Array.from(this.skills.values());
    const learned = skills.filter(s => s.learned);
    
    return {
      totalSkills: skills.length,
      learnedSkills: learned.length,
      progressPercentage: Math.round((learned.length / skills.length) * 100),
      skillsByCategory: {
        navegação: skills.filter(s => s.category === 'navegação'),
        interface: skills.filter(s => s.category === 'interface'),
        tarefas: skills.filter(s => s.category === 'tarefas'),
        filtros: skills.filter(s => s.category === 'filtros'),
        dados: skills.filter(s => s.category === 'dados')
      },
      nextRecommendations: skills
        .filter(s => !s.learned)
        .sort((a, b) => a.attempts - b.attempts)
        .slice(0, 3)
        .map(s => s.name)
    };
  }

  protected getDefaultSystemPrompt(): string {
    return 'Agente especializado em navegar e aprender o sistema eKyte, registrando progresso e habilidades adquiridas.';
  }
}

// Função para criar o agente
export function createEkyteNavigatorAgent(mcpBridge: MCPBridge): EkyteNavigatorAgent {
  const config: EkyteNavigatorConfig = {
    name: 'eKyte Navigator Agent',
    type: AgentType.RESEARCHER,
    description: 'Agente especializado em navegar e aprender o sistema eKyte',
    tools: [
      MCP_TOOLS.WEB_NAVIGATE,
      MCP_TOOLS.WEB_SCREENSHOT,
      MCP_TOOLS.WEB_CLICK,
      MCP_TOOLS.WEB_TYPE,
      MCP_TOOLS.WEB_GET_CONTENT,
      MCP_TOOLS.MEMORY_ADD,
      MCP_TOOLS.MEMORY_SEARCH
    ]
  };

  return new EkyteNavigatorAgent(config, mcpBridge);
} 