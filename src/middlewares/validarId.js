// Garante que o :id da rota é um UUID válido, evitando erro 500 vindo do banco.
const AppError = require('../utils/AppError');
const { ehUuid } = require('../utils/validators');

module.exports = (req, res, next) => {
  if (!ehUuid(req.params.id)) return next(new AppError('O id informado na URL não é um UUID válido.', 400));
  next();
};
