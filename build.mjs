// Gera o index.html de arquivo único a partir de src/.
// Uso: node build.mjs            -> escreve ./index.html
//      node build.mjs --fragment caminho.html  -> também escreve só o conteúdo de <head>/<body> (para incorporar em outra página)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = p => readFileSync(join(root, 'src', p), 'utf8');

let html = src('index.html')
  .replace(/<link rel="stylesheet" href="styles\.css">/, () => `<style>\n${src('styles.css')}</style>`)
  .replace(/<script src="(js\/[\w.]+)"><\/script>/g, (_, p) => `<script>\n${src(p).replace(/<\/script/gi, '<\\/script')}</script>`);

writeFileSync(join(root, 'index.html'), html);
console.log(`index.html: ${(html.length / 1024).toFixed(1)} KB`);

const i = process.argv.indexOf('--fragment');
if (i > 0 && process.argv[i + 1]) {
  const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta (charset|name="viewport")[^>]*>\n?/g, '');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
  writeFileSync(process.argv[i + 1], head.trim() + '\n' + body.trim() + '\n');
  console.log(`fragmento: ${process.argv[i + 1]}`);
}
