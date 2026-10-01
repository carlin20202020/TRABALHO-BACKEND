'use strict';
// SGOA - site (HTML + JS puro). Toda informação passa pela API Node, que grava no Supabase.
const $ = (s, e = document) => e.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '-');
const lerUser = () => { try { return JSON.parse(localStorage.getItem('sgoa_user')); } catch { return null; } };
const S = { token: localStorage.getItem('sgoa_token'), user: lerUser() };
const ehAdm = () => S.user && S.user.perfil === 'Administrador';
const podeCriar = () => S.user && ['Professor', 'Administrador'].includes(S.user.perfil);
const C = {}; // guarda as listas carregadas para preencher os formulários de edição
const STATUS_EQ = ['Operacional', 'Com Defeito', 'Em Manutenção', 'Baixado'];
const CATS = ['Hardware Quebrado', 'Sem Internet', 'Software', 'Projetor com Defeito', 'Mobiliário', 'Outros'];
const TIPOS = ['Computador', 'Projetor', 'Cadeira', 'Mesa', 'Roteador', 'Impressora', 'Outro'];
const opts = (l, sel) => l.map((o) => `<option ${o === sel ? 'selected' : ''}>${esc(o)}</option>`).join('');
const pill = (t) => `<span class="pill p-${esc(String(t).replace(/ /g, '-'))}">${esc(t)}</span>`;
document.documentElement.dataset.tema = localStorage.getItem('sgoa_tema') || 'claro';

function toast(msg, erro) {
  const t = document.createElement('div');
  t.className = 'toast' + (erro ? ' err' : ''); t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 4500);
}
const msgErro = (e) => `<div class="alert err"><b>${esc(e.message)}</b>${e.detalhes ? '<ul>' + e.detalhes.map((d) => `<li>${esc(d)}</li>`).join('') + '</ul>' : ''}</div>`;

async function api(caminho, { method = 'GET', json, form } = {}) {
  const h = {}; let body;
  if (S.token) h.Authorization = 'Bearer ' + S.token;
  if (json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  if (form) body = form;
  let r;
  try { r = await fetch('/' + caminho, { method, headers: h, body }); }
  catch { throw new Error('Sem conexão com a API. Confira se o servidor (npm run dev) está rodando.'); }
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token && caminho !== 'auth/login') { sair(); throw new Error(d.erro || 'Sessão expirada.'); }
  if (!r.ok) { const e = new Error(d.erro || 'Erro ' + r.status); e.detalhes = d.detalhes; throw e; }
  return d;
}
function entrar(d) {
  S.token = d.token; S.user = d.usuario;
  localStorage.setItem('sgoa_token', d.token); localStorage.setItem('sgoa_user', JSON.stringify(d.usuario));
  location.hash = '#/painel'; render();
}
function sair() {
  S.token = null; S.user = null; localStorage.removeItem('sgoa_token'); localStorage.removeItem('sgoa_user');
  location.hash = ''; render();
}
const busy = (f, on) => { const b = f.querySelector('button[type=submit]'); if (b) b.disabled = on; };

// ---------- Telas ----------
function telaLogin(aba = 'entrar') {
  $('#app').innerHTML = `<div class="login"><div class="box">
    <img class="logo" src="img/logo.png" alt="Logo do colégio"><h1>SGOA</h1>
    <p>Colégio Estadual Dr. Gilberto Alves do Nascimento<br>Gestão de Ocorrências e Ativos Escolares</p>
    <div class="tabs"><button data-aba="entrar" class="${aba === 'entrar' ? 'on' : ''}">Entrar</button><button data-aba="cadastro" class="${aba === 'cadastro' ? 'on' : ''}">Criar conta</button></div><div id="msg"></div>
    ${aba === 'entrar' ? `<form id="f-login"><label>E-mail</label><input name="email" type="email" required autocomplete="username">
      <label>Senha</label><input name="senha" type="password" required autocomplete="current-password"><br><br><button type="submit" style="width:100%">Entrar</button></form>`
    : `<form id="f-registro"><label>Nome completo</label><input name="nome" required minlength="3">
      <div class="row"><div><label>E-mail</label><input name="email" type="email" required></div><div><label>Matrícula (CGM/RA)</label><input name="matricula" required inputmode="numeric"></div></div>
      <div class="row"><div><label>Perfil</label><select name="perfil"><option>Aluno</option><option>Professor</option></select></div><div><label>Senha (mín. 8)</label><input name="senha" type="password" required minlength="8" autocomplete="new-password"></div></div>
      <br><button type="submit" style="width:100%">Criar conta</button></form>`}</div></div>`;
}

async function painel() {
  const d = await api('dashboard');
  const st = d.porStatus, pr = d.porPrioridade;
  const card = (n, l, c) => `<div class="card stat" style="--c:${c}"><b>${n || 0}</b><span>${l}</span></div>`;
  const barras = (obj, vazio) => { const e = Object.entries(obj).sort((a, b) => b[1] - a[1]), max = Math.max(1, ...e.map((x) => x[1]));
    return e.length ? e.map(([k, v]) => `<div class="bar"><span>${esc(k)}</span><div><i style="width:${(v / max) * 100}%"></i></div><b>${v}</b></div>`).join('') : `<div class="empty">${vazio}</div>`; };
  $('#view').innerHTML = cab(`Olá, ${esc(S.user.nome.split(' ')[0])}! 👋`, ehAdm() ? 'Visão geral de todos os chamados da escola' : S.user.perfil === 'Professor' ? 'Resumo dos chamados que você abriu' : 'Chamados ativos da escola', podeCriar() ? '<a class="btn" href="#/novo">➕ Abrir chamado</a>' : '') +
    `<div class="grid g4">${card(d.total, 'Total de chamados', 'var(--brand)')}${card(st.Aberto, 'Abertos', 'var(--blue)')}${card(st['Em Andamento'], 'Em andamento', 'var(--amber)')}${card(st.Resolvido, 'Resolvidos', 'var(--green)')}${card(pr['Alta Prioridade'], 'Alta prioridade', 'var(--red)')}
    ${card(d.tempoMedioResolucaoHoras === null ? '—' : d.tempoMedioResolucaoHoras + ' h', 'Tempo médio de resolução', '#8a9ba4')}</div><br>
    <div class="grid g2"><div class="card"><h2>Chamados por categoria</h2>${barras(d.porCategoria, 'Sem chamados ainda')}</div>
    <div class="card"><h2>Equipamentos com mais problemas</h2>${barras(Object.fromEntries(d.topEquipamentos.map((x) => [x.nome, x.total])), 'Sem dados ainda')}</div></div>`;
}


function modal(titulo, corpo) {
  fecharModal();
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="box"><h2>${titulo}</h2><div class="msg"></div>${corpo}</div>`;
  document.body.appendChild(m);
}
const fecharModal = () => { const m = $('.modal'); if (m) m.remove(); };
const botoesModal = (rot = 'Salvar') => `<br><div class="tags"><button type="submit">${rot}</button><button type="button" class="ghost" data-acao="fechar">Cancelar</button></div>`;
const gerarSenha = () => { const a = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return [...crypto.getRandomValues(new Uint8Array(10))].map((n) => a[n % a.length]).join(''); };
const PERFIL_ROTULO = { Aluno: 'Aluno — só visualiza e comenta', Professor: 'Professor — abre chamados', Administrador: 'Administrador' };

function layout() {
  const n = (h, ic, t) => `<a class="nav ${location.hash.startsWith(h) ? 'on' : ''}" href="${h}">${ic} ${t}</a>`;
  $('#app').innerHTML = `<div class="shell"><aside class="side">
    <div class="brand"><img src="img/logo.png" alt=""><div><b>SGOA</b><small>Colégio Dr. Gilberto<br>Alves do Nascimento</small></div></div>
    ${n('#/painel', '📊', 'Painel')}${n('#/chamados', '🎫', 'Chamados')}${podeCriar() ? n('#/novo', '➕', 'Novo chamado') : ''}${n('#/equipamentos', '🖥️', 'Equipamentos')}${n('#/salas', '🏫', 'Salas')}${ehAdm() ? n('#/usuarios', '👥', 'Usuários') : ''}
    <div class="bot"><div>${esc(S.user.nome)}<br><small>${esc(S.user.perfil)} · ${esc(S.user.matricula)}</small></div>
    <button class="ghost" data-acao="tema">🌓 Tema</button><button class="ghost" data-acao="minha-senha">🔑 Senha</button><button class="ghost" data-acao="sair">Sair</button></div></aside>
    <main id="view"><div class="spin">Carregando…</div></main></div>`;
}
const cab = (t, sub, extra = '') => `<div class="top"><div><h1>${t}</h1><p>${sub}</p></div>${extra}</div>`;
const btnIcone = (acao, id, ic, rot, cls = 'ghost') => `<button class="${cls} sm" data-acao="${acao}" data-id="${id}" title="${rot}">${ic} ${rot}</button>`;

async function chamados() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  const sel = (n, l, rot) => `<select name="${n}"><option value="">${rot}</option>${opts(l, q.get(n))}</select>`;
  const sub = ehAdm() ? 'Todos os chamados da escola' : S.user.perfil === 'Professor' ? 'Os chamados que você abriu' : 'Chamados ativos da escola. Você pode acompanhar e comentar.';
  $('#view').innerHTML = cab('Chamados', sub, podeCriar() ? '<a class="btn" href="#/novo">➕ Novo chamado</a>' : '') +
    `<form class="filters" id="f-filtro">${sel('status', S.user.perfil === 'Aluno' ? ['Aberto', 'Em Andamento'] : ['Aberto', 'Em Andamento', 'Resolvido'], 'Todos os status')}${sel('prioridade', ['Alta Prioridade', 'Média Prioridade'], 'Todas as prioridades')}${sel('categoria', CATS, 'Todas as categorias')}<button class="ghost" type="submit">Filtrar</button></form><div id="lista"><div class="spin">Carregando…</div></div>`;
  const p = new URLSearchParams(); ['status', 'prioridade', 'categoria'].forEach((k) => q.get(k) && p.set(k, q.get(k))); p.set('limite', 100);
  const { ocorrencias } = await api('ocorrencias?' + p);
  $('#lista').innerHTML = ocorrencias.length ? ocorrencias.map((o) => `<a class="item" href="#/chamado/${o.id}"><div><b>${esc(o.titulo)}</b>
    <small>${esc(o.equipamento?.nome || '-')} · ${esc(o.equipamento?.localizacao || '')} · ${dt(o.criado_em)} · por ${esc(o.usuario?.nome)}</small></div>
    <div class="tags">${o.foto_url ? '📷' : ''}${pill(o.prioridade)}${pill(o.status)}</div></a>`).join('') : '<div class="card empty">Nenhum chamado encontrado. 🎉</div>';
}

async function novo() {
  if (!podeCriar()) { $('#view').innerHTML = cab('Novo chamado', '') + '<div class="card empty">Alunos não abrem chamados. Você pode acompanhar e comentar nos <a href="#/chamados">chamados ativos</a>.</div>'; return; }
  const { equipamentos } = await api('equipamentos?limite=100');
  const prio = S.user.perfil === 'Professor' ? 'Alta Prioridade' : 'Média Prioridade';
  $('#view').innerHTML = cab('Novo chamado', 'Descreva o problema. A prioridade é definida automaticamente.') + (equipamentos.length ? `<div class="card" style="max-width:720px"><div id="msg"></div>
    <form id="f-novo"><label>Equipamento</label><select name="equipamento_id" required>${equipamentos.map((e) => `<option value="${e.id}">${esc(e.nome)} — ${esc(e.localizacao)}${e.numero_patrimonio ? ' (pat. ' + esc(e.numero_patrimonio) + ')' : ''}</option>`).join('')}</select>
    <div class="row"><div><label>Categoria</label><select name="categoria" id="categoria">${opts(CATS)}</select></div><div><label>Título</label><input name="titulo" required minlength="3" maxlength="120" placeholder="Ex.: Monitor não liga"></div></div>
    <label>Descrição</label><textarea name="descricao" required minlength="5" maxlength="1000" placeholder="Explique o que aconteceu"></textarea>
    <label>Foto do problema <span id="obrig"></span></label><input type="file" name="foto" id="foto" accept="image/jpeg,image/png,image/webp"><div class="hint">JPG, PNG ou WEBP, até 5 MB.</div><img id="prev" class="photo" hidden alt="">
    <div class="alert info">Este chamado será registrado com <b>${prio}</b> (perfil ${esc(S.user.perfil)}).</div><button type="submit">Enviar chamado</button></form></div>` : `<div class="card empty">Nenhum equipamento cadastrado.${ehAdm() ? ' <a href="#/equipamentos">Cadastre um equipamento</a> primeiro.' : ' Peça ao administrador para cadastrar.'}</div>`);
  const atualiza = () => { const hw = $('#categoria').value === 'Hardware Quebrado'; $('#obrig').innerHTML = hw ? '<b style="color:var(--red)">(obrigatória para Hardware Quebrado)</b>' : '(opcional)'; $('#foto').required = hw; };
  if ($('#categoria')) { $('#categoria').onchange = atualiza; atualiza();
    $('#foto').onchange = (e) => { const f = e.target.files[0], i = $('#prev'); i.hidden = !f; if (f) i.src = URL.createObjectURL(f); }; }
}

async function detalhe(id) {
  const [{ ocorrencia: o }, { comentarios }] = await Promise.all([api('ocorrencias/' + id), api(`ocorrencias/${id}/comentarios`)]);
  C.oc = o; const adm = ehAdm();
  const painelAdm = adm ? `<hr style="border:0;border-top:1px solid var(--bd);margin:16px 0"><h2>Administração</h2><div id="msg"></div>
    <div class="tags">${btnIcone('edit-oc', o.id, '✏️', 'Editar chamado')}${btnIcone('del-oc', o.id, '🗑️', 'Excluir chamado', 'danger')}
    ${o.status === 'Aberto' ? btnIcone('andamento', o.id, '▶', 'Iniciar atendimento', 'blue') : ''}${o.status === 'Resolvido' ? btnIcone('reabrir', o.id, '↩', 'Reabrir chamado', 'blue') : ''}</div>
    ${o.status !== 'Resolvido' ? `<form id="f-resolver" data-id="${o.id}"><label>Nº de patrimônio (tombo) do equipamento consertado</label><input name="numero_patrimonio" required value="${esc(o.equipamento?.numero_patrimonio || '')}" placeholder="Ex.: 100001"><br><br><button class="ok" type="submit">✔ Marcar como resolvido</button></form>` : ''}` : '';
  $('#view').innerHTML = cab(esc(o.titulo), `${esc(o.categoria)} · aberto em ${dt(o.criado_em)}`, '<a class="btn ghost" href="#/chamados">← Voltar</a>') +
    `<div class="grid g2"><div class="card"><div class="tags">${pill(o.prioridade)}${pill(o.status)}</div><p>${esc(o.descricao)}</p>
    <dl class="kv"><dt>Aberto por</dt><dd>${esc(o.usuario?.nome)} (${esc(o.usuario?.perfil)})</dd><dt>Equipamento</dt><dd>${esc(o.equipamento?.nome)} — ${esc(o.equipamento?.localizacao)}</dd>
    <dt>Patrimônio</dt><dd>${esc(o.equipamento?.numero_patrimonio || '-')}</dd><dt>Atendido por</dt><dd>${esc(o.tecnico?.nome || 'Ainda não atribuído')}</dd>
    ${o.resolvido_em ? `<dt>Resolvido em</dt><dd>${dt(o.resolvido_em)} (patrimônio ${esc(o.numero_patrimonio_resolvido)})</dd>` : ''}</dl>
    ${o.foto_url ? `<a href="${esc(o.foto_url)}" target="_blank" rel="noopener"><img class="photo" src="${esc(o.foto_url)}" alt="Foto do problema"></a>` : ''}
    ${S.user.perfil === 'Aluno' ? '<div class="alert info">Você pode acompanhar e comentar, mas não alterar chamados.</div>' : ''}${painelAdm}</div>
    <div class="card"><h2>${S.user.perfil === 'Professor' ? 'Conversa com o administrador' : adm ? 'Responder / histórico' : 'Comentários'}</h2><form id="f-coment" data-id="${o.id}" style="display:flex;gap:8px"><input name="texto" required maxlength="500" placeholder="${adm ? 'Responder ao professor…' : 'Escreva um comentário…'}"><button type="submit">Enviar</button></form>
    <div class="tl"><div class="ev"><b>${esc(o.usuario?.nome)}</b> abriu o chamado<br><small>${dt(o.criado_em)}</small></div>
    ${comentarios.map((c) => `<div class="ev ${c.tipo === 'sistema' ? 'sys' : ''}">${c.tipo === 'sistema' ? '' : `<b>${esc(c.autor?.nome)}</b> <small>(${esc(c.autor?.perfil)})</small><br>`}${esc(c.texto)}<br><small>${dt(c.criado_em)}</small></div>`).join('')}</div></div></div>`;
}

async function equipamentos() {
  const [{ equipamentos: l }, { salas: s }] = await Promise.all([api('equipamentos?limite=100'), api('salas')]);
  C.equip = l; C.salas = s;
  const salaOpts = (sel) => s.map((x) => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${esc(x.nome)}</option>`).join('');
  $('#view').innerHTML = cab('Equipamentos', 'Patrimônio da escola') + (ehAdm() ? (s.length ? `<details class="card"><summary>➕ Cadastrar equipamento</summary><div id="msg"></div><form id="f-equip">
    <div class="row"><div><label>Nome</label><input name="nome" required placeholder="Computador 05"></div><div><label>Tipo</label><select name="tipo">${opts(TIPOS)}</select></div></div>
    <div class="row"><div><label>Sala</label><select name="sala_id" required>${salaOpts()}</select></div><div><label>Nº de patrimônio (tombo)</label><input name="numero_patrimonio" placeholder="100005"></div></div><br><button type="submit">Salvar equipamento</button></form></details><br>`
    : '<div class="alert">Cadastre uma <a href="#/salas">sala</a> antes de cadastrar equipamentos.</div>') : '') +
    `<div class="card tw"><table><thead><tr><th>Nome</th><th>Tipo</th><th>Sala</th><th>Patrimônio</th><th>Status</th>${ehAdm() ? '<th></th>' : ''}</tr></thead><tbody>${l.map((e) => `<tr><td><b>${esc(e.nome)}</b></td><td>${esc(e.tipo)}</td><td>${esc(e.localizacao)}</td><td>${esc(e.numero_patrimonio || '-')}</td><td>${esc(e.status)}</td>${ehAdm() ? `<td class="tags">${btnIcone('edit-equip', e.id, '✏️', 'Editar')}${btnIcone('del-equip', e.id, '🗑️', 'Excluir')}</td>` : ''}</tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum equipamento.</td></tr>'}</tbody></table></div>`;
}

async function salas() {
  const { salas: l } = await api('salas'); C.salas = l;
  $('#view').innerHTML = cab('Salas e laboratórios', 'Locais onde ficam os equipamentos') + (ehAdm() ? `<details class="card"><summary>➕ Criar nova sala</summary><div id="msg"></div><form id="f-sala">
    <div class="row"><div><label>Nome</label><input name="nome" required minlength="2" maxlength="100" placeholder="Laboratório de Informática 3"></div><div><label>Descrição (opcional)</label><input name="descricao" maxlength="200"></div></div><br><button type="submit">Criar sala</button></form></details><br>` : '') +
    (l.length ? `<div class="grid g2">${l.map((x) => `<div class="card"><b>🏫 ${esc(x.nome)}</b><p class="hint">${esc(x.descricao || 'Sem descrição')}</p><p>${x.total_equipamentos} equipamento(s)</p>${ehAdm() ? `<div class="tags">${btnIcone('edit-sala', x.id, '✏️', 'Editar')}${btnIcone('del-sala', x.id, '🗑️', 'Excluir')}</div>` : ''}</div>`).join('')}</div>` : '<div class="card empty">Nenhuma sala cadastrada.</div>');
}

async function usuarios() {
  if (!ehAdm()) { location.hash = '#/painel'; return; }
  const { usuarios: l } = await api('usuarios?limite=100'); C.users = l;
  $('#view').innerHTML = cab('Usuários', 'Contas cadastradas no sistema') + `<div class="alert info">🔒 Por segurança, as senhas são guardadas <b>criptografadas</b> e ninguém consegue lê-las, nem o administrador. Para ajudar alguém que esqueceu a senha, use <b>Redefinir senha</b>: o sistema gera uma senha temporária que aparece uma única vez.</div>
    <details class="card"><summary>➕ Cadastrar usuário</summary><div id="msg"></div><form id="f-user">
    <div class="row"><div><label>Nome</label><input name="nome" required></div><div><label>E-mail</label><input name="email" type="email" required></div></div>
    <div class="row"><div><label>Matrícula</label><input name="matricula" required></div><div><label>Perfil</label><select name="perfil"><option>Aluno</option><option>Professor</option></select></div></div>
    <label>Senha inicial (mín. 8)</label><input name="senha" type="password" required minlength="8" autocomplete="new-password"><div class="hint">Só pode existir uma conta de Administrador (a sua).</div><br><button type="submit">Salvar usuário</button></form></details><br>
    <div class="card tw"><table><thead><tr><th>Nome</th><th>E-mail</th><th>Matrícula</th><th>Perfil</th><th>Senha</th><th></th></tr></thead><tbody>${l.map((u) => `<tr><td><b>${esc(u.nome)}</b></td><td>${esc(u.email)}</td><td>${esc(u.matricula)}</td><td>${esc(u.perfil)}</td><td>🔒 ••••••••</td><td class="tags">${btnIcone('edit-user', u.id, '✏️', 'Editar')}${btnIcone('senha-user', u.id, '🔑', 'Redefinir senha')}${u.id !== S.user.id ? btnIcone('del-user', u.id, '🗑️', 'Excluir') : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- Roteador ----------
async function rota() {
  if (!S.token) return telaLogin();
  layout();
  const [h, id] = location.hash.split('?')[0].split('/').slice(1);
  try {
    if (h === 'chamados') await chamados(); else if (h === 'novo') await novo(); else if (h === 'chamado' && id) await detalhe(id);
    else if (h === 'equipamentos') await equipamentos(); else if (h === 'salas') await salas(); else if (h === 'usuarios') await usuarios(); else await painel();
  } catch (e) { $('#view').innerHTML = msgErro(e); }
}
const render = () => rota();
window.addEventListener('hashchange', () => { fecharModal(); if (S.token) rota(); });

// ---------- Formulários ----------
const json = (f) => Object.fromEntries(new FormData(f));
const feito = (msg) => { fecharModal(); toast(msg); rota(); };
const formularios = {
  'f-login': async (f) => entrar(await api('auth/login', { method: 'POST', json: json(f) })),
  'f-registro': async (f) => {
    const d = json(f); await api('auth/registro', { method: 'POST', json: d });
    entrar(await api('auth/login', { method: 'POST', json: { email: d.email, senha: d.senha } })); toast('Conta criada! Bem-vindo(a).');
  },
  'f-novo': async (f) => { const d = await api('ocorrencias', { method: 'POST', form: new FormData(f) }); toast('Chamado aberto com ' + d.ocorrencia.prioridade + '!'); location.hash = '#/chamado/' + d.ocorrencia.id; },
  'f-edit-oc': async (f) => { await api('ocorrencias/' + f.dataset.id, { method: 'PUT', json: json(f) }); feito('Chamado atualizado.'); },
  'f-resolver': async (f) => { await api(`ocorrencias/${f.dataset.id}/status`, { method: 'PATCH', json: { status: 'Resolvido', numero_patrimonio: f.numero_patrimonio.value } }); feito('Chamado resolvido!'); },
  'f-coment': async (f) => { await api(`ocorrencias/${f.dataset.id}/comentarios`, { method: 'POST', json: { texto: f.texto.value } }); rota(); },
  'f-equip': async (f) => { await api('equipamentos', { method: 'POST', json: json(f) }); feito('Equipamento cadastrado!'); },
  'f-edit-equip': async (f) => { await api('equipamentos/' + f.dataset.id, { method: 'PUT', json: json(f) }); feito('Equipamento atualizado.'); },
  'f-sala': async (f) => { await api('salas', { method: 'POST', json: json(f) }); feito('Sala criada!'); },
  'f-edit-sala': async (f) => { await api('salas/' + f.dataset.id, { method: 'PUT', json: json(f) }); feito('Sala atualizada.'); },
  'f-user': async (f) => { await api('usuarios', { method: 'POST', json: json(f) }); feito('Usuário criado!'); },
  'f-edit-user': async (f) => { await api('usuarios/' + f.dataset.id, { method: 'PUT', json: json(f) }); feito('Usuário atualizado.'); },
  'f-minha-senha': async (f) => { await api('usuarios/' + S.user.id, { method: 'PUT', json: { senha: f.senha.value } }); feito('Senha alterada.'); },
  'f-filtro': async (f) => { const p = new URLSearchParams(new FormData(f)); [...p].forEach(([k, v]) => !v && p.delete(k)); location.hash = '#/chamados' + (p.toString() ? '?' + p : ''); },
};
document.addEventListener('submit', async (e) => {
  const h = formularios[e.target.id]; if (!h) return;
  e.preventDefault(); busy(e.target, true);
  try { await h(e.target); } catch (err) { const m = e.target.closest('.modal') ? $('.modal .msg') : $('#msg'); if (m) m.innerHTML = msgErro(err); toast(err.message, true); }
  finally { busy(e.target, false); }
});

// ---------- Cliques (botões do site) ----------
const achar = (lista, b) => (C[lista] || []).find((x) => x.id === b.dataset.id);
const acoes = {
  sair, fechar: fecharModal,
  tema: () => { const t = document.documentElement.dataset.tema === 'escuro' ? 'claro' : 'escuro'; document.documentElement.dataset.tema = t; localStorage.setItem('sgoa_tema', t); },
  'minha-senha': () => modal('Alterar minha senha', `<form id="f-minha-senha"><label>Nova senha (mín. 8 caracteres)</label><input name="senha" type="password" required minlength="8" autocomplete="new-password">${botoesModal()}</form>`),
  andamento: async (b) => { await api(`ocorrencias/${b.dataset.id}/status`, { method: 'PATCH', json: { status: 'Em Andamento' } }); toast('Atendimento iniciado.'); rota(); },
  reabrir: async (b) => { if (confirm('Reabrir este chamado?')) { await api(`ocorrencias/${b.dataset.id}/status`, { method: 'PATCH', json: { status: 'Aberto' } }); toast('Chamado reaberto.'); rota(); } },
  'edit-oc': async () => {
    const o = C.oc; const { equipamentos } = await api('equipamentos?limite=100');
    modal('Editar chamado', `<form id="f-edit-oc" data-id="${o.id}"><label>Título</label><input name="titulo" required minlength="3" maxlength="120" value="${esc(o.titulo)}">
      <label>Descrição</label><textarea name="descricao" required minlength="5" maxlength="1000">${esc(o.descricao)}</textarea>
      <div class="row"><div><label>Categoria</label><select name="categoria">${opts(CATS, o.categoria)}</select></div><div><label>Equipamento</label><select name="equipamento_id">${equipamentos.map((e) => `<option value="${e.id}" ${e.id === o.equipamento_id ? 'selected' : ''}>${esc(e.nome)} — ${esc(e.localizacao)}</option>`).join('')}</select></div></div>
      <div class="hint">"Hardware Quebrado" só é aceito se o chamado já tiver foto.</div>${botoesModal()}</form>`);
  },
  'del-oc': async (b) => { if (confirm('Excluir este chamado, os comentários e a foto? Não dá para desfazer.')) { await api('ocorrencias/' + b.dataset.id, { method: 'DELETE' }); toast('Chamado excluído.'); location.hash = '#/chamados'; } },
  'edit-equip': (b) => {
    const e = achar('equip', b);
    modal('Editar equipamento', `<form id="f-edit-equip" data-id="${e.id}"><div class="row"><div><label>Nome</label><input name="nome" required value="${esc(e.nome)}"></div><div><label>Tipo</label><select name="tipo">${opts(TIPOS, e.tipo)}</select></div></div>
      <div class="row"><div><label>Sala</label><select name="sala_id">${C.salas.map((s) => `<option value="${s.id}" ${s.id === e.sala_id ? 'selected' : ''}>${esc(s.nome)}</option>`).join('')}</select></div><div><label>Nº de patrimônio</label><input name="numero_patrimonio" value="${esc(e.numero_patrimonio || '')}"></div></div>
      <label>Status</label><select name="status">${opts(STATUS_EQ, e.status)}</select>${botoesModal()}</form>`);
  },
  'del-equip': async (b) => { if (confirm('Excluir este equipamento?')) { await api('equipamentos/' + b.dataset.id, { method: 'DELETE' }); toast('Equipamento excluído.'); rota(); } },
  'edit-sala': (b) => {
    const s = achar('salas', b);
    modal('Editar sala', `<form id="f-edit-sala" data-id="${s.id}"><label>Nome</label><input name="nome" required minlength="2" maxlength="100" value="${esc(s.nome)}"><label>Descrição</label><input name="descricao" maxlength="200" value="${esc(s.descricao || '')}"><div class="hint">Ao renomear, os equipamentos da sala acompanham o novo nome.</div>${botoesModal()}</form>`);
  },
  'del-sala': async (b) => { if (confirm('Excluir esta sala?')) { await api('salas/' + b.dataset.id, { method: 'DELETE' }); toast('Sala excluída.'); rota(); } },
  'edit-user': (b) => {
    const u = achar('users', b), souEu = u.perfil === 'Administrador';
    modal('Editar usuário', `<form id="f-edit-user" data-id="${u.id}"><div class="row"><div><label>Nome</label><input name="nome" required value="${esc(u.nome)}"></div><div><label>E-mail</label><input name="email" type="email" required value="${esc(u.email)}"></div></div>
      <div class="row"><div><label>Matrícula</label><input name="matricula" required value="${esc(u.matricula)}"></div><div><label>Perfil</label>${souEu ? '<input value="Administrador (único)" disabled>' : `<select name="perfil">${opts(['Aluno', 'Professor'], u.perfil)}</select>`}</div></div>${botoesModal()}</form>`);
  },
  'senha-user': async (b) => {
    const u = achar('users', b);
    if (!confirm(`Redefinir a senha de ${u.nome}? A senha atual deixa de funcionar.`)) return;
    const d = await api(`usuarios/${u.id}/redefinir-senha`, { method: 'POST' });
    modal('Senha redefinida', `<p>Nova senha temporária de <b>${esc(d.usuario.nome)}</b>:</p><div class="senha">${esc(d.senhaTemporaria)}</div>
      <p class="hint">Anote e entregue agora: ela <b>não aparece de novo</b>. Peça para a pessoa trocá-la em “🔑 Senha”.</p><div class="tags"><button data-acao="copiar" data-v="${esc(d.senhaTemporaria)}">📋 Copiar</button><button class="ghost" data-acao="fechar">Fechar</button></div>`);
  },
  copiar: async (b) => { try { await navigator.clipboard.writeText(b.dataset.v); toast('Senha copiada.'); } catch { toast('Copie manualmente a senha exibida.', true); } },
  'del-user': async (b) => { const u = achar('users', b); if (confirm(`Excluir a conta de ${u.nome}?`)) { await api('usuarios/' + u.id, { method: 'DELETE' }); toast('Usuário excluído.'); rota(); } },
};
document.addEventListener('click', async (e) => {
  if (e.target.classList && e.target.classList.contains('modal')) return fecharModal();
  const aba = e.target.closest('[data-aba]'); if (aba) return telaLogin(aba.dataset.aba);
  const b = e.target.closest('[data-acao]'); if (!b || !acoes[b.dataset.acao]) return;
  try { await acoes[b.dataset.acao](b); } catch (err) { toast(err.message, true); }
});

rota();
