// Usuários. Perfis: Aluno, Professor e Administrador (existe apenas UM administrador).
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const { ehAdmin } = require('../middlewares/auth');
const { PERFIS, normalizarOpcao, lerPaginacao } = require('../utils/validators');
const { COLUNAS_PUBLICAS, validarDadosUsuario, criarUsuario } = require('./usuarios.service');

// POST /usuarios (Administrador) - cria Aluno ou Professor
async function criar(req, res) {
  const usuario = await criarUsuario(req.body);
  res.status(201).json({ mensagem: 'Usuário criado com sucesso.', usuario });
}

// GET /usuarios (Administrador) - filtros: ?perfil=Aluno&busca=maria
async function listar(req, res) {
  const { de, ate, pagina, limite } = lerPaginacao(req.query);
  let consulta = supabase.from('usuarios').select(COLUNAS_PUBLICAS).order('nome').range(de, ate);

  if (req.query.perfil) {
    const perfil = normalizarOpcao(req.query.perfil, PERFIS);
    if (!perfil) throw new AppError(`Filtro perfil inválido. Use: ${PERFIS.join(', ')}.`, 400);
    consulta = consulta.eq('perfil', perfil);
  }
  if (typeof req.query.busca === 'string' && req.query.busca.trim()) {
    const termo = req.query.busca.trim().replace(/[,()%*]/g, ' ');
    consulta = consulta.or(`nome.ilike.%${termo}%,email.ilike.%${termo}%`);
  }

  const { data, error } = await consulta;
  verificar(error);
  res.json({ pagina, limite, total: data.length, usuarios: data });
}

// Aluno/Professor só enxergam e alteram o PRÓPRIO cadastro
function checarAcesso(req, idAlvo) {
  if (!ehAdmin(req.usuario) && req.usuario.id !== idAlvo) {
    throw new AppError('Você só tem acesso ao seu próprio cadastro.', 403);
  }
}

// GET /usuarios/:id
async function buscar(req, res) {
  checarAcesso(req, req.params.id);
  const { data, error } = await supabase.from('usuarios').select(COLUNAS_PUBLICAS).eq('id', req.params.id).maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Usuário não encontrado.', 404);
  res.json({ usuario: data });
}

// PUT /usuarios/:id - atualização parcial (próprio usuário ou Administrador)
async function atualizar(req, res) {
  const id = req.params.id;
  const souAdmin = ehAdmin(req.usuario);
  if (!souAdmin && req.usuario.id !== id) throw new AppError('Você só pode alterar o seu próprio cadastro.', 403);

  const dados = validarDadosUsuario(req.body || {}, { parcial: true });

  if (dados.perfil) {
    if (!souAdmin) throw new AppError('Somente o Administrador pode alterar o perfil de um usuário.', 403);
    if (dados.perfil === 'Administrador') throw new AppError('Só pode existir uma conta de Administrador no sistema.', 403);
    if (id === req.usuario.id) throw new AppError('O perfil do Administrador não pode ser alterado.', 403);
  }
  if (dados.senha) {
    dados.senha_hash = await bcrypt.hash(dados.senha, 10);
    delete dados.senha;
  }
  if (Object.keys(dados).length === 0) throw new AppError('Nenhum campo válido para atualizar foi enviado.', 400);

  const { data, error } = await supabase.from('usuarios').update(dados).eq('id', id).select(COLUNAS_PUBLICAS).maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Usuário não encontrado.', 404);
  res.json({ mensagem: 'Usuário atualizado com sucesso.', usuario: data });
}

// POST /usuarios/:id/redefinir-senha (Administrador)
// As senhas são guardadas só como hash (ninguém consegue lê-las). O que o admin pode fazer é
// gerar uma senha temporária nova: ela é mostrada UMA vez, para ser entregue ao usuário.
async function redefinirSenha(req, res) {
  const senhaTemporaria = randomBytes(9).toString('base64url'); // 12 caracteres
  const senha_hash = await bcrypt.hash(senhaTemporaria, 10);
  const { data, error } = await supabase
    .from('usuarios').update({ senha_hash }).eq('id', req.params.id).select('id, nome, email').maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Usuário não encontrado.', 404);
  res.json({ mensagem: 'Senha redefinida. Entregue a senha temporária ao usuário (ela não será exibida de novo).', usuario: data, senhaTemporaria });
}

// DELETE /usuarios/:id (Administrador)
async function remover(req, res) {
  if (req.usuario.id === req.params.id) throw new AppError('O Administrador não pode excluir a própria conta.', 400);
  const { data, error } = await supabase.from('usuarios').delete().eq('id', req.params.id).select('id').maybeSingle();
  if (error && error.code === '23503') {
    throw new AppError('Este usuário possui ocorrências ou comentários. Exclua esses registros antes de excluir a conta.', 409);
  }
  verificar(error);
  if (!data) throw new AppError('Usuário não encontrado.', 404);
  res.json({ mensagem: 'Usuário excluído com sucesso.' });
}

module.exports = { criar, listar, buscar, atualizar, redefinirSenha, remover };
