// Configuração do Express: API + site (pasta public/)
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { SUPABASE_URL } = require('./config/env');
const routes = require('./routes');
const { rotaNaoEncontrada, tratarErros } = require('./middlewares/errorHandler');

const app = express();

// Segurança (helmet) liberando só o necessário: as fotos vêm do Supabase Storage
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'blob:', new URL(SUPABASE_URL).origin],
      'upgrade-insecure-requests': null, // permite rodar em http://localhost
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// O site (HTML/CSS/JS) é servido pelo próprio Node: http://localhost:3000
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/saude', (req, res) => res.json({ status: 'ok', hora: new Date().toISOString() }));
app.use(routes);

// Sempre por último: 404 e tratamento global de erros
app.use(rotaNaoEncontrada);
app.use(tratarErros);

module.exports = app;
