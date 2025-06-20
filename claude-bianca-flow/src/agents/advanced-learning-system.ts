/**
 * Sistema de Aprendizado Avançado
 * 
 * Sistema que tornaria o agente 100% autônomo no aprendizado
 * com sucessos/falhas através de ML adaptativo
 */

interface LearningPattern {
  taskType: string;
  contextFeatures: string[];
  successFactors: Record<string, number>;
  failureFactors: Record<string, number>;
  confidence: number;
  sampleSize: number;
}

interface AdaptiveLearningSystem {
  // 1. 🧠 Aprendizado Contextual Avançado
  analyzeTaskContext(task: any): {
    complexity: number;
    riskLevel: number;
    similarityToSuccess: number;
    resourceRequirements: number;
  };

  // 2. 📊 Ajuste Dinâmico de Taxa de Sucesso
  calculateSuccessRateAdjustment(
    currentRate: number,
    taskResult: any,
    context: any
  ): number;

  // 3. 🔄 Detecção de Padrões Emergentes
  detectNewPatterns(
    executionHistory: any[]
  ): LearningPattern[];

  // 4. 🎯 Seleção Inteligente de Agentes
  selectOptimalAgent(
    task: any,
    availableAgents: any[],
    learningHistory: any[]
  ): {
    agentId: string;
    confidence: number;
    reasoning: string;
  };

  // 5. 📈 Predição de Sucesso
  predictTaskSuccess(
    task: any,
    selectedAgent: any
  ): {
    probability: number;
    riskFactors: string[];
    recommendations: string[];
  };

  // 6. 🔄 Auto-Otimização
  optimizeOwnParameters(): void;
}

export class AdvancedAutonomousLearning implements AdaptiveLearningSystem {
  private learningPatterns: Map<string, LearningPattern> = new Map();
  private executionHistory: any[] = [];
  private contextAnalyzer: any;
  private patternDetector: any;

  constructor() {
    this.initializeAdvancedLearning();
  }

  private initializeAdvancedLearning(): void {
    // Sistema de análise contextual baseado em features
    this.contextAnalyzer = {
      // Analisa complexidade por tokens, dependências, etc
      analyzeComplexity: (description: string) => {
        const tokens = description.split(' ').length;
        const dependencies = (description.match(/\bdepend\b|\brequire\b|\bneed\b/gi) || []).length;
        const technicalTerms = (description.match(/\b(API|SDK|database|server|client)\b/gi) || []).length;
        
        return Math.min(1, (tokens * 0.01) + (dependencies * 0.2) + (technicalTerms * 0.1));
      },

      // Analisa risco por palavras-chave
      analyzeRisk: (description: string) => {
        const riskKeywords = ['delete', 'remove', 'critical', 'production', 'database', 'security'];
        const riskScore = riskKeywords.reduce((score, keyword) => 
          score + (description.toLowerCase().includes(keyword) ? 0.2 : 0), 0
        );
        return Math.min(1, riskScore);
      }
    };

    // Detector de padrões usando correlação
    this.patternDetector = {
      findCorrelations: (history: any[]) => {
        const patterns: LearningPattern[] = [];
        
        // Agrupar por tipo de tarefa
        const taskGroups = this.groupBy(history, 'type');
        
        for (const [taskType, tasks] of Object.entries(taskGroups)) {
          const successes = (tasks as any[]).filter(t => t.status === 'completed');
          const failures = (tasks as any[]).filter(t => t.status === 'failed');
          
          if (successes.length > 2 && failures.length > 1) {
            patterns.push({
              taskType,
              contextFeatures: this.extractFeatures(successes),
              successFactors: this.calculateFactors(successes),
              failureFactors: this.calculateFactors(failures),
              confidence: Math.min(0.9, (successes.length + failures.length) / 20),
              sampleSize: successes.length + failures.length
            });
          }
        }
        
        return patterns;
      }
    };
  }

  analyzeTaskContext(task: any) {
    return {
      complexity: this.contextAnalyzer.analyzeComplexity(task.description),
      riskLevel: this.contextAnalyzer.analyzeRisk(task.description),
      similarityToSuccess: this.calculateSimilarityToSuccessfulTasks(task),
      resourceRequirements: this.estimateResourceRequirements(task)
    };
  }

  calculateSuccessRateAdjustment(currentRate: number, taskResult: any, context: any): number {
    const baseAdjustment = taskResult.status === 'completed' ? 0.05 : -0.08;
    
    // Ajustar baseado na complexidade
    const complexityMultiplier = context.complexity > 0.7 ? 1.5 : 1.0;
    
    // Ajustar baseado na confiança
    const confidenceMultiplier = context.confidence || 1.0;
    
    // Ajustar baseado no tempo de execução vs esperado
    const timeMultiplier = taskResult.duration > (taskResult.expectedDuration || 5000) ? 0.8 : 1.2;
    
    const finalAdjustment = baseAdjustment * complexityMultiplier * confidenceMultiplier * timeMultiplier;
    
    // Limites dinâmicos baseados no histórico
    const newRate = currentRate + finalAdjustment;
    const dynamicMin = Math.max(0.05, currentRate - 0.3);
    const dynamicMax = Math.min(0.98, currentRate + 0.3);
    
    return Math.max(dynamicMin, Math.min(dynamicMax, newRate));
  }

  detectNewPatterns(executionHistory: any[]): LearningPattern[] {
    this.executionHistory = executionHistory;
    return this.patternDetector.findCorrelations(executionHistory);
  }

  selectOptimalAgent(task: any, availableAgents: any[], learningHistory: any[]) {
    const context = this.analyzeTaskContext(task);
    const patterns = this.detectNewPatterns(learningHistory);
    
    let bestAgent = null;
    let bestScore = 0;
    let reasoning = '';
    
    for (const agent of availableAgents) {
      let score = agent.successRate;
      
      // Aplicar padrões aprendidos
      const relevantPattern = patterns.find(p => 
        p.taskType === task.type && p.confidence > 0.6
      );
      
      if (relevantPattern) {
        const patternBonus = relevantPattern.successFactors[agent.id] || 0;
        score += patternBonus * relevantPattern.confidence;
        reasoning += `Padrão detectado: +${(patternBonus * 100).toFixed(1)}% `;
      }
      
      // Ajustar por contexto
      if (context.complexity > 0.8 && agent.type === 'implementer') {
        score += 0.15;
        reasoning += 'Tarefa complexa+implementer ';
      }
      
      if (context.riskLevel > 0.6 && agent.type === 'analyst') {
        score += 0.10;
        reasoning += 'Alto risco+analyst ';
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestAgent = agent;
      }
    }
    
    return {
      agentId: bestAgent?.id || 'default',
      confidence: bestScore,
      reasoning: reasoning.trim() || 'Seleção baseada em taxa de sucesso'
    };
  }

  predictTaskSuccess(task: any, selectedAgent: any) {
    const context = this.analyzeTaskContext(task);
    const baseSuccess = selectedAgent.successRate;
    
    // Ajustar predição baseada no contexto
    let adjustedProbability = baseSuccess;
    const riskFactors: string[] = [];
    const recommendations: string[] = [];
    
    if (context.complexity > 0.8) {
      adjustedProbability *= 0.85;
      riskFactors.push('Alta complexidade');
      recommendations.push('Considere dividir em subtarefas');
    }
    
    if (context.riskLevel > 0.7) {
      adjustedProbability *= 0.9;
      riskFactors.push('Alto risco');
      recommendations.push('Adicione validações extras');
    }
    
    if (context.similarityToSuccess > 0.8) {
      adjustedProbability *= 1.1;
      recommendations.push('Tarefa similar a sucessos anteriores');
    }
    
    return {
      probability: Math.min(0.95, adjustedProbability),
      riskFactors,
      recommendations
    };
  }

  optimizeOwnParameters(): void {
    // Auto-ajustar parâmetros baseado no desempenho
    const recentHistory = this.executionHistory.slice(-50);
    const successRate = recentHistory.filter(h => h.status === 'completed').length / recentHistory.length;
    
    if (successRate < 0.7) {
      // Ser mais conservador
      console.log('🔄 Otimização: Aumentando conservadorismo');
    } else if (successRate > 0.9) {
      // Ser mais agressivo
      console.log('🔄 Otimização: Reduzindo conservadorismo');
    }
  }

  // Utilitários
  private groupBy(array: any[], key: string): Record<string, any[]> {
    return array.reduce((groups, item) => {
      const value = item[key];
      groups[value] = groups[value] || [];
      groups[value].push(item);
      return groups;
    }, {});
  }

  private extractFeatures(tasks: any[]): string[] {
    const features = new Set<string>();
    tasks.forEach(task => {
      const words = task.description.toLowerCase().split(/\W+/);
      words.forEach((word: string) => {
        if (word.length > 3) features.add(word);
      });
    });
    return Array.from(features).slice(0, 10);
  }

  private calculateFactors(tasks: any[]): Record<string, number> {
    const factors: Record<string, number> = {};
    
    tasks.forEach(task => {
      const agent = task.assignedAgent;
      if (agent) {
        factors[agent] = (factors[agent] || 0) + 1;
      }
    });
    
    // Normalizar
    const total = Object.values(factors).reduce((sum, count) => sum + count, 0);
    Object.keys(factors).forEach(key => {
      factors[key] = factors[key] / total;
    });
    
    return factors;
  }

  private calculateSimilarityToSuccessfulTasks(task: any): number {
    const successfulTasks = this.executionHistory.filter(h => h.status === 'completed');
    if (successfulTasks.length === 0) return 0.5;
    
    const taskWords = new Set(task.description.toLowerCase().split(/\W+/));
    let maxSimilarity = 0;
    
    successfulTasks.forEach(successTask => {
      const successWords = new Set(successTask.description.toLowerCase().split(/\W+/));
      const intersection = new Set([...taskWords].filter(x => successWords.has(x)));
      const union = new Set([...taskWords, ...successWords]);
      const similarity = intersection.size / union.size;
      maxSimilarity = Math.max(maxSimilarity, similarity);
    });
    
    return maxSimilarity;
  }

  private estimateResourceRequirements(task: any): number {
    const description = task.description.toLowerCase();
    let requirements = 0.3; // Base
    
    if (description.includes('database')) requirements += 0.2;
    if (description.includes('api')) requirements += 0.1;
    if (description.includes('complex')) requirements += 0.2;
    if (description.includes('multiple')) requirements += 0.1;
    
    return Math.min(1, requirements);
  }
}

// Exemplo de como integrar no sistema existente
export function upgradeToAdvancedLearning(currentAgent: any): any {
  const advancedLearning = new AdvancedAutonomousLearning();
  
  // Substituir método de seleção de agentes
  currentAgent.selectBestAgent = (task: any) => {
    const result = advancedLearning.selectOptimalAgent(
      task, 
      Array.from(currentAgent.availableAgents.values()),
      currentAgent.executionHistory
    );
    console.log(`🧠 Seleção inteligente: ${result.agentId} (${result.reasoning})`);
    return result.agentId;
  };
  
  // Substituir método de ajuste de taxa de sucesso
  const originalExecuteTask = currentAgent.executeTask;
  currentAgent.executeTask = async (task: any) => {
    const context = advancedLearning.analyzeTaskContext(task);
    const prediction = advancedLearning.predictTaskSuccess(task, { successRate: 0.8 });
    
    console.log(`📊 Previsão de sucesso: ${(prediction.probability * 100).toFixed(1)}%`);
    
    const result = await originalExecuteTask.call(currentAgent, task);
    
    // Ajuste inteligente da taxa de sucesso
    if (task.assignedAgent) {
      const agent = currentAgent.availableAgents.get(task.assignedAgent);
      if (agent) {
        const newRate = advancedLearning.calculateSuccessRateAdjustment(
          agent.successRate, 
          result, 
          context
        );
        agent.successRate = newRate;
        console.log(`🎯 Taxa ajustada: ${(newRate * 100).toFixed(1)}%`);
      }
    }
    
    return result;
  };
  
  return currentAgent;
} 