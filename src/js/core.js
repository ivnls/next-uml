/* NextUML — modelo de dados, sintaxe UML de membros, normalização e migração.
   Não depende do DOM: roda no navegador e no Node (testes). */
(function (G) {
  'use strict';
  const UML = (G.UML = G.UML || {});
  const uid = (UML.uid = () => Math.random().toString(36).slice(2, 10));

  UML.KINDS = {
    class: { label: 'Classe', classifier: true },
    interface: { label: 'Interface', classifier: true },
    enumeration: { label: 'Enumeração', classifier: true },
    datatype: { label: 'Tipo de dado', classifier: true },
    primitive: { label: 'Tipo primitivo', classifier: true },
    object: { label: 'Objeto' },
    package: { label: 'Pacote' },
    note: { label: 'Nota' },
    nary: { label: 'Associação n-ária' },
  };
  UML.isClassifier = k => !!(UML.KINDS[k] && UML.KINDS[k].classifier);

  UML.REL = {
    association: { label: 'Associação' },
    generalization: { label: 'Generalização' },
    realization: { label: 'Realização' },
    dependency: { label: 'Dependência' },
    anchor: { label: 'Ligação de nota' },
  };

  UML.KNOWN_TYPES = new Set([
    'void', 'int', 'long', 'short', 'byte', 'float', 'double', 'boolean', 'char',
    'String', 'Integer', 'Long', 'Short', 'Byte', 'Float', 'Double', 'Boolean', 'Character', 'Object',
    'Date', 'LocalDate', 'LocalDateTime', 'LocalTime', 'Instant', 'Duration', 'BigDecimal', 'BigInteger', 'UUID',
    'List', 'Set', 'Map', 'Collection', 'Optional', 'Iterable', 'ArrayList', 'HashMap', 'HashSet',
    'number', 'string', 'any', 'unknown', 'never', 'Array', 'Promise', 'Record', 'Readonly',
    'str', 'bool', 'float', 'list', 'dict', 'set', 'tuple', 'None', 'Decimal', 'datetime', 'date',
  ]);

  /* ---------- varredura respeitando aninhamento e aspas ---------- */
  function topLevel(s, test) {
    let depth = 0, q = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if (ch === '<' || ch === '(' || ch === '[' || ch === '{') { depth++; continue; }
      if (ch === '>' || ch === ')' || ch === ']' || ch === '}') { if (ch === '>' && s[i - 1] === '=') continue; depth = Math.max(0, depth - 1); continue; }
      if (depth === 0 && test(ch, i, s)) return i;
    }
    return -1;
  }
  UML.topLevel = topLevel;
  UML.splitTop = function (s, sep) {
    const out = [];
    let rest = String(s || '');
    for (;;) {
      const i = topLevel(rest, ch => ch === sep);
      if (i < 0) { out.push(rest); break; }
      out.push(rest.slice(0, i));
      rest = rest.slice(i + 1);
    }
    return out.map(x => x.trim()).filter(Boolean);
  };
  const isEq = (ch, i, s) => ch === '=' && s[i + 1] !== '>' && s[i + 1] !== '=' && s[i - 1] !== '=' && s[i - 1] !== '!';

  /* ---------- sintaxe UML: atributos, parâmetros, operações ---------- */
  UML.parseAttr = function (src) {
    let t = String(src || '').trim();
    const a = { vis: '', name: '', type: '', mult: '', def: '', derived: false, readOnly: false, props: '' };
    const vm = t.match(/^([+\-#~])\s*/);
    if (vm) { a.vis = vm[1]; t = t.slice(vm[0].length); }
    if (t[0] === '/') { a.derived = true; t = t.slice(1).trim(); }
    const pm = t.match(/\{([^{}]*)\}\s*$/);
    if (pm) {
      const ps = pm[1].split(',').map(x => x.trim()).filter(Boolean);
      a.readOnly = ps.includes('readOnly');
      a.props = ps.filter(x => x !== 'readOnly').join(', ');
      t = t.slice(0, pm.index).trim();
    }
    const eq = topLevel(t, isEq);
    if (eq >= 0) { a.def = t.slice(eq + 1).trim(); t = t.slice(0, eq).trim(); }
    const mm = t.match(/\[([^\]]+)\]\s*$/);
    if (mm) { a.mult = mm[1].trim(); t = t.slice(0, mm.index).trim(); }
    const c = topLevel(t, ch => ch === ':');
    if (c >= 0) { a.type = t.slice(c + 1).trim(); t = t.slice(0, c).trim(); }
    a.name = t;
    return a;
  };

  function parseParam(src) {
    let t = String(src || '').trim();
    const p = { dir: '', name: '', type: '', mult: '', def: '' };
    const dm = t.match(/^(in|out|inout)\s+/);
    if (dm) { p.dir = dm[1]; t = t.slice(dm[0].length); }
    const eq = topLevel(t, isEq);
    if (eq >= 0) { p.def = t.slice(eq + 1).trim(); t = t.slice(0, eq).trim(); }
    const mm = t.match(/\[([^\]]+)\]\s*$/);
    if (mm) { p.mult = mm[1].trim(); t = t.slice(0, mm.index).trim(); }
    const c = topLevel(t, ch => ch === ':');
    if (c >= 0) { p.name = t.slice(0, c).trim(); p.type = t.slice(c + 1).trim(); }
    else {
      const jm = t.match(/^(.+?)\s+([A-Za-z_$][\w$]*)$/);
      if (jm) { p.type = jm[1].trim(); p.name = jm[2]; } else p.name = t;
    }
    if (p.name.endsWith('?')) { p.name = p.name.slice(0, -1); if (!p.mult) p.mult = '0..1'; }
    return p;
  }
  UML.parseParam = parseParam;

  UML.parseOp = function (src) {
    let t = String(src || '').trim();
    const o = { vis: '', name: '', params: [], ret: '', retMult: '', props: '' };
    const vm = t.match(/^([+\-#~])\s*/);
    if (vm) { o.vis = vm[1]; t = t.slice(vm[0].length); }
    const pm = t.match(/\{([^{}]*)\}\s*$/);
    if (pm) { o.props = pm[1].trim(); t = t.slice(0, pm.index).trim(); }
    const open = t.indexOf('(');
    if (open < 0) {
      const c = topLevel(t, ch => ch === ':');
      if (c >= 0) { o.ret = t.slice(c + 1).trim(); t = t.slice(0, c).trim(); }
      o.name = t;
      return o;
    }
    o.name = t.slice(0, open).trim();
    let depth = 0, close = -1;
    for (let i = open; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') { depth--; if (depth === 0) { close = i; break; } }
    }
    const inner = t.slice(open + 1, close < 0 ? t.length : close);
    const rest = close < 0 ? '' : t.slice(close + 1).trim();
    if (rest[0] === ':') o.ret = rest.slice(1).trim();
    const rm = o.ret.match(/\s*\[([^\]]+)\]\s*$/);
    if (rm) { o.retMult = rm[1].trim(); o.ret = o.ret.slice(0, rm.index).trim(); }
    o.params = UML.splitTop(inner, ',').map(parseParam).filter(p => p.name || p.type);
    return o;
  };

  UML.parseSlot = function (src) {
    const t = String(src || '');
    const i = t.indexOf('=');
    return i < 0 ? { feature: t.trim(), value: '' } : { feature: t.slice(0, i).trim(), value: t.slice(i + 1).trim() };
  };

  UML.fmtAttr = function (a, o = {}) {
    let s = (!o.hideVis && a.vis ? a.vis + ' ' : '') + (a.derived ? '/' : '') + a.name;
    if (!o.hideTypes) {
      if (a.type) s += ': ' + a.type;
      if (a.mult) s += ' [' + a.mult + ']';
      if (a.def !== '' && a.def != null) s += ' = ' + a.def;
      const props = [a.readOnly ? 'readOnly' : '', a.props].filter(Boolean).join(', ');
      if (props) s += ' {' + props + '}';
    }
    return s;
  };
  UML.fmtParam = function (p, o = {}) {
    let s = (p.dir && p.dir !== 'in' ? p.dir + ' ' : '') + (p.name || '');
    if (!o.hideTypes) {
      if (p.type) s += (p.name ? ': ' : '') + p.type;
      if (p.mult) s += '[' + p.mult + ']';
      if (p.def) s += ' = ' + p.def;
    } else if (!p.name) s += p.type;
    return s;
  };
  UML.fmtOp = function (op, o = {}) {
    let s = (!o.hideVis && op.vis ? op.vis + ' ' : '') + op.name + '(' + op.params.map(p => UML.fmtParam(p, o)).join(', ') + ')';
    if (!o.hideTypes) {
      if (op.ret) s += ': ' + op.ret + (op.retMult ? ' [' + op.retMult + ']' : '');
      if (op.props) s += ' {' + op.props + '}';
    }
    return s;
  };
  UML.fmtSlot = s => s.feature + ' = ' + (s.value || '');

  UML.multBounds = function (m) {
    m = String(m || '').trim();
    if (!m) return null;
    if (m === '*') return { lower: 0, upper: Infinity };
    const parts = m.split('..');
    const lo = parts[0].trim(), hi = (parts.length > 1 ? parts[1] : parts[0]).trim();
    const num = x => (x === '*' || x === 'n' ? Infinity : (isNaN(parseInt(x, 10)) ? 1 : parseInt(x, 10)));
    return { lower: lo === '*' ? 0 : num(lo), upper: num(hi) };
  };
  UML.isMany = m => { const b = UML.multBounds(m); return !!b && b.upper > 1; };
  UML.isOptional = m => { const b = UML.multBounds(m); return !!b && b.lower === 0 && b.upper === 1; };
  UML.typeIds = t => String(t || '').match(/[A-Za-z_$][\w$]*/g) || [];

  /* ---------- fábricas ---------- */
  UML.attr = (text, extra) => Object.assign({ id: uid(), isStatic: false }, UML.parseAttr(text), extra);
  UML.op = (text, extra) => Object.assign({ id: uid(), isStatic: false, isAbstract: false }, UML.parseOp(text), extra);
  UML.lit = name => ({ id: uid(), name: String(name || '').trim() });
  UML.slot = text => Object.assign({ id: uid() }, UML.parseSlot(text));
  UML.end = () => ({ role: '', vis: '', mult: '', nav: '', agg: 'none', constraint: '', qualifier: '' });

  UML.newElement = function (kind, name) {
    const e = { id: uid(), kind, name: name == null ? '' : String(name), package: null, stereotype: '', doc: '' };
    if (UML.isClassifier(kind)) Object.assign(e, { attributes: [], operations: [], literals: [], isAbstract: false, isLeaf: false, templateParams: '' });
    if (kind === 'object') Object.assign(e, { classifier: null, classifierName: '', slots: [] });
    if (kind === 'note') e.text = '';
    return e;
  };
  UML.newRelation = (kind, source, target) => ({
    id: uid(), kind, source, target, name: '', stereotype: '', ends: [UML.end(), UML.end()], assocClass: null,
  });
  UML.newView = (ref, x, y) => ({ id: uid(), ref, x: Math.round(x || 0), y: Math.round(y || 0), w: 0, h: 0, hideAttrs: false, hideOps: false, color: '', lollipop: false });
  UML.newEdgeView = ref => ({ id: uid(), ref, points: [], style: 'straight', labels: {} });
  UML.newDiagram = name => ({ id: uid(), name: name || 'Diagrama de classes', views: [], edges: [], view: { x: 60, y: 60, z: 1 }, opts: { hideVis: false, hideTypes: false } });
  UML.newProject = function () {
    const d = UML.newDiagram('Diagrama de classes');
    return { version: 2, name: 'Projeto sem título', elements: {}, relations: {}, diagrams: [d], current: d.id };
  };

  /* ---------- consultas ---------- */
  UML.qualifiedPackage = function (p, pkgId) {
    const names = [];
    const seen = new Set();
    let id = pkgId;
    while (id && p.elements[id] && !seen.has(id)) { seen.add(id); names.unshift(p.elements[id].name); id = p.elements[id].package; }
    return names.join('.');
  };
  UML.classifierByName = (p, name) => Object.values(p.elements).find(e => UML.isClassifier(e.kind) && e.name === name) || null;
  UML.relationsOf = (p, id) => Object.values(p.relations).filter(r => r.source === id || r.target === id || r.assocClass === id);
  UML.parentsOf = (p, id, kinds = ['generalization']) =>
    Object.values(p.relations).filter(r => kinds.includes(r.kind) && r.source === id).map(r => p.elements[r.target]).filter(Boolean);
  UML.ancestors = function (p, id) {
    const out = [], seen = new Set([id]);
    const walk = x => UML.parentsOf(p, x).forEach(e => { if (!seen.has(e.id)) { seen.add(e.id); out.push(e); walk(e.id); } });
    walk(id);
    return out;
  };
  UML.isDescendantPackage = function (p, pkgId, maybeChild) {
    let id = maybeChild; const seen = new Set();
    while (id && !seen.has(id)) { if (id === pkgId) return true; seen.add(id); id = p.elements[id] && p.elements[id].package; }
    return false;
  };

  /* ---------- normalização e migração ---------- */
  const fill = (obj, defs) => { for (const k in defs) if (obj[k] === undefined || obj[k] === null && defs[k] !== null) obj[k] = defs[k]; return obj; };

  UML.normalize = function (p) {
    if (!p || typeof p !== 'object') throw new Error('Conteúdo vazio ou inválido.');
    if (Array.isArray(p.diagrams) && p.diagrams.some(d => Array.isArray(d.nodes))) p = UML.migrateV1(p);
    if (!p.elements || typeof p.elements !== 'object' || !Array.isArray(p.diagrams)) throw new Error('O arquivo não parece ser um projeto do NextUML.');
    p.version = 2;
    p.name = p.name || 'Projeto';
    p.relations = p.relations && typeof p.relations === 'object' ? p.relations : {};
    for (const [id, e] of Object.entries(p.elements)) {
      if (!e || !UML.KINDS[e.kind]) { delete p.elements[id]; continue; }
      e.id = id;
      const base = UML.newElement(e.kind);
      delete base.id;
      fill(e, base);
      e.name = String(e.name ?? '');
      ['attributes', 'operations', 'literals', 'slots'].forEach(k => {
        if (k in base) e[k] = (Array.isArray(e[k]) ? e[k] : []).filter(Boolean).map(m => (m.id ? m : Object.assign({ id: uid() }, m)));
      });
      (e.attributes || []).forEach(a => fill(a, { vis: '', name: '', type: '', mult: '', def: '', derived: false, readOnly: false, props: '', isStatic: false }));
      (e.operations || []).forEach(o => { fill(o, { vis: '', name: '', ret: '', retMult: '', props: '', isStatic: false, isAbstract: false }); o.params = Array.isArray(o.params) ? o.params : []; });
      (e.slots || []).forEach(s => fill(s, { feature: '', value: '' }));
    }
    for (const e of Object.values(p.elements)) {
      if (e.package && (!p.elements[e.package] || p.elements[e.package].kind !== 'package' || e.package === e.id)) e.package = null;
      if (e.kind === 'object' && e.classifier && !p.elements[e.classifier]) e.classifier = null;
    }
    for (const [id, r] of Object.entries(p.relations)) {
      if (!r || !UML.REL[r.kind] || !p.elements[r.source] || !p.elements[r.target]) { delete p.relations[id]; continue; }
      r.id = id;
      fill(r, { name: '', stereotype: '', assocClass: null });
      r.ends = [0, 1].map(k => fill((r.ends && r.ends[k]) || {}, UML.end()));
      if (r.assocClass && !p.elements[r.assocClass]) r.assocClass = null;
    }
    if (!p.diagrams.length) p.diagrams.push(UML.newDiagram());
    for (const d of p.diagrams) {
      d.id = d.id || uid();
      d.name = d.name || 'Diagrama';
      d.view = d.view && isFinite(d.view.z) && d.view.z > 0 ? d.view : { x: 60, y: 60, z: 1 };
      d.opts = fill(d.opts || {}, { hideVis: false, hideTypes: false });
      const seen = new Set();
      d.views = (Array.isArray(d.views) ? d.views : []).filter(v => v && p.elements[v.ref] && !seen.has(v.ref) && seen.add(v.ref));
      d.views.forEach(v => { fill(v, UML.newView(v.ref)); v.x = +v.x || 0; v.y = +v.y || 0; });
      const seenE = new Set();
      d.edges = (Array.isArray(d.edges) ? d.edges : []).filter(ev => ev && p.relations[ev.ref] && !seenE.has(ev.ref) && seenE.add(ev.ref));
      d.edges.forEach(ev => { fill(ev, UML.newEdgeView(ev.ref)); ev.points = Array.isArray(ev.points) ? ev.points : []; ev.labels = ev.labels || {}; });
    }
    if (!p.diagrams.some(d => d.id === p.current)) p.current = p.diagrams[0].id;
    return p;
  };

  /* Converte projetos da primeira versão (diagramas com nós e arestas próprios). */
  UML.migrateV1 = function (s) {
    const p = { version: 2, name: 'Projeto recuperado', elements: {}, relations: {}, diagrams: [], current: null };
    for (const d of s.diagrams || []) {
      const nd = UML.newDiagram(d.name || 'Diagrama');
      if (d.view) nd.view = d.view;
      const map = {};
      for (const n of d.nodes || []) {
        let e;
        if (n.type === 'class' && n.stereotype === 'enumeration') {
          e = UML.newElement('enumeration', n.name);
          e.literals = (n.attrs || []).map(a => UML.lit(String(a).replace(/^[+\-#~]\s*/, '').split(/[:=\s]/)[0]));
          e.operations = (n.ops || []).map(t => UML.op(t));
        } else if (n.type === 'class' || n.type === 'interface') {
          e = UML.newElement(n.type, n.name);
          e.isAbstract = !!n.abstract;
          e.stereotype = n.type === 'class' ? n.stereotype || '' : '';
          e.attributes = (n.attrs || []).map(t => UML.attr(t));
          e.operations = (n.ops || []).map(t => UML.op(t));
        } else if (n.type === 'note') { e = UML.newElement('note'); e.text = n.text || ''; }
        else if (n.type === 'package') e = UML.newElement('package', n.name);
        else continue;
        p.elements[e.id] = e;
        map[n.id] = e.id;
        const v = UML.newView(e.id, n.x, n.y);
        if (n.type === 'package') { v.w = n.w || 0; v.h = n.h || 0; }
        nd.views.push(v);
      }
      const kinds = { association: 'association', directed: 'association', aggregation: 'association', composition: 'association', generalization: 'generalization', realization: 'realization', dependency: 'dependency', anchor: 'anchor' };
      for (const ed of d.edges || []) {
        const a = map[ed.from], b = map[ed.to], kind = kinds[ed.type];
        if (!a || !b || !kind) continue;
        const r = UML.newRelation(kind, a, b);
        r.name = ed.name || '';
        r.ends[0].mult = ed.srcMult || '';
        r.ends[1].mult = ed.tgtMult || '';
        if (ed.type === 'directed') r.ends[1].nav = 'nav';
        if (ed.type === 'aggregation') r.ends[1].agg = 'shared';
        if (ed.type === 'composition') r.ends[1].agg = 'composite';
        p.relations[r.id] = r;
        nd.edges.push(UML.newEdgeView(r.id));
      }
      p.diagrams.push(nd);
    }
    if (!p.diagrams.length) p.diagrams.push(UML.newDiagram());
    p.current = p.diagrams[0].id;
    return p;
  };

  /* ---------- projeto de exemplo ---------- */
  UML.sample = function () {
    const p = { version: 2, name: 'Sistema de biblioteca', elements: {}, relations: {}, diagrams: [], current: null };
    const add = e => (p.elements[e.id] = e);
    const pkg = (name, parent) => { const e = UML.newElement('package', name); e.package = parent ? parent.id : null; return add(e); };
    const cls = (kind, name, pk, attrs = [], ops = [], extra = {}) => {
      const e = UML.newElement(kind, name);
      e.package = pk ? pk.id : null;
      e.attributes = attrs.map(a => (typeof a === 'string' ? UML.attr(a) : UML.attr(a[0], a[1])));
      e.operations = ops.map(o => (typeof o === 'string' ? UML.op(o) : UML.op(o[0], o[1])));
      return add(Object.assign(e, extra));
    };
    const rel = (kind, a, b, f) => { const r = UML.newRelation(kind, a.id, b.id); if (f) f(r); p.relations[r.id] = r; return r; };

    const raiz = pkg('biblioteca');
    const dom = pkg('dominio', raiz);
    const per = pkg('persistencia', raiz);

    const pessoa = cls('class', 'Pessoa', dom,
      ['- nome: String', '- cpf: String {readOnly}', '- endereco: Endereco', ['- total: int = 0', { isStatic: true }]],
      ['+ getNome(): String', ['+ validarDocumento(): boolean', { isAbstract: true }], ['+ getTotal(): int', { isStatic: true }]],
      { isAbstract: true, doc: 'Qualquer pessoa cadastrada na biblioteca.' });
    const notif = cls('interface', 'Notificavel', dom, [], ['+ notificar(mensagem: String): void']);
    const endereco = cls('datatype', 'Endereco', dom, ['- logradouro: String', '- cidade: String', '- cep: String']);
    const leitor = cls('class', 'Leitor', dom,
      ['- matricula: int', '- limite: int = 3'],
      ['+ podeEmprestar(): boolean', '+ validarDocumento(): boolean', '+ notificar(mensagem: String): void']);
    const bib = cls('class', 'Bibliotecario', dom, ['- registro: String'],
      ['+ registrarDevolucao(e: Emprestimo): void', '+ validarDocumento(): boolean']);
    const emp = cls('class', 'Emprestimo', dom,
      ['- dataSaida: LocalDate', '- prazo: LocalDate', '- /atrasado: boolean'],
      ['+ calcularMulta(taxaDiaria: BigDecimal): BigDecimal', '+ renovar(dias: int = 7): void']);
    const exe = cls('class', 'Exemplar', dom, ['- codigo: String', '- estado: EstadoExemplar = DISPONIVEL'], ['+ disponivel(): boolean']);
    const livro = cls('class', 'Livro', dom, ['- isbn: String {readOnly}', '- titulo: String', '- autores: String [1..*]', '- ano: int'], []);
    const estado = cls('enumeration', 'EstadoExemplar', dom);
    estado.literals = ['DISPONIVEL', 'EMPRESTADO', 'EM_REPARO', 'PERDIDO'].map(UML.lit);
    const acervo = cls('class', 'Acervo', dom, ['- nome: String'], ['+ buscar(isbn: String): Livro [0..1]', '+ cadastrar(livro: Livro): void'], { isLeaf: true });
    const reserva = cls('class', 'Reserva', dom, ['- dataReserva: LocalDate', '- posicaoFila: int'], ['+ cancelar(): void']);
    const nota = add(Object.assign(UML.newElement('note'), { text: 'Multa: R$ 2,00 por dia de atraso,\nlimitada ao valor do exemplar.' }));

    const repo = cls('interface', 'Repositorio', per, [], ['+ salvar(item: T): void', '+ buscarPorId(id: String): T', '+ listar(): List<T>'], { templateParams: 'T' });
    const repoLivros = cls('class', 'RepositorioLivros', per, ['- livros: Map<String, Livro>'], ['+ buscarPorIsbn(isbn: String): Livro', '+ salvar(item: Livro): void', '+ buscarPorId(id: String): Livro', '+ listar(): List<Livro>']);

    const objAna = add(Object.assign(UML.newElement('object', 'ana'), { classifier: leitor.id, slots: [UML.slot('nome = "Ana Lima"'), UML.slot('matricula = 1042')] }));
    const objEmp = add(Object.assign(UML.newElement('object', 'e1'), { classifier: emp.id, slots: [UML.slot('dataSaida = 2026-11-03'), UML.slot('prazo = 2026-11-17')] }));
    const objEx = add(Object.assign(UML.newElement('object', 'ex2'), { classifier: exe.id, slots: [UML.slot('codigo = "LIV-0091-02"'), UML.slot('estado = EMPRESTADO')] }));
    const objLivro = add(Object.assign(UML.newElement('object', 'dom'), { classifier: livro.id, slots: [UML.slot('titulo = "Dom Casmurro"'), UML.slot('ano = 1899')] }));

    const g1 = rel('generalization', leitor, pessoa), g2 = rel('generalization', bib, pessoa);
    const r1 = rel('realization', leitor, notif);
    const aLE = rel('association', leitor, emp, r => {
      r.name = 'realiza';
      Object.assign(r.ends[0], { role: 'leitor', mult: '1' });
      Object.assign(r.ends[1], { role: 'emprestimos', mult: '0..*', nav: 'nav', constraint: 'ordered' });
    });
    const aEX = rel('association', emp, exe, r => { Object.assign(r.ends[0], { mult: '0..*', nav: 'non' }); Object.assign(r.ends[1], { role: 'exemplar', mult: '1', nav: 'nav' }); });
    const cXL = rel('association', exe, livro, r => { Object.assign(r.ends[0], { role: 'exemplares', mult: '1..*' }); Object.assign(r.ends[1], { mult: '1', agg: 'composite' }); });
    const dBE = rel('dependency', bib, emp, r => { r.stereotype = 'use'; });
    const qAL = rel('association', acervo, livro, r => { Object.assign(r.ends[0], { qualifier: 'isbn: String', mult: '1' }); Object.assign(r.ends[1], { mult: '0..1', nav: 'nav' }); });
    const aLR = rel('association', leitor, livro, r => { r.name = 'reserva'; r.assocClass = reserva.id; Object.assign(r.ends[0], { mult: '0..*' }); Object.assign(r.ends[1], { mult: '0..*' }); });
    const nAn = rel('anchor', nota, emp);
    const rRepo = rel('realization', repoLivros, repo, r => { r.stereotype = 'bind T → Livro'; });
    const dRepo = rel('dependency', repoLivros, livro);
    const l1 = rel('association', objAna, objEmp, r => { r.name = 'realiza'; });
    const l2 = rel('association', objEmp, objEx);
    const l3 = rel('association', objEx, objLivro);

    const diagram = (name, views, rels, view) => {
      const d = UML.newDiagram(name);
      d.views = views.map(([e, x, y, extra]) => Object.assign(UML.newView(e.id, x, y), extra));
      d.edges = rels.map(r => UML.newEdgeView(r.id));
      if (view) d.view = view;
      p.diagrams.push(d);
      return d;
    };
    const d1 = diagram('Domínio da biblioteca', [
      [notif, 40, 40], [pessoa, 420, 30, { color: 'teal' }], [endereco, 800, 40],
      [leitor, 60, 300], [bib, 560, 300], [acervo, 1060, 300, { color: 'amber' }],
      [emp, 20, 560], [reserva, 600, 560, { color: 'violet' }], [livro, 1060, 560],
      [exe, 520, 800], [estado, 1060, 820], [nota, 20, 820],
    ], [g1, g2, r1, aLE, aEX, cXL, dBE, qAL, aLR, nAn]);
    d1.edges.find(ev => ev.ref === g1.id).style = 'ortho';
    d1.edges.find(ev => ev.ref === g2.id).style = 'ortho';
    diagram('Persistência', [[repo, 40, 60], [repoLivros, 40, 300], [livro, 520, 300]], [rRepo, dRepo]);
    diagram('Objetos: um empréstimo', [[objAna, 40, 60], [objEmp, 420, 60], [objEx, 420, 300], [objLivro, 40, 300]], [l1, l2, l3]);
    p.current = d1.id;
    return p;
  };

  if (typeof module === 'object' && module.exports) module.exports = UML;
})(typeof globalThis !== 'undefined' ? globalThis : this);
