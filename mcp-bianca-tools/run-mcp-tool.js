#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get the directory of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const toolName = process.argv[2];
  const argsJson = process.argv[3];

  if (!toolName) {
    console.error('Usage: node run-mcp-tool.js <tool-name> [json-args]');
    console.error('Example: node run-mcp-tool.js list-tools');
    console.error('Example: node run-mcp-tool.js puppeteer_navigate \'{"url": "https://google.com"}\'');
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: 'node',
    args: [path.join(__dirname, 'build', 'index.js')],
    cwd: __dirname,
  });

  const client = new Client({
    name: 'transient-cli-client',
    version: '1.0.0',
  });

  try {
    await client.connect(transport);

    let result;
    if (toolName === 'list-tools') {
      result = await client.listTools();
    } else {
      let params = {};
      if (argsJson) {
        try {
          params = JSON.parse(argsJson);
        } catch (e) {
          console.error('Error: Invalid JSON arguments provided.', e);
          process.exit(1);
        }
      }
      result = await client.callTool({
        name: toolName,
        arguments: params,
      });
    }

    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    if (client) {
      await client.close();
    }
    if (transport) {
        transport.close();
    }
  }
}

main(); 