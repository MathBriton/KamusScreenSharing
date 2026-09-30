# AGENTS.md

Instruções para agentes de código (Codex e outros). O Claude Code lê o `CLAUDE.md` diretamente.

1. Leia **`CLAUDE.md`**: especificação do projeto, arquitetura, comandos e convenções.
2. Leia **`MEMORY.md`**: estado atual, decisões, armadilhas e o histórico recente.
3. Antes de concluir, rode `npm run typecheck` e `npm run test:e2e` (use `PW_CHROMIUM_PATH` se o
   navegador do Playwright não estiver instalado).
4. Ao terminar a sessão, **atualize o `MEMORY.md`** (estado atual, próximos passos e uma entrada no
   histórico indicando a ferramenta usada).

Interface, mensagens e comentários em português (pt-BR).
