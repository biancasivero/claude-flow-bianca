/**
 * Simple logger utility
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  forTool(toolName: string): Logger;
}

class SimpleLogger implements Logger {
  constructor(private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${new Date().toISOString()}] [DEBUG]`, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${new Date().toISOString()}] [INFO]`, message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${new Date().toISOString()}] [WARN]`, message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${new Date().toISOString()}] [ERROR]`, message, ...args);
    }
  }

  forTool(toolName: string): Logger {
    return new ToolLogger(toolName, this.level);
  }
}

class ToolLogger implements Logger {
  constructor(private toolName: string, private level: LogLevel = LogLevel.INFO) {}

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(`[${new Date().toISOString()}] [DEBUG] [${this.toolName}]`, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      console.info(`[${new Date().toISOString()}] [INFO] [${this.toolName}]`, message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(`[${new Date().toISOString()}] [WARN] [${this.toolName}]`, message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      console.error(`[${new Date().toISOString()}] [ERROR] [${this.toolName}]`, message, ...args);
    }
  }

  forTool(toolName: string): Logger {
    return new ToolLogger(`${this.toolName}:${toolName}`, this.level);
  }
}

export const logger = new SimpleLogger();

export function replaceConsoleWithLogger(): void {
  // Não substituir console para evitar loops infinitos
  // O logger já usa console diretamente
} 