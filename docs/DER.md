# DER — Diagrama Entidade-Relacionamento (Sprint 1)

O GitHub desenha o diagrama abaixo automaticamente. Para a entrega, você também pode tirar um print em
**Supabase → Database → Schema Visualizer**.

```mermaid
erDiagram
    USUARIOS {
        uuid id PK
        text nome
        text email UK
        text senha_hash
        text matricula UK
        text perfil "Aluno | Professor | Administrador (so 1)"
        timestamptz criado_em
    }
    EQUIPAMENTOS {
        uuid id PK
        text nome
        text tipo
        text numero_patrimonio UK "tombo estadual"
        text localizacao
        text status
        uuid sala_id FK
        uuid criado_por FK
    }
    SALAS {
        uuid id PK
        text nome UK
        text descricao
    }
    OCORRENCIAS {
        uuid id PK
        text titulo
        text descricao
        text categoria
        text status "Aberto | Em Andamento | Resolvido"
        text prioridade "Alta Prioridade | Media Prioridade"
        text foto_url
        text numero_patrimonio_resolvido
        uuid usuario_id FK "quem abriu"
        uuid equipamento_id FK
        uuid tecnico_id FK "quem atendeu"
        timestamptz resolvido_em
    }
    COMENTARIOS {
        uuid id PK
        uuid ocorrencia_id FK
        uuid usuario_id FK
        text texto
        timestamptz criado_em
    }

    USUARIOS ||--o{ OCORRENCIAS : "abre"
    USUARIOS ||--o{ OCORRENCIAS : "atende (administrador)"
    SALAS ||--o{ EQUIPAMENTOS : "abriga"
    EQUIPAMENTOS ||--o{ OCORRENCIAS : "é alvo de"
    OCORRENCIAS ||--o{ COMENTARIOS : "recebe"
    USUARIOS ||--o{ COMENTARIOS : "escreve"
    USUARIOS ||--o{ EQUIPAMENTOS : "cadastra"
```
