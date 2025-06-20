#!/bin/bash

# Script para testar navegação no eKyte
# Executa o agente de teste simples

echo "🎯 Iniciando teste do eKyte Navigator..."
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ Execute este script a partir do diretório claude-bianca-flow"
    exit 1
fi

# Verificar se o MCP BiancaTools está compilado
if [ ! -f "../mcp-bianca-tools/build/index.js" ]; then
    echo "⚠️ MCP BiancaTools não está compilado. Compilando..."
    cd ../mcp-bianca-tools
    npm run build
    cd ../claude-bianca-flow
fi

# Executar o teste
echo "🚀 Executando teste do eKyte..."
npx tsx src/agents/ekyte-simple-test.ts

echo ""
echo "✅ Teste concluído!"
echo "📁 Verifique os resultados em: ../ekyte/"
echo "   - Screenshots: ../ekyte/screenshots/"
echo "   - Dados: ../ekyte/data/" 