# Tokens de design

Implementados como variáveis CSS em `web/src/index.css` (mapeadas para os nomes do shadcn/ui).
O tema é **somente escuro**.

## Cores

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#0B0D0E` | Fundo do app (charcoal quase preto) |
| `--card` | `#111416` | Painéis: barras, sidebar, cards |
| `--surface-2` / `--secondary` / `--muted` / `--accent` | `#181C1F` | Superfície elevada, hover, campos |
| `--border` | `#23292D` | Divisórias discretas |
| `--input` | `#2D3439` | Bordas de campos e botões |
| `--foreground` | `#E8ECEE` | Texto principal |
| `--muted-foreground` | `#8A949B` | Texto secundário, rótulos, métricas |
| `--subtle` | `#5B656B` | Texto terciário, ícones desabilitados |
| `--primary` (**destaque**) | `#8CF04A` | A **única** cor de destaque: seleção, estado ativo, "Transmitindo", foco |
| `--primary-foreground` | `#0B0D0E` | Texto sobre o verde |
| `--live` / `--destructive` | `#F0443A` | **Somente** LIVE, Parar transmissão e Sair da sala |
| `--warning` | `#E3B341` | Exceção de status: conexão instável (só no ponto de 8 px) |

Regras:
- Verde e vermelho nunca aparecem como decoração; cada ocorrência comunica um estado.
- Sem gradientes, blur, glassmorphism ou brilho. A única "luz" permitida é o anel sutil do botão
  **Transmitir** quando ativo (feedback forte pedido na spec).
- Transparências do destaque (`primary/10`, `primary/40`) só em fundos e bordas de estados ativos.

## Tipografia

| Família | Uso |
| --- | --- |
| **Inter** (variável) | Toda a interface |
| **JetBrains Mono** (variável) | Métricas (ping, FPS, bitrate), código da sala, cronômetros |

Tamanhos: 11 px (rótulos de métricas, badges), 12–13 px (secundário), 14 px (corpo), 16 px (títulos
de barra). Números sempre com `tabular-nums`.

## Forma e espaço

- Raio pequeno e industrial: `--radius: 0.375rem` (6 px). Badges retangulares, não pílulas.
- Divisórias de 1 px; nada de sombra, exceto popovers.
- Espaçamento base de 4 px; barras com 56 px (superior) e 64 px (inferior).

## Estados de conexão (ponto no avatar)

| Qualidade LiveKit | Cor |
| --- | --- |
| Excelente / Boa | `--primary` |
| Ruim | `--warning` |
| Perdida / desconhecida | `--subtle` |
