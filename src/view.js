// Сборка journal.html — страницы для чтения (стили и увеличение картинок внутри файла).

LJ.VIEW_CSS = `
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0;padding:24px;background:#f5f6f8;color:#222;line-height:1.5}
header,main{max-width:1400px;margin:0 auto}
header{margin-bottom:24px}
h1{margin:0 0 4px;font-size:28px}
.subtitle{margin:0;color:#666}
.blk{background:#fff;border:1px solid #e2e4e8;border-radius:8px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.exp-h{background:#f8fafc;border-bottom:2px solid #e2e4e8;padding:10px 14px;border-radius:8px 8px 0 0}
.line1{display:flex;align-items:baseline;gap:12px;white-space:nowrap;font-size:16px}
.num{font-weight:700}
.date{font-weight:600}
.wd{color:#555}
.who{margin-top:4px;font-size:14px;color:#444}
.cols{display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr))}
.col{padding:12px 14px;border-right:1px solid #e2e4e8;min-width:0}
.col:last-child{border-right:0}
.lbl{font-weight:600;font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:#444;margin-bottom:8px}
.txt{padding:14px 18px}
.desc{overflow-wrap:anywhere}
.imgs{margin-top:10px}
figure{margin:0 0 12px}
figure img{max-width:100%;height:auto;display:block;border-radius:4px;border:1px solid #dde0e4;cursor:zoom-in}
figcaption{font-size:13px;text-align:center;margin-top:6px}
ul,ol{padding-left:22px;margin:6px 0}
p{margin:6px 0}
h2{font-size:20px;margin:10px 0 6px}
.lightbox{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;z-index:1000;padding:24px;cursor:zoom-out}
.lightbox.open{display:flex}
.lightbox img{max-width:95vw;max-height:95vh;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,.5)}
@media(max-width:900px){.cols{grid-template-columns:1fr}.col{border-right:0;border-bottom:1px solid #eef0f3}}
`;

LJ.VIEW_JS = `const lb=document.querySelector('.lightbox');document.querySelectorAll('main img').forEach(i=>i.onclick=()=>{lb.firstElementChild.src=i.src;lb.classList.add('open')});lb.onclick=()=>lb.classList.remove('open');document.onkeydown=e=>{if(e.key==='Escape')lb.classList.remove('open')};`;

// Картинки без подписи показываются без подписи.
LJ.renderImages = imgs => imgs.length
  ? '<div class="imgs">' + imgs.map(i => `<figure><img src="${LJ.esc(i.path)}" alt="">${i.caption ? `<figcaption>${LJ.esc(i.caption)}</figcaption>` : ''}</figure>`).join('') + '</div>'
  : '';

LJ.renderBlock = function (b, num) {
  if (b.type === 'experiment') {
    const wd = LJ.weekday(b.date);
    const head = `<div class="line1"><span class="num">№ ${LJ.esc(num)}</span><span class="date">${LJ.esc(LJ.fmtDate(b.date) || 'Дата не задана')}</span>${wd ? `<span class="wd">(${wd})</span>` : ''}</div>` +
      (b.attendees.length ? `<div class="who">Присутствовали: ${b.attendees.map(LJ.esc).join(', ')}</div>` : '');
    const cols = b.columns.map(c => `<div class="col"><div class="lbl">${LJ.esc(c.title)}</div><div class="desc">${c.text}</div>${LJ.renderImages(c.images)}</div>`).join('\n');
    return `<section class="blk exp" id="${LJ.esc(b.id)}">\n<div class="exp-h">${head}</div>\n<div class="cols" style="--n:${b.columns.length}">\n${cols}\n</div>\n</section>`;
  }
  return `<section class="blk txt" id="${LJ.esc(b.id)}">\n<div class="desc">${b.text}</div>${LJ.renderImages(b.images)}\n</section>`;
};

LJ.serialize = function (data) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const nums = LJ.numbers(data.blocks);
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="generator" content="lab-journal ${LJ.VERSION}">
<title>${LJ.esc(data.title)}</title>
<style>${LJ.VIEW_CSS}</style>
</head>
<body>
<header><h1>${LJ.esc(data.title)}</h1>${data.subtitle ? `<p class="subtitle">${LJ.esc(data.subtitle)}</p>` : ''}</header>
<main>
${data.blocks.map(b => LJ.renderBlock(b, nums[b.id])).join('\n')}
</main>
<div class="lightbox"><img alt=""></div>
<script type="application/json" id="lab-journal-data">${json}</script>
<script>${LJ.VIEW_JS}</script>
</body>
</html>
`;
};
