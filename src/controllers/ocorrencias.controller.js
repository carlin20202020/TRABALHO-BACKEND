// Ocorrências: o coração do sistema (Sprints 3 e 4)
const { randomUUID } = require('crypto');
const supabase = require('../config/supabase');
const { SUPABASE_BUCKET } = require('../config/env');
const AppError = require('../utils/AppError');
const { verificar } = require('../utils/erroBanco');
const { ehAdmin } = require('../middlewares/auth');
const {
  CATEGORIAS, STATUS_OCORRENCIA, PERFIS, normalizarOpcao, textoValido, ehUuid,
  validarPatrimonio, detectarImagem, lerPaginacao,
} = require('../utils/validators');

// Traz junto os dados de quem abriu, do equipamento e do técnico responsável.
// Como a tabela tem DUAS ligações com "usuarios", indicamos qual usar pelo nome da constraint.
const SELECT_COMPLETO = `
  *,
  usuario:usuarios!fk_ocorrencias_usuario(id, nome, matricula, perfil),
  tecnico:usuarios!fk_ocorrencias_tecnico(id, nome),
  equipamento:equipamentos!fk_ocorrencias_equipamento(id, nome, tipo, numero_patrimonio, localizacao)
`;

// ---------- REGRA DE NEGÓCIO 3: prioridade automática ----------
// A prioridade NUNCA vem do cliente: é decidida aqui, pelo perfil de quem abriu o chamado.
function definirPrioridade(perfil) {
  return perfil === 'Professor' ? 'Alta Prioridade' : 'Média Prioridade';
}

// Quem pode ver o quê:
//  - Administrador: todas | Professor: só as que ele abriu | Aluno: todas as ATIVAS (não resolvidas)
function podeVer(ocorrencia, usuario) {
  if (ehAdmin(usuario)) return true;
  if (usuario.perfil === 'Professor') return ocorrencia.usuario_id === usuario.id;
  return ocorrencia.status !== 'Resolvido';
}

// Busca uma ocorrência e confere se o usuário logado pode vê-la
async function carregarOcorrenciaComAcesso(id, usuario) {
  const { data, error } = await supabase.from('ocorrencias').select(SELECT_COMPLETO).eq('id', id).maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Ocorrência não encontrada.', 404);
  if (!podeVer(data, usuario)) {
    throw new AppError(
      usuario.perfil === 'Professor' ? 'Você só tem acesso às ocorrências que você abriu.' : 'Alunos só visualizam ocorrências ativas.',
      403
    );
  }
  return data;
}

// POST /ocorrencias  (Professor ou Administrador; multipart/form-data ou JSON)
// Campos: titulo, descricao, categoria, equipamento_id, foto (arquivo)
async function criar(req, res) {
  const body = req.body || {};
  const erros = [];

  if (!textoValido(body.titulo, 3, 120)) erros.push('titulo: informe entre 3 e 120 caracteres.');
  if (!textoValido(body.descricao, 5, 1000)) erros.push('descricao: informe entre 5 e 1000 caracteres.');
  const categoria = normalizarOpcao(body.categoria, CATEGORIAS);
  if (!categoria) erros.push(`categoria: use um destes valores: ${CATEGORIAS.join(', ')}.`);
  if (!ehUuid(body.equipamento_id)) erros.push('equipamento_id: informe o UUID de um equipamento cadastrado.');
  if (erros.length > 0) throw new AppError('Dados inválidos.', 400, erros);

  // ---------- REGRA DE NEGÓCIO 2: foto obrigatória para "Hardware Quebrado" ----------
  // Esta checagem vem ANTES de qualquer gravação, então nada é salvo se faltar a foto.
  const arquivo = req.file;
  if (categoria === 'Hardware Quebrado' && !arquivo) {
    throw new AppError(
      "Ocorrências da categoria 'Hardware Quebrado' exigem uma foto do problema (campo 'foto').",
      400
    );
  }

  let imagem = null;
  if (arquivo) {
    imagem = detectarImagem(arquivo.buffer);
    if (!imagem) throw new AppError('O arquivo enviado não é uma imagem válida (JPG, PNG ou WEBP).', 400);
  }

  // O equipamento precisa existir (vínculo ocorrência -> equipamento)
  const { data: equipamento, error: erroEquip } = await supabase
    .from('equipamentos').select('id').eq('id', body.equipamento_id).maybeSingle();
  verificar(erroEquip);
  if (!equipamento) throw new AppError('Equipamento não encontrado.', 404);

  // Envia a foto para o Supabase Storage (bucket). Nome aleatório evita colisões.
  let fotoPath = null;
  let fotoUrl = null;
  if (imagem) {
    fotoPath = `${req.usuario.id}/${randomUUID()}.${imagem.ext}`;
    const { error: erroUpload } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(fotoPath, arquivo.buffer, { contentType: imagem.mime, upsert: false });
    if (erroUpload) {
      console.error('[ERRO STORAGE]', erroUpload);
      throw new AppError('Não foi possível enviar a foto para o armazenamento. Tente novamente.', 502);
    }
    fotoUrl = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(fotoPath).data.publicUrl;
  }

  // Grava a ocorrência com os vínculos (usuário e equipamento) e a prioridade automática
  const { data, error } = await supabase
    .from('ocorrencias')
    .insert({
      titulo: body.titulo.trim(),
      descricao: body.descricao.trim(),
      categoria,
      status: 'Aberto',
      prioridade: definirPrioridade(req.usuario.perfil),
      usuario_id: req.usuario.id,
      equipamento_id: body.equipamento_id,
      foto_path: fotoPath,
      foto_url: fotoUrl,
    })
    .select(SELECT_COMPLETO)
    .single();

  if (error) {
    // Se o banco recusou, apagamos a foto enviada para não deixar arquivo "órfão" no Storage
    if (fotoPath) await supabase.storage.from(SUPABASE_BUCKET).remove([fotoPath]);
    verificar(error);
  }

  res.status(201).json({ mensagem: 'Ocorrência aberta com sucesso.', ocorrencia: data });
}

// GET /ocorrencias
// Administrador vê todas | Professor vê as suas | Aluno vê as ativas.
// Filtros: ?status=&prioridade=&categoria=&equipamento_id=&usuario_id=&pagina=&limite=
async function listar(req, res) {
  const { de, ate, pagina, limite } = lerPaginacao(req.query);
  let consulta = supabase.from('ocorrencias').select(SELECT_COMPLETO).order('criado_em', { ascending: false }).range(de, ate);

  if (req.usuario.perfil === 'Professor') {
    consulta = consulta.eq('usuario_id', req.usuario.id);
  } else if (req.usuario.perfil === 'Aluno') {
    consulta = consulta.neq('status', 'Resolvido'); // aluno vê só as ativas
  } else if (req.query.usuario_id) {
    if (!ehUuid(req.query.usuario_id)) throw new AppError('Filtro usuario_id inválido.', 400);
    consulta = consulta.eq('usuario_id', req.query.usuario_id);
  }

  if (req.query.status) {
    const status = normalizarOpcao(req.query.status, STATUS_OCORRENCIA);
    if (!status) throw new AppError(`Filtro status inválido. Use: ${STATUS_OCORRENCIA.join(', ')}.`, 400);
    consulta = consulta.eq('status', status);
  }
  if (req.query.prioridade) {
    const prioridade = normalizarOpcao(req.query.prioridade, ['Alta Prioridade', 'Média Prioridade']);
    if (!prioridade) throw new AppError('Filtro prioridade inválido. Use: Alta Prioridade ou Média Prioridade.', 400);
    consulta = consulta.eq('prioridade', prioridade);
  }
  if (req.query.categoria) {
    const categoria = normalizarOpcao(req.query.categoria, CATEGORIAS);
    if (!categoria) throw new AppError(`Filtro categoria inválido. Use: ${CATEGORIAS.join(', ')}.`, 400);
    consulta = consulta.eq('categoria', categoria);
  }
  if (req.query.equipamento_id) {
    if (!ehUuid(req.query.equipamento_id)) throw new AppError('Filtro equipamento_id inválido.', 400);
    consulta = consulta.eq('equipamento_id', req.query.equipamento_id);
  }

  const { data, error } = await consulta;
  verificar(error);
  res.json({ pagina, limite, total: data.length, ocorrencias: data });
}

// GET /ocorrencias/:id
async function buscar(req, res) {
  const ocorrencia = await carregarOcorrenciaComAcesso(req.params.id, req.usuario);
  res.json({ ocorrencia });
}

// PATCH /ocorrencias/:id/status  (somente Administrador)
// Corpo: { "status": "Em Andamento" }  ou  { "status": "Resolvido", "numero_patrimonio": "123456" }
async function atualizarStatus(req, res) {
  const body = req.body || {};
  const novoStatus = normalizarOpcao(body.status, STATUS_OCORRENCIA);
  if (!novoStatus) throw new AppError(`status: use um destes valores: ${STATUS_OCORRENCIA.join(', ')}.`, 400);

  const { data: atual, error: erroBusca } = await supabase
    .from('ocorrencias').select('id, status').eq('id', req.params.id).maybeSingle();
  verificar(erroBusca);
  if (!atual) throw new AppError('Ocorrência não encontrada.', 404);

  if (atual.status === novoStatus) throw new AppError(`A ocorrência já está com o status '${novoStatus}'.`, 400);

  const alteracoes = { status: novoStatus };

  if (novoStatus === 'Resolvido') {
    // ---------- REGRA DE NEGÓCIO 4: validação de fechamento ----------
    // Só resolve se o Administrador informar o número de patrimônio (tombo) do equipamento consertado.
    if (body.numero_patrimonio === undefined || body.numero_patrimonio === null || String(body.numero_patrimonio).trim() === '') {
      throw new AppError("Para marcar como 'Resolvido' é obrigatório informar o 'numero_patrimonio' (tombo) do equipamento consertado.", 400);
    }
    const patrimonio = validarPatrimonio(body.numero_patrimonio);
    if (!patrimonio) {
      throw new AppError('numero_patrimonio inválido: use de 3 a 20 caracteres (letras, números, ponto, traço ou barra).', 400);
    }
    alteracoes.numero_patrimonio_resolvido = patrimonio;
    alteracoes.resolvido_em = new Date().toISOString();
    alteracoes.tecnico_id = req.usuario.id;
  } else if (novoStatus === 'Em Andamento') {
    alteracoes.tecnico_id = req.usuario.id;
  } else {
    alteracoes.tecnico_id = null; // voltou para "Aberto"
  }

  // O Administrador pode reabrir um chamado resolvido: limpa os dados do fechamento
  if (novoStatus !== 'Resolvido' && atual.status === 'Resolvido') {
    alteracoes.numero_patrimonio_resolvido = null;
    alteracoes.resolvido_em = null;
  }

  const { data, error } = await supabase
    .from('ocorrencias').update(alteracoes).eq('id', req.params.id).select(SELECT_COMPLETO).single();
  verificar(error);

  // Registra o evento na linha do tempo do chamado (falha aqui não cancela a alteração)
  const { error: erroHist } = await supabase.from('comentarios').insert({
    ocorrencia_id: req.params.id,
    usuario_id: req.usuario.id,
    tipo: 'sistema',
    texto: novoStatus === 'Resolvido'
      ? `Status: ${atual.status} → Resolvido (patrimônio ${alteracoes.numero_patrimonio_resolvido}).`
      : `Status: ${atual.status} → ${novoStatus}.`,
  });
  if (erroHist) console.error('[HISTÓRICO]', erroHist.message);

  res.json({ mensagem: `Status alterado para '${novoStatus}'.`, ocorrencia: data });
}

// GET /dashboard - Administrador: tudo | Professor: só os seus | Aluno: só os ativos.
async function resumo(req, res) {
  let consulta = supabase
    .from('ocorrencias')
    .select('status, prioridade, categoria, criado_em, resolvido_em, equipamento:equipamentos!fk_ocorrencias_equipamento(nome)')
    .order('criado_em', { ascending: false })
    .range(0, 999); // analisa os 1000 chamados mais recentes
  if (req.usuario.perfil === 'Professor') consulta = consulta.eq('usuario_id', req.usuario.id);
  if (req.usuario.perfil === 'Aluno') consulta = consulta.neq('status', 'Resolvido');

  const { data, error } = await consulta;
  verificar(error);

  const contar = (campo) => data.reduce((acc, o) => ({ ...acc, [o[campo]]: (acc[o[campo]] || 0) + 1 }), {});
  const porEquip = data.reduce((acc, o) => {
    const nome = o.equipamento && o.equipamento.nome;
    return nome ? { ...acc, [nome]: (acc[nome] || 0) + 1 } : acc;
  }, {});
  const resolvidos = data.filter((o) => o.resolvido_em);
  const horas = resolvidos.length
    ? resolvidos.reduce((t, o) => t + (new Date(o.resolvido_em) - new Date(o.criado_em)), 0) / resolvidos.length / 36e5
    : null;

  res.json({
    total: data.length,
    porStatus: contar('status'),
    porPrioridade: contar('prioridade'),
    porCategoria: contar('categoria'),
    topEquipamentos: Object.entries(porEquip).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, total]) => ({ nome, total })),
    tempoMedioResolucaoHoras: horas === null ? null : Math.round(horas * 10) / 10,
  });
}

// PUT /ocorrencias/:id  (somente Administrador) - edita título, descrição, categoria e equipamento
async function editar(req, res) {
  const body = req.body || {};
  const erros = [];
  const dados = {};
  if (body.titulo !== undefined) {
    if (!textoValido(body.titulo, 3, 120)) erros.push('titulo: informe entre 3 e 120 caracteres.');
    else dados.titulo = body.titulo.trim();
  }
  if (body.descricao !== undefined) {
    if (!textoValido(body.descricao, 5, 1000)) erros.push('descricao: informe entre 5 e 1000 caracteres.');
    else dados.descricao = body.descricao.trim();
  }
  if (body.categoria !== undefined) {
    const categoria = normalizarOpcao(body.categoria, CATEGORIAS);
    if (!categoria) erros.push(`categoria: use um destes valores: ${CATEGORIAS.join(', ')}.`);
    else dados.categoria = categoria;
  }
  if (body.equipamento_id !== undefined && !ehUuid(body.equipamento_id)) erros.push('equipamento_id: UUID inválido.');
  else if (body.equipamento_id !== undefined) dados.equipamento_id = body.equipamento_id;
  if (erros.length > 0) throw new AppError('Dados inválidos.', 400, erros);
  if (Object.keys(dados).length === 0) throw new AppError('Nenhum campo válido para atualizar foi enviado.', 400);

  const { data: atual, error: erroBusca } = await supabase
    .from('ocorrencias').select('id, categoria, foto_url').eq('id', req.params.id).maybeSingle();
  verificar(erroBusca);
  if (!atual) throw new AppError('Ocorrência não encontrada.', 404);

  // A regra da foto continua valendo na edição
  if ((dados.categoria || atual.categoria) === 'Hardware Quebrado' && !atual.foto_url) {
    throw new AppError("Esta ocorrência não tem foto, então não pode ser da categoria 'Hardware Quebrado'.", 400);
  }
  if (dados.equipamento_id) {
    const { data: equip, error: erroEquip } = await supabase.from('equipamentos').select('id').eq('id', dados.equipamento_id).maybeSingle();
    verificar(erroEquip);
    if (!equip) throw new AppError('Equipamento não encontrado.', 404);
  }

  const { data, error } = await supabase.from('ocorrencias').update(dados).eq('id', req.params.id).select(SELECT_COMPLETO).single();
  verificar(error);
  res.json({ mensagem: 'Ocorrência atualizada com sucesso.', ocorrencia: data });
}

// DELETE /ocorrencias/:id  (somente Administrador) - apaga também os comentários e a foto do Storage
async function remover(req, res) {
  const { data, error } = await supabase.from('ocorrencias').delete().eq('id', req.params.id).select('id, foto_path').maybeSingle();
  verificar(error);
  if (!data) throw new AppError('Ocorrência não encontrada.', 404);
  if (data.foto_path) {
    const { error: erroFoto } = await supabase.storage.from(SUPABASE_BUCKET).remove([data.foto_path]);
    if (erroFoto) console.error('[STORAGE] não foi possível apagar a foto:', erroFoto.message);
  }
  res.json({ mensagem: 'Ocorrência excluída com sucesso.' });
}

module.exports = { editar, remover, criar, listar, buscar, atualizarStatus, resumo, definirPrioridade, carregarOcorrenciaComAcesso };
