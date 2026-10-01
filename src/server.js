const { PORT, SUPABASE_BUCKET } = require('./config/env');
const supabase = require('./config/supabase');
const app = require('./app');

// Rede de segurança: registra erros inesperados sem derrubar a API
process.on('unhandledRejection', (motivo) => console.error('[unhandledRejection]', motivo));
process.on('uncaughtException', (erro) => console.error('[uncaughtException]', erro));

async function verificarBucket() {
  try {
    const { error } = await supabase.storage.getBucket(SUPABASE_BUCKET);
    if (error) {
      console.warn(`[AVISO] Bucket '${SUPABASE_BUCKET}' não encontrado no Supabase Storage. Rode o database/schema.sql (ou crie o bucket) antes de enviar fotos.`);
    }
  } catch (erro) {
    console.warn('[AVISO] Não foi possível conferir o Supabase Storage:', erro.message);
  }
}

app.listen(PORT, () => {
  console.log(`SGOA rodando em http://localhost:${PORT}`);
  verificarBucket();
});
