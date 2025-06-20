/**
 * Sistema de Aprendizado Evolutivo e Auto-Descoberta
 * Núcleo modular para evolução dinâmica de habilidades
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// Interfaces principais
export interface Skill {
  id: string;
  name: string;
  description: string;
  context: string;
  selectors: string[];
  steps: string[];
  triggers: string[];
  difficulty: SkillDifficulty;
  createdAt: string;
  lastUsed: string | null;
  usageCount: number;
  successRate: number;
  confidence: number;
  evolution: SkillEvolution;
  dependencies: string[];
  tags: string[];
  metadata: Record<string, any>;
}

export interface SkillEvolution {
  version: number;
  improvements: SkillImprovement[];
  parentSkillId?: string;
  childSkillIds: string[];
  adaptations: SkillAdaptation[];
}

export interface SkillImprovement {
  type: 'difficulty_promotion' | 'step_optimization' | 'selector_refinement' | 'context_expansion';
  description: string;
  timestamp: string;
  impact: number;
  data: Record<string, any>;
}

export interface SkillAdaptation {
  trigger: string;
  adaptation: string;
  timestamp: string;
  success: boolean;
}

export interface ContextData {
  currentUrl: string;
  pageTitle: string;
  uniqueElements: PageElement[];
  userActions: UserAction[];
  timestamp: string;
  sessionId: string;
}

export interface PageElement {
  type: string;
  selector: string;
  text: string;
  identifier: string;
  description: string;
  confidence: number;
  requiresAuth: boolean;
  hasValidation: boolean;
  isComplex: boolean;
  attributes: Record<string, string>;
}

export interface UserAction {
  action: string;
  target: string;
  timestamp: string;
  success: boolean;
  duration: number;
}

export type SkillDifficulty = 'basic' | 'intermediate' | 'advanced' | 'expert';
export type ExpertiseLevel = 'Learning Specialist' | 'Junior Specialist' | 'Intermediate Specialist' | 'Advanced Specialist' | 'Senior Specialist';

export interface SkillDatabase {
  version: string;
  lastUpdated: string;
  totalSkills: number;
  skillsByDifficulty: Record<SkillDifficulty, number>;
  skills: Record<string, Skill>;
  learningHistory: LearningEvent[];
  contextualMappings: Record<string, string[]>;
  expertiseEvolution: ExpertiseEvent[];
  sessionData: SessionData;
  interactionPatterns: InteractionPattern[];
}

export interface LearningEvent {
  action: 'skill_registered' | 'skill_executed' | 'skill_evolved' | 'skill_failed' | 'context_analyzed';
  skillId?: string;
  timestamp: string;
  context: string;
  metadata: Record<string, any>;
}

export interface ExpertiseEvent {
  previousLevel: ExpertiseLevel;
  newLevel: ExpertiseLevel;
  timestamp: string;
  triggerSkillId: string;
  totalSkills: number;
}

export interface SessionData {
  currentSession: string;
  totalSessions: number;
  averageSkillsPerSession: number;
  lastSessionTimestamp: string;
}

export interface InteractionPattern {
  pattern: string;
  frequency: number;
  successRate: number;
  associatedSkills: string[];
  lastSeen: string;
}

/**
 * Classe principal do Sistema Evolutivo
 */
export class EvolutionaryLearningSystem extends EventEmitter {
  private database: SkillDatabase;
  private dbPath: string;
  private isInitialized: boolean = false;
  private currentSession: string;
  private learningThresholds = {
    autoPromotionUsage: 10,
    autoPromotionSuccessRate: 0.9,
    contextSimilarityThreshold: 0.7,
    skillMatchThreshold: 0.6
  };

  constructor(dbPath?: string) {
    super();
    this.dbPath = dbPath || path.join(process.cwd(), '../workspace/ekyte-skills.json');
    this.currentSession = this.generateSessionId();
    this.initializeDatabase();
  }

  /**
   * Inicialização do sistema
   */
  private async initializeDatabase(): Promise<void> {
    try {
      const dbContent = await fs.readFile(this.dbPath, 'utf-8');
      this.database = JSON.parse(dbContent);
      
      // Migração de dados se necessário
      this.migrateDatabase();
    } catch {
      this.database = this.createEmptyDatabase();
    }

    this.database.sessionData.currentSession = this.currentSession;
    this.database.sessionData.totalSessions++;
    this.database.sessionData.lastSessionTimestamp = new Date().toISOString();
    
    this.isInitialized = true;
    this.emit('system:initialized', { session: this.currentSession });
  }

  private createEmptyDatabase(): SkillDatabase {
    return {
      version: '2.0.0',
      lastUpdated: new Date().toISOString(),
      totalSkills: 0,
      skillsByDifficulty: {
        basic: 0,
        intermediate: 0,
        advanced: 0,
        expert: 0
      },
      skills: {},
      learningHistory: [],
      contextualMappings: {},
      expertiseEvolution: [],
      sessionData: {
        currentSession: this.currentSession,
        totalSessions: 0,
        averageSkillsPerSession: 0,
        lastSessionTimestamp: new Date().toISOString()
      },
      interactionPatterns: []
    };
  }

  private migrateDatabase(): void {
    // Garantir compatibilidade com versões anteriores
    if (!this.database.version || this.database.version < '2.0.0') {
      this.database.version = '2.0.0';
      this.database.sessionData = this.database.sessionData || {
        currentSession: this.currentSession,
        totalSessions: 1,
        averageSkillsPerSession: 0,
        lastSessionTimestamp: new Date().toISOString()
      };
      this.database.interactionPatterns = this.database.interactionPatterns || [];
    }
  }

  /**
   * Auto-descoberta de habilidades durante navegação
   */
  async discoverSkills(contextData: ContextData): Promise<Skill[]> {
    await this.ensureInitialized();
    
    const discoveredSkills: Skill[] = [];
    
    if (!contextData.uniqueElements) return discoveredSkills;

    for (const element of contextData.uniqueElements) {
      if (this.isSkillWorthy(element, contextData)) {
        const skill = await this.createSkillFromElement(element, contextData);
        
        // Verificar se já existe habilidade similar
        const similarSkill = this.findSimilarSkill(skill);
        
        if (similarSkill) {
          // Evoluir habilidade existente
          await this.evolveExistingSkill(similarSkill, skill, contextData);
        } else {
          // Registrar nova habilidade
          await this.registerSkill(skill);
          discoveredSkills.push(skill);
        }
      }
    }

    // Analisar padrões de interação
    await this.analyzeInteractionPatterns(contextData);
    
    this.emit('skills:discovered', { 
      count: discoveredSkills.length, 
      skills: discoveredSkills.map(s => s.name),
      context: contextData.currentUrl 
    });

    return discoveredSkills;
  }

  /**
   * Registro de habilidade com validação e otimização
   */
  async registerSkill(skillData: Partial<Skill>): Promise<Skill> {
    await this.ensureInitialized();

    const skill: Skill = {
      id: this.generateSkillId(skillData.name!),
      name: skillData.name!,
      description: skillData.description!,
      context: skillData.context!,
      selectors: skillData.selectors || [],
      steps: skillData.steps || [],
      triggers: skillData.triggers || [],
      difficulty: skillData.difficulty || 'basic',
      createdAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0,
      successRate: 0,
      confidence: skillData.confidence || 0.8,
      evolution: {
        version: 1,
        improvements: [],
        childSkillIds: [],
        adaptations: []
      },
      dependencies: skillData.dependencies || [],
      tags: this.generateTags(skillData),
      metadata: skillData.metadata || {}
    };

    // Validar e otimizar
    this.validateSkill(skill);
    this.optimizeSkill(skill);

    // Registrar no banco
    this.database.skills[skill.id] = skill;
    this.database.totalSkills++;
    this.database.skillsByDifficulty[skill.difficulty]++;

    // Registrar evento de aprendizado
    this.addLearningEvent({
      action: 'skill_registered',
      skillId: skill.id,
      timestamp: new Date().toISOString(),
      context: skill.context,
      metadata: { difficulty: skill.difficulty, tags: skill.tags }
    });

    await this.saveDatabase();
    
    this.emit('skill:registered', { skill: skill.name, difficulty: skill.difficulty });
    
    return skill;
  }

  /**
   * Execução de habilidade baseada em linguagem natural
   */
  async executeSkillFromNaturalLanguage(query: string, contextData?: ContextData): Promise<{
    skill: Skill | null;
    confidence: number;
    executionPlan: string[];
    alternatives: Skill[];
  }> {
    await this.ensureInitialized();

    const matches = await this.matchSkillsFromQuery(query, contextData);
    
    if (matches.length === 0) {
      this.emit('skill:not_found', { query, suggestions: await this.generateSuggestions(query) });
      return {
        skill: null,
        confidence: 0,
        executionPlan: [],
        alternatives: []
      };
    }

    const bestMatch = matches[0];
    
    // Atualizar estatísticas de uso
    await this.updateSkillUsage(bestMatch.skill.id, true);
    
    // Gerar plano de execução contextual
    const executionPlan = await this.generateExecutionPlan(bestMatch.skill, contextData);
    
    this.emit('skill:executed', { 
      skill: bestMatch.skill.name, 
      confidence: bestMatch.confidence,
      query 
    });

    return {
      skill: bestMatch.skill,
      confidence: bestMatch.confidence,
      executionPlan,
      alternatives: matches.slice(1, 4).map(m => m.skill)
    };
  }

  /**
   * Evolução automática do sistema
   */
  async evolveSystem(): Promise<{
    promotions: SkillImprovement[];
    newPatterns: InteractionPattern[];
    expertiseChange: ExpertiseEvent | null;
  }> {
    await this.ensureInitialized();

    const promotions: SkillImprovement[] = [];
    const newPatterns: InteractionPattern[] = [];
    
    // Evolução de habilidades individuais
    for (const skill of Object.values(this.database.skills)) {
      const improvements = await this.evolveSkill(skill);
      promotions.push(...improvements);
    }

    // Descoberta de novos padrões
    const patterns = await this.discoverInteractionPatterns();
    newPatterns.push(...patterns);

    // Verificar mudança de expertise
    const currentLevel = this.calculateExpertiseLevel();
    const lastLevel = this.database.expertiseEvolution.length > 0 
      ? this.database.expertiseEvolution[this.database.expertiseEvolution.length - 1].newLevel
      : 'Learning Specialist';

    let expertiseChange: ExpertiseEvent | null = null;
    
    if (currentLevel !== lastLevel) {
      expertiseChange = {
        previousLevel: lastLevel,
        newLevel: currentLevel,
        timestamp: new Date().toISOString(),
        triggerSkillId: this.findMostRecentSkill()?.id || '',
        totalSkills: this.database.totalSkills
      };
      
      this.database.expertiseEvolution.push(expertiseChange);
      this.emit('expertise:evolved', expertiseChange);
    }

    await this.saveDatabase();

    return { promotions, newPatterns, expertiseChange };
  }

  /**
   * Análise contextual para sugestões inteligentes
   */
  async analyzeContext(contextData: ContextData): Promise<{
    suggestions: ContextualSuggestion[];
    opportunities: LearningOpportunity[];
    risks: string[];
  }> {
    await this.ensureInitialized();

    const suggestions = await this.generateContextualSuggestions(contextData);
    const opportunities = await this.identifyLearningOpportunities(contextData);
    const risks = await this.assessRisks(contextData);

    this.addLearningEvent({
      action: 'context_analyzed',
      timestamp: new Date().toISOString(),
      context: contextData.currentUrl,
      metadata: { 
        suggestionsCount: suggestions.length,
        opportunitiesCount: opportunities.length,
        risksCount: risks.length
      }
    });

    return { suggestions, opportunities, risks };
  }

  /**
   * Métodos auxiliares privados
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSkillId(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private generateTags(skillData: Partial<Skill>): string[] {
    const tags: string[] = [];
    
    if (skillData.context?.includes('task')) tags.push('task-management');
    if (skillData.context?.includes('campaign')) tags.push('campaigns');
    if (skillData.description?.toLowerCase().includes('create')) tags.push('creation');
    if (skillData.description?.toLowerCase().includes('edit')) tags.push('editing');
    if (skillData.selectors?.some(s => s.includes('form'))) tags.push('forms');
    
    return tags;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }
  }

  private async saveDatabase(): Promise<void> {
    this.database.lastUpdated = new Date().toISOString();
    await fs.writeFile(this.dbPath, JSON.stringify(this.database, null, 2));
  }

  // Continua na próxima parte...
  private addLearningEvent(event: LearningEvent): void {
    this.database.learningHistory.push(event);
    
    // Manter apenas os últimos 1000 eventos
    if (this.database.learningHistory.length > 1000) {
      this.database.learningHistory = this.database.learningHistory.slice(-1000);
    }
  }

  // Métodos auxiliares que serão implementados na próxima parte
  private isSkillWorthy(element: PageElement, context: ContextData): boolean {
    // Implementação detalhada será adicionada
    return true;
  }

  private async createSkillFromElement(element: PageElement, context: ContextData): Promise<Skill> {
    // Implementação detalhada será adicionada
    return {} as Skill;
  }

  // ... outros métodos auxiliares
}

// Interfaces auxiliares
export interface ContextualSuggestion {
  skillName: string;
  reason: string;
  confidence: number;
  priority: number;
}

export interface LearningOpportunity {
  type: string;
  description: string;
  potentialSkills: string[];
  effort: number;
}

// Exportar instância singleton
export const evolutionarySystem = new EvolutionaryLearningSystem(); 