// Редактор: одна длинная страница, автосохранение в папку проекта.
// Эксперимент = дата + участники + колонки; в колонке отдельно текст и картинки.

const Editor = (() => {
  const $ = id => document.getElementById(id);
  const doc = $('doc'), T = $('T'), S = $('S'), root = $('editor'), esc = LJ.esc;
  const ed = { dir: null, ver: 0, saving: false, again: false, timer: null, lastText: null, lastBackup: 0, people: [] };
  let lastBlock = null, tocTimer = null;
  document.execCommand('defaultParagraphSeparator', false, 'p');

  const isImg = f => f.type.startsWith('image/');
  const swap = (a, b) => { const m = document.createComment(''); a.replaceWith(m); b.replaceWith(a); m.replaceWith(b); };
  const arm = r => r.querySelectorAll('.ed').forEach(e => e.contentEditable = true);
  const exps = () => [...doc.querySelectorAll(':scope>.exp')];

  // ---------- построение блоков ----------
  const TOOLS = '<div class="tools" contenteditable="false"><button data-a="up" title="Выше">↑</button><button data-a="down" title="Ниже">↓</button><button data-a="del" title="Удалить блок">✕</button></div>';
  const ZONE = '<div class="zone" tabindex="0"><div class="imgs"></div><div class="zhint">Область для картинок: перетащите файлы сюда или нажмите Ctrl+V</div>' +
    '<div class="zbtns"><button data-a="imgfile">📁 Из устройства</button><button data-a="imgclip">📋 Из буфера</button></div></div>';

  function mkImg(i) {
    const f = document.createElement('figure');
    f.className = 'im'; f.dataset.path = i.path;
    f.innerHTML = '<img alt=""><div class="imtools"><button data-a="iu" title="Выше">↑</button><button data-a="id" title="Ниже">↓</button><button data-a="ix" title="Удалить картинку">✕</button></div>' +
      `<input class="cap" type="text" placeholder="Подпись (необязательно)" value="${esc(i.caption || '')}">`;
    if (i.url) f.querySelector('img').src = i.url;
    return f;
  }
  function mkCol(c) {
    const d = document.createElement('div');
    d.className = 'col';
    d.innerHTML = `<div class="colhead"><div class="lbl ed plain" data-ph="Название колонки">${esc(c.title)}</div>` +
      '<div class="coltools"><button data-a="cl" title="Влево">←</button><button data-a="cr" title="Вправо">→</button><button data-a="cx" title="Удалить колонку">✕</button></div></div>' +
      `<div class="desc ed" data-ph="Текстовое описание…">${c.text}</div>` + ZONE;
    c.images.forEach(i => d.querySelector('.imgs').append(mkImg(i)));
    arm(d); return d;
  }
  function mkExp(o) {
    const b = document.createElement('section');
    b.className = 'blk exp'; b.dataset.id = o.id || LJ.uid(); b.dataset.date = o.date || ''; b._who = [...(o.attendees || [])];
    b.innerHTML = TOOLS + '<div class="exp-h"><div class="line1"><span class="num"></span>' +
      '<button class="lnk" data-a="meta" title="Изменить дату и участников"><span class="dt"></span> <span class="wd"></span> ✎</button></div>' +
      '<div class="who">Присутствовали: <span class="wn"></span> <button class="lnk" data-a="meta">изменить</button></div></div>' +
      '<div class="cols"></div><div class="addcol"><button data-a="addc">+ Добавить колонку</button></div>';
    const cols = b.querySelector('.cols');
    o.columns.forEach(c => cols.append(mkCol(c)));
    cols.style.setProperty('--n', o.columns.length);
    refreshHeader(b);
    return b;
  }
  function mkText(o) {
    const b = document.createElement('section');
    b.className = 'blk txt'; b.dataset.id = o.id || LJ.uid();
    b.innerHTML = TOOLS + `<div class="desc ed" data-ph="Текст…">${o.text}</div>` + ZONE;
    o.images.forEach(i => b.querySelector('.imgs').append(mkImg(i)));
    arm(b); return b;
  }
  function refreshHeader(b) {
    const d = b.dataset.date;
    b.querySelector('.dt').textContent = LJ.fmtDate(d) || 'Дата не задана';
    b.querySelector('.wd').textContent = d ? `(${LJ.weekday(d)})` : '';
    b.querySelector('.wn').textContent = b._who.join(', ') || 'не указаны';
  }

  // ---------- порядок и номера ----------
  // Эксперименты всегда по дате (внутри дня — как стоят); текстовые блоки остаются на своих местах.
  function sortExps() {
    const all = [...doc.children], slots = [], list = [];
    all.forEach((b, i) => { if (b.classList.contains('exp')) { slots.push(i); list.push(b); } });
    const sorted = list.map((b, i) => ({ b, i }))
      .sort((x, y) => (x.b.dataset.date || '9999').localeCompare(y.b.dataset.date || '9999') || x.i - y.i).map(o => o.b);
    if (sorted.every((b, i) => b === list[i])) return;
    const out = all.slice(); slots.forEach((pos, k) => out[pos] = sorted[k]);
    out.forEach(b => doc.append(b));
  }
  function settle() {
    sortExps();
    const nums = LJ.numbers([...doc.querySelectorAll(':scope>.blk')].map(b => ({ id: b.dataset.id, type: b.classList.contains('exp') ? 'experiment' : 'text', date: b.dataset.date || '' })));
    const list = exps();
    list.forEach((b, i) => {
      b.querySelector('.num').textContent = '№ ' + nums[b.dataset.id];
      const same = k => b.dataset.date && list[k] && list[k].dataset.date === b.dataset.date;
      b.querySelector('[data-a=up]').disabled = !same(i - 1);
      b.querySelector('[data-a=down]').disabled = !same(i + 1);
    });
    toc();
  }
  function toc() {
    const nav = $('toclist'); nav.innerHTML = '';
    doc.querySelectorAll(':scope>.blk').forEach(b => {
      const a = document.createElement('a');
      a.textContent = b.classList.contains('exp')
        ? `${b.querySelector('.num').textContent} · ${LJ.fmtDate(b.dataset.date) || 'без даты'}`
        : 'Текст: ' + (b.querySelector('.desc').innerText.replace(/\s+/g, ' ').trim().slice(0, 26) || 'пусто');
      a.onclick = () => { b.scrollIntoView({ behavior: 'smooth', block: 'start' }); $('toc').classList.remove('open'); };
      nav.append(a);
    });
  }

  // ---------- диалог: дата и участники ----------
  function askMeta(init, isNew) {
    return new Promise(resolve => {
      const dlg = $('dlg'), chosen = new Set(init.attendees);
      const p = LJ.parseIso(init.date), yNow = new Date().getFullYear(), y0 = p ? p.y : yNow;
      const years = []; for (let y = Math.min(yNow - 3, y0); y <= Math.max(yNow + 2, y0); y++) years.push(y);
      dlg.innerHTML = `<h3>${isNew ? 'Новый эксперимент' : 'Дата и участники'}</h3>` +
        '<div class="drow"><div class="dhead"><label>Дата</label><button type="button" id="dt">Сегодня</button></div><div class="dfield">' +
        `<input id="dd" type="number" min="1" max="31" placeholder="день" value="${p ? p.d : ''}">` +
        `<select id="dm"><option value="">месяц</option>${LJ.MONTHS.map((m, i) => `<option value="${i + 1}"${p && p.m === i + 1 ? ' selected' : ''}>${m}</option>`).join('')}</select>` +
        `<select id="dy">${years.map(y => `<option${y === y0 ? ' selected' : ''}>${y}</option>`).join('')}</select>` +
        '<b id="dw"></b></div></div>' +
        '<div class="drow"><label>Присутствовали</label><div id="dp"></div>' +
        '<div class="dadd"><input id="dn" type="text" placeholder="Новая фамилия, например Иванов И.И."><button type="button" id="da">Добавить</button></div></div>' +
        '<p id="dh"></p><div class="dact"><button type="button" id="dc">Отмена</button>' +
        `<button type="button" id="dk" class="btn">${isNew ? 'Создать' : 'Готово'}</button></div>`;
      const q = s => dlg.querySelector(s), dd = q('#dd'), dm = q('#dm'), dy = q('#dy'), dk = q('#dk'), dn = q('#dn');
      const names = () => [...ed.people, ...[...chosen].filter(n => !ed.people.includes(n))];
      const list = () => {
        q('#dp').innerHTML = names().map((n, i) => `<div class="pp"><label><input type="checkbox" data-i="${i}"${chosen.has(n) ? ' checked' : ''}> ${esc(n)}</label>` +
          `<button type="button" data-x="${i}" title="Убрать из списка">✕</button></div>`).join('') || '<div class="muted">Список пуст. Добавьте фамилии ниже.</div>';
      };
      const val = () => {
        const d = +dd.value, m = +dm.value, y = +dy.value;
        return d && m && y && d >= 1 && d <= LJ.daysIn(y, m) ? LJ.iso(y, m, d) : null;
      };
      const upd = () => {
        const iso = val();
        q('#dw').textContent = iso ? `(${LJ.weekday(iso)})` : '';
        q('#dh').textContent = dd.value && dm.value && !iso ? 'В этом месяце нет такого числа.'
          : !iso ? 'Укажите дату.' : !chosen.size ? 'Отметьте хотя бы одного участника.' : '';
        dk.disabled = !(iso && chosen.size);
      };
      const addPerson = () => {
        const v = dn.value.trim().replace(/\s+/g, ' ');
        if (!v) return;
        if (!names().includes(v)) { ed.people.push(v); touch(); }
        chosen.add(v); dn.value = ''; list(); upd();
      };
      let done = false;
      const finish = r => { if (done) return; done = true; dlg.close(); resolve(r); };
      dlg.oncancel = () => { done = true; resolve(null); };
      q('#dp').onchange = e => { const n = names()[+e.target.dataset.i]; e.target.checked ? chosen.add(n) : chosen.delete(n); upd(); };
      q('#dp').onclick = e => {
        const i = e.target.dataset.x; if (i === undefined) return;
        const n = names()[+i];
        if (!confirm(`Убрать «${n}» из списка? В уже записанных экспериментах фамилия сохранится.`)) return;
        ed.people = ed.people.filter(x => x !== n); chosen.delete(n); touch(); list(); upd();
      };
      q('#dt').onclick = () => { const t = LJ.parseIso(LJ.today()); dd.value = t.d; dm.value = t.m; dy.value = t.y; upd(); };
      q('#da').onclick = addPerson;
      dn.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } };
      [dd, dm, dy].forEach(x => x.oninput = upd);
      q('#dc').onclick = () => finish(null);
      dk.onclick = () => finish({ date: val(), attendees: names().filter(n => chosen.has(n)) });
      list(); upd(); dlg.showModal();
    });
  }

  // ---------- картинки ----------
  async function loadImages(r) {
    await Promise.all([...r.querySelectorAll('figure.im')].map(async f => {
      const img = f.querySelector('img');
      if (img.getAttribute('src')) return;
      const file = await LJ.disk.file(ed.dir, f.dataset.path);
      if (file) img.src = URL.createObjectURL(file);
      else { f.classList.add('missing'); img.alt = 'файл не найден: ' + f.dataset.path; }
    }));
  }
  async function saveImage(file) {
    const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }[file.type] || 'png';
    const path = `images/img-${LJ.disk.stamp()}-${LJ.uid().slice(0, 4)}.${ext}`;
    await LJ.disk.write(ed.dir, path, file);       // на диск сразу, не при сохранении
    return { path, url: URL.createObjectURL(file) };
  }
  async function addImages(holder, files) {
    const box = holder.querySelector('.imgs');
    for (const f of files) {
      try { box.append(mkImg({ ...(await saveImage(f)), caption: '' })); }
      catch (e) { setSt('⚠ Картинка не записана: ' + e.message, 'bad'); }
    }
    touch();
  }

  // ---------- данные ----------
  function cleanText(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('img,figure').forEach(x => x.remove());
    c.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable'));
    if (!c.textContent.trim() && !c.querySelector('li')) return '';
    return LJ.tidy(c.innerHTML);
  }
  const zoneData = c => ({
    text: cleanText(c.querySelector('.desc')),
    images: [...c.querySelectorAll('figure.im')].map(f => ({ path: f.dataset.path, caption: f.querySelector('.cap').value.trim() }))
  });
  function collect() {
    return {
      version: LJ.VERSION, title: T.textContent.trim(), subtitle: S.textContent.trim(), people: [...ed.people],
      blocks: [...doc.querySelectorAll(':scope>.blk')].map(b => b.classList.contains('exp')
        ? { id: b.dataset.id, type: 'experiment', date: b.dataset.date || '', attendees: [...b._who],
            columns: [...b.querySelectorAll('.col')].map(c => ({ title: c.querySelector('.lbl').textContent.trim(), ...zoneData(c) })) }
        : { id: b.dataset.id, type: 'text', ...zoneData(b) })
    };
  }

  // ---------- сохранение ----------
  const DK = 'lj-draft';
  const draft = (on, data) => { try { on ? localStorage.setItem(DK, JSON.stringify({ project: ed.dir.name, at: Date.now(), data })) : localStorage.removeItem(DK); } catch { } };
  function setSt(t, cls) { $('st').textContent = t; $('st').className = cls || ''; }
  function touch() {
    ed.ver++; setSt('Изменения…');
    clearTimeout(ed.timer); ed.timer = setTimeout(save, 1500);
    clearTimeout(tocTimer); tocTimer = setTimeout(toc, 400);
  }
  async function save() {
    if (!ed.dir) return;
    clearTimeout(ed.timer);
    if (ed.saving) { ed.again = true; return; }
    ed.saving = true;
    const v = ed.ver;
    try {
      const data = collect();
      draft(true, data);                           // запасной вариант, если запись на диск не удастся
      const html = LJ.serialize(data);
      // Копия предыдущей версии: при первом сохранении за сеанс и далее раз в 10 минут.
      if (Date.now() - ed.lastBackup > 600000) {
        if (ed.lastText) { await LJ.disk.backup(ed.dir, ed.lastText); await LJ.disk.prune(ed.dir); }
        ed.lastBackup = Date.now();
      }
      await LJ.disk.write(ed.dir, 'journal.html', html);
      ed.lastText = html;
      draft(false);
      if (ed.ver === v) setSt('✓ Сохранено ' + new Date().toLocaleTimeString('ru-RU'), 'ok');
    } catch (e) {
      console.error(e);
      setSt('⚠ Не сохранено: ' + (e.message || e) + ' (повтор через 5 с)', 'bad');
      ed.timer = setTimeout(save, 5000);
    } finally {
      ed.saving = false;
      if (ed.again) { ed.again = false; if (ed.ver !== v) save(); }
    }
  }

  // ---------- события ----------
  root.addEventListener('input', touch);
  doc.addEventListener('focusin', e => { lastBlock = e.target.closest('.blk'); });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.closest?.('.plain')) e.preventDefault(); });

  // Картинки из буфера всегда идут в область картинок колонки; текст — только как простой текст.
  root.addEventListener('paste', async e => {
    const t = e.target; if (!t.closest) return;
    const holder = t.closest('.col,.blk.txt');
    const files = [...e.clipboardData.files].filter(isImg);
    if (files.length && holder) { e.preventDefault(); await addImages(holder, files); return; }
    const text = e.clipboardData.getData('text/plain');
    if (t.closest('.plain')) { e.preventDefault(); document.execCommand('insertText', false, text.replace(/\s*\n\s*/g, ' ')); }
    else if (t.closest('.desc')) { e.preventDefault(); document.execCommand('insertText', false, text); }
  });
  // Файл, брошенный мимо области картинок, не должен открываться вместо редактора.
  addEventListener('dragover', e => { if (!root.hidden) { e.preventDefault(); } });
  addEventListener('drop', async e => {
    if (root.hidden) return;
    e.preventDefault();
    const zone = e.target.closest?.('.zone');
    if (zone) await addImages(zone.closest('.col,.blk.txt'), [...e.dataTransfer.files].filter(isImg));
  });

  const lb = document.querySelector('.lightbox');
  lb.onclick = () => lb.classList.remove('open');

  doc.addEventListener('click', async e => {
    const t = e.target;
    if (t.matches('figure.im img')) { lb.firstElementChild.src = t.src; lb.classList.add('open'); return; }
    const a = t.closest('[data-a]')?.dataset.a; if (!a) return;
    const b = t.closest('.blk'), col = t.closest('.col'), cols = b.querySelector('.cols'), fig = t.closest('figure.im');
    const upd = () => { if (cols) cols.style.setProperty('--n', cols.children.length); touch(); settle(); };

    if (a === 'meta') {
      const m = await askMeta({ date: b.dataset.date, attendees: b._who }, false);
      if (m) { b.dataset.date = m.date; b._who = m.attendees; refreshHeader(b); touch(); settle(); }
    } else if (a === 'up' || a === 'down') {
      const l = b.classList.contains('exp') ? exps() : [...doc.children];
      const p = l[l.indexOf(b) + (a === 'up' ? -1 : 1)];
      if (p) { swap(b, p); touch(); settle(); }
    } else if (a === 'del') {
      if (confirm('Удалить блок вместе с содержимым?')) { b.remove(); touch(); settle(); }
    } else if (a === 'cl' || a === 'cr') {
      const p = a === 'cl' ? col.previousElementSibling : col.nextElementSibling;
      if (p) { swap(col, p); touch(); }
    } else if (a === 'cx') {
      if (cols.children.length < 2) { alert('Нельзя удалить единственную колонку.'); return; }
      const has = col.querySelector('.desc').textContent.trim() || col.querySelector('figure.im');
      if (!has || confirm(`Удалить колонку «${col.querySelector('.lbl').textContent.trim()}» вместе с содержимым?`)) { col.remove(); upd(); }
    } else if (a === 'addc') {
      const c = mkCol({ title: 'Новая колонка', text: '', images: [] });
      cols.append(c); upd();
      const l = c.querySelector('.lbl'); l.focus(); document.execCommand('selectAll');
    } else if (a === 'imgfile') {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
      inp.onchange = () => addImages(col || b, [...inp.files]);
      inp.click();
    } else if (a === 'imgclip') {
      try {
        const files = [];
        for (const it of await navigator.clipboard.read()) {
          const type = it.types.find(x => x.startsWith('image/'));
          if (type) files.push(new File([await it.getType(type)], 'clip.' + type.split('/')[1], { type }));
        }
        if (files.length) await addImages(col || b, files); else setSt('В буфере нет картинки');
      } catch (err) { setSt('⚠ Буфер недоступен (' + err.message + '). Попробуйте Ctrl+V.', 'bad'); }
    } else if (a === 'iu' || a === 'id') {
      const p = a === 'iu' ? fig.previousElementSibling : fig.nextElementSibling;
      if (p) { swap(fig, p); touch(); }
    } else if (a === 'ix') { fig.remove(); touch(); }
  });

  $('bar').addEventListener('mousedown', e => e.preventDefault());
  $('bar').addEventListener('click', async e => {
    const t = e.target.closest('button'); if (!t) return;
    const { c, f } = t.dataset;
    if (c === 'h2') document.execCommand('formatBlock', false, document.queryCommandValue('formatBlock') === 'h2' ? 'p' : 'h2');
    else if (c) document.execCommand(c);
    if (f === 'toc') $('toc').classList.toggle('open');
    if (f === 'save') save();
    if (f === 'txt') {
      const b = mkText({ text: '', images: [] });
      lastBlock && doc.contains(lastBlock) ? lastBlock.after(b) : doc.append(b);
      touch(); settle(); b.querySelector('.desc').focus(); b.scrollIntoView({ block: 'center' });
    }
    if (f === 'exp') {
      const m = await askMeta({ date: '', attendees: [] }, true);   // сначала обязательные пункты
      if (!m) return;
      const last = exps().pop();
      const titles = last ? [...last.querySelectorAll('.lbl')].map(l => l.textContent.trim()) : LJ.DEFAULT_COLUMNS;
      const b = mkExp({ date: m.date, attendees: m.attendees, columns: titles.map(title => ({ title, text: '', images: [] })) });
      last ? last.after(b) : doc.append(b);
      touch(); settle(); b.querySelector('.desc').focus(); b.scrollIntoView({ block: 'center' });
    }
  });
  $('tocx').onclick = () => $('toc').classList.remove('open');
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { lb.classList.remove('open'); $('toc').classList.remove('open'); }
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && !root.hidden) { e.preventDefault(); save(); }
  });
  addEventListener('beforeunload', e => { if (!root.hidden && (ed.saving || ed.timer && ed.ver)) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- открыть / закрыть ----------
  async function open(dir, data, text) {
    ed.dir = dir; ed.lastText = text; ed.lastBackup = 0; ed.ver = 0;
    let restored = false;
    try {
      const d = JSON.parse(localStorage.getItem(DK) || 'null');
      if (d && d.project === dir.name && JSON.stringify(d.data) !== JSON.stringify(data) &&
          confirm('Найден несохранённый черновик от ' + new Date(d.at).toLocaleString('ru-RU') + '. Восстановить его?')) { data = LJ.migrate(d.data); restored = true; }
    } catch { }
    if (!restored) draft(false);
    ed.people = [...(data.people || [])];
    $('start').hidden = true; root.hidden = false;
    $('pname2').textContent = dir.name;
    T.textContent = data.title; S.textContent = data.subtitle;
    doc.innerHTML = '';
    data.blocks.forEach(b => doc.append(b.type === 'experiment' ? mkExp(b) : mkText(b)));
    arm(document.querySelector('#editor header'));
    settle(); setSt('');
    await loadImages(doc);
    if (restored || data.migrated) touch();     // обновлённый формат сразу записываем (старая копия уйдёт в backups/)
  }
  async function close() {
    if (ed.timer || ed.ver) await save();
    root.hidden = true; $('start').hidden = false; ed.dir = null;
  }
  return { open, close };
})();
