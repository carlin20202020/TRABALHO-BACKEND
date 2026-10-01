// Autenticação (quem é você?) e autorização por perfil (o que você pode fazer?).
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');
const { JWT_SECRET } = require('../config/env');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const asyncHandler = require('../utils/asyncHandler');

// Lê o cabeçalho "Authorization: Bearer <token>", valida o token e carrega o usuário
// do banco em req.usuario. Buscar no banco garante que um usuário excluído, ou que teve
// o perfil alterado, seja tratado corretamente já na próxima requisição.
const autenticar = asyncHandler(async (req, res, next) => {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo !== 'Bearer' || !token) {
    throw new AppError('Token de autenticação não informado. Use: Authorization: Bearer <token>', 401);
  }

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (erro) {
    const mensagem = erro.name === 'TokenExpiredError' ? 'Token expirado. Faça login novamente.' : 'Token inválido.';
    throw new AppError(mensagem, 401);
  }

  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, matricula, perfil')
    .eq('id', payload.id)
    .maybeSingle();
  verificar(error);

  if (!data) throw new AppError('Usuário do token não existe mais.', 401);

  req.usuario = data;
  next();
});

// Uso: router.post('/', autenticar, exigirPerfil('Professor', 'Administrador'), controller)
// 401 = não está autenticado | 403 = está autenticado, mas o perfil não tem permissão.
function exigirPerfil(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return next(
        new AppError(`Acesso negado. Esta ação é permitida apenas para: ${perfisPermitidos.join(', ')}.`, 403)
      );
    }
    next();
  };
}

const ehAdmin = (usuario) => usuario.perfil === 'Administrador';

module.exports = { autenticar, exigirPerfil, ehAdmin };
