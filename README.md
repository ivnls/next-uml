# NextUML

Editor de **diagramas de classes UML** que roda direto no navegador, feito em HTML, CSS e JavaScript puros, sem dependências. O build gera um único `index.html`, que pode ser aberto localmente ou publicado em qualquer hospedagem estática.

## O que ele faz

### Modelo compartilhado
- Os elementos ficam num **modelo** único, e os diagramas mostram partes dele. A mesma classe pode aparecer em vários diagramas, e uma alteração vale em todos.
- **Navegador do modelo**: árvore de pacotes com busca. Para mostrar um elemento no diagrama atual, arraste-o para a folha ou dê duplo clique.
- **Del** tira o elemento do diagrama; **Shift+Del** exclui do modelo.
- **Copiar e colar**: num diagrama onde o elemento ainda não aparece, colar reutiliza o mesmo elemento; no mesmo diagrama, colar cria uma cópia.

### Elementos
- Classe, interface, enumeração, tipo de dado (`«dataType»`), tipo primitivo, objeto (instância), pacote, nota e associação n-ária.
- Classe abstrata (nome em itálico), classe final `{leaf}`, estereótipos e classes genéricas, com a caixa tracejada de parâmetros de template.
- Interface exibida como caixa ou como círculo (notação pirulito).
- Objetos com classificador e valores (slots), com o nome sublinhado (`ana : Leitor`).

### Atributos e operações
- Sintaxe UML completa: `- /autores: String [1..*] = x {readOnly, ordered}` e `+ buscar(in filtro: Map<String, Livro>, limite: int = 10): List<Livro> [0..1] {query}`.
- Membros **estáticos sublinhados** e operações **abstratas em itálico**.
- Edição direta na caixa: duplo clique no nome ou num membro. **Tab** cria o próximo membro.
- Edição também no painel de propriedades, uma linha por membro. **Enter** cria a próxima linha.

### Relações
- Associação (simples, dirigida, agregação e composição), generalização, realização, dependência (com estereótipos como `«use»`), classe de associação e ligação de nota.
- Cada ponta da associação tem nome de papel com visibilidade, multiplicidade, navegabilidade (seta ou ×), agregação, restrição (`{ordered}`) e qualificador.
- **Reconexão**: arraste as bolinhas das pontas para outro elemento.
- **Traçado**: linhas retas ou ortogonais. Para criar dobras, arraste os pontos do meio; duplo clique numa dobra a remove.
- Relações paralelas entre as mesmas classes são separadas automaticamente, e os rótulos podem ser arrastados.

### Edição
- Desfazer e refazer, seleção por área, alinhar e distribuir, mesma largura, redimensionar e cores por elemento.
- Ocultar atributos ou operações por diagrama; ocultar visibilidade ou tipos no diagrama inteiro.
- Menu de contexto (botão direito, ou toque longo no celular), minimapa, zoom e organização automática do layout.
- Funciona no celular: os painéis viram gavetas.

### Verificação, código e formatos
- **Verificar modelo**: tipos inexistentes, nomes duplicados, herança circular, operação abstrata em classe concreta, interface não implementada, composição com multiplicidade inválida, objetos com valores que não existem na classe e outros.
- **Gerar código** em Java, TypeScript e Python: pacotes, heranças, interfaces, enums, atributos, associações navegáveis, qualificadores e assinaturas. Os métodos vêm com corpo vazio.
- **Importar código** Java ou TypeScript. Cria classes, heranças e realizações, e pode transformar atributos em associações.
- **Exportar**: SVG, PNG, XMI 2.5.1 (UML 2.5) e o projeto em JSON.
- O projeto é salvo automaticamente no navegador (`localStorage`). Projetos da versão anterior podem ser recuperados em **Abrir**.

## Como usar

Abra o `index.html` no navegador. Para servir localmente:

```bash
python3 -m http.server 8000
```

Depois acesse http://localhost:8000.

### Atalhos

| Tecla | Ação |
| --- | --- |
| `V` / `H` | Selecionar / mover vista |
| `C` `I` `E` `T` `O` `P` `N` | Classe, interface, enumeração, tipo de dado, objeto, pacote, nota |
| `A` `G` `R` `D` | Associação, generalização, realização, dependência |
| Duplo clique | Editar nome ou membro na própria caixa |
| `F2` / `Enter` | Renomear a seleção |
| `Tab` (editando membro) | Confirmar e criar o próximo |
| `Del` / `Shift+Del` | Tirar do diagrama / excluir do modelo |
| `Ctrl+C` / `Ctrl+V` / `Ctrl+D` | Copiar / colar / duplicar |
| `Ctrl+Z` / `Ctrl+Y` | Desfazer / refazer |
| `Ctrl+F` | Buscar no modelo |
| `Ctrl+S` | Salvar |
| `Ctrl` + roda | Zoom |
| `Espaço` + arrastar | Mover a vista |
| `Alt` + arrastar | Mover sem encaixar na grade |
| Setas | Mover a seleção 10 px (com `Shift`, 1 px) |
| `0` | Enquadrar o diagrama |

Duplo clique numa ferramenta a mantém ativa para inserir vários elementos seguidos.

## Desenvolvimento

O código-fonte fica em `src/`, e o `index.html` da raiz é gerado a partir dele.

```
src/
  index.html      estrutura da página
  styles.css      estilos (tema claro e escuro)
  js/core.js      modelo de dados, sintaxe UML, normalização e migração
  js/codegen.js   verificação, geração de código, XMI e importação de código
  js/render.js    layout e desenho SVG dos diagramas
  js/app.js       editor: interação, painéis, menus e janelas
tests/            testes do modelo, da geração e da importação (Node)
build.mjs         gera o index.html de arquivo único
```

Para desenvolver, abra `src/index.html` direto: ele carrega os arquivos separados. Depois de alterar algo em `src/`, gere o arquivo único e rode os testes:

```bash
node build.mjs
```

```bash
npm test
```

Os testes usam apenas o executor nativo do Node (versão 18 ou mais nova).

## Publicação

Qualquer hospedagem estática serve. No GitHub Pages, vá em **Settings → Pages**, escolha **Deploy from a branch** e selecione `main` com a pasta `/ (root)`. Para usar um domínio próprio, preencha **Custom domain** na mesma tela e crie o registro DNS indicado pelo GitHub.

## Limitações

- O projeto fica no navegador de quem usa. Para levar a outro computador ou compartilhar, use **Salvar** (JSON) e **Abrir**. Não há edição simultânea entre pessoas.
- A importação de código reconhece declarações de classes, interfaces, enums, records, campos e métodos, mas não é um compilador: código muito incomum pode não ser lido por completo.
- O XMI exporta o modelo, não a posição dos elementos nos diagramas. A classe de associação sai como associação comum mais um comentário.
- Não abre arquivos `.asta`.
