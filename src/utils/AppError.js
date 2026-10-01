// Erro "esperado" da nossa API: carrega o status HTTP que deve ser devolvido.
// Exemplo: throw new AppError('Matrícula inválida', 400);
class AppError extends Error {
  constructor(mensagem, status = 400, detalhes = null) {
    super(mensagem);
    this.name = 'AppError';
    this.status = status;
    this.detalhes = detalhes;
  }
}

module.exports = AppError;
