/**
 * Agents Tools Module
 * 
 * Ferramentas para gerenciamento e análise de agentes do Claude Flow
 */

import { z } from 'zod';
import { promises as fs } from 'fs';
import * as path from 'path';
import { MCPError, ErrorCode } from '../../types.js';

// Path padrão para os agentes
const DEFAULT_AGENTS_PATH = '/Users/phiz/Desktop/claude-flow-bianca/claude-bianca-flow/src/agents';

// Schemas de validação
export const ListAgentsSchema = z.object({
  path: z.string().default(DEFAULT_AGENTS_PATH),
  filter: z.object({
    type: z.enum(['researcher', 'implementer', 'analyst', 'coordinator', 'custom']).optional(),
    name: z.string().optional(),
    hasTools: z.array(z.string()).optional()
  }).optional()
});

export const GetAgentDetailsSchema = z.object({
  agentFile: z.string().min(1, 'Nome do arquivo é obrigatório'),
  agentName: z.string().optional()
});

export const AnalyzeAgentSchema = z.object({
  agentFile: z.string().min(1, 'Nome do arquivo é obrigatório'),
  analysisType: z.enum(['dependencies', 'tools', 'structure', 'usage'])
});

export const SearchAgentsSchema = z.object({
  query: z.string().min(1, 'Query de busca é obrigatória'),
  path: z.string().default(DEFAULT_AGENTS_PATH)
});

export const ManageSkillsSchema = z.object({
  action: z.enum(['discover', 'register', 'list', 'execute', 'evolve', 'analyze_context']),
  skillData: z.object({
    name: z.string(),
    description: z.string(),
    context: z.string(),
    selectors: z.array(z.string()).optional(),
    steps: z.array(z.string()).optional(),
    triggers: z.array(z.string()).optional(),
    difficulty: z.enum(['basic', 'intermediate', 'advanced', 'expert'])
  }).optional(),
  naturalLanguageQuery: z.string().optional(),
  contextData: z.any().optional()
});

// Tipos
export interface Agent {
  name: string;
  file: string;
  type: string;
  tools: string[];
  description?: string;
  template?: string;
}

// Parser simplificado - apenas lista arquivos de agentes
async function parseAgentsFile(filePath: string): Promise<Agent[]> {
  const fileName = path.basename(filePath);
  
  // Extrair nome do arquivo sem extensão e formatado
  const baseName = fileName.replace(/\.ts$/, '');
  const displayName = baseName
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Nome simplificado para uso
  const name = baseName.replace(/-/g, '_');
  
  // Determinar tipo baseado no nome
  let type = 'custom';
  if (baseName.includes('analyzer') || baseName.includes('analyst')) type = 'analyst';
  else if (baseName.includes('organizer') || baseName.includes('consolidator') || baseName.includes('guardian')) type = 'coordinator';
  else if (baseName.includes('improvement') || baseName.includes('commit')) type = 'implementer';
  else if (baseName.includes('timer') || baseName.includes('log')) type = 'analyst';
  
  return [{
    name,
    file: fileName,
    type,
    tools: [], // Simplificado - não analisa ferramentas
    description: displayName,
    template: 'file'
  }];
}

// Handler para listar agentes
export async function handleListAgents(params: unknown) {
  const validated = ListAgentsSchema.parse(params);
  
  try {
    const agentsPath = validated.path;
    const files = await fs.readdir(agentsPath);
    const agentFiles = files.filter(f => f.endsWith('.ts') && (f.includes('agent') || f.includes('guardian')));
    
    let allAgents: Agent[] = [];
    
    for (const file of agentFiles) {
      const filePath = path.join(agentsPath, file);
      const agents = await parseAgentsFile(filePath);
      allAgents = allAgents.concat(agents);
    }
    
    // Aplicar filtros
    if (validated.filter) {
      const { type, name, hasTools } = validated.filter;
      
      if (type) {
        allAgents = allAgents.filter(a => a.type === type);
      }
      
      if (name) {
        allAgents = allAgents.filter(a => 
          a.name.toLowerCase().includes(name.toLowerCase())
        );
      }
      
      if (hasTools && hasTools.length > 0) {
        allAgents = allAgents.filter(a => 
          hasTools.every(tool => a.tools.includes(tool))
        );
      }
    }
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Encontrados ${allAgents.length} agentes`
        },
        {
          type: 'text' as const,
          text: JSON.stringify({
            agents: allAgents,
            total: allAgents.length,
            path: validated.path,
            filter: validated.filter
          }, null, 2)
        }
      ]
    };
  } catch (error: any) {
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      `Erro ao listar agentes: ${error.message}`
    );
  }
}

// Handler para obter detalhes de agente
export async function handleGetAgentDetails(params: unknown) {
  const validated = GetAgentDetailsSchema.parse(params);
  
  try {
    const agentsPath = DEFAULT_AGENTS_PATH;
    const filePath = path.join(agentsPath, validated.agentFile);
    
    // Verificar se arquivo existe
    await fs.access(filePath);
    
    const agents = await parseAgentsFile(filePath);
    
    if (validated.agentName) {
      const agent = agents.find(a => a.name === validated.agentName);
      if (!agent) {
        throw new Error(`Agente '${validated.agentName}' não encontrado em ${validated.agentFile}`);
      }
      
      return {
        content: [
          {
            type: 'text' as const,
            text: `Detalhes do agente ${validated.agentName}`
          },
          {
            type: 'text' as const,
            text: JSON.stringify(agent, null, 2)
          }
        ]
      };
    }
    
    // Retornar todos os agentes do arquivo
    return {
      content: [
        {
          type: 'text' as const,
          text: `${agents.length} agentes encontrados em ${validated.agentFile}`
        },
        {
          type: 'text' as const,
          text: JSON.stringify({
            file: validated.agentFile,
            agents: agents,
            total: agents.length
          }, null, 2)
        }
      ]
    };
  } catch (error: any) {
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      `Erro ao obter detalhes: ${error.message}`
    );
  }
}

// Handler para analisar agente
export async function handleAnalyzeAgent(params: unknown) {
  const validated = AnalyzeAgentSchema.parse(params);
  
  try {
    const agentsPath = DEFAULT_AGENTS_PATH;
    const filePath = path.join(agentsPath, validated.agentFile);
    
    const agents = await parseAgentsFile(filePath);
    
    let analysis: any = {};
    
    switch (validated.analysisType) {
      case 'tools':
        // Análise de uso de ferramentas
        const toolUsage: Record<string, number> = {};
        agents.forEach(agent => {
          agent.tools.forEach(tool => {
            toolUsage[tool] = (toolUsage[tool] || 0) + 1;
          });
        });
        
        analysis = {
          type: 'tools',
          totalTools: Object.keys(toolUsage).length,
          toolUsage,
          mostUsed: Object.entries(toolUsage)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([tool, count]) => ({ tool, count }))
        };
        break;
        
      case 'structure':
        // Análise de estrutura
        const typeDistribution: Record<string, number> = {};
        agents.forEach(agent => {
          typeDistribution[agent.type] = (typeDistribution[agent.type] || 0) + 1;
        });
        
        analysis = {
          type: 'structure',
          totalAgents: agents.length,
          typeDistribution,
          averageToolsPerAgent: agents.reduce((sum, a) => sum + a.tools.length, 0) / agents.length
        };
        break;
        
      case 'dependencies':
        // Análise de dependências (simplificada)
        analysis = {
          type: 'dependencies',
          agents: agents.map(a => ({
            name: a.name,
            dependsOn: a.tools
          }))
        };
        break;
        
      case 'usage':
        // Score de uso baseado em complexidade
        analysis = {
          type: 'usage',
          scores: agents.map(a => ({
            name: a.name,
            complexity: a.tools.length,
            score: a.tools.length * 10 + (a.description?.length || 0)
          })).sort((a, b) => b.score - a.score)
        };
        break;
    }
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Análise ${validated.analysisType} de ${validated.agentFile}`
        },
        {
          type: 'text' as const,
          text: JSON.stringify(analysis, null, 2)
        }
      ]
    };
  } catch (error: any) {
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      `Erro ao analisar agente: ${error.message}`
    );
  }
}

// Handler para gerenciar habilidades dinâmicas do agente Ekyte
export async function handleManageSkills(params: unknown) {
  const validated = ManageSkillsSchema.parse(params);
  
  console.log(`🧠 Gerenciando habilidades do agente Ekyte: ${validated.action}`);
  
  try {
    // Importar sistema evolutivo real
    const { EvolutionaryLearningSystem } = await import('../../core/evolutionary-learning-system.js');
    const evolutionarySystem = new EvolutionaryLearningSystem();
    
    let result: any = {};
    
    switch (validated.action) {
      case 'discover':
        // Auto-descoberta de novas habilidades durante navegação
        if (validated.contextData) {
          const discoveredSkills = await evolutionarySystem.discoverSkills({
            currentUrl: validated.contextData.currentUrl || '',
            pageTitle: validated.contextData.pageTitle || '',
            elements: validated.contextData.uniqueElements || []
          });
          
          result = {
            discovered: discoveredSkills.length,
            skills: discoveredSkills.map((s: any) => s.name)
          };
        }
        break;
        
      case 'register':
        // Registro manual de nova habilidade
        if (validated.skillData) {
          const skill = await evolutionarySystem.registerSkill({
            name: validated.skillData.name,
            description: validated.skillData.description,
            context: validated.skillData.context,
            selectors: validated.skillData.selectors,
            steps: validated.skillData.steps,
            triggers: validated.skillData.triggers,
            difficulty: validated.skillData.difficulty,
            confidence: 0.8
          });
          
          result = {
            registered: skill.name,
            difficulty: skill.difficulty,
            id: skill.id
          };
        }
        break;
        
      case 'list':
        // Listar todas as habilidades organizadas
        const skillsList = await evolutionarySystem.listSkills();
        result = skillsList;
        break;
        
      case 'execute':
        // Executar habilidade baseada em linguagem natural
        if (validated.naturalLanguageQuery) {
          const execution = await evolutionarySystem.executeSkillFromNaturalLanguage(validated.naturalLanguageQuery);
          
                     if (execution.skill) {
            result = {
              matchedSkill: (execution.skill as any).name || 'unknown',
              confidence: execution.confidence,
              executionPlan: execution.executionPlan,
              requiredTools: (execution.skill as any).selectors || [],
              description: (execution.skill as any).description || 'No description',
              alternatives: execution.alternatives.map((alt: any) => alt.name || 'unnamed')
            };
          } else {
            result = {
              message: 'Nenhuma habilidade correspondente encontrada',
              suggestion: 'Tente descrever a ação de forma diferente ou registre uma nova habilidade'
            };
          }
        }
        break;
        
      case 'evolve':
        // Evolução automática das habilidades baseada no uso
        const evolution = await evolutionarySystem.evolveSystem();
        result = {
          evolved: evolution.promotions,
          promotions: evolution.promotions,
          newExpertiseLevel: evolution.newExpertiseLevel
        };
        break;
        
      case 'analyze_context':
        // Análise contextual para sugerir próximas ações
        if (validated.contextData) {
          const analysis = await evolutionarySystem.analyzeContext({
            currentUrl: validated.contextData.currentUrl || '',
            pageTitle: validated.contextData.pageTitle || '',
            elements: validated.contextData.uniqueElements || []
          });
          
          result = {
            suggestions: analysis.suggestions,
            opportunities: analysis.opportunities,
            risks: analysis.risks,
            contextAnalysis: {
              url: validated.contextData.currentUrl,
              elements: validated.contextData.uniqueElements?.length || 0
            },
            recommendedSkills: analysis.suggestions.map((s: any) => s.skillName)
          };
        }
        break;
    }
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `✅ Ação ${validated.action} executada com sucesso`
        },
        {
          type: 'text' as const,
          text: JSON.stringify({
            action: validated.action,
            result,
            timestamp: new Date().toISOString(),
            systemVersion: '2.0.0-evolutionary'
          }, null, 2)
        }
      ]
    };
    
  } catch (error: any) {
    console.error(`❌ Erro no sistema evolutivo:`, error);
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      `Falha no sistema evolutivo: ${error.message}`
    );
  }
}

// Handler para buscar agentes
export async function handleSearchAgents(params: unknown) {
  const validated = SearchAgentsSchema.parse(params);
  
  try {
    const agentsPath = validated.path;
    const files = await fs.readdir(agentsPath);
    const agentFiles = files.filter(f => f.endsWith('.ts') && (f.includes('agent') || f.includes('guardian')));
    
    let allAgents: Agent[] = [];
    
    for (const file of agentFiles) {
      const filePath = path.join(agentsPath, file);
      const agents = await parseAgentsFile(filePath);
      allAgents = allAgents.concat(agents);
    }
    
    // Buscar por query
    const query = validated.query.toLowerCase();
    const results = allAgents.filter(agent => 
      agent.name.toLowerCase().includes(query) ||
      agent.description?.toLowerCase().includes(query) ||
      agent.tools.some(tool => tool.toLowerCase().includes(query)) ||
      agent.type.includes(query)
    );
    
    // Calcular relevância
    const scoredResults = results.map(agent => {
      let score = 0;
      if (agent.name.toLowerCase().includes(query)) score += 10;
      if (agent.description?.toLowerCase().includes(query)) score += 5;
      if (agent.tools.some(t => t.toLowerCase().includes(query))) score += 3;
      if (agent.type.includes(query)) score += 2;
      
      return { ...agent, score };
    }).sort((a, b) => b.score - a.score);
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Encontrados ${scoredResults.length} agentes para "${validated.query}"`
        },
        {
          type: 'text' as const,
          text: JSON.stringify({
            results: scoredResults,
            total: scoredResults.length,
            query: validated.query
          }, null, 2)
        }
      ]
    };
  } catch (error: any) {
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      `Erro ao buscar agentes: ${error.message}`
    );
  }
}

// Metadados das ferramentas de agentes
export const agentsTools = [
  {
    name: 'agents_list',
    description: 'Lista todos os agentes disponíveis no projeto Claude Flow com filtros opcionais',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Caminho para buscar agentes (padrão: ../claude-flow/src/agents)'
        },
        filter: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['researcher', 'implementer', 'analyst', 'coordinator', 'custom'],
              description: 'Filtrar por tipo de agente'
            },
            name: {
              type: 'string',
              description: 'Filtrar por nome do agente'
            },
            hasTools: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filtrar agentes que possuem determinadas ferramentas'
            }
          }
        }
      }
    }
  },
  {
    name: 'agents_get_details',
    description: 'Obtém detalhes específicos de um agente ou arquivo de agentes',
    inputSchema: {
      type: 'object',
      properties: {
        agentFile: {
          type: 'string',
          description: 'Nome do arquivo (ex: "dev-agents.ts")'
        },
        agentName: {
          type: 'string',
          description: 'Nome específico do agente (opcional)'
        }
      },
      required: ['agentFile']
    }
  },
  {
    name: 'agents_analyze',
    description: 'Analisa estrutura, dependências ou uso de ferramentas dos agentes',
    inputSchema: {
      type: 'object',
      properties: {
        agentFile: {
          type: 'string',
          description: 'Nome do arquivo para analisar'
        },
        analysisType: {
          type: 'string',
          enum: ['dependencies', 'tools', 'structure', 'usage'],
          description: 'Tipo de análise a realizar'
        }
      },
      required: ['agentFile', 'analysisType']
    }
  },
  {
    name: 'agents_search',
    description: 'Busca agentes por termo em nome, descrição ou ferramentas',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Termo de busca'
        },
        path: {
          type: 'string',
          description: 'Caminho personalizado (opcional)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'agents_manage_skills',
    description: 'Gerencia habilidades dinâmicas do agente especialista em Ekyte - sistema de aprendizado evolutivo',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['discover', 'register', 'list', 'execute', 'evolve', 'analyze_context'],
          description: 'Ação a ser executada no sistema de habilidades'
        },
        skillData: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nome da habilidade' },
            description: { type: 'string', description: 'Descrição da habilidade' },
            context: { type: 'string', description: 'Contexto onde foi descoberta' },
            selectors: { type: 'array', items: { type: 'string' }, description: 'Seletores CSS necessários' },
            steps: { type: 'array', items: { type: 'string' }, description: 'Passos para executar' },
            triggers: { type: 'array', items: { type: 'string' }, description: 'Palavras-chave que ativam a habilidade' },
            difficulty: { type: 'string', enum: ['basic', 'intermediate', 'advanced', 'expert'], description: 'Nível de dificuldade' }
          },
          required: ['name', 'description', 'context', 'difficulty'],
          description: 'Dados da habilidade (para register)'
        },
        naturalLanguageQuery: {
          type: 'string',
          description: 'Query em linguagem natural para executar habilidade (para execute)'
        },
        contextData: {
          type: 'object',
          description: 'Dados do contexto atual da página (para discover/analyze_context)'
        }
      },
      required: ['action']
    }
  }
];

// Sistema evolutivo integrado - versão funcional