# app.salao — Lyra

Front React + Vite + TypeScript do **Lyra** (sistema Salão).

Login e JWT são os **mesmos** do Enterprise (Gateway → oAuth). Não há login próprio.

## Integração

| Peça | Valor |
|------|--------|
| Sistema | `LYR` (Lyra) |
| Módulo de segurança | `LYRA000000` (legado `LYR0000000`) |
| Gateway | `VITE_GATEWAY_URL` (local: `http://localhost:8080`) |
| API de negócio | `/api/salao/**` |
| Porta local | `3002` |
| Header | `X-Secret-Token` = `FRONTEND_SECRET_TOKEN` do Gateway |

## Rodar local

1. Copie `.env.example` → `.env.local`
2. Em `VITE_LYRA_AMBIENTE` / `VITE_GATEWAY_AMBIENTE` use `homolog` (VPS) ou `local` (Gateway na sua máquina)
3. `npm install && npm run dev`
4. Abra `http://localhost:3002`

Ou, na raiz do workspace Enterprise: edite `env.ambiente` e rode `node scripts/aplicar-ambiente.mjs`.

O painel chama `GET /api/salao/me` no Gateway escolhido.

## CI/CD

Push em `production` faz deploy na VPS (`https://enterprise.lumenemotion.com.br/lyra/`).
Secrets: os mesmos do Gateway (`VPS_*`) + `FRONTEND_SECRET_TOKEN`.

## Módulos

- `LYRA000000` Segurança / Início → `/inicio`
- `LYR0000000` Legado (ainda aceito)
- `LYR0000001` Agenda → `/agenda`
- `LYR0000002` Serviços → `/servicos`
- `LYR0000003` Clientes → `/clientes`

Conceda via `usuario_modulo` / perfil no ASC. Sem isso o JWT vem com `modulos: []`.
