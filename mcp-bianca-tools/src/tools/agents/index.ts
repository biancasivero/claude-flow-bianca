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
  
  const skillsPath = path.join(process.cwd(), '../workspace/ekyte-skills.json');
  
  try {
    // Carregar habilidades existentes
    let skills: any = {};
    try {
      const skillsContent = await fs.readFile(skillsPath, 'utf-8');
      skills = JSON.parse(skillsContent);
    } catch {
      skills = {
        version: '1.0.0',
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
        expertiseEvolution: []
      };
    }
    
    let result: any = {};
    
    switch (validated.action) {
      case 'discover':
        // Auto-descoberta de novas habilidades durante navegação
        if (validated.contextData) {
          const newSkills = await analyzePageForSkills(validated.contextData);
          for (const skill of newSkills) {
            await registerNewSkill(skills, skill);
          }
          result = {
            discovered: newSkills.length,
            skills: newSkills.map(s => s.name)
          };
        }
        break;
        
      case 'register':
        // Registro manual de nova habilidade
        if (validated.skillData) {
          await registerNewSkill(skills, validated.skillData);
          result = {
            registered: validated.skillData.name,
            difficulty: validated.skillData.difficulty
          };
        }
        break;
        
      case 'list':
        // Listar todas as habilidades organizadas
        result = {
          totalSkills: skills.totalSkills,
          skillsByDifficulty: skills.skillsByDifficulty,
          recentlyLearned: skills.learningHistory.slice(-5),
          availableSkills: Object.keys(skills.skills),
          expertiseLevel: calculateExpertiseLevel(skills),
          evolutionPath: skills.expertiseEvolution.slice(-3)
        };
        break;
        
      case 'execute':
        // Executar habilidade baseada em linguagem natural
        if (validated.naturalLanguageQuery) {
          const matchedSkill = await matchSkillFromNaturalLanguage(skills, validated.naturalLanguageQuery);
          if (matchedSkill) {
            result = {
              matchedSkill: matchedSkill.name,
              confidence: matchedSkill.confidence,
              executionPlan: matchedSkill.steps,
              requiredTools: matchedSkill.selectors,
              description: matchedSkill.description
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
        const evolved = await evolveSkills(skills);
        result = {
          evolved: evolved.length,
          promotions: evolved,
          newExpertiseLevel: calculateExpertiseLevel(skills)
        };
        break;
        
      case 'analyze_context':
        // Análise contextual para sugerir próximas ações
        if (validated.contextData) {
          const suggestions = await analyzeContextForSuggestions(skills, validated.contextData);
          result = {
            suggestions,
            contextAnalysis: {
              url: validated.contextData.currentUrl,
              elements: validated.contextData.uniqueElements?.length || 0
            },
            recommendedSkills: suggestions.map((s: any) => s.skillName)
          };
        }
        break;
    }
    
    // Salvar habilidades atualizadas
    skills.lastUpdated = new Date().toISOString();
    await fs.writeFile(skillsPath, JSON.stringify(skills, null, 2));
    
    return {
      content: [
        {
          type: 'text' as const,
          text: `Ação ${validated.action} executada com sucesso`
        },
        {
          type: 'text' as const,
          text: JSON.stringify({
            action: validated.action,
            result,
            totalSkills: skills.totalSkills,
            expertiseLevel: calculateExpertiseLevel(skills),
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ]
    };
    
  } catch (error: any) {
    throw new MCPError(
      ErrorCode.INTERNAL_ERROR,
      `Erro no gerenciamento de habilidades: ${error.message}`
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

// Funções auxiliares para o sistema de habilidades
async function analyzePageForSkills(contextData: any): Promise<any[]> {
  const discoveredSkills = [];
  
  // Análise de elementos únicos da página
  if (contextData.uniqueElements) {
    for (const element of contextData.uniqueElements) {
      if (isNewSkillWorthy(element)) {
        discoveredSkills.push({
          name: `handle_${element.type}_${element.identifier}`,
          description: `Gerenciar ${element.type} - ${element.description}`,
          context: contextData.currentUrl,
          selectors: [element.selector],
          steps: generateStepsForElement(element),
          triggers: [element.text, element.identifier],
          difficulty: assessDifficulty(element),
          discoveredAt: new Date().toISOString(),
          confidence: element.confidence || 0.8
        });
      }
    }
  }
  
  return discoveredSkills;
}

async function registerNewSkill(skills: any, skillData: any) {
  const skillId = generateSkillId(skillData.name);
  
  if (!skills.skills[skillId]) {
    skills.skills[skillId] = {
      ...skillData,
      id: skillId,
      createdAt: new Date().toISOString(),
      usageCount: 0,
      successRate: 0,
      lastUsed: null,
      evolution: {
        version: 1,
        improvements: []
      }
    };
    
    skills.totalSkills++;
    skills.skillsByDifficulty[skillData.difficulty]++;
    skills.learningHistory.push({
      action: 'skill_registered',
      skillId,
      timestamp: new Date().toISOString(),
      context: skillData.context
    });
    
    console.log(`✅ Nova habilidade registrada: ${skillData.name}`);
  }
}

async function matchSkillFromNaturalLanguage(skills: any, query: string): Promise<any> {
  const queryLower = query.toLowerCase();
  const matches = [];
  
  for (const [, skill] of Object.entries(skills.skills)) {
    const skillData = skill as any;
    let confidence = 0;
    
    // Análise de correspondência por triggers
    if (skillData.triggers) {
      for (const trigger of skillData.triggers) {
        if (queryLower.includes(trigger.toLowerCase())) {
          confidence += 0.3;
        }
      }
    }
    
    // Análise de correspondência por descrição
    if (skillData.description && queryLower.includes(skillData.description.toLowerCase().split(' ')[0])) {
      confidence += 0.4;
    }
    
    // Análise de correspondência por nome
    if (queryLower.includes(skillData.name.toLowerCase().replace(/_/g, ' '))) {
      confidence += 0.5;
    }
    
    if (confidence > 0.5) {
      matches.push({
        ...skillData,
        confidence
      });
    }
  }
  
  // Retorna a melhor correspondência
  return matches.sort((a, b) => b.confidence - a.confidence)[0] || null;
}

function calculateExpertiseLevel(skills: any): string {
  const total = skills.totalSkills;
  const expert = skills.skillsByDifficulty.expert;
  const advanced = skills.skillsByDifficulty.advanced;
  
  if (total >= 50 && expert >= 10) return 'Senior Specialist';
  if (total >= 30 && expert >= 5) return 'Advanced Specialist';
  if (total >= 20 && advanced >= 5) return 'Intermediate Specialist';
  if (total >= 10) return 'Junior Specialist';
  return 'Learning Specialist';
}

async function evolveSkills(skills: any): Promise<any[]> {
  const evolved = [];
  
  // Lógica de evolução automática das habilidades
  for (const [skillId, skill] of Object.entries(skills.skills)) {
    const skillData = skill as any;
    
    // Promover habilidades com alta taxa de sucesso
    if (skillData.successRate > 0.9 && skillData.usageCount > 10) {
      if (skillData.difficulty === 'basic') {
        skillData.difficulty = 'intermediate';
        skillData.evolution.version++;
        skillData.evolution.improvements.push({
          type: 'difficulty_promotion',
          from: 'basic',
          to: 'intermediate',
          timestamp: new Date().toISOString()
        });
        evolved.push({
          skillId,
          name: skillData.name,
          promotion: 'basic -> intermediate'
        });
      }
    }
  }
  
  return evolved;
}

async function analyzeContextForSuggestions(_skills: any, contextData: any): Promise<any[]> {
  const suggestions = [];
  
  // Sugestões baseadas no contexto atual
  if (contextData.currentUrl?.includes('task')) {
    suggestions.push({
      skillName: 'ekyte_manage_task',
      reason: 'Contexto de tarefa detectado',
      confidence: 0.9
    });
  }
  
  if (contextData.notifications?.length > 0) {
    suggestions.push({
      skillName: 'ekyte_process_notifications',
      reason: 'Notificações pendentes detectadas',
      confidence: 0.8
    });
  }
  
  return suggestions;
}

function isNewSkillWorthy(element: any): boolean {
  // Critérios para determinar se um elemento merece uma nova habilidade
  const worthyTypes = ['button', 'form', 'modal', 'dropdown', 'table', 'chart'];
  const worthyActions = ['submit', 'create', 'edit', 'delete', 'export', 'import'];
  
  return worthyTypes.some(type => element.type?.includes(type)) ||
         worthyActions.some(action => element.text?.toLowerCase().includes(action));
}

function generateStepsForElement(element: any): string[] {
  const steps = [];
  
  if (element.type === 'form') {
    steps.push('Localizar formulário');
    steps.push('Preencher campos obrigatórios');
    steps.push('Validar dados');
    steps.push('Submeter formulário');
  } else if (element.type === 'button') {
    steps.push('Localizar botão');
    steps.push('Verificar se está habilitado');
    steps.push('Clicar no botão');
    steps.push('Aguardar resposta');
  }
  
  return steps.length ? steps : ['Interagir com elemento', 'Verificar resultado'];
}

function assessDifficulty(element: any): 'basic' | 'intermediate' | 'advanced' | 'expert' {
  if (element.requiresAuth) return 'advanced';
  if (element.hasValidation) return 'intermediate';
  if (element.isComplex) return 'expert';
  return 'basic';
}

function generateSkillId(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}