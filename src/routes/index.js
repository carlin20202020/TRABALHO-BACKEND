// Mapa de todas as rotas da API
const { Router } = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validarId = require('../middlewares/validarId');
const uploadFoto = require('../middlewares/upload');
const { autenticar, exigirPerfil } = require('../middlewares/auth');

const auth = require('../controllers/auth.controller');
const usuarios = require('../controllers/usuarios.controller');
const equipamentos = require('../controllers/equipamentos.controller');
const salas = require('../controllers/salas.controller');
const ocorrencias = require('../controllers/ocorrencias.controller');
const comentarios = require('../controllers/comentarios.controller');

const router = Router();
const a = asyncHandler;
const soAdmin = exigirPerfil('Administrador');
const podeCriar = exigirPerfil('Professor', 'Administrador');

// ---- Autenticação (públicas, exceto /me) ----
router.post('/auth/registro', a(auth.registrar));
router.post('/auth/login', a(auth.login));
router.get('/auth/me', autenticar, a(auth.perfil));

// ---- Usuários (o Administrador gerencia todos; cada um edita a própria conta) ----
router.post('/usuarios', autenticar, soAdmin, a(usuarios.criar));
router.get('/usuarios', autenticar, soAdmin, a(usuarios.listar));
router.get('/usuarios/:id', autenticar, validarId, a(usuarios.buscar));
router.put('/usuarios/:id', autenticar, validarId, a(usuarios.atualizar));
router.post('/usuarios/:id/redefinir-senha', autenticar, soAdmin, validarId, a(usuarios.redefinirSenha));
router.delete('/usuarios/:id', autenticar, soAdmin, validarId, a(usuarios.remover));

// ---- Salas (todos veem; só o Administrador altera) ----
router.get('/salas', autenticar, a(salas.listar));
router.post('/salas', autenticar, soAdmin, a(salas.criar));
router.put('/salas/:id', autenticar, soAdmin, validarId, a(salas.atualizar));
router.delete('/salas/:id', autenticar, soAdmin, validarId, a(salas.remover));

// ---- Equipamentos (todos veem; só o Administrador altera) ----
router.post('/equipamentos', autenticar, soAdmin, a(equipamentos.criar));
router.get('/equipamentos', autenticar, a(equipamentos.listar));
router.get('/equipamentos/:id', autenticar, validarId, a(equipamentos.buscar));
router.put('/equipamentos/:id', autenticar, soAdmin, validarId, a(equipamentos.atualizar));
router.delete('/equipamentos/:id', autenticar, soAdmin, validarId, a(equipamentos.remover));

// ---- Painel ----
router.get('/dashboard', autenticar, a(ocorrencias.resumo));

// ---- Ocorrências ----
// Só Professor/Administrador abrem chamados. Aluno apenas visualiza (ativas) e comenta.
// Ordem importa: autentica -> confere perfil -> multer lê a foto -> controller.
router.post('/ocorrencias', autenticar, podeCriar, uploadFoto, a(ocorrencias.criar));
router.get('/ocorrencias', autenticar, a(ocorrencias.listar));
router.get('/ocorrencias/:id', autenticar, validarId, a(ocorrencias.buscar));
router.put('/ocorrencias/:id', autenticar, soAdmin, validarId, a(ocorrencias.editar));
router.patch('/ocorrencias/:id/status', autenticar, soAdmin, validarId, a(ocorrencias.atualizarStatus));
router.delete('/ocorrencias/:id', autenticar, soAdmin, validarId, a(ocorrencias.remover));

// ---- Comentários ----
router.post('/ocorrencias/:id/comentarios', autenticar, validarId, a(comentarios.criar));
router.get('/ocorrencias/:id/comentarios', autenticar, validarId, a(comentarios.listar));

module.exports = router;
