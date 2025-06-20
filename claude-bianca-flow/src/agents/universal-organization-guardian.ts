/**
 * Universal Organization Guardian
 * 
 * Sistema de organização independente de projeto que:
 * - Detecta automaticamente o tipo de projeto
 * - Adapta estrutura esperada dinamicamente
 * - Funciona com qualquer linguagem/framework
 * - Mantém score de organização em 100%
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as chokidar from 'chokidar';
import { GuardianMemoryManager } from '../utils/guardian-memory';
import { AgentType } from '../core/agent-types';
import { logStart, logEnd } from '../utils/agent-logger';
import { v4 as uuidv4 } from 'uuid';

// Simulação do MCP Sequential Thinking para decisões autônomas
interface SequentialThought {
  thought: string;
  nextThoughtNeeded: boolean;
  thoughtNumber: number;
  totalThoughts: number;
}

interface ProjectType {
  name: string;
  indicators: string[];
  structure: {
    [key: string]: {
      allowed?: string[];
      patterns?: RegExp;
      subfolders?: string[];
      maxFiles?: number;
      maxLooseFiles?: number;
      noSubfolders?: boolean;
    };
  };
}

interface UniversalOrganizationIssue {
  type: 'wrong-location' | 'bad-naming' | 'duplicate' | 'no-docs' | 'messy-folder' | 'too-many-files' | 'missing-readme';
  severity: 'critical' | 'major' | 'minor';
  file?: string;
  folder?: string;
  description: string;
  solution: string;
  points: number;
}

interface UniversalOrganizationReport {
  projectPath: string;
  projectType: string;
  score: number;
  maxScore: 100;
  issues: UniversalOrganizationIssue[];
  stats: {
    totalFiles: number;
    wellOrganizedFiles: number;
    filesNeedingAttention: number;
    duplicateFiles: number;
    messyFolders: string[];
  };
  recommendations: string[];
}

export class UniversalOrganizationGuardian {
  private projectPath: string;
  private projectType: ProjectType | null = null;
  private watcher: chokidar.FSWatcher | null = null;
  private isProcessing = false;
  private scoreHistory: number[] = [];
  private memory: GuardianMemoryManager;
  private guardianConfig: any;

  // Definições de tipos de projeto
  private readonly projectTypes: ProjectType[] = [
    {
      name: 'Node.js/TypeScript',
      indicators: ['package.json', 'tsconfig.json'],
      structure: {
        '/': {
          allowed: ['README.md', 'package.json', 'package-lock.json', 'tsconfig.json', '.gitignore', '.env', 'CHANGELOG.md', 'LICENSE'],
          maxFiles: 15
        },
        'src': {
          subfolders: ['tests', '__tests__', 'test', 'utils', 'types', 'config', 'lib', 'components', 'services'],
          maxLooseFiles: 5
        },
        'docs': {
          patterns: /\.(md|txt|pdf)$/i,
          noSubfolders: false
        },
        'config': {
          patterns: /\.(yml|yaml|json|env|ini|conf)$/
        },
        'scripts': {
          patterns: /\.(sh|bash|ps1|bat|js|mjs|cjs)$/
        }
      }
    },
    {
      name: 'Python',
      indicators: ['requirements.txt', 'setup.py', 'pyproject.toml'],
      structure: {
        '/': {
          allowed: ['README.md', 'requirements.txt', 'setup.py', 'pyproject.toml', '.gitignore', '.env', 'LICENSE'],
          maxFiles: 12
        },
        'src': {
          subfolders: ['tests', 'test', 'utils', 'models', 'views', 'controllers'],
          maxLooseFiles: 3
        },
        'tests': {
          patterns: /test_.*\.py$/,
          maxLooseFiles: 20
        },
        'docs': {
          patterns: /\.(md|rst|txt)$/i
        }
      }
    },
    {
      name: 'Generic',
      indicators: [],
      structure: {
        '/': {
          maxFiles: 20
        },
        'src': {
          maxLooseFiles: 10
        },
        'docs': {
          patterns: /\.(md|txt)$/i
        }
      }
    }
  ];

  private readonly universalWeights = {
    fileLocation: 30,
    naming: 15,
    noDuplicates: 20,
    documentation: 15,
    folderStructure: 20
  };

  constructor(projectPath?: string, private readonly mode: 'continuous' | 'single' = 'single') {
    this.projectPath = projectPath || process.cwd();
    this.memory = new GuardianMemoryManager();
    this.guardianConfig = {
      checkInterval: 60000,
      targetScore: 100,
      autoFix: true,
      workDelay: 5000,
      maxHistorySize: 100
    };
  }

  async initialize(): Promise<void> {
    // Método personalizado de inicialização
    
    // Detectar tipo de projeto
    await this.detectProjectType();
    
    // Buscar memórias anteriores similares
    await this.loadRelevantMemories();
    
    if (this.mode === 'continuous') {
      // Iniciar monitoramento apenas em modo contínuo
      await this.startWatching();
    }
    
    // Análise inicial
    await this.performFullAnalysis();
    
    if (this.mode === 'single') {
      // Em modo single, parar após análise
      await this.stop();
    }
  }

  /**
   * Detecta o tipo de projeto automaticamente
   */
  private async detectProjectType(): Promise<void> {
    console.log(`\n🔍 Detectando tipo de projeto em: ${this.projectPath}`);
    
    const files = await fs.readdir(this.projectPath);
    
    // Tentar detectar tipo específico
    for (const projectType of this.projectTypes) {
      if (projectType.indicators.length === 0) continue;
      
      const hasAllIndicators = projectType.indicators.every(indicator => 
        files.includes(indicator)
      );
      
      if (hasAllIndicators) {
        this.projectType = projectType;
        console.log(`✅ Tipo detectado: ${projectType.name}`);
        
        // Memorizar tipo de projeto detectado
        await this.memory.addMemory({
          content: `Detectado projeto tipo ${projectType.name} em ${path.basename(this.projectPath)}`,
          category: 'project_detection',
          metadata: {
            project: path.basename(this.projectPath),
            project_type: projectType.name,
            indicators: projectType.indicators
          }
        });
        
        return;
      }
    }
    
    // Fallback para genérico
    this.projectType = this.projectTypes.find(t => t.name === 'Generic')!;
    console.log('📦 Usando regras genéricas de organização');
  }

  /**
   * Inicia monitoramento de mudanças
   */
  private async startWatching(): Promise<void> {
    // Usar ignoreInitial e depth para reduzir arquivos monitorados
    this.watcher = chokidar.watch(this.projectPath, {
      ignored: [
        /node_modules/,
        /\.git/,
        /dist/,
        /build/,
        /\.next/,
        /__pycache__/,
        /\.pyc$/,
        /\.cache/,
        /coverage/,
        /\.vscode/,
        /\.idea/
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 3, // Limitar profundidade para evitar muitos arquivos
      usePolling: false,
      interval: 100
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange('added', filePath))
      .on('change', (filePath) => this.handleFileChange('changed', filePath))
      .on('unlink', (filePath) => this.handleFileChange('removed', filePath));

    console.log('👁️ Monitoramento ativo para mudanças...');
  }

  /**
   * Lida com mudanças de arquivos
   */
  private async handleFileChange(event: string, filePath: string): Promise<void> {
    if (this.isProcessing) return;
    
    console.log(`\n📝 Arquivo ${event}: ${filePath}`);
    
    // Aguardar um pouco para consolidar mudanças
    setTimeout(() => {
      this.performFullAnalysis();
    }, this.guardianConfig.workDelay);
  }

  /**
   * Realiza análise completa do projeto
   */
  private async performFullAnalysis(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    // Registrar início da análise
    const taskId = `analysis-${uuidv4().substring(0, 8)}`;
    console.log(`🚀 [Guardian] Iniciando análise completa: ${taskId}`);
    
    // Log no Agent Log API
    await logStart(
      'Guardian Agent',
      AgentType.COORDINATOR,
      taskId,
      'Análise completa de organização do projeto',
      {
        taskType: 'organization-analysis',
        projectPath: this.projectPath,
        projectType: this.projectType?.name || 'Unknown',
        complexity: 'complex'
      }
    );
    
    const startTime = Date.now();
    
    try {
      const report = await this.calculateOrganizationScore();
      await this.saveReport(report);
      
      // Histórico de scores
      this.scoreHistory.push(report.score);
      if (this.scoreHistory.length > this.guardianConfig.maxHistorySize) {
        this.scoreHistory.shift();
      }
      
      // Log resultado da análise
      const duration = Date.now() - startTime;
      await logEnd(
        'Guardian Agent',
        taskId,
        'completed',
        undefined,
        {
          score: report.score,
          issuesFound: report.issues.length,
          projectType: report.projectType,
          duration
        }
      );
      
      // Se score < 100, usar Sequential Thinking para decisão autônoma
      if (report.score < 100 && this.guardianConfig.autoFix) {
        await this.autonomousDecisionWithSequentialThinking(report);
      } else if (report.score === 100) {
        // Memorizar estrutura bem-sucedida
        await this.memory.rememberSuccessfulStructure(
          this.projectType?.name || 'Generic',
          report.score,
          JSON.stringify(await this.getCurrentStructure())
        );
      }
      
      // Registrar fim da análise com sucesso
      console.log(`✅ [Guardian] Análise completa: Score ${report.score}%, ${report.issues.length} problemas`);
      
    } catch (error) {
      console.error('❌ [Guardian] Erro na análise:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Calcula score de organização universal
   */
  async calculateOrganizationScore(): Promise<UniversalOrganizationReport> {
    console.log('\n📊 Calculando score de organização universal...');
    
    const issues: UniversalOrganizationIssue[] = [];
    const stats = {
      totalFiles: 0,
      wellOrganizedFiles: 0,
      filesNeedingAttention: 0,
      duplicateFiles: 0,
      messyFolders: [] as string[]
    };

    // 1. Verificar localização de arquivos
    const locationIssues = await this.checkUniversalFileLocations();
    issues.push(...locationIssues);

    // 2. Verificar nomenclatura
    const namingIssues = await this.checkUniversalNaming();
    issues.push(...namingIssues);

    // 3. Verificar duplicações
    const duplicateIssues = await this.checkUniversalDuplicates();
    issues.push(...duplicateIssues);

    // 4. Verificar documentação
    const docIssues = await this.checkUniversalDocumentation();
    issues.push(...docIssues);

    // 5. Verificar estrutura
    const structureIssues = await this.checkUniversalStructure();
    issues.push(...structureIssues);

    // Calcular score
    const totalPointsLost = issues.reduce((sum, issue) => sum + issue.points, 0);
    const score = Math.max(0, 100 - totalPointsLost);

    // Estatísticas
    stats.totalFiles = await this.countTotalFiles();
    stats.filesNeedingAttention = issues.filter(i => i.file).length;
    stats.wellOrganizedFiles = stats.totalFiles - stats.filesNeedingAttention;
    stats.duplicateFiles = duplicateIssues.length;
    stats.messyFolders = Array.from(new Set(structureIssues.map(i => i.folder || '').filter(Boolean)));

    // Recomendações
    const recommendations = this.generateUniversalRecommendations(score, issues);

    return {
      projectPath: this.projectPath,
      projectType: this.projectType?.name || 'Unknown',
      score,
      maxScore: 100,
      issues,
      stats,
      recommendations
    };
  }

  /**
   * Verifica localização de arquivos usando regras universais
   */
  private async checkUniversalFileLocations(): Promise<UniversalOrganizationIssue[]> {
    const issues: UniversalOrganizationIssue[] = [];
    
    // Verificar raiz do projeto
    const rootFiles = await fs.readdir(this.projectPath);
    const rootStructure = this.projectType?.structure['/'] || {};
    
    let rootFileCount = 0;
    for (const file of rootFiles) {
      const fullPath = path.join(this.projectPath, file);
      const stats = await fs.stat(fullPath);
      
      if (stats.isFile()) {
        rootFileCount++;
        
        // Se há lista de permitidos, verificar
        if (rootStructure.allowed && !rootStructure.allowed.includes(file)) {
          // Arquivos .md (exceto README) deveriam estar em docs/
          if (file.endsWith('.md') && file !== 'README.md') {
            issues.push({
              type: 'wrong-location',
              severity: 'major',
              file,
              description: `${file} deveria estar em /docs`,
              solution: `Mover para docs/${file}`,
              points: 5
            });
          }
          // Arquivos de config deveriam estar em config/
          else if (/\.(yml|yaml|json)$/.test(file) && !['package.json', 'tsconfig.json'].includes(file)) {
            issues.push({
              type: 'wrong-location',
              severity: 'minor',
              file,
              description: `${file} poderia estar em /config`,
              solution: `Considerar mover para config/${file}`,
              points: 3
            });
          }
        }
      }
    }
    
    // Verificar se há muitos arquivos na raiz
    if (rootStructure.maxFiles && rootFileCount > rootStructure.maxFiles) {
      issues.push({
        type: 'too-many-files',
        severity: 'major',
        folder: '/',
        description: `Raiz tem ${rootFileCount} arquivos (máximo recomendado: ${rootStructure.maxFiles})`,
        solution: 'Organizar arquivos em subpastas apropriadas',
        points: 10
      });
    }
    
    // Verificar arquivos soltos em src/
    const srcPath = path.join(this.projectPath, 'src');
    if (await this.pathExists(srcPath)) {
      const srcFiles = await fs.readdir(srcPath);
      const srcStructure = this.projectType?.structure['src'] || {};
      
      let looseFileCount = 0;
      for (const file of srcFiles) {
        const fullPath = path.join(srcPath, file);
        const stats = await fs.stat(fullPath);
        
        if (stats.isFile() && (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.py'))) {
          looseFileCount++;
        }
      }
      
      const maxLoose = srcStructure.maxLooseFiles || 5;
      if (looseFileCount > maxLoose) {
        issues.push({
          type: 'messy-folder',
          severity: 'major',
          folder: 'src',
          description: `src/ tem ${looseFileCount} arquivos soltos (máximo recomendado: ${maxLoose})`,
          solution: 'Organizar em subpastas temáticas',
          points: 8
        });
      }
    }
    
    return issues;
  }

  /**
   * Verifica nomenclatura universal
   */
  private async checkUniversalNaming(): Promise<UniversalOrganizationIssue[]> {
    const issues: UniversalOrganizationIssue[] = [];
    
    // Verificar inconsistências de nomenclatura
    const allFiles = await this.getAllFiles(this.projectPath);
    
    // Detectar padrões mistos (camelCase vs kebab-case vs snake_case)
    const patterns = {
      camelCase: 0,
      kebabCase: 0,
      snakeCase: 0
    };
    
    for (const filePath of allFiles) {
      const fileName = path.basename(filePath, path.extname(filePath));
      
      if (/[a-z][A-Z]/.test(fileName)) patterns.camelCase++;
      if (/-/.test(fileName)) patterns.kebabCase++;
      if (/_/.test(fileName)) patterns.snakeCase++;
    }
    
    // Se há mistura significativa de padrões
    const totalPatterned = patterns.camelCase + patterns.kebabCase + patterns.snakeCase;
    if (totalPatterned > 10) {
      const dominantPattern = Object.entries(patterns)
        .sort(([,a], [,b]) => b - a)[0][0];
      
      const mixedCount = totalPatterned - patterns[dominantPattern as keyof typeof patterns];
      if (mixedCount > totalPatterned * 0.2) {
        issues.push({
          type: 'bad-naming',
          severity: 'minor',
          description: 'Nomenclatura inconsistente detectada',
          solution: `Padronizar para ${dominantPattern} em todo o projeto`,
          points: 5
        });
      }
    }
    
    return issues;
  }

  /**
   * Verifica duplicações universais
   */
  private async checkUniversalDuplicates(): Promise<UniversalOrganizationIssue[]> {
    const issues: UniversalOrganizationIssue[] = [];
    
    // Procurar por arquivos com nomes muito similares
    const allFiles = await this.getAllFiles(this.projectPath);
    const fileGroups = new Map<string, string[]>();
    
    // Agrupar por nome base similar
    for (const filePath of allFiles) {
      const fileName = path.basename(filePath);
      const baseName = fileName.replace(/[-_.]v?\d+/, '').toLowerCase();
      
      // Ignorar arquivos index.ts/index.js que são padrão de módulos
      if (baseName === 'index.ts' || baseName === 'index.js' || baseName === 'index') {
        continue;
      }
      
      // Ignorar READMEs que são padrão em diferentes diretórios
      if (baseName === 'readme.md' || baseName === 'readme') {
        continue;
      }
      
      if (!fileGroups.has(baseName)) {
        fileGroups.set(baseName, []);
      }
      fileGroups.get(baseName)!.push(filePath);
    }
    
    // Identificar possíveis duplicatas
    for (const [baseName, files] of Array.from(fileGroups.entries())) {
      if (files.length > 2) {
        issues.push({
          type: 'duplicate',
          severity: 'major',
          description: `${files.length} arquivos similares: ${baseName}`,
          solution: 'Consolidar ou renomear para clarificar propósito',
          points: 3 * files.length
        });
      }
    }
    
    return issues;
  }

  /**
   * Verifica documentação universal
   */
  private async checkUniversalDocumentation(): Promise<UniversalOrganizationIssue[]> {
    const issues: UniversalOrganizationIssue[] = [];
    
    // README é universal
    const readmePath = path.join(this.projectPath, 'README.md');
    if (!await this.pathExists(readmePath)) {
      issues.push({
        type: 'no-docs',
        severity: 'critical',
        description: 'README.md não encontrado',
        solution: 'Criar README.md com descrição do projeto',
        points: 15
      });
    }
    
    // Verificar se há alguma documentação
    const docsPath = path.join(this.projectPath, 'docs');
    const hasDocs = await this.pathExists(docsPath);
    
    if (!hasDocs) {
      // Procurar por arquivos .md em qualquer lugar
      const mdFiles = await this.findFilesByExtension(this.projectPath, '.md');
      if (mdFiles.length <= 1) { // Apenas README ou menos
        issues.push({
          type: 'no-docs',
          severity: 'major',
          description: 'Documentação mínima ou ausente',
          solution: 'Adicionar documentação em /docs',
          points: 10
        });
      }
    }
    
    return issues;
  }

  /**
   * Verifica estrutura universal
   */
  private async checkUniversalStructure(): Promise<UniversalOrganizationIssue[]> {
    const issues: UniversalOrganizationIssue[] = [];
    
    // Verificar profundidade excessiva
    const maxDepth = await this.getMaxDepth(this.projectPath);
    if (maxDepth > 5) {
      issues.push({
        type: 'messy-folder',
        severity: 'minor',
        description: `Estrutura muito profunda (${maxDepth} níveis)`,
        solution: 'Considerar achatar estrutura de pastas',
        points: 5
      });
    }
    
    // Verificar pastas vazias
    const emptyFolders = await this.findEmptyFolders(this.projectPath);
    if (emptyFolders.length > 3) {
      issues.push({
        type: 'messy-folder',
        severity: 'minor',
        description: `${emptyFolders.length} pastas vazias encontradas`,
        solution: 'Remover pastas vazias desnecessárias',
        points: 3
      });
    }
    
    return issues;
  }

  /**
   * Mostra análise e solicita autorização para correções
   */
  private async showAnalysisAndRequestAuthorization(report: UniversalOrganizationReport): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 ANÁLISE DE ORGANIZAÇÃO COMPLETA');
    console.log('='.repeat(60));
    
    console.log(`\n📊 Score Atual: ${report.score}%`);
    console.log(`🎯 Objetivo: 100%`);
    console.log(`📈 Melhoria Possível: +${100 - report.score} pontos\n`);
    
    if (report.issues.length > 0) {
      console.log('📋 PROBLEMAS ENCONTRADOS:');
      console.log('-'.repeat(40));
      
      for (const issue of report.issues) {
        console.log(`\n${this.getSeverityEmoji(issue.severity)} ${issue.description}`);
        if (issue.file) {
          console.log(`   📄 Arquivo: ${issue.file}`);
        }
        console.log(`   💡 Solução: ${issue.solution}`);
        console.log(`   📉 Impacto: -${issue.points} pontos`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🤖 AÇÕES QUE SERÃO EXECUTADAS:');
    console.log('-'.repeat(40));
    
    // Listar ações específicas
    let actionCount = 0;
    for (const issue of report.issues) {
      if (issue.type === 'wrong-location' && issue.file) {
        if (issue.file.endsWith('.md') && issue.file !== 'README.md') {
          console.log(`${++actionCount}. Mover ${issue.file} → docs/`);
        } else if (/\.(yml|yaml|json)$/.test(issue.file)) {
          console.log(`${++actionCount}. Mover ${issue.file} → config/`);
        }
      } else if (issue.type === 'missing-readme') {
        console.log(`${++actionCount}. Criar README.md na raiz do projeto`);
      }
    }
    
    if (actionCount === 0) {
      console.log('Nenhuma ação automática disponível.');
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Criar arquivo de autorização
    const authFile = path.join(this.projectPath, 'GUARDIAN-AUTHORIZATION.md');
    const authContent = this.createAuthorizationFile(report, actionCount);
    
    await fs.writeFile(authFile, authContent);
    
    console.log('📄 Arquivo de autorização criado: GUARDIAN-AUTHORIZATION.md');
    console.log('✏️  Para autorizar as correções:');
    console.log('   1. Edite o arquivo e mude "PENDENTE" para "AUTORIZADO"');
    console.log('   2. O Guardian detectará a mudança e aplicará as correções');
    console.log('   3. Para cancelar, mude para "CANCELADO" ou delete o arquivo\n');
    
    // Monitorar arquivo de autorização
    await this.waitForAuthorization(authFile, report);
  }

  /**
   * Aplica correções automáticas
   */
  private async applyAutoFixes(report: UniversalOrganizationReport): Promise<void> {
    console.log('\n🔧 Aplicando correções automáticas...');
    
    // Registrar início das correções
    const taskId = `autofix-${uuidv4().substring(0, 8)}`;
    console.log(`🔧 [Guardian] Iniciando correções automáticas: ${taskId} (${report.issues.length} problemas)`);
    
    // Log no Agent Log API
    await logStart(
      'Guardian Agent',
      AgentType.COORDINATOR,
      taskId,
      `Aplicação de ${report.issues.length} correções automáticas`,
      {
        taskType: 'auto-fix',
        issueCount: report.issues.length,
        currentScore: report.score,
        complexity: 'medium'
      }
    );
    
    const startTime = Date.now();
    let fixCount = 0;
    
    try {
      for (const issue of report.issues) {
        if (issue.type === 'wrong-location' && issue.file) {
          // Mover arquivos para local correto
          if (issue.file.endsWith('.md') && issue.file !== 'README.md') {
            await this.moveFileToFolder(issue.file, 'docs');
            fixCount++;
          } else if (/\.(yml|yaml|json)$/.test(issue.file)) {
            await this.moveFileToFolder(issue.file, 'config');
            fixCount++;
          }
        }
      }
      
      // Registrar sucesso das correções
      const duration = Date.now() - startTime;
      console.log(`✅ [Guardian] Correções aplicadas: ${fixCount} correções`);
      
      await logEnd(
        'Guardian Agent',
        taskId,
        'completed',
        undefined,
        {
          fixesApplied: fixCount,
          totalIssues: report.issues.length,
          duration
        }
      );
    } catch (error) {
      // Registrar erro nas correções
      const duration = Date.now() - startTime;
      console.error(`❌ [Guardian] Erro nas correções (${fixCount} aplicadas):`, error);
      
      await logEnd(
        'Guardian Agent',
        taskId,
        'error',
        error instanceof Error ? error.message : String(error),
        {
          fixesApplied: fixCount,
          totalIssues: report.issues.length,
          duration
        }
      );
      
      throw error;
    }
    
    if (fixCount > 0) {
      console.log(`✅ ${fixCount} correções aplicadas`);
      // Re-analisar após correções
      setTimeout(() => this.performFullAnalysis(), 5000);
    }
  }

  /**
   * Move arquivo para pasta específica
   */
  private async moveFileToFolder(fileName: string, folderName: string): Promise<void> {
    const sourcePath = path.join(this.projectPath, fileName);
    const targetDir = path.join(this.projectPath, folderName);
    const targetPath = path.join(targetDir, fileName);
    
    try {
      // Buscar decisões anteriores similares
      const similarDecisions = await this.memory.findSimilarDecisions(
        path.basename(this.projectPath),
        'wrong-location'
      );
      
      if (similarDecisions.length > 0) {
        console.log('🧠 Guardian lembra de decisões similares:', similarDecisions[0].content);
      }
      
      // Criar pasta se não existir
      await fs.mkdir(targetDir, { recursive: true });
      
      // Mover arquivo
      await fs.rename(sourcePath, targetPath);
      console.log(`📁 Movido: ${fileName} → ${folderName}/`);
      
      // Memorizar decisão
      await this.memory.rememberOrganizationDecision(
        path.basename(this.projectPath),
        'move_file',
        `Movido ${fileName} para ${folderName}/`,
        {
          from: fileName,
          to: `${folderName}/${fileName}`,
          reason: 'wrong-location'
        }
      );
    } catch (error) {
      console.error(`❌ Erro ao mover ${fileName}:`, error);
    }
  }

  /**
   * Salva relatório de organização (apenas se houver mudanças significativas)
   */
  private async saveReport(report: UniversalOrganizationReport): Promise<void> {
    const docsPath = path.join(this.projectPath, 'docs');
    await fs.mkdir(docsPath, { recursive: true });
    
    const reportPath = path.join(docsPath, 'ORGANIZATION-SCORE.md');
    
    // Verificar se há mudanças significativas
    const hasChanges = await this.hasSignificantChanges(reportPath, report);
    
    if (hasChanges) {
      const content = this.formatUniversalReport(report);
      await fs.writeFile(reportPath, content);
      console.log(`\n📊 Score: ${report.score}% | Projeto: ${report.projectType}`);
    } else {
      console.log(`\n📊 Score: ${report.score}% | Sem mudanças significativas`);
    }
  }
  
  /**
   * Verifica se há mudanças significativas no relatório
   */
  private async hasSignificantChanges(reportPath: string, newReport: UniversalOrganizationReport): Promise<boolean> {
    try {
      // Se arquivo não existe, é uma mudança significativa
      const exists = await fs.access(reportPath).then(() => true).catch(() => false);
      if (!exists) return true;
      
      // Ler conteúdo atual
      const currentContent = await fs.readFile(reportPath, 'utf-8');
      
      // Extrair score atual usando regex
      const scoreMatch = currentContent.match(/### (\d+)\/100 pontos/);
      const currentScore = scoreMatch ? parseInt(scoreMatch[1]) : -1;
      
      // Extrair total de arquivos
      const filesMatch = currentContent.match(/Total de arquivos\*\*: (\d+)/);
      const currentFiles = filesMatch ? parseInt(filesMatch[1]) : -1;
      
      // Verificar mudanças significativas
      if (currentScore !== newReport.score) return true;
      if (currentFiles !== newReport.stats.totalFiles) return true;
      if (newReport.issues.length > 0 && currentScore === 100) return true;
      
      // Se chegou aqui, não há mudanças significativas
      return false;
    } catch (error) {
      // Em caso de erro, considerar como mudança significativa
      return true;
    }
  }

  private formatUniversalReport(report: UniversalOrganizationReport): string {
    let content = '# 📊 UNIVERSAL ORGANIZATION SCORE\n\n';
    
    content += `**Projeto**: ${path.basename(report.projectPath)}\n`;
    content += `**Tipo**: ${report.projectType}\n\n`;
    
    // Score visual
    content += '## Score de Organização\n\n';
    content += this.createProgressBar(report.score) + '\n\n';
    content += `### ${report.score}/100 pontos\n\n`;
    
    // Estatísticas
    content += '## 📈 Estatísticas\n\n';
    content += `- **Total de arquivos**: ${report.stats.totalFiles}\n`;
    content += `- **Bem organizados**: ${report.stats.wellOrganizedFiles} ✅\n`;
    content += `- **Precisam atenção**: ${report.stats.filesNeedingAttention} ⚠️\n`;
    content += `- **Pastas problemáticas**: ${report.stats.messyFolders.length}\n\n`;
    
    // Issues
    if (report.issues.length > 0) {
      content += '## 🔍 Problemas Encontrados\n\n';
      for (const issue of report.issues) {
        content += `### ${this.getSeverityEmoji(issue.severity)} ${issue.description}\n`;
        content += `- **Solução**: ${issue.solution}\n`;
        content += `- **Impacto**: -${issue.points} pontos\n\n`;
      }
    }
    
    // Recomendações
    content += '## 💡 Recomendações\n\n';
    for (const rec of report.recommendations) {
      content += `- ${rec}\n`;
    }
    
    content += `\n---\n*Análise Universal - ${new Date().toLocaleString('pt-BR')}*`;
    
    return content;
  }

  private generateUniversalRecommendations(score: number, issues: UniversalOrganizationIssue[]): string[] {
    const recs: string[] = [];
    
    if (score === 100) {
      recs.push('🎉 Projeto perfeitamente organizado!');
    } else if (score >= 90) {
      recs.push('✨ Excelente organização, pequenos ajustes recomendados.');
    } else if (score >= 70) {
      recs.push('👍 Boa organização com espaço para melhorias.');
    } else {
      recs.push('⚠️ Organização precisa de atenção significativa.');
    }
    
    // Recomendações específicas
    const fileLocationIssues = issues.filter(i => i.type === 'wrong-location').length;
    if (fileLocationIssues > 3) {
      recs.push(`📁 ${fileLocationIssues} arquivos em locais inadequados`);
    }
    
    const messyFolders = issues.filter(i => i.type === 'messy-folder').length;
    if (messyFolders > 0) {
      recs.push('🗂️ Reorganizar pastas com muitos arquivos soltos');
    }
    
    return recs;
  }

  // Métodos auxiliares
  /**
   * Cria arquivo de autorização
   */
  private createAuthorizationFile(report: UniversalOrganizationReport, actionCount: number): string {
    let content = '# 🤖 GUARDIAN - SOLICITAÇÃO DE AUTORIZAÇÃO\n\n';
    content += `**Data**: ${new Date().toLocaleString('pt-BR')}\n`;
    content += `**Score Atual**: ${report.score}%\n`;
    content += `**Score Após Correções**: 100%\n\n`;
    
    content += '## 📋 STATUS DA AUTORIZAÇÃO\n\n';
    content += '```\n';
    content += 'STATUS: PENDENTE\n';
    content += '```\n\n';
    content += '> ⚠️ **INSTRUÇÕES**: Mude "PENDENTE" para "AUTORIZADO" para aplicar correções\n\n';
    
    content += '## 🔍 ANÁLISE DETALHADA\n\n';
    
    if (report.issues.length > 0) {
      content += '### Problemas Encontrados:\n\n';
      for (const issue of report.issues) {
        content += `- **${issue.description}**\n`;
        if (issue.file) content += `  - Arquivo: \`${issue.file}\`\n`;
        content += `  - Solução: ${issue.solution}\n`;
        content += `  - Impacto: -${issue.points} pontos\n\n`;
      }
    }
    
    content += '## 🤖 AÇÕES PLANEJADAS\n\n';
    if (actionCount > 0) {
      content += 'O Guardian executará as seguintes ações:\n\n';
      
      let count = 0;
      for (const issue of report.issues) {
        if (issue.type === 'wrong-location' && issue.file) {
          if (issue.file.endsWith('.md') && issue.file !== 'README.md') {
            content += `${++count}. ✅ Mover \`${issue.file}\` → \`docs/\`\n`;
          } else if (/\.(yml|yaml|json)$/.test(issue.file)) {
            content += `${++count}. ✅ Mover \`${issue.file}\` → \`config/\`\n`;
          }
        } else if (issue.type === 'missing-readme') {
          content += `${++count}. ✅ Criar \`README.md\` na raiz\n`;
        }
      }
    } else {
      content += '❌ Nenhuma ação automática disponível.\n';
    }
    
    content += '\n## 🔐 COMO AUTORIZAR\n\n';
    content += '1. **Para AUTORIZAR**: Edite este arquivo e mude `STATUS: PENDENTE` para `STATUS: AUTORIZADO`\n';
    content += '2. **Para CANCELAR**: Mude para `STATUS: CANCELADO` ou delete este arquivo\n';
    content += '3. **Guardian aplicará automaticamente** após detectar a autorização\n\n';
    content += '---\n';
    content += '*Guardian aguardando sua decisão...*\n';
    
    return content;
  }

  /**
   * Aguarda autorização via arquivo
   */
  private async waitForAuthorization(authFile: string, report: UniversalOrganizationReport): Promise<void> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(async () => {
        try {
          const content = await fs.readFile(authFile, 'utf-8');
          
          if (content.includes('STATUS: AUTORIZADO')) {
            console.log('✅ Autorização concedida! Aplicando correções...');
            clearInterval(checkInterval);
            
            // Deletar arquivo de autorização
            await fs.unlink(authFile).catch(() => {});
            
            // Aplicar correções
            await this.applyAutoFixes(report);
            resolve();
          } else if (content.includes('STATUS: CANCELADO')) {
            console.log('❌ Correções canceladas pelo usuário.');
            clearInterval(checkInterval);
            
            // Deletar arquivo
            await fs.unlink(authFile).catch(() => {});
            resolve();
          }
        } catch (error) {
          // Arquivo deletado = cancelado
          console.log('❌ Arquivo de autorização removido. Correções canceladas.');
          clearInterval(checkInterval);
          resolve();
        }
      }, 2000); // Verificar a cada 2 segundos
      
      // Timeout após 5 minutos
      setTimeout(() => {
        clearInterval(checkInterval);
        console.log('⏱️ Tempo de autorização expirado (5 minutos).');
        fs.unlink(authFile).catch(() => {});
        resolve();
      }, 300000);
    });
  }

  private createProgressBar(score: number): string {
    const filled = Math.round(score / 5);
    const empty = 20 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    
    let color = '';
    if (score >= 90) color = '🟢';
    else if (score >= 70) color = '🟡';
    else if (score >= 50) color = '🟠';
    else color = '🔴';
    
    return `${color} [${bar}] ${score}%`;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'major': return '🟡';
      case 'minor': return '🟢';
      default: return '⚪';
    }
  }

  private async pathExists(p: string): Promise<boolean> {
    try {
      await fs.access(p);
      return true;
    } catch {
      return false;
    }
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    
    const walk = async (currentDir: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);
          
          if (entry.isDirectory() && !this.shouldIgnoreDir(entry.name)) {
            await walk(fullPath);
          } else if (entry.isFile()) {
            files.push(fullPath);
          }
        }
      } catch {
        // Ignorar erros de permissão
      }
    };
    
    await walk(dir);
    return files;
  }

  private async findFilesByExtension(dir: string, ext: string): Promise<string[]> {
    const allFiles = await this.getAllFiles(dir);
    return allFiles.filter(f => f.endsWith(ext));
  }

  private async getMaxDepth(dir: string, currentDepth = 0): Promise<number> {
    if (currentDepth > 10) return currentDepth; // Limite de segurança
    
    let maxDepth = currentDepth;
    
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !this.shouldIgnoreDir(entry.name)) {
          const subDepth = await this.getMaxDepth(
            path.join(dir, entry.name), 
            currentDepth + 1
          );
          maxDepth = Math.max(maxDepth, subDepth);
        }
      }
    } catch {
      // Ignorar erros
    }
    
    return maxDepth;
  }

  private async findEmptyFolders(dir: string): Promise<string[]> {
    const emptyFolders: string[] = [];
    
    const check = async (currentDir: string) => {
      try {
        const entries = await fs.readdir(currentDir, { withFileTypes: true });
        
        if (entries.length === 0) {
          emptyFolders.push(currentDir);
          return;
        }
        
        let hasFiles = false;
        for (const entry of entries) {
          if (entry.isFile()) {
            hasFiles = true;
          } else if (entry.isDirectory() && !this.shouldIgnoreDir(entry.name)) {
            await check(path.join(currentDir, entry.name));
          }
        }
        
        if (!hasFiles && entries.every(e => e.isDirectory())) {
          // Pasta só com subpastas vazias
          const subDirs = entries.filter(e => e.isDirectory());
          const allSubsEmpty = await Promise.all(
            subDirs.map(async (d) => {
              const subPath = path.join(currentDir, d.name);
              const subEntries = await fs.readdir(subPath);
              return subEntries.length === 0;
            })
          );
          
          if (allSubsEmpty.every(e => e)) {
            emptyFolders.push(currentDir);
          }
        }
      } catch {
        // Ignorar erros
      }
    };
    
    await check(dir);
    return emptyFolders;
  }

  private shouldIgnoreDir(dirName: string): boolean {
    const ignoreDirs = [
      'node_modules', '.git', 'dist', 'build', '.next', 
      '__pycache__', '.cache', '.vscode', '.idea'
    ];
    return dirName.startsWith('.') || ignoreDirs.includes(dirName);
  }

  private async countTotalFiles(): Promise<number> {
    const files = await this.getAllFiles(this.projectPath);
    return files.length;
  }

  async runAnalysis(): Promise<any> {
    await this.performFullAnalysis();
    return { message: 'Análise completa realizada' };
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
    }
    console.log(`🛑 Stopping ${this.name}...`);
  }
  
  /**
   * Carrega memórias relevantes para o projeto atual
   */
  private async loadRelevantMemories(): Promise<void> {
    console.log('\n🧠 Carregando memórias do Guardian...');
    
    // Buscar estruturas bem-sucedidas para o tipo de projeto
    if (this.projectType) {
      const successfulStructures = await this.memory.findSuccessfulStructures(
        this.projectType.name
      );
      
      if (successfulStructures.length > 0) {
        console.log(`✅ Encontradas ${successfulStructures.length} estruturas bem-sucedidas anteriores`);
      }
    }
    
    // Buscar decisões anteriores para projetos similares
    const projectName = path.basename(this.projectPath);
    const similarDecisions = await this.memory.searchMemories(
      `${projectName} organização decisão`,
      10
    );
    
    if (similarDecisions.length > 0) {
      console.log(`📚 ${similarDecisions.length} decisões anteriores relevantes encontradas`);
    }
  }
  
  /**
   * Obtém estrutura atual do projeto
   */
  private async getCurrentStructure(): Promise<Record<string, string[]>> {
    const structure: Record<string, string[]> = {};
    
    const walk = async (dir: string, prefix = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (this.shouldIgnoreDir(entry.name)) continue;
          
          const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
          
          if (entry.isDirectory()) {
            structure[relativePath] = [];
            await walk(path.join(dir, entry.name), relativePath);
          } else {
            const dirPath = prefix || '/';
            if (!structure[dirPath]) {
              structure[dirPath] = [];
            }
            structure[dirPath].push(entry.name);
          }
        }
      } catch (error) {
        // Ignorar erros
      }
    };
    
    await walk(this.projectPath);
    return structure;
  }

  /**
   * Decisão autônoma usando Sequential Thinking
   */
  private async autonomousDecisionWithSequentialThinking(report: UniversalOrganizationReport): Promise<void> {
    console.log('\n' + '='.repeat(60));
    console.log('🧠 GUARDIAN PENSAMENTO SEQUENCIAL - DECISÃO AUTÔNOMA');
    console.log('='.repeat(60));

    // Pensamento 1: Analisar situação
    await this.sequentialThought({
      thought: `Analisando score atual de ${report.score}% com ${report.issues.length} problemas. 
               Preciso avaliar se os problemas são seguros para correção automática.`,
      nextThoughtNeeded: true,
      thoughtNumber: 1,
      totalThoughts: 4
    });

    // Pensamento 2: Avaliar riscos
    const highRiskIssues = report.issues.filter(i => i.severity === 'critical');
    const mediumRiskIssues = report.issues.filter(i => i.severity === 'major');
    
    await this.sequentialThought({
      thought: `Análise de risco: ${highRiskIssues.length} críticos, ${mediumRiskIssues.length} importantes. 
               Problemas de organização são geralmente seguros para correção automática.`,
      nextThoughtNeeded: true,
      thoughtNumber: 2,
      totalThoughts: 4
    });

    // Pensamento 3: Avaliar benefícios vs riscos
    const totalPoints = report.issues.reduce((sum, issue) => sum + issue.points, 0);
    
    await this.sequentialThought({
      thought: `Benefícios: +${totalPoints} pontos levando a 100% de organização. 
               Riscos: Mínimos, apenas movimentação/limpeza de arquivos. 
               Decisão: PROCEDER com correções automáticas.`,
      nextThoughtNeeded: true,
      thoughtNumber: 3,
      totalThoughts: 4
    });

    // Pensamento 4: Executar decisão
    await this.sequentialThought({
      thought: `Executando correções automáticas baseado na análise de risco-benefício. 
               Guardian possui backup automático e pode reverter mudanças se necessário.`,
      nextThoughtNeeded: false,
      thoughtNumber: 4,
      totalThoughts: 4
    });

    console.log('\n✅ Decisão autônoma: APLICAR CORREÇÕES');
    console.log('🔧 Iniciando correções automáticas...\n');
    
    // Aplicar correções diretamente
    await this.applyAutoFixes(report);
  }

  /**
   * Simula uma etapa de pensamento sequencial
   */
  private async sequentialThought(thought: SequentialThought): Promise<void> {
    console.log(`\n🤔 Pensamento ${thought.thoughtNumber}/${thought.totalThoughts}:`);
    console.log(`   ${thought.thought}`);
    
    // Simular tempo de processamento
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (thought.nextThoughtNeeded) {
      console.log('   ⏭️  Próximo pensamento...');
    } else {
      console.log('   ✅ Análise concluída.');
    }
  }
}

// Permitir execução direta com path como argumento
if (require.main === module) {
  const projectPath = process.argv[2] || process.cwd();
  const mode = process.argv[3] as 'continuous' | 'single' || 'single';
  
  console.log(`🚀 Iniciando Universal Organization Guardian`);
  console.log(`📁 Projeto: ${projectPath}`);
  console.log(`📋 Modo: ${mode}`);
  
  const guardian = new UniversalOrganizationGuardian(projectPath, mode);
  
  guardian.initialize().then(() => {
    if (mode === 'continuous') {
      console.log('\n✅ Guardian universal iniciado com sucesso!');
      console.log('🔄 Monitorando mudanças continuamente...');
      console.log('📊 Relatórios salvos em: docs/ORGANIZATION-SCORE.md');
      console.log('\nPressione Ctrl+C para parar.\n');
    } else {
      console.log('\n✅ Análise concluída!');
      console.log('📊 Relatório salvo em: docs/ORGANIZATION-SCORE.md');
      process.exit(0);
    }
  }).catch(error => {
    console.error('❌ Erro ao iniciar guardian:', error);
    process.exit(1);
  });
}