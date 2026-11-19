# Traço UML

Editor de diagramas UML que roda direto no navegador, feito em HTML, CSS e JavaScript puros, num único arquivo (`index.html`) e sem dependências de build.

## Como usar

Abra o `index.html` no navegador, ou publique a pasta em qualquer hospedagem estática (GitHub Pages, Netlify, Nginx etc.).

Para rodar localmente com um servidor:

```bash
python3 -m http.server 8000
```

Depois acesse http://localhost:8000.

## Recursos

- Diagramas de **classes** e de **casos de uso**, vários diagramas por projeto
- Elementos: classe, interface, ator, caso de uso, nota e pacote
- Relações: associação (simples e dirigida), generalização, realização, dependência, agregação, composição, «include», «extend» e ligação de nota
- Painel de propriedades: nome, estereótipo, classe abstrata, atributos, operações e multiplicidades
- Desfazer e refazer, copiar, colar, duplicar, seleção por área, alinhamento, grade, zoom e mover a vista
- Salvamento automático no navegador (`localStorage`)
- Projeto salvo e aberto em JSON; exportação em SVG e PNG
- Tema claro e escuro, de acordo com o sistema; layout adaptado para celular

## Atalhos

| Tecla | Ação |
| --- | --- |
| `V` / `H` | Selecionar / mover vista |
| `C` `I` `A` `U` `N` `P` | Classe, interface, ator, caso de uso, nota, pacote |
| Espaço + arrastar | Mover a vista |
| Ctrl + roda | Zoom |
| Ctrl + Z / Ctrl + Y | Desfazer / refazer |
| Ctrl + C / V / D | Copiar / colar / duplicar |
| Del | Excluir seleção |
| Setas | Mover 10 px (Shift: 1 px) |
| Alt + arrastar | Mover sem grade |

## Limitações

- As relações são linhas retas, sem pontos de dobra.
- Não importa arquivos `.asta`.
