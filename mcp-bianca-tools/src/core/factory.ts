/**
 * Factory pattern for tool creation in BiancaTools
 */

import { ToolName, ToolDefinition } from './types.js';
import { ToolSchemas } from './schemas.js';
import {
  handleNavigate,
  handleScreenshot,
  handleClick,
  handleType,
  handleGetContent
} from './handlers.js';

// ==================== Tool Registry ====================

interface ToolConfig {
  name: ToolName;
  description: string;
  handler: (args: any) => Promise<any>;
  schema?: any;
  metadata?: {
    isReadOnly?: boolean;
    isDestructive?: boolean;
    requiresAuth?: boolean;
    category?: 'puppeteer' | 'github' | 'utility';
  };
}

export class ToolFactory {
  private static tools = new Map<ToolName, ToolConfig>();
  
  /**
   * Register a new tool
   */
  static register(config: ToolConfig): void {
    this.tools.set(config.name, config);
  }
  
  /**
   * Create a tool definition
   */
  static create(name: ToolName): ToolDefinition | null {
    const config = this.tools.get(name);
    if (!config) return null;
    
    const schema = config.schema || ToolSchemas[name];
    
    return {
      name: config.name,
      description: config.description,
      inputSchema: {
        type: 'object',
        properties: this.schemaToProperties(schema),
        required: this.getRequiredFields(schema)
      },
      handler: config.handler
    };
  }
  
  /**
   * Get all registered tools
   */
  static getAll(): ToolDefinition[] {
    return Array.from(this.tools.keys())
      .map(name => this.create(name))
      .filter((tool): tool is ToolDefinition => tool !== null);
  }
  
  /**
   * Get tools by category
   */
  static getByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.entries())
      .filter(([_, config]) => config.metadata?.category === category)
      .map(([name, _]) => this.create(name))
      .filter((tool): tool is ToolDefinition => tool !== null);
  }
  
  /**
   * Convert Zod schema to JSON Schema properties
   */
  private static schemaToProperties(schema: any): Record<string, any> {
    if (!schema || !schema._def) return {};
    
    const shape = schema._def.shape?.() || {};
    const properties: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = this.zodToJsonSchema(value as any);
    }
    
    return properties;
  }
  
  /**
   * Get required fields from Zod schema
   */
  private static getRequiredFields(schema: any): string[] {
    if (!schema || !schema._def) return [];
    
    const shape = schema._def.shape?.() || {};
    const required: string[] = [];
    
    for (const [key, value] of Object.entries(shape)) {
      const zodSchema = value as any;
      if (!zodSchema.isOptional()) {
        required.push(key);
      }
    }
    
    return required;
  }
  
  /**
   * Convert Zod type to JSON Schema
   */
  private static zodToJsonSchema(zod: any): any {
    const typeName = zod._def.typeName;
    
    switch (typeName) {
      case 'ZodString':
        return { type: 'string' };
      case 'ZodNumber':
        return { type: 'number' };
      case 'ZodBoolean':
        return { type: 'boolean' };
      case 'ZodArray':
        return {
          type: 'array',
          items: this.zodToJsonSchema(zod._def.type)
        };
      case 'ZodEnum':
        return {
          type: 'string',
          enum: zod._def.values
        };
      case 'ZodOptional':
        return this.zodToJsonSchema(zod._def.innerType);
      default:
        return { type: 'string' };
    }
  }
}

// ==================== Register Built-in Tools ====================

// Puppeteer Tools
ToolFactory.register({
  name: ToolName.PUPPETEER_NAVIGATE,
  description: 'Navigate to a URL',
  handler: handleNavigate,
  metadata: {
    category: 'puppeteer',
    isReadOnly: false,
    requiresAuth: false
  }
});

ToolFactory.register({
  name: ToolName.PUPPETEER_SCREENSHOT,
  description: 'Take a screenshot of the current page',
  handler: handleScreenshot,
  metadata: {
    category: 'puppeteer',
    isReadOnly: true,
    requiresAuth: false
  }
});

ToolFactory.register({
  name: ToolName.PUPPETEER_CLICK,
  description: 'Click on an element',
  handler: handleClick,
  metadata: {
    category: 'puppeteer',
    isReadOnly: false,
    requiresAuth: false
  }
});

ToolFactory.register({
  name: ToolName.PUPPETEER_TYPE,
  description: 'Type text into an element',
  handler: handleType,
  metadata: {
    category: 'puppeteer',
    isReadOnly: false,
    requiresAuth: false
  }
});

ToolFactory.register({
  name: ToolName.PUPPETEER_GET_CONTENT,
  description: 'Get the HTML content of the current page',
  handler: handleGetContent,
  metadata: {
    category: 'puppeteer',
    isReadOnly: true,
    requiresAuth: false
  }
});
