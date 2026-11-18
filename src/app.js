// Шаг 2: открыть папку проекта, прочитать журнал, при необходимости преобразовать старый формат.

const $ = id => document.getElementById(id);
const state = { dir: null, text: null, data: null };

function msg(text, cls) { const m = $('msg'); m.textContent = text; m.className = cls || ''; }
function fail(e) { console.error(e); msg('Ошибка: ' + (e.message || e), 'bad'); }

if (window.showDirectoryPicker) {
  $('check').textContent = '✓ Браузер подходит.';
  $('check').className = 'ok';
} else {
  $('check').textContent = '✗ Нужен Chrome или Edge: этот браузер не умеет работать с папками.';
  $('check').className = 'bad';
  $('open').disabled = true;
}

function showList(data) {
  const ol = $('plist');
  ol.innerHTML = '';
  data.blocks.forEach(b => {
    const li = document.createElement('li');
    if (b.type === 'experiment') {
      const imgs = b.columns.reduce((s, c) => s + LJ.imgCount(c.html), 0);
      li.textContent = `${b.title}${b.date ? ' · ' + b.date : ''} — колонок: ${b.columns.length}, картинок: ${imgs}`;
    } else li.textContent = 'Текстовый блок';
    ol.append(li);
  });
}

async function load() {
  msg('');
  $('project').hidden = false;
  $('pname').textContent = state.dir.name;
  $('convert').hidden = $('create').hidden = true;
  $('plist').innerHTML = '';
  state.text = await LJ.disk.read(state.dir, 'journal.html');
  if (state.text === null) {
    $('pstate').textContent = 'В этой папке нет journal.html. Можно создать пустой журнал.';
    $('create').hidden = false;
    return;
  }
  const data = LJ.extract(state.text);
  if (data) {
    state.data = data;
    $('pstate').textContent = `Журнал lab-journal. Блоков: ${data.blocks.length}.`;
    showList(data);
    return;
  }
  const { data: legacy, imgsInSource } = LJ.importLegacy(state.text);
  if (!legacy.blocks.length) { $('pstate').textContent = 'Не удалось распознать journal.html.'; return; }
  state.data = legacy;
  const imgsNow = legacy.blocks.reduce((s, b) => s + (b.columns || []).reduce((t, c) => t + LJ.imgCount(c.html), 0), 0);
  $('pstate').textContent = `Найден журнал старого формата: экспериментов ${legacy.blocks.length}. Файл пока не изменён.`;
  showList(legacy);
  $('convert').hidden = false;
  if (imgsNow !== imgsInSource) msg(`⚠ Картинок в файле ${imgsInSource}, при импорте распознано ${imgsNow}. Не преобразуйте, сначала напишите мне.`, 'bad');
}

$('open').onclick = async () => {
  try { state.dir = await LJ.disk.pick(); }
  catch (e) { if (e.name !== 'AbortError') fail(e); return; }
  try { await load(); } catch (e) { fail(e); }
};

$('create').onclick = async () => {
  try {
    await LJ.disk.write(state.dir, 'journal.html', LJ.serialize(LJ.emptyData()));
    await load();
    msg('Пустой журнал создан ✓', 'ok');
  } catch (e) { fail(e); }
};

$('convert').onclick = async () => {
  try {
    const bpath = await LJ.disk.backup(state.dir, state.text, 'original');
    await LJ.disk.write(state.dir, 'journal.html', LJ.serialize(state.data));
    const back = LJ.extract(await LJ.disk.read(state.dir, 'journal.html'));
    if (JSON.stringify(back) !== JSON.stringify(state.data)) throw new Error('Проверка после записи не прошла. Оригинал сохранён: ' + bpath);
    await load();
    msg(`Готово ✓ Копия оригинала: ${bpath}. Откройте journal.html и проверьте.`, 'ok');
  } catch (e) { fail(e); }
};
