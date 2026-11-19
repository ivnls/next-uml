/* Traço UML — editor: estado, interação, painéis e janelas. */
(() => {
  'use strict';
  const U = window.UML;
  const $ = s => document.querySelector(s);
  const esc = U.esc;
  const KEY = 'tracouml.v2', OLD_KEY = 'tracouml.v1';
  const GRID = 10;
  const snap = v => Math.round(v / GRID) * GRID;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fine = matchMedia('(pointer:fine)').matches;
  const narrow = () => innerWidth <= 860;

  /* ---------- medição de texto ---------- */
  const mctx = document.createElement('canvas').getContext('2d');
  const mcache = new Map();
  U.setMeasure((t, f) => {
    t = String(t || '');
    const k = f + '|' + t;
    let w = mcache.get(k);
    if (w === undefined) { mctx.font = f; w = mctx.measureText(t).width; if (mcache.size > 8000) mcache.clear(); mcache.set(k, w); }
    return w;
  });

  /* ---------- ícones e ferramentas ---------- */
  const ICON = {
    select: '<path d="M5 3l10 6.5-4.6 1.2L8.2 15.5z" fill="currentColor" stroke="none"/>',
    hand: '<path d="M7 10V5.5a1.2 1.2 0 012.4 0V9M9.4 9V4.2a1.2 1.2 0 012.4 0V9M11.8 9V5.2a1.2 1.2 0 012.4 0V11c0 3.3-2 5.5-5 5.5-2.2 0-3.4-1.2-4.4-3L3.6 11a1.1 1.1 0 011.9-1.1L7 12"/>',
    class: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 8h14M3 12.5h14"/>',
    interface: '<circle cx="10" cy="6.5" r="3.5"/><path d="M10 10v7"/>',
    enumeration: '<rect x="3" y="3" width="14" height="14" rx="1"/><path d="M3 8h14M6.5 11h7M6.5 14h4.5"/>',
    datatype: '<rect x="3" y="5" width="14" height="10" rx="1"/><path d="M3 9h14M6 12h4"/>',
    primitive: '<rect x="4" y="6" width="12" height="8" rx="1"/><path d="M7 10h6"/>',
    object: '<rect x="3" y="4" width="14" height="12" rx="1"/><path d="M6 9h8M3 11.5h14"/>',
    package: '<path d="M3 5h6v2.5h8V17H3z"/><path d="M3 7.5h6"/>',
    note: '<path d="M4 3h8.5L16 6.5V17H4z"/><path d="M12.5 3v3.5H16"/>',
    nary: '<path d="M10 4l6.5 6-6.5 6-6.5-6z"/>',
    'r:association': '<path d="M3 17L17 3"/>',
    'r:directed': '<path d="M3 17L17 3M10.5 3H17v6.5"/>',
    'r:aggregation': '<path d="M3 17l7-7"/><path d="M17 3L15.3 8.3 10 10 11.7 4.7z"/>',
    'r:composition': '<path d="M3 17l7-7"/><path d="M17 3L15.3 8.3 10 10 11.7 4.7z" fill="currentColor"/>',
    'r:generalization': '<path d="M3 17L13.1 6.9"/><path d="M17 3L15.2 9 11 4.8z"/>',
    'r:realization': '<path d="M3 17L13.1 6.9" stroke-dasharray="2.2 2"/><path d="M17 3L15.2 9 11 4.8z"/>',
    'r:dependency': '<path d="M3 17L17 3" stroke-dasharray="2.2 2"/><path d="M10.5 3H17v6.5"/>',
    'r:assocclass': '<path d="M2.5 16h15"/><path d="M10 16v-5" stroke-dasharray="1.6 1.6"/><rect x="5.5" y="3" width="9" height="6" rx=".5"/>',
    'r:anchor': '<path d="M3 17L17 3" stroke-dasharray="2.2 2"/><circle cx="4" cy="16" r="1.6" fill="currentColor"/>',
    diagram: '<rect x="2.5" y="3" width="8" height="7" rx=".5"/><rect x="9.5" y="11" width="8" height="6" rx=".5"/><path d="M6.5 10v4h3"/>',
    multi: '<rect x="3" y="3" width="9" height="9" rx="1"/><rect x="8" y="8" width="9" height="9" rx="1"/>',
  };
  const ico = id => `<svg viewBox="0 0 20 20" aria-hidden="true">${ICON[id] || ICON.class}</svg>`;
  const TOOLS = [
    { g: 'Navegar', items: [{ id: 'select', label: 'Selecionar', key: 'v' }, { id: 'hand', label: 'Mover vista', key: 'h' }] },
    { g: 'Elementos', items: [
      { id: 'class', label: 'Classe', key: 'c' }, { id: 'interface', label: 'Interface', key: 'i' }, { id: 'enumeration', label: 'Enumeração', key: 'e' },
      { id: 'datatype', label: 'Tipo de dado', key: 't' }, { id: 'object', label: 'Objeto', key: 'o' }, { id: 'package', label: 'Pacote', key: 'p' }, { id: 'note', label: 'Nota', key: 'n' },
    ] },
    { g: 'Relações', items: [
      { id: 'r:association', label: 'Associação', key: 'a' }, { id: 'r:directed', label: 'Dirigida', full: 'Associação dirigida' },
      { id: 'r:aggregation', label: 'Agregação' }, { id: 'r:composition', label: 'Composição' },
      { id: 'r:generalization', label: 'Generalização', key: 'g' }, { id: 'r:realization', label: 'Realização', key: 'r' },
      { id: 'r:dependency', label: 'Dependência', key: 'd' }, { id: 'r:assocclass', label: 'Classe assoc.', full: 'Classe de associação' },
      { id: 'nary', label: 'N-ária', full: 'Associação n-ária' }, { id: 'r:anchor', label: 'Ligar nota' },
    ] },
  ];
  const TOOL_HELP = {
    'r:generalization': 'arraste da subclasse até a superclasse.', 'r:realization': 'arraste da classe até a interface.',
    'r:aggregation': 'arraste da parte até o todo (o losango fica no todo).', 'r:composition': 'arraste da parte até o todo (o losango fica no todo).',
    'r:dependency': 'arraste do cliente até o fornecedor.', 'r:directed': 'arraste da origem até o destino navegável.',
    'r:assocclass': 'arraste da classe até uma associação já desenhada.', 'r:anchor': 'arraste da nota até o elemento comentado.',
  };

  /* ---------- estado ---------- */
  let P, sel = new Set(), browserSel = null, tool = 'select', toolLocked = false;
  let drag = null, pending = null, lastPointer = { x: 0, y: 0 }, spaceDown = false;
  let history = [], future = [], pendingSnap = null, clip = null, pasteN = 0, geom = {}, lastBBox = null;
  let inline = null, showMini = true, lastDown = null, pressTimer = null;
  const D = () => P.diagrams.find(d => d.id === P.current) || P.diagrams[0];
  const E = id => P.elements[id];
  const Rl = id => P.relations[id];
  const V = id => D().views.find(v => v.id === id);
  const EV = id => D().edges.find(e => e.id === id);
  const viewOf = (ref, d = D()) => d.views.find(v => v.ref === ref);
  const snapshot = () => JSON.stringify(P, (k, v) => (k && k[0] === '_' ? undefined : v));
  const nameOf = e => (!e ? '' : e.kind === 'note' ? 'Nota' : e.kind === 'object' ? U.objectLabel(e, P) : e.kind === 'nary' ? e.name || 'Losango n-ário' : e.name || '(sem nome)');
  const byName = (a, b) => nameOf(a).localeCompare(nameOf(b));
  const mlist = (e, k) => ({ attr: e.attributes, op: e.operations, lit: e.literals, slot: e.slots }[k]);
  const fmtMember = (k, m) => (k === 'attr' ? U.fmtAttr(m) : k === 'op' ? U.fmtOp(m) : k === 'lit' ? m.name : U.fmtSlot(m));
  const applyMember = (k, m, val) => {
    if (k === 'attr') Object.assign(m, U.parseAttr(val));
    else if (k === 'op') Object.assign(m, U.parseOp(val));
    else if (k === 'lit') m.name = val.trim();
    else Object.assign(m, U.parseSlot(val));
  };
  const newMember = (k, e) => {
    if (k === 'attr') return e.kind === 'interface' ? U.attr('+ CONSTANTE: int = 0', { isStatic: true, readOnly: true }) : U.attr('- atributo: String');
    if (k === 'op') return U.op('+ operacao(): void');
    if (k === 'lit') return U.lit('NOVO_VALOR');
    return U.slot('atributo = valor');
  };

  /* ---------- persistência e histórico ---------- */
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return U.normalize(JSON.parse(raw)); } catch (_) { /* segue com o exemplo */ }
    return null;
  }
  let saveT, issueT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => { try { localStorage.setItem(KEY, snapshot()); } catch (_) { /* armazenamento indisponível */ } }, 300);
    clearTimeout(issueT);
    issueT = setTimeout(updateBadge, 700);
  }
  function updateBadge() {
    const n = U.validate(P).filter(i => i.level !== 'info').length;
    const b = $('#issueBadge');
    b.hidden = !n;
    b.textContent = n;
  }
  function checkpoint() { history.push(snapshot()); if (history.length > 200) history.shift(); future = []; pendingSnap = null; undoBtns(); }
  function beginEdit() { if (pendingSnap) { history.push(pendingSnap); future = []; pendingSnap = null; undoBtns(); } }
  function restore(s) {
    P = U.normalize(JSON.parse(s));
    const d = D();
    sel = new Set([...sel].filter(id => d.views.some(v => v.id === id) || d.edges.some(e => e.id === id)));
    if (browserSel && !E(browserSel)) browserSel = null;
    refresh(); save();
  }
  function undo() { if (inline) cancelInline(); if (!history.length) return; future.push(snapshot()); restore(history.pop()); undoBtns(); toast('Desfeito'); }
  function redo() { if (!future.length) return; history.push(snapshot()); restore(future.pop()); undoBtns(); toast('Refeito'); }
  function undoBtns() { $('#bUndo').disabled = !history.length; $('#bRedo').disabled = !future.length; }

  /* ---------- desenho ---------- */
  const svg = $('#svg'), vp = $('#vp'), canvas = $('#canvas'), props = $('#props');
  function render() {
    const d = D(), v = d.view;
    vp.setAttribute('transform', `translate(${v.x} ${v.y}) scale(${v.z})`);
    canvas.style.backgroundSize = `${20 * v.z}px ${20 * v.z}px`;
    canvas.style.backgroundPosition = `${v.x}px ${v.y}px`;
    const out = U.renderDiagram(P, d, { sel, hi: drag && drag.over });
    geom = out.geom;
    lastBBox = out.bbox;
    let h = out.svg;
    const from = drag && drag.mode === 'link' ? drag.from : pending && pending.from;
    if (from && V(from)) {
      const c = U.center(V(from)), t = drag && drag.mode === 'link' ? drag.cur : lastPointer;
      h += `<path class="temp" d="M${c.x} ${c.y}L${t.x} ${t.y}"/>`;
    }
    if (drag && drag.mode === 'ep') {
      const g = geom[drag.ev.id];
      if (g) { const o = drag.end ? g.raw[0] : g.raw[g.raw.length - 1]; h += `<path class="temp" d="M${o.x} ${o.y}L${drag.cur.x} ${drag.cur.y}"/>`; }
    }
    if (drag && drag.mode === 'marquee') {
      const r = rectOf(drag.start, drag.cur);
      h += `<rect class="marquee" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
    }
    vp.innerHTML = h;
    $('#zoomLbl').textContent = Math.round(v.z * 100) + '%';
    $('#crumb').textContent = `${P.name} / ${d.name}`;
    renderMini();
  }
  const rectOf = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  function refresh() { render(); renderProps(); renderTree(); hint(); undoBtns(); }

  /* ---------- minimapa ---------- */
  const mini = $('#mini');
  let miniT = null;
  function renderMini() {
    const off = !showMini || narrow();
    mini.toggleAttribute('hidden', off);
    $('#miniBtn').setAttribute('aria-pressed', showMini);
    if (off) return;
    const d = D(), v = d.view, r = svg.getBoundingClientRect();
    const vw = { x: -v.x / v.z, y: -v.y / v.z, w: r.width / v.z, h: r.height / v.z };
    const b = lastBBox ? { x: Math.min(lastBBox.x, vw.x), y: Math.min(lastBBox.y, vw.y) } : { x: vw.x, y: vw.y };
    b.w = Math.max(lastBBox ? lastBBox.x + lastBBox.w : 0, vw.x + vw.w) - b.x;
    b.h = Math.max(lastBBox ? lastBBox.y + lastBBox.h : 0, vw.y + vw.h) - b.y;
    const W = 180, H = 120, s = Math.min(W / b.w, H / b.h);
    miniT = { b, s, ox: (W - b.w * s) / 2, oy: (H - b.h * s) / 2 };
    const X = x => miniT.ox + (x - b.x) * s, Y = y => miniT.oy + (y - b.y) * s;
    let h = '';
    for (const n of d.views) if (n._w) h += `<rect class="mm-node${E(n.ref)?.kind === 'package' ? ' pk' : ''}" x="${X(n.x).toFixed(1)}" y="${Y(n.y).toFixed(1)}" width="${Math.max(1.5, n._w * s).toFixed(1)}" height="${Math.max(1.5, n._h * s).toFixed(1)}"/>`;
    h += `<rect class="mm-view" x="${X(vw.x).toFixed(1)}" y="${Y(vw.y).toFixed(1)}" width="${(vw.w * s).toFixed(1)}" height="${(vw.h * s).toFixed(1)}"/>`;
    mini.innerHTML = h;
  }
  function miniNav(e) {
    if (!miniT) return;
    const r = mini.getBoundingClientRect(), d = D(), v = d.view, sr = svg.getBoundingClientRect();
    const wx = (e.clientX - r.left - miniT.ox) / miniT.s + miniT.b.x, wy = (e.clientY - r.top - miniT.oy) / miniT.s + miniT.b.y;
    v.x = sr.width / 2 - wx * v.z; v.y = sr.height / 2 - wy * v.z;
    render();
  }
  mini.addEventListener('pointerdown', e => { e.preventDefault(); mini.setPointerCapture(e.pointerId); miniNav(e); });
  mini.addEventListener('pointermove', e => { if (e.buttons) miniNav(e); });
  mini.addEventListener('pointerup', save);
  $('#miniBtn').addEventListener('click', () => { showMini = !showMini; try { localStorage.setItem('tracouml.mini', showMini ? '1' : '0'); } catch (_) { /* */ } render(); });

  /* ---------- ferramentas ---------- */
  function buildTools() {
    $('#tools').innerHTML = TOOLS.map(g => `<div class="tgroup"><b>${g.g}</b>${g.items.map(t =>
      `<button class="tool" data-tool="${t.id}" title="${esc((t.full || t.label) + (t.key ? ` (${t.key.toUpperCase()})` : ''))}"><svg viewBox="0 0 20 20" aria-hidden="true">${ICON[t.id]}</svg><span>${t.label}</span></button>`).join('')}</div>`).join('');
  }
  function setTool(t, lock = false) {
    tool = t; toolLocked = lock && t !== 'select'; pending = null;
    document.querySelectorAll('.tool').forEach(b => { b.setAttribute('aria-pressed', b.dataset.tool === t); b.classList.toggle('locked', toolLocked && b.dataset.tool === t); });
    svg.classList.toggle('c-create', t !== 'select' && t !== 'hand');
    svg.classList.toggle('c-pan', t === 'hand');
    hint(); render();
  }
  function hint() {
    let s;
    const all = TOOLS.flatMap(g => g.items);
    const t = all.find(x => x.id === tool);
    if (pending) s = tool === 'r:assocclass' ? 'Agora clique na associação. Esc cancela.' : 'Agora clique no elemento de destino. Esc cancela.';
    else if (tool === 'select') s = 'Duplo clique edita no próprio diagrama · arraste o vazio para selecionar · botão direito abre o menu · Ctrl+roda dá zoom';
    else if (tool === 'hand') s = 'Arraste para mover a vista.';
    else if (U.KINDS[tool]) s = `Clique na folha para inserir: ${t.full || t.label}. Duplo clique na ferramenta a mantém ativa.`;
    else s = `${t.full || t.label}: ${TOOL_HELP[tool] || 'arraste de um elemento até outro.'} Também dá para clicar na origem e depois no destino.`;
    $('#hint').textContent = s;
  }
  $('#tools').addEventListener('click', e => { const b = e.target.closest('.tool'); if (b) setTool(b.dataset.tool); });
  $('#tools').addEventListener('dblclick', e => { const b = e.target.closest('.tool'); if (b) setTool(b.dataset.tool, true); });

  /* ---------- operações no modelo ---------- */
  function uniqueName(base) {
    const names = new Set(Object.values(P.elements).map(e => e.name));
    if (!names.has(base)) return base;
    let i = 2;
    while (names.has(base + i)) i++;
    return base + i;
  }
  const DEFAULT_NAME = { class: 'Classe', interface: 'Interface', enumeration: 'Enumeracao', datatype: 'TipoDeDado', object: 'objeto', package: 'pacote', nary: '' };
  function centerWorld() { const r = svg.getBoundingClientRect(), v = D().view; return { x: (r.width / 2 - v.x) / v.z, y: (r.height / 2 - v.y) / v.z }; }

  function createAt(kind, p, keep) {
    checkpoint();
    const e = U.newElement(kind, kind === 'note' ? '' : DEFAULT_NAME[kind] ? uniqueName(DEFAULT_NAME[kind] + '1') : '');
    if (kind === 'note') e.text = 'Escreva uma nota';
    P.elements[e.id] = e;
    const d = D(), v = U.newView(e.id, 0, 0);
    d.views.push(v);
    U.layoutView(v, e, d, P);
    v.x = snap(p.x - v._w / 2); v.y = snap(p.y - v._h / 2);
    updateMembership([v]);
    sel = new Set([v.id]); browserSel = null;
    if (!keep && !toolLocked) setTool('select');
    refresh(); save();
    if (kind !== 'nary' && fine) requestAnimationFrame(() => startInline(v.id, kind === 'note' ? 'note' : 'name', { snap: history[history.length - 1], isNew: false }));
  }
  function relFromTool(t, a, b) {
    const map = { association: 'association', directed: 'association', aggregation: 'association', composition: 'association', generalization: 'generalization', realization: 'realization', dependency: 'dependency', anchor: 'anchor' };
    const r = U.newRelation(map[t], a, b);
    if (t === 'directed') r.ends[1].nav = 'nav';
    if (t === 'aggregation') r.ends[1].agg = 'shared';
    if (t === 'composition') { r.ends[1].agg = 'composite'; r.ends[1].mult = '1'; }
    return r;
  }
  function connect(fromV, toV) {
    const a = E(V(fromV).ref), b = E(V(toV).ref), t = tool.slice(2);
    pending = null;
    if (t === 'assocclass') { toast('Solte a classe sobre uma associação.'); render(); return; }
    if (t === 'anchor') { if (a.kind !== 'note' && b.kind !== 'note') return fail('A ligação de nota precisa de uma nota numa das pontas.'); }
    else if (a.kind === 'note' || b.kind === 'note') return fail('Use “Ligar nota” para conectar notas.');
    if ((t === 'generalization' || t === 'realization') && a === b) return fail('Um elemento não pode herdar de si mesmo.');
    if ((a.kind === 'package' || b.kind === 'package') && t !== 'dependency' && t !== 'anchor') return fail('Pacotes se ligam por dependência.');
    if ((a.kind === 'object') !== (b.kind === 'object') && t !== 'dependency' && t !== 'anchor') return fail('Objetos se ligam a outros objetos (vínculos).');
    if (t === 'realization' && b.kind !== 'interface') toast('Atenção: o destino de uma realização costuma ser uma interface.');
    if (t === 'generalization' && a.kind === 'class' && b.kind === 'interface') toast('Dica: entre classe e interface use Realização.');
    checkpoint();
    const r = relFromTool(t, a.id, b.id);
    P.relations[r.id] = r;
    const ev = U.newEdgeView(r.id);
    D().edges.push(ev);
    sel = new Set([ev.id]); browserSel = null;
    if (!toolLocked) setTool('select');
    refresh(); save();
  }
  function fail(msg) { toast(msg); pending = null; render(); hint(); }
  function setAssocClass(classViewId, edgeId) {
    const ev = EV(edgeId), r = ev && Rl(ev.ref), c = E(V(classViewId).ref);
    pending = null;
    if (!r || r.kind !== 'association') return fail('Solte sobre uma associação.');
    if (c.kind !== 'class') return fail('A classe de associação precisa ser uma classe.');
    if (r.source === c.id || r.target === c.id) return fail('A classe de associação não pode ser uma das pontas da própria associação.');
    checkpoint();
    r.assocClass = c.id;
    sel = new Set([ev.id]);
    if (!toolLocked) setTool('select');
    refresh(); save(); toast(`${c.name} agora é a classe dessa associação.`);
  }
  function reconnect(ev, end, viewId) {
    const r = Rl(ev.ref), ref = V(viewId).ref;
    if ((end === 0 ? r.source : r.target) === ref) return;
    checkpoint();
    if (end === 0) r.source = ref; else r.target = ref;
    refresh(); save(); toast('Relação reconectada');
  }
  function inside(m, p) { return m !== p && m.x >= p.x && m.y >= p.y + 22 && m.x + m._w <= p.x + p._w && m.y + m._h <= p.y + p._h; }
  function updateMembership(views) {
    const d = D();
    const pkgs = d.views.filter(v => E(v.ref).kind === 'package' && v._w);
    for (const v of views) {
      const e = E(v.ref);
      if (!e || e.kind === 'note' || e.kind === 'nary') continue;
      const hosts = pkgs.filter(pv => pv !== v && inside(v, pv) && !(e.kind === 'package' && U.isDescendantPackage(P, e.id, pv.ref))).sort((a, b) => a._w * a._h - b._w * b._h);
      if (hosts.length) { if (e.package !== hosts[0].ref) e.package = hosts[0].ref; }
      else if (e.package && viewOf(e.package)) e.package = null;
    }
  }
  function addToDiagram(id, at) {
    const d = D();
    let v = viewOf(id);
    if (v) { sel = new Set([v.id]); browserSel = null; focusView(v); refresh(); toast('Esse elemento já está neste diagrama'); return; }
    checkpoint();
    const e = E(id);
    v = U.newView(id, 0, 0);
    d.views.push(v);
    U.layoutView(v, e, d, P);
    const p = at || centerWorld();
    v.x = snap(p.x - v._w / 2); v.y = snap(p.y - v._h / 2);
    for (const r of Object.values(P.relations)) {
      if (r.source !== id && r.target !== id) continue;
      if (!viewOf(r.source) || !viewOf(r.target)) continue;
      if (!d.edges.some(ev => ev.ref === r.id)) d.edges.push(U.newEdgeView(r.id));
    }
    sel = new Set([v.id]); browserSel = null;
    refresh(); save();
  }
  function purgeElement(id) {
    const e = E(id);
    if (!e) return;
    for (const x of Object.values(P.elements)) {
      if (x.package === id) x.package = e.kind === 'package' ? e.package : null;
      if (x.kind === 'object' && x.classifier === id) { x.classifier = null; x.classifierName = e.name; }
    }
    delete P.elements[id];
    for (const r of Object.values(P.relations)) {
      if (r.source === id || r.target === id) delete P.relations[r.id];
      else if (r.assocClass === id) r.assocClass = null;
    }
    for (const d of P.diagrams) { d.views = d.views.filter(v => v.ref !== id); d.edges = d.edges.filter(ev => P.relations[ev.ref]); }
  }
  function deleteFromDiagram() {
    if (!sel.size) return;
    checkpoint();
    const d = D();
    const refs = new Set([...sel].map(id => V(id)?.ref).filter(Boolean));
    const relIds = new Set([...sel].map(id => EV(id)?.ref).filter(Boolean));
    d.views = d.views.filter(v => !sel.has(v.id));
    d.edges = d.edges.filter(ev => { const r = Rl(ev.ref); return !sel.has(ev.id) && r && !refs.has(r.source) && !refs.has(r.target); });
    const used = new Set(P.diagrams.flatMap(x => x.views.map(v => v.ref)));
    for (const ref of refs) { const e = E(ref); if (e && (e.kind === 'note' || e.kind === 'nary') && !used.has(ref)) purgeElement(ref); }
    const usedRel = new Set(P.diagrams.flatMap(x => x.edges.map(ev => ev.ref)));
    for (const rid of relIds) { const r = Rl(rid); if (r && r.kind === 'anchor' && !usedRel.has(rid)) delete P.relations[rid]; }
    sel.clear();
    refresh(); save();
    toast('Removido do diagrama. Os elementos continuam no modelo.');
  }
  function deleteFromModel() {
    const els = new Set([...sel].map(id => V(id)?.ref).filter(Boolean));
    const rels = new Set([...sel].map(id => EV(id)?.ref).filter(Boolean));
    if (!sel.size && browserSel) els.add(browserSel);
    if (!els.size && !rels.size) return;
    checkpoint();
    for (const id of els) purgeElement(id);
    for (const rid of rels) delete P.relations[rid];
    for (const d of P.diagrams) d.edges = d.edges.filter(ev => P.relations[ev.ref]);
    sel.clear(); browserSel = null;
    refresh(); save();
    toast(`Excluído do modelo e de todos os diagramas. Ctrl+Z desfaz.`);
  }
  function cloneElement(e) {
    const c = JSON.parse(JSON.stringify(e, (k, v) => (k && k[0] === '_' ? undefined : v)));
    c.id = U.uid();
    ['attributes', 'operations', 'literals', 'slots'].forEach(k => c[k] && c[k].forEach(m => { m.id = U.uid(); }));
    if (c.name && e.kind !== 'object') c.name = uniqueName(c.name);
    return c;
  }
  function copySel() {
    const d = D();
    const views = [...sel].map(V).filter(Boolean);
    if (!views.length) return false;
    clip = { from: d.id, refs: views.map(v => v.ref), views: views.map(v => ({ ...v, _L: undefined })) };
    pasteN = 0;
    return true;
  }
  function paste() {
    if (!clip) return;
    const d = D(), refs = clip.refs.filter(r => E(r));
    if (!refs.length) return;
    checkpoint();
    const absent = refs.filter(r => !viewOf(r));
    const newSel = [];
    if (absent.length === refs.length) {
      for (const ref of refs) {
        const src = clip.views.find(v => v.ref === ref);
        const v = Object.assign(U.newView(ref, src.x, src.y), { w: src.w, h: src.h, color: src.color, hideAttrs: src.hideAttrs, hideOps: src.hideOps, lollipop: src.lollipop });
        d.views.push(v); newSel.push(v.id);
      }
      for (const r of Object.values(P.relations)) if (viewOf(r.source) && viewOf(r.target) && (refs.includes(r.source) || refs.includes(r.target)) && !d.edges.some(ev => ev.ref === r.id)) d.edges.push(U.newEdgeView(r.id));
      toast('Adicionado a este diagrama (mesmos elementos do modelo)');
    } else {
      pasteN++;
      const map = {};
      for (const ref of refs) { const c = cloneElement(E(ref)); P.elements[c.id] = c; map[ref] = c.id; }
      for (const ref of refs) { const c = E(map[ref]); if (c.package && map[c.package]) c.package = map[c.package]; }
      for (const r of Object.values(P.relations)) {
        if (!map[r.source] || !map[r.target]) continue;
        const nr = JSON.parse(JSON.stringify(r));
        nr.id = U.uid(); nr.source = map[r.source]; nr.target = map[r.target];
        if (nr.assocClass && map[nr.assocClass]) nr.assocClass = map[nr.assocClass];
        P.relations[nr.id] = nr;
        d.edges.push(U.newEdgeView(nr.id));
      }
      for (const ref of refs) {
        const src = clip.views.find(v => v.ref === ref);
        const v = Object.assign(U.newView(map[ref], src.x + 20 * pasteN, src.y + 20 * pasteN), { w: src.w, h: src.h, color: src.color, hideAttrs: src.hideAttrs, hideOps: src.hideOps, lollipop: src.lollipop });
        d.views.push(v); newSel.push(v.id);
      }
    }
    sel = new Set(newSel); browserSel = null;
    refresh(); save();
  }
  function duplicate() { if (copySel()) { const keep = clip; paste(); clip = keep; } }
  function align(kind) {
    const vs = [...sel].map(V).filter(Boolean);
    if (vs.length < 2) return;
    checkpoint();
    const minX = Math.min(...vs.map(v => v.x)), maxX = Math.max(...vs.map(v => v.x + v._w));
    const minY = Math.min(...vs.map(v => v.y)), maxY = Math.max(...vs.map(v => v.y + v._h));
    if (kind === 'left') vs.forEach(v => (v.x = minX));
    if (kind === 'right') vs.forEach(v => (v.x = maxX - v._w));
    if (kind === 'hcenter') vs.forEach(v => (v.x = snap((minX + maxX) / 2 - v._w / 2)));
    if (kind === 'top') vs.forEach(v => (v.y = minY));
    if (kind === 'bottom') vs.forEach(v => (v.y = maxY - v._h));
    if (kind === 'vcenter') vs.forEach(v => (v.y = snap((minY + maxY) / 2 - v._h / 2)));
    if (kind === 'disth' && vs.length > 2) {
      vs.sort((a, b) => a.x - b.x);
      const gap = (maxX - minX - vs.reduce((s, v) => s + v._w, 0)) / (vs.length - 1);
      let x = minX; vs.forEach(v => { v.x = Math.round(x); x += v._w + gap; });
    }
    if (kind === 'distv' && vs.length > 2) {
      vs.sort((a, b) => a.y - b.y);
      const gap = (maxY - minY - vs.reduce((s, v) => s + v._h, 0)) / (vs.length - 1);
      let y = minY; vs.forEach(v => { v.y = Math.round(y); y += v._h + gap; });
    }
    if (kind === 'samew') { const w = Math.max(...vs.map(v => v._w)); vs.forEach(v => (v.w = w)); }
    render(); save();
  }
  function setColor(views, c) { checkpoint(); views.forEach(v => (v.color = c)); refresh(); save(); }
  function toggleView(v, f) { checkpoint(); v[f] = !v[f]; refresh(); save(); }
  function reverseRel(r, ev) {
    checkpoint();
    [r.source, r.target] = [r.target, r.source];
    r.ends.reverse();
    if (ev) {
      ev.points.reverse();
      const L = ev.labels || {}, nl = {};
      for (const k in L) nl[k.replace(/[01]$/, m => (m === '0' ? '1' : '0'))] = L[k];
      ev.labels = nl;
    }
    refresh(); save();
  }
  function changeKind(e, k) {
    e.kind = k;
    if (k !== 'interface') P.diagrams.forEach(d => d.views.forEach(v => { if (v.ref === e.id) v.lollipop = false; }));
    if (k === 'enumeration' && !e.literals.length) e.literals.push(U.lit('VALOR'));
  }
  function autoLayout(d = D(), only = null) {
    const views = d.views.filter(v => { const e = E(v.ref); return e && !['package', 'note'].includes(e.kind) && (!only || only.has(v.ref)); });
    views.forEach(v => U.layoutView(v, E(v.ref), d, P));
    const byRef = new Map(views.map(v => [v.ref, v]));
    const parents = new Map(views.map(v => [v.ref, []]));
    const hasChild = new Set();
    for (const r of Object.values(P.relations)) {
      if ((r.kind === 'generalization' || r.kind === 'realization') && byRef.has(r.source) && byRef.has(r.target) && r.source !== r.target) { parents.get(r.source).push(r.target); hasChild.add(r.target); }
    }
    const rank = new Map();
    const rk = (ref, depth = 0) => {
      if (rank.has(ref)) return rank.get(ref);
      if (depth > 40) return 0;
      const ps = parents.get(ref) || [];
      const v = ps.length ? 1 + Math.max(...ps.map(x => rk(x, depth + 1))) : 0;
      rank.set(ref, v);
      return v;
    };
    const hier = views.filter(v => parents.get(v.ref).length || hasChild.has(v.ref));
    const loose = views.filter(v => !hier.includes(v)).sort((a, b) => byName(E(a.ref), E(b.ref)));
    const rows = [];
    hier.forEach(v => { const r = rk(v.ref); (rows[r] = rows[r] || []).push(v); });
    const cx = new Map();
    let y = 40, maxW = 0;
    const laid = [];
    for (const row of rows.filter(Boolean)) {
      const bary = v => { const ps = parents.get(v.ref).filter(x => cx.has(x)); return ps.length ? ps.reduce((s, x) => s + cx.get(x), 0) / ps.length : 0; };
      row.sort((a, b) => bary(a) - bary(b) || byName(E(a.ref), E(b.ref)));
      let x = 0;
      for (const v of row) { v.x = x; v.y = y; cx.set(v.ref, x + v._w / 2); x += v._w + 60; }
      laid.push({ row, w: x - 60 });
      maxW = Math.max(maxW, x - 60);
      y += Math.max(...row.map(v => v._h)) + 90;
    }
    laid.forEach(({ row, w }) => row.forEach(v => { v.x += (maxW - w) / 2; }));
    const cols = Math.max(1, Math.round(Math.sqrt(loose.length * 1.8)));
    let lx = 0, ly = y, rowH = 0;
    loose.forEach((v, i) => {
      if (i && i % cols === 0) { lx = 0; ly += rowH + 70; rowH = 0; }
      v.x = lx; v.y = ly; lx += v._w + 60; rowH = Math.max(rowH, v._h);
    });
    views.forEach(v => { v.x = snap(v.x + 40); v.y = snap(v.y); });
    const refs = new Set(views.map(v => v.ref));
    d.edges.forEach(ev => { const r = Rl(ev.ref); if (r && (refs.has(r.source) || refs.has(r.target))) { ev.points = []; ev.labels = {}; } });
  }

  /* ---------- vista ---------- */
  function fit() {
    render();
    const b = lastBBox, r = svg.getBoundingClientRect(), d = D();
    if (!b || !r.width) { d.view = { x: 60, y: 60, z: 1 }; render(); return; }
    const z = clamp(Math.min((r.width - 40) / b.w, (r.height - 50) / b.h), 0.2, 1.25);
    d.view = { z, x: (r.width - b.w * z) / 2 - b.x * z, y: (r.height - 30 - b.h * z) / 2 - b.y * z };
    render(); save();
  }
  function zoomAt(cx, cy, f) {
    const v = D().view, r = svg.getBoundingClientRect(), px = cx - r.left, py = cy - r.top;
    const nz = clamp(v.z * f, 0.2, 4);
    v.x = px - (px - v.x) * (nz / v.z); v.y = py - (py - v.y) * (nz / v.z); v.z = nz;
    render(); save();
  }
  const zoomCenter = f => { const r = svg.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, f); };
  function focusView(v) {
    const r = svg.getBoundingClientRect(), d = D(), z = d.view.z;
    if (!v._w) U.layoutView(v, E(v.ref), d, P);
    const c = U.center(v), sx = c.x * z + d.view.x, sy = c.y * z + d.view.y;
    if (sx < 60 || sy < 60 || sx > r.width - 60 || sy > r.height - 60) { d.view.x = r.width / 2 - c.x * z; d.view.y = r.height / 2 - c.y * z; }
  }
  function switchDiagram(id) { if (inline) commitInline(); P.current = id; sel.clear(); browserSel = null; pending = null; refresh(); save(); }
  function goToElement(id) {
    const d = viewOf(id) ? D() : P.diagrams.find(x => viewOf(id, x));
    if (d) { if (d !== D()) P.current = d.id; const v = viewOf(id); sel = new Set([v.id]); browserSel = null; focusView(v); }
    else { sel.clear(); browserSel = id; }
    refresh(); save();
    if (narrow()) openDrawer('right');
  }
  function goToRelation(id) {
    const d = D().edges.some(ev => ev.ref === id) ? D() : P.diagrams.find(x => x.edges.some(ev => ev.ref === id));
    if (d) { P.current = d.id; const ev = D().edges.find(x => x.ref === id); sel = new Set([ev.id]); const r = Rl(id); const v = viewOf(r.source); if (v) focusView(v); }
    refresh();
    if (narrow()) openDrawer('right');
  }

  /* ---------- ponteiro ---------- */
  function toWorld(e) { const r = svg.getBoundingClientRect(), v = D().view; return { x: (e.clientX - r.left - v.x) / v.z, y: (e.clientY - r.top - v.y) / v.z }; }
  function nodeAt(e) { const el = document.elementFromPoint(e.clientX, e.clientY); const n = el && el.closest('[data-kind="node"]'); return n && svg.contains(n) ? n.dataset.id : null; }
  function edgeAt(e) { const el = document.elementFromPoint(e.clientX, e.clientY); const n = el && el.closest('[data-kind="edge"],[data-kind="label"],[data-kind="mid"],[data-kind="wp"],[data-kind="ep"]'); return n && svg.contains(n) ? n.dataset.id : null; }

  svg.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    const ae = document.activeElement;
    if (ae && ae !== document.body && !ae.classList.contains('inline-ed')) ae.blur();
    if (inline) commitInline();
    hideMenu();
    e.preventDefault();
    const p = toWorld(e);
    lastPointer = p;
    const hit = e.target.closest('[data-kind]');
    const kind = hit && hit.dataset.kind, id = hit && hit.dataset.id;
    const nodeEl = e.target.closest('[data-kind="node"]');
    const nodeId = nodeEl && nodeEl.dataset.id;
    const subEl = e.target.closest('[data-sub]');
    const now = performance.now();
    const isDouble = lastDown && now - lastDown.t < 380 && Math.hypot(e.clientX - lastDown.x, e.clientY - lastDown.y) < 8 && lastDown.id === (id || null) && lastDown.kind === (kind || null);
    lastDown = { t: now, x: e.clientX, y: e.clientY, id: id || null, kind: kind || null };
    try { svg.setPointerCapture(e.pointerId); } catch (_) { /* */ }
    const d = D();

    if (e.button === 1 || spaceDown || tool === 'hand' || (tool === 'select' && !hit && e.pointerType === 'touch' && !isDouble)) {
      drag = { mode: 'pan', sx: e.clientX, sy: e.clientY, vx: d.view.x, vy: d.view.y };
      svg.classList.add('panning');
      if (e.pointerType === 'touch' && !hit) armPress(e, null);
      return;
    }
    if (U.KINDS[tool]) { createAt(tool, p, e.shiftKey); return; }
    if (tool.startsWith('r:')) {
      if (tool === 'r:assocclass' && pending && (kind === 'edge' || kind === 'label')) { setAssocClass(pending.from, id); return; }
      if (nodeId) {
        if (pending) { if (tool === 'r:assocclass') fail('Clique numa associação.'); else connect(pending.from, nodeId); return; }
        drag = { mode: 'link', from: nodeId, start: p, cur: p };
      } else { pending = null; hint(); }
      render();
      return;
    }
    if (isDouble) { lastDown = null; onDouble(kind, id, nodeId, subEl, hit, p); return; }
    if (kind === 'handle') { const v = V(id); drag = { mode: 'resize', v, start: p, w: v._w, h: v._h, moved: false }; return; }
    if (kind === 'ep') { drag = { mode: 'ep', ev: EV(id), end: +hit.dataset.end, cur: p }; render(); return; }
    if (kind === 'wp') { drag = { mode: 'wp', ev: EV(id), i: +hit.dataset.i, moved: false }; return; }
    if (kind === 'mid') {
      checkpoint();
      const ev = EV(id), g = geom[ev.id];
      if (!ev.points.length && g && g.raw.length > 2) ev.points = g.raw.slice(1, -1).map(q => ({ x: Math.round(q.x), y: Math.round(q.y) }));
      const i = +hit.dataset.i;
      ev.points.splice(i, 0, { x: snap(p.x), y: snap(p.y) });
      drag = { mode: 'wp', ev, i, moved: true };
      render();
      return;
    }
    if (kind === 'label') {
      const ev = EV(id), key = hit.dataset.key, o = (ev.labels && ev.labels[key]) || { dx: 0, dy: 0 };
      sel = new Set([ev.id]); browserSel = null;
      drag = { mode: 'label', ev, key, start: p, dx: o.dx, dy: o.dy, moved: false };
      render(); renderProps(); renderTree();
      return;
    }
    if (nodeId) {
      browserSel = null;
      if (e.shiftKey || e.ctrlKey || e.metaKey) sel.has(nodeId) ? sel.delete(nodeId) : sel.add(nodeId);
      else if (!sel.has(nodeId)) sel = new Set([nodeId]);
      const ids = new Set([...sel].filter(i => V(i)));
      for (const i of [...ids]) { const v = V(i); if (E(v.ref).kind === 'package') d.views.forEach(m => { if (inside(m, v)) ids.add(m.id); }); }
      const refs = new Set([...ids].map(i => V(i).ref));
      const evs = d.edges.filter(ev => { const r = Rl(ev.ref); return r && ev.points.length && refs.has(r.source) && refs.has(r.target); });
      drag = { mode: 'move', start: p, orig: [...ids].map(i => { const v = V(i); return { v, x: v.x, y: v.y }; }), eorig: evs.map(ev => ({ ev, pts: ev.points.map(q => ({ ...q })) })), moved: false };
      if (e.pointerType === 'touch') armPress(e, { kind: 'node', id: nodeId });
    } else if (kind === 'edge') {
      browserSel = null;
      if (e.shiftKey) sel.has(id) ? sel.delete(id) : sel.add(id); else sel = new Set([id]);
      if (e.pointerType === 'touch') armPress(e, { kind: 'edge', id });
    } else {
      browserSel = null;
      if (!e.shiftKey) sel.clear();
      drag = { mode: 'marquee', start: p, cur: p, base: new Set(sel) };
    }
    render(); renderProps(); renderTree();
  });

  function onDouble(kind, id, nodeId, subEl, hit, p) {
    drag = null;
    if (kind === 'wp') { checkpoint(); const ev = EV(id); ev.points.splice(+hit.dataset.i, 1); refresh(); save(); return; }
    if (kind === 'edge' || kind === 'label') {
      sel = new Set([id]); refresh();
      if (narrow()) openDrawer('right');
      const f = $('#p-rel-name') || $('#p-end0-role'); if (f) { f.focus(); f.select(); }
      return;
    }
    if (nodeId) {
      sel = new Set([nodeId]); browserSel = null; refresh();
      const e = E(V(nodeId).ref);
      const sub = subEl ? subEl.dataset.sub : e.kind === 'note' ? 'note' : 'name';
      if (e.kind === 'nary' && sub !== 'name') { const f = $('#p-el-name'); if (f) f.focus(); return; }
      startInline(nodeId, sub);
      return;
    }
    void p;
  }

  svg.addEventListener('pointermove', e => {
    const p = toWorld(e);
    lastPointer = p;
    if (pressTimer && Math.hypot(e.clientX - pressTimer.x, e.clientY - pressTimer.y) > 8) cancelPress();
    if (!drag) { if (pending) render(); return; }
    const d = D();
    if (drag.mode === 'pan') { d.view.x = drag.vx + e.clientX - drag.sx; d.view.y = drag.vy + e.clientY - drag.sy; render(); return; }
    const dx = p.x - (drag.start ? drag.start.x : 0), dy = p.y - (drag.start ? drag.start.y : 0);
    if (drag.mode === 'move') {
      if (!drag.moved) { if (Math.hypot(dx, dy) * d.view.z < 3) return; checkpoint(); drag.moved = true; }
      const free = e.altKey;
      const sdx = free ? dx : snap(drag.orig[0].x + dx) - drag.orig[0].x, sdy = free ? dy : snap(drag.orig[0].y + dy) - drag.orig[0].y;
      for (const o of drag.orig) { o.v.x = Math.round(o.x + sdx); o.v.y = Math.round(o.y + sdy); }
      for (const o of drag.eorig) o.ev.points = o.pts.map(q => ({ x: Math.round(q.x + sdx), y: Math.round(q.y + sdy) }));
      render();
    } else if (drag.mode === 'resize') {
      if (!drag.moved) { checkpoint(); drag.moved = true; }
      const v = drag.v;
      v.w = Math.max(60, snap(drag.w + dx)); v.h = Math.max(30, snap(drag.h + dy));
      render();
    } else if (drag.mode === 'wp') {
      if (!drag.moved) { checkpoint(); drag.moved = true; }
      drag.ev.points[drag.i] = { x: e.altKey ? Math.round(p.x) : snap(p.x), y: e.altKey ? Math.round(p.y) : snap(p.y) };
      render();
    } else if (drag.mode === 'label') {
      if (!drag.moved) { if (Math.hypot(dx, dy) * d.view.z < 3) return; checkpoint(); drag.moved = true; }
      drag.ev.labels = drag.ev.labels || {};
      drag.ev.labels[drag.key] = { dx: Math.round(drag.dx + dx), dy: Math.round(drag.dy + dy) };
      render();
    } else if (drag.mode === 'link' || drag.mode === 'ep') {
      drag.cur = p;
      drag.over = tool === 'r:assocclass' ? null : nodeAt(e);
      render();
    } else if (drag.mode === 'marquee') {
      drag.cur = p;
      const r = rectOf(drag.start, p);
      sel = new Set(drag.base);
      d.views.forEach(v => { if (v._w && v.x < r.x + r.w && v.x + v._w > r.x && v.y < r.y + r.h && v.y + v._h > r.y) sel.add(v.id); });
      render();
    }
  });
  function endDrag(e) {
    cancelPress();
    if (!drag) return;
    const m = drag;
    drag = null;
    svg.classList.remove('panning');
    if (m.mode === 'link') {
      if (tool === 'r:assocclass') {
        const eid = edgeAt(e);
        if (eid) { setAssocClass(m.from, eid); return; }
        const to = nodeAt(e);
        if (to === m.from) { pending = { from: m.from }; hint(); }
        render(); return;
      }
      const to = nodeAt(e), dist = Math.hypot(m.cur.x - m.start.x, m.cur.y - m.start.y);
      if (to && (to !== m.from || dist > 30)) { connect(m.from, to); return; }
      if (to === m.from) { pending = { from: m.from }; hint(); }
    }
    if (m.mode === 'ep') { const to = nodeAt(e); if (to) { reconnect(m.ev, m.end, to); return; } }
    if (m.mode === 'move' && m.moved) { updateMembership(m.orig.map(o => o.v)); save(); renderTree(); }
    if ((m.mode === 'resize' || m.mode === 'wp' || m.mode === 'label') && m.moved) save();
    if (m.mode === 'pan') save();
    render(); renderProps(); renderTree();
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-clamp(e.deltaY, -30, 30) * 0.01));
    else { const v = D().view; v.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX; v.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY; render(); save(); }
  }, { passive: false });
  svg.addEventListener('contextmenu', e => {
    e.preventDefault();
    const hit = e.target.closest('[data-kind]');
    openContext(hit ? { kind: hit.dataset.kind === 'label' ? 'edge' : hit.dataset.kind, id: hit.closest('[data-kind="node"]')?.dataset.id || hit.dataset.id } : null, e.clientX, e.clientY, toWorld(e));
  });
  function armPress(e, target) {
    cancelPress();
    const x = e.clientX, y = e.clientY, w = toWorld(e);
    pressTimer = { x, y, t: setTimeout(() => { pressTimer = null; drag = null; svg.classList.remove('panning'); openContext(target, x, y, w); }, 560) };
  }
  function cancelPress() { if (pressTimer) { clearTimeout(pressTimer.t); pressTimer = null; } }

  /* arrastar elementos do navegador do modelo para a folha */
  svg.addEventListener('dragover', e => { if ([...e.dataTransfer.types].includes('text/plain')) e.preventDefault(); });
  svg.addEventListener('drop', e => {
    const id = (e.dataTransfer.getData('text/plain') || '').replace(/^uml:/, '');
    if (!E(id)) return;
    e.preventDefault();
    addToDiagram(id, toWorld(e));
  });

  /* ---------- edição direta no diagrama ---------- */
  function startInline(vid, sub, opt = {}) {
    const v = V(vid);
    if (!v) return;
    const e = E(v.ref), d = D(), z = d.view.z;
    const [k, mid] = sub.split(':');
    if (k === 'add') { addMember(vid, mid); return; }
    let value, multiline = false;
    if (k === 'name') value = e.kind === 'object' ? U.objectLabel(e, P) : e.name;
    else if (k === 'note') { value = e.text; multiline = true; }
    else { const m = mlist(e, k) && mlist(e, k).find(x => x.id === mid); if (!m) return; value = fmtMember(k, m); }
    const g = vp.querySelector(`.node[data-id="${vid}"]`);
    if (!g) return;
    const cr = canvas.getBoundingClientRect();
    const S = (x, y) => ({ x: d.view.x + x * z, y: d.view.y + y * z });
    const el = document.createElement(multiline ? 'textarea' : 'input');
    el.className = 'inline-ed ' + (k === 'name' ? 'is-name' : multiline ? 'is-note' : 'is-mem');
    el.value = value;
    el.spellcheck = false;
    el.setAttribute('aria-label', k === 'name' ? 'Nome' : k === 'note' ? 'Texto da nota' : 'Membro');
    let left, top, width, height;
    if (k === 'note') { const a = S(v.x, v.y); left = a.x; top = a.y; width = Math.max(v._w * z, 200); height = Math.max(v._h * z, 70); }
    else {
      const t = g.querySelector(`[data-sub="${sub}"]`) || g;
      const r = t.getBoundingClientRect();
      top = r.top - cr.top - 5 * z; height = r.height + 10 * z;
      if (k === 'name') { width = Math.max(v._w * z, 180); left = S(v.x, 0).x + (v._w * z) / 2 - width / 2; }
      else { left = r.left - cr.left - 5; width = Math.max(S(v.x + v._w, 0).x - left + 80, 240); }
    }
    Object.assign(el.style, { left: left + 'px', top: top + 'px', width: width + 'px', height: height + 'px', fontSize: (k === 'name' ? 13 : k === 'note' ? 12.5 : 12) * z + 'px' });
    canvas.appendChild(el);
    inline = { el, vid, k, mid, snap: opt.snap || snapshot(), isNew: !!opt.isNew, orig: opt.isNew ? null : value };
    el.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); cancelInline(); }
      else if (ev.key === 'Enter' && (!multiline || ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); commitInline(false); }
      else if (ev.key === 'Tab' && ['attr', 'op', 'lit', 'slot'].includes(k)) { ev.preventDefault(); commitInline(true); }
    });
    el.addEventListener('blur', () => { if (inline && inline.el === el) commitInline(false); });
    el.focus();
    el.select();
  }
  function commitInline(next) {
    const I = inline;
    if (!I) return;
    inline = null;
    const val = I.el.value;
    I.el.remove();
    const v = V(I.vid), e = v && E(v.ref);
    if (!e) { refresh(); return; }
    if (val === I.orig) { render(); return; }
    if (history[history.length - 1] !== I.snap) { history.push(I.snap); future = []; }
    if (I.k === 'name') {
      if (e.kind === 'object') applyObjectLabel(e, val);
      else if (val.trim()) e.name = val.trim();
    } else if (I.k === 'note') e.text = val;
    else {
      const list = mlist(e, I.k), m = list.find(x => x.id === I.mid);
      if (m) { if (!val.trim()) list.splice(list.indexOf(m), 1); else applyMember(I.k, m, val); }
    }
    refresh(); save();
    if (next && val.trim()) addMember(I.vid, I.k);
  }
  function cancelInline() {
    const I = inline;
    if (!I) return;
    inline = null;
    I.el.remove();
    if (I.isNew) P = U.normalize(JSON.parse(I.snap));
    refresh();
  }
  function applyObjectLabel(e, val) {
    const i = val.indexOf(':');
    if (i < 0) { e.name = val.trim(); return; }
    e.name = val.slice(0, i).trim();
    const cn = val.slice(i + 1).trim();
    const c = cn && U.classifierByName(P, cn);
    e.classifier = c ? c.id : null;
    e.classifierName = c ? '' : cn;
  }
  function addMember(vid, k) {
    const v = V(vid), e = E(v.ref);
    if (!mlist(e, k)) return;
    const before = snapshot();
    const m = newMember(k, e);
    mlist(e, k).push(m);
    if (k === 'attr') v.hideAttrs = false;
    if (k === 'op') v.hideOps = false;
    sel = new Set([vid]);
    render(); renderProps(); renderTree();
    startInline(vid, `${k}:${m.id}`, { snap: before, isNew: true });
  }

  /* ---------- menus ---------- */
  const menu = $('#menu');
  let menuItems = [];
  function showMenu(x, y, items) {
    menuItems = items;
    menu.innerHTML = items.map((it, i) => {
      if (it === '-') return '<hr>';
      if (it.swatches) return `<div class="swatches" role="group" aria-label="Cor">${U.COLORS.map(c => `<button class="sw sw-${c.key || 'none'}${c.key === (it.current || '') ? ' on' : ''}" data-i="${i}" data-c="${c.key}" title="${c.label}" aria-label="${c.label}"></button>`).join('')}</div>`;
      return `<button role="menuitem" data-i="${i}" class="${it.danger ? 'danger' : ''}" ${it.disabled ? 'disabled' : ''}><span>${esc(it.label)}</span>${it.key ? `<kbd>${it.key}</kbd>` : ''}</button>`;
    }).join('');
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = clamp(x, 8, innerWidth - r.width - 8) + 'px';
    menu.style.top = clamp(y, 8, innerHeight - r.height - 8) + 'px';
    menu.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
  }
  function hideMenu() { if (!menu.hidden) { menu.hidden = true; menu.innerHTML = ''; } }
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const it = menuItems[+b.dataset.i];
    hideMenu();
    if (it.swatches) it.act(b.dataset.c); else it.act();
  });
  menu.addEventListener('keydown', e => {
    const bs = [...menu.querySelectorAll('button:not([disabled])')];
    const i = bs.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); bs[(i + 1) % bs.length]?.focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); }
    if (e.key === 'Escape') { e.preventDefault(); hideMenu(); }
  });
  document.addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !e.target.closest('[data-menu]')) hideMenu(); });

  function openContext(target, x, y, w) {
    if (inline) commitInline();
    let items;
    if (target && target.kind === 'node') {
      if (!sel.has(target.id)) { sel = new Set([target.id]); browserSel = null; refresh(); }
      items = sel.size > 1 ? multiItems() : nodeItems(V(target.id));
    } else if (target && (target.kind === 'edge')) {
      if (!sel.has(target.id)) { sel = new Set([target.id]); refresh(); }
      items = edgeItems(EV(target.id));
    } else {
      items = [
        { label: 'Colar', key: 'Ctrl+V', disabled: !clip, act: paste },
        { label: 'Inserir classe aqui', act: () => createAt('class', w) },
        { label: 'Inserir interface aqui', act: () => createAt('interface', w) },
        { label: 'Inserir nota aqui', act: () => createAt('note', w) },
        '-',
        { label: 'Selecionar tudo', key: 'Ctrl+A', act: () => { sel = new Set(D().views.map(v => v.id)); refresh(); } },
        { label: 'Organizar automaticamente', act: () => { checkpoint(); autoLayout(); fit(); refresh(); } },
        { label: 'Enquadrar', key: '0', act: fit },
      ];
    }
    showMenu(x, y, items);
  }
  function nodeItems(v) {
    const e = E(v.ref), cl = U.isClassifier(e.kind) && e.kind !== 'primitive';
    const items = [{ label: 'Renomear', key: 'F2', act: () => startInline(v.id, e.kind === 'note' ? 'note' : 'name') }];
    if (cl) items.push({ label: 'Adicionar atributo', act: () => addMember(v.id, 'attr') }, { label: 'Adicionar operação', act: () => addMember(v.id, 'op') });
    if (e.kind === 'enumeration') items.push({ label: 'Adicionar literal', act: () => addMember(v.id, 'lit') });
    if (e.kind === 'object') items.push({ label: 'Adicionar valor', act: () => addMember(v.id, 'slot') });
    items.push('-');
    if (cl) items.push({ label: v.hideAttrs ? 'Mostrar atributos' : 'Ocultar atributos', act: () => toggleView(v, 'hideAttrs') }, { label: v.hideOps ? 'Mostrar operações' : 'Ocultar operações', act: () => toggleView(v, 'hideOps') });
    if (e.kind === 'interface') items.push({ label: v.lollipop ? 'Exibir como caixa' : 'Exibir como círculo', act: () => toggleView(v, 'lollipop') });
    if (v.w || v.h) items.push({ label: 'Tamanho automático', act: () => { checkpoint(); v.w = 0; v.h = 0; refresh(); save(); } });
    if (!['nary', 'package'].includes(e.kind)) items.push({ swatches: true, current: v.color, act: c => setColor([v], c) });
    items.push('-', { label: 'Copiar', key: 'Ctrl+C', act: () => { copySel(); toast('Copiado'); } }, { label: 'Duplicar', key: 'Ctrl+D', act: duplicate },
      { label: 'Excluir do diagrama', key: 'Del', act: deleteFromDiagram }, { label: 'Excluir do modelo', key: 'Shift+Del', danger: true, act: deleteFromModel });
    return items;
  }
  function multiItems() {
    const vs = [...sel].map(V).filter(Boolean);
    return [
      { label: 'Alinhar à esquerda', act: () => align('left') }, { label: 'Alinhar ao centro', act: () => align('hcenter') }, { label: 'Alinhar à direita', act: () => align('right') },
      { label: 'Alinhar ao topo', act: () => align('top') }, { label: 'Alinhar ao meio', act: () => align('vcenter') }, { label: 'Alinhar à base', act: () => align('bottom') },
      { label: 'Distribuir na horizontal', disabled: vs.length < 3, act: () => align('disth') }, { label: 'Distribuir na vertical', disabled: vs.length < 3, act: () => align('distv') },
      { label: 'Mesma largura', act: () => align('samew') },
      { swatches: true, current: '', act: c => setColor(vs, c) },
      '-', { label: 'Copiar', key: 'Ctrl+C', act: () => { copySel(); toast('Copiado'); } }, { label: 'Duplicar', key: 'Ctrl+D', act: duplicate },
      { label: 'Excluir do diagrama', key: 'Del', act: deleteFromDiagram }, { label: 'Excluir do modelo', key: 'Shift+Del', danger: true, act: deleteFromModel },
    ];
  }
  function edgeItems(ev) {
    const r = Rl(ev.ref);
    const items = [
      { label: ev.style === 'ortho' ? 'Linha reta' : 'Linha ortogonal', act: () => { checkpoint(); ev.style = ev.style === 'ortho' ? 'straight' : 'ortho'; ev.points = []; refresh(); save(); } },
      { label: 'Remover dobras', disabled: !ev.points.length, act: () => { checkpoint(); ev.points = []; refresh(); save(); } },
      { label: 'Reposicionar rótulos', disabled: !Object.keys(ev.labels || {}).length, act: () => { checkpoint(); ev.labels = {}; refresh(); save(); } },
      { label: 'Inverter sentido', act: () => reverseRel(r, ev) },
    ];
    if (r.kind === 'association') {
      items.push('-',
        { label: 'Navegável no destino', act: () => { checkpoint(); r.ends[1].nav = r.ends[1].nav === 'nav' ? '' : 'nav'; refresh(); save(); } },
        { label: 'Composição no destino', act: () => { checkpoint(); r.ends[1].agg = r.ends[1].agg === 'composite' ? 'none' : 'composite'; r.ends[0].agg = 'none'; refresh(); save(); } },
        { label: 'Agregação no destino', act: () => { checkpoint(); r.ends[1].agg = r.ends[1].agg === 'shared' ? 'none' : 'shared'; r.ends[0].agg = 'none'; refresh(); save(); } });
    }
    items.push('-', { label: 'Excluir do diagrama', key: 'Del', act: deleteFromDiagram }, { label: 'Excluir do modelo', key: 'Shift+Del', danger: true, act: deleteFromModel });
    return items;
  }

  /* ---------- teclado ---------- */
  document.addEventListener('keydown', e => {
    if (!$('#modal').hidden) { if (e.key === 'Escape') closeModal(); return; }
    if (!menu.hidden) return;
    const tag = e.target.tagName;
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'f') { e.preventDefault(); if (narrow()) openDrawer('left'); $('#search').focus(); $('#search').select(); return; }
    if (/INPUT|TEXTAREA|SELECT/.test(tag)) {
      if (e.key === 'Escape') e.target.blur();
      if (mod && k === 's') { e.preventDefault(); openSave(); }
      return;
    }
    if (mod) {
      if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (k === 'y') { e.preventDefault(); redo(); }
      else if (k === 'd') { e.preventDefault(); duplicate(); }
      else if (k === 'c') { if (copySel()) toast('Copiado'); }
      else if (k === 'v') paste();
      else if (k === 'a') { e.preventDefault(); sel = new Set(D().views.map(v => v.id)); refresh(); }
      else if (k === 's') { e.preventDefault(); openSave(); }
      return;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.shiftKey ? deleteFromModel() : deleteFromDiagram(); return; }
    if (e.key === 'Escape') { pending = null; drag = null; sel.clear(); browserSel = null; setTool('select'); refresh(); return; }
    if (e.key === 'F2') { e.preventDefault(); const v = sel.size === 1 && V([...sel][0]); if (v) startInline(v.id, E(v.ref).kind === 'note' ? 'note' : 'name'); return; }
    if (e.key === 'Enter') { const v = sel.size === 1 && V([...sel][0]); if (v) { e.preventDefault(); startInline(v.id, E(v.ref).kind === 'note' ? 'note' : 'name'); } return; }
    if (e.key === ' ') { e.preventDefault(); if (!spaceDown) { spaceDown = true; svg.classList.add('c-pan'); } return; }
    if (e.key.startsWith('Arrow')) {
      const vs = [...sel].map(V).filter(Boolean);
      if (!vs.length) return;
      e.preventDefault();
      if (!e.repeat) checkpoint();
      const st = e.shiftKey ? 1 : GRID;
      const dx = { ArrowLeft: -st, ArrowRight: st }[e.key] || 0, dy = { ArrowUp: -st, ArrowDown: st }[e.key] || 0;
      vs.forEach(v => { v.x += dx; v.y += dy; });
      render(); save();
      return;
    }
    if (k === '+' || k === '=') { zoomCenter(1.2); return; }
    if (k === '-') { zoomCenter(1 / 1.2); return; }
    if (k === '0') { fit(); return; }
    const t = TOOLS.flatMap(g => g.items).find(x => x.key === k);
    if (t) setTool(t.id);
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; svg.classList.toggle('c-pan', tool === 'hand'); } });

  /* ---------- painel de propriedades ---------- */
  let PC = {};
  const fid = (t, f) => `p-${t}-${f}`;
  const fText = (label, t, f, val, attrs = '') => `<label class="field"><span>${label}</span><input id="${fid(t, f)}" data-t="${t}" data-f="${f}" value="${esc(val)}" spellcheck="false" ${attrs}></label>`;
  const fArea = (label, t, f, val, rows = 3, ph = '') => `<label class="field"><span>${label}</span><textarea id="${fid(t, f)}" data-t="${t}" data-f="${f}" rows="${rows}" placeholder="${esc(ph)}">${esc(val)}</textarea></label>`;
  const fCheck = (label, t, f, on, title = '') => `<label class="check"${title ? ` title="${esc(title)}"` : ''}><input type="checkbox" id="${fid(t, f)}" data-t="${t}" data-f="${f}" ${on ? 'checked' : ''}><span>${label}</span></label>`;
  const fSelect = (label, t, f, val, opts) => `<label class="field"><span>${label}</span><select id="${fid(t, f)}" data-t="${t}" data-f="${f}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  const VIS_OPTS = [['', '—'], ['+', '+'], ['-', '-'], ['#', '#'], ['~', '~']];
  function tgt(t) {
    return { el: PC.el, rel: PC.rel, end0: PC.rel && PC.rel.ends[0], end1: PC.rel && PC.rel.ends[1], view: PC.view, ev: PC.ev, diag: D(), opts: D().opts, proj: P }[t];
  }
  function relIcon(r) {
    if (r.kind !== 'association') return 'r:' + r.kind;
    const a = r.ends.map(x => x.agg);
    if (a.includes('composite')) return 'r:composition';
    if (a.includes('shared')) return 'r:aggregation';
    if (r.ends.some(x => x.nav === 'nav')) return 'r:directed';
    return 'r:association';
  }
  function relLabel(r) {
    const i = relIcon(r);
    return { 'r:composition': 'Composição', 'r:aggregation': 'Agregação', 'r:directed': 'Associação dirigida' }[i] || (r.kind === 'association' && r.assocClass ? 'Associação com classe' : U.REL[r.kind].label);
  }
  function renderProps() {
    const ids = [...sel];
    PC = {};
    let h;
    if (ids.length === 1 && V(ids[0])) { const v = V(ids[0]); PC = { el: E(v.ref), view: v }; h = elementPanel(PC.el, v); }
    else if (ids.length === 1 && EV(ids[0])) { const ev = EV(ids[0]); PC = { rel: Rl(ev.ref), ev }; h = relationPanel(PC.rel, ev); }
    else if (ids.length > 1) h = multiPanel(ids);
    else if (browserSel && E(browserSel)) { PC = { el: E(browserSel) }; h = elementPanel(PC.el, null); }
    else h = diagramPanel(D());
    props.innerHTML = h;
  }
  const classifierOpts = () => Object.values(P.elements).filter(x => U.isClassifier(x.kind)).sort(byName).map(x => [x.id, x.name]);
  const packageOpts = e => Object.values(P.elements).filter(x => x.kind === 'package' && x.id !== e.id && !(e.kind === 'package' && U.isDescendantPackage(P, e.id, x.id))).map(x => [x.id, U.qualifiedPackage(P, x.id)]).sort((a, b) => a[1].localeCompare(b[1]));
  function swatches(cur) {
    return `<div class="field"><span>Cor</span><div class="swatches">${U.COLORS.map(c => `<button class="sw sw-${c.key || 'none'}${c.key === (cur || '') ? ' on' : ''}" data-act="color" data-c="${c.key}" title="${c.label}" aria-label="${c.label}" aria-pressed="${c.key === (cur || '')}"></button>`).join('')}</div></div>`;
  }
  function memberSec(title, k, list, ph, extra = '') {
    const toggles = k === 'attr' ? [['isStatic', 'S', 'Estático (sublinhado)']] : k === 'op' ? [['isStatic', 'S', 'Estática (sublinhada)'], ['isAbstract', 'A', 'Abstrata (itálico)']] : [];
    const add = { attr: 'Atributo', op: 'Operação', lit: 'Literal', slot: 'Valor' }[k];
    return `<div class="sec"><h3>${title} <small>${list.length}</small></h3>
      <div class="mlist">${list.map((m, i) => `<div class="mrow"><input class="minput" id="m-${m.id}" data-m="${k}" data-mid="${m.id}" value="${esc(fmtMember(k, m))}" placeholder="${esc(ph)}" spellcheck="false" aria-label="${add} ${i + 1}">${toggles.map(([f, l, t]) => `<button class="mt${m[f] ? ' on' : ''}" data-mact="toggle" data-flag="${f}" data-m="${k}" data-mid="${m.id}" title="${t}" aria-pressed="${!!m[f]}">${l}</button>`).join('')}<button class="mt" data-mact="up" data-m="${k}" data-mid="${m.id}" title="Mover para cima" aria-label="Mover para cima" ${i ? '' : 'disabled'}>↑</button><button class="mt del" data-mact="del" data-m="${k}" data-mid="${m.id}" title="Remover" aria-label="Remover">×</button></div>`).join('')}</div>
      <div class="p-actions"><button class="btn sm outline" data-mact="add" data-m="${k}">+ ${add}</button>${extra}</div>
      ${k === 'attr' || k === 'op' ? '<p class="hint">Enter cria a próxima linha. <code>+</code> pública · <code>-</code> privada · <code>#</code> protegida · <code>~</code> pacote</p>' : ''}</div>`;
  }
  function elementPanel(e, v) {
    const k = e.kind, cl = U.isClassifier(k);
    let h = `<div class="sec"><div class="p-head">${ico(k)}<span>${U.KINDS[k].label}</span></div>`;
    if (!v) h += `<div class="banner"><span>Este elemento não aparece em “${esc(D().name)}”.</span><button class="btn primary sm" data-act="add-to-diagram">Adicionar ao diagrama</button></div>`;
    if (k === 'note') h += fArea('Texto', 'el', 'text', e.text, 5);
    else h += fText('Nome', 'el', 'name', e.name, k === 'object' ? 'placeholder="anônimo"' : k === 'nary' ? 'placeholder="opcional"' : '');
    if (cl) {
      h += fSelect('Tipo de elemento', 'el', 'kind', k, ['class', 'interface', 'enumeration', 'datatype', 'primitive'].map(x => [x, U.KINDS[x].label]));
      h += `<div class="two">${fText('Estereótipo', 'el', 'stereotype', e.stereotype, 'list="stList" placeholder="ex.: entity"')}${k !== 'enumeration' && k !== 'primitive' ? fText('Parâmetros de template', 'el', 'templateParams', e.templateParams, 'placeholder="ex.: T, K"') : ''}</div>`;
      if (k === 'class') h += `<div class="checks">${fCheck('Abstrata', 'el', 'isAbstract', e.isAbstract, 'O nome aparece em itálico')}${fCheck('Final {leaf}', 'el', 'isLeaf', e.isLeaf, 'Não pode ter subclasses')}</div>`;
    }
    if (k === 'object') h += fSelect('Classificador', 'el', 'classifier', e.classifier || '', [['', e.classifierName ? `(${e.classifierName}, fora do modelo)` : '(nenhum)'], ...classifierOpts()]);
    if (k === 'package') h += fText('Estereótipo', 'el', 'stereotype', e.stereotype, 'list="stList"');
    if (k !== 'note' && k !== 'nary') h += fSelect(k === 'package' ? 'Pacote pai' : 'Pacote', 'el', 'package', e.package || '', [['', '(raiz do modelo)'], ...packageOpts(e)]);
    h += '</div>';
    if (k === 'enumeration') h += memberSec('Literais', 'lit', e.literals, 'VALOR');
    if (cl && k !== 'primitive') {
      h += memberSec('Atributos', 'attr', e.attributes, '- nome: Tipo [mult] = valor');
      h += memberSec('Operações', 'op', e.operations, '+ nome(param: Tipo): Retorno');
    }
    if (k === 'object') h += memberSec('Valores (slots)', 'slot', e.slots, 'atributo = valor', e.classifier ? '<button class="btn sm outline" data-act="fill-slots">Usar atributos da classe</button>' : '');
    if (v) {
      h += '<div class="sec"><h3>Exibição neste diagrama</h3>';
      if (cl && k !== 'primitive') h += `<div class="checks">${fCheck('Ocultar atributos', 'view', 'hideAttrs', v.hideAttrs)}${fCheck('Ocultar operações', 'view', 'hideOps', v.hideOps)}</div>`;
      if (k === 'interface') h += fCheck('Exibir como círculo (pirulito)', 'view', 'lollipop', v.lollipop);
      if (k !== 'nary' && k !== 'package') h += swatches(v.color);
      if (v.w || v.h) h += '<div class="p-actions"><button class="btn sm outline" data-act="auto-size">Voltar ao tamanho automático</button></div>';
      h += '</div>';
    }
    if (cl || k === 'package') h += `<div class="sec">${fArea('Documentação', 'el', 'doc', e.doc, 3, 'Vira comentário no código gerado')}</div>`;
    const rels = U.relationsOf(P, e.id);
    if (rels.length) h += relList(e, rels);
    const where = P.diagrams.filter(d => d.views.some(x => x.ref === e.id));
    if (where.length) h += `<div class="sec"><h3>Aparece em</h3><div class="chips">${where.map(d => `<button class="chip${d === D() ? ' on' : ''}" data-goto="${d.id}" data-el="${e.id}">${esc(d.name)}</button>`).join('')}</div></div>`;
    h += `<div class="sec"><div class="p-actions">${v ? '<button class="btn outline sm" data-act="duplicate">Duplicar</button><button class="btn outline sm" data-act="del-diagram-sel">Excluir do diagrama</button>' : ''}<button class="btn outline sm danger" data-act="del-model">Excluir do modelo</button></div></div>`;
    return h;
  }
  function relList(e, rels) {
    return `<div class="sec"><h3>Relações <small>${rels.length}</small></h3><ul class="list">${rels.map(r => {
      const shown = D().edges.some(x => x.ref === r.id);
      const asClass = r.assocClass === e.id;
      const other = asClass ? null : E(r.source === e.id ? r.target : r.source);
      const txt = asClass ? `Classe da associação ${nameOf(E(r.source))} — ${nameOf(E(r.target))}` : `${relLabel(r)} ${r.source === e.id ? '→' : '←'} ${nameOf(other)}`;
      const canShow = !shown && viewOf(r.source) && viewOf(r.target);
      return `<li class="relrow"><button class="item${shown ? '' : ' off'}" data-pick-rel="${r.id}">${ico(relIcon(r))}<span>${esc(txt)}</span></button>${canShow ? `<button class="mt" data-act="show-rel" data-rel="${r.id}" title="Mostrar neste diagrama" aria-label="Mostrar neste diagrama">+</button>` : ''}</li>`;
    }).join('')}</ul></div>`;
  }
  function relationPanel(r, ev) {
    const a = E(r.source), b = E(r.target);
    let h = `<div class="sec"><div class="p-head">${ico(relIcon(r))}<span>${relLabel(r)}</span></div>
      <p class="hint">De <b>${esc(nameOf(a))}</b> para <b>${esc(nameOf(b))}</b>. Arraste as bolinhas das pontas para reconectar.</p>`;
    if (r.kind !== 'anchor') h += fSelect('Tipo', 'rel', 'kind', r.kind, ['association', 'generalization', 'realization', 'dependency'].map(k => [k, U.REL[k].label]));
    if (r.kind !== 'anchor' && r.kind !== 'generalization') h += `<div class="two">${fText('Nome', 'rel', 'name', r.name, 'placeholder="opcional"')}${fText('Estereótipo', 'rel', 'stereotype', r.stereotype, r.kind === 'dependency' ? 'list="depList" placeholder="ex.: use"' : '')}</div>`;
    if (r.kind === 'association') h += fSelect('Classe de associação', 'rel', 'assocClass', r.assocClass || '', [['', '(nenhuma)'], ...Object.values(P.elements).filter(x => x.kind === 'class' && x.id !== r.source && x.id !== r.target).sort(byName).map(x => [x.id, x.name])]);
    h += '</div>';
    if (r.kind === 'association') [0, 1].forEach(k => { h += endPanel(r, k); });
    h += `<div class="sec"><h3>Traçado</h3>${fSelect('Estilo da linha', 'ev', 'style', ev.style, [['straight', 'Reta'], ['ortho', 'Ortogonal']])}
      <p class="hint">Arraste os pontos do meio da linha para criar dobras; duplo clique numa dobra a remove. Os rótulos também podem ser arrastados.</p>
      <div class="p-actions">${ev.points.length ? '<button class="btn sm outline" data-act="clear-points">Remover dobras</button>' : ''}${Object.keys(ev.labels || {}).length ? '<button class="btn sm outline" data-act="reset-labels">Reposicionar rótulos</button>' : ''}</div></div>`;
    h += `<div class="sec"><div class="p-actions"><button class="btn outline sm" data-act="reverse">Inverter sentido</button><button class="btn outline sm" data-act="del-diagram-sel">Excluir do diagrama</button><button class="btn outline sm danger" data-act="del-model">Excluir do modelo</button></div></div>`;
    return h;
  }
  function endPanel(r, k) {
    const end = r.ends[k], t = 'end' + k;
    return `<div class="sec"><h3>${k ? 'Ponta de destino' : 'Ponta de origem'} · ${esc(nameOf(E(k ? r.target : r.source)))}</h3>
      <div class="role-row">${fSelect('Vis.', t, 'vis', end.vis, VIS_OPTS)}${fText('Papel', t, 'role', end.role, 'placeholder="ex.: itens"')}</div>
      <div class="two">${fText('Multiplicidade', t, 'mult', end.mult, 'list="multList" placeholder="ex.: 0..*"')}${fText('Restrição', t, 'constraint', end.constraint, 'placeholder="ex.: ordered"')}</div>
      <div class="two">${fSelect('Navegabilidade', t, 'nav', end.nav, [['', 'Não especificada'], ['nav', 'Navegável (seta)'], ['non', 'Não navegável (×)']])}${fSelect('Agregação', t, 'agg', end.agg, [['none', 'Nenhuma'], ['shared', 'Agregação ◇'], ['composite', 'Composição ◆']])}</div>
      ${fText('Qualificador', t, 'qualifier', end.qualifier, 'placeholder="ex.: isbn: String"')}</div>`;
  }
  function multiPanel(ids) {
    const nv = ids.filter(id => V(id)).length;
    const btn = (a, l) => `<button class="btn sm outline" data-act="align-${a}">${l}</button>`;
    return `<div class="sec"><div class="p-head">${ico('multi')}<span>${ids.length} itens selecionados</span></div>
      <p class="hint">${nv} elemento(s) e ${ids.length - nv} relação(ões). Botão direito abre mais opções.</p>
      ${nv > 1 ? `<h3>Alinhar</h3><div class="p-actions">${btn('left', 'Esquerda')}${btn('hcenter', 'Centro')}${btn('right', 'Direita')}${btn('top', 'Topo')}${btn('vcenter', 'Meio')}${btn('bottom', 'Base')}</div>
      <div class="p-actions">${btn('disth', 'Distribuir ↔')}${btn('distv', 'Distribuir ↕')}${btn('samew', 'Mesma largura')}</div>${swatches('')}` : ''}
      <div class="p-actions">${nv ? '<button class="btn outline sm" data-act="duplicate">Duplicar</button>' : ''}<button class="btn outline sm" data-act="del-diagram-sel">Excluir do diagrama</button><button class="btn outline sm danger" data-act="del-model">Excluir do modelo</button></div></div>`;
  }
  function diagramPanel(d) {
    return `<div class="sec"><div class="p-head">${ico('diagram')}<span>Diagrama de classes</span></div>
      ${fText('Nome do diagrama', 'diag', 'name', d.name)}
      ${fText('Nome do projeto', 'proj', 'name', P.name)}
      <div class="checks">${fCheck('Ocultar visibilidade', 'opts', 'hideVis', d.opts.hideVis)}${fCheck('Ocultar tipos e parâmetros', 'opts', 'hideTypes', d.opts.hideTypes)}</div>
      <div class="meta"><span><b>${d.views.length}</b> elementos</span><span><b>${d.edges.length}</b> relações</span><span><b>${Object.keys(P.elements).length}</b> no modelo</span></div>
      <div class="p-actions"><button class="btn sm outline" data-act="auto-layout">Organizar automaticamente</button><button class="btn sm outline" data-act="validate">Verificar modelo</button><button class="btn sm outline" data-act="codegen">Gerar código</button></div>
      <div class="p-actions"><button class="btn sm outline" data-act="dup-diagram">Duplicar diagrama</button><button class="btn sm outline danger" data-act="del-diagram" ${P.diagrams.length < 2 ? 'disabled title="O projeto precisa de ao menos um diagrama"' : ''}>Excluir diagrama</button></div></div>
      <div class="sec"><h3>Como usar</h3><p class="hint">O modelo é compartilhado: a mesma classe pode aparecer em vários diagramas, e mudar uma muda todas. Arraste elementos do navegador à esquerda para mostrá-los aqui.</p>
      <dl class="keys">
      <dt><kbd>C</kbd> <kbd>I</kbd> <kbd>E</kbd> <kbd>T</kbd> <kbd>O</kbd></dt><dd>Classe, interface, enumeração, tipo de dado, objeto</dd>
      <dt><kbd>A</kbd> <kbd>G</kbd> <kbd>R</kbd> <kbd>D</kbd></dt><dd>Associação, generalização, realização, dependência</dd>
      <dt>Duplo clique</dt><dd>Editar nome ou membro na própria caixa</dd>
      <dt><kbd>Tab</kbd></dt><dd>Na edição de membro, cria o próximo</dd>
      <dt><kbd>F2</kbd> / <kbd>Enter</kbd></dt><dd>Renomear seleção</dd>
      <dt><kbd>Del</kbd></dt><dd>Tirar do diagrama</dd>
      <dt><kbd>Shift</kbd>+<kbd>Del</kbd></dt><dd>Excluir do modelo</dd>
      <dt><kbd>Ctrl</kbd>+<kbd>C</kbd>/<kbd>V</kbd></dt><dd>Colar em outro diagrama reutiliza; no mesmo, duplica</dd>
      <dt><kbd>Ctrl</kbd>+<kbd>F</kbd></dt><dd>Buscar no modelo</dd>
      <dt><kbd>Espaço</kbd>+arrastar</dt><dd>Mover a vista</dd>
      <dt><kbd>Alt</kbd>+arrastar</dt><dd>Mover sem grade</dd>
      </dl></div>`;
  }

  props.addEventListener('focusin', e => { if (e.target.dataset.f || e.target.dataset.m) pendingSnap = snapshot(); });
  props.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.m && t.classList.contains('minput')) {
      const m = mlist(PC.el, t.dataset.m).find(x => x.id === t.dataset.mid);
      if (!m) return;
      beginEdit();
      if (t.value.trim()) applyMember(t.dataset.m, m, t.value);
      render(); save();
      return;
    }
    const f = t.dataset.f;
    if (!f) return;
    const obj = tgt(t.dataset.t);
    if (!obj) return;
    beginEdit();
    let val = t.type === 'checkbox' ? t.checked : t.value;
    if (['package', 'classifier', 'assocClass'].includes(f)) val = val || null;
    let structural = ['kind', 'assocClass', 'classifier', 'agg', 'nav', 'style', 'lollipop', 'isAbstract'].includes(f);
    if (t.dataset.t === 'el' && f === 'kind') changeKind(obj, val);
    else if (t.dataset.t === 'el' && f === 'package' && val && U.isDescendantPackage(P, obj.id, val)) { toast('Um pacote não pode ficar dentro dele mesmo.'); structural = true; }
    else obj[f] = val;
    if (f === 'agg' && val !== 'none') { const other = PC.rel.ends[t.dataset.t === 'end0' ? 1 : 0]; if (other.agg !== 'none') { other.agg = 'none'; structural = true; } }
    if (f === 'style') PC.ev.points = [];
    render(); renderTree(); save();
    if (structural) { const id = t.id; renderProps(); const again = document.getElementById(id); if (again && again.tagName !== 'SELECT' && again.type !== 'checkbox') again.focus(); }
    if (t.dataset.t === 'proj' || t.dataset.t === 'diag') $('#crumb').textContent = `${P.name} / ${D().name}`;
  });
  props.addEventListener('change', e => {
    const t = e.target;
    if (!t.classList.contains('minput')) return;
    const list = mlist(PC.el, t.dataset.m), m = list && list.find(x => x.id === t.dataset.mid);
    if (!m) return;
    if (!t.value.trim()) { beginEdit(); list.splice(list.indexOf(m), 1); refresh(); save(); return; }
    t.value = fmtMember(t.dataset.m, m);
    renderTree();
  });
  props.addEventListener('keydown', e => {
    const t = e.target;
    if (e.key !== 'Enter' || !t.classList.contains('minput')) return;
    e.preventDefault();
    const k = t.dataset.m, list = mlist(PC.el, k);
    const i = list.findIndex(x => x.id === t.dataset.mid);
    if (t.value.trim()) applyMember(k, list[i], t.value);
    checkpoint();
    const m = newMember(k, PC.el);
    list.splice(i + 1, 0, m);
    refresh(); save();
    const ni = document.getElementById('m-' + m.id);
    if (ni) { ni.focus(); ni.select(); }
  });
  let armT;
  props.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.mact) return memberAction(b);
    if (b.dataset.pickRel) {
      const ev = D().edges.find(x => x.ref === b.dataset.pickRel);
      if (ev) { sel = new Set([ev.id]); browserSel = null; refresh(); } else goToRelation(b.dataset.pickRel);
      return;
    }
    if (b.dataset.goto) { switchDiagram(b.dataset.goto); goToElement(b.dataset.el); return; }
    const a = b.dataset.act;
    if (!a) return;
    const views = [...sel].map(V).filter(Boolean);
    switch (a) {
      case 'add-to-diagram': addToDiagram(PC.el.id); break;
      case 'fill-slots': {
        const c = E(PC.el.classifier);
        if (!c) break;
        checkpoint();
        const have = new Set(PC.el.slots.map(s => s.feature));
        [c, ...U.ancestors(P, c.id)].flatMap(x => x.attributes || []).filter(x => !x.isStatic && !have.has(x.name)).forEach(x => PC.el.slots.push(U.slot(`${x.name} = ${x.def || ''}`)));
        refresh(); save();
        break;
      }
      case 'auto-size': checkpoint(); PC.view.w = 0; PC.view.h = 0; refresh(); save(); break;
      case 'color': setColor(views, b.dataset.c); break;
      case 'duplicate': duplicate(); break;
      case 'del-diagram-sel': deleteFromDiagram(); break;
      case 'del-model': deleteFromModel(); break;
      case 'show-rel': checkpoint(); D().edges.push(U.newEdgeView(b.dataset.rel)); refresh(); save(); break;
      case 'clear-points': checkpoint(); PC.ev.points = []; refresh(); save(); break;
      case 'reset-labels': checkpoint(); PC.ev.labels = {}; refresh(); save(); break;
      case 'reverse': reverseRel(PC.rel, PC.ev); break;
      case 'auto-layout': checkpoint(); autoLayout(); fit(); refresh(); toast('Diagrama organizado. Ctrl+Z desfaz.'); break;
      case 'validate': openValidate(); break;
      case 'codegen': openCodegen(); break;
      case 'dup-diagram': {
        checkpoint();
        const d = D(), nd = JSON.parse(JSON.stringify(d, (k, v) => (k && k[0] === '_' ? undefined : v)));
        nd.id = U.uid(); nd.name = d.name + ' (cópia)';
        nd.views.forEach(v => { v.id = U.uid(); });
        nd.edges.forEach(ev => { ev.id = U.uid(); });
        P.diagrams.splice(P.diagrams.indexOf(d) + 1, 0, nd);
        switchDiagram(nd.id);
        break;
      }
      case 'del-diagram':
        if (b.dataset.armed) {
          clearTimeout(armT); checkpoint();
          const d = D();
          P.diagrams = P.diagrams.filter(x => x !== d);
          P.current = P.diagrams[0].id;
          sel.clear(); refresh(); save();
          toast('Diagrama excluído. Os elementos continuam no modelo.');
        } else {
          b.dataset.armed = '1'; b.textContent = 'Clique de novo para confirmar';
          armT = setTimeout(() => { delete b.dataset.armed; b.textContent = 'Excluir diagrama'; }, 3500);
        }
        break;
      default: if (a.startsWith('align-')) align(a.slice(6));
    }
  });
  function memberAction(b) {
    const e = PC.el, k = b.dataset.m, list = mlist(e, k);
    if (!list) return;
    const i = list.findIndex(x => x.id === b.dataset.mid);
    if (b.dataset.mact === 'add') {
      checkpoint();
      const m = newMember(k, e);
      list.push(m);
      if (PC.view) { if (k === 'attr') PC.view.hideAttrs = false; if (k === 'op') PC.view.hideOps = false; }
      refresh(); save();
      const ni = document.getElementById('m-' + m.id);
      if (ni) { ni.focus(); ni.select(); }
      return;
    }
    if (i < 0) return;
    checkpoint();
    if (b.dataset.mact === 'toggle') {
      const f = b.dataset.flag;
      list[i][f] = !list[i][f];
      if (f === 'isAbstract' && list[i].isAbstract && e.kind === 'class' && !e.isAbstract) toast('Dica: uma classe com operação abstrata também deve ser abstrata.');
    }
    if (b.dataset.mact === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (b.dataset.mact === 'del') list.splice(i, 1);
    refresh(); save();
  }

  /* ---------- navegador do modelo ---------- */
  function renderTree() {
    $('#dlist').innerHTML = P.diagrams.map(d => `<li><button class="item${d === D() ? ' on' : ''}" data-diagram="${d.id}">${ico('diagram')}<span>${esc(d.name)}</span><small>${d.views.length}</small></button></li>`).join('');
    const q = $('#search').value.trim().toLowerCase();
    const onD = new Set(D().views.map(v => v.ref));
    const selRefs = new Set([...sel].map(id => V(id) && V(id).ref).filter(Boolean));
    if (browserSel) selRefs.add(browserSel);
    const items = Object.values(P.elements).filter(e => e.kind !== 'note' && e.kind !== 'nary');
    const order = { package: 0, class: 1, interface: 2, enumeration: 3, datatype: 4, primitive: 5, object: 6 };
    const sort = (a, b) => order[a.kind] - order[b.kind] || nameOf(a).localeCompare(nameOf(b));
    const row = (e, depth, path) => `<li><button class="item${onD.has(e.id) ? '' : ' off'}${selRefs.has(e.id) ? ' on' : ''}" data-el="${e.id}" draggable="true" style="padding-left:${8 + depth * 14}px" title="${onD.has(e.id) ? esc(nameOf(e)) : 'Fora deste diagrama: arraste para a folha ou dê duplo clique'}">${ico(e.kind)}<span>${esc(nameOf(e))}</span>${path ? `<small>${esc(path)}</small>` : ''}</button></li>`;
    let h;
    if (q) {
      const match = e => nameOf(e).toLowerCase().includes(q) || (e.attributes || []).some(a => a.name.toLowerCase().includes(q)) || (e.operations || []).some(o => o.name.toLowerCase().includes(q));
      const hits = items.filter(match).sort(sort);
      h = hits.length ? hits.map(e => row(e, 0, U.qualifiedPackage(P, e.package))).join('') : '<li class="empty">Nada encontrado.</li>';
    } else {
      const walk = (parent, depth) => items.filter(e => (e.package || null) === parent).sort(sort).map(e => row(e, depth) + (e.kind === 'package' ? walk(e.id, depth + 1) : '')).join('');
      h = walk(null, 0) || '<li class="empty">O modelo está vazio. Escolha uma ferramenta e clique na folha.</li>';
    }
    $('#mtree').innerHTML = `<ul class="list">${h}</ul>`;
  }
  const left = $('#left');
  left.addEventListener('click', e => {
    const dg = e.target.closest('[data-diagram]'), el = e.target.closest('[data-el]'), cmd = e.target.closest('[data-cmd]');
    if (dg) { switchDiagram(dg.dataset.diagram); closeDrawers(); }
    if (el) {
      const v = viewOf(el.dataset.el);
      if (v) { sel = new Set([v.id]); browserSel = null; focusView(v); } else { sel.clear(); browserSel = el.dataset.el; }
      refresh();
      if (narrow()) openDrawer('right');
    }
    if (cmd && cmd.dataset.cmd === 'new-diagram') {
      checkpoint();
      const d = U.newDiagram('Novo diagrama de classes');
      P.diagrams.push(d);
      switchDiagram(d.id);
      const f = $('#p-diag-name'); if (f && fine) { f.focus(); f.select(); }
    }
    if (cmd && cmd.dataset.cmd === 'new-package') { setTool('package'); toast('Clique na folha para posicionar o pacote.'); closeDrawers(); }
  });
  left.addEventListener('dblclick', e => { const el = e.target.closest('[data-el]'); if (el) { addToDiagram(el.dataset.el); closeDrawers(); } });
  left.addEventListener('dragstart', e => { const el = e.target.closest('[data-el]'); if (el) { e.dataTransfer.setData('text/plain', 'uml:' + el.dataset.el); e.dataTransfer.effectAllowed = 'copy'; } });
  $('#search').addEventListener('input', renderTree);

  /* ---------- gavetas ---------- */
  function openDrawer(which) { closeDrawers(); $('#' + which).classList.add('open'); $('#scrim').classList.add('on'); }
  function closeDrawers() { $('#left').classList.remove('open'); $('#right').classList.remove('open'); $('#scrim').classList.remove('on'); }
  $('#scrim').addEventListener('click', closeDrawers);

  /* ---------- janelas ---------- */
  const modal = $('#modal'), mBody = $('#mBody');
  let mctxState = {};
  function openModal(title, html, wide) {
    $('#mTitle').textContent = title;
    mBody.innerHTML = html;
    modal.querySelector('.sheet').classList.toggle('wide', !!wide);
    modal.hidden = false;
    (mBody.querySelector('[autofocus]') || modal.querySelector('[data-close]')).focus();
  }
  function closeModal() { modal.hidden = true; mBody.innerHTML = ''; mctxState = {}; }
  modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('[data-close]')) closeModal(); });
  const slug = s => String(s || 'projeto').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'projeto';
  function download(name, data, type = 'text/plain') {
    try {
      const blob = data instanceof Blob ? data : new Blob([data], { type: type + ';charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    } catch (_) { /* navegador bloqueou o download */ }
    toast('Se o download não começar, use Copiar.');
  }
  async function copyText(ta) {
    try { await navigator.clipboard.writeText(ta.value); toast('Copiado para a área de transferência'); }
    catch (_) { ta.focus(); ta.select(); toast('Texto selecionado. Use Ctrl+C para copiar.'); }
  }
  mBody.addEventListener('click', e => {
    const b = e.target.closest('[data-m],[data-lang],[data-issue]');
    if (!b) return;
    if (b.dataset.lang) { mctxState.lang = b.dataset.lang; mctxState.file = '*'; updateCode(); return; }
    if (b.dataset.issue) {
      const it = mctxState.issues[+b.dataset.issue];
      closeModal();
      if (it.el) goToElement(it.el); else if (it.rel) goToRelation(it.rel);
      return;
    }
    const a = b.dataset.m;
    if (a === 'copy') copyText($('#mText'));
    if (a === 'dl') download(mctxState.name, $('#mText').value, mctxState.type);
    if (a === 'dl-png' && mctxState.blob) download(mctxState.name, mctxState.blob);
    if (a === 'pick') $('#fileIn').click();
    if (a === 'load') importProject($('#mText').value);
    if (a === 'recover') { try { importProject(localStorage.getItem(OLD_KEY)); } catch (_) { toast('Não foi possível ler a versão anterior.'); } }
    if (a === 'blank' || a === 'sample') {
      checkpoint();
      P = a === 'sample' ? U.normalize(U.sample()) : U.newProject();
      sel.clear(); browserSel = null; closeModal(); refresh(); fit(); save();
      toast(a === 'sample' ? 'Exemplo carregado. Ctrl+Z volta ao projeto anterior.' : 'Projeto novo criado. Ctrl+Z desfaz.');
    }
    if (a === 'import-code') doImportCode();
  });
  mBody.addEventListener('change', e => {
    if (e.target.id === 'cgScope') { mctxState.scope = e.target.value; mctxState.file = '*'; updateCode(); }
    if (e.target.id === 'cgFile') { mctxState.file = e.target.value; updateCode(); }
  });
  function importProject(txt) {
    try {
      const p = U.normalize(JSON.parse(txt));
      checkpoint();
      P = p; sel.clear(); browserSel = null;
      closeModal(); refresh(); fit(); save();
      toast('Projeto aberto');
    } catch (err) {
      const m = $('#mErr');
      const msg = 'Não foi possível abrir: ' + (err instanceof SyntaxError ? 'o conteúdo não é um JSON válido.' : err.message) + ' Confira se o arquivo foi salvo pelo Traço UML.';
      if (m) m.textContent = msg; else toast(msg);
    }
  }
  $('#fileIn').addEventListener('change', e => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => importProject(r.result);
    r.readAsText(f);
    e.target.value = '';
  });
  function openNew() {
    openModal('Novo projeto', `<p>O projeto atual será substituído. Para guardá-lo, use <b>Salvar</b> antes. Ctrl+Z também traz ele de volta.</p>
      <div class="p-actions"><button class="btn primary" data-m="blank" autofocus>Começar projeto vazio</button><button class="btn outline" data-m="sample">Abrir o exemplo da biblioteca</button></div>`);
  }
  function openOpen() {
    let old = false;
    try { old = !!localStorage.getItem(OLD_KEY); } catch (_) { /* */ }
    openModal('Abrir projeto', `<div class="p-actions"><button class="btn primary" data-m="pick" autofocus>Escolher arquivo .json</button>${old ? '<button class="btn outline" data-m="recover">Recuperar projeto da versão anterior</button>' : ''}</div>
      <p class="hint">Ou cole o conteúdo do arquivo:</p><textarea id="mText" class="code" placeholder='{"version": 2, "elements": {...}}'></textarea>
      <p class="hint err" id="mErr"></p>
      <div class="p-actions"><button class="btn outline" data-m="load">Abrir texto colado</button></div>`);
  }
  function openSave() {
    mctxState = { name: slug(P.name) + '.traco.json', type: 'application/json' };
    openModal('Salvar projeto', `<p class="hint">O projeto fica salvo automaticamente neste navegador. Para guardar uma cópia ou levar para outro computador, baixe ou copie o arquivo.</p>
      <textarea id="mText" class="code" readonly>${esc(JSON.stringify(JSON.parse(snapshot()), null, 2))}</textarea>
      <div class="p-actions"><button class="btn primary" data-m="dl" autofocus>Baixar ${esc(mctxState.name)}</button><button class="btn outline" data-m="copy">Copiar JSON</button></div>`);
  }
  function openSVG() {
    const r = U.exportSVG(P, D());
    if (!r) { toast('O diagrama está vazio'); return; }
    mctxState = { name: slug(D().name) + '.svg', type: 'image/svg+xml' };
    openModal('Exportar SVG', `<div class="preview"><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.svg)}" alt="Prévia do diagrama"></div>
      <textarea id="mText" class="code short" readonly>${esc(r.svg)}</textarea>
      <div class="p-actions"><button class="btn primary" data-m="dl" autofocus>Baixar SVG</button><button class="btn outline" data-m="copy">Copiar código</button></div>`, true);
  }
  function openPNG() {
    const r = U.exportSVG(P, D());
    if (!r) { toast('O diagrama está vazio'); return; }
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'), k = 2;
      c.width = r.w * k; c.height = r.h * k;
      const g = c.getContext('2d');
      g.scale(k, k);
      g.drawImage(img, 0, 0);
      let src;
      try { src = c.toDataURL('image/png'); } catch (_) { src = img.src; }
      mctxState = { name: slug(D().name) + '.png' };
      c.toBlob(b => { mctxState.blob = b; }, 'image/png');
      openModal('Exportar PNG', `<div class="preview"><img src="${src}" alt="Diagrama em PNG"></div>
        <p class="hint">${r.w * k} × ${r.h * k} px. Se o download não começar, clique com o botão direito na imagem e escolha “Salvar imagem como”.</p>
        <div class="p-actions"><button class="btn primary" data-m="dl-png" autofocus>Baixar PNG</button></div>`, true);
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.svg);
  }
  function openXMI() {
    mctxState = { name: slug(P.name) + '.xmi', type: 'application/xml' };
    openModal('Exportar XMI', `<p class="hint">XMI 2.5.1 com UML 2.5: abre em ferramentas como Eclipse Papyrus, Modelio e outras que importam XMI. Os diagramas (posições) não fazem parte do formato.</p>
      <textarea id="mText" class="code" readonly>${esc(U.exportXMI(P))}</textarea>
      <div class="p-actions"><button class="btn primary" data-m="dl" autofocus>Baixar XMI</button><button class="btn outline" data-m="copy">Copiar</button></div>`, true);
  }
  function openCodegen() {
    mctxState = { lang: mctxState.lang || 'java', scope: 'all', file: '*' };
    openModal('Gerar código', `<div class="seg" role="group" aria-label="Linguagem">${Object.entries(U.LANGS).map(([k, l]) => `<button data-lang="${k}" aria-pressed="false">${l}</button>`).join('')}</div>
      <div class="two"><label class="field"><span>Escopo</span><select id="cgScope"><option value="all">Modelo inteiro</option><option value="diagram">Só o diagrama atual</option></select></label><label class="field"><span>Arquivo</span><select id="cgFile"></select></label></div>
      <textarea id="mText" class="code tall" readonly></textarea>
      <div class="p-actions"><button class="btn primary" data-m="copy">Copiar</button><button class="btn outline" data-m="dl">Baixar</button></div>
      <p class="hint">O código é um ponto de partida: heranças, interfaces, atributos, associações navegáveis e assinaturas vêm do modelo; os métodos ficam com corpo vazio.</p>`, true);
    updateCode();
  }
  function updateCode() {
    const s = mctxState;
    mBody.querySelectorAll('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === s.lang));
    const files = U.generate(P, s.lang, s.scope === 'diagram' ? new Set(D().views.map(v => v.ref)) : null);
    const sf = $('#cgFile');
    sf.innerHTML = `<option value="*">Todos (${files.length})</option>` + files.map(f => `<option value="${esc(f.file)}"${f.file === s.file ? ' selected' : ''}>${esc(f.file)}</option>`).join('');
    const cm = s.lang === 'python' ? '#' : '//';
    const one = files.find(f => f.file === s.file);
    $('#mText').value = !files.length ? 'Nenhuma classe para gerar.' : one ? one.code : files.map(f => `${cm} ===== ${f.file} =====\n${f.code}`).join('\n');
    const ext = { java: 'java', ts: 'ts', python: 'py' }[s.lang];
    s.name = one ? one.file.split('/').pop() : `${slug(P.name)}-${s.lang}.${ext === 'py' ? 'py' : ext}`;
    s.type = 'text/plain';
  }
  function openImport() {
    openModal('Importar código', `<p class="hint">Cole classes, interfaces e enums em Java ou TypeScript. O Traço UML cria os elementos, heranças e realizações; elementos com o mesmo nome são atualizados.</p>
      <label class="field"><span>Linguagem</span><select id="icLang"><option value="java">Java</option><option value="ts">TypeScript</option></select></label>
      <textarea id="mText" class="code tall" spellcheck="false" placeholder="public class Pedido {\n    private List&lt;Item&gt; itens;\n    public BigDecimal total() { ... }\n}" autofocus></textarea>
      <label class="check"><input type="checkbox" id="icAssoc" checked><span>Transformar atributos cujo tipo é uma classe do modelo em associações</span></label>
      <p class="hint err" id="mErr"></p>
      <div class="p-actions"><button class="btn primary" data-m="import-code">Importar para um novo diagrama</button></div>`, true);
  }
  function doImportCode() {
    const src = $('#mText').value, lang = $('#icLang').value;
    let types;
    try { types = lang === 'java' ? U.parseJava(src) : U.parseTS(src); } catch (err) { $('#mErr').textContent = 'Não consegui ler o código: ' + err.message; return; }
    if (!types.length) { $('#mErr').textContent = 'Nenhuma classe, interface ou enum encontrada. Confira se o código está completo, com as chaves.'; return; }
    checkpoint();
    const res = U.importTypes(P, types, { assoc: $('#icAssoc').checked });
    const d = U.newDiagram(`Importado (${lang === 'java' ? 'Java' : 'TypeScript'})`);
    d.views = res.ids.map(id => U.newView(id, 0, 0));
    const ids = new Set(res.ids);
    for (const r of Object.values(P.relations)) if (ids.has(r.source) && ids.has(r.target)) d.edges.push(U.newEdgeView(r.id));
    P.diagrams.push(d);
    P.current = d.id;
    autoLayout(d);
    sel.clear(); browserSel = null;
    closeModal(); refresh(); fit(); save();
    toast(`${types.length} tipo(s) importado(s): ${res.created.length} novo(s), ${types.length - res.created.length} atualizado(s).`);
  }
  function openValidate() {
    const issues = U.validate(P);
    mctxState = { issues };
    const n = l => issues.filter(i => i.level === l).length;
    const L = { error: 'Erro', warning: 'Aviso', info: 'Nota' };
    openModal('Verificação do modelo', issues.length
      ? `<p class="meta"><span><b>${n('error')}</b> erros</span><span><b>${n('warning')}</b> avisos</span><span><b>${n('info')}</b> notas</span></p>
        <ul class="issues">${issues.map((it, i) => `<li><button data-issue="${i}"><span class="pill ${it.level}">${L[it.level]}</span><span>${esc(it.msg)}</span></button></li>`).join('')}</ul>
        <p class="hint">Clique num item para ir até o elemento.</p>`
      : '<p class="ok-msg">Nenhum problema encontrado. Tipos, heranças, multiplicidades e realizações estão consistentes.</p>', true);
  }

  /* ---------- barra superior ---------- */
  const TOP_MENUS = {
    export: () => [
      { label: 'Imagem SVG', act: openSVG }, { label: 'Imagem PNG', act: openPNG },
      { label: 'XMI (UML 2.5)', act: openXMI }, { label: 'Projeto (JSON)', act: openSave },
    ],
    code: () => [{ label: 'Gerar código…', act: openCodegen }, { label: 'Importar código Java ou TypeScript…', act: openImport }],
  };
  document.querySelector('.top').addEventListener('click', e => {
    const m = e.target.closest('[data-menu]');
    if (m) {
      if (!menu.hidden) { hideMenu(); return; }
      const r = m.getBoundingClientRect();
      showMenu(r.left, r.bottom + 4, TOP_MENUS[m.dataset.menu]());
      return;
    }
    const b = e.target.closest('[data-cmd]');
    if (!b) return;
    ({
      new: openNew, open: openOpen, save: openSave, validate: openValidate, undo, redo, fit,
      'zoom-in': () => zoomCenter(1.2), 'zoom-out': () => zoomCenter(1 / 1.2),
      'zoom-reset': () => zoomCenter(1 / D().view.z),
      'toggle-left': () => ($('#left').classList.contains('open') ? closeDrawers() : openDrawer('left')),
      'toggle-right': () => ($('#right').classList.contains('open') ? closeDrawers() : openDrawer('right')),
    })[b.dataset.cmd]?.();
  });

  let toastT;
  function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2400); }

  /* ---------- início ---------- */
  P = load();
  const fresh = !P;
  if (!P) P = U.normalize(U.sample());
  try { showMini = localStorage.getItem('tracouml.mini') !== '0'; } catch (_) { /* */ }
  buildTools();
  setTool('select');
  refresh();
  updateBadge();
  if (fresh) requestAnimationFrame(fit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { mcache.clear(); render(); if (fresh) fit(); });
  addEventListener('resize', () => render());
})();
