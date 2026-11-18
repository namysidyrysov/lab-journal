// Формат данных lab-journal (версия 1).
//
// {
//   version: 1, title: "...", subtitle: "...",
//   blocks: [
//     { id, type: "experiment", title: "Эксперимент № 1", date: "27 окт. 2026",
//       columns: [ { title: "Предпосылки", html: "..." }, ... ] },
//     { id, type: "text", html: "..." }
//   ]
// }
//
// Данные хранятся внутри journal.html (блок <script id="lab-journal-data">),
// а сама страница для чтения собирается из них (см. view.js).

const LJ = {};
LJ.VERSION = 1;
LJ.DEFAULT_COLUMNS = ['Предпосылки', 'Изменения в схеме', 'Результаты', 'Наблюдения и выводы'];

LJ.uid = () => Math.random().toString(36).slice(2, 10);
LJ.esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
LJ.emptyData = () => ({ version: LJ.VERSION, title: 'Лабораторный журнал', subtitle: '', blocks: [] });

// Убирает из HTML всё опасное (скрипты, onclick=..., javascript:-ссылки) и лишние пробелы.
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

// Достаёт данные из journal.html. null — если это не журнал lab-journal.
LJ.extract = function (html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const el = d.getElementById('lab-journal-data');
  if (!el) return null;
  let data;
  try { data = JSON.parse(el.textContent); } catch { return null; }
  if (!data || !Array.isArray(data.blocks)) return null;
  if (data.version > LJ.VERSION) throw new Error('Журнал создан более новой версией lab-journal. Обновите программу.');
  data.blocks.forEach(b => {
    if (b.type === 'experiment') b.columns.forEach(c => c.html = LJ.tidy(c.html));
    else b.html = LJ.tidy(b.html);
  });
  return data;
};
