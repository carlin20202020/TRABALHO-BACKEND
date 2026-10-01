// Recebe a foto (campo "foto" do multipart/form-data) e guarda em MEMÓRIA.
// De lá, o controller envia o arquivo para o Supabase Storage.
const multer = require('multer');
const AppError = require('../utils/AppError');

const TAMANHO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
  fileFilter: (req, file, cb) => {
    const permitidos = ['image/jpeg', 'image/png', 'image/webp'];
    if (!permitidos.includes(file.mimetype)) {
      return cb(new AppError('A foto deve ser uma imagem JPG, PNG ou WEBP.', 400));
    }
    cb(null, true);
  },
});

module.exports = upload.single('foto');
