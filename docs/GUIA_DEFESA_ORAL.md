# Guia para a Defesa Oral (arguição)

O professor vai escolher um integrante e pedir: *"Explique como esta função funciona."*
Leia cada seção, abra o arquivo indicado e acompanhe o código linha a linha. Todos devem conseguir explicar TODAS as regras.

## 1. Visão geral (a pergunta mais provável)
- **Node.js + Express** recebe as requisições HTTP. **Supabase** guarda os dados (PostgreSQL) e as fotos (Storage).
- Fluxo de uma requisição: `routes/index.js` → middlewares (`autenticar`, `exigirPerfil`, `upload`) → **controller** → Supabase → resposta JSON.
- Se algo dá errado, o controller faz `throw new AppError(mensagem, status)`; o `asyncHandler` entrega o erro ao `errorHandler.js`, que responde com o status certo. Por isso a API não "quebra".

## 2. Autenticação e perfis (`middlewares/auth.js`, `auth.controller.js`)
- **Cadastro**: a senha nunca é guardada; guardamos o *hash* gerado pelo `bcrypt` (`bcrypt.hash(senha, 10)`).
- **Login**: `bcrypt.compare` confere a senha; se estiver certa, `jwt.sign` cria um token com id e perfil, válido por 8 h.
- **`autenticar`**: lê `Authorization: Bearer <token>`, valida com `jwt.verify`, busca o usuário no banco e coloca em `req.usuario`.
- **`exigirPerfil('Administrador')`**: bloqueia com **403** quem não tem o perfil. **401** = não está autenticado; **403** = está autenticado, mas sem permissão.
- Existem 3 perfis (Aluno, Professor, Administrador) e **só 1 Administrador**: índice único parcial no banco (`ux_um_administrador`) + bloqueio na API.
- **Por que o admin não vê as senhas?** Guardamos só o hash (bcrypt, mão única). Guardar senha legível seria uma falha grave de segurança. O admin usa `POST /usuarios/:id/redefinir-senha`, que gera uma senha temporária mostrada uma vez.
- Cada perfil tem a sua visão: Aluno vê só chamados ativos e comenta; Professor abre e vê só os seus; Administrador faz tudo (`podeVer` em `ocorrencias.controller.js`).

## 3. REGRA 1 — Matrícula (`utils/validators.js` → `validarMatricula`)
- Remove pontos, traços e espaços e testa o que sobrou contra uma **expressão regular** (`MATRICULA_REGEX`, no `.env`; padrão: 8 a 10 dígitos).
- É chamada em `usuarios.service.js` → `validarDadosUsuario`, tanto no cadastro quanto na atualização. Inválida → **400**.
- Além disso, o banco tem `unique` na matrícula: duplicada → erro `23505` → traduzido para **409** em `utils/erroBanco.js`.

## 4. REGRA 2 — Foto obrigatória (`ocorrencias.controller.js` → `criar`)
1. O `multer` (`middlewares/upload.js`) lê o campo `foto` do formulário e deixa o arquivo na memória (`req.file`).
2. No controller: `if (categoria === 'Hardware Quebrado' && !arquivo)` → **400**, **antes de gravar qualquer coisa**.
3. `detectarImagem` confere os primeiros bytes do arquivo (assinatura JPG/PNG/WEBP), para não aceitar um arquivo qualquer com nome `.png`.
4. `supabase.storage.from(bucket).upload(caminho, buffer)` envia a foto; `getPublicUrl` gera o link salvo em `foto_url`.
5. Se o `insert` da ocorrência falhar depois do upload, o código **apaga a foto** (`remove`) para não sobrar lixo no Storage.
6. O banco também garante a regra: `constraint ck_hardware_exige_foto`.

## 5. REGRA 3 — Prioridade automática (`definirPrioridade`)
- `perfil === 'Professor' ? 'Alta Prioridade' : 'Média Prioridade'`.
- O perfil vem de `req.usuario` (do token/banco), **nunca do corpo da requisição**. Mesmo que o cliente mande `"prioridade": "Alta Prioridade"`, o campo é ignorado.
- O Administrador que abrir chamado fica com "Média Prioridade" (decisão do grupo). Aluno não abre chamado.

## 6. REGRA 4 — Fechamento (`ocorrencias.controller.js` → `atualizarStatus`)
- Rota `PATCH /ocorrencias/:id/status`, só o Administrador.
- Se `status === 'Resolvido'` e não vier `numero_patrimonio` (ou vier num formato inválido) → **400**, e nada é alterado.
- Se der certo, grava `numero_patrimonio_resolvido`, `resolvido_em` e `tecnico_id`.
- O administrador pode reabrir um chamado resolvido (os dados do fechamento são limpos). Banco: `constraint ck_resolvido_exige_patrimonio`.

## 7. "Como esta função salva no Supabase?" — exemplo
```js
const { data, error } = await supabase
  .from('ocorrencias')        // tabela
  .insert({ ... })            // grava o registro
  .select(SELECT_COMPLETO)    // pede o registro de volta (com usuário e equipamento)
  .single();                  // esperamos exatamente 1 linha
verificar(error);             // se houve erro, converte em AppError com o status certo
```
O Supabase **não lança exceção**: devolve `{ data, error }`. Por isso existe o `verificar(error)`.

## 8. Perguntas que costumam cair
- **Por que a chave secreta do Supabase e não a pública?** O backend controla as permissões; o RLS está ligado sem políticas, então a chave pública não acessa nada. A chave secreta fica só no `.env` (que está no `.gitignore`).
- **Por que `asyncHandler`?** Sem ele, um erro dentro de `async` poderia deixar a requisição sem resposta (timeout).
- **Por que UUID nos ids?** Não é sequencial (não dá para "adivinhar" o próximo) e o Supabase gera automaticamente.
- **O que é `bcrypt`/JWT?** Hash de senha de mão única / token assinado que prova quem é o usuário sem consultar a senha de novo.
- **Por que validar no Node e no banco?** Defesa em profundidade: se alguém acessar o banco por outro caminho, as regras principais continuam valendo.
- **O que acontece com o Supabase fora do ar?** As chamadas têm limite de 15 s (`config/supabase.js`) e a API responde **503**.
