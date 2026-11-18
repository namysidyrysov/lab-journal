// Импорт журнала старого формата (таблица .lab-table с строками .exp-header-row).

LJ.importLegacy = function (html) {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const data = LJ.emptyData();
  data.title = d.querySelector('h1')?.textContent.trim() || data.title;
  data.subtitle = d.querySelector('.subtitle')?.textContent.trim() || '';
  const labels = [...d.querySelectorAll('thead th')].map(t => t.textContent.trim());
  const rows = [...d.querySelectorAll('tbody tr')];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r.classList.contains('exp-header-row') || !rows[i + 1]) continue;
    const text = r.textContent.replace(/\s+/g, ' ').trim();   // «Эксперимент № 1 Дата: 27 окт. 2026»
    const m = text.match(/^(.*?)\s*Дата:\s*(.*)$/);
    data.blocks.push({
      id: LJ.uid(),
      type: 'experiment',
      title: m ? m[1] : text,
      date: m ? m[2] : '',
      columns: [...rows[++i].children].map((td, k) => ({ title: labels[k] || '', html: LJ.tidy(td.innerHTML) }))
    });
  }
  return { data, imgsInSource: [...d.querySelectorAll('img')].filter(i => !i.closest('.lightbox')).length };
};
