// Funções de validação reaproveitadas pelos controllers.
const { MATRICULA_REGEX } = require('../config/env');

// ---------- Listas de valores permitidos (espelham os CHECKs do banco) ----------
const PERFIS = ['Aluno', 'Professor', 'Administrador'];
const TIPOS_EQUIPAMENTO = ['Computador', 'Projetor', 'Cadeira', 'Mesa', 'Roteador', 'Impressora', 'Outro'];
const STATUS_EQUIPAMENTO = ['Operacional', 'Com Defeito', 'Em Manutenção', 'Baixado'];
const CATEGORIAS = ['Hardware Quebrado', 'Sem Internet', 'Software', 'Projetor com Defeito', 'Mobiliário', 'Outros'];
const STATUS_OCORRENCIA = ['Aberto', 'Em Andamento', 'Resolvido'];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PATRIMONIO_REGEX = /^[A-Za-z0-9./-]{3,20}$/;

// Remove acentos e deixa minúsculo: "Média " -> "media"
function semAcento(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

// Aceita "professor", "PROFESSOR", "Professor"... e devolve o valor oficial da lista ("Professor").
// Se não existir na lista, devolve null.
function normalizarOpcao(valor, lista) {
  if (typeof valor !== 'string') return null;
  const alvo = semAcento(valor);
  return lista.find((item) => semAcento(item) === alvo) || null;
}

function textoValido(valor, min, max) {
  return typeof valor === 'string' && valor.trim().length >= min && valor.trim().length <= max;
}

const ehUuid = (valor) => typeof valor === 'string' && UUID_REGEX.test(valor);
const emailValido = (valor) => typeof valor === 'string' && EMAIL_REGEX.test(valor.trim());

// ---------- REGRA DE NEGÓCIO 1: padrão da matrícula (CGM/RA) ----------
// Aceita pontos, traços e espaços na digitação ("123.456.789-0"), remove tudo isso e
// confere se o que sobrou segue o padrão configurado em MATRICULA_REGEX.
// Devolve a matrícula limpa se for válida; senão, devolve null.
function validarMatricula(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const limpa = String(valor).replace(/[.\-\s]/g, '');
  return new RegExp(MATRICULA_REGEX).test(limpa) ? limpa : null;
}

// Devolve o patrimônio em maiúsculas se o formato for válido; senão, null.
function validarPatrimonio(valor) {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const limpo = String(valor).trim();
  return PATRIMONIO_REGEX.test(limpo) ? limpo.toUpperCase() : null;
}

// Confere o tipo REAL do arquivo pelos primeiros bytes (não confia só no que o cliente diz).
function detectarImagem(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}

// Paginação simples: ?pagina=1&limite=50 (limite máximo 100)
function lerPaginacao(query) {
  const limite = Math.min(Math.max(parseInt(query.limite, 10) || 50, 1), 100);
  const pagina = Math.max(parseInt(query.pagina, 10) || 1, 1);
  const de = (pagina - 1) * limite;
  return { de, ate: de + limite - 1, limite, pagina };
}

module.exports = {
  PERFIS, TIPOS_EQUIPAMENTO, STATUS_EQUIPAMENTO, CATEGORIAS, STATUS_OCORRENCIA,
  semAcento, normalizarOpcao, textoValido, ehUuid, emailValido,
  validarMatricula, validarPatrimonio, detectarImagem, lerPaginacao,
};
