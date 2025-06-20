/**
 * Zod schemas for input validation
 */

import { z } from 'zod';
import { ToolName } from './types.js';

// ==================== Puppeteer Schemas ====================

export const NavigateSchema = z.object({
  url: z.string().url('URL deve ser válida')
});

export const ScreenshotSchema = z.object({
  path: z.string().min(1, 'Path é obrigatório'),
  fullPage: z.boolean().optional().default(false)
});

export const ClickSchema = z.object({
  selector: z.string().min(1, 'Selector é obrigatório')
});

export const TypeSchema = z.object({
  selector: z.string().min(1, 'Selector é obrigatório'),
  text: z.string().min(1, 'Text é obrigatório')
});

export const GetContentSchema = z.object({});

export const NewTabSchema = z.object({
  url: z.string().url('URL deve ser válida')
});

// ==================== Browser Schemas ====================

export const OpenBrowserSchema = z.object({
  url: z.string().url('URL deve ser válida')
});

export const BrowserOpenUrlSchema = z.object({
  url: z.string().url('URL deve ser válida'),
  browser: z.enum(['default', 'chrome', 'safari', 'firefox']).optional().default('default')
});

// ==================== Agents Schemas ====================

export const AgentsListSchema = z.object({
  path: z.string().optional(),
  filter: z.object({
    type: z.enum(['researcher', 'implementer', 'analyst', 'coordinator', 'custom']).optional(),
    name: z.string().optional(),
    hasTools: z.array(z.string()).optional()
  }).optional()
});

export const AgentsGetDetailsSchema = z.object({
  agentFile: z.string().min(1, 'Nome do arquivo é obrigatório'),
  agentName: z.string().optional()
});

export const AgentsAnalyzeSchema = z.object({
  agentFile: z.string().min(1, 'Nome do arquivo é obrigatório'),
  analysisType: z.enum(['dependencies', 'tools', 'structure', 'usage'])
});

export const AgentsSearchSchema = z.object({
  query: z.string().min(1, 'Query de busca é obrigatória'),
  path: z.string().optional()
});

// ==================== Schema Map ====================

export const ToolSchemas = {
  [ToolName.PUPPETEER_NAVIGATE]: NavigateSchema,
  [ToolName.PUPPETEER_SCREENSHOT]: ScreenshotSchema,
  [ToolName.PUPPETEER_CLICK]: ClickSchema,
  [ToolName.PUPPETEER_TYPE]: TypeSchema,
  [ToolName.PUPPETEER_GET_CONTENT]: GetContentSchema,
  [ToolName.PUPPETEER_NEW_TAB]: NewTabSchema,
  [ToolName.OPEN_BROWSER]: OpenBrowserSchema,
  [ToolName.BROWSER_OPEN_URL]: BrowserOpenUrlSchema,
  [ToolName.AGENTS_LIST]: AgentsListSchema,
  [ToolName.AGENTS_GET_DETAILS]: AgentsGetDetailsSchema,
  [ToolName.AGENTS_ANALYZE]: AgentsAnalyzeSchema,
  [ToolName.AGENTS_SEARCH]: AgentsSearchSchema
} as const;

// ==================== Validation Helper ====================

export function validateToolInput<T extends ToolName>(
  toolName: T,
  input: unknown
): z.infer<typeof ToolSchemas[T]> {
  const schema = ToolSchemas[toolName];
  
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      throw new Error(`Validação falhou:\n${messages.join('\n')}`);
    }
    throw error;
  }
}

// ==================== Type Inference Helpers ====================

export type InferToolInput<T extends ToolName> = z.infer<typeof ToolSchemas[T]>;