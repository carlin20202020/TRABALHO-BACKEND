// Popula o banco com dados de DEMONSTRAÇÃO (uso: npm run seed). Pode rodar várias vezes.
// É aqui que nasce o ÚNICO Administrador do sistema (a API não permite criar outro).
const bcrypt = require('bcryptjs');
const supabase = require('../src/config/supabase');

const SENHA_DEMO = 'Senha@123';

const USUARIOS = [
  { nome: 'Administrador Escola', email: 'admin@escola.pr.gov.br', matricula: '900000001', perfil: 'Administrador' },
  { nome: 'Professora Maria', email: 'professor@escola.pr.gov.br', matricula: '900000003', perfil: 'Professor' },
  { nome: 'Aluno Joao', email: 'aluno@escola.pr.gov.br', matricula: '900000004', perfil: 'Aluno' },
];

const SALAS = [
  { nome: 'Laboratório de Informática 1', descricao: 'Laboratório principal de informática' },
  { nome: 'Laboratório de Informática 2', descricao: 'Laboratório de informática - turmas do técnico' },
  { nome: 'Sala 5', descricao: 'Sala de aula comum' },
];

const EQUIPAMENTOS = [
  { nome: 'Computador 01', tipo: 'Computador', numero_patrimonio: '100001', sala: 'Laboratório de Informática 1' },
  { nome: 'Computador 02', tipo: 'Computador', numero_patrimonio: '100002', sala: 'Laboratório de Informática 1' },
  { nome: 'Projetor Sala 5', tipo: 'Projetor', numero_patrimonio: '100003', sala: 'Sala 5' },
  { nome: 'Cadeira 12', tipo: 'Cadeira', numero_patrimonio: '100004', sala: 'Laboratório de Informática 2' },
];

async function main() {
  const senha_hash = await bcrypt.hash(SENHA_DEMO, 10);

  const { data: usuarios, error: erroUsuarios } = await supabase
    .from('usuarios')
    .upsert(USUARIOS.map((u) => ({ ...u, senha_hash })), { onConflict: 'email' })
    .select('id, email, perfil');
  if (erroUsuarios) throw erroUsuarios;

  // A conta "técnico" da versão anterior não existe mais (tenta apagar; se tiver vínculos, ela já virou Professor)
  await supabase.from('usuarios').delete().eq('email', 'tecnico@escola.pr.gov.br');

  const { data: salas, error: erroSalas } = await supabase.from('salas').upsert(SALAS, { onConflict: 'nome' }).select('id, nome');
  if (erroSalas) throw erroSalas;

  const admin = usuarios.find((u) => u.perfil === 'Administrador');
  const { error: erroEquip } = await supabase.from('equipamentos').upsert(
    EQUIPAMENTOS.map(({ sala, ...e }) => {
      const s = salas.find((x) => x.nome === sala);
      return { ...e, localizacao: s.nome, sala_id: s.id, criado_por: admin.id };
    }),
    { onConflict: 'numero_patrimonio' }
  );
  if (erroEquip) throw erroEquip;

  console.log('Seed concluído! Contas de demonstração (senha de todas: ' + SENHA_DEMO + '):');
  USUARIOS.forEach((u) => console.log(`  - ${u.perfil.padEnd(13)} ${u.email}`));
}

main().catch((erro) => {
  console.error('Falha no seed:', erro.message || erro);
  process.exit(1);
});
