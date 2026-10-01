// Conexão do Node.js com o Supabase (Sprint 2).
// Usamos a chave SECRETA porque quem controla as permissões é o nosso backend
// (middlewares de autenticação e de perfil). Por isso essa chave nunca vai para o GitHub.
const { createClient } = require('@supabase/supabase-js');
const { SUPABASE_URL, SUPABASE_SECRET_KEY } = require('./env');

const TEMPO_LIMITE_MS = 15000; // se o Supabase não responder em 15 s, a chamada é cancelada

// fetch com limite de tempo: evita que uma requisição fique "pendurada" para sempre (timeout)
function fetchComLimite(url, opcoes = {}) {
  const limite = AbortSignal.timeout(TEMPO_LIMITE_MS);
  const signal = opcoes.signal ? AbortSignal.any([opcoes.signal, limite]) : limite;
  return fetch(url, { ...opcoes, signal });
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: fetchComLimite },
});

module.exports = supabase;
