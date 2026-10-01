// Salas / laboratórios (somente o Administrador cria, edita e exclui)
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const { textoValido } = require('../utils/validators');

const COLUNAS = 'id, nome, descricao, criado_em';

function validarDadosSala(body, { parcial = false } = {}) {
  const erros = [];
  const dados = {};
  if (!parcial || body.nome !== undefined) {
    if (!textoValido(body.nome, 2, 100)) erros.push('nome: informe entre 2 e 100 caracteres.');
    else dados.nome = body.nome.trim();
  }
  if (body.descricao !== undefined) {
    if (body.descricao === null || body.descricao === '') dados.descricao = null;
    else if (!textoValido(body.descricao, 1, 200)) erros.push('descricao: máximo de 200 caracteres.');
    else dados.descricao = body.descricao.trim();
  }
  if (erros.length > 0) throw new AppError('Dados inválidos.', 400, erros);
  return dados;
}

// POST /salas
async function criar(req, res) {
  const dados = validarDadosSala(req.body || {});
  const { data, error } = await supabase.from('salas').insert(dados).select(COLUNAS).single();
  verificar(error);
  res.status(201).json({ mensagem: 'Sala cadastrada com sucesso.', sala: data });
}

// GET /salas (qualquer usuário logado) - inclui quantos equipamentos cada sala tem
async function listar(req, res) {
  const { data: salas, error } = await supabase.from('salas').select(COLUNAS).order('nome');
  verificar(error);
  const { data: equip, error: erroEquip } = await supabase.from('equipamentos').select('sala_id').range(0, 999);
  verificar(erroEquip);
  const contagem = equip.reduce((acc, e) => ({ ...acc, [e.sala_id]: (acc[e.sala_id] || 0) + 1 }), {});
  res.json({ total: salas.length, salas: salas.map((s) => ({ ...s, total_equipamentos: contagem[s.id] || 0 })) });
}

// PUT /salas/:id - ao renomear, os equipamentos da sala acompanham o novo nome
async function atualizar(req, res) {
  const dados = validarDadosSala(req.body || {}, { parcial: true });
  if (Object.keys(dados).length === 0) throw new AppError('Nenhum campo válido para atualizar foi enviado.', 400);

  const { data, error } = await supabase.from('salas').update(dados).eq('id', req.params.id).select(COLUNAS).maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Sala não encontrada.', 404);

  if (dados.nome) {
    const { error: erroSync } = await supabase.from('equipamentos').update({ localizacao: dados.nome }).eq('sala_id', req.params.id);
    verificar(erroSync);
  }
  res.json({ mensagem: 'Sala atualizada com sucesso.', sala: data });
}

// DELETE /salas/:id - só se não houver equipamentos nela
async function remover(req, res) {
  const { data: usados, error: erroUso } = await supabase.from('equipamentos').select('id').eq('sala_id', req.params.id).limit(1);
  verificar(erroUso);
  if (usados.length > 0) throw new AppError('Esta sala possui equipamentos. Mova ou exclua os equipamentos antes.', 409);

  const { data, error } = await supabase.from('salas').delete().eq('id', req.params.id).select('id').maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Sala não encontrada.', 404);
  res.json({ mensagem: 'Sala excluída com sucesso.' });
}

module.exports = { criar, listar, atualizar, remover };
