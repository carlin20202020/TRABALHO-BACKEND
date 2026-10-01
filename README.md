# SGOA — Sistema de Gestão de Ocorrências e Ativos Escolares
Colégio Estadual Dr. Gilberto Alves do Nascimento — Piraquara/PR

API REST (Node.js + Express + Supabase) com site (HTML/CSS/JS) para abrir, acompanhar e resolver chamados
sobre equipamentos e salas do colégio.

## Requisitos
- Node.js 20 ou superior · um projeto no Supabase (banco + Storage)

## Como rodar
```bash
npm install
# abra o arquivo .env e cole a SUPABASE_SECRET_KEY (a URL já vem preenchida)
npm run seed        # cria o administrador, um professor, um aluno, salas e equipamentos de demonstração
npm run dev         # abra http://localhost:3000
```
Antes: rode o `database/schema.sql` no **SQL Editor** do Supabase (cria/atualiza tabelas e o bucket `ocorrencias`).
Pode rodar mais de uma vez. Passo a passo completo: `docs/PASSO_A_PASSO_GITHUB_SUPABASE.md`.
Para abrir em outro aparelho **na mesma rede Wi-Fi**: `http://IP-DO-SEU-PC:3000`.

## Perfis e permissões
Existem apenas 3 perfis, e **só pode existir 1 Administrador** (garantido por índice único no banco e bloqueado na API).

| Ação | Aluno | Professor | Administrador |
|---|---|---|---|
| Ver chamados | só os **ativos** | só os **seus** | todos |
| Abrir chamado | ❌ | ✅ | ✅ |
| Comentar / conversar no chamado | ✅ (nos ativos) | ✅ (nos seus) | ✅ (em todos) |
| Editar, excluir, iniciar, **resolver** e reabrir chamado | ❌ | ❌ | ✅ |
| Criar, editar e excluir **salas** e **equipamentos** | ❌ | ❌ | ✅ |
| Ver lista de contas, criar/editar/excluir usuários | ❌ | ❌ | ✅ |
| **Redefinir a senha** de qualquer conta (gera senha temporária) | ❌ | ❌ | ✅ |
| Alterar a própria senha e dados | ✅ | ✅ | ✅ |

> **Senhas:** são guardadas com *hash* (bcrypt), de mão única. Ninguém consegue "ver" uma senha, nem o administrador.
> O administrador resolve esquecimentos com **Redefinir senha**, que mostra uma senha temporária uma única vez.

## Contas de demonstração (senha: `Senha@123`)
| Perfil | E-mail |
|---|---|
| Administrador | admin@escola.pr.gov.br |
| Professor | professor@escola.pr.gov.br |
| Aluno | aluno@escola.pr.gov.br |

## Regras de negócio obrigatórias
| # | Regra | Onde está |
|---|---|---|
| 1 | Matrícula (CGM/RA) no padrão estadual | `src/utils/validators.js` → `validarMatricula` |
| 2 | "Hardware Quebrado" exige foto (Supabase Storage) | `src/controllers/ocorrencias.controller.js` → `criar` |
| 3 | Prioridade automática: Professor = Alta, demais = Média | `ocorrencias.controller.js` → `definirPrioridade` |
| 4 | Só resolve informando o Nº de Patrimônio | `ocorrencias.controller.js` → `atualizarStatus` |

As regras 2 e 4 também são protegidas por `CHECK` no banco.

## Rotas
| Método | Rota | Quem acessa |
|---|---|---|
| POST | `/auth/registro` | Público (só Aluno/Professor) |
| POST | `/auth/login` · GET `/auth/me` | Público · logado |
| GET/POST | `/usuarios` | Administrador |
| GET/PUT | `/usuarios/:id` | Próprio usuário ou Administrador |
| POST | `/usuarios/:id/redefinir-senha` | Administrador |
| DELETE | `/usuarios/:id` | Administrador |
| GET | `/salas` · `/equipamentos` · `/equipamentos/:id` | Logado |
| POST/PUT/DELETE | `/salas` `/salas/:id` · `/equipamentos` `/equipamentos/:id` | Administrador |
| GET | `/dashboard` | Logado (dados conforme o perfil) |
| POST | `/ocorrencias` (multipart: `titulo`, `descricao`, `categoria`, `equipamento_id`, `foto`) | Professor, Administrador |
| GET | `/ocorrencias` · `/ocorrencias/:id` | Conforme a tabela de permissões |
| PUT / DELETE | `/ocorrencias/:id` | Administrador |
| PATCH | `/ocorrencias/:id/status` | Administrador |
| GET/POST | `/ocorrencias/:id/comentarios` | Quem pode ver o chamado |

## Códigos de erro
`400` dados inválidos · `401` sem token/token inválido · `403` perfil sem permissão · `404` não encontrado ·
`409` conflito (duplicado, vínculo existente, 2º administrador) · `413` foto > 5 MB · `503` banco indisponível · `500` erro interno.
(401 = não autenticado; 403 = autenticado, mas sem permissão.)

## Estrutura
```
public/          site: index.html, css/style.css, js/app.js, img/logo.png
src/
  config/        env.js, supabase.js
  middlewares/   auth.js, upload.js, validarId.js, errorHandler.js
  controllers/   auth, usuarios, salas, equipamentos, ocorrencias, comentarios
  routes/        index.js
  utils/         AppError, asyncHandler, erroBanco, validators
database/schema.sql     scripts/seed.js     docs/
```
