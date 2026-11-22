// Импорт журнала самого первого вида (таблица .lab-table со строками .exp-header-row).
// Собираем данные в формате v1 и переводим в актуальный через LJ.migrate.

LJ.importLegacy = function (html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const v1 = {
    version: 1,
    title: d.querySelector('h1')?.textContent.trim() || 'Лабораторный журнал',
    subtitle: d.querySelector('.subtitle')?.textContent.trim() || '',
    blocks: []
  };
  const labels = [...d.querySelectorAll('thead th')].map(t => t.textContent.trim());
  const rows = [...d.querySelectorAll('tbody tr')];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.classList.contains('exp-header-row') || !rows[i + 1]) continue;
    const text = r.textContent.replace(/\s+/g, ' ').trim();   // «Эксперимент № 1 Дата: 27 окт. 2026»
    const m = text.match(/^(.*?)\s*Дата:\s*(.*)$/);
    v1.blocks.push({
      id: LJ.uid(), type: 'experiment',
      title: m ? m[1] : text, date: m ? m[2] : '',
      columns: [...rows[++i].children].map((td, k) => ({ title: labels[k] || '', html: LJ.tidy(td.innerHTML) }))
    });
  }
  return { data: LJ.migrate(v1), imgsInSource: [...d.querySelectorAll('img')].filter(i => !i.closest('.lightbox')).length };
};
