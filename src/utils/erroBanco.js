// Traduz erros do Postgres/Supabase para erros HTTP amigáveis.
// Códigos do Postgres: 23505 = valor duplicado, 23503 = chave estrangeira,
// 23514 = violação de CHECK, 22P02 = formato inválido (ex.: UUID errado).
const AppError = require('./AppError');

const NOMES_CAMPOS = {
  email: 'E-mail',
  matricula: 'Matrícula',
  numero_patrimonio: 'Número de patrimônio',
};

function traduzirErroBanco(error) {
  const texto = `${error.message || ''} ${error.details || ''}`;

  // Supabase fora do ar, sem internet ou demorando demais para responder
  if (/fetch failed|aborted|timeout|timed out|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(texto)) {
    console.error('[BANCO INDISPONÍVEL]', texto.trim());
    return new AppError('Banco de dados temporariamente indisponível. Tente novamente em instantes.', 503);
  }

  if (error.code === '23505') {
    if (texto.includes('ux_um_administrador')) return new AppError('Só pode existir uma conta de Administrador no sistema.', 409);
    if (/\(nome\)|salas_nome/.test(texto)) return new AppError('Já existe uma sala com esse nome.', 409);
    const campo = Object.keys(NOMES_CAMPOS).find((c) => texto.includes(c));
    return new AppError(
      campo ? `${NOMES_CAMPOS[campo]} já cadastrado(a).` : 'Já existe um registro com esses dados.',
      409
    );
  }
  if (error.code === '23503') {
    return new AppError(
      'Operação não permitida: existem registros vinculados a este item ou o vínculo informado não existe.',
      409
    );
  }
  if (error.code === '23514') {
    return new AppError('Os dados enviados violam uma regra de validação do banco.', 400);
  }
  if (error.code === '22P02') {
    return new AppError('Formato de identificador ou valor inválido.', 400);
  }

  console.error('[ERRO BANCO]', error);
  return new AppError('Erro ao acessar o banco de dados. Tente novamente.', 500);
}

// Uso: const { data, error } = await ...; verificar(error);
function verificar(error) {
  if (error) throw traduzirErroBanco(error);
}

module.exports = { traduzirErroBanco, verificar };
