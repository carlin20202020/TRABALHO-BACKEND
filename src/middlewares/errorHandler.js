// Tratamento GLOBAL de erros (Sprint 5): nenhuma rota deixa a API "quebrar" ou ficar sem resposta.
const multer = require('multer');
const AppError = require('../utils/AppError');

// Rota que não existe -> 404
function rotaNaoEncontrada(req, res, next) {
  next(new AppError(`Rota não encontrada: ${req.method} ${req.originalUrl}`, 404));
}

// eslint-disable-next-line no-unused-vars
function tratarErros(erro, req, res, next) {
  // Erros que nós mesmos lançamos (AppError)
  if (erro instanceof AppError) {
    const corpo = { erro: erro.message };
    if (erro.detalhes) corpo.detalhes = erro.detalhes;
    return res.status(erro.status).json(corpo);
  }

  // Erros do multer (upload)
  if (erro instanceof multer.MulterError) {
    if (erro.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: 'A foto excede o limite de 5 MB.' });
    if (erro.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ erro: "Envie a imagem no campo chamado 'foto' (um único arquivo)." });
    }
    return res.status(400).json({ erro: `Erro no upload do arquivo: ${erro.message}` });
  }

  // JSON malformado no corpo da requisição
  if (erro.type === 'entity.parse.failed' || erro instanceof SyntaxError) {
    return res.status(400).json({ erro: 'JSON inválido no corpo da requisição.' });
  }
  if (erro.type === 'entity.too.large') {
    return res.status(413).json({ erro: 'Corpo da requisição muito grande.' });
  }

  // Qualquer outra coisa é erro nosso: registramos no console e devolvemos 500 genérico
  console.error('[ERRO NÃO TRATADO]', erro);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}

module.exports = { rotaNaoEncontrada, tratarErros };
