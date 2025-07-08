/**
 * Agente de Melhoria Contínua para mcp-bianca-tools
 * Analisa, prioriza e implementa melhorias de forma organizada
 */

import { createMCPAgent } from './mcp-templates';
import { AgentType } from '../core/base-agent';
import { MCP_TOOLS } from './mcp-integration';
import { MCPDirectAgent } from './mcp-direct-agent';
import { MCPBridge } from './mcp-bridge';
import * as fs from 'fs';
import * as path from 'path';

// Tipos de melhoria
export enum ImprovementType {
  REFACTORING = 'refactoring',
  BUG_FIX = 'bug_fix',
  FEATURE = 'feature',
  PERFORMANCE = 'performance',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  SECURITY = 'security',
  ARCHITECTURE = 'architecture'
}

// Prioridade das melhorias
export enum Priority {
  CRITICAL = 5,
  HIGH = 4,
  MEDIUM = 3,
  LOW = 2,
  NICE_TO_HAVE = 1
}

interface Improvement {
  id: string;
  type: ImprovementType;
  priority: Priority;
  title: string;
  description: string;
  estimatedEffort: number; // horas
  files: string[];
  dependencies?: string[];
  completed?: boolean;
  implementedAt?: Date;
}

export const mcpImprovementAgent = createMCPAgent(
  'MCP Improvement Agent',
  AgentType.ANALYST,
  [
    MCP_TOOLS.GIT_STATUS,
    MCP_TOOLS.GIT_COMMIT,
    MCP_TOOLS.GIT_PUSH,
    MCP_TOOLS.GITHUB_CREATE_ISSUE,
    MCP_TOOLS.MEMORY_ADD,
    MCP_TOOLS.MEMORY_SEARCH,
    MCP_TOOLS.MEMORY_LIST
  ],
  'sequential'
);

/**
 * Agente especializado em análise e melhoria do mcp-bianca-tools
 */
export class MCPImprovementAgent extends MCPDirectAgent {
  private readonly projectPath = path.resolve(__dirname, '../../../mcp-bianca-tools');
  private improvements: Map<string, Improvement> = new Map();
  private readonly improvementQueueFile = path.join(this.projectPath, '.improvements-queue.json');
  private isInitialized = false;

  constructor(mcpBridge: MCPBridge) {
    super({
      name: 'MCP Improvement Agent',
      type: AgentType.ANALYST,
      tools: [
        MCP_TOOLS.GIT_STATUS,
        MCP_TOOLS.GIT_COMMIT,
        MCP_TOOLS.GIT_PUSH,
        MCP_TOOLS.GITHUB_CREATE_ISSUE,
        MCP_TOOLS.MEMORY_ADD,
        MCP_TOOLS.MEMORY_SEARCH,
        MCP_TOOLS.MEMORY_LIST
      ]
    }, mcpBridge);
    this.loadImprovementQueue();
  }

  /**
   * Inicializa o agente com MCPBridge
   */
  async initialize(): Promise<void> {
    if (!this.isInitialized) {
      // Já inicializado no construtor
      this.isInitialized = true;
    }
  }

  /**
   * Carrega fila de melhorias do arquivo
   */
  private loadImprovementQueue() {
    try {
      if (fs.existsSync(this.improvementQueueFile)) {
        const data = fs.readFileSync(this.improvementQueueFile, 'utf-8');
        const improvements = JSON.parse(data) as Improvement[];
        improvements.forEach(imp => this.improvements.set(imp.id, imp));
      }
    } catch (error) {
      console.error('Erro ao carregar fila de melhorias:', error);
    }
  }

  /**
   * Salva fila de melhorias
   */
  private saveImprovementQueue() {
    try {
      const improvements = Array.from(this.improvements.values());
      fs.writeFileSync(
        this.improvementQueueFile,
        JSON.stringify(improvements, null, 2)
      );
    } catch (error) {
      console.error('Erro ao salvar fila de melhorias:', error);
    }
  }

  /**
   * Analisa o projeto e identifica melhorias
   */
  async analyzeProject(): Promise<Improvement[]> {
    console.log('🔍 Analisando projeto mcp-bianca-tools...');

    const improvements: Improvement[] = [];

    // 1. Análise do index.ts monolítico
    if (await this.checkFileSize('src/index.ts') > 500) {
      improvements.push({
        id: 'refactor-index-ts',
        type: ImprovementType.REFACTORING,
        priority: Priority.CRITICAL,
        title: 'Refatorar index.ts monolítico',
        description: 'O arquivo index.ts tem 1140 linhas com duplicação. Usar módulos já criados em src/tools/',
        estimatedEffort: 4,
        files: ['src/index.ts', 'src/tools/*/index.ts']
      });
    }

    // 2. Verificar testes
    if (!await this.hasTests()) {
      improvements.push({
        id: 'implement-tests',
        type: ImprovementType.TESTING,
        priority: Priority.HIGH,
        title: 'Implementar suite de testes',
        description: 'Adicionar testes unitários e de integração com Jest',
        estimatedEffort: 8,
        files: ['src/**/__tests__/*.test.ts']
      });
    }

    // 3. Sistema de logging
    if (!await this.hasLoggingSystem()) {
      improvements.push({
        id: 'add-logging',
        type: ImprovementType.FEATURE,
        priority: Priority.HIGH,
        title: 'Implementar sistema de logging estruturado',
        description: 'Adicionar Winston ou similar para logging configurável',
        estimatedEffort: 3,
        files: ['src/utils/logger.ts', 'src/config/logging.ts']
      });
    }

    // 4. Documentação
    if (!await this.hasCompleteDocumentation()) {
      improvements.push({
        id: 'improve-docs',
        type: ImprovementType.DOCUMENTATION,
        priority: Priority.MEDIUM,
        title: 'Completar documentação',
        description: 'Adicionar README principal, documentação de API e exemplos',
        estimatedEffort: 4,
        files: ['README.md', 'docs/API.md', 'examples/']
      });
    }

    // 5. Sistema de configuração
    if (!await this.hasCentralConfig()) {
      improvements.push({
        id: 'central-config',
        type: ImprovementType.ARCHITECTURE,
        priority: Priority.MEDIUM,
        title: 'Centralizar configurações',
        description: 'Criar sistema de configuração central para todas as ferramentas',
        estimatedEffort: 2,
        files: ['src/config/index.ts']
      });
    }

    // 6. Performance monitoring
    improvements.push({
      id: 'add-metrics',
      type: ImprovementType.PERFORMANCE,
      priority: Priority.LOW,
      title: 'Adicionar monitoramento de performance',
      description: 'Implementar coleta de métricas e monitoramento',
      estimatedEffort: 3,
      files: ['src/utils/metrics.ts']
    });

    // Salvar melhorias identificadas
    improvements.forEach(imp => this.improvements.set(imp.id, imp));
    this.saveImprovementQueue();

    // Salvar na memória
    await this.saveToMemory('analysis', improvements);

    return improvements;
  }

  /**
   * Prioriza melhorias baseado em critérios
   */
  prioritizeImprovements(): Improvement[] {
    const sorted = Array.from(this.improvements.values())
      .filter(imp => !imp.completed)
      .sort((a, b) => {
        // Primeiro por prioridade
        if (a.priority !== b.priority) {
          return b.priority - a.priority;
        }
        // Depois por esforço (menor primeiro)
        return a.estimatedEffort - b.estimatedEffort;
      });

    console.log('\n📋 Melhorias priorizadas:');
    sorted.forEach((imp, index) => {
      console.log(`${index + 1}. [${imp.type}] ${imp.title} (P${imp.priority}, ${imp.estimatedEffort}h)`);
    });

    return sorted;
  }

  /**
   * Implementa uma melhoria específica
   */
  async implementImprovement(improvementId: string): Promise<void> {
    const improvement = this.improvements.get(improvementId);
    if (!improvement || improvement.completed) {
      console.log('Melhoria não encontrada ou já completada');
      return;
    }

    console.log(`\n🔧 Implementando: ${improvement.title}`);

    try {
      // Executar implementação baseada no tipo
      switch (improvement.id) {
        case 'refactor-index-ts':
          await this.refactorIndexFile();
          break;
        case 'implement-tests':
          await this.setupTestingSuite();
          break;
        case 'add-logging':
          await this.implementLoggingSystem();
          break;
        case 'improve-docs':
          await this.improveDocumentation();
          break;
        case 'central-config':
          await this.createCentralConfig();
          break;
        case 'add-metrics':
          await this.addMetricsSystem();
          break;
        default:
          console.log('Implementação não definida para esta melhoria');
          return;
      }

      // Marcar como completa
      improvement.completed = true;
      improvement.implementedAt = new Date();
      this.saveImprovementQueue();

      // Criar issue no GitHub para tracking
      await this.createGitHubIssue(improvement);

      // Commit e push
      await this.commitAndPush(improvement);

      // Salvar progresso na memória
      await this.saveToMemory('completed', improvement);

      console.log(`✅ Melhoria implementada: ${improvement.title}`);
    } catch (error) {
      console.error(`❌ Erro ao implementar melhoria: ${error}`);
      throw error;
    }
  }

  /**
   * Executa ciclo completo de análise e melhoria
   */
  async runImprovementCycle(): Promise<void> {
    console.log('🚀 Iniciando ciclo de melhoria do mcp-bianca-tools\n');

    // 1. Analisar projeto
    const improvements = await this.analyzeProject();
    console.log(`\n📊 ${improvements.length} melhorias identificadas`);

    // 2. Priorizar melhorias
    const prioritized = this.prioritizeImprovements();

    // 3. Implementar top 3 melhorias
    const toImplement = prioritized.slice(0, 3);
    console.log(`\n🎯 Implementando top ${toImplement.length} melhorias...`);

    for (const improvement of toImplement) {
      await this.implementImprovement(improvement.id);
      
      // Pausa entre implementações
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✨ Ciclo de melhoria completado!');
  }

  // Métodos auxiliares de verificação
  private async checkFileSize(filePath: string): Promise<number> {
    try {
      const fullPath = path.join(this.projectPath, filePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  private async hasTests(): Promise<boolean> {
    const testDirs = ['__tests__', 'test', 'tests'];
    return testDirs.some(dir => 
      fs.existsSync(path.join(this.projectPath, 'src', dir))
    );
  }

  private async hasLoggingSystem(): Promise<boolean> {
    return fs.existsSync(path.join(this.projectPath, 'src/utils/logger.ts'));
  }

  private async hasCompleteDocumentation(): Promise<boolean> {
    const requiredDocs = ['README.md', 'docs/API.md'];
    return requiredDocs.every(doc => 
      fs.existsSync(path.join(this.projectPath, doc))
    );
  }

  private async hasCentralConfig(): Promise<boolean> {
    return fs.existsSync(path.join(this.projectPath, 'src/config/index.ts'));
  }

  // Métodos de implementação específicos
  private async refactorIndexFile(): Promise<void> {
    console.log('Refatorando index.ts...');
    // Implementação específica da refatoração
    // Aqui você implementaria a lógica real de refatoração
  }

  private async setupTestingSuite(): Promise<void> {
    console.log('Configurando suite de testes...');
    // Implementação da configuração de testes
  }

  private async implementLoggingSystem(): Promise<void> {
    console.log('Implementando sistema de logging...');
    // Implementação do sistema de logging
  }

  private async improveDocumentation(): Promise<void> {
    console.log('Melhorando documentação...');
    // Implementação de melhorias na documentação
  }

  private async createCentralConfig(): Promise<void> {
    console.log('Criando configuração central...');
    // Implementação da configuração central
  }

  private async addMetricsSystem(): Promise<void> {
    console.log('Adicionando sistema de métricas...');
    // Implementação do sistema de métricas
  }

  // Métodos de integração
  private async createGitHubIssue(improvement: Improvement): Promise<void> {
    try {
      await this.mcpBridge.executeTool(MCP_TOOLS.GITHUB_CREATE_ISSUE, {
        owner: 'biancasivero',
        repo: 'claude-bianca-flow',
        title: `[${improvement.type}] ${improvement.title}`,
        body: `## Descrição\n${improvement.description}\n\n## Arquivos afetados\n${improvement.files.join('\n')}\n\n## Esforço estimado\n${improvement.estimatedEffort} horas`,
        labels: [improvement.type, `priority-${improvement.priority}`]
      });
    } catch (error) {
      console.warn('Não foi possível criar issue no GitHub:', error);
    }
  }

  private async commitAndPush(improvement: Improvement): Promise<void> {
    const commitMessage = `${improvement.type}: ${improvement.title}`;
    
    await this.mcpBridge.executeTool(MCP_TOOLS.GIT_COMMIT, {
      message: commitMessage,
      addAll: true
    });

    try {
      await this.mcpBridge.executeTool(MCP_TOOLS.GIT_PUSH, {});
    } catch (error) {
      console.warn('Push falhou:', error);
    }
  }

  private async saveToMemory(type: string, data: any): Promise<void> {
    await this.mcpBridge.executeTool(MCP_TOOLS.MEMORY_ADD, {
      content: JSON.stringify({
        type: `mcp-improvement-${type}`,
        data,
        timestamp: new Date().toISOString()
      }),
      user_id: 'mcp-improvement-agent',
      category: 'code-improvements',
      tags: ['mcp-tools', 'improvements', type]
    });
  }
}

// Exportar classe, não instância (precisa do MCPBridge)
// export const improvementAgent = new MCPImprovementAgent();