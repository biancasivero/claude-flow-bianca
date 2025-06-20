/**
 * Sistema de Aprendizado Evolutivo e Auto-Descoberta
 * Implementação prática e funcional para produção
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

export type SkillDifficulty = 'basic' | 'intermediate' | 'advanced' | 'expert';
export type ExpertiseLevel = 'Learning Specialist' | 'Junior Specialist' | 'Intermediate Specialist' | 'Advanced Specialist' | 'Senior Specialist';

export interface EvolutionarySkill {
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
  tags: string[];
  metadata: Record<string, any>;
  evolution: {
    version: number;
    improvements: Array<{
      type: string;
      description: string;
      timestamp: string;
      impact: number;
    }>;
  };
}

export interface EvolutionaryDatabase {
  version: string;
  lastUpdated: string;
  totalSkills: number;
  skillsByDifficulty: Record<SkillDifficulty, number>;
  skills: Record<string, EvolutionarySkill>;
  learningHistory: Array<{
    action: string;
    skillId?: string;
    timestamp: string;
    context: string;
    metadata: Record<string, any>;
  }>;
  expertiseLevel: ExpertiseLevel;
  sessionData: {
    currentSession: string;
    totalSessions: number;
    lastSessionTimestamp: string;
  };
  interactionPatterns: Array<{
    pattern: string;
    frequency: number;
    successRate: number;
    lastSeen: string;
  }>;
}

export interface SkillExecutionResult {
  skill: EvolutionarySkill | null;
  confidence: number;
  executionPlan: string[];
  alternatives: EvolutionarySkill[];
}

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

/**
 * Sistema de Aprendizado Evolutivo Principal
 */
export class EvolutionaryLearningSystem extends EventEmitter {
  private database!: EvolutionaryDatabase;
  private dbPath: string;
  private isInitialized: boolean = false;
  private currentSession: string;

  // Configurações de aprendizado
  private readonly config = {
    skillMatchThreshold: 0.6,
    autoPromotionUsage: 10,
    autoPromotionSuccessRate: 0.9,
    maxLearningHistory: 1000,
    maxInteractionPatterns: 500
  };

  constructor(dbPath?: string) {
    super();
    this.dbPath = dbPath || path.join(process.cwd(), '../workspace/evolutionary-skills.json');
    this.currentSession = this.generateSessionId();
    this.initializeDatabase();
  }

  /**
   * Inicialização assíncrona do sistema
   */
  private async initializeDatabase(): Promise<void> {
    try {
      const dbContent = await fs.readFile(this.dbPath, 'utf-8');
      this.database = JSON.parse(dbContent);
      
      // Migração de versão se necessário
      if (!this.database.version || this.database.version !== '2.0.0') {
        await this.migrateDatabase();
      }
    } catch {
      this.database = this.createEmptyDatabase();
    }

    // Atualizar dados da sessão
    this.database.sessionData.currentSession = this.currentSession;
    this.database.sessionData.totalSessions++;
    this.database.sessionData.lastSessionTimestamp = new Date().toISOString();
    
    this.isInitialized = true;
    await this.saveDatabase();
    
    this.emit('system:initialized', { 
      session: this.currentSession,
      totalSkills: this.database.totalSkills,
      expertiseLevel: this.database.expertiseLevel
    });
  }

  private createEmptyDatabase(): EvolutionaryDatabase {
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
      expertiseLevel: 'Learning Specialist',
      sessionData: {
        currentSession: this.currentSession,
        totalSessions: 0,
        lastSessionTimestamp: new Date().toISOString()
      },
      interactionPatterns: []
    };
  }

  private async migrateDatabase(): Promise<void> {
    // Migração para versão 2.0.0
    this.database.version = '2.0.0';
    
    // Adicionar campos faltantes
    if (!this.database.interactionPatterns) {
      this.database.interactionPatterns = [];
    }
    
    if (!this.database.sessionData) {
      this.database.sessionData = {
        currentSession: this.currentSession,
        totalSessions: 1,
        lastSessionTimestamp: new Date().toISOString()
      };
    }

    // Atualizar estrutura das habilidades existentes
    for (const skill of Object.values(this.database.skills)) {
      if (!skill.evolution) {
        skill.evolution = {
          version: 1,
          improvements: []
        };
      }
      
      if (!skill.tags) {
        skill.tags = this.generateTags(skill);
      }
    }

    console.log('🔄 Database migrated to version 2.0.0');
  }

  /**
   * Registro de nova habilidade
   */
  async registerSkill(skillData: {
    name: string;
    description: string;
    context: string;
    selectors?: string[];
    steps?: string[];
    triggers?: string[];
    difficulty?: SkillDifficulty;
    confidence?: number;
    metadata?: Record<string, any>;
  }): Promise<EvolutionarySkill> {
    await this.ensureInitialized();

    const skill: EvolutionarySkill = {
      id: this.generateSkillId(skillData.name),
      name: skillData.name,
      description: skillData.description,
      context: skillData.context,
      selectors: skillData.selectors || [],
      steps: skillData.steps || this.generateDefaultSteps(skillData.name),
      triggers: skillData.triggers || [skillData.name.toLowerCase()],
      difficulty: skillData.difficulty || 'basic',
      createdAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0,
      successRate: 0,
      confidence: skillData.confidence || 0.8,
      tags: this.generateTags(skillData),
      metadata: skillData.metadata || {},
      evolution: {
        version: 1,
        improvements: []
      }
    };

    // Verificar se já existe
    if (this.database.skills[skill.id]) {
      throw new Error(`Habilidade '${skill.name}' já existe`);
    }

    // Registrar no banco
    this.database.skills[skill.id] = skill;
    this.database.totalSkills++;
    this.database.skillsByDifficulty[skill.difficulty]++;

    // Atualizar nível de expertise
    this.database.expertiseLevel = this.calculateExpertiseLevel();

    // Registrar evento de aprendizado
    this.addLearningEvent({
      action: 'skill_registered',
      skillId: skill.id,
      timestamp: new Date().toISOString(),
      context: skill.context,
      metadata: { 
        difficulty: skill.difficulty, 
        tags: skill.tags,
        confidence: skill.confidence
      }
    });

    await this.saveDatabase();
    
    this.emit('skill:registered', { 
      skill: skill.name, 
      difficulty: skill.difficulty,
      expertiseLevel: this.database.expertiseLevel
    });
    
    return skill;
  }

  /**
   * Execução de habilidade baseada em linguagem natural
   */
  async executeSkillFromNaturalLanguage(query: string): Promise<SkillExecutionResult> {
    await this.ensureInitialized();

    const matches = this.matchSkillsFromQuery(query);
    
    if (matches.length === 0) {
      this.emit('skill:not_found', { 
        query, 
        suggestions: this.generateSuggestions(query) 
      });
      
      return {
        skill: null,
        confidence: 0,
        executionPlan: [],
        alternatives: []
      };
    }

    const bestMatch = matches[0];
    if (!bestMatch) {
      this.emit('skill:not_found', { 
        query, 
        suggestions: this.generateSuggestions(query) 
      });
      
      return {
        skill: null,
        confidence: 0,
        executionPlan: [],
        alternatives: []
      };
    }
    
    // Atualizar estatísticas de uso
    this.updateSkillUsage(bestMatch.skill.id, true);
    
    // Gerar plano de execução contextual
    const executionPlan = this.generateExecutionPlan(bestMatch.skill);
    
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
   * Listar todas as habilidades
   */
  async listSkills(): Promise<{
    totalSkills: number;
    skillsByDifficulty: Record<SkillDifficulty, number>;
    recentlyLearned: Array<{ action: string; skillId?: string; timestamp: string }>;
    availableSkills: string[];
    expertiseLevel: ExpertiseLevel;
    sessionInfo: {
      currentSession: string;
      totalSessions: number;
      lastUpdate: string;
    };
  }> {
    await this.ensureInitialized();

    return {
      totalSkills: this.database.totalSkills,
      skillsByDifficulty: this.database.skillsByDifficulty,
      recentlyLearned: this.database.learningHistory.slice(-5),
      availableSkills: Object.keys(this.database.skills),
      expertiseLevel: this.database.expertiseLevel,
      sessionInfo: {
        currentSession: this.database.sessionData.currentSession,
        totalSessions: this.database.sessionData.totalSessions,
        lastUpdate: this.database.lastUpdated
      }
    };
  }

  /**
   * Evolução automática do sistema
   */
  async evolveSystem(): Promise<{
    promotions: number;
    newExpertiseLevel: ExpertiseLevel;
    improvements: Array<{ skillId: string; improvement: string }>;
  }> {
    await this.ensureInitialized();

    let promotions = 0;
    const improvements: Array<{ skillId: string; improvement: string }> = [];
    
    // Evolução de habilidades individuais
    for (const skill of Object.values(this.database.skills)) {
      const skillImprovements = this.evolveSkill(skill);
      
      if (skillImprovements.length > 0) {
        promotions++;
        improvements.push(...skillImprovements.map(imp => ({
          skillId: skill.id,
          improvement: imp.description
        })));
      }
    }

    // Atualizar nível de expertise
    const oldLevel = this.database.expertiseLevel;
    const newExpertiseLevel = this.calculateExpertiseLevel();
    
    if (newExpertiseLevel !== oldLevel) {
      this.database.expertiseLevel = newExpertiseLevel;
      
      this.addLearningEvent({
        action: 'expertise_evolved',
        timestamp: new Date().toISOString(),
        context: 'system',
        metadata: { 
          from: oldLevel, 
          to: newExpertiseLevel,
          totalSkills: this.database.totalSkills
        }
      });
      
      this.emit('expertise:evolved', { from: oldLevel, to: newExpertiseLevel });
    }

    await this.saveDatabase();

    return { promotions, newExpertiseLevel, improvements };
  }

  /**
   * Auto-descoberta de habilidades
   */
  async discoverSkills(contextData: {
    currentUrl: string;
    pageTitle?: string;
    elements: Array<{
      type: string;
      selector: string;
      text: string;
      identifier: string;
      confidence: number;
      requiresAuth?: boolean;
      hasValidation?: boolean;
      isComplex?: boolean;
    }>;
  }): Promise<EvolutionarySkill[]> {
    await this.ensureInitialized();
    
    const discoveredSkills: EvolutionarySkill[] = [];
    
    for (const element of contextData.elements) {
      if (this.isSkillWorthy(element, contextData)) {
        const skillData = this.createSkillFromElement(element, contextData);
        
        // Verificar se já existe habilidade similar
        if (!this.findSimilarSkill(skillData)) {
          try {
            const skill = await this.registerSkill(skillData);
            discoveredSkills.push(skill);
          } catch (error) {
            // Habilidade já existe, ignorar
            console.log(`⚠️ Skill already exists: ${skillData.name}`);
          }
        }
      }
    }
    
    this.emit('skills:discovered', { 
      count: discoveredSkills.length, 
      skills: discoveredSkills.map(s => s.name),
      context: contextData.currentUrl 
    });

    return discoveredSkills;
  }

  /**
   * Análise contextual
   */
  async analyzeContext(contextData: {
    currentUrl: string;
    pageTitle?: string;
    elements?: Array<{ type: string; text: string; confidence: number }>;
  }): Promise<{
    suggestions: ContextualSuggestion[];
    opportunities: LearningOpportunity[];
    risks: string[];
  }> {
    await this.ensureInitialized();

    const suggestions = this.generateContextualSuggestions(contextData);
    const opportunities = this.identifyLearningOpportunities(contextData);
    const risks = this.assessRisks(contextData);

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

  // Métodos auxiliares privados
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSkillId(name: string): string {
    return name.toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  private generateTags(skillData: { name: string; description: string; context: string }): string[] {
    const tags: string[] = [];
    
    // Tags baseadas no contexto
    if (skillData.context.includes('task')) tags.push('task-management');
    if (skillData.context.includes('campaign')) tags.push('campaigns');
    if (skillData.context.includes('ekyte')) tags.push('ekyte-platform');
    
    // Tags baseadas na descrição
    const desc = skillData.description.toLowerCase();
    if (desc.includes('create') || desc.includes('criar')) tags.push('creation');
    if (desc.includes('edit') || desc.includes('editar')) tags.push('editing');
    if (desc.includes('delete') || desc.includes('excluir')) tags.push('deletion');
    if (desc.includes('form') || desc.includes('formulário')) tags.push('forms');
    if (desc.includes('nav') || desc.includes('naveg')) tags.push('navigation');
    
    return [...new Set(tags)];
  }

  private generateDefaultSteps(skillName: string): string[] {
    const name = skillName.toLowerCase();
    
    if (name.includes('create') || name.includes('criar')) {
      return [
        'Navegar para a seção apropriada',
        'Localizar botão de criação',
        'Clicar no botão',
        'Preencher formulário',
        'Salvar/Submeter'
      ];
    }
    
    if (name.includes('edit') || name.includes('editar')) {
      return [
        'Localizar item para edição',
        'Clicar em editar',
        'Modificar campos necessários',
        'Salvar alterações'
      ];
    }
    
    if (name.includes('login') || name.includes('entrar')) {
      return [
        'Navegar para página de login',
        'Inserir credenciais',
        'Clicar em entrar',
        'Aguardar redirecionamento'
      ];
    }
    
    return [
      'Localizar elemento alvo',
      'Interagir com elemento',
      'Verificar resultado da ação'
    ];
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeDatabase();
    }
  }

  private async saveDatabase(): Promise<void> {
    this.database.lastUpdated = new Date().toISOString();
    
    // Criar diretório se não existir
    const dir = path.dirname(this.dbPath);
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch {
      // Diretório já existe
    }
    
    await fs.writeFile(this.dbPath, JSON.stringify(this.database, null, 2));
  }

  private addLearningEvent(event: {
    action: string;
    skillId?: string;
    timestamp: string;
    context: string;
    metadata: Record<string, any>;
  }): void {
    this.database.learningHistory.push(event);
    
    // Manter apenas os últimos eventos
    if (this.database.learningHistory.length > this.config.maxLearningHistory) {
      this.database.learningHistory = this.database.learningHistory.slice(-this.config.maxLearningHistory);
    }
  }

  private matchSkillsFromQuery(query: string): Array<{ skill: EvolutionarySkill; confidence: number }> {
    const queryLower = query.toLowerCase();
    const matches: Array<{ skill: EvolutionarySkill; confidence: number }> = [];
    
    for (const skill of Object.values(this.database.skills)) {
      let confidence = 0;
      
      // Correspondência por triggers
      for (const trigger of skill.triggers) {
        if (queryLower.includes(trigger.toLowerCase())) {
          confidence += 0.4;
        }
      }
      
      // Correspondência por nome
      const nameWords = skill.name.toLowerCase().replace(/_/g, ' ').split(' ');
      for (const word of nameWords) {
        if (queryLower.includes(word) && word.length > 2) {
          confidence += 0.3;
        }
      }
      
      // Correspondência por descrição
      const descWords = skill.description.toLowerCase().split(' ');
      for (const word of descWords) {
        if (queryLower.includes(word) && word.length > 3) {
          confidence += 0.2;
        }
      }
      
      // Correspondência por tags
      for (const tag of skill.tags) {
        if (queryLower.includes(tag.toLowerCase())) {
          confidence += 0.3;
        }
      }
      
      // Boost por uso recente
      if (skill.lastUsed) {
        const daysSinceLastUse = (Date.now() - new Date(skill.lastUsed).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastUse < 7) {
          confidence += 0.1;
        }
      }
      
      if (confidence > this.config.skillMatchThreshold) {
        matches.push({ skill, confidence: Math.min(confidence, 1) });
      }
    }
    
    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  private generateSuggestions(query: string): string[] {
    const suggestions: string[] = [];
    const queryWords = query.toLowerCase().split(' ');
    
    for (const skill of Object.values(this.database.skills)) {
      for (const word of queryWords) {
        if (skill.name.toLowerCase().includes(word) || 
            skill.description.toLowerCase().includes(word)) {
          suggestions.push(`Talvez você quis dizer: "${skill.description}"`);
          break;
        }
      }
    }
    
    return [...new Set(suggestions)].slice(0, 3);
  }

  private updateSkillUsage(skillId: string, success: boolean): void {
    const skill = this.database.skills[skillId];
    if (skill) {
      skill.usageCount++;
      skill.lastUsed = new Date().toISOString();
      
      // Atualizar taxa de sucesso
      const totalAttempts = skill.usageCount;
      const successfulAttempts = Math.round(skill.successRate * (totalAttempts - 1)) + (success ? 1 : 0);
      skill.successRate = successfulAttempts / totalAttempts;
      
      this.addLearningEvent({
        action: success ? 'skill_executed' : 'skill_failed',
        skillId,
        timestamp: new Date().toISOString(),
        context: skill.context,
        metadata: { 
          usageCount: skill.usageCount, 
          successRate: skill.successRate,
          success
        }
      });
    }
  }

  private generateExecutionPlan(skill: EvolutionarySkill): string[] {
    const plan = [...skill.steps];
    
    // Adicionar verificação de dependências se necessário
    if (skill.context.includes('login') && skill.name !== 'ekyte_login') {
      plan.unshift('Verificar se está logado');
    }
    
    // Adicionar verificação final
    plan.push('Verificar sucesso da operação');
    
    return plan;
  }

  private evolveSkill(skill: EvolutionarySkill): Array<{ type: string; description: string; timestamp: string; impact: number }> {
    const improvements: Array<{ type: string; description: string; timestamp: string; impact: number }> = [];
    
    // Promoção automática de dificuldade
    if (skill.usageCount >= this.config.autoPromotionUsage && 
        skill.successRate >= this.config.autoPromotionSuccessRate) {
      
      const promotions: Record<SkillDifficulty, SkillDifficulty> = {
        'basic': 'intermediate',
        'intermediate': 'advanced',
        'advanced': 'expert',
        'expert': 'expert'
      };
      
      const newDifficulty = promotions[skill.difficulty];
      
      if (newDifficulty !== skill.difficulty) {
        // Atualizar contadores
        this.database.skillsByDifficulty[skill.difficulty]--;
        this.database.skillsByDifficulty[newDifficulty]++;
        
        skill.difficulty = newDifficulty;
        skill.evolution.version++;
        
        const improvement = {
          type: 'difficulty_promotion',
          description: `Promovido para ${newDifficulty} devido ao alto uso e sucesso`,
          timestamp: new Date().toISOString(),
          impact: 0.8
        };
        
        skill.evolution.improvements.push(improvement);
        improvements.push(improvement);
        
        this.emit('skill:promoted', { 
          skillName: skill.name, 
          from: skill.difficulty, 
          to: newDifficulty 
        });
      }
    }
    
    return improvements;
  }

  private calculateExpertiseLevel(): ExpertiseLevel {
    const total = this.database.totalSkills;
    const expert = this.database.skillsByDifficulty.expert;
    const advanced = this.database.skillsByDifficulty.advanced;
    
    if (total >= 50 && expert >= 10) return 'Senior Specialist';
    if (total >= 30 && expert >= 5) return 'Advanced Specialist';
    if (total >= 20 && advanced >= 5) return 'Intermediate Specialist';
    if (total >= 10) return 'Junior Specialist';
    return 'Learning Specialist';
  }

  private generateContextualSuggestions(contextData: { currentUrl: string; pageTitle?: string }): ContextualSuggestion[] {
    const suggestions: ContextualSuggestion[] = [];
    
    // Sugestões baseadas na URL
    if (contextData.currentUrl.includes('task')) {
      suggestions.push({
        skillName: 'ekyte_manage_task',
        reason: 'Contexto de gerenciamento de tarefas detectado',
        confidence: 0.9,
        priority: 1
      });
    }
    
    if (contextData.currentUrl.includes('campaign')) {
      suggestions.push({
        skillName: 'ekyte_create_campaign',
        reason: 'Contexto de campanhas detectado',
        confidence: 0.8,
        priority: 2
      });
    }
    
    if (contextData.currentUrl.includes('login')) {
      suggestions.push({
        skillName: 'ekyte_login',
        reason: 'Página de login detectada',
        confidence: 0.95,
        priority: 1
      });
    }
    
    return suggestions.sort((a, b) => b.priority - a.priority);
  }

  private identifyLearningOpportunities(contextData: { currentUrl: string; elements?: any[] }): LearningOpportunity[] {
    const opportunities: LearningOpportunity[] = [];
    
    // Verificar se há elementos não mapeados
    if (contextData.elements && contextData.elements.length > 0) {
      const unmappedElements = contextData.elements.filter(el => 
        this.isSkillWorthy(el, contextData) && 
        !this.findSimilarSkill(this.createSkillFromElement(el, contextData))
      );
      
      if (unmappedElements.length > 0) {
        opportunities.push({
          type: 'new_skills',
          description: `${unmappedElements.length} novos elementos detectados para aprendizado`,
          potentialSkills: unmappedElements.map(el => el.identifier || el.type),
          effort: Math.min(unmappedElements.length * 2, 10)
        });
      }
    }
    
    // Verificar habilidades subutilizadas
    const underusedSkills = Object.values(this.database.skills).filter(s => 
      s.usageCount < 3 && 
      (Date.now() - new Date(s.createdAt).getTime()) > (7 * 24 * 60 * 60 * 1000) // 7 dias
    );
    
    if (underusedSkills.length > 0) {
      opportunities.push({
        type: 'underused_skills',
        description: `${underusedSkills.length} habilidades podem ser refinadas ou removidas`,
        potentialSkills: underusedSkills.map(s => s.name),
        effort: 3
      });
    }
    
    return opportunities;
  }

  private assessRisks(contextData: { currentUrl: string; elements?: any[] }): string[] {
    const risks: string[] = [];
    
    // Verificar elementos de alto risco
    if (contextData.elements) {
      for (const element of contextData.elements) {
        if (element.text && element.text.toLowerCase().includes('delete') && element.confidence < 0.8) {
          risks.push(`Elemento de exclusão com baixa confiança detectado`);
        }
        
        if (element.text && element.text.toLowerCase().includes('remove') && element.confidence < 0.7) {
          risks.push(`Elemento de remoção com confiança muito baixa`);
        }
      }
    }
    
    // Verificar contexto de risco
    if (contextData.currentUrl.includes('admin') || contextData.currentUrl.includes('config')) {
      risks.push(`Contexto administrativo detectado - cuidado extra necessário`);
    }
    
    return risks;
  }

  private isSkillWorthy(element: any, contextData: { currentUrl: string }): boolean {
    const worthyTypes = ['button', 'form', 'modal', 'dropdown', 'table', 'chart', 'input', 'select'];
    const worthyActions = ['submit', 'create', 'edit', 'delete', 'export', 'import', 'save', 'cancel'];
    
    const hasWorthyType = worthyTypes.some(type => element.type?.toLowerCase().includes(type));
    const hasWorthyAction = worthyActions.some(action => element.text?.toLowerCase().includes(action));
    const isInRelevantContext = contextData.currentUrl.includes('ekyte') || contextData.currentUrl.includes('localhost');
    const isNotGeneric = element.text && element.text.length > 2 && 
                        !['ok', 'yes', 'no', 'cancel', 'close'].includes(element.text.toLowerCase());
    
    return (hasWorthyType || hasWorthyAction) && 
           isInRelevantContext && 
           isNotGeneric && 
           element.confidence > 0.5;
  }

  private createSkillFromElement(element: any, contextData: { currentUrl: string; pageTitle?: string }): {
    name: string;
    description: string;
    context: string;
    selectors: string[];
    steps: string[];
    triggers: string[];
    difficulty: SkillDifficulty;
    confidence: number;
    metadata: Record<string, any>;
  } {
    const domain = this.extractDomain(contextData.currentUrl);
    const action = this.extractAction(element);
    const target = this.extractTarget(element);
    
    return {
      name: `${domain}_${action}_${target}`,
      description: `${action} ${target} no sistema ${domain}`,
      context: contextData.currentUrl,
      selectors: [element.selector],
      steps: this.generateStepsForElement(element),
      triggers: [element.text, element.identifier, `${action} ${target}`].filter(Boolean),
      difficulty: this.assessDifficulty(element),
      confidence: element.confidence || 0.8,
      metadata: { 
        elementType: element.type, 
        pageTitle: contextData.pageTitle || '',
        discoveryTimestamp: new Date().toISOString(),
        autoDiscovered: true
      }
    };
  }

  private findSimilarSkill(skillData: { name: string; context: string }): EvolutionarySkill | null {
    for (const skill of Object.values(this.database.skills)) {
      if (this.calculateSimilarity(skillData, skill) > 0.7) {
        return skill;
      }
    }
    return null;
  }

  private calculateSimilarity(skill1: { name: string; context: string }, skill2: EvolutionarySkill): number {
    let similarity = 0;
    
    // Similaridade de nome (peso maior)
    if (skill1.name === skill2.name) {
      similarity += 0.6;
    } else if (skill1.name.includes(skill2.name) || skill2.name.includes(skill1.name)) {
      similarity += 0.4;
    }
    
    // Similaridade de contexto
    if (skill1.context === skill2.context) {
      similarity += 0.4;
    } else if (this.extractDomain(skill1.context) === this.extractDomain(skill2.context)) {
      similarity += 0.2;
    }
    
    return similarity;
  }

  private extractDomain(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      const domain = hostname.replace('www.', '').split('.')[0];
      return domain || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private extractAction(element: any): string {
    const text = element.text?.toLowerCase() || '';
    
    if (text.includes('create') || text.includes('criar') || text.includes('new') || text.includes('novo')) return 'create';
    if (text.includes('edit') || text.includes('editar') || text.includes('modify')) return 'edit';
    if (text.includes('delete') || text.includes('excluir') || text.includes('remove')) return 'delete';
    if (text.includes('save') || text.includes('salvar') || text.includes('submit')) return 'save';
    if (text.includes('login') || text.includes('entrar') || text.includes('sign in')) return 'login';
    if (text.includes('search') || text.includes('buscar') || text.includes('find')) return 'search';
    if (element.type === 'button') return 'click';
    if (element.type === 'form') return 'submit';
    
    return 'interact';
  }

  private extractTarget(element: any): string {
    if (element.identifier && element.identifier.length > 0) {
      return element.identifier.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }
    
    if (element.text && element.text.length > 0) {
      return element.text.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
    }
    
    return element.type || 'element';
  }

  private generateStepsForElement(element: any): string[] {
    if (element.type === 'form') {
      return [
        'Localizar formulário',
        'Preencher campos obrigatórios',
        'Validar dados inseridos',
        'Submeter formulário',
        'Aguardar confirmação'
      ];
    }
    
    if (element.type === 'button') {
      return [
        'Localizar botão',
        'Verificar se está habilitado',
        'Clicar no botão',
        'Aguardar resposta do sistema'
      ];
    }
    
    if (element.type === 'modal') {
      return [
        'Aguardar modal aparecer',
        'Interagir com conteúdo do modal',
        'Confirmar ou cancelar ação'
      ];
    }
    
    return [
      'Localizar elemento na página',
      'Interagir com elemento',
      'Verificar resultado da ação'
    ];
  }

  private assessDifficulty(element: any): SkillDifficulty {
    let score = 0;
    
    if (element.requiresAuth) score += 2;
    if (element.hasValidation) score += 1;
    if (element.isComplex) score += 2;
    if (element.type === 'form') score += 1;
    if (element.text?.toLowerCase().includes('delete')) score += 2;
    
    if (score >= 5) return 'expert';
    if (score >= 3) return 'advanced';
    if (score >= 1) return 'intermediate';
    return 'basic';
  }
}

// Exportar instância singleton para uso global
export const evolutionaryLearningSystem = new EvolutionaryLearningSystem(); 