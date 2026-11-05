// 연수 운영 계획 — 한글(HWPX) 양식 파일에 내용을 채워 넣는 모듈
// 예시 파일(교사/학부모 연수 운영 계획.hwpx)의 Contents/section0.xml을 읽어 문단·표의 글만 바꿔 저장한다.
window.HWPX = (() => {
  const NS = 'http://www.hancom.co.kr/hwpml/2011/paragraph';
  const q = (el, name) => el ? Array.from(el.childNodes).filter(n => n.nodeName === name) : [];
  const paras = sec => q(sec, 'hp:p');
  const tNodes = p => { const out = []; q(p, 'hp:run').forEach(r => q(r, 'hp:t').forEach(t => out.push(t))); return out; };
  const ptext = p => tNodes(p).map(t => t.textContent).join('');
  function setP(p, text) {
    const ts = tNodes(p);
    let first = ts.find(t => t.textContent.trim() !== '') || ts[0];
    if (!first) {
      const run = p.ownerDocument.createElementNS(NS, 'hp:run'); run.setAttribute('charPrIDRef', '10');
      const t = p.ownerDocument.createElementNS(NS, 'hp:t'); run.appendChild(t);
      p.insertBefore(run, q(p, 'hp:linesegarray')[0] || null); first = t;
    }
    ts.forEach(t => { if (t !== first && t.textContent.trim() !== '') t.textContent = ''; });
    first.textContent = text;
  }
  const tblOf = p => { for (const r of q(p, 'hp:run')) { const t = q(r, 'hp:tbl')[0]; if (t) return t; } return null; };
  const rows = t => q(t, 'hp:tr'); const cells = tr => q(tr, 'hp:tc');
  const subList = tc => q(tc, 'hp:subList')[0];
  const cellPs = tc => q(subList(tc), 'hp:p');
  const cellText = tc => cellPs(tc).map(ptext).join('\n');
  function setCell(tc, text) {
    const lines = String(text == null ? '' : text).split('\n'); const sl = subList(tc); let ps = cellPs(tc);
    while (ps.length < lines.length) { const c = ps[ps.length - 1].cloneNode(true); sl.appendChild(c); ps.push(c); }
    while (ps.length > lines.length && ps.length > 1) sl.removeChild(ps.pop());
    ps.forEach((p, i) => setP(p, lines[i]));
  }
  const attr = (el, name) => q(el, name)[0];
  function setAddr(tr, r) { cells(tr).forEach(c => { const a = attr(c, 'hp:cellAddr'); if (a) a.setAttribute('rowAddr', r); }); }
  function setRowCnt(tbl) {
    const rs = rows(tbl); tbl.setAttribute('rowCnt', rs.length);
    let h = 0; rs.forEach(tr => { let m = 0; cells(tr).forEach(c => { const sp = attr(c, 'hp:cellSpan'), sz = attr(c, 'hp:cellSz'); if (sp && sz && sp.getAttribute('rowSpan') === '1') m = Math.max(m, +sz.getAttribute('height')); }); h += m; });
    const sz = attr(tbl, 'hp:sz'); if (sz && h) sz.setAttribute('height', h);
  }
  // 표를 다시 채움: 머리글 행 keep개 유지, tpl 행을 복제해 data(2차원 글 배열)만큼 만들고, tail 행(합계 등)을 뒤에 붙임
  function fillTable(tbl, keep, tpl, data, tail) {
    const rs = rows(tbl); const tplRow = tpl.cloneNode(true); const tails = (tail || []).map(t => t.cloneNode(true));
    rs.slice(keep).forEach(r => tbl.removeChild(r));
    let r = keep;
    data.forEach(vals => { const tr = tplRow.cloneNode(true); cells(tr).forEach((c, i) => setCell(c, vals[i] == null ? '' : vals[i])); setAddr(tr, r++); tbl.appendChild(tr); });
    tails.forEach(tr => { setAddr(tr, r++); tbl.appendChild(tr); });
    setRowCnt(tbl);
  }
  const insertAfter = (ref, node) => ref.parentNode.insertBefore(node, ref.nextSibling);
  const cloneAfter = (ref, text) => { const c = ref.cloneNode(true); setP(c, text); insertAfter(ref, c); return c; };
  const removeP = p => p.parentNode.removeChild(p);
  const find = (ps, re, from = 0) => { for (let i = from; i < ps.length; i++) if (re.test(ptext(ps[i]))) return i; return -1; };
  const GA = ['가', '나', '다', '라', '마', '바', '사', '아'];

  // ===== 미리보기 블록(B)으로 양식 채우기 =====
  const T = c => (c && c.t != null ? String(c.t) : '');
  function fillListTexts(sec, headerRe, stopRe, texts) {
    let ps = paras(sec); const h = find(ps, headerRe); if (h < 0) return;
    let end = find(ps, stopRe, h + 1); if (end < 0) end = ps.length;
    const old = ps.slice(h + 1, end).filter(p => ptext(p).trim() !== '' && !tblOf(p)); if (!old.length) return;
    let ref = old[0]; texts.forEach(tx => { ref = cloneAfter(ref, '  ' + tx); }); old.forEach(removeP);
  }
  // 표의 열 수를 n으로(첫 열은 항목 이름 열로 유지, 나머지 열 너비 균등)
  function setCols(tbl, n) {
    rows(tbl).forEach(tr => {
      let cs = cells(tr); const total = cs.reduce((s, c) => s + (+attr(c, 'hp:cellSz').getAttribute('width')), 0); const w0 = +attr(cs[0], 'hp:cellSz').getAttribute('width');
      while (cs.length < n) { const c = cs[cs.length - 1].cloneNode(true); tr.appendChild(c); cs = cells(tr); }
      while (cs.length > n) { tr.removeChild(cs[cs.length - 1]); cs = cells(tr); }
      const w = Math.floor((total - w0) / (n - 1));
      cs.forEach((c, i) => { attr(c, 'hp:cellAddr').setAttribute('colAddr', String(i)); if (i) attr(c, 'hp:cellSz').setAttribute('width', String(w)); });
    });
    tbl.setAttribute('colCnt', String(n));
  }
  const indentOf = tx => /^[가-힣]\. /.test(tx) ? '  ' : /^\d\) /.test(tx) ? '    ' : /^※/.test(tx) ? '    ' : '';
  // 2. 세부 추진 계획: 미리보기 순서대로(줄·표) 다시 구성
  function fillSection2B(sec, items) {
    let ps = paras(sec); const h = find(ps, /^2\. 세부/), end = find(ps, /^3\. 예산/, h); if (h < 0 || end < 0) return;
    const region = ps.slice(h + 1, end);
    const lineTpl = (region.find(p => !tblOf(p) && /^\s*가\./.test(ptext(p))) || region.find(p => !tblOf(p) && ptext(p).trim())).cloneNode(true);
    const noteTpl = (region.find(p => /^※/.test(ptext(p).trim())) || lineTpl).cloneNode(true);
    const sessP = region.find(p => tblOf(p) && cellText(cells(rows(tblOf(p))[0])[0]).trim() === '일시');
    const schedP = region.find(p => tblOf(p) && cellText(cells(rows(tblOf(p))[0])[0]).trim() === '순');
    const sessTpl = sessP && sessP.cloneNode(true), schedTpl = schedP && schedP.cloneNode(true);
    region.forEach(removeP);
    let cur = ps[h];
    items.forEach(it => {
      if (it.k === 'p') { const c = (/^※/.test(it.text) ? noteTpl : lineTpl).cloneNode(true); setP(c, indentOf(it.text) + it.text); insertAfter(cur, c); cur = c; }
      else if (it.k === 'table') {
        const first = T(it.rows[0][0]).trim();
        if (first === '일시' && sessTpl) { const c = sessTpl.cloneNode(true); const tbl = tblOf(c); setCols(tbl, it.rows[0].length); rows(tbl).forEach((tr, ri) => cells(tr).forEach((tc, ci) => setCell(tc, T(it.rows[ri] && it.rows[ri][ci])))); insertAfter(cur, c); cur = c; }
        else if (schedTpl) { const c = schedTpl.cloneNode(true); const tbl = tblOf(c); const tpl = rows(tbl)[1]; fillTable(tbl, 1, tpl, it.rows.slice(1).map(r => r.map(T))); insertAfter(cur, c); cur = c; }
      }
    });
  }
  function fillBudgetB(tbl, brows) {
    const rs = rows(tbl); const pairA = rs.find(r => cells(r).length === 7), pairB = pairA && rs[rs.indexOf(pairA) + 1];
    const simple = rs.find(r => cells(r).length === 6 && attr(cells(r)[0], 'hp:cellSpan').getAttribute('colSpan') === '1'); const totalRow = rs[rs.length - 1];
    const out = [];
    for (let i = 1; i < brows.length; i++) {
      const r = brows[i];
      if (T(r[0]).trim() === '총계') { const R = totalRow.cloneNode(true); setCell(cells(R)[1], T(r[1])); setCell(cells(R)[2], T(r[2])); out.push(R); }
      else if (r.length === 7 && pairA && pairB) { const A = pairA.cloneNode(true); r.forEach((c, k) => setCell(cells(A)[k], T(c))); out.push(A); const nx = brows[i + 1]; if (nx && nx.length === 7) { const Bq = pairB.cloneNode(true); setCell(cells(Bq)[0], T(nx[3])); setCell(cells(Bq)[1], T(nx[4])); out.push(Bq); i++; } }
      else { const R = (simple || pairA).cloneNode(true); r.forEach((c, k) => { if (cells(R)[k]) setCell(cells(R)[k], T(c)); }); out.push(R); }
    }
    rows(tbl).slice(1).forEach(r => tbl.removeChild(r)); let addr = 1; out.forEach(tr => { setAddr(tr, addr++); tbl.appendChild(tr); }); setRowCnt(tbl);
  }
  function fillAdminB(sec, items) {
    let ps = paras(sec); const h = find(ps, /^5\. 행정/), end = find(ps, /^6\. 기대/, h); if (h < 0 || end < 0) return;
    const region = ps.slice(h + 1, end);
    const lineTpl = region.find(p => !tblOf(p) && ptext(p).trim()).cloneNode(true); const tP = region.find(p => tblOf(p)); const tTpl = tP && tP.cloneNode(true);
    region.forEach(removeP); let cur = ps[h];
    items.forEach(it => {
      if (it.k === 'p') { const c = lineTpl.cloneNode(true); setP(c, indentOf(it.text) + it.text); insertAfter(cur, c); cur = c; }
      else if (it.k === 'table' && tTpl) { const c = tTpl.cloneNode(true); const tbl = tblOf(c); rows(tbl).forEach((tr, ri) => cells(tr).forEach((tc, ci) => setCell(tc, T(it.rows[ri] && it.rows[ri][ci])))); insertAfter(cur, c); cur = c; }
    });
    const blank = lineTpl.cloneNode(true); setP(blank, ''); insertAfter(cur, blank);
  }
  function sections(B) { // 'h' 블록 번호별로 나눔
    const S = { title: [], org: '', s: {} }; let cur = null;
    B.forEach(b => { if (b.k === 'title') S.title.push(b.text); else if (b.k === 'center' && b.org) S.org = b.text; else if (b.k === 'h') { cur = (b.text.match(/^(\d)\./) || [])[1]; S.s[cur] = []; } else if (cur) S.s[cur].push(b); });
    return S;
  }

  function fillBanner(tbl, lines) {
    const tc = cells(rows(tbl)[0])[0]; const ps = cellPs(tc).filter(p => ptext(p).trim() !== '');
    lines.forEach((l, i) => { if (ps[i]) setP(ps[i], l); });
  }
  function fillAdmin(sec, m) {
    let ps = paras(sec); const h = find(ps, /^5\. 행정/); let end = find(ps, /^6\. 기대/, h);
    const items = ps.slice(h + 1, end);
    if (m.type === 'coach') {
      const texts = ['  가. 개인적인 사정으로 불참 시 담당자에게 사전 유선 연락', '  나. 청도기초학력지원센터 담당 기초학력 전담교사 참석 가능(필요시 수업 일정 조정)'];
      const first = items.find(p => !tblOf(p) && ptext(p).trim() !== '');
      let ref = first; texts.forEach(t => ref = cloneAfter(ref, t));
      items.forEach(p => { if (ptext(p).trim() !== '' || tblOf(p)) removeP(p); });
      return;
    }
    const dueT = items.find(p => tblOf(p)); if (dueT) { const rs = rows(tblOf(dueT)); setCell(cells(rs[1])[0], m.dueCd); setCell(cells(rs[1])[1], m.dueGs); }
    items.forEach(p => { const t = ptext(p); if (/신청 인원/.test(t)) setP(p, t.replace(/교당.*$/, '교당 ' + m.perSchool)); if (/문의/.test(t) && m.tel) setP(p, t.replace(/☎.*$/, '☎ ' + m.tel)); });
  }
  // 학부모 가정통신문(서식1) 등 뒷부분: 글 바꿔치기
  function replaceAfter(sec, startRe, map) {
    const ps = paras(sec); const s = find(ps, startRe); if (s < 0) return;
    const all = []; ps.slice(s).forEach(p => { const walk = n => { if (n.nodeName === 'hp:t') all.push(n); else Array.from(n.childNodes).forEach(walk); }; walk(p); });
    all.forEach(t => { let v = t.textContent; map.forEach(([a, b]) => { if (a) v = v.split(a).join(b); }); if (v !== t.textContent) t.textContent = v; });
    // 서식1 안의 일정표·일시표
    ps.slice(s).forEach(p => { const tb = tblOf(p); if (!tb) return; const rs = rows(tb); const c0 = cellText(cells(rs[0])[0]).trim();
      if (c0 === '순' && map.sched) fillTable(tb, 1, rs[1], map.sched.map((r, i) => [String(i + 1), r.t, r.min === '' ? '' : String(r.min), r.c.map(x => /^\s*[◦-]/.test(x) ? x.trim().replace(/^-/, '   -') : '◦ ' + x).join('\n'), r.who || '']));
      if (c0 === '일자' && map.sessions && map.sessions.length === 2) map.sessions.forEach((x, k) => { setCell(cells(rs[0])[k + 1], x.dateStr); setCell(cells(rs[1])[k + 1], x.start + '~' + x.end); setCell(cells(rs[2])[k + 1], (x.region ? x.region + ' 지역 ' : '') + x.target.replace(/초·중등 /, '') + ' ' + x.n + '명'); setCell(cells(rs[3])[k + 1], x.place); });
    });
  }

  async function build(templateBuf, B, extra) {
    const zip = await JSZip.loadAsync(templateBuf);
    const xml = await zip.file('Contents/section0.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const sec = doc.documentElement; const S = sections(B);
    let ps = paras(sec);
    const tt = tblOf(ps[0]); if (tt) { const cp = cellPs(cells(rows(tt)[1])[0]); setP(cp[0], S.title[0] || ''); if (cp[1]) setP(cp[1], S.title[1] || ''); }
    if (S.org && ps[1] && !tblOf(ps[1])) setP(ps[1], S.org);
    fillListTexts(sec, /^1\. 목적/, /^2\. 세부/, (S.s['1'] || []).filter(b => b.k === 'p').map(b => b.text));
    fillSection2B(sec, S.s['2'] || []);
    ps = paras(sec); const bi = find(ps, /^3\. 예산/); const bt = ps.slice(bi + 1).find(p => tblOf(p)); const bb = (S.s['3'] || []).find(b => b.k === 'table'); if (bt && bb) fillBudgetB(tblOf(bt), bb.rows);
    ps = paras(sec); const ci = find(ps, /^4\. 현수막/); const ct = ps.slice(ci + 1).find(p => tblOf(p)); const cb = (S.s['4'] || []).find(b => b.k === 'banner'); if (ct && cb) fillBanner(tblOf(ct), cb.lines);
    fillAdminB(sec, S.s['5'] || []);
    fillListTexts(sec, /^6\. 기대/, /^<서식|^\s*$/, (S.s['6'] || []).filter(b => b.k === 'p').map(b => b.text));
    if (extra && extra.after) replaceAfter(sec, /^<서식/, Object.assign(extra.after.map, { sched: extra.after.sched, sessions: extra.after.sessions }));
    let out = new XMLSerializer().serializeToString(doc);
    if (!/^<\?xml/.test(out)) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + out;
    zip.file('Contents/section0.xml', out);
    zip.remove('Preview/PrvText.txt'); zip.remove('Preview/PrvImage.png');
    const files = {}; const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
    for (const n of names) files[n] = await zip.file(n).async('uint8array');
    const z2 = new JSZip();
    z2.file('mimetype', files['mimetype'], { compression: 'STORE', createFolders: false });
    names.filter(n => n !== 'mimetype').forEach(n => z2.file(n, files[n], { compression: 'DEFLATE', createFolders: false }));
    return z2.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  }

  // ---------- 보도자료 ----------
  async function buildPress(templateBuf, m) {
    const zip = await JSZip.loadAsync(templateBuf);
    const xml = await zip.file('Contents/section0.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const sec = doc.documentElement; const ps = paras(sec);
    // 머리표
    const ht = tblOf(ps[0]); const byAddr = {}; rows(ht).forEach(tr => cells(tr).forEach(c => { const a = attr(c, 'hp:cellAddr'); byAddr[a.getAttribute('colAddr') + ',' + a.getAttribute('rowAddr')] = c; }));
    if (byAddr['1,0']) { const cp = cellPs(byAddr['1,0']); if (cp[1]) setP(cp[1], m.dateStr); else setCell(byAddr['1,0'], '보도자료\n' + m.dateStr); }
    if (byAddr['3,2']) setCell(byAddr['3,2'], '담당자 ' + m.officer + '\n(☎' + m.officerTel + ')');
    if (byAddr['2,3']) setP(cellPs(byAddr['2,3'])[0], '   ￭총 ' + m.pages + '쪽    ￭사진: ' + m.photos + '매(16:00 제공)');
    // 제목 상자
    const tt = tblOf(ps[1]); const tp = cellPs(cells(rows(tt)[0])[0]); setP(tp[0], '“ ' + m.title + ' ”'); if (tp[1]) setP(tp[1], m.sub);
    // 본문: 기존 본문 문단을 본으로 삼아 다시 만듦
    const body = ps.slice(2); const tplFirst = body.find(p => /^□/.test(ptext(p))) || body[1];
    const tplNext = body.find(p => /^\s[^□\s]/.test(ptext(p)) && p !== tplFirst) || tplFirst; const tplBlank = body.find(p => ptext(p).trim() === '') || body[0];
    const blank0 = body[0].cloneNode(true), f0 = tplFirst.cloneNode(true), n0 = tplNext.cloneNode(true), b0 = tplBlank.cloneNode(true);
    body.forEach(removeP);
    const add = (tpl, text) => { const c = tpl.cloneNode(true); setP(c, text); sec.appendChild(c); };
    add(blank0, '');
    m.paras.forEach((blk, i) => { if (i) add(b0, ''); blk.split('\n').map(s => s.trim()).filter(Boolean).forEach((line, k) => add(k ? n0 : f0, k ? ' ' + line : '□ ' + line)); });
    let out = new XMLSerializer().serializeToString(doc);
    if (!/^<\?xml/.test(out)) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + out;
    zip.file('Contents/section0.xml', out); zip.remove('Preview/PrvText.txt'); zip.remove('Preview/PrvImage.png');
    const files = {}; const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
    for (const n of names) files[n] = await zip.file(n).async('uint8array');
    const z2 = new JSZip(); z2.file('mimetype', files['mimetype'], { compression: 'STORE', createFolders: false });
    names.filter(n => n !== 'mimetype').forEach(n => z2.file(n, files[n], { compression: 'DEFLATE', createFolders: false }));
    return z2.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  }
  // ---------- 등록부 ----------
  // m = { title, blocks: [{ dateStr, place, cols, rows: [[...]] }] }
  async function buildReg(templateBuf, m) {
    const zip = await JSZip.loadAsync(templateBuf);
    const xml = await zip.file('Contents/section0.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const sec = doc.documentElement; const ps = paras(sec);
    const isTitle = p => { const t = tblOf(p); return t && t.getAttribute('colCnt') === '4' && rows(t).length === 3; };
    const starts = []; ps.forEach((p, i) => { if (isTitle(p)) starts.push(i); });
    const tpls = starts.map((s, k) => { const blk = ps.slice(s, k + 1 < starts.length ? starts[k + 1] : ps.length); const ti = blk.findIndex(p => tblOf(p) && !isTitle(p)); const tbl = tblOf(blk[ti]); return { head: blk.slice(0, ti), tableP: blk[ti], cols: +tbl.getAttribute('colCnt'), secRun: q(ps[0], 'hp:run')[0] }; });
    // 필요한 열 수의 표가 양식에 없으면(예: 학부모 등록부의 내빈 표) 소속 열 옆에 '직책' 열을 하나 만들어 씀
    function derive(base, cols) {
      const tp = base.tableP.cloneNode(true); const tbl = tblOf(tp);
      rows(tbl).forEach((tr, ri) => { const cs = cells(tr); const src = cs[1]; const c = src.cloneNode(true); const sz = attr(src, 'hp:cellSz'), w = +sz.getAttribute('width'); sz.setAttribute('width', Math.round(w * 0.55)); attr(c, 'hp:cellSz').setAttribute('width', w - Math.round(w * 0.55)); tr.insertBefore(c, src.nextSibling); cells(tr).forEach((x, i) => attr(x, 'hp:cellAddr').setAttribute('colAddr', String(i))); if (ri === 0) setCell(c, '직책'); });
      tbl.setAttribute('colCnt', String(cols));
      return { head: base.head, tableP: tp, cols };
    }
    const pick = cols => tpls.find(t => t.cols === cols) || (tpls.some(t => t.cols === cols - 1) ? derive(tpls.find(t => t.cols === cols - 1), cols) : tpls[0]);
    const secRun = q(ps[0], 'hp:run')[0].cloneNode(true); // 구역 설정은 첫 문단에만
    ps.forEach(removeP);
    const PAGE1 = 14, PAGEN = 20;
    m.blocks.forEach((b, bi) => {
      const T = pick(b.cols);
      T.head.forEach((p, i) => {
        const c = p.cloneNode(true);
        q(c, 'hp:run').forEach(r => { if (q(r, 'hp:secPr').length || q(r, 'hp:ctrl').length) c.removeChild(r); });
        if (i === 0) { if (bi === 0) c.insertBefore(secRun.cloneNode(true), c.firstChild); c.setAttribute('pageBreak', bi === 0 ? '0' : '1'); const tc = cells(rows(tblOf(c))[1])[0]; setCell(tc, m.title); }
        const tx = ptext(c); if (/^○ 일시/.test(tx)) setP(c, '○ 일시: ' + b.dateStr); if (/^○ 장소/.test(tx)) setP(c, '○ 장소: ' + b.place);
        sec.appendChild(c);
      });
      const chunks = []; const rowsAll = b.rows.map((r, i) => [String(i + 1)].concat(r));
      chunks.push(rowsAll.slice(0, PAGE1)); for (let i = PAGE1; i < rowsAll.length; i += PAGEN) chunks.push(rowsAll.slice(i, i + PAGEN));
      chunks.forEach(ch => { const tp = T.tableP.cloneNode(true); const tbl = tblOf(tp); const tplRow = rows(tbl)[1]; fillTable(tbl, 1, tplRow, ch.map(r => r.concat(['', '']).slice(0, T.cols))); sec.appendChild(tp); });
      const blank = T.head[1] ? T.head[1].cloneNode(true) : null; if (blank) { setP(blank, ''); sec.appendChild(blank); }
    });
    // 복제된 표의 id·zOrder를 고유하게
    let id = 1700000000, z = 0; Array.from(sec.getElementsByTagName('hp:tbl')).forEach(tb => { tb.setAttribute('id', String(id++)); tb.setAttribute('zOrder', String(z++)); });
    let out = new XMLSerializer().serializeToString(doc);
    if (!/^<\?xml/.test(out)) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + out;
    zip.file('Contents/section0.xml', out); zip.remove('Preview/PrvText.txt'); zip.remove('Preview/PrvImage.png');
    const files = {}; const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
    for (const n of names) files[n] = await zip.file(n).async('uint8array');
    const z2 = new JSZip(); z2.file('mimetype', files['mimetype'], { compression: 'STORE', createFolders: false });
    names.filter(n => n !== 'mimetype').forEach(n => z2.file(n, files[n], { compression: 'DEFLATE', createFolders: false }));
    return z2.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  }
  return { build, buildPress, buildReg };
})();
