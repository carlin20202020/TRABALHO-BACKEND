// Comentários dentro de uma ocorrência
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const { textoValido } = require('../utils/validators');
const { carregarOcorrenciaComAcesso } = require('./ocorrencias.controller');

// POST /ocorrencias/:id/comentarios
async function criar(req, res) {
  // Confere se a ocorrência existe e se o usuário tem acesso a ela (404/403)
  await carregarOcorrenciaComAcesso(req.params.id, req.usuario);

  const texto = (req.body || {}).texto;
  if (!textoValido(texto, 1, 500)) throw new AppError('texto: informe entre 1 e 500 caracteres.', 400);

  const { data, error } = await supabase
    .from('comentarios')
    .insert({ ocorrencia_id: req.params.id, usuario_id: req.usuario.id, texto: texto.trim() })
    .select('*, autor:usuarios!fk_comentarios_usuario(id, nome, perfil)')
    .single();
  verificar(error);
  res.status(201).json({ mensagem: 'Comentário adicionado.', comentario: data });
}

// GET /ocorrencias/:id/comentarios
async function listar(req, res) {
  await carregarOcorrenciaComAcesso(req.params.id, req.usuario);

  const { data, error } = await supabase
    .from('comentarios')
    .select('*, autor:usuarios!fk_comentarios_usuario(id, nome, perfil)')
    .eq('ocorrencia_id', req.params.id)
    .order('criado_em', { ascending: true });
  verificar(error);
  res.json({ total: data.length, comentarios: data });
}

module.exports = { criar, listar };
