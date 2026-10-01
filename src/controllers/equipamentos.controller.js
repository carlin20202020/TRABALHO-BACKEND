// CRUD de Equipamentos (Sprint 2)
const supabase = require('../config/supabase');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const {
  TIPOS_EQUIPAMENTO, STATUS_EQUIPAMENTO, normalizarOpcao, textoValido, ehUuid, validarPatrimonio, lerPaginacao,
} = require('../utils/validators');

function validarDadosEquipamento(body, { parcial = false } = {}) {
  const erros = [];
  const dados = {};
  const veio = (campo) => body[campo] !== undefined;

  if (!parcial || veio('nome')) {
    if (!textoValido(body.nome, 2, 100)) erros.push('nome: informe entre 2 e 100 caracteres.');
    else dados.nome = body.nome.trim();
  }
  if (!parcial || veio('tipo')) {
    const tipo = normalizarOpcao(body.tipo, TIPOS_EQUIPAMENTO);
    if (!tipo) erros.push(`tipo: use um destes valores: ${TIPOS_EQUIPAMENTO.join(', ')}.`);
    else dados.tipo = tipo;
  }
  if (!parcial || veio('sala_id')) {
    if (!ehUuid(body.sala_id)) erros.push('sala_id: informe o UUID de uma sala cadastrada.');
    else dados.sala_id = body.sala_id;
  }
  if (veio('numero_patrimonio')) {
    if (body.numero_patrimonio === null || body.numero_patrimonio === '') dados.numero_patrimonio = null;
    else {
      const patrimonio = validarPatrimonio(body.numero_patrimonio);
      if (!patrimonio) erros.push('numero_patrimonio: use de 3 a 20 caracteres (letras, números, ponto, traço ou barra).');
      else dados.numero_patrimonio = patrimonio;
    }
  }
  if (veio('status')) {
    const status = normalizarOpcao(body.status, STATUS_EQUIPAMENTO);
    if (!status) erros.push(`status: use um destes valores: ${STATUS_EQUIPAMENTO.join(', ')}.`);
    else dados.status = status;
  }

  if (erros.length > 0) throw new AppError('Dados inválidos.', 400, erros);
  return dados;
}

// Confere se a sala existe e copia o nome dela para o campo "localizacao" do equipamento
async function aplicarSala(dados) {
  if (!dados.sala_id) return;
  const { data, error } = await supabase.from('salas').select('id, nome').eq('id', dados.sala_id).maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Sala não encontrada.', 404);
  dados.localizacao = data.nome;
}

// POST /equipamentos (Administrador)
async function criar(req, res) {
  const dados = validarDadosEquipamento(req.body || {});
  await aplicarSala(dados);
  const { data, error } = await supabase
    .from('equipamentos')
    .insert({ ...dados, criado_por: req.usuario.id })
    .select('*')
    .single();
  verificar(error);
  res.status(201).json({ mensagem: 'Equipamento cadastrado com sucesso.', equipamento: data });
}

// GET /equipamentos - filtros: ?tipo=&status=&sala_id=&localizacao=&busca=&pagina=&limite=
async function listar(req, res) {
  const { de, ate, pagina, limite } = lerPaginacao(req.query);
  let consulta = supabase.from('equipamentos').select('*').order('localizacao').order('nome').range(de, ate);

  if (req.query.tipo) {
    const tipo = normalizarOpcao(req.query.tipo, TIPOS_EQUIPAMENTO);
    if (!tipo) throw new AppError(`Filtro tipo inválido. Use: ${TIPOS_EQUIPAMENTO.join(', ')}.`, 400);
    consulta = consulta.eq('tipo', tipo);
  }
  if (req.query.status) {
    const status = normalizarOpcao(req.query.status, STATUS_EQUIPAMENTO);
    if (!status) throw new AppError(`Filtro status inválido. Use: ${STATUS_EQUIPAMENTO.join(', ')}.`, 400);
    consulta = consulta.eq('status', status);
  }
  if (req.query.sala_id) {
    if (!ehUuid(req.query.sala_id)) throw new AppError('Filtro sala_id inválido.', 400);
    consulta = consulta.eq('sala_id', req.query.sala_id);
  }
  if (typeof req.query.localizacao === 'string' && req.query.localizacao.trim()) {
    consulta = consulta.ilike('localizacao', `%${req.query.localizacao.trim().replace(/[%*]/g, '')}%`);
  }
  if (typeof req.query.busca === 'string' && req.query.busca.trim()) {
    const termo = req.query.busca.trim().replace(/[,()%*]/g, ' ');
    consulta = consulta.or(`nome.ilike.%${termo}%,numero_patrimonio.ilike.%${termo}%`);
  }

  const { data, error } = await consulta;
  verificar(error);
  res.json({ pagina, limite, total: data.length, equipamentos: data });
}

// GET /equipamentos/:id
async function buscar(req, res) {
  const { data, error } = await supabase.from('equipamentos').select('*').eq('id', req.params.id).maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Equipamento não encontrado.', 404);
  res.json({ equipamento: data });
}

// PUT /equipamentos/:id (Administrador) - atualização parcial
async function atualizar(req, res) {
  const dados = validarDadosEquipamento(req.body || {}, { parcial: true });
  if (Object.keys(dados).length === 0) throw new AppError('Nenhum campo válido para atualizar foi enviado.', 400);
  await aplicarSala(dados);

  const { data, error } = await supabase.from('equipamentos').update(dados).eq('id', req.params.id).select('*').maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Equipamento não encontrado.', 404);
  res.json({ mensagem: 'Equipamento atualizado com sucesso.', equipamento: data });
}

// DELETE /equipamentos/:id (Administrador)
async function remover(req, res) {
  const { data, error } = await supabase.from('equipamentos').delete().eq('id', req.params.id).select('id').maybeSingle();
  verificar(error); // com ocorrências vinculadas -> 409
  if (!data) throw new AppError('Equipamento não encontrado.', 404);
  res.json({ mensagem: 'Equipamento excluído com sucesso.' });
}

module.exports = { criar, listar, buscar, atualizar, remover };
