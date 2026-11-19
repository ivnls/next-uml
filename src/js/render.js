/* NextUML — layout dos elementos e geração do SVG de um diagrama. */
(function (G) {
  'use strict';
  const UML = (G.UML = G.UML || {});
  const LH = 17;
  const esc = (UML.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const R = n => Math.round(n * 10) / 10;

  const FN = (UML.FONTS = {
    name: "600 13px 'IBM Plex Sans', Arial, sans-serif",
    st: "11px 'IBM Plex Sans', Arial, sans-serif",
    mem: "12px 'IBM Plex Mono', Consolas, monospace",
    memIt: "italic 12px 'IBM Plex Mono', Consolas, monospace",
    plain: "13px 'IBM Plex Sans', Arial, sans-serif",
    note: "12.5px 'IBM Plex Sans', Arial, sans-serif",
    label: "11.5px 'IBM Plex Sans', Arial, sans-serif",
    mult: "11px 'IBM Plex Mono', Consolas, monospace",
  });
  let M = t => String(t || '').length * 7;
  UML.setMeasure = fn => { M = fn; };

  UML.COLORS = [
    { key: '', label: 'Padrão' }, { key: 'teal', label: 'Verde-água' }, { key: 'blue', label: 'Azul' },
    { key: 'amber', label: 'Âmbar' }, { key: 'rose', label: 'Rosa' }, { key: 'violet', label: 'Violeta' }, { key: 'slate', label: 'Cinza' },
  ];

  function stereoLine(e) {
    const base = { interface: 'interface', enumeration: 'enumeration', datatype: 'dataType', primitive: 'primitive' }[e.kind];
    const parts = [base, e.stereotype].filter(Boolean);
    let s = parts.length ? `«${parts.join(', ')}»` : '';
    if (e.isLeaf) s = (s ? s + ' ' : '') + '{leaf}';
    return s;
  }
  UML.objectLabel = (e, p) => {
    const c = e.classifier && p.elements[e.classifier];
    const cn = c ? c.name : e.classifierName || '';
    return cn ? `${e.name || ''} : ${cn}` : e.name || ':';
  };

  /* ---------- layout ---------- */
  UML.layoutView = function (v, e, d, p) {
    const o = d.opts || {};
    const L = { comps: [] };
    const fit = (w, h) => { v._w = Math.max(w, v.w || 0); v._h = Math.max(h, v.h || 0); };
    if (UML.isClassifier(e.kind)) {
      if (e.kind === 'interface' && v.lollipop) { L.lolli = true; v._w = 22; v._h = 22; v._L = L; return; }
      L.st = stereoLine(e);
      if (e.kind === 'enumeration') L.comps.push({ key: 'lit', items: e.literals.map(l => ({ id: l.id, text: l.name })) });
      const showA = !v.hideAttrs && e.kind !== 'primitive' && (e.kind === 'class' || e.kind === 'datatype' || e.attributes.length);
      const showO = !v.hideOps && e.kind !== 'primitive' && (e.kind === 'class' || e.kind === 'interface' || e.operations.length);
      if (showA) L.comps.push({ key: 'attr', items: e.attributes.map(a => ({ id: a.id, text: UML.fmtAttr(a, o), st: a.isStatic })) });
      if (showO) L.comps.push({ key: 'op', items: e.operations.map(x => ({ id: x.id, text: UML.fmtOp(x, o), st: x.isStatic, it: x.isAbstract })) });
      L.headH = L.st ? 44 : 32;
      let mw = Math.max(M(e.name, FN.name), L.st ? M(L.st, FN.st) : 0);
      for (const c of L.comps) for (const it of c.items) mw = Math.max(mw, M(it.text, it.it ? FN.memIt : FN.mem));
      let h = L.headH;
      for (const c of L.comps) { c.h = c.items.length ? 8 + c.items.length * LH : 12; h += c.h; }
      if (e.templateParams) { L.tp = e.templateParams; L.tpW = Math.ceil(M(e.templateParams, FN.mem)) + 14; }
      fit(Math.max(120, Math.ceil(mw) + 24), h);
      if (v._h > h) { if (L.comps.length) L.comps[L.comps.length - 1].h += v._h - h; else L.headH = v._h; }
    } else if (e.kind === 'object') {
      L.label = UML.objectLabel(e, p);
      L.headH = 32;
      if (e.slots.length) L.comps.push({ key: 'slot', items: e.slots.map(s => ({ id: s.id, text: UML.fmtSlot(s) })) });
      let mw = M(L.label, FN.name);
      for (const it of L.comps[0]?.items || []) mw = Math.max(mw, M(it.text, FN.mem));
      let h = L.headH;
      for (const c of L.comps) { c.h = 8 + c.items.length * LH; h += c.h; }
      fit(Math.max(120, Math.ceil(mw) + 24), h);
      if (v._h > h) { if (L.comps.length) L.comps[0].h += v._h - h; else L.headH = v._h; }
    } else if (e.kind === 'note') {
      L.lines = String(e.text || '').split('\n');
      fit(Math.max(120, Math.ceil(Math.max(...L.lines.map(l => M(l, FN.note)))) + 30), Math.max(44, 14 + L.lines.length * 16 + 8));
    } else if (e.kind === 'package') {
      L.title = (e.stereotype ? `«${e.stereotype}» ` : '') + e.name;
      L.tabW = Math.ceil(M(L.title, FN.name)) + 22;
      v._w = Math.max(v.w || 320, L.tabW + 40, 160);
      v._h = Math.max(v.h || 220, 100);
    } else if (e.kind === 'nary') { v._w = 44; v._h = 30; }
    v._L = L;
  };

  /* ---------- nós ---------- */
  function comps(L, x, y, w, exp) {
    let s = '', cy = y + L.headH;
    for (const c of L.comps) {
      s += `<path class="div" d="M${x} ${cy}H${x + w}"/>`;
      if (!exp) s += `<rect class="hitbox" data-sub="add:${c.key}" x="${x}" y="${cy}" width="${w}" height="${c.h}"/>`;
      c.items.forEach((it, i) => {
        const ty = cy + 16 + LH * i;
        s += `<text class="t-mem${it.it ? ' it' : ''}" data-sub="${c.key}:${it.id}" x="${x + 10}" y="${ty}">${esc(it.text)}</text>`;
        if (it.st) s += `<path class="ul" d="M${x + 10} ${ty + 2.5}h${R(M(it.text, it.it ? FN.memIt : FN.mem))}"/>`;
      });
      cy += c.h;
    }
    return s;
  }
  function nodeSVG(v, e, p, o) {
    const x = v.x, y = v.y, w = v._w, h = v._h, L = v._L;
    let s = `<g class="node${v.color ? ' col-' + v.color : ''}${o.hi === v.id ? ' target' : ''}" data-kind="node" data-id="${v.id}">`;
    if (UML.isClassifier(e.kind)) {
      if (L.lolli) {
        s += `<circle class="shape" cx="${x + 11}" cy="${y + 11}" r="10"/>`;
        s += `<text class="t-plain" data-sub="name" x="${x + 11}" y="${y + 38}" text-anchor="middle">${esc(e.name)}</text>`;
      } else {
        s += `<rect class="shape" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
        s += `<rect class="head" x="${x + 0.7}" y="${y + 0.7}" width="${w - 1.4}" height="${L.headH - 1.4}"/>`;
        if (L.st) s += `<text class="t-st" x="${x + w / 2}" y="${y + 17}" text-anchor="middle">${esc(L.st)}</text>`;
        s += `<text class="t-name${e.kind === 'class' && e.isAbstract ? ' it' : ''}" data-sub="name" x="${x + w / 2}" y="${y + L.headH - 12}" text-anchor="middle">${esc(e.name)}</text>`;
        s += comps(L, x, y, w, o.exp);
        if (L.tp) {
          const bx = x + w - L.tpW + 12, by = y - 12;
          s += `<rect class="tp-box" x="${bx}" y="${by}" width="${L.tpW}" height="20"/><text class="t-mem" x="${bx + 7}" y="${by + 14}">${esc(L.tp)}</text>`;
        }
      }
    } else if (e.kind === 'object') {
      s += `<rect class="shape" x="${x}" y="${y}" width="${w}" height="${h}"/>`;
      s += `<rect class="head" x="${x + 0.7}" y="${y + 0.7}" width="${w - 1.4}" height="${L.headH - 1.4}"/>`;
      const lw = M(L.label, FN.name);
      s += `<text class="t-name" data-sub="name" x="${x + w / 2}" y="${y + L.headH - 12}" text-anchor="middle">${esc(L.label)}</text>`;
      s += `<path class="ul" d="M${R(x + w / 2 - lw / 2)} ${y + L.headH - 9}h${R(lw)}"/>`;
      s += comps(L, x, y, w, o.exp);
    } else if (e.kind === 'note') {
      s += `<path class="note-shape" d="M${x} ${y}H${x + w - 12}L${x + w} ${y + 12}V${y + h}H${x}Z"/>`;
      s += `<path class="note-fold" d="M${x + w - 12} ${y}V${y + 12}H${x + w}"/>`;
      L.lines.forEach((l, i) => { s += `<text class="t-note" data-sub="note" x="${x + 10}" y="${y + 22 + 16 * i}">${esc(l)}</text>`; });
    } else if (e.kind === 'package') {
      s += `<path class="pkg" d="M${x} ${y}h${L.tabW}v22h-${L.tabW}z"/>`;
      s += `<rect class="pkg" x="${x}" y="${y + 22}" width="${w}" height="${h - 22}"/>`;
      s += `<text class="t-name" data-sub="name" x="${x + 11}" y="${y + 15.5}">${esc(L.title)}</text>`;
    } else if (e.kind === 'nary') {
      const cx = x + 22, cy = y + 15;
      s += `<path class="shape" d="M${x} ${cy}L${cx} ${y}L${x + 44} ${cy}L${cx} ${y + 30}Z"/>`;
      if (e.name) s += `<text class="t-edge" data-sub="name" x="${cx}" y="${y - 7}" text-anchor="middle">${esc(e.name)}</text>`;
    }
    return s + '</g>';
  }

  /* ---------- geometria das linhas ---------- */
  const center = v => ({ x: v.x + v._w / 2, y: v.y + v._h / 2 });
  UML.center = center;
  const shapeOf = (v, e) => (v._L && v._L.lolli ? 'circle' : e.kind === 'nary' ? 'diamond' : 'rect');
  function clip(v, e, from, to) {
    const k = shapeOf(v, e), c = center(v);
    if (k !== 'rect') {
      const dx = to.x - c.x, dy = to.y - c.y;
      if (!dx && !dy) return c;
      const t = k === 'circle' ? (v._w / 2 - 1) / Math.hypot(dx, dy) : 1 / (Math.abs(dx) / (v._w / 2) + Math.abs(dy) / (v._h / 2));
      return { x: c.x + dx * t, y: c.y + dy * t };
    }
    const dx = to.x - from.x, dy = to.y - from.y;
    if (!dx && !dy) return from;
    const tx = dx > 0 ? (v.x + v._w - from.x) / dx : dx < 0 ? (v.x - from.x) / dx : Infinity;
    const ty = dy > 0 ? (v.y + v._h - from.y) / dy : dy < 0 ? (v.y - from.y) / dy : Infinity;
    const t = Math.min(tx, ty);
    if (!isFinite(t) || t < 0) return from;
    return { x: from.x + dx * t, y: from.y + dy * t };
  }
  function ortho(a, b) {
    const ca = center(a), cb = center(b);
    const ox0 = Math.max(a.x, b.x), ox1 = Math.min(a.x + a._w, b.x + b._w);
    const oy0 = Math.max(a.y, b.y), oy1 = Math.min(a.y + a._h, b.y + b._h);
    if (ox1 - ox0 >= 16) { const x = (ox0 + ox1) / 2; return cb.y > ca.y ? [{ x, y: a.y + a._h }, { x, y: b.y }] : [{ x, y: a.y }, { x, y: b.y + b._h }]; }
    if (oy1 - oy0 >= 16) { const y = (oy0 + oy1) / 2; return cb.x > ca.x ? [{ x: a.x + a._w, y }, { x: b.x, y }] : [{ x: a.x, y }, { x: b.x + b._w, y }]; }
    const gx = Math.max(b.x - (a.x + a._w), a.x - (b.x + b._w)), gy = Math.max(b.y - (a.y + a._h), a.y - (b.y + b._h));
    // Preferir o traçado vertical (árvore de herança); horizontal só quando o vão lateral domina.
    if (gx > gy * 1.6) {
      const p1 = { x: cb.x > ca.x ? a.x + a._w : a.x, y: ca.y }, p2 = { x: cb.x > ca.x ? b.x : b.x + b._w, y: cb.y }, mx = (p1.x + p2.x) / 2;
      return [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2];
    }
    const p1 = { x: ca.x, y: cb.y > ca.y ? a.y + a._h : a.y }, p2 = { x: cb.x, y: cb.y > ca.y ? b.y : b.y + b._h }, my = (p1.y + p2.y) / 2;
    return [p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2];
  }
  function loop(v, i) {
    const Rr = v.x + v._w, T = v.y, d = i * 14;
    return [{ x: Rr - 24 - d, y: T }, { x: Rr - 24 - d, y: T - 28 - d }, { x: Rr + 28 + d, y: T - 28 - d }, { x: Rr + 28 + d, y: T + 24 + d }, { x: Rr, y: T + 24 + d }];
  }
  function routeOf(ev, va, ea, vb, eb, off, idx) {
    if (va === vb) return loop(va, idx);
    if (ev.points && ev.points.length) {
      const f = ev.points[0], l = ev.points[ev.points.length - 1];
      return [clip(va, ea, center(va), f), ...ev.points.map(q => ({ x: q.x, y: q.y })), clip(vb, eb, center(vb), l)];
    }
    if (ev.style === 'ortho' && shapeOf(va, ea) === 'rect' && shapeOf(vb, eb) === 'rect') return ortho(va, vb);
    const ca = center(va), cb = center(vb);
    let n = { x: 0, y: 0 };
    if (off) {
      const len = Math.hypot(cb.x - ca.x, cb.y - ca.y) || 1;
      const lim = Math.min(va._w, va._h, vb._w, vb._h) / 2 - 4;
      const o = Math.max(-lim, Math.min(lim, off));
      n = { x: (-(cb.y - ca.y) / len) * o, y: ((cb.x - ca.x) / len) * o };
    }
    const a0 = { x: ca.x + n.x, y: ca.y + n.y }, b0 = { x: cb.x + n.x, y: cb.y + n.y };
    return [clip(va, ea, a0, b0), clip(vb, eb, b0, a0)];
  }

  /* ---------- adornos ---------- */
  const P2 = (q, u, a, n, b) => `${R(q.x - u.x * a + n.x * b)} ${R(q.y - u.y * a + n.y * b)}`;
  const triangle = (q, u, n) => `<path class="mk-hollow" d="M${R(q.x)} ${R(q.y)}L${P2(q, u, 16, n, 9)}L${P2(q, u, 16, n, -9)}Z"/>`;
  const arrow = (q, u, n) => `<path class="mk-open" d="M${P2(q, u, 13, n, 7)}L${R(q.x)} ${R(q.y)}L${P2(q, u, 13, n, -7)}"/>`;
  const diamond = (q, u, n, filled) => `<path class="${filled ? 'mk-fill' : 'mk-hollow'}" d="M${R(q.x)} ${R(q.y)}L${P2(q, u, 12, n, 7)}L${P2(q, u, 24, n, 0)}L${P2(q, u, 12, n, -7)}Z"/>`;
  const cross = (q, u, n) => {
    const a = { x: (u.x + n.x) * 4.5, y: (u.y + n.y) * 4.5 }, b = { x: (u.x - n.x) * 4.5, y: (u.y - n.y) * 4.5 };
    return `<path class="mk-open" d="M${R(q.x + a.x)} ${R(q.y + a.y)}L${R(q.x - a.x)} ${R(q.y - a.y)}M${R(q.x + b.x)} ${R(q.y + b.y)}L${R(q.x - b.x)} ${R(q.y - b.y)}"/>`;
  };
  const sideOf = n => (n.y > 0.001 || (Math.abs(n.y) <= 0.001 && n.x < 0) ? { x: -n.x, y: -n.y } : n);
  function midOf(pts) {
    let total = 0;
    const seg = [];
    for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y); seg.push(l); total += l; }
    let h = total / 2;
    for (let i = 0; i < seg.length; i++) {
      if (h <= seg[i] || i === seg.length - 1) {
        const t = seg[i] ? Math.min(1, h / seg[i]) : 0, a = pts[i], b = pts[i + 1];
        const u = seg[i] ? { x: (b.x - a.x) / seg[i], y: (b.y - a.y) / seg[i] } : { x: 1, y: 0 };
        return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, u };
      }
      h -= seg[i];
    }
    return { x: pts[0].x, y: pts[0].y, u: { x: 1, y: 0 } };
  }
  UML.midOf = midOf;

  function label(cls, key, x, y, anchor, text, o, ev) {
    const off = ev.labels && ev.labels[key];
    if (off) { x += off.dx; y += off.dy; }
    const k = o.exp ? '' : ` data-kind="label" data-id="${ev.id}" data-key="${key}"`;
    return `<text class="${cls}"${k} x="${R(x)}" y="${R(y)}" text-anchor="${anchor}">${esc(text)}</text>`;
  }
  function placed(base, s, dist, vertical) {
    return { x: base.x + s.x * dist, y: base.y + s.y * dist + 4, anchor: vertical ? (s.x >= 0 ? 'start' : 'end') : 'middle' };
  }

  function edgeSVG(ev, r, raw, o) {
    const pts = raw.map(q => ({ x: q.x, y: q.y }));
    const n = pts.length;
    const info = k => {
      const i = k ? n - 1 : 0, j = k ? n - 2 : 1;
      const len = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) || 1;
      const u = { x: (pts[i].x - pts[j].x) / len, y: (pts[i].y - pts[j].y) / len };
      return { i, u, nn: { x: -u.y, y: u.x } };
    };
    const E = [info(0), info(1)];
    const assoc = r.kind === 'association';
    let deco = '', labels = '';
    if (assoc) for (const k of [0, 1]) {
      const q = r.ends[k].qualifier;
      if (!q) continue;
      const { i, u } = E[k], P = pts[i];
      const bw = Math.ceil(M(q, FN.mult)) + 12, bh = 20;
      const depth = Math.abs(u.x) >= Math.abs(u.y) ? bw : bh;
      const cx = P.x - (u.x * depth) / 2, cy = P.y - (u.y * depth) / 2;
      deco += `<rect class="qual" x="${R(cx - bw / 2)}" y="${R(cy - bh / 2)}" width="${bw}" height="${bh}"/><text class="t-qual" x="${R(cx)}" y="${R(cy + 4)}" text-anchor="middle">${esc(q)}</text>`;
      pts[i] = { x: P.x - u.x * depth, y: P.y - u.y * depth };
    }
    const anchors = [{ ...pts[0] }, { ...pts[n - 1] }];
    const trim = (k, dd) => { const { i, u } = E[k]; pts[i] = { x: pts[i].x - u.x * dd, y: pts[i].y - u.y * dd }; };
    for (const k of [0, 1]) {
      const { i, u, nn } = E[k];
      const P = { ...pts[i] };
      if (assoc) {
        const end = r.ends[k];
        if (end.agg !== 'none') { deco += diamond(P, u, nn, end.agg === 'composite'); trim(k, 24); }
        else if (end.nav === 'nav') deco += arrow(P, u, nn);
        if (end.nav === 'non') { const back = end.agg !== 'none' ? 32 : 12; deco += cross({ x: P.x - u.x * back, y: P.y - u.y * back }, u, nn); }
      } else if (k === 1) {
        if (r.kind === 'generalization' || r.kind === 'realization') { deco += triangle(P, u, nn); trim(1, 16); }
        else if (r.kind === 'dependency') deco += arrow(P, u, nn);
      }
    }
    const d = 'M' + pts.map(q => `${R(q.x)} ${R(q.y)}`).join('L');
    const dash = r.kind === 'realization' || r.kind === 'dependency' || r.kind === 'anchor';

    const mid = midOf(raw);
    const mn = sideOf({ x: -mid.u.y, y: mid.u.x });
    const vert = Math.abs(mid.u.y) > Math.abs(mid.u.x);
    const text = [r.stereotype ? `«${r.stereotype}»` : '', r.name].filter(Boolean).join(' ');
    if (text) { const q = placed(mid, mn, 12, vert); labels += label('t-edge', 'name', q.x, q.y, q.anchor, text, o, ev); }
    if (assoc && raw.length >= 2) {
      for (const k of [0, 1]) {
        const end = r.ends[k], { u, nn } = E[k];
        const s = sideOf(nn), vertical = Math.abs(u.y) > Math.abs(u.x);
        // Em linhas mais horizontais, o texto cresce para longe da caixa e não a invade.
        const back = vertical ? (end.agg !== 'none' ? 34 : 20) : end.agg !== 'none' ? 30 : end.nav === 'nav' ? 17 : 8;
        const away = vertical ? null : u.x > 0 ? 'end' : 'start';
        const base = { x: anchors[k].x - u.x * back, y: anchors[k].y - u.y * back };
        const at = (side, dist) => { const q = placed(base, side, dist, vertical); if (away) q.anchor = away; return q; };
        const role = (end.vis && end.role ? end.vis : '') + (end.role || '');
        if (role) { const q = at(s, 11); labels += label('t-edge', 'r' + k, q.x, q.y, q.anchor, role, o, ev); }
        if (end.constraint) { const q = at(s, vertical ? 11 : 24); labels += label('t-edge', 'c' + k, q.x, q.y + (vertical ? 13 : 0), q.anchor, `{${end.constraint}}`, o, ev); }
        if (end.mult) { const q = at({ x: -s.x, y: -s.y }, 11); labels += label('t-mult', 'm' + k, q.x, q.y, q.anchor, end.mult, o, ev); }
      }
    }
    const on = !o.exp && o.sel && o.sel.has(ev.id);
    let s = `<g class="edge${on ? ' sel' : ''}${r.kind === 'association' && r.assocClass ? ' has-ac' : ''}" data-kind="edge" data-id="${ev.id}">`;
    if (!o.exp) s += `<path class="hit" d="M${raw.map(q => `${R(q.x)} ${R(q.y)}`).join('L')}"/>`;
    s += `<path class="e-line${dash ? ' dash' : ''}" d="${d}"/>${deco}</g>`;
    return { svg: s, labels, mid };
  }

  /* ---------- diagrama inteiro ---------- */
  UML.renderDiagram = function (p, d, o = {}) {
    const byRef = new Map();
    const views = [];
    for (const v of d.views) {
      const e = p.elements[v.ref];
      if (!e) continue;
      UML.layoutView(v, e, d, p);
      byRef.set(v.ref, v);
      views.push(v);
    }
    const pk = views.filter(v => p.elements[v.ref].kind === 'package').sort((a, b) => b._w * b._h - a._w * a._h);
    const rest = views.filter(v => p.elements[v.ref].kind !== 'package');
    const edges = d.edges.filter(ev => { const r = p.relations[ev.ref]; return r && byRef.has(r.source) && byRef.has(r.target); });

    const groups = new Map();
    for (const ev of edges) {
      const r = p.relations[ev.ref];
      const auto = !(ev.points && ev.points.length) && ev.style !== 'ortho';
      const key = r.source === r.target ? 'self:' + r.source : auto ? [r.source, r.target].sort().join('|') : 'own:' + ev.id;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ev);
    }
    let svg = pk.map(v => nodeSVG(v, p.elements[v.ref], p, o)).join('');
    const geom = {};
    const xs = [], ys = [];
    let labelLayer = '';
    for (const list of groups.values()) {
      list.forEach((ev, i) => {
        const r = p.relations[ev.ref];
        const va = byRef.get(r.source), vb = byRef.get(r.target);
        let off = (i - (list.length - 1) / 2) * 22;
        if (list.length > 1 && r.source > r.target) off = -off;
        const raw = routeOf(ev, va, p.elements[r.source], vb, p.elements[r.target], off, i);
        const out = edgeSVG(ev, r, raw, o);
        svg += out.svg;
        labelLayer += out.labels;
        geom[ev.id] = { raw, mid: out.mid, self: va === vb };
        raw.forEach(q => { xs.push(q.x); ys.push(q.y); });
      });
    }
    for (const ev of edges) {
      const r = p.relations[ev.ref];
      if (r.kind !== 'association' || !r.assocClass || !byRef.has(r.assocClass) || !geom[ev.id]) continue;
      const cv = byRef.get(r.assocClass), m = geom[ev.id].mid;
      const q = clip(cv, p.elements[r.assocClass], center(cv), m);
      svg += `<path class="e-line dash ac-line" d="M${R(m.x)} ${R(m.y)}L${R(q.x)} ${R(q.y)}"/>`;
    }
    svg += rest.map(v => nodeSVG(v, p.elements[v.ref], p, o)).join('');
    svg += `<g class="labels">${labelLayer}</g>`;

    for (const v of views) {
      xs.push(v.x, v.x + v._w);
      ys.push(v.y - (v._L.tp ? 14 : 0) - (p.elements[v.ref].kind === 'nary' ? 20 : 0), v.y + v._h + (v._L.lolli ? 26 : 0));
      if (v._L.lolli) { const lw = M(p.elements[v.ref].name, FN.plain) / 2; xs.push(v.x + 11 - lw, v.x + 11 + lw); }
      if (v._L.tp) xs.push(v.x + v._w + 14);
    }
    const bbox = xs.length ? { x: Math.min(...xs) - 30, y: Math.min(...ys) - 30, w: Math.max(...xs) - Math.min(...xs) + 60, h: Math.max(...ys) - Math.min(...ys) + 60 } : null;

    if (!o.exp && o.sel) {
      for (const id of o.sel) {
        const v = d.views.find(x => x.id === id);
        if (v && v._w) {
          svg += `<rect class="sel-box" x="${v.x - 4}" y="${v.y - 4}" width="${v._w + 8}" height="${v._h + 8}"/>`;
          if (o.sel.size === 1 && !v._L.lolli && p.elements[v.ref].kind !== 'nary') svg += `<rect class="handle" data-kind="handle" data-id="${v.id}" x="${v.x + v._w - 5}" y="${v.y + v._h - 5}" width="10" height="10" rx="2"/>`;
        }
        const ev = o.sel.size === 1 && d.edges.find(x => x.id === id);
        const g = ev && geom[ev.id];
        if (g) {
          const raw = g.raw;
          if (!g.self) {
            for (let i = 0; i < raw.length - 1; i++) {
              const mx = (raw[i].x + raw[i + 1].x) / 2, my = (raw[i].y + raw[i + 1].y) / 2;
              svg += `<circle class="h-mid" data-kind="mid" data-id="${ev.id}" data-i="${i}" cx="${R(mx)}" cy="${R(my)}" r="4"/>`;
            }
            (ev.points || []).forEach((q, i) => { svg += `<rect class="h-wp" data-kind="wp" data-id="${ev.id}" data-i="${i}" x="${q.x - 5}" y="${q.y - 5}" width="10" height="10" rx="2"/>`; });
          }
          [0, raw.length - 1].forEach((i, k) => { svg += `<circle class="h-ep" data-kind="ep" data-id="${ev.id}" data-end="${k}" cx="${R(raw[i].x)}" cy="${R(raw[i].y)}" r="6"/>`; });
        }
      }
    }
    return { svg, geom, bbox };
  };

  /* ---------- exportação ---------- */
  UML.EXPORT_CSS = `.shape{fill:#fff;stroke:#17232C;stroke-width:1.25}.head{fill:#E2F0ED}.div,.ul{stroke:#17232C;stroke-width:1;fill:none}
text{font-family:'IBM Plex Sans',Arial,sans-serif;fill:#17232C}.t-name{font-size:13px;font-weight:600}.it{font-style:italic}.t-st{font-size:11px;fill:#5B6C73}
.t-mem{font-family:'IBM Plex Mono',Consolas,monospace;font-size:12px}.t-plain{font-size:13px}.t-note{font-size:12.5px}
.note-shape{fill:#FFF5CC;stroke:#B39D4E;stroke-width:1.25}.note-fold{fill:none;stroke:#B39D4E;stroke-width:1.25}.pkg{fill:#F8FBFA;stroke:#17232C;stroke-width:1.25}
.tp-box{fill:#fff;stroke:#17232C;stroke-dasharray:4 3}.qual{fill:#fff;stroke:#17232C;stroke-width:1.25}
.e-line{fill:none;stroke:#17232C;stroke-width:1.25}.dash{stroke-dasharray:6 4}
.t-edge{font-size:11.5px;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
.t-mult{font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px;paint-order:stroke;stroke:#fff;stroke-width:4px;stroke-linejoin:round}
.t-qual{font-family:'IBM Plex Mono',Consolas,monospace;font-size:11px}
.mk-hollow{fill:#fff;stroke:#17232C;stroke-width:1.25;stroke-linejoin:round}.mk-fill{fill:#17232C;stroke:#17232C;stroke-width:1.25;stroke-linejoin:round}.mk-open{fill:none;stroke:#17232C;stroke-width:1.25;stroke-linejoin:round}
.col-teal .shape{fill:#DDF1EC}.col-teal .head{fill:#C3E5DC}.col-blue .shape{fill:#DFEAF7}.col-blue .head{fill:#C7DAF0}
.col-amber .shape{fill:#FBF0D6}.col-amber .head{fill:#F4DFAE}.col-rose .shape{fill:#F9E3E5}.col-rose .head{fill:#F0C9CE}
.col-violet .shape{fill:#ECE6F7}.col-violet .head{fill:#D9CDF0}.col-slate .shape{fill:#E9ECEE}.col-slate .head{fill:#D5DBDF}`;

  UML.exportSVG = function (p, d) {
    const out = UML.renderDiagram(p, d, { exp: true });
    if (!out.bbox) return null;
    const b = out.bbox;
    return {
      w: Math.ceil(b.w), h: Math.ceil(b.h),
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(b.w)}" height="${Math.ceil(b.h)}" viewBox="${R(b.x)} ${R(b.y)} ${Math.ceil(b.w)} ${Math.ceil(b.h)}"><style>${UML.EXPORT_CSS}</style><rect x="${R(b.x)}" y="${R(b.y)}" width="${Math.ceil(b.w)}" height="${Math.ceil(b.h)}" fill="#fff"/>${out.svg}</svg>`,
    };
  };

  if (typeof module === 'object' && module.exports) module.exports = UML;
})(typeof globalThis !== 'undefined' ? globalThis : this);
