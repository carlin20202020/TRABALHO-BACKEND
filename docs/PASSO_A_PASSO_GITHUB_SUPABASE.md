# Passo a passo: Supabase + GitHub + projeto

## PARTE A — Supabase (banco e Storage)
1. Acesse **supabase.com**, crie a conta (pode entrar com o GitHub) e clique em **New project**.
   Nome: `sgoa` · defina uma senha do banco (anote) · Região: **South America (São Paulo)** · **Create new project**. Aguarde ~2 min.
2. Menu **SQL Editor → New query**. Abra o arquivo `database/schema.sql`, copie tudo, cole e clique em **Run**.
   Deve aparecer *Success*.
3. Confira: **Table Editor** mostra `usuarios`, `equipamentos`, `ocorrencias`, `comentarios`; **Storage** mostra o bucket `ocorrencias`.
   (Para o DER da Sprint 1, tire um print em **Database → Schema Visualizer**.)
4. Copie a **URL do projeto** (botão **Connect**, no topo do painel, ou **Project Settings**) e a **chave secreta**:
   **Project Settings → API Keys → Secret keys** (formato `sb_secret_...`). Se seu projeto só mostrar chaves antigas,
   use **Create new API Keys** ou, na aba **Legacy**, a `service_role`.
   Use SEMPRE a chave **secret/service_role** no backend. Nunca a `publishable`/`anon` e nunca publique a secreta.

## PARTE B — Ligando o projeto ao Supabase
5. Instale o **Node.js 20+** (nodejs.org) e confira com `node -v`.
6. Descompacte o projeto, abra a pasta no terminal e rode `npm install`.
7. O arquivo `.env` já vem criado com a URL do projeto e um `JWT_SECRET`. Abra-o e confira/preencha (se não existir, copie o `.env.example`):
   - `SUPABASE_URL` = URL do passo 4
   - `SUPABASE_SECRET_KEY` = chave secreta do passo 4
   - `JWT_SECRET` = gere com: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
   - `MATRICULA_REGEX` = confirme o padrão da matrícula com o professor
8. `npm run seed` cria os 4 usuários de demonstração e alguns equipamentos.
9. `npm run dev` e abra **http://localhost:3000**: é o site do sistema. (`/saude` deve responder `{"status":"ok"...}`.)
10. No **Postman** ou **Insomnia**: Import → `docs/SGOA.postman_collection.json`. Rode **Login** e depois as outras requisições.

## PARTE C — GitHub (versionamento)
11. Um integrante cria o repositório: github.com → **New repository** → nome `sgoa`. **Não** marque README nem .gitignore (o projeto já tem).
12. No repositório: **Settings → Collaborators → Add people** e convide os outros integrantes (e o professor, se ele pedir). Cada um aceita o convite pelo e-mail.
13. Em cada computador, instale o **Git** e configure (o e-mail deve ser o mesmo do GitHub, senão o commit não aparece no seu perfil):
    ```bash
    git config --global user.name "Seu Nome"
    git config --global user.email "seu-email-do-github@exemplo.com"
    ```
14. Primeiro commit (Sprint 1), feito por um integrante, na pasta do projeto:
    ```bash
    git init
    git branch -M main
    git remote add origin https://github.com/SEU-USUARIO/sgoa.git
    git status                       # o arquivo .env NÃO pode aparecer aqui
    git add package.json .gitignore .env.example README.md database docs/DER.md
    git commit -m "chore: estrutura base do projeto e modelagem do banco"
    git push -u origin main
    ```
    No primeiro `push`, o GitHub pede login (janela do navegador). Senha da conta não funciona no terminal: use o login pelo navegador, o GitHub Desktop, ou `gh auth login`.
15. Os outros integrantes: `git clone https://github.com/SEU-USUARIO/sgoa.git`, `npm install`, criam o próprio `.env`.
    Cada um cria uma branch (`git checkout -b feature/minha-parte`), commita as suas partes conforme `docs/PLANO_DE_COMMITS.md`,
    faz `git push -u origin feature/minha-parte` e abre um **Pull Request** no GitHub.
16. Faça isso **ao longo das sprints**, com commits pequenos e frequentes de todos.

**Se a chave secreta for enviada ao GitHub por engano:** no Supabase crie uma nova secret key, apague a antiga e atualize o `.env`.
