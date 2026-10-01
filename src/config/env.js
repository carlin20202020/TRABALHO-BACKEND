// Carrega o arquivo .env e confere se as variáveis obrigatórias existem.
// Se faltar alguma, a API avisa com uma mensagem clara e não sobe "quebrada".
require('dotenv').config({ quiet: true });

const obrigatorias = ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'JWT_SECRET'];
const faltando = obrigatorias.filter((nome) => !process.env[nome] || !process.env[nome].trim());

if (faltando.length > 0) {
  console.error('\n[ERRO] Variáveis de ambiente ausentes no arquivo .env:');
  faltando.forEach((nome) => console.error('  - ' + nome));
  console.error('\nCopie o .env.example para .env e preencha os valores.\n');
  process.exit(1);
}

module.exports = {
  PORT: Number(process.env.PORT) || 3000,
  SUPABASE_URL: process.env.SUPABASE_URL.trim(),
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY.trim(),
  SUPABASE_BUCKET: (process.env.SUPABASE_BUCKET || 'ocorrencias').trim(),
  JWT_SECRET: process.env.JWT_SECRET.trim(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  MATRICULA_REGEX: process.env.MATRICULA_REGEX || '^\\d{8,10}$',
};
