// Lógica de usuários compartilhada entre o cadastro público (/auth/registro)
// e o cadastro feito pelo administrador (POST /usuarios).
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const {
  PERFIS, normalizarOpcao, textoValido, emailValido, validarMatricula,
} = require('../utils/validators');

// Colunas que podem ser devolvidas ao cliente (NUNCA inclui senha_hash)
const COLUNAS_PUBLICAS = 'id, nome, email, matricula, perfil, criado_em';

// Valida os dados de um usuário. Se "parcial" for true (atualização), só valida o que veio.
function validarDadosUsuario(body, { parcial = false } = {}) {
  const erros = [];
  const dados = {};
  const veio = (campo) => body[campo] !== undefined;

  if (!parcial || veio('nome')) {
    if (!textoValido(body.nome, 3, 100)) erros.push('nome: informe entre 3 e 100 caracteres.');
    else dados.nome = body.nome.trim();
  }
  if (!parcial || veio('email')) {
    if (!emailValido(body.email)) erros.push('email: formato inválido.');
    else dados.email = body.email.trim().toLowerCase();
  }
  if (!parcial || veio('senha')) {
    if (typeof body.senha !== 'string' || body.senha.length < 8) erros.push('senha: mínimo de 8 caracteres.');
    else dados.senha = body.senha;
  }
  // REGRA DE NEGÓCIO 1: matrícula no padrão estadual
  if (!parcial || veio('matricula')) {
    const matricula = validarMatricula(body.matricula);
    if (!matricula) erros.push('matricula: fora do padrão estadual (CGM/RA). Confira o número informado.');
    else dados.matricula = matricula;
  }
  if (!parcial || veio('perfil')) {
    const perfil = normalizarOpcao(body.perfil, PERFIS);
    if (!perfil) erros.push(`perfil: use um destes valores: ${PERFIS.join(', ')}.`);
    else dados.perfil = perfil;
  }

  if (erros.length > 0) throw new AppError('Dados inválidos.', 400, erros);
  return dados;
}

// Valida, gera o hash da senha e grava o usuário no Supabase.
async function criarUsuario(body) {
  const dados = validarDadosUsuario(body || {});

  // REGRA: só existe UMA conta de Administrador (criada pelo seed). Ninguém cria outra pela API.
  if (dados.perfil === 'Administrador') {
    throw new AppError('Só pode existir uma conta de Administrador no sistema.', 403);
  }

  const senha_hash = await bcrypt.hash(dados.senha, 10);
  delete dados.senha;

  const { data, error } = await supabase
    .from('usuarios')
    .insert({ ...dados, senha_hash })
    .select(COLUNAS_PUBLICAS)
    .single();
  verificar(error);
  return data;
}

module.exports = { COLUNAS_PUBLICAS, validarDadosUsuario, criarUsuario };
