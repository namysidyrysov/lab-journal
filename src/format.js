// Формат данных lab-journal (версия 2).
//
// {
//   version: 2, title, subtitle,
//   people: ["Иванов И.И.", ...],                      // список фамилий проекта
//   blocks: [
//     { id, type: "experiment", date: "2026-10-27",     // ISO-дата; номер считается автоматически
//       attendees: ["Иванов И.И."],
//       columns: [ { title, text: "<html>", images: [ { path: "images/..", caption } ] } ] },
//     { id, type: "text", text: "<html>", images: [...] }
//   ]
// }
//
// Данные лежат внутри journal.html (блок <script id="lab-journal-data">),
// а страница для чтения собирается из них (см. view.js).

const LJ = {};
LJ.VERSION = 2;
LJ.DEFAULT_COLUMNS = ['Предпосылки', 'Изменения в схеме', 'Результаты', 'Наблюдения и выводы'];
LJ.MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
LJ.MONTHS_SHORT = ['янв.', 'февр.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
LJ.WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

LJ.uid = () => Math.random().toString(36).slice(2, 10);
LJ.esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
LJ.emptyData = () => ({ version: LJ.VERSION, title: 'Лабораторный журнал', subtitle: '', people: [], blocks: [] });

// ---------- даты ----------
const pad2 = n => String(n).padStart(2, '0');
LJ.iso = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
LJ.daysIn = (y, m) => new Date(y, m, 0).getDate();
LJ.parseIso = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
LJ.fmtDate = s => { const p = LJ.parseIso(s); return p ? `${p.d} ${LJ.MONTHS_SHORT[p.m - 1]} ${p.y}` : ''; };
LJ.weekday = s => { const p = LJ.parseIso(s); return p ? LJ.WEEKDAYS[new Date(p.y, p.m - 1, p.d).getDay()] : ''; };
LJ.today = () => { const d = new Date(); return LJ.iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); };

// Номера экспериментов: по дням 1, 2, 3...; если в дне несколько — 12.1, 12.2.
// blocks — в порядке показа. Возвращает { id: "12.1" }.
LJ.numbers = function (blocks) {
  const out = {}; let day = 0, prev = null, group = [];
  const flush = () => group.forEach((id, k) => out[id] = group.length > 1 ? `${day}.${k + 1}` : String(day));
  blocks.filter(b => b.type === 'experiment').forEach(b => {
    if (!b.date || b.date !== prev) { flush(); group = []; day++; prev = b.date; }
    group.push(b.id);
  });
  flush();
  return out;
};

// ---------- очистка HTML ----------
// Убирает опасное (скрипты, onclick=..., javascript:-ссылки) и лишние пробелы.
LJ.tidy = function (html) {
  const t = document.createElement('template');
  t.innerHTML = html || '';
  t.content.querySelectorAll('script,style,iframe,object,embed,link,meta,base,form').forEach(n => n.remove());
  t.content.querySelectorAll('*').forEach(el => {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase(), v = a.value.trim().toLowerCase();
      const bad = v.startsWith('javascript:') || (v.startsWith('data:') && !v.startsWith('data:image/'));
      if (n.startsWith('on') || ((n === 'href' || n === 'src') && bad)) el.removeAttribute(a.name);
    }
  });
  return t.innerHTML.replace(/[ \t]*\n\s*/g, '\n').trim();
};

LJ.imgCount = html => {
  const t = document.createElement('template');
  t.innerHTML = html || '';
  return t.content.querySelectorAll('img').length;
};
LJ.dataImgCount = d => d.blocks.reduce((s, b) => s + (b.type === 'experiment' ? b.columns.reduce((t, c) => t + c.images.length, 0) : b.images.length), 0);

// ---------- миграция v1 -> v2 ----------
// v1: у эксперимента title + date-текст, а в ячейках один HTML с картинками внутри.
LJ.migrate = function (data) {
  if (data.version === 2) return data;
  const MS = { 'янв': 1, 'фев': 2, 'февр': 2, 'мар': 3, 'апр': 4, 'мая': 5, 'май': 5, 'июн': 6, 'июл': 7, 'авг': 8, 'сен': 9, 'сент': 9, 'окт': 10, 'ноя': 11, 'нояб': 11, 'дек': 12 };
  const toIso = s => {
    const m = /(\d{1,2})\s+([а-яё]+)\.?\s+(\d{4})/i.exec(s || '');
    const mo = m && MS[m[2].toLowerCase()];
    return mo ? LJ.iso(+m[3], mo, +m[1]) : '';
  };
  const split = html => {   // текст отдельно, картинки отдельно
    const t = document.createElement('template');
    t.innerHTML = html || '';
    const images = [];
    t.content.querySelectorAll('figure').forEach(f => {
      const i = f.querySelector('img'), cap = (f.querySelector('figcaption')?.textContent || '').trim();
      if (i && i.getAttribute('src')) images.push({ path: i.getAttribute('src'), caption: cap === 'Подпись' ? '' : cap });
      f.remove();
    });
    t.content.querySelectorAll('img').forEach(i => { if (i.getAttribute('src')) images.push({ path: i.getAttribute('src'), caption: '' }); i.remove(); });
    return { text: LJ.tidy(t.innerHTML), images };
  };
  const out = { version: 2, title: data.title || '', subtitle: data.subtitle || '', people: [], blocks: [] };
  (data.blocks || []).forEach(b => {
    if (b.type === 'experiment') out.blocks.push({ id: b.id, type: 'experiment', date: toIso(b.date), attendees: [],
      columns: b.columns.map(c => ({ title: c.title, ...split(c.html) })) });
    else out.blocks.push({ id: b.id, type: 'text', ...split(b.html) });
  });
  Object.defineProperty(out, 'migrated', { value: true });   // не попадает в JSON
  return out;
};

// ---------- чтение journal.html ----------
// Данные журнала или null, если это не журнал lab-journal.
LJ.extract = function (html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const el = d.getElementById('lab-journal-data');
  if (!el) return null;
  let data;
  try { data = JSON.parse(el.textContent); } catch { return null; }
  if (!data || !Array.isArray(data.blocks)) return null;
  if (data.version > LJ.VERSION) throw new Error('Журнал создан более новой версией lab-journal. Обновите программу.');
  data = LJ.migrate(data);
  data.people = data.people || [];
  data.blocks.forEach(b => {
    if (b.type === 'experiment') b.columns.forEach(c => { c.text = LJ.tidy(c.text); c.images = c.images || []; });
    else { b.text = LJ.tidy(b.text); b.images = b.images || []; }
  });
  return data;
};
