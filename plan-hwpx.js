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

  // 가·나·다 목록을 template 문단 하나로 다시 만듦
  function fillList(sec, headerRe, stopRe, items) {
    let ps = paras(sec); const h = find(ps, headerRe); if (h < 0) return;
    let end = find(ps, stopRe, h + 1); if (end < 0) end = ps.length;
    const old = ps.slice(h + 1, end).filter(p => ptext(p).trim() !== '' && !tblOf(p));
    if (!old.length) return;
    let ref = old[0]; items.forEach((t, i) => { ref = cloneAfter(ref, '  ' + GA[i] + '. ' + t); });
    old.forEach(removeP);
  }

  // 세부 추진 계획 (가. 일시~ 세부 운영 일정) 을 다시 씀
  function fillSection2(sec, m) {
    let ps = paras(sec); const h = find(ps, /^2\. 세부/); const i1 = find(ps, /가\. 일시/, h);
    const end = find(ps, /^3\. 예산/, h);
    const tblP = ps.slice(i1 + 1, end).find(p => tblOf(p) && rows(tblOf(p)).length === 3); // 일시·대상·장소 표
    const noteP = ps.slice(i1, end).find(p => /^※/.test(ptext(p).trim()));
    const themeP = ps.slice(i1, end).find(p => /연수 주제/.test(ptext(p)));
    const lectP = ps.slice(i1, end).find(p => /연수 강사/.test(ptext(p)));
    const schedP = ps.slice(i1, end).find(p => /세부 운영 일정/.test(ptext(p)));
    const schedT = ps.slice(i1, end).find(p => tblOf(p) && cellText(cells(rows(tblOf(p))[0])[0]).trim() === '순');
    const ss = m.sessions;
    if (m.type !== 'coach' && ss.length === 2 && tblP) {
      const rs = rows(tblOf(tblP));
      ss.forEach((s, k) => {
        setCell(cells(rs[0])[k + 1], s.dateStr + ' ' + s.start + '~' + s.end);
        setCell(cells(rs[1])[k + 1], (s.region ? s.region + ' 지역\n' : '') + s.target + ' ' + s.n + '명');
        setCell(cells(rs[2])[k + 1], s.place);
      });
      setP(ps[i1], '  가. 일시·대상·장소');
      if (noteP) { if (m.targetNote) setP(noteP, '※ ' + m.targetNote); else removeP(noteP); }
    } else {
      // 줄 형식: 가. 일시 / 나. 장소 / 다. 대상
      const s0 = ss[0];
      setP(ps[i1], '  가. 일시: ' + ss.map(s => s.dateStr + ' ' + s.start + '~' + (m.type === 'coach' ? '' : s.end)).join(', '));
      let ref = ps[i1];
      ref = cloneAfter(ref, '  나. 장소: ' + ss.map(s => s.place).join(' / '));
      ref = cloneAfter(ref, '  다. 대상: ' + (m.type === 'coach' ? s0.target + ' ' + s0.n + '명(총 ' + (s0.n + (s0.other || 0)) + '명)' : ss.map(s => (s.region ? s.region + ' 지역 ' : '') + s.target + ' ' + s.n + '명').join(', ')));
      if (m.targetNote) ref = cloneAfter(ref, '    ※ ' + m.targetNote);
      if (tblP) removeP(tblP); if (noteP) removeP(noteP);
      if (m.type === 'coach' && themeP) removeP(themeP);
    }
    if (m.type !== 'coach' && themeP) setP(themeP, '  나. 연수 주제: ' + m.theme);
    if (lectP) { if (m.lectStr) setP(lectP, '  다. 연수 강사: ' + m.lectStr); else removeP(lectP); }
    if (schedP) setP(schedP, '  라. 세부 운영 일정(단, 사정에 따라 변경될 수 있음)');
    // 가·나·다 번호 다시 매김
    ps = paras(sec); const a = find(ps, /^2\. 세부/), b = find(ps, /^3\. 예산/, a); let n = 0;
    ps.slice(a + 1, b).forEach(p => { const t = ptext(p); const mm = t.match(/^(\s*)[가-힣]\. (.*)$/); if (mm && !tblOf(p)) { setP(p, mm[1] + GA[n++] + '. ' + mm[2]); } });
    if (schedT) fillSchedule(tblOf(schedT), m.sched);
  }
  function fillSchedule(tbl, sched) {
    const rs = rows(tbl); const tpl = rs[1];
    fillTable(tbl, 1, tpl, sched.map((r, i) => [String(i + 1), r.t, r.min === '' ? '' : String(r.min), r.c.map(x => x.startsWith('◦') ? x : '◦ ' + x).join('\n'), r.who || '']));
  }
  function fillBudget(tbl, bud, total) {
    const rs = rows(tbl); const head = rs[0];
    const pairA = rs.find(r => cells(r).length === 7), pairB = pairA && rows(tbl)[rows(tbl).indexOf(pairA) + 1];
    const simple = rs.find(r => cells(r).length === 6 && attr(cells(r)[0], 'hp:cellSpan').getAttribute('colSpan') === '1');
    const totalRow = rs[rs.length - 1];
    const out = []; let n = 0;
    for (let i = 0; i < bud.length; i++) {
      const b = bud[i], nx = bud[i + 1];
      if (pairA && pairB && /강사비/.test(b.item) && nx && /강사비/.test(nx.item)) {
        const A = pairA.cloneNode(true), B = pairB.cloneNode(true);
        [String(++n), b.mok, '강사비', (b.item.match(/\((.*)\)/) || [, '기본'])[1], b.calc, b.amtStr2, b.note || nx.note || ''].forEach((v, k) => setCell(cells(A)[k], v));
        [(nx.item.match(/\((.*)\)/) || [, '초과'])[1], nx.calc].forEach((v, k) => setCell(cells(B)[k], v));
        out.push(A, B); i++;
      } else {
        const R = (simple || pairA).cloneNode(true);
        [String(++n), b.mok, b.item.replace(/\(.*\)/, ''), b.calc, b.amtStr, b.note || ''].forEach((v, k) => { if (cells(R)[k]) setCell(cells(R)[k], v); });
        out.push(R);
      }
    }
    const T = totalRow.cloneNode(true); setCell(cells(T)[1], total);
    rows(tbl).slice(1).forEach(r => tbl.removeChild(r));
    let r = 1; out.concat([T]).forEach(tr => { setAddr(tr, r); const sp = cells(tr).map(c => attr(c, 'hp:cellSpan')); r += 1; tbl.appendChild(tr); });
    // 강사비 두 줄은 rowSpan 2 → 두 번째 줄 주소 보정
    let addr = 1; rows(tbl).slice(1).forEach(tr => { setAddr(tr, addr++); });
    setRowCnt(tbl);
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
      if (c0 === '순' && map.sched) fillTable(tb, 1, rs[1], map.sched.map((r, i) => [String(i + 1), r.t, r.min === '' ? '' : String(r.min), r.c.map(x => x.startsWith('◦') ? x : '◦ ' + x).join('\n'), r.who || '']));
      if (c0 === '일자' && map.sessions && map.sessions.length === 2) map.sessions.forEach((x, k) => { setCell(cells(rs[0])[k + 1], x.dateStr); setCell(cells(rs[1])[k + 1], x.start + '~' + x.end); setCell(cells(rs[2])[k + 1], (x.region ? x.region + ' 지역 ' : '') + x.target.replace(/초·중등 /, '') + ' ' + x.n + '명'); setCell(cells(rs[3])[k + 1], x.place); });
    });
  }

  async function build(templateBuf, m) {
    const zip = await JSZip.loadAsync(templateBuf);
    const xml = await zip.file('Contents/section0.xml').async('string');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const sec = doc.documentElement;
    let ps = paras(sec);
    // 제목 상자
    const tt = tblOf(ps[0]); if (tt) { const tc = cells(rows(tt)[1])[0]; const cp = cellPs(tc); setP(cp[0], m.year + ' 경산기초학력거점지원센터'); if (cp[1]) setP(cp[1], m.titleLine2); }
    fillList(sec, /^1\. 목적/, /^2\. 세부/, m.purposes);
    fillSection2(sec, m);
    ps = paras(sec); const bi = find(ps, /^3\. 예산/); const bt = ps.slice(bi + 1).find(p => tblOf(p)); if (bt) fillBudget(tblOf(bt), m.budget, m.totalStr);
    ps = paras(sec); const ci = find(ps, /^4\. 현수막/); const ct = ps.slice(ci + 1).find(p => tblOf(p)); if (ct) fillBanner(tblOf(ct), m.banner);
    fillAdmin(sec, m);
    fillList(sec, /^6\. 기대/, /^<서식|^\s*$/, m.effects);
    if (m.after) replaceAfter(sec, /^<서식/, Object.assign(m.after.map, { sched: m.after.sched, sessions: m.sessions }));
    let out = new XMLSerializer().serializeToString(doc);
    if (!/^<\?xml/.test(out)) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + out;
    zip.file('Contents/section0.xml', out);
    zip.remove('Preview/PrvText.txt'); zip.remove('Preview/PrvImage.png');
    // mimetype은 압축 없이 맨 앞에
    const files = {}; const names = Object.keys(zip.files).filter(n => !zip.files[n].dir);
    for (const n of names) files[n] = await zip.file(n).async('uint8array');
    const z2 = new JSZip();
    z2.file('mimetype', files['mimetype'], { compression: 'STORE', createFolders: false });
    names.filter(n => n !== 'mimetype').forEach(n => z2.file(n, files[n], { compression: 'DEFLATE', createFolders: false }));
    return z2.generateAsync({ type: 'blob', mimeType: 'application/hwp+zip' });
  }
  return { build };
})();
