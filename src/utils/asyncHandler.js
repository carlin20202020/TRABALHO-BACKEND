// Envolve os controllers assíncronos: qualquer erro (throw ou promessa rejeitada)
// é enviado para o middleware global de erros, e a API nunca fica sem responder.
module.exports = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
