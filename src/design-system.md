# Lyra — design system (Golden Hour)

Fonte da verdade: paleta do preview Lovable. Tokens em [`tailwind.css`](./tailwind.css).

**Dark (canônico):** superfícies carvão + cobre/ember.  
**Light:** o mesmo cobre sobre papel quente (inversão para o toggle).

## Tipografia

| Papel | Família |
|-------|---------|
| UI / body | **Inter** |
| Display / marca | **Archivo** |
| Mono | **JetBrains Mono** |

## Tokens (oklch)

| Token | Dark | Uso |
|-------|------|-----|
| `--background` | `oklch(0.155 0.008 265)` | canvas |
| `--panel` | `oklch(0.208 0.008 265)` | sidebar / painel |
| `--panel2` / `--card` | `oklch(0.245 0.009 265)` | cards, header |
| `--line` | `oklch(0.31 0.01 265)` | bordas |
| `--ink` | `oklch(0.95 0.002 210)` | texto |
| `--faint` | `oklch(0.48 0.015 255)` | terciário |
| `--copper` | `oklch(0.7 0.115 60)` | primary / CTA / tile ASC |
| `--ember` | `oklch(0.78 0.12 60)` | hover, gradiente |
| `--warn` | `oklch(0.79 0.13 85)` | alerta |
| `--ok` | `oklch(0.76 0.09 150)` | sucesso |
| `--destructive` | `oklch(0.62 0.19 25)` | erro |

`--radius`: `0.75rem`. CTA: `linear-gradient(140deg, ember, copper)`.

## Utilitários

`lyra-card` · `lyra-cta` · `lyra-glow` · `lyra-rise` · `lyra-row`

## Regras

- Sem hex nas páginas — só `var(--*)`
- Tema: `.dark` no `<html>`, `localStorage` `lyra-theme`; **padrão dark** (como o Lovable)
- O app usa Tailwind 3: a folha original (`@theme inline` / `@utility`) foi traduzida, com os mesmos valores
