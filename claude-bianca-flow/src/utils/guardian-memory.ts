/**
 * Guardian Memory Manager
 * 
 * Sistema de memória para o Guardian Agent
 * Armazena histórico, análises e padrões de uso
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

interface Memory {
  id: string;
  content: string;
  category: string;
  metadata?: Record<string, any>;
  tags?: string[];
  createdAt: Date;
}

export class GuardianMemoryManager {
  private memoryFile: string;
  private memories: Memory[] = [];

  constructor() {
    const memoryDir = join(process.cwd(), '.guardian');
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
    }
    
    this.memoryFile = join(memoryDir, 'memories.json');
    this.loadMemories();
  }

  /**
   * Adiciona uma nova memória
   */
  async addMemory(memory: Omit<Memory, 'id' | 'createdAt'>): Promise<void> {
    const newMemory: Memory = {
      ...memory,
      id: Date.now().toString(),
      createdAt: new Date()
    };

    this.memories.push(newMemory);
    this.saveMemories();
  }

  /**
   * Busca memórias por categoria
   */
  async searchMemories(category: string, limit: number = 10): Promise<Memory[]> {
    return this.memories
      .filter(m => m.category === category)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Busca memórias por tags
   */
  async searchByTags(tags: string[], limit: number = 10): Promise<Memory[]> {
    return this.memories
      .filter(m => m.tags && tags.some(tag => m.tags!.includes(tag)))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Busca memórias por conteúdo
   */
  async searchByContent(query: string, limit: number = 10): Promise<Memory[]> {
    const lowerQuery = query.toLowerCase();
    return this.memories
      .filter(m => m.content.toLowerCase().includes(lowerQuery))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  /**
   * Remove memórias antigas (mais de 30 dias)
   */
  async cleanupOldMemories(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const oldCount = this.memories.length;
    this.memories = this.memories.filter(m => m.createdAt > thirtyDaysAgo);
    
    if (this.memories.length < oldCount) {
      this.saveMemories();
      console.log(`🧹 Limpeza: ${oldCount - this.memories.length} memórias antigas removidas`);
    }
  }

  /**
   * Obtém estatísticas das memórias
   */
  getStats(): Record<string, any> {
    const categories = this.memories.reduce((acc, m) => {
      acc[m.category] = (acc[m.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalMemories: this.memories.length,
      categories,
      oldestMemory: this.memories.length > 0 
        ? this.memories.reduce((oldest, m) => 
            m.createdAt < oldest.createdAt ? m : oldest
          ).createdAt
        : null,
      newestMemory: this.memories.length > 0
        ? this.memories.reduce((newest, m) => 
            m.createdAt > newest.createdAt ? m : newest
          ).createdAt
        : null
    };
  }

  /**
   * Carrega memórias do arquivo
   */
  private loadMemories(): void {
    try {
      if (existsSync(this.memoryFile)) {
        const data = readFileSync(this.memoryFile, 'utf-8');
        const parsed = JSON.parse(data);
        this.memories = parsed.map((m: any) => ({
          ...m,
          createdAt: new Date(m.createdAt)
        }));
      }
    } catch (error) {
      console.warn('⚠️ Erro ao carregar memórias, iniciando com memória vazia:', error);
      this.memories = [];
    }
  }

  /**
   * Salva memórias no arquivo
   */
  private saveMemories(): void {
    try {
      writeFileSync(this.memoryFile, JSON.stringify(this.memories, null, 2));
    } catch (error) {
      console.error('❌ Erro ao salvar memórias:', error);
    }
  }
} 