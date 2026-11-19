/* Traço UML — validação, geração de código, XMI e engenharia reversa. Sem DOM. */
(function (G) {
  'use strict';
  const UML = (G.UML = G.UML || {});
  const uid = UML.uid;
  const lowerFirst = s => (s ? s[0].toLowerCase() + s.slice(1) : s);
  const classifiers = p => Object.values(p.elements).filter(e => UML.isClassifier(e.kind));
  const nameOf = e => (e.kind === 'note' ? 'Nota' : e.name || '(sem nome)');

  /* ================= validação ================= */
  function inheritedAttrNames(p, c) {
    const names = new Set(c.attributes.map(a => a.name));
    UML.ancestors(p, c.id).forEach(e => (e.attributes || []).forEach(a => names.add(a.name)));
    return names;
  }
  function availableOps(p, c) {
    const names = new Set(c.operations.filter(o => !o.isAbstract).map(o => o.name));
    UML.ancestors(p, c.id).forEach(e => (e.operations || []).filter(o => !o.isAbstract).forEach(o => names.add(o.name)));
    return names;
  }

  UML.validate = function (p) {
    const out = [];
    const add = (level, msg, ref) => out.push(Object.assign({ level, msg }, ref));
    const cls = classifiers(p);
    const known = new Set([...UML.KNOWN_TYPES, ...cls.map(c => c.name)]);
    const seen = new Map();

    for (const c of cls) {
      if (!c.name.trim()) { add('error', `${UML.KINDS[c.kind].label} sem nome.`, { el: c.id }); continue; }
      if (!/^[A-Za-z_$][\w$]*$/.test(c.name)) add('warning', `“${c.name}” não é um identificador válido para gerar código.`, { el: c.id });
      const key = (c.package || '') + '::' + c.name;
      if (seen.has(key)) add('error', `Nome duplicado: existem dois elementos “${c.name}” no mesmo pacote.`, { el: c.id });
      seen.set(key, c.id);

      const tparams = new Set(UML.splitTop(c.templateParams || '', ',').map(t => t.split(/[\s:]/)[0]));
      const checkType = (t, where) => {
        for (const id of UML.typeIds(t)) if (!known.has(id) && !tparams.has(id)) add('warning', `Tipo “${id}” não existe no modelo (${where} em ${c.name}).`, { el: c.id });
      };
      const attrNames = new Set();
      for (const a of c.attributes) {
        if (!a.name) add('error', `Atributo sem nome em ${c.name}.`, { el: c.id });
        else if (attrNames.has(a.name)) add('warning', `Atributo “${a.name}” repetido em ${c.name}.`, { el: c.id });
        attrNames.add(a.name);
        checkType(a.type, `atributo ${a.name}`);
        if (a.mult && !UML.multBounds(a.mult)) add('warning', `Multiplicidade inválida “${a.mult}” em ${c.name}.${a.name}.`, { el: c.id });
      }
      const sigs = new Set();
      for (const o of c.operations) {
        if (!o.name) add('error', `Operação sem nome em ${c.name}.`, { el: c.id });
        const sig = o.name + '(' + o.params.map(x => x.type).join(',') + ')';
        if (sigs.has(sig)) add('warning', `Operação ${sig} repetida em ${c.name}.`, { el: c.id });
        sigs.add(sig);
        checkType(o.ret, `retorno de ${o.name}`);
        o.params.forEach(x => checkType(x.type, `parâmetro ${x.name} de ${o.name}`));
        if (o.isAbstract && c.kind === 'class' && !c.isAbstract) add('error', `${c.name} tem a operação abstrata ${o.name}() mas não é abstrata.`, { el: c.id });
      }
      if (c.kind === 'enumeration' && !c.literals.length) add('info', `A enumeração ${c.name} não tem literais.`, { el: c.id });

      if (c.kind === 'class' && !c.isAbstract) {
        const have = availableOps(p, c);
        const ifaces = Object.values(p.relations).filter(r => r.kind === 'realization' && r.source === c.id).map(r => p.elements[r.target]).filter(e => e && e.kind === 'interface');
        for (const i of ifaces) for (const o of i.operations) if (!o.isStatic && !have.has(o.name)) add('warning', `${c.name} realiza ${i.name} mas não declara a operação ${o.name}().`, { el: c.id });
        for (const anc of UML.ancestors(p, c.id)) for (const o of anc.operations || []) if (o.isAbstract && !have.has(o.name)) add('warning', `${c.name} herda a operação abstrata ${o.name}() de ${anc.name} sem implementá-la.`, { el: c.id });
      }
    }

    // ciclos de generalização
    const parents = new Map();
    for (const r of Object.values(p.relations)) if (r.kind === 'generalization') (parents.get(r.source) || parents.set(r.source, []).get(r.source)).push(r.target);
    const state = new Map();
    const reported = new Set();
    const dfs = id => {
      state.set(id, 1);
      for (const t of parents.get(id) || []) {
        if (state.get(t) === 1 && !reported.has(t)) { reported.add(t); add('error', `Herança circular envolvendo ${nameOf(p.elements[t])}.`, { el: t }); }
        else if (!state.get(t)) dfs(t);
      }
      state.set(id, 2);
    };
    [...parents.keys()].forEach(id => { if (!state.get(id)) dfs(id); });

    for (const r of Object.values(p.relations)) {
      const a = p.elements[r.source], b = p.elements[r.target];
      if (!a || !b) continue;
      const lbl = `${nameOf(a)} → ${nameOf(b)}`;
      if (r.kind === 'generalization') {
        if (a.id === b.id) add('error', `${a.name} herda de si mesmo.`, { rel: r.id });
        else if (a.kind === 'class' && b.kind === 'interface') add('warning', `${lbl}: classe e interface se ligam por realização, não por generalização.`, { rel: r.id });
        else if (a.kind !== b.kind && !(UML.isClassifier(a.kind) && UML.isClassifier(b.kind) && a.kind !== 'interface' && b.kind !== 'interface')) add('warning', `${lbl}: generalização entre tipos diferentes (${UML.KINDS[a.kind].label} e ${UML.KINDS[b.kind].label}).`, { rel: r.id });
        if (b.isLeaf) add('error', `${a.name} herda de ${b.name}, que é final {leaf}.`, { rel: r.id });
      }
      if (r.kind === 'realization' && b.kind !== 'interface') add('warning', `${lbl}: o destino de uma realização normalmente é uma interface.`, { rel: r.id });
      if (r.kind === 'association') {
        const [e0, e1] = r.ends;
        if (e0.agg !== 'none' && e1.agg !== 'none') add('error', `${lbl}: só uma ponta da associação pode ser agregação ou composição.`, { rel: r.id });
        for (const [k, end] of [[0, e0], [1, e1]]) {
          if (end.mult && !UML.multBounds(end.mult)) add('warning', `${lbl}: multiplicidade inválida “${end.mult}”.`, { rel: r.id });
          if (end.agg === 'composite') {
            const b2 = UML.multBounds(end.mult);
            if (b2 && b2.upper > 1) add('error', `${lbl}: na composição, a parte pertence a no máximo um todo (multiplicidade do lado do todo deve ser 1 ou 0..1).`, { rel: r.id });
          }
          if (end.qualifier && !end.qualifier.includes(':')) add('info', `${lbl}: o qualificador “${end.qualifier}” não informa o tipo.`, { rel: r.id });
          void k;
        }
        if (r.assocClass && p.elements[r.assocClass] && p.elements[r.assocClass].kind !== 'class') add('warning', `${lbl}: a classe de associação deve ser uma classe.`, { rel: r.id });
      }
      if (r.kind === 'anchor' && a.kind !== 'note' && b.kind !== 'note') add('warning', `${lbl}: ligação de nota sem nota.`, { rel: r.id });
    }

    for (const o of Object.values(p.elements).filter(e => e.kind === 'object')) {
      const c = o.classifier && p.elements[o.classifier];
      if (!c) { add('info', `O objeto ${o.name || '(anônimo)'} não tem classificador definido.`, { el: o.id }); continue; }
      const names = inheritedAttrNames(p, c);
      for (const s of o.slots) if (s.feature && !names.has(s.feature)) add('warning', `${o.name} : ${c.name} tem o valor “${s.feature}”, que não é atributo de ${c.name}.`, { el: o.id });
      if (c.kind === 'class' && c.isAbstract) add('warning', `O objeto ${o.name} instancia a classe abstrata ${c.name}.`, { el: o.id });
    }
    const order = { error: 0, warning: 1, info: 2 };
    return out.sort((x, y) => order[x.level] - order[y.level]);
  };

  /* ================= apoio à geração ================= */
  function assocFields(p, c) {
    const out = [];
    for (const r of Object.values(p.relations)) {
      if (r.kind !== 'association') continue;
      for (const k of [0, 1]) {
        const owner = k === 0 ? r.source : r.target;
        if (owner !== c.id) continue;
        const o = 1 - k;
        const other = p.elements[o === 0 ? r.source : r.target];
        if (!other || !UML.isClassifier(other.kind)) continue;
        const me = r.ends[k], oe = r.ends[o];
        let gen = oe.nav === 'nav' || me.agg !== 'none' || (oe.nav === '' && me.nav === '');
        if (oe.nav === 'non') gen = false;
        if (!gen) continue;
        const many = UML.isMany(oe.mult);
        const q = me.qualifier ? UML.parseAttr(me.qualifier) : null;
        out.push({
          name: oe.role || lowerFirst(other.name) + (many ? 's' : ''),
          type: other.name, many, optional: UML.isOptional(oe.mult), vis: oe.vis || '-',
          ordered: /ordered/.test(oe.constraint), qualifier: q && { name: q.name, type: q.type || 'String' },
        });
      }
    }
    return out;
  }
  const genParents = (p, c, kind) => Object.values(p.relations).filter(r => r.kind === kind && r.source === c.id).map(r => p.elements[r.target]).filter(e => e && UML.isClassifier(e.kind));
  const docLines = (doc, pre) => (doc ? doc.split('\n').map(l => pre + l) : []);
  const selected = (p, ids) => classifiers(p).filter(c => c.kind !== 'primitive' && (!ids || ids.has(c.id)));
  const BOX = { int: 'Integer', long: 'Long', double: 'Double', float: 'Float', boolean: 'Boolean', char: 'Character', short: 'Short', byte: 'Byte' };

  /* ---------- Java ---------- */
  const JV = { '+': 'public ', '-': 'private ', '#': 'protected ', '~': '', '': 'private ' };
  const jType = (t, many, ordered) => {
    let base = String(t || 'Object').replace(/\bstring\b/g, 'String').replace(/\bnumber\b/g, 'double').replace(/\bbool\b/g, 'boolean');
    if (many) return `${ordered === false ? 'Set' : 'List'}<${BOX[base] || base}>`;
    return base;
  };
  const jReturn = t => {
    if (!t || t === 'void') return '';
    if (/^(int|long|short|byte|double|float)$/.test(t)) return 'return 0;';
    if (t === 'boolean') return 'return false;';
    if (t === 'char') return "return '\\0';";
    return 'return null;';
  };
  function genJavaOne(p, c) {
    const L = [];
    const pkg = UML.qualifiedPackage(p, c.package);
    const supers = genParents(p, c, 'generalization'), reals = genParents(p, c, 'realization');
    const assoc = assocFields(p, c);
    const iface = c.kind === 'interface', isEnum = c.kind === 'enumeration';
    const texts = [...c.attributes.map(a => a.type), ...c.operations.flatMap(o => [o.ret, ...o.params.map(x => x.type)]), ...assoc.map(a => a.type)].join(' ');
    const imports = new Set();
    if (/\b(List)\b/.test(texts) || c.attributes.some(a => UML.isMany(a.mult)) || assoc.some(a => a.many)) { imports.add('java.util.List'); imports.add('java.util.ArrayList'); }
    if (/\bSet\b/.test(texts)) imports.add('java.util.Set');
    if (/\bMap\b/.test(texts) || assoc.some(a => a.qualifier)) { imports.add('java.util.Map'); imports.add('java.util.HashMap'); }
    for (const t of ['LocalDate', 'LocalDateTime', 'LocalTime', 'Instant', 'Duration']) if (new RegExp('\\b' + t + '\\b').test(texts)) imports.add('java.time.' + t);
    if (/\bBigDecimal\b/.test(texts)) imports.add('java.math.BigDecimal');
    if (/\bUUID\b/.test(texts)) imports.add('java.util.UUID');
    if (/\bDate\b/.test(texts)) imports.add('java.util.Date');
    for (const id of new Set([...UML.typeIds(texts), ...supers.map(s => s.name), ...reals.map(s => s.name)])) {
      const other = UML.classifierByName(p, id);
      if (other && other.id !== c.id && other.package !== c.package && other.package) imports.add(UML.qualifiedPackage(p, other.package) + '.' + other.name);
    }
    if (pkg) L.push(`package ${pkg};`, '');
    if (imports.size) { L.push(...[...imports].sort().map(i => `import ${i};`), ''); }
    if (c.doc || c.stereotype) L.push('/**', ...docLines(c.doc, ' * '), ...(c.stereotype ? [` * @stereotype ${c.stereotype}`] : []), ' */');
    const kw = iface ? 'interface' : isEnum ? 'enum' : 'class';
    let head = 'public ' + (c.kind === 'class' && c.isAbstract ? 'abstract ' : '') + (c.isLeaf && !iface && !isEnum ? 'final ' : '') + kw + ' ' + c.name + (c.templateParams ? `<${c.templateParams}>` : '');
    if (iface && supers.length) head += ' extends ' + supers.map(s => s.name).join(', ');
    if (!iface && !isEnum && supers.length) head += ' extends ' + supers[0].name;
    if (!iface && reals.length) head += ' implements ' + reals.map(s => s.name).join(', ');
    L.push(head + ' {');
    const body = [];
    if (isEnum) body.push('    ' + (c.literals.map(l => l.name).join(',\n    ') || '') + ';', '');
    for (const a of c.attributes) {
      const many = UML.isMany(a.mult);
      let def = a.def ? ' = ' + a.def : many && !iface ? ' = new ArrayList<>()' : '';
      if (isEnum && a.def && !a.isStatic) def = '';
      if (iface) body.push(`    ${jType(a.type, many)} ${a.name}${def || ' = null'};`);
      else body.push(`    ${JV[a.vis]}${a.isStatic ? 'static ' : ''}${a.readOnly ? 'final ' : ''}${jType(a.type, many)} ${a.name}${def};`);
    }
    for (const f of assoc) {
      if (f.qualifier) body.push(`    ${JV[f.vis]}Map<${BOX[f.qualifier.type] || f.qualifier.type}, ${f.type}> ${f.name} = new HashMap<>();`);
      else body.push(`    ${JV[f.vis]}${jType(f.type, f.many, f.ordered || undefined)} ${f.name}${f.many ? ' = new ArrayList<>()' : ''};`);
    }
    if (body.length && c.operations.length) body.push('');
    c.operations.forEach((o, i) => {
      if (i) body.push('');
      const params = o.params.map(x => `${jType(x.type || 'Object', UML.isMany(x.mult))} ${x.name || 'arg' + i}`).join(', ');
      const ret = o.ret ? jType(o.ret, UML.isMany(o.retMult)) : 'void';
      if (o.name === c.name) { body.push(`    ${JV[o.vis || '+']}${c.name}(${params}) {`, '        // TODO implementar', '    }'); return; }
      if (iface && !o.isStatic) { body.push(`    ${ret} ${o.name}(${params});`); return; }
      if (o.isAbstract) { body.push(`    ${JV[o.vis || '+']}abstract ${ret} ${o.name}(${params});`); return; }
      const r = jReturn(ret);
      body.push(`    ${iface ? 'public ' : JV[o.vis || '+']}${o.isStatic ? 'static ' : ''}${ret} ${o.name}(${params}) {`, '        // TODO implementar', ...(r ? ['        ' + r] : []), '    }');
    });
    L.push(...body, '}', '');
    const dir = pkg ? pkg.replace(/\./g, '/') + '/' : '';
    return { file: `${dir}${c.name}.java`, code: L.join('\n') };
  }

  /* ---------- TypeScript ---------- */
  const TS_MAP = {
    int: 'number', long: 'number', short: 'number', byte: 'number', float: 'number', double: 'number', BigDecimal: 'number', BigInteger: 'bigint',
    Integer: 'number', Long: 'number', Short: 'number', Byte: 'number', Float: 'number', Double: 'number',
    String: 'string', char: 'string', Character: 'string', UUID: 'string', str: 'string',
    boolean: 'boolean', Boolean: 'boolean', bool: 'boolean',
    Date: 'Date', LocalDate: 'Date', LocalDateTime: 'Date', Instant: 'Date', Object: 'unknown',
  };
  const tsType = (t, many) => {
    let s = String(t || 'unknown').replace(/[A-Za-z_$][\w$]*/g, id => TS_MAP[id] || id);
    s = s.replace(/\b(?:List|Collection|ArrayList|Iterable)<(.+)>$/, '$1[]');
    if (many) s = /[|&\s]/.test(s) ? `(${s})[]` : s + '[]';
    return s;
  };
  const TSV = { '+': 'public ', '-': 'private ', '#': 'protected ', '~': '', '': 'private ' };
  const tsDefault = t => (/^(number|bigint)$/.test(t) ? '0' : t === 'string' ? "''" : t === 'boolean' ? 'false' : null);
  function genTSOne(p, c) {
    const L = [];
    const supers = genParents(p, c, 'generalization'), reals = genParents(p, c, 'realization');
    const assoc = assocFields(p, c);
    const used = new Set();
    const note = t => UML.typeIds(t).forEach(id => { const o = UML.classifierByName(p, id); if (o && o.id !== c.id && o.kind !== 'primitive') used.add(o.name); });
    c.attributes.forEach(a => note(a.type)); c.operations.forEach(o => { note(o.ret); o.params.forEach(x => note(x.type)); });
    assoc.forEach(a => note(a.type)); supers.forEach(s => used.add(s.name)); reals.forEach(s => used.add(s.name));
    [...used].sort().forEach(n => L.push(`import { ${n} } from './${n}';`));
    if (used.size) L.push('');
    if (c.doc) L.push('/**', ...docLines(c.doc, ' * '), ' */');
    const tp = c.templateParams ? `<${c.templateParams}>` : '';
    if (c.kind === 'enumeration') {
      L.push(`export enum ${c.name} {`, ...c.literals.map(l => `  ${l.name} = '${l.name}',`), '}', '');
      return { file: c.name + '.ts', code: L.join('\n') };
    }
    const asInterface = c.kind === 'interface' || c.kind === 'datatype';
    const params = o => o.params.map((x, i) => `${x.name || 'arg' + i}${UML.isOptional(x.mult) ? '?' : ''}: ${tsType(x.type, UML.isMany(x.mult))}${x.def ? ' = ' + x.def : ''}`).join(', ');
    if (asInterface) {
      const ext = [...supers, ...(c.kind === 'datatype' ? [] : [])].map(s => s.name);
      L.push(`export interface ${c.name}${tp}${ext.length ? ' extends ' + ext.join(', ') : ''} {`);
      c.attributes.forEach(a => L.push(`  ${a.readOnly ? 'readonly ' : ''}${a.name}${UML.isOptional(a.mult) ? '?' : ''}: ${tsType(a.type, UML.isMany(a.mult))};`));
      assoc.forEach(f => L.push(`  ${f.name}${f.optional ? '?' : ''}: ${f.qualifier ? `Map<${tsType(f.qualifier.type)}, ${f.type}>` : tsType(f.type, f.many)};`));
      c.operations.filter(o => !o.isStatic).forEach(o => L.push(`  ${o.name}(${params(o).replace(/ = [^,)]+/g, '')}): ${o.ret ? tsType(o.ret, UML.isMany(o.retMult)) + (UML.isOptional(o.retMult) ? ' | null' : '') : 'void'};`));
      L.push('}', '');
      return { file: c.name + '.ts', code: L.join('\n') };
    }
    let head = `export ${c.isAbstract ? 'abstract ' : ''}class ${c.name}${tp}`;
    if (supers.length) head += ' extends ' + supers[0].name;
    if (reals.length) head += ' implements ' + reals.map(s => s.name).join(', ');
    L.push(head + ' {');
    for (const a of c.attributes) {
      const t = tsType(a.type, UML.isMany(a.mult));
      const def = a.def ? ' = ' + a.def.replace(/^(DISPONIVEL|[A-Z_]+)$/, m => (UML.classifierByName(p, a.type) ? `${a.type}.${m}` : m)) : UML.isMany(a.mult) ? ' = []' : '';
      const opt = UML.isOptional(a.mult) ? '?' : !def && !a.isStatic ? '!' : '';
      L.push(`  ${TSV[a.vis]}${a.isStatic ? 'static ' : ''}${a.readOnly ? 'readonly ' : ''}${a.name}${opt}: ${t}${def};`);
    }
    for (const f of assoc) {
      if (f.qualifier) L.push(`  ${TSV[f.vis]}${f.name} = new Map<${tsType(f.qualifier.type)}, ${f.type}>();`);
      else L.push(`  ${TSV[f.vis]}${f.name}${f.many ? '' : f.optional ? '?' : '!'}: ${tsType(f.type, f.many)}${f.many ? ' = []' : ''};`);
    }
    c.operations.forEach(o => {
      L.push('');
      const ret = o.ret ? tsType(o.ret, UML.isMany(o.retMult)) + (UML.isOptional(o.retMult) ? ' | null' : '') : 'void';
      if (o.name === c.name || o.name === 'constructor') { L.push(`  constructor(${params(o)}) {`, supers.length ? '    super();' : '    // TODO implementar', '  }'); return; }
      if (o.isAbstract) { L.push(`  ${TSV[o.vis || '+']}abstract ${o.name}(${params(o).replace(/ = [^,)]+/g, '')}): ${ret};`); return; }
      L.push(`  ${TSV[o.vis || '+']}${o.isStatic ? 'static ' : ''}${o.name}(${params(o)}): ${ret} {`, "    throw new Error('Não implementado');", '  }');
    });
    L.push('}', '');
    void tsDefault;
    return { file: c.name + '.ts', code: L.join('\n') };
  }

  /* ---------- Python ---------- */
  const PY_MAP = {
    int: 'int', long: 'int', short: 'int', byte: 'int', Integer: 'int', Long: 'int', BigInteger: 'int', number: 'float',
    double: 'float', float: 'float', Double: 'float', Float: 'float', BigDecimal: 'Decimal',
    String: 'str', string: 'str', char: 'str', Character: 'str', UUID: 'UUID',
    boolean: 'bool', Boolean: 'bool', LocalDate: 'date', Date: 'date', LocalDateTime: 'datetime', Instant: 'datetime', Object: 'object', void: 'None',
  };
  const pyType = (t, many) => {
    let s = String(t || 'object').replace(/[A-Za-z_$][\w$]*/g, id => PY_MAP[id] || id);
    s = s.replace(/\b(?:List|Collection|ArrayList|Iterable)<(.+)>$/, 'list[$1]').replace(/\bSet<(.+)>$/, 'set[$1]').replace(/\bMap<(.+)>$/, 'dict[$1]').replace(/</g, '[').replace(/>/g, ']');
    return many ? `list[${s}]` : s;
  };
  const snake = s => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const pyName = (n, vis) => (vis === '-' || vis === '#' ? '_' : '') + snake(n);
  const pyDef = d => {
    if (d == null || d === '') return 'None';
    if (d === 'true') return 'True'; if (d === 'false') return 'False'; if (d === 'null') return 'None';
    if (/^new\s/.test(d)) return 'None';
    return d;
  };
  function genPyOne(p, c) {
    const L = [];
    const supers = genParents(p, c, 'generalization'), reals = genParents(p, c, 'realization');
    const assoc = assocFields(p, c);
    const texts = [...c.attributes.map(a => a.type), ...c.operations.flatMap(o => [o.ret, ...o.params.map(x => x.type)])].map(t => pyType(t)).join(' ');
    const abstract = c.kind === 'interface' || c.isAbstract || c.operations.some(o => o.isAbstract);
    L.push('from __future__ import annotations', '');
    const imp = [];
    if (abstract) imp.push('from abc import ABC, abstractmethod');
    if (c.kind === 'datatype') imp.push('from dataclasses import dataclass');
    if (c.kind === 'enumeration') imp.push('from enum import Enum, auto');
    if (/\bDecimal\b/.test(texts)) imp.push('from decimal import Decimal');
    const dt = ['date', 'datetime'].filter(x => new RegExp('\\b' + x + '\\b').test(texts));
    if (dt.length) imp.push(`from datetime import ${dt.join(', ')}`);
    if (/\bUUID\b/.test(texts)) imp.push('from uuid import UUID');
    [...supers, ...reals].forEach(s => imp.push(`from .${snake(s.name)} import ${s.name}`));
    if (imp.length) L.push(...imp, '');
    L.push('');
    const bases = [...supers, ...reals].map(s => s.name);
    if (c.kind === 'enumeration') bases.unshift('Enum');
    else if (abstract && !bases.length) bases.push('ABC');
    if (c.kind === 'datatype') L.push('@dataclass(frozen=True)');
    L.push(`class ${c.name}${bases.length ? `(${bases.join(', ')})` : ''}:`);
    const B = [];
    if (c.doc) B.push(`    """${c.doc.replace(/\n/g, '\n    ')}"""`, '');
    if (c.kind === 'enumeration') c.literals.forEach(l => B.push(`    ${l.name} = auto()`));
    else if (c.kind === 'datatype') c.attributes.forEach(a => B.push(`    ${snake(a.name)}: ${pyType(a.type, UML.isMany(a.mult))}${a.def ? ' = ' + pyDef(a.def) : ''}`));
    else {
      c.attributes.filter(a => a.isStatic).forEach(a => B.push(`    ${pyName(a.name, a.vis)}: ${pyType(a.type)} = ${pyDef(a.def)}`));
      const inst = c.attributes.filter(a => !a.isStatic);
      if (inst.length || assoc.length || supers.length) {
        if (B.length) B.push('');
        B.push('    def __init__(self) -> None:');
        if (supers.length) B.push('        super().__init__()');
        inst.forEach(a => B.push(`        self.${pyName(a.name, a.vis)}: ${pyType(a.type, UML.isMany(a.mult))}${UML.isOptional(a.mult) ? ' | None' : ''} = ${UML.isMany(a.mult) && !a.def ? '[]' : pyDef(a.def)}`));
        assoc.forEach(f => B.push(`        self.${pyName(f.name, f.vis)}: ${f.qualifier ? `dict[${pyType(f.qualifier.type)}, ${f.type}]` : f.many ? `list[${f.type}]` : `${f.type} | None`} = ${f.qualifier ? '{}' : f.many ? '[]' : 'None'}`));
      }
    }
    c.operations.forEach(o => {
      if (B.length) B.push('');
      const params = o.params.map((x, i) => `${snake(x.name || 'arg' + i)}: ${pyType(x.type, UML.isMany(x.mult))}${x.def ? ' = ' + pyDef(x.def) : ''}`);
      const ret = o.ret ? pyType(o.ret, UML.isMany(o.retMult)) + (UML.isOptional(o.retMult) ? ' | None' : '') : 'None';
      if (o.isStatic) B.push('    @staticmethod', `    def ${pyName(o.name, o.vis)}(${params.join(', ')}) -> ${ret}:`);
      else {
        if (o.isAbstract || c.kind === 'interface') B.push('    @abstractmethod');
        B.push(`    def ${pyName(o.name, o.vis)}(${['self', ...params].join(', ')}) -> ${ret}:`);
      }
      B.push('        raise NotImplementedError');
    });
    if (!B.length) B.push('    pass');
    L.push(...B, '');
    const pkg = UML.qualifiedPackage(p, c.package);
    return { file: (pkg ? pkg.replace(/\./g, '/') + '/' : '') + snake(c.name) + '.py', code: L.join('\n') };
  }

  UML.LANGS = { java: 'Java', ts: 'TypeScript', python: 'Python' };
  UML.generate = function (p, lang, ids) {
    const fn = { java: genJavaOne, ts: genTSOne, python: genPyOne }[lang];
    return selected(p, ids).sort((a, b) => a.name.localeCompare(b.name)).map(c => fn(p, c));
  };

  /* ================= XMI 2.5.1 ================= */
  const xa = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const VISX = { '+': 'public', '-': 'private', '#': 'protected', '~': 'package' };
  UML.exportXMI = function (p) {
    const out = [];
    const prim = new Map();
    const typeRef = t => {
      const base = String(t || '').replace(/<.*$/, '').replace(/\[\]$/, '').trim();
      if (!base) return '';
      const e = UML.classifierByName(p, base);
      if (e) return e.id;
      if (!prim.has(base)) prim.set(base, 'prim_' + base.replace(/\W/g, '_'));
      return prim.get(base);
    };
    const multX = (m, ind) => {
      const b = UML.multBounds(m);
      if (!b) return '';
      return `${ind}<lowerValue xmi:type="uml:LiteralInteger" xmi:id="${uid()}" value="${b.lower}"/>\n${ind}<upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${uid()}" value="${b.upper === Infinity ? '*' : b.upper}"/>\n`;
    };
    const elementXMI = (e, ind) => {
      const vis = '';
      if (e.kind === 'note') return `${ind}<ownedComment xmi:type="uml:Comment" xmi:id="${e.id}"${Object.values(p.relations).filter(r => r.kind === 'anchor' && (r.source === e.id || r.target === e.id)).length ? ` annotatedElement="${Object.values(p.relations).filter(r => r.kind === 'anchor' && (r.source === e.id || r.target === e.id)).map(r => (r.source === e.id ? r.target : r.source)).join(' ')}"` : ''}>\n${ind}  <body>${xa(e.text)}</body>\n${ind}</ownedComment>\n`;
      if (e.kind === 'nary') return '';
      if (e.kind === 'object') {
        let s = `${ind}<packagedElement xmi:type="uml:InstanceSpecification" xmi:id="${e.id}" name="${xa(e.name)}"${e.classifier ? ` classifier="${e.classifier}"` : ''}>\n`;
        const c = e.classifier && p.elements[e.classifier];
        for (const sl of e.slots) {
          const f = c && [c, ...UML.ancestors(p, c.id)].flatMap(x => x.attributes || []).find(a => a.name === sl.feature);
          s += `${ind}  <slot xmi:id="${sl.id}"${f ? ` definingFeature="${f.id}"` : ''}>\n${ind}    <value xmi:type="uml:LiteralString" xmi:id="${uid()}" value="${xa(sl.value)}"/>\n${ind}  </slot>\n`;
        }
        return s + `${ind}</packagedElement>\n`;
      }
      if (e.kind === 'package') {
        let s = `${ind}<packagedElement xmi:type="uml:Package" xmi:id="${e.id}" name="${xa(e.name)}">\n`;
        Object.values(p.elements).filter(c => c.package === e.id).forEach(c => (s += elementXMI(c, ind + '  ')));
        return s + `${ind}</packagedElement>\n`;
      }
      const type = { class: 'uml:Class', interface: 'uml:Interface', enumeration: 'uml:Enumeration', datatype: 'uml:DataType', primitive: 'uml:PrimitiveType' }[e.kind];
      let s = `${ind}<packagedElement xmi:type="${type}" xmi:id="${e.id}" name="${xa(e.name)}"${e.isAbstract ? ' isAbstract="true"' : ''}${e.isLeaf ? ' isLeaf="true"' : ''}${vis}>\n`;
      if (e.doc) s += `${ind}  <ownedComment xmi:type="uml:Comment" xmi:id="${uid()}"><body>${xa(e.doc)}</body></ownedComment>\n`;
      if (e.templateParams) {
        s += `${ind}  <ownedTemplateSignature xmi:type="uml:RedefinableTemplateSignature" xmi:id="${e.id}_sig">\n`;
        UML.splitTop(e.templateParams, ',').forEach(t => {
          const pid = `${e.id}_tp_${t.replace(/\W/g, '')}`;
          s += `${ind}    <ownedParameter xmi:type="uml:ClassifierTemplateParameter" xmi:id="${pid}"><ownedParameteredElement xmi:type="uml:Class" xmi:id="${pid}_c" name="${xa(t)}"/></ownedParameter>\n`;
        });
        s += `${ind}  </ownedTemplateSignature>\n`;
      }
      for (const r of Object.values(p.relations)) {
        if (r.source !== e.id) continue;
        if (r.kind === 'generalization') s += `${ind}  <generalization xmi:type="uml:Generalization" xmi:id="${r.id}" general="${r.target}"/>\n`;
        if (r.kind === 'realization' && e.kind !== 'interface') s += `${ind}  <interfaceRealization xmi:type="uml:InterfaceRealization" xmi:id="${r.id}" client="${e.id}" supplier="${r.target}" contract="${r.target}"/>\n`;
      }
      (e.literals || []).forEach(l => (s += `${ind}  <ownedLiteral xmi:type="uml:EnumerationLiteral" xmi:id="${l.id}" name="${xa(l.name)}"/>\n`));
      for (const a of e.attributes || []) {
        const t = typeRef(a.type);
        s += `${ind}  <ownedAttribute xmi:type="uml:Property" xmi:id="${a.id}" name="${xa(a.name)}"${a.vis ? ` visibility="${VISX[a.vis]}"` : ''}${a.isStatic ? ' isStatic="true"' : ''}${a.readOnly ? ' isReadOnly="true"' : ''}${a.derived ? ' isDerived="true"' : ''}${t ? ` type="${t}"` : ''}>\n`;
        s += multX(a.mult, ind + '    ');
        if (a.def) s += `${ind}    <defaultValue xmi:type="uml:OpaqueExpression" xmi:id="${uid()}"><body>${xa(a.def)}</body></defaultValue>\n`;
        s += `${ind}  </ownedAttribute>\n`;
      }
      for (const o of e.operations || []) {
        s += `${ind}  <ownedOperation xmi:type="uml:Operation" xmi:id="${o.id}" name="${xa(o.name)}"${o.vis ? ` visibility="${VISX[o.vis]}"` : ''}${o.isStatic ? ' isStatic="true"' : ''}${o.isAbstract ? ' isAbstract="true"' : ''}>\n`;
        o.params.forEach((x, i) => {
          const t = typeRef(x.type);
          s += `${ind}    <ownedParameter xmi:type="uml:Parameter" xmi:id="${o.id}_p${i}" name="${xa(x.name)}" direction="${x.dir || 'in'}"${t ? ` type="${t}"` : ''}>\n${multX(x.mult, ind + '      ')}${ind}    </ownedParameter>\n`;
        });
        if (o.ret) { const t = typeRef(o.ret); s += `${ind}    <ownedParameter xmi:type="uml:Parameter" xmi:id="${o.id}_ret" direction="return"${t ? ` type="${t}"` : ''}>\n${multX(o.retMult, ind + '      ')}${ind}    </ownedParameter>\n`; }
        s += `${ind}  </ownedOperation>\n`;
      }
      return s + `${ind}</packagedElement>\n`;
    };
    for (const e of Object.values(p.elements)) if (!e.package) out.push(elementXMI(e, '    '));
    for (const r of Object.values(p.relations)) {
      if (r.kind === 'association') {
        const ids = [r.id + '_e0', r.id + '_e1'];
        const nav = ids.filter((_, k) => r.ends[k].nav === 'nav');
        const type = r.assocClass ? 'uml:Association' : 'uml:Association';
        let s = `    <packagedElement xmi:type="${type}" xmi:id="${r.id}"${r.name ? ` name="${xa(r.name)}"` : ''} memberEnd="${ids.join(' ')}"${nav.length ? ` navigableOwnedEnd="${nav.join(' ')}"` : ''}>\n`;
        [0, 1].forEach(k => {
          const end = r.ends[k];
          const t = k === 0 ? r.source : r.target;
          s += `      <ownedEnd xmi:type="uml:Property" xmi:id="${ids[k]}"${end.role ? ` name="${xa(end.role)}"` : ''} type="${t}" association="${r.id}"${end.agg !== 'none' ? ` aggregation="${end.agg}"` : ''}${end.vis ? ` visibility="${VISX[end.vis]}"` : ''}${/ordered/.test(end.constraint) ? ' isOrdered="true"' : ''}>\n`;
          s += multX(end.mult, '        ');
          if (end.qualifier) { const q = UML.parseAttr(end.qualifier); s += `        <qualifier xmi:type="uml:Property" xmi:id="${ids[k]}_q" name="${xa(q.name)}"${q.type ? ` type="${typeRef(q.type)}"` : ''}/>\n`; }
          s += '      </ownedEnd>\n';
        });
        if (r.assocClass) s += `      <ownedComment xmi:type="uml:Comment" xmi:id="${r.id}_ac"><body>Classe de associação: ${xa(p.elements[r.assocClass]?.name)}</body></ownedComment>\n`;
        out.push(s + '    </packagedElement>\n');
      }
      if (r.kind === 'dependency') {
        const t = r.stereotype === 'use' ? 'uml:Usage' : 'uml:Dependency';
        out.push(`    <packagedElement xmi:type="${t}" xmi:id="${r.id}"${r.name ? ` name="${xa(r.name)}"` : ''} client="${r.source}" supplier="${r.target}"/>\n`);
      }
      if (r.kind === 'realization' && p.elements[r.source]?.kind === 'interface') out.push(`    <packagedElement xmi:type="uml:Realization" xmi:id="${r.id}" client="${r.source}" supplier="${r.target}"/>\n`);
    }
    for (const [name, id] of prim) out.push(`    <packagedElement xmi:type="uml:PrimitiveType" xmi:id="${id}" name="${xa(name)}"/>\n`);
    return `<?xml version="1.0" encoding="UTF-8"?>\n<xmi:XMI xmi:version="2.5.1" xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20161101">\n  <uml:Model xmi:type="uml:Model" xmi:id="model" name="${xa(p.name)}">\n${out.join('')}  </uml:Model>\n</xmi:XMI>\n`;
  };

  /* ================= engenharia reversa ================= */
  function stripComments(src) {
    let out = '', i = 0, q = null;
    while (i < src.length) {
      const ch = src[i], nx = src[i + 1];
      if (q) { out += ch; if (ch === '\\') { out += nx || ''; i += 2; continue; } if (ch === q) q = null; i++; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; out += ch; i++; continue; }
      if (ch === '/' && nx === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? src.length : e + 2; out += ' '; continue; }
      if (ch === '/' && nx === '/') { const e = src.indexOf('\n', i); i = e < 0 ? src.length : e; continue; }
      out += ch; i++;
    }
    return out;
  }
  function blockEnd(s, open) {
    let d = 0, q = null;
    for (let i = open; i < s.length; i++) {
      const ch = s[i];
      if (q) { if (ch === '\\') { i++; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
      if (ch === '{') d++;
      else if (ch === '}') { d--; if (d === 0) return i; }
    }
    return s.length;
  }
  function members(body, newlineSep) {
    const out = [];
    let cur = '', depth = 0, angle = 0, q = null;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (q) { cur += ch; if (ch === '\\') { cur += body[++i] || ''; continue; } if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'" || ch === '`') { q = ch; cur += ch; continue; }
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
      else if (ch === '<' && /[\w$]/.test(body[i - 1] || '')) angle++;
      else if (ch === '>' && angle > 0 && body[i - 1] !== '=') angle--;
      if (ch === '{' && depth === 0) {
        const end = blockEnd(body, i);
        if (/(=|=>|\bnew\s+[\w.<>\[\]]+\s*(\(.*\))?)\s*$/.test(cur)) { cur += body.slice(i, end + 1); i = end; continue; }
        if (!cur.trim() && out.length && !out[out.length - 1].block) out[out.length - 1].block = true;
        else out.push({ head: cur.trim(), block: true });
        cur = ''; i = end; angle = 0; continue;
      }
      if (depth === 0 && angle === 0 && (ch === ';' || (newlineSep && ch === '\n'))) {
        if (cur.trim()) out.push({ head: cur.trim(), block: false });
        cur = ''; continue;
      }
      cur += ch;
    }
    if (cur.trim()) out.push({ head: cur.trim(), block: false });
    return out;
  }
  const stripGenerics = s => s.replace(/<[\s\S]*>/, '').trim();
  const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([<>,])\s*/g, (m, c) => (c === ',' ? ', ' : c)).trim();
  const cleanDef = d => { d = (d || '').trim(); return !d || /^new\s/.test(d) || d.length > 40 ? '' : d; };
  function closeParen(s, open) { let d = 0; for (let i = open; i < s.length; i++) { if (s[i] === '(') d++; else if (s[i] === ')') { d--; if (!d) return i; } } return s.length; }

  UML.parseJava = function (src) {
    const s = stripComments(src).replace(/@[\w.]+(\s*\((?:[^()]|\([^()]*\))*\))?/g, ' ');
    const pkgm = s.match(/^\s*package\s+([\w.]+)\s*;/m);
    const pkg = pkgm ? pkgm[1] : '';
    const re = /\b((?:(?:public|protected|private|abstract|final|static|sealed|non-sealed|strictfp)\s+)*)(class|interface|enum|record)\s+([A-Za-z_$][\w$]*)\s*(<[^{]*?>)?([^{;]*)\{/g;
    const types = [];
    let m;
    while ((m = re.exec(s))) {
      const open = m.index + m[0].length - 1;
      const body = s.slice(open + 1, blockEnd(s, open));
      const kw = m[2];
      const t = {
        kind: kw === 'interface' ? 'interface' : kw === 'enum' ? 'enumeration' : 'class', name: m[3], package: pkg,
        templateParams: m[4] ? norm(m[4].slice(1, -1)) : '', isAbstract: /\babstract\b/.test(m[1]), isLeaf: /\bfinal\b/.test(m[1]) || kw === 'record',
        extends: [], implements: [], attributes: [], operations: [], literals: [],
      };
      let rest = m[5];
      if (kw === 'record') {
        const pm = rest.match(/^\s*\(([^)]*)\)/);
        if (pm) { UML.splitTop(pm[1], ',').forEach(x => { const pp = UML.parseParam(x); t.attributes.push({ vis: '-', name: pp.name, type: norm(pp.type), readOnly: true }); }); rest = rest.slice(pm[0].length); }
      }
      const ex = rest.match(/\bextends\s+([\s\S]*?)(?=\bimplements\b|$)/);
      if (ex) t.extends = UML.splitTop(ex[1], ',').map(stripGenerics);
      const im = rest.match(/\bimplements\s+([\s\S]*)$/);
      if (im) t.implements = UML.splitTop(im[1], ',').map(stripGenerics);
      let mbody = body;
      if (kw === 'enum') {
        const semi = UML.topLevel(body, ch => ch === ';');
        const consts = semi < 0 ? body : body.slice(0, semi);
        mbody = semi < 0 ? '' : body.slice(semi + 1);
        UML.splitTop(consts.replace(/\{[\s\S]*?\}/g, ''), ',').forEach(c => { const n = c.match(/^[A-Za-z_$][\w$]*/); if (n) t.literals.push(n[0]); });
      }
      const iface = kw === 'interface';
      for (const { head } of members(mbody, false)) javaMember(head, t, iface);
      types.push(t);
    }
    return types;
  };
  function javaMember(head, t, iface) {
    if (!head || /\b(class|interface|enum|record)\s+\w/.test(head) || /^static$/.test(head)) return;
    const vis = /\bpublic\b/.test(head) ? '+' : /\bprivate\b/.test(head) ? '-' : /\bprotected\b/.test(head) ? '#' : iface ? '+' : '~';
    const isStatic = /\bstatic\b/.test(head);
    const h = head.replace(/\b(public|private|protected|static|final|abstract|synchronized|native|transient|volatile|default|strictfp)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const paren = h.indexOf('(');
    const eq = UML.topLevel(h, (ch, i, s) => ch === '=' && s[i + 1] !== '=');
    if (paren >= 0 && (eq < 0 || paren < eq)) {
      let pre = h.slice(0, paren).trim().replace(/^<[^>]*>\s*/, '');
      const close = closeParen(h, paren);
      const mm = pre.match(/^(.*?)\s*([A-Za-z_$][\w$]*)$/);
      if (!mm) return;
      const ret = norm(mm[1]), name = mm[2];
      if (!ret) return; // construtor
      t.operations.push({
        vis, name, ret: ret === 'void' ? '' : ret, isStatic,
        isAbstract: /\babstract\b/.test(head),
        params: UML.splitTop(h.slice(paren + 1, close), ',').map(x => {
          const pp = UML.parseParam(x.replace(/\bfinal\b/g, '').trim());
          pp.type = norm(pp.type);
          if (pp.type.endsWith('...')) pp.type = pp.type.slice(0, -3) + '[]';
          return pp;
        }),
      });
    } else {
      let decl = h, def = '';
      if (eq >= 0) { def = h.slice(eq + 1).trim(); decl = h.slice(0, eq).trim(); }
      const fm = decl.match(/^(.+?)\s+([A-Za-z_$][\w$]*)(\s*,.*)?$/);
      if (!fm) return;
      t.attributes.push({ vis: iface ? '+' : vis, name: fm[2], type: norm(fm[1]), def: cleanDef(def), isStatic: isStatic || iface, readOnly: /\bfinal\b/.test(head) || iface });
    }
  }

  UML.parseTS = function (src) {
    const s = stripComments(src);
    const re = /\b(export\s+)?(default\s+)?(declare\s+)?(abstract\s+)?(class|interface|enum)\s+([A-Za-z_$][\w$]*)\s*(<[^{]*?>)?([^{;]*)\{/g;
    const types = [];
    let m;
    while ((m = re.exec(s))) {
      const open = m.index + m[0].length - 1;
      const body = s.slice(open + 1, blockEnd(s, open));
      const kw = m[5];
      const t = {
        kind: kw === 'interface' ? 'interface' : kw === 'enum' ? 'enumeration' : 'class', name: m[6], package: '',
        templateParams: m[7] ? norm(m[7].slice(1, -1)) : '', isAbstract: !!m[4], isLeaf: false,
        extends: [], implements: [], attributes: [], operations: [], literals: [],
      };
      const rest = m[8];
      const ex = rest.match(/\bextends\s+([\s\S]*?)(?=\bimplements\b|$)/);
      if (ex) t.extends = UML.splitTop(ex[1], ',').map(stripGenerics);
      const im = rest.match(/\bimplements\s+([\s\S]*)$/);
      if (im) t.implements = UML.splitTop(im[1], ',').map(stripGenerics);
      if (kw === 'enum') {
        UML.splitTop(body, ',').forEach(c => { const n = c.match(/^[A-Za-z_$][\w$]*/); if (n) t.literals.push(n[0]); });
      } else {
        for (const { head } of members(body.replace(/,(\s*\n)/g, ';$1'), true)) tsMember(head, t, kw === 'interface');
      }
      types.push(t);
    }
    return types;
  };
  function tsMember(head, t, iface) {
    let h = head.replace(/@[\w.]+(\s*\((?:[^()]|\([^()]*\))*\))?/g, ' ').trim();
    if (!h || /^(get|set)\s+[\w$]+\s*\(/.test(h)) return;
    const ctor = h.match(/^(?:public\s+|private\s+|protected\s+)?constructor\s*\(/);
    if (ctor) {
      const open = h.indexOf('(');
      UML.splitTop(h.slice(open + 1, closeParen(h, open)), ',').forEach(x => {
        if (!/^(public|private|protected|readonly)\b/.test(x)) return;
        const pv = /\bprivate\b/.test(x) ? '-' : /\bprotected\b/.test(x) ? '#' : '+';
        const pp = UML.parseParam(x.replace(/\b(public|private|protected|readonly)\b/g, '').trim());
        t.attributes.push({ vis: pv, name: pp.name, type: norm(pp.type), mult: pp.mult, readOnly: /\breadonly\b/.test(x) });
      });
      return;
    }
    const vis = /^\s*#/.test(h) || /\bprivate\b/.test(h) ? '-' : /\bprotected\b/.test(h) ? '#' : '+';
    const isStatic = /\bstatic\b/.test(h), readOnly = /\breadonly\b/.test(h), isAbstract = /\babstract\b/.test(h);
    h = h.replace(/\b(public|private|protected|static|readonly|abstract|declare|override|async|accessor)\b/g, ' ').replace(/^\s*#/, '').replace(/\s+/g, ' ').trim();
    const mm = h.match(/^([A-Za-z_$][\w$]*)\s*\??\s*(<[^>]*>)?\s*\(/);
    if (mm) {
      const open = h.indexOf('(', mm[1].length);
      const close = closeParen(h, open);
      const after = h.slice(close + 1).trim();
      const params = UML.splitTop(h.slice(open + 1, close), ',');
      t.operations.push({
        vis, name: mm[1], isStatic, isAbstract,
        ret: after.startsWith(':') ? norm(after.slice(1)).replace(/^void$/, '') : '',
        params: params.map(x => { const pp = UML.parseParam(x.replace(/^\.\.\./, '')); pp.type = norm(pp.type); return pp; }),
      });
      return;
    }
    const fm = h.match(/^([A-Za-z_$][\w$]*)\s*([?!])?\s*([\s\S]*)$/);
    if (!fm) return;
    let rest = fm[3].trim(), type = '', def = '';
    const eq = UML.topLevel(rest, (ch, i, s) => ch === '=' && s[i + 1] !== '>');
    if (eq >= 0) { def = rest.slice(eq + 1).trim(); rest = rest.slice(0, eq).trim(); }
    if (rest.startsWith(':')) type = norm(rest.slice(1));
    if (!type && !def) return;
    t.attributes.push({ vis: iface ? '+' : vis, name: fm[1], type, def: cleanDef(def), mult: fm[2] === '?' ? '0..1' : '', isStatic, readOnly });
  }

  function collectionInfo(type) {
    const t = String(type || '').trim();
    const m = t.match(/^(?:java\.util\.)?(?:List|Set|Collection|ArrayList|LinkedList|HashSet|TreeSet|Iterable|Array|ReadonlyArray|Queue|Deque)<\s*(.+?)\s*>$/);
    if (m) return { base: m[1], many: true };
    const a = t.match(/^(.+)\[\]$/);
    if (a) return { base: a[1].trim(), many: true };
    return { base: t, many: false };
  }

  UML.importTypes = function (p, types, opt = {}) {
    const touched = new Set(), created = [];
    const byName = n => UML.classifierByName(p, n);
    const pkgOf = qn => {
      let parent = null;
      for (const part of qn.split('.').filter(Boolean)) {
        let e = Object.values(p.elements).find(x => x.kind === 'package' && x.name === part && x.package === parent);
        if (!e) { e = UML.newElement('package', part); e.package = parent; p.elements[e.id] = e; }
        parent = e.id;
      }
      return parent;
    };
    for (const t of types) {
      let e = byName(t.name);
      if (!e) { e = UML.newElement(t.kind, t.name); p.elements[e.id] = e; created.push(e.id); }
      e.isAbstract = e.isAbstract || t.isAbstract;
      e.isLeaf = e.isLeaf || t.isLeaf;
      if (t.templateParams) e.templateParams = t.templateParams;
      if (t.package && !e.package) e.package = pkgOf(t.package);
      for (const a of t.attributes) if (!e.attributes.some(x => x.name === a.name)) e.attributes.push(Object.assign({ id: uid(), vis: '-', name: '', type: '', mult: '', def: '', derived: false, readOnly: false, props: '', isStatic: false }, a));
      for (const o of t.operations) if (!e.operations.some(x => x.name === o.name && x.params.length === o.params.length)) e.operations.push(Object.assign({ id: uid(), vis: '+', name: '', params: [], ret: '', retMult: '', props: '', isStatic: false, isAbstract: false }, o));
      for (const l of t.literals) if (!e.literals.some(x => x.name === l)) e.literals.push(UML.lit(l));
      touched.add(e.id);
    }
    const hasRel = (kind, a, b) => Object.values(p.relations).some(r => r.kind === kind && r.source === a && r.target === b);
    const link = (kind, a, b) => { if (!hasRel(kind, a, b)) { const r = UML.newRelation(kind, a, b); p.relations[r.id] = r; } };
    for (const t of types) {
      const e = byName(t.name);
      for (const x of t.extends) { const b = byName(x); if (b && b.id !== e.id) link('generalization', e.id, b.id); }
      for (const x of t.implements) { const b = byName(x); if (b) link('realization', e.id, b.id); }
    }
    if (opt.assoc !== false) {
      for (const id of touched) {
        const e = p.elements[id];
        e.attributes = e.attributes.filter(a => {
          if (a.isStatic) return true;
          const info = collectionInfo(a.type);
          const target = byName(info.base);
          if (!target || !['class', 'interface'].includes(target.kind)) return true;
          const exists = Object.values(p.relations).some(r => r.kind === 'association' && r.source === e.id && r.target === target.id && r.ends[1].role === a.name);
          if (!exists) {
            const r = UML.newRelation('association', e.id, target.id);
            Object.assign(r.ends[1], { role: a.name, vis: a.vis, nav: 'nav', mult: info.many ? '0..*' : a.mult || '1' });
            p.relations[r.id] = r;
          }
          return false;
        });
      }
    }
    return { ids: [...touched], created };
  };

  if (typeof module === 'object' && module.exports) module.exports = UML;
})(typeof globalThis !== 'undefined' ? globalThis : this);
