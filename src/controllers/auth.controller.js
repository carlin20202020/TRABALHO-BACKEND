const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const { criarUsuario, COLUNAS_PUBLICAS } = require('./usuarios.service');

// POST /auth/registro  (público)
// Qualquer pessoa pode se cadastrar, mas SOMENTE como Aluno ou Professor.
async function registrar(req, res) {
  const usuario = await criarUsuario(req.body);
  res.status(201).json({ mensagem: 'Usuário cadastrado com sucesso.', usuario });
}

// POST /auth/login
async function login(req, res) {
  const { email, senha } = req.body || {};
  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
    throw new AppError('Informe e-mail e senha.', 400);
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select(`${COLUNAS_PUBLICAS}, senha_hash`)
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();
  verificar(error);

  // Mesma mensagem para e-mail inexistente e senha errada (não revela quais e-mails existem)
  const senhaConfere = data ? await bcrypt.compare(senha, data.senha_hash) : false;
  if (!data || !senhaConfere) throw new AppError('E-mail ou senha inválidos.', 401);

  const token = jwt.sign({ id: data.id, perfil: data.perfil }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const { senha_hash, ...usuario } = data;
  res.json({ mensagem: 'Login realizado com sucesso.', token, usuario });
}

// GET /auth/me  (dados de quem está logado)
async function perfil(req, res) {
  res.json({ usuario: req.usuario });
}

module.exports = { registrar, login, perfil };
