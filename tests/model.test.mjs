import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../src/js/core.js');
require('../src/js/codegen.js');
const U = globalThis.UML;

test('lê e escreve atributos na sintaxe UML', () => {
  const a = U.parseAttr('- /autores: String [1..*] = "x" {readOnly, ordered}');
  assert.equal(a.vis, '-');
  assert.equal(a.derived, true);
  assert.equal(a.name, 'autores');
  assert.equal(a.type, 'String');
  assert.equal(a.mult, '1..*');
  assert.equal(a.def, '"x"');
  assert.equal(a.readOnly, true);
  assert.equal(a.props, 'ordered');
  assert.equal(U.fmtAttr(a), '- /autores: String [1..*] = "x" {readOnly, ordered}');
  assert.equal(U.parseAttr('nomes: String[]').type, 'String[]');
});

test('lê operações com parâmetros genéricos, direção e valor padrão', () => {
  const o = U.parseOp('+ buscar(in filtro: Map<String, List<Livro>>, limite: int = 10): List<Livro> {query}');
  assert.equal(o.name, 'buscar');
  assert.equal(o.params.length, 2);
  assert.equal(o.params[0].dir, 'in');
  assert.equal(o.params[0].type, 'Map<String, List<Livro>>');
  assert.equal(o.params[1].def, '10');
  assert.equal(o.ret, 'List<Livro>');
  assert.equal(o.props, 'query');
  assert.equal(U.fmtOp(o), '+ buscar(filtro: Map<String, List<Livro>>, limite: int = 10): List<Livro> {query}');
  assert.equal(U.fmtOp(o, { hideTypes: true, hideVis: true }), 'buscar(filtro, limite)');
});

test('interpreta multiplicidades', () => {
  assert.deepEqual(U.multBounds('0..*'), { lower: 0, upper: Infinity });
  assert.deepEqual(U.multBounds('1'), { lower: 1, upper: 1 });
  assert.equal(U.isMany('1..*'), true);
  assert.equal(U.isMany('0..1'), false);
  assert.equal(U.isOptional('0..1'), true);
});

test('o exemplo é consistente e passa na verificação', () => {
  const p = U.normalize(U.sample());
  assert.equal(p.diagrams.length, 3);
  const livro = U.classifierByName(p, 'Livro');
  const emQuantos = p.diagrams.filter(d => d.views.some(v => v.ref === livro.id)).length;
  assert.equal(emQuantos, 2, 'Livro aparece em dois diagramas do mesmo modelo');
  assert.deepEqual(U.validate(p).filter(i => i.level === 'error'), []);
});

test('a verificação encontra erros comuns', () => {
  const p = U.newProject();
  const a = U.newElement('class', 'A'), b = U.newElement('class', 'B');
  a.operations.push(U.op('+ f(): Inexistente', { isAbstract: true }));
  p.elements[a.id] = a; p.elements[b.id] = b;
  const g1 = U.newRelation('generalization', a.id, b.id), g2 = U.newRelation('generalization', b.id, a.id);
  p.relations[g1.id] = g1; p.relations[g2.id] = g2;
  const msgs = U.validate(p).map(i => i.msg).join('\n');
  assert.match(msgs, /Herança circular/);
  assert.match(msgs, /operação abstrata f\(\) mas não é abstrata/);
  assert.match(msgs, /Tipo “Inexistente” não existe/);
});

test('normaliza e migra projetos da versão 1', () => {
  const v1 = { diagrams: [{ id: 'd', name: 'D', nodes: [
    { id: 'n1', type: 'class', name: 'A', x: 0, y: 0, attrs: ['- x: int'], ops: ['+ f(): void'] },
    { id: 'n2', type: 'class', name: 'Cor', stereotype: 'enumeration', x: 0, y: 0, attrs: ['VERDE', 'AZUL'], ops: [] },
    { id: 'n3', type: 'actor', name: 'Ator', x: 0, y: 0 },
  ], edges: [{ id: 'e', type: 'composition', from: 'n1', to: 'n2', srcMult: '1' }] }], current: 'd' };
  const p = U.normalize(v1);
  assert.equal(Object.keys(p.elements).length, 2);
  const cor = U.classifierByName(p, 'Cor');
  assert.equal(cor.kind, 'enumeration');
  assert.deepEqual(cor.literals.map(l => l.name), ['VERDE', 'AZUL']);
  const r = Object.values(p.relations)[0];
  assert.equal(r.ends[1].agg, 'composite');
  assert.throws(() => U.normalize({ foo: 1 }), /não parece ser um projeto/);
});

test('gera Java, TypeScript e Python a partir do modelo', () => {
  const p = U.normalize(U.sample());
  const java = U.generate(p, 'java').find(f => f.file.endsWith('/Leitor.java')).code;
  assert.match(java, /package biblioteca\.dominio;/);
  assert.match(java, /public class Leitor extends Pessoa implements Notificavel/);
  assert.match(java, /private List<Emprestimo> emprestimos = new ArrayList<>\(\);/);
  const pessoa = U.generate(p, 'java').find(f => f.file.endsWith('/Pessoa.java')).code;
  assert.match(pessoa, /public abstract class Pessoa/);
  assert.match(pessoa, /private static int total = 0;/);
  assert.match(pessoa, /public abstract boolean validarDocumento\(\);/);
  const acervo = U.generate(p, 'java').find(f => f.file.endsWith('/Acervo.java')).code;
  assert.match(acervo, /public final class Acervo/);
  assert.match(acervo, /Map<String, Livro> livro = new HashMap<>\(\);/);
  const ts = U.generate(p, 'ts').find(f => f.file === 'EstadoExemplar.ts').code;
  assert.match(ts, /export enum EstadoExemplar \{/);
  const repo = U.generate(p, 'ts').find(f => f.file === 'Repositorio.ts').code;
  assert.match(repo, /export interface Repositorio<T>/);
  assert.match(repo, /listar\(\): T\[\];/);
  const py = U.generate(p, 'python').find(f => f.file.endsWith('pessoa.py')).code;
  assert.match(py, /class Pessoa\(ABC\):/);
  assert.match(py, /@abstractmethod/);
});

test('exporta XMI com classes, associações e generalizações', () => {
  const p = U.normalize(U.sample());
  const x = U.exportXMI(p);
  assert.match(x, /^<\?xml version="1.0"/);
  assert.match(x, /xmi:type="uml:Class" xmi:id="[^"]+" name="Pessoa" isAbstract="true"/);
  assert.match(x, /xmi:type="uml:Enumeration"/);
  assert.match(x, /aggregation="composite"/);
  assert.match(x, /<generalization xmi:type="uml:Generalization"/);
  assert.equal((x.match(/<packagedElement/g) || []).length, (x.match(/<\/packagedElement>|<packagedElement[^>]*\/>/g) || []).length);
});

test('importa Java com herança, genéricos, enums e associações', () => {
  const src = `package loja.dominio;
    /** Pedido do cliente */
    public abstract class Pedido<T> extends Documento implements Pagavel {
      private List<Item> itens = new ArrayList<>();
      private Cliente cliente;
      public static final int LIMITE = 10;
      @Override
      public BigDecimal total(int desconto, final String... cupons) { return null; }
      protected abstract void validar();
      public Pedido() {}
    }
    class Item { private int quantidade; }
    class Cliente { private String nome; }
    class Documento {}
    interface Pagavel { void pagar(); }
    enum Status { ABERTO, PAGO("p"), CANCELADO; private String c; }`;
  const types = U.parseJava(src);
  assert.deepEqual(types.map(t => t.name), ['Pedido', 'Item', 'Cliente', 'Documento', 'Pagavel', 'Status']);
  const ped = types[0];
  assert.equal(ped.isAbstract, true);
  assert.equal(ped.templateParams, 'T');
  assert.deepEqual(ped.extends, ['Documento']);
  assert.deepEqual(ped.implements, ['Pagavel']);
  assert.equal(ped.operations.find(o => o.name === 'total').params[1].type, 'String[]');
  assert.equal(ped.operations.length, 2, 'construtor não vira operação');
  assert.deepEqual(types[5].literals, ['ABERTO', 'PAGO', 'CANCELADO']);

  const p = U.newProject();
  const res = U.importTypes(p, types, { assoc: true });
  assert.equal(res.created.length, 6);
  const pedido = U.classifierByName(p, 'Pedido');
  assert.equal(U.qualifiedPackage(p, pedido.package), 'loja.dominio');
  assert.deepEqual(pedido.attributes.map(a => a.name), ['LIMITE'], 'itens e cliente viram associações');
  const assoc = Object.values(p.relations).filter(r => r.kind === 'association');
  assert.equal(assoc.length, 2);
  assert.equal(assoc.find(r => r.ends[1].role === 'itens').ends[1].mult, '0..*');
  assert.equal(Object.values(p.relations).filter(r => r.kind === 'generalization').length, 1);
  assert.equal(Object.values(p.relations).filter(r => r.kind === 'realization').length, 1);
});

test('importa TypeScript com propriedades do construtor e membros opcionais', () => {
  const types = U.parseTS(`
    export abstract class Conta extends Base implements Auditavel {
      private saldo: number = 0
      readonly titular?: string
      #segredo: string;
      constructor(private banco: Banco, public numero: string) { super() }
      abstract taxa(valor: number, moeda?: string): Promise<number>
      static criar(): Conta { return null as any }
      get resumo() { return '' }
    }
    export enum Tipo { CORRENTE = 'c', POUPANCA }
    interface Auditavel { auditar(): void; ultimo?: Date }`);
  const c = types[0];
  assert.equal(c.isAbstract, true);
  assert.deepEqual(c.attributes.map(a => `${a.vis}${a.name}`), ['-saldo', '+titular', '-segredo', '-banco', '+numero']);
  assert.equal(c.attributes[1].mult, '0..1');
  assert.deepEqual(c.operations.map(o => o.name), ['taxa', 'criar']);
  assert.equal(c.operations[0].params[1].mult, '0..1');
  assert.deepEqual(types[1].literals, ['CORRENTE', 'POUPANCA']);
  assert.deepEqual(types[2].attributes.map(a => a.name), ['ultimo']);
});

test('guarda a multiplicidade do retorno separada do tipo', () => {
  const o = U.parseOp('+ buscar(isbn: String): Livro [0..1]');
  assert.equal(o.ret, 'Livro');
  assert.equal(o.retMult, '0..1');
  assert.equal(U.fmtOp(o), '+ buscar(isbn: String): Livro [0..1]');
});

test('qualifica literais de enumeração e converte tipos de tempo', () => {
  const p = U.newProject();
  const en = Object.assign(U.newElement('enumeration', 'Estagio'), { literals: [U.lit('SEMENTE'), U.lit('MUDA')] });
  const c = U.newElement('class', 'Arvore');
  c.attributes = [U.attr('- estagio: Estagio = SEMENTE'), U.attr('- inicio: LocalTime'), U.attr('- duracao: Duration')];
  p.elements[en.id] = en; p.elements[c.id] = c;
  const get = (lang, f) => U.generate(p, lang).find(x => x.file.endsWith(f)).code;
  assert.match(get('java', 'Arvore.java'), /private Estagio estagio = Estagio\.SEMENTE;/);
  const ts = get('ts', 'Arvore.ts');
  assert.match(ts, /estagio: Estagio = Estagio\.SEMENTE;/);
  assert.match(ts, /inicio!: string;/);
  assert.match(ts, /duracao!: number;/);
  const py = get('python', 'arvore.py');
  assert.match(py, /from \.estagio import Estagio/);
  assert.match(py, /= Estagio\.SEMENTE/);
  assert.match(py, /from datetime import time, timedelta/);
});
