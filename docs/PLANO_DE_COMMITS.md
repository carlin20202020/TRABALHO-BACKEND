# Plano de commits por Sprint (4 integrantes)

**Regra de ouro:** o professor avalia frequência e participação de TODOS. Suba o projeto **aos poucos, sprint por sprint**,
cada integrante fazendo commits das partes que vai defender. Nunca suba tudo de uma vez.
Cada integrante deve **ler e entender** a sua parte antes de commitar (veja `GUIA_DEFESA_ORAL.md`).

Sugestão de fluxo: cada pessoa trabalha em uma branch (`git checkout -b feature/nome`), faz commits pequenos,
dá `git push` e abre um Pull Request para a `main`; outro integrante revisa e aprova.

| Sprint | Integrante | O que commitar | Mensagens sugeridas |
|---|---|---|---|
| 1 | Membro 1 | `package.json`, `.gitignore`, `.env.example`, `README.md` | `chore: inicia projeto Node.js com Express` / `docs: adiciona README inicial` |
| 1 | Membro 2 | `database/schema.sql` | `feat(db): cria tabelas usuarios, equipamentos, ocorrencias e comentarios` |
| 1 | Membro 3 | `docs/DER.md` | `docs: adiciona diagrama entidade-relacionamento` |
| 1 | Membro 4 | `src/config/env.js`, `src/app.js`, `src/server.js` (versão básica) | `feat: cria servidor Express e rota de saúde` |
| 2 | Membro 1 | `src/config/supabase.js`, `scripts/seed.js` | `feat: conecta Node.js ao Supabase` / `feat: script de seed` |
| 2 | Membro 2 | `middlewares/auth.js`, `controllers/auth.controller.js` | `feat(auth): login com JWT e middleware de perfil` |
| 2 | Membro 3 | `usuarios.service.js`, `usuarios.controller.js`, `validators.js` (matrícula) | `feat(usuarios): CRUD e validação de matrícula CGM/RA` |
| 2 | Membro 4 | `equipamentos.controller.js` | `feat(equipamentos): CRUD restrito ao Administrador` |
| 3 | Membro 1 | `ocorrencias.controller.js` (função `criar` sem foto) | `feat(ocorrencias): POST /ocorrencias com vínculos` |
| 3 | Membro 2 | `definirPrioridade` + `listar`/`buscar` | `feat(ocorrencias): prioridade automática Professor/Aluno` |
| 3 | Membro 3 | `comentarios.controller.js` | `feat(comentarios): comentar e listar em ocorrências` |
| 3 | Membro 4 | `routes/index.js` | `feat: registra todas as rotas` |
| 4 | Membro 1 | `middlewares/upload.js`, `detectarImagem` | `feat(upload): recebe foto com multer` |
| 4 | Membro 2 | envio ao Storage + regra "Hardware Quebrado" em `criar` | `feat(storage): upload no Supabase e foto obrigatória` |
| 4 | Membro 3 | `atualizarStatus` | `feat(ocorrencias): PATCH de status` |
| 4 | Membro 4 | regra do patrimônio em `atualizarStatus` | `feat: exige número de patrimônio para resolver` |
| 5 | Membro 1 | `middlewares/errorHandler.js`, `AppError`, `asyncHandler` | `feat: tratamento global de erros` |
| 5 | Membro 2 | `utils/erroBanco.js`, `middlewares/validarId.js`, limite de tempo no Supabase | `fix: códigos HTTP corretos e timeout` |
| 5 | Membro 3 | `docs/SGOA.postman_collection.json` | `docs: coleção de testes Postman/Insomnia` |
| 5 | Membro 4 | `README.md` final, `docs/GUIA_DEFESA_ORAL.md` | `docs: README final e guia de defesa` |

Os arquivos já vêm completos no projeto: ao commitar uma parte, você está registrando o código que você mesmo revisou e vai explicar.

## Extras (depois da Sprint 5, se o professor permitir)
| Integrante | O que commitar | Mensagem sugerida |
|---|---|---|
| Membro 1 | `public/` (site) | `feat(site): interface web do sistema` |
| Membro 2 | `salas.controller.js` + rotas de salas | `feat(salas): CRUD de salas (admin)` |
| Membro 3 | `ocorrencias.controller.js` (`editar`, `remover`) | `feat: admin edita e exclui chamados` |
| Membro 4 | `usuarios.controller.js` (`redefinirSenha`) | `feat: admin redefine senha de usuários` |
