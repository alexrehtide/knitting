// ПРОТОТИП, выбросить. Тикет «Библиотека узоров заливки» (#6).
// Описания узоров — векторные примитивы в единичном квадрате клетки (y вниз).
// Одно и то же описание рисуется и на canvas (штамп клетки), и в PDF (TilingPattern jsPDF).
(function (g) {
  const W = 0.08; // базовая толщина линии, в долях клетки

  // Примитивы
  const L = (x1, y1, x2, y2, w = W) => ({ t: 'L', x1, y1, x2, y2, w }); // отрезок
  const D = (cx, cy, r) => ({ t: 'D', cx, cy, r }); // залитый круг
  const O = (cx, cy, r, w = W) => ({ t: 'O', cx, cy, r, w }); // окружность
  const P = (...pts) => ({ t: 'P', pts }); // залитый многоугольник
  const S = (pts, w = W, closed = false) => ({ t: 'S', pts, w, closed }); // ломаная
  const rectP = (x0, y0, x1, y1) => P(x0, y0, x1, y0, x1, y1, x0, y1);

  const LIBRARIES = {
    A: {
      name: 'Штриховки',
      idea: 'Непрерывные текстуры: соседние клетки одной нити сливаются в однородную область, как на картах.',
      patterns: [
        { id: 'diag-fwd', name: 'Диагональ /', prims: [L(0, 1, 1, 0)] },
        { id: 'hlines', name: 'Горизонтали', prims: [L(0, 0.5, 1, 0.5)] },
        { id: 'dots', name: 'Точки', prims: [D(0.5, 0.5, 0.13)] },
        { id: 'diag-back', name: 'Диагональ \\', prims: [L(0, 0, 1, 1)] },
        { id: 'vlines', name: 'Вертикали', prims: [L(0.5, 0, 0.5, 1)] },
        { id: 'rings', name: 'Кольца', prims: [O(0.5, 0.5, 0.27)] },
        { id: 'grid', name: 'Клетка', prims: [L(0, 0.5, 1, 0.5), L(0.5, 0, 0.5, 1)] },
        { id: 'xgrid', name: 'Косая клетка', prims: [L(0, 1, 1, 0), L(0, 0, 1, 1)] },
        { id: 'zigzag', name: 'Зигзаг', prims: [S([0, 0.75, 0.5, 0.25, 1, 0.75])] },
        { id: 'dots-stagger', name: 'Точки вразбивку', prims: [D(0.25, 0.25, 0.11), D(0.75, 0.75, 0.11)] },
        { id: 'diag-fwd-dense', name: 'Частая диагональ /', prims: [L(0, 0.5, 0.5, 0), L(0.5, 1, 1, 0.5)] },
        { id: 'hlines-dense', name: 'Частые горизонтали', prims: [L(0, 0.25, 1, 0.25), L(0, 0.75, 1, 0.75)] },
        { id: 'diamonds', name: 'Ромбы', prims: [S([0.5, 0.15, 0.85, 0.5, 0.5, 0.85, 0.15, 0.5], W, true)] },
        { id: 'pluses', name: 'Плюсы', prims: [L(0.3, 0.5, 0.7, 0.5, 0.1), L(0.5, 0.3, 0.5, 0.7, 0.1)] },
        { id: 'grid-dense', name: 'Частая клетка', prims: [L(0, 0.25, 1, 0.25), L(0, 0.75, 1, 0.75), L(0.25, 0, 0.25, 1), L(0.75, 0, 0.75, 1)] },
        { id: 'checker', name: 'Шахматка', prims: [rectP(0, 0, 0.5, 0.5), rectP(0.5, 0.5, 1, 1)] },
      ],
    },
    B: {
      name: 'Значки',
      idea: 'Один значок в центре каждой клетки, как в схемах вышивки крестом: каждую петлю можно сосчитать.',
      patterns: [
        { id: 'cross', name: 'Крест ×', prims: [L(0.25, 0.25, 0.75, 0.75, 0.1), L(0.75, 0.25, 0.25, 0.75, 0.1)] },
        { id: 'disc', name: 'Точка ●', prims: [D(0.5, 0.5, 0.2)] },
        { id: 'ring', name: 'Кольцо ○', prims: [O(0.5, 0.5, 0.24, 0.09)] },
        { id: 'plus', name: 'Плюс +', prims: [L(0.22, 0.5, 0.78, 0.5, 0.1), L(0.5, 0.22, 0.5, 0.78, 0.1)] },
        { id: 'square', name: 'Квадрат ■', prims: [rectP(0.3, 0.3, 0.7, 0.7)] },
        { id: 'slash', name: 'Косая /', prims: [L(0.25, 0.75, 0.75, 0.25, 0.12)] },
        { id: 'tri-out', name: 'Треугольник △', prims: [S([0.5, 0.24, 0.78, 0.74, 0.22, 0.74], 0.09, true)] },
        { id: 'diamond', name: 'Ромб ◆', prims: [P(0.5, 0.2, 0.8, 0.5, 0.5, 0.8, 0.2, 0.5)] },
        { id: 'hbar', name: 'Черта —', prims: [L(0.22, 0.5, 0.78, 0.5, 0.12)] },
        { id: 'square-out', name: 'Квадрат □', prims: [S([0.28, 0.28, 0.72, 0.28, 0.72, 0.72, 0.28, 0.72], 0.09, true)] },
        { id: 'backslash', name: 'Обратная \\', prims: [L(0.25, 0.25, 0.75, 0.75, 0.12)] },
        { id: 'tri-down', name: 'Треугольник ▼', prims: [P(0.22, 0.28, 0.78, 0.28, 0.5, 0.78)] },
        { id: 'vbar', name: 'Черта |', prims: [L(0.5, 0.22, 0.5, 0.78, 0.12)] },
        { id: 'diamond-out', name: 'Ромб ◇', prims: [S([0.5, 0.2, 0.8, 0.5, 0.5, 0.8, 0.2, 0.5], 0.09, true)] },
        { id: 'ring-dot', name: 'Кольцо с точкой ⊙', prims: [O(0.5, 0.5, 0.28, 0.08), D(0.5, 0.5, 0.09)] },
        { id: 'asterisk', name: 'Звёздочка ✳', prims: [L(0.28, 0.28, 0.72, 0.72), L(0.72, 0.28, 0.28, 0.72), L(0.5, 0.2, 0.5, 0.8), L(0.2, 0.5, 0.8, 0.5)] },
      ],
    },
    C: {
      name: 'Доли клетки',
      idea: 'Крупные залитые части клетки, как в лоскутном шитье: без тонких линий, переживает плохой принтер.',
      patterns: [
        { id: 'tri-br', name: 'Треугольник ◢', prims: [P(1, 0, 1, 1, 0, 1)] },
        { id: 'half-top', name: 'Полоса сверху', prims: [rectP(0, 0, 1, 0.45)] },
        { id: 'center', name: 'Квадрат в центре', prims: [rectP(0.3, 0.3, 0.7, 0.7)] },
        { id: 'half-left', name: 'Полоса слева', prims: [rectP(0, 0, 0.45, 1)] },
        { id: 'circle', name: 'Круг', prims: [D(0.5, 0.5, 0.32)] },
        { id: 'tri-bl', name: 'Треугольник ◣', prims: [P(0, 0, 0, 1, 1, 1)] },
        { id: 'frame', name: 'Рамка', prims: [S([0.22, 0.22, 0.78, 0.22, 0.78, 0.78, 0.22, 0.78], 0.14, true)] },
        { id: 'checker', name: 'Шахматка', prims: [rectP(0, 0, 0.5, 0.5), rectP(0.5, 0.5, 1, 1)] },
        { id: 'two-hbars', name: 'Две полосы', prims: [L(0, 0.25, 1, 0.25, 0.18), L(0, 0.75, 1, 0.75, 0.18)] },
        { id: 'diamond', name: 'Большой ромб', prims: [P(0.5, 0.05, 0.95, 0.5, 0.5, 0.95, 0.05, 0.5)] },
        { id: 'quarter', name: 'Четверть', prims: [rectP(0, 0, 0.5, 0.5)] },
        { id: 'thick-plus', name: 'Толстый крест', prims: [L(0, 0.5, 1, 0.5, 0.2), L(0.5, 0, 0.5, 1, 0.2)] },
        { id: 'hourglass', name: 'Песочные часы', prims: [P(0.05, 0.05, 0.95, 0.05, 0.5, 0.5), P(0.05, 0.95, 0.95, 0.95, 0.5, 0.5)] },
        { id: 'two-vbars', name: 'Две вертикали', prims: [L(0.25, 0, 0.25, 1, 0.18), L(0.75, 0, 0.75, 1, 0.18)] },
        { id: 'thick-x', name: 'Толстый ×', prims: [L(0, 0, 1, 1, 0.18), L(0, 1, 1, 0, 0.18)] },
        { id: 'donut', name: 'Бублик', prims: [O(0.5, 0.5, 0.28, 0.14)] },
      ],
    },
  };

  const BLANK = { id: 'blank', name: 'Без узора', prims: [] };

  // Рисование через абстрактный «холст» api: stroke(path, width, color) / fill(path, color),
  // где path(b) строит контур через b.moveTo / b.lineTo / b.close / b.circle.
  // Каждый примитив рисуется со сдвигами −1…1 по обеим осям и обрезается по клетке —
  // так узор бесшовно продолжается в соседнюю клетку той же нити.
  function renderPrims(api, prims, style) {
    const passes = style.halo
      ? [{ color: style.halo, extra: style.haloW }, { color: style.ink, extra: 0 }]
      : [{ color: style.ink, extra: 0 }];
    const minW = style.minW || 0;
    for (const pass of passes) {
      for (const p of prims) {
        for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) {
          const w = Math.max(p.w || 0, minW) + 2 * pass.extra;
          switch (p.t) {
            case 'L':
              api.stroke(b => { b.moveTo(p.x1 + dx, p.y1 + dy); b.lineTo(p.x2 + dx, p.y2 + dy); }, w, pass.color);
              break;
            case 'O':
              api.stroke(b => b.circle(p.cx + dx, p.cy + dy, p.r), w, pass.color);
              break;
            case 'D':
              api.fill(b => b.circle(p.cx + dx, p.cy + dy, p.r), pass.color);
              if (pass.extra) api.stroke(b => b.circle(p.cx + dx, p.cy + dy, p.r), 2 * pass.extra, pass.color);
              break;
            case 'P': {
              const path = b => polyPath(b, p.pts, dx, dy, true);
              api.fill(path, pass.color);
              if (pass.extra) api.stroke(path, 2 * pass.extra, pass.color);
              break;
            }
            case 'S':
              api.stroke(b => polyPath(b, p.pts, dx, dy, p.closed), w, pass.color);
              break;
          }
        }
      }
    }
  }
  function polyPath(b, pts, dx, dy, closed) {
    b.moveTo(pts[0] + dx, pts[1] + dy);
    for (let i = 2; i < pts.length; i += 2) b.lineTo(pts[i] + dx, pts[i + 1] + dy);
    if (closed) b.close();
  }

  // Цвет знака поверх цвета нити
  function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  }
  function inkStyle(bg, strategy) {
    if (strategy === 'auto') return { ink: luminance(bg) < 0.18 ? '#ffffff' : '#000000' };
    if (strategy === 'halo') return { ink: '#000000', halo: '#ffffff', haloW: 0.05 };
    return { ink: '#000000' };
  }

  // Палитра образца: светлые и тёмные вперемешку
  const SAMPLE_COLORS = ['#f3ead8', '#1f2e5a', '#c8323c', '#e3b23c', '#2f6b3a', '#b9c3cc', '#111111', '#f2a6b8',
    '#2a8c8c', '#6b4226', '#9cc8ea', '#e8752a', '#5b2a86', '#7d7f2e', '#d9c7a8', '#4a4a4a'];

  // Образец схемы 40×40: полосы жаккарда с ромбами; угол — пустые клетки
  function sampleChart(nYarns) {
    const Wd = 40, Ht = 40, cells = new Uint8Array(Wd * Ht);
    const k = Math.max(nYarns - 2, 1);
    for (let y = 0; y < Ht; y++) for (let x = 0; x < Wd; x++) {
      const b = Math.floor(y / 6), ly = y % 6;
      let v = 0;
      if (nYarns > 1 && ly === 0) v = 1;
      else if (nYarns > 2) {
        const dx = Math.abs(((x + 3 * b) % 8) - 4), dd = dx + Math.abs(ly - 3);
        if (dd === 0) v = 2 + ((b * 2 + 1) % k);
        else if (dd <= 2) v = 2 + ((b * 2) % k);
      }
      if (x + y < 4) v = 255; // пустая клетка
      cells[y * Wd + x] = v;
    }
    return { w: Wd, h: Ht, cells };
  }

  // Узор, назначенный нити i (порядок библиотеки = порядок назначения новой нити)
  function patternForYarn(lib, i, firstBlank) {
    const list = firstBlank ? [BLANK, ...lib.patterns] : lib.patterns;
    return list[i % list.length];
  }

  // ---------- PDF (jsPDF 4.x, advanced API, TilingPattern) ----------
  function buildPdf(jspdf, libKey, opt) {
    const lib = LIBRARIES[libKey];
    const { jsPDF, TilingPattern } = jspdf;
    const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const k = doc.internal.scaleFactor, pageHpt = doc.internal.pageSize.getHeight() * k;
    const base = 5;
    const cellOf = (b) => opt.aspect >= 1 ? [b, b / opt.aspect] : [b * opt.aspect, b];
    let nKeys = 0;
    const cache = new Map();

    // Узор, привязанный к сетке с началом (ox, oy) и клеткой cw×ch мм; фон запекается в узор
    function patternKey(d, pat, ox, oy, cw, ch, bg, strategy) {
      const key = [pat.id, ox, oy, cw, ch, bg, strategy].join('|');
      if (cache.has(key)) return cache.get(key);
      const m = d.Matrix(cw * k, 0, 0, -ch * k, ox * k, pageHpt - oy * k);
      const tp = new TilingPattern([0, 0, 1, 1], 1, 1, undefined, m);
      d.beginTilingPattern(tp);
      d.setFillColor(bg); d.rect(0, 0, 1, 1, null); d.fill();
      d.setLineCap('round'); d.setLineJoin('round');
      const st = bg.toLowerCase() === '#ffffff' ? { ink: '#000000' } : inkStyle(bg, strategy);
      st.minW = opt.minWmm ? opt.minWmm / Math.min(cw, ch) : 0;
      renderPrims(pdfApi(d), pat.prims, st);
      const name = 'p' + (++nKeys);
      d.endTilingPattern(name, tp);
      cache.set(key, name);
      return name;
    }

    // Залить прямоугольник сетки cols×rows: yarnAt(c, r) → { pat, bg } | null (пусто)
    function drawGrid(ox, oy, cw, ch, cols, rows, cellAt, strategy, major) {
      doc.advancedAPI(d => {
        const groups = new Map();
        for (let r = 0; r < rows; r++) {
          let c = 0;
          while (c < cols) {
            const v = cellAt(c, r); let e = c + 1;
            while (e < cols && sameCell(cellAt(e, r), v)) e++;
            if (v) {
              const key = patternKey(d, v.pat, ox, oy, cw, ch, v.bg, strategy);
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key).push([ox + c * cw, oy + r * ch, (e - c) * cw, ch]);
            }
            c = e;
          }
        }
        for (const [key, rects] of groups) {
          for (const [x, y, w, h] of rects) d.rect(x, y, w, h, null);
          d.fill({ key });
        }
      });
      for (let i = 0; i <= cols; i++) {
        const isMajor = major && i % major === 0;
        doc.setLineWidth(isMajor ? 0.3 : 0.1); doc.setDrawColor(isMajor ? 0 : 120);
        doc.line(ox + i * cw, oy, ox + i * cw, oy + rows * ch);
      }
      for (let j = 0; j <= rows; j++) {
        const isMajor = major && j % major === 0;
        doc.setLineWidth(isMajor ? 0.3 : 0.1); doc.setDrawColor(isMajor ? 0 : 120);
        doc.line(ox, oy + j * ch, ox + cols * cw, oy + j * ch);
      }
    }
    const sameCell = (a, b) => (a === b) || (a && b && a.pat === b.pat && a.bg === b.bg);

    const header = (t) => {
      doc.setFontSize(10); doc.setTextColor(0);
      doc.text(`Fill patterns PROTOTYPE - library ${libKey} - ink: ${opt.strategy} - aspect ${opt.aspectLabel}`, 10, 10);
      doc.setFontSize(8); doc.text(t, 10, 15);
    };
    const swatchColors = ['#f3ead8', '#e3b23c', '#c8323c', '#2f6b3a', '#1f2e5a', '#111111'];

    // 1–2. Библиотека: номер, блоки 3×3 при 4/5/6 мм (узор), 3×3 при 5 мм поверх цветов
    const per = 8;
    for (let pg = 0; pg * per < lib.patterns.length; pg++) {
      if (pg) doc.addPage();
      header('Library. Columns: 3x3 at 4 / 5 / 6 mm (pattern), then 3x3 at 5 mm over sample colors (color+pattern).');
      lib.patterns.slice(pg * per, pg * per + per).forEach((pat, i) => {
        const n = pg * per + i + 1, y = 24 + i * 33;
        doc.setFontSize(12); doc.text(String(n), 10, y + 8);
        let x = 20;
        for (const b of [4, 5, 6]) {
          const [cw, ch] = cellOf(b);
          drawGrid(x, y, cw, ch, 3, 3, () => ({ pat, bg: '#ffffff' }), opt.strategy, 0);
          x += 3 * cw + 5;
        }
        const [cw, ch] = cellOf(base);
        for (const bg of swatchColors) {
          drawGrid(x, y, cw, ch, 3, 3, () => ({ pat, bg }), opt.strategy, 0);
          x += 3 * cw + 3;
        }
      });
    }

    // 3. Пары: блоки 2×2 «шахматкой» узоров i и j — различимость соседних клеток и швы (диагональ i = j)
    doc.addPage();
    header('Pairs: block (row i, col j) is a 2x2 checker of patterns i and j. Diagonal = same pattern, look for seams.');
    {
      const n = lib.patterns.length, [cw, ch] = cellOf(base), ox = 16, oy = 26;
      doc.setFontSize(7);
      for (let i = 0; i < n; i++) {
        doc.text(String(i + 1), ox + (2 * i + 0.6) * cw, oy - 2);
        doc.text(String(i + 1), ox - 5, oy + (2 * i + 1.3) * ch);
      }
      drawGrid(ox, oy, cw, ch, 2 * n, 2 * n, (c, r) => {
        const i = r >> 1, j = c >> 1, same = ((c + r) & 1) === 0;
        return { pat: lib.patterns[same ? i : j], bg: '#ffffff' };
      }, opt.strategy, 2);
    }

    // 4–5. Образец схемы в режиме «узор» и «цвет+узор» с легендой
    const chart = sampleChart(opt.nYarns);
    for (const mode of ['pattern', 'color+pattern']) {
      doc.addPage();
      header(`Sample chart 40x40, mode: ${mode}. Top-left corner = empty cells.`);
      const [cw, ch] = cellOf(4.5), ox = 15, oy = 22;
      const yarnCell = (v) => v === 255 ? null : {
        pat: patternForYarn(lib, v, opt.firstBlank),
        bg: mode === 'pattern' ? '#ffffff' : SAMPLE_COLORS[v],
      };
      drawGrid(ox, oy, cw, ch, chart.w, chart.h, (c, r) => yarnCell(chart.cells[r * chart.w + c]), opt.strategy, 10);
      const ly = oy + chart.h * ch + 8;
      doc.setFontSize(9);
      for (let v = 0; v < opt.nYarns; v++) {
        const col = v >> 3, row = v & 7, x = ox + col * 90, y = ly + row * 8;
        drawGrid(x, y, 6, 6, 1, 1, () => yarnCell(v), opt.strategy, 0);
        doc.text(`${v + 1}   ${patternForYarn(lib, v, opt.firstBlank).id}   ${SAMPLE_COLORS[v]}`, x + 9, y + 4.5);
      }
    }
    return doc;
  }

  function pdfApi(d) {
    const b = {
      moveTo: (x, y) => d.moveTo(x, y),
      lineTo: (x, y) => d.lineTo(x, y),
      close: () => d.close(),
      circle: (cx, cy, r) => d.circle(cx, cy, r, null),
    };
    return {
      stroke(path, w, color) { d.setLineWidth(w); d.setDrawColor(color); path(b); d.stroke(); },
      fill(path, color) { d.setFillColor(color); path(b); d.fill(); },
    };
  }

  g.FP = { LIBRARIES, BLANK, renderPrims, inkStyle, luminance, SAMPLE_COLORS, sampleChart, patternForYarn, buildPdf };
})(typeof window !== 'undefined' ? window : globalThis);
