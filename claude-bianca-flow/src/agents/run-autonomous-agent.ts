#!/usr/bin/env ts-node

/**
 * Agente Autônomo Orquestrador
 * 
 * Agente completo que gerencia e coordena a execução de outros agentes
 * de forma autônoma, com capacidades de planejamento, monitoramento e recuperação
 */

import { runAutonomousImprovement } from './autonomous-improvement-agent-simple';
import { GuardianAgentAnalyzer } from './guardian-agent-analyzer';
import { MCPDirectAgent } from './mcp-direct-agent';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface AgentTask {
  id: string;
  type: 'improvement' | 'analysis' | 'coordination' | 'custom';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  assignedAgent?: string;
  dependencies?: string[];
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

interface AgentCapability {
  name: string;
  type: string;
  description: string;
  available: boolean;
  lastUsed?: Date;
  successRate: number;
}

export class RunAutonomousAgent {
  private id: string;
  private name: string;
  private status: 'idle' | 'planning' | 'executing' | 'monitoring' | 'error';
  private taskQueue: AgentTask[] = [];
  private completedTasks: AgentTask[] = [];
  private availableAgents: Map<string, AgentCapability> = new Map();
  private executionHistory: Array<{task: AgentTask, result: any, duration: number}> = [];
  private workingDir: string;
  private configPath: string;
  private logPath: string;

  constructor(workingDir: string = process.cwd()) {
    this.id = `autonomous-orchestrator-${Date.now()}`;
    this.name = 'Autonomous Orchestrator Agent';
    this.status = 'idle';
    this.workingDir = workingDir;
    this.configPath = join(workingDir, '.autonomous-agent-config.json');
    this.logPath = join(workingDir, '.autonomous-agent.log');
    
    this.initializeAgentCapabilities();
    this.loadConfiguration();
  }

  /**
   * Inicializa as capacidades dos agentes disponíveis
   */
  private initializeAgentCapabilities(): void {
    this.availableAgents.set('improvement', {
      name: 'Autonomous Improvement Agent',
      type: 'implementer',
      description: 'Executa melhorias autônomas no código',
      available: true,
      successRate: 0.85
    });

    this.availableAgents.set('guardian', {
      name: 'Guardian Agent Analyzer',
      type: 'analyst',
      description: 'Analisa e otimiza agentes existentes',
      available: true,
      successRate: 0.92
    });

    this.availableAgents.set('mcp-direct', {
      name: 'MCP Direct Agent',
      type: 'executor',
      description: 'Executa tarefas diretamente via MCP',
      available: true,
      successRate: 0.78
    });
  }

  /**
   * Carrega configuração salva
   */
  private loadConfiguration(): void {
    try {
      if (existsSync(this.configPath)) {
        const config = JSON.parse(readFileSync(this.configPath, 'utf8'));
        this.taskQueue = config.taskQueue || [];
        this.completedTasks = config.completedTasks || [];
        this.executionHistory = config.executionHistory || [];
        
        // Restaurar datas
        this.taskQueue.forEach(task => {
          task.createdAt = new Date(task.createdAt);
          task.updatedAt = new Date(task.updatedAt);
        });
        
        this.log('📋 Configuração carregada com sucesso');
      }
    } catch (error) {
      this.log(`⚠️ Erro ao carregar configuração: ${error}`);
    }
  }

  /**
   * Salva configuração atual
   */
  private saveConfiguration(): void {
    try {
      const config = {
        taskQueue: this.taskQueue,
        completedTasks: this.completedTasks.slice(-50), // Manter apenas últimas 50
        executionHistory: this.executionHistory.slice(-100), // Manter apenas últimas 100
        lastSaved: new Date().toISOString()
      };
      
      writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      this.log(`❌ Erro ao salvar configuração: ${error}`);
    }
  }

  /**
   * Sistema de logging
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${this.name}: ${message}\n`;
    
    console.log(`🤖 ${message}`);
    
    try {
      writeFileSync(this.logPath, logEntry, { flag: 'a' });
    } catch (error) {
      console.error('Erro no logging:', error);
    }
  }

  /**
   * Adiciona uma nova tarefa à fila
   */
  public addTask(
    type: AgentTask['type'],
    description: string,
    priority: AgentTask['priority'] = 'medium',
    metadata?: Record<string, any>
  ): string {
    const task: AgentTask = {
      id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      priority,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata
    };

    this.taskQueue.push(task);
    this.sortTasksByPriority();
    this.saveConfiguration();
    
    this.log(`➕ Nova tarefa adicionada: ${task.id} (${priority})`);
    return task.id;
  }

  /**
   * Ordena tarefas por prioridade
   */
  private sortTasksByPriority(): void {
    const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    
    this.taskQueue.sort((a, b) => {
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Seleciona o melhor agente para uma tarefa
   */
  private selectBestAgent(task: AgentTask): string | null {
    let bestAgent: string | null = null;
    let bestScore = 0;

    for (const [agentId, capability] of this.availableAgents) {
      if (!capability.available) continue;

      let score = capability.successRate;

      // Bonus por tipo de tarefa
      if (task.type === 'improvement' && agentId === 'improvement') score += 0.2;
      if (task.type === 'analysis' && agentId === 'guardian') score += 0.2;
      if (task.type === 'coordination' && agentId === 'mcp-direct') score += 0.1;

      // Penalty por uso recente
      if (capability.lastUsed) {
        const hoursSinceLastUse = (Date.now() - capability.lastUsed.getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastUse < 1) score -= 0.1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestAgent = agentId;
      }
    }

    return bestAgent;
  }

  /**
   * Executa uma tarefa específica
   */
  private async executeTask(task: AgentTask): Promise<any> {
    const startTime = Date.now();
    
    try {
      task.status = 'running';
      task.updatedAt = new Date();
      
      this.log(`🚀 Executando tarefa: ${task.id} - ${task.description.substring(0, 50)}...`);

      let result: any;

      switch (task.assignedAgent) {
        case 'improvement':
          result = await this.executeImprovementTask(task);
          break;
          
        case 'guardian':
          result = await this.executeAnalysisTask(task);
          break;
          
        case 'mcp-direct':
          result = await this.executeMCPTask(task);
          break;
          
        default:
          throw new Error(`Agente não reconhecido: ${task.assignedAgent}`);
      }

      task.status = 'completed';
      task.result = result;
      task.updatedAt = new Date();

      const duration = Date.now() - startTime;
      this.executionHistory.push({ task: {...task}, result, duration });

      // Atualizar taxa de sucesso do agente
      if (task.assignedAgent) {
        const agent = this.availableAgents.get(task.assignedAgent);
        if (agent) {
          agent.lastUsed = new Date();
          agent.successRate = Math.min(0.99, agent.successRate + 0.01);
        }
      }

      this.log(`✅ Tarefa concluída: ${task.id} (${duration}ms)`);
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : String(error);
      task.updatedAt = new Date();

      // Reduzir taxa de sucesso do agente
      if (task.assignedAgent) {
        const agent = this.availableAgents.get(task.assignedAgent);
        if (agent) {
          agent.successRate = Math.max(0.1, agent.successRate - 0.05);
        }
      }

      this.log(`❌ Tarefa falhou: ${task.id} - ${task.error} (${duration}ms)`);
      throw error;
    }
  }

  /**
   * Executa tarefa de melhoria
   */
  private async executeImprovementTask(task: AgentTask): Promise<any> {
    return await runAutonomousImprovement(
      task.description,
      task.metadata?.workingDir || this.workingDir
    );
  }

  /**
   * Executa tarefa de análise
   */
  private async executeAnalysisTask(task: AgentTask): Promise<any> {
    const analyzer = new GuardianAgentAnalyzer();
    
    if (task.description.includes('overlap') || task.description.includes('sobreposição')) {
      return await analyzer.analyzeAgentOverlaps();
    } else if (task.description.includes('optimization') || task.description.includes('otimização')) {
      return await analyzer.suggestOptimizations();
    } else {
      return await analyzer.generateOptimizationReport();
    }
  }

  /**
   * Executa tarefa via MCP
   */
  private async executeMCPTask(task: AgentTask): Promise<any> {
    // Simulação - em implementação real, usaria MCPDirectAgent
    this.log(`🔧 Executando via MCP: ${task.description}`);
    
    return {
      method: 'mcp_execution',
      task: task.description,
      status: 'completed',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Processa a fila de tarefas
   */
  public async processTaskQueue(): Promise<void> {
    if (this.status !== 'idle') {
      this.log('⚠️ Agente já está processando tarefas');
      return;
    }

    this.status = 'executing';
    this.log(`🎯 Iniciando processamento de ${this.taskQueue.length} tarefas`);

    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift()!;
      
      // Verificar dependências
      if (task.dependencies && task.dependencies.length > 0) {
        const pendingDeps = task.dependencies.filter(depId => 
          !this.completedTasks.some(ct => ct.id === depId && ct.status === 'completed')
        );
        
        if (pendingDeps.length > 0) {
          this.log(`⏸️ Tarefa ${task.id} pausada - dependências pendentes: ${pendingDeps.join(', ')}`);
          task.status = 'paused';
          this.taskQueue.push(task); // Recolocar no final da fila
          continue;
        }
      }

      // Selecionar agente
      const selectedAgent = this.selectBestAgent(task);
      if (!selectedAgent) {
        this.log(`❌ Nenhum agente disponível para tarefa: ${task.id}`);
        task.status = 'failed';
        task.error = 'Nenhum agente disponível';
        this.completedTasks.push(task);
        continue;
      }

      task.assignedAgent = selectedAgent;
      
      try {
        await this.executeTask(task);
        this.completedTasks.push(task);
      } catch (error) {
        this.completedTasks.push(task);
        this.log(`⚠️ Continuando processamento após falha em: ${task.id}`);
      }

      this.saveConfiguration();
      
      // Pequena pausa entre tarefas
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    this.status = 'idle';
    this.log('🏁 Processamento da fila concluído');
  }

  /**
   * Obtém estatísticas do agente
   */
  public getStatistics(): any {
    const totalTasks = this.completedTasks.length;
    const successfulTasks = this.completedTasks.filter(t => t.status === 'completed').length;
    const failedTasks = this.completedTasks.filter(t => t.status === 'failed').length;
    
    const avgDuration = this.executionHistory.length > 0 
      ? this.executionHistory.reduce((sum, h) => sum + h.duration, 0) / this.executionHistory.length
      : 0;

    return {
      id: this.id,
      name: this.name,
      status: this.status,
      currentQueueSize: this.taskQueue.length,
      totalTasksCompleted: totalTasks,
      successRate: totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0,
      failureRate: totalTasks > 0 ? (failedTasks / totalTasks) * 100 : 0,
      averageExecutionTime: Math.round(avgDuration),
      availableAgents: Array.from(this.availableAgents.entries()).map(([id, cap]) => ({
        id,
        name: cap.name,
        type: cap.type,
        available: cap.available,
        successRate: (cap.successRate * 100).toFixed(1) + '%'
      })),
      lastExecution: this.executionHistory.length > 0 
        ? this.executionHistory[this.executionHistory.length - 1].task.updatedAt
        : null
    };
  }

  /**
   * Interface principal para execução
   */
  public async run(taskDescription?: string): Promise<void> {
    this.log('🚀 Agente Autônomo Orquestrador iniciado');

    // Se uma descrição de tarefa foi fornecida, adicionar à fila
    if (taskDescription) {
      this.addTask('improvement', taskDescription, 'high');
    } else {
      // Adicionar tarefas padrão se a fila estiver vazia
      if (this.taskQueue.length === 0) {
        this.addDefaultTasks();
      }
    }

    // Processar fila
    await this.processTaskQueue();

    // Exibir estatísticas finais
    const stats = this.getStatistics();
    console.log('\n📊 ESTATÍSTICAS FINAIS:');
    console.log('='.repeat(50));
    console.log(`Tarefas processadas: ${stats.totalTasksCompleted}`);
    console.log(`Taxa de sucesso: ${stats.successRate.toFixed(1)}%`);
    console.log(`Tempo médio: ${stats.averageExecutionTime}ms`);
    console.log(`Status: ${stats.status}`);
  }

  /**
   * Adiciona tarefas padrão
   */
  private addDefaultTasks(): void {
    this.addTask(
      'improvement',
      'Verificar e otimizar estrutura do projeto Claude Flow',
      'medium'
    );

    this.addTask(
      'analysis',
      'Analisar sobreposições entre agentes existentes',
      'low'
    );

    this.addTask(
      'coordination',
      'Verificar status das ferramentas MCP',
      'high'
    );
  }
}

// Função principal para compatibilidade
async function main() {
  console.log('🤖 Claude Flow - Agente Autônomo Orquestrador\n');
  
  const orchestrator = new RunAutonomousAgent();
  
  // Tarefa específica de melhoria do GitHub (mantendo compatibilidade)
  const improvementTask = `
Adicione as seguintes ferramentas GitHub ao arquivo mcp-bianca-tools/src/tools/github/index.ts:

1. search_repositories - Buscar repositórios
2. get_file_contents - Obter conteúdo de arquivos
3. fork_repository - Fazer fork de repositórios  
4. create_branch - Criar branches
5. merge_pull_request - Fazer merge de pull requests

Requisitos:
- Mantenha o padrão TypeScript existente com schemas Zod
- Adicione os tipos necessários
- Implemente handlers com tratamento de erro apropriado
- Atualize as exportações
- Siga o mesmo padrão das ferramentas existentes

IMPORTANTE: Execute as mudanças de forma incremental e teste cada adição.
`;

  try {
    await orchestrator.run(improvementTask);
    console.log('\n🎉 Processo concluído com sucesso!');
  } catch (error) {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  }
}

// Classe já exportada na declaração acima

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}