/* ============================================================
   Модель и состояние
   ============================================================ */
const STORAGE_KEY = 'lab-journal-v1';
const SIDEBAR_KEY = 'lab-journal-sidebar-open';

const MONTHS_RU = ['янв.','февр.','мар.','апр.','мая','июн.',
                   'июл.','авг.','сент.','окт.','нояб.','дек.'];

const state = { experiments: [], activeId: null };

/* ---------- Статус ---------- */
const statusEl = document.getElementById('save-status');
function setStatus(text, cls = '') {
  statusEl.textContent = text;
  statusEl.className = 'save-status ' + cls;
}

/* ---------- Хранилище (только тексты, картинки в папке) ---------- */
async function save() {
  setStatus('● Сохранение…', 'saving');
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    setStatus('✓ Сохранено', 'saved');
  } catch (e) {
    console.error(e);
    setStatus('✕ Ошибка localStorage', 'error');
  }
}

function load() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    state.experiments = (data.experiments || []).map(normalizeExperiment);
  } catch (e) { console.error('Ошибка загрузки:', e); }
}

function normalizeExperiment(e) {
  const fixArr = (arr) => (arr || []).map(it => ({
    id: it.id || uid(),
    path: it.path || it.src || '',
    caption: it.caption || ''
  }));
  return {
    id: e.id || uid(),
    num: e.num || '',
    day: e.day || '',
    month: e.month || (new Date().getMonth() + 1),
    year: e.year || String(new Date().getFullYear()),
    goal: e.goal || '',
    schemeText: e.schemeText || '',
    resultsText: e.resultsText || '',
    conclusions: e.conclusions || '',
    scheme: fixArr(e.scheme),
    results: fixArr(e.results)
  };
}

/* ---------- Утилиты ---------- */
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
function getActive() { return state.experiments.find(e => e.id === state.activeId); }
function debounce(fn, ms = 400) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

function formatDate(exp) {
  const parts = [];
  if (exp.day)   parts.push(exp.day);
  if (exp.month) parts.push(MONTHS_RU[exp.month - 1] || '');
  if (exp.year)  parts.push(exp.year);
  return parts.join(' ').trim();
}

/* ---------- Работа с папкой images/ ---------- */
let imagesDirHandle = null;
let dirPromise = null;

async function requestImagesDir() {
  if (imagesDirHandle) return true;
  if (!window.showDirectoryPicker) {
    alert('Браузер не поддерживает доступ к папкам. Используйте Chrome или Edge.');
    return false;
  }
  
  if (dirPromise) return dirPromise;

  dirPromise = (async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      imagesDirHandle = handle;
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') console.error(err);
      return false;
    } finally {
      dirPromise = null;
    }
  })();
  
  return dirPromise;
}

async function writeImageFile(file, preferredName) {
  if (!imagesDirHandle) throw new Error('Папка images/ не выбрана');

  let name = preferredName;
  let i = 1;
  while (true) {
    try {
      await imagesDirHandle.getFileHandle(name);
      const dot = preferredName.lastIndexOf('.');
      const base = dot > 0 ? preferredName.slice(0, dot) : preferredName;
      const ext = dot > 0 ? preferredName.slice(dot) : '';
      name = `${base}-${i++}${ext}`;
    } catch {
      break;
    }
  }
  const fileHandle = await imagesDirHandle.getFileHandle(name, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();
  return name;
}

function buildFileName(exp, kind, ext) {
  const numPart = (exp.num || 'x').replace(/\D/g, '') || 'x';
  const datePart = [
    exp.year || '',
    String(exp.month || '').padStart(2, '0'),
    String(exp.day || '').padStart(2, '0')
  ].filter(Boolean).join('-') || 'nodate';
  const rand = Math.random().toString(36).slice(2, 6);
  return `exp${numPart}-${kind}-${datePart}-${rand}.${ext}`;
}

function extFromMime(mime) {
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg'
  };
  return map[mime] || 'png';
}

/* ---------- Список ---------- */
const expListEl = document.getElementById('exp-list');

function renderList() {
  expListEl.innerHTML = '';
  state.experiments.forEach(exp => {
    const li = document.createElement('li');
    if (exp.id === state.activeId) li.classList.add('active');
    const dateStr = formatDate(exp) || '(без даты)';
    li.innerHTML = `
      <span class="title">${escapeHtml(exp.num ? '№ ' + exp.num + ' · ' : '')}${escapeHtml(dateStr)}</span>
      <button class="del" title="Удалить">×</button>
    `;
    li.addEventListener('click', (e) => {
      if (e.target.classList.contains('del')) return;
      state.activeId = exp.id;
      renderList(); renderEditor();
      closeSidebar();
    });
    li.querySelector('.del').addEventListener('click', (e) => {
      e.stopPropagation();
      if (!confirm('Удалить этот эксперимент?')) return;
      state.experiments = state.experiments.filter(x => x.id !== exp.id);
      if (state.activeId === exp.id) state.activeId = null;
      save(); renderList(); renderEditor();
    });
    expListEl.appendChild(li);
  });
}

/* ---------- Сайдбар ---------- */
const sidebar = document.getElementById('sidebar');
const backdrop = document.getElementById('sidebar-backdrop');

function openSidebar() {
  sidebar.classList.add('open');
  backdrop.classList.add('open');
  localStorage.setItem(SIDEBAR_KEY, '1');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  backdrop.classList.remove('open');
  localStorage.setItem(SIDEBAR_KEY, '0');
}
document.getElementById('btn-open-sidebar').addEventListener('click', openSidebar);
document.getElementById('btn-close-sidebar').addEventListener('click', closeSidebar);
backdrop.addEventListener('click', closeSidebar);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSidebar(); });

/* ---------- Редактор ---------- */
const editorBody = document.getElementById('editor-body');
const emptyState = document.getElementById('empty-state');

const monthSelect = document.getElementById('f-month');
MONTHS_RU.forEach((name, i) => {
  const opt = document.createElement('option');
  opt.value = i + 1;
  opt.textContent = name;
  monthSelect.appendChild(opt);
});

function renderEditor() {
  const exp = getActive();
  if (!exp) {
    editorBody.hidden = true; emptyState.hidden = false; return;
  }
  editorBody.hidden = false; emptyState.hidden = true;

  document.getElementById('f-num').value = exp.num || '';
  document.getElementById('f-day').value   = exp.day || '';
  monthSelect.value = exp.month || (new Date().getMonth() + 1);
  document.getElementById('f-year').value  = exp.year || String(new Date().getFullYear());

  document.getElementById('f-goal').innerHTML = exp.goal || '';
  document.getElementById('f-scheme-text').innerHTML = exp.schemeText || '';
  document.getElementById('f-results-text').innerHTML = exp.resultsText || '';
  document.getElementById('f-conclusions').innerHTML = exp.conclusions || '';

  renderGallery('f-scheme', exp.scheme);
  renderGallery('f-results', exp.results);
}

/* ---------- Rich-text ---------- */
const richFields = {
  'f-goal':         { key: 'goal' },
  'f-scheme-text':  { key: 'schemeText' },
  'f-results-text': { key: 'resultsText' },
  'f-conclusions':  { key: 'conclusions' }
};

const saveText = debounce(() => {
  const exp = getActive();
  if (!exp) return;
  for (const [id, cfg] of Object.entries(richFields)) {
    exp[cfg.key] = document.getElementById(id).innerHTML;
  }
  save();
});

let activeRichText = document.getElementById('f-goal');

Object.entries(richFields).forEach(([id]) => {
  const el = document.getElementById(id);
  el.addEventListener('input', saveText);
  el.addEventListener('focus', () => { activeRichText = el; });

  el.addEventListener('paste', (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    if (items.some(it => it.type.startsWith('image/'))) {
      e.preventDefault();
      alert('Картинки можно вставлять только в «Схему» и «Результаты».');
    }
  });
  el.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'none';
      el.classList.add('drag-block');
    }
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag-block'));
  el.addEventListener('drop', (e) => {
    if (e.dataTransfer.files.length) {
      e.preventDefault();
      el.classList.remove('drag-block');
      alert('Картинки можно вставлять только в «Схему» и «Результаты».');
    }
  });
});

document.querySelectorAll('.toolbar button').forEach(btn => {
  btn.addEventListener('mousedown', e => e.preventDefault());
  btn.addEventListener('click', () => {
    document.execCommand(btn.dataset.cmd, false, null);
    activeRichText.focus();
    saveText();
  });
});

/* ---------- Мета ---------- */
document.getElementById('f-num').addEventListener('input', debounce(e => {
  const exp = getActive();
  if (!exp) return;
  exp.num = e.target.value;
  save(); renderList();
}));

document.getElementById('f-day').addEventListener('input', debounce(e => {
  const exp = getActive();
  if (!exp) return;
  exp.day = e.target.value.replace(/\D/g, '').slice(0, 2);
  e.target.value = exp.day;
  save(); renderList();
}));

monthSelect.addEventListener('change', () => {
  const exp = getActive();
  if (!exp) return;
  exp.month = Number(monthSelect.value);
  save(); renderList();
});

document.getElementById('f-year').addEventListener('input', debounce(e => {
  const exp = getActive();
  if (!exp) return;
  exp.year = e.target.value.replace(/\D/g, '').slice(0, 4);
  e.target.value = exp.year;
  save(); renderList();
}));

/* ---------- Галереи ---------- */
const galleryEls = { 'f-scheme': 'scheme', 'f-results': 'results' };

function renderGallery(elId, items) {
  const el = document.getElementById(elId);
  el.innerHTML = '';
  el.classList.toggle('has-items', items && items.length > 0);

  if (!items || items.length === 0) {
    const dz = document.createElement('div');
    dz.className = 'gallery-dropzone';
    dz.textContent = 'Область для картинок (пусто)';
    el.appendChild(dz);
    return;
  }

  items.forEach((item, idx) => el.appendChild(makeGalleryItem(elId, item, idx)));

  const dz = document.createElement('div');
  dz.className = 'gallery-dropzone';
  dz.textContent = '+';
  el.appendChild(dz);
}

function makeGalleryItem(elId, item, idx) {
  const fig = document.createElement('figure');
  fig.className = 'gallery-item';
  fig.draggable = true;
  fig.dataset.idx = idx;

  fig.innerHTML = `
    <img src="${item.path}" alt="">
    <figcaption contenteditable="true">${escapeHtml(item.caption || '')}</figcaption>
    <div class="item-actions">
      <button data-act="up" title="Выше">↑</button>
      <button data-act="down" title="Ниже">↓</button>
      <button data-act="del" title="Удалить">×</button>
    </div>
  `;

  const cap = fig.querySelector('figcaption');
  cap.addEventListener('input', debounce(() => {
    const exp = getActive();
    if (!exp) return;
    exp[galleryEls[elId]][idx].caption = cap.textContent;
    save();
  }));

  fig.querySelectorAll('button').forEach(b => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const exp = getActive();
      if (!exp) return;
      const arr = exp[galleryEls[elId]];
      const act = b.dataset.act;
      if (act === 'del') {
        if (!confirm('Убрать картинку из журнала?\n(Файл в папке images/ останется, удалите его вручную.)')) return;
        arr.splice(idx, 1);
      } else if (act === 'up' && idx > 0) {
        [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      } else if (act === 'down' && idx < arr.length - 1) {
        [arr[idx + 1], arr[idx]] = [arr[idx], arr[idx + 1]];
      }
      save(); renderGallery(elId, arr);
    });
  });

  fig.addEventListener('dragstart', (e) => {
    fig.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-item-idx', String(idx));
  });
  fig.addEventListener('dragend', () => fig.classList.remove('dragging'));
  fig.addEventListener('dragover', (e) => { e.preventDefault(); fig.classList.add('drag-over'); });
  fig.addEventListener('dragleave', () => fig.classList.remove('drag-over'));
  fig.addEventListener('drop', (e) => {
    fig.classList.remove('drag-over');
    const fromIdx = e.dataTransfer.getData('text/x-item-idx');
    if (fromIdx === '') return;
    e.preventDefault(); e.stopPropagation();
    reorderItems(elId, Number(fromIdx), idx);
  });

  return fig;
}

function reorderItems(elId, from, to) {
  if (from === to) return;
  const exp = getActive();
  if (!exp) return;
  const arr = exp[galleryEls[elId]];
  const [moved] = arr.splice(from, 1);
  arr.splice(to, 0, moved);
  save(); renderGallery(elId, arr);
}

/* ---------- Добавление файлов ---------- */
async function addImages(elId, files) {
  const exp = getActive();
  if (!exp) return;

  if (!imagesDirHandle) {
    const ok = await requestImagesDir();
    if (!ok) return;
  }

  const images = Array.from(files).filter(f => f.type.startsWith('image/'));
  if (!images.length) return;

  setStatus('● Сохранение картинок…', 'saving');
  const added = [];
  for (const file of images) {
    const ext = extFromMime(file.type);
    const name = buildFileName(exp, galleryEls[elId], ext);
    try {
      const savedName = await writeImageFile(file, name);
      added.push({ id: uid(), path: `images/${savedName}`, caption: '' });
    } catch (err) {
      console.error('Не удалось сохранить картинку:', err);
      alert('Не удалось записать картинку в папку: ' + err.message);
    }
  }

  const arr = exp[galleryEls[elId]];
  arr.push(...added);
  save(); renderGallery(elId, arr);
  setStatus('✓ Сохранено', 'saved');
}

document.querySelectorAll('.btn-insert-from-device').forEach(btn => {
  btn.addEventListener('click', () => {
    const elId = btn.dataset.target;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.addEventListener('change', () => addImages(elId, input.files));
    input.click();
  });
});

document.querySelectorAll('.btn-insert-from-buffer').forEach(btn => {
  btn.addEventListener('click', async () => {
    const elId = btn.dataset.target;
    try {
      if (!navigator.clipboard || !navigator.clipboard.read) throw new Error('нет Clipboard API');
      const items = await navigator.clipboard.read();
      let found = false;
      for (const item of items) {
        const imgType = item.types.find(t => t.startsWith('image/'));
        if (!imgType) continue;
        found = true;
        const blob = await item.getType(imgType);
        const ext = extFromMime(imgType);
        const file = new File([blob], `paste.${ext}`, { type: imgType });
        await addImages(elId, [file]);
      }
      if (!found) {
        alert('В буфере обмена нет картинки. Скопируйте изображение и нажмите снова.');
      }
    } catch (err) {
      alert(
        'Браузер не дал прочитать буфер обмена напрямую.\n\n' +
        'Способ 1: кликните в область для картинок (подсветится синим) и нажмите Ctrl+V.\n' +
        'Способ 2: используйте кнопку «📁 Из устройства».'
      );
    }
  });
});

Object.keys(galleryEls).forEach(elId => {
  const el = document.getElementById(elId);
  el.addEventListener('focus', () => el.classList.add('paste-active'));
  el.addEventListener('blur', () => el.classList.remove('paste-active'));
  el.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      el.classList.add('dragover');
    }
  });
  el.addEventListener('dragleave', (e) => {
    if (e.target === el) el.classList.remove('dragover');
  });
  el.addEventListener('drop', (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault();
    el.classList.remove('dragover');
    addImages(elId, e.dataTransfer.files);
  });
});

document.addEventListener('paste', (e) => {
  const focused = document.activeElement;
  const galleryId = focused && Object.keys(galleryEls).find(id => document.getElementById(id) === focused);
  if (!galleryId) return;
  const items = Array.from(e.clipboardData?.items || []);
  const images = items
    .filter(it => it.type.startsWith('image/'))
    .map(it => it.getAsFile())
    .filter(Boolean);
  if (!images.length) return;
  e.preventDefault();
  addImages(galleryId, images);
});

/* ---------- Новый эксперимент ---------- */
document.getElementById('btn-new').addEventListener('click', () => {
  const now = new Date();
  const exp = {
    id: uid(),
    num: String(state.experiments.length + 1),
    day: String(now.getDate()),
    month: now.getMonth() + 1,
    year: String(now.getFullYear()),
    goal: '', schemeText: '', resultsText: '', conclusions: '',
    scheme: [], results: []
  };
  state.experiments.push(exp);
  state.activeId = exp.id;
  save(); renderList(); renderEditor();
  closeSidebar();
});

/* ---------- Экспорт HTML ---------- */
document.getElementById('btn-export').addEventListener('click', () => {
  const html = buildExportHTML();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'journal.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

function buildExportHTML() {
  const rows = state.experiments.map(exp => {
    const makeImgs = (arr) => (arr || []).map(it => `
      <figure>
        <img src="${it.path}" alt="">
        ${it.caption ? `<figcaption>${escapeHtml(it.caption)}</figcaption>` : ''}
      </figure>
    `).join('') || '<em>—</em>';

    return `
      <tr class="exp-header-row">
        <td colspan="4">
          <strong>Эксперимент № ${escapeHtml(exp.num || '—')}</strong>
          &nbsp;&nbsp;&nbsp;&nbsp; Дата: ${escapeHtml(formatDate(exp) || '—')}
        </td>
      </tr>
      <tr>
        <td class="col-goal">${exp.goal || '<em>—</em>'}</td>
        <td class="col-scheme">
          ${exp.schemeText ? `<div class="text-block">${exp.schemeText}</div>` : ''}
          ${makeImgs(exp.scheme)}
        </td>
        <td class="col-results">
          ${exp.resultsText ? `<div class="text-block">${exp.resultsText}</div>` : ''}
          ${makeImgs(exp.results)}
        </td>
        <td class="col-conclusions">${exp.conclusions || '<em>—</em>'}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Лабораторный журнал</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:24px;background:#f5f6f8;color:#222;line-height:1.5}
  header{max-width:1400px;margin:0 auto 24px}
  h1{margin:0 0 4px;font-size:28px}
  .subtitle{margin:0;color:#666}
  main{max-width:1400px;margin:0 auto}
  
  .lab-table{width:100%;border-collapse:separate;border-spacing:0;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.08);border-radius:0}
  .lab-table th, .lab-table td{border:1px solid #e2e4e8;padding:12px 14px;vertical-align:top;text-align:left}
  
  /* Фикс шапки таблицы (убрали overflow: hidden у таблицы) */
  .lab-table thead th{
    background:#eef1f5; font-weight:600; font-size:14px; 
    text-transform:uppercase; letter-spacing:.03em; color:#444;
    position: sticky; top: 0; z-index: 10;
    border-top: none;
    box-shadow: 0 1px 0 #e2e4e8;
  }
  
  /* Строка с номером и датой */
  .exp-header-row td {
    background: #f8fafc; border-bottom: 2px solid #e2e4e8;
    color: #1e293b; font-size: 15px; padding: 10px 14px;
  }
  
  .col-goal{width:22%}.col-scheme{width:26%}.col-results{width:26%}.col-conclusions{width:26%}
  
  .text-block{margin-bottom:10px}
  figure{margin:0 0 12px}figure:last-child{margin-bottom:0}
  figure img{max-width:100%;height:auto;display:block;border-radius:4px;border:1px solid #dde0e4;cursor:zoom-in}
  figcaption{font-size:13px;color:#111;text-align:center;margin-top:6px}
  ul,ol{padding-left:22px;margin:6px 0}p{margin:6px 0}
  
  .lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:1000;padding:24px;cursor:zoom-out}
  .lightbox.open{display:flex}
  .lightbox img{max-width:95vw;max-height:95vh;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,.5)}
  
  @media(max-width:900px){
    .lab-table,.lab-table thead,.lab-table tbody,.lab-table th,.lab-table td,.lab-table tr{display:block}
    .lab-table thead{display:none}
    .lab-table tr{margin-bottom:16px;border:1px solid #e2e4e8;border-radius:8px;overflow:hidden}
    .lab-table td{border:none;border-bottom:1px solid #eef0f3}
    .lab-table td:last-child{border-bottom:none}
  }
</style>
</head>
<body>
<header>
  <h1>Лабораторный журнал</h1>
  <p class="subtitle">Экспериментальные работы</p>
</header>
<main>
<table class="lab-table">
<thead>
<tr>
<th class="col-goal">Предпосылки</th>
<th class="col-scheme">Изменения с схеме</th>
<th class="col-results">Результаты</th>
<th class="col-conclusions">Наблюдения и выводы</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</main>
<div class="lightbox"><img alt=""></div>
<script>
document.querySelectorAll('.lab-table img').forEach(img=>{
  img.addEventListener('click',()=>{
    const lb=document.querySelector('.lightbox');
    lb.querySelector('img').src=img.src;
    lb.classList.add('open');
  });
});
const lb=document.querySelector('.lightbox');
lb.addEventListener('click',()=>lb.classList.remove('open'));
document.addEventListener('keydown',e=>{if(e.key==='Escape')lb.classList.remove('open')});
</script>
</body>
</html>`;
}

/* ---------- Старт ---------- */
load();
renderList();
renderEditor();

if (localStorage.getItem(SIDEBAR_KEY) === '1') openSidebar();
setStatus('✓ Готово', 'saved');