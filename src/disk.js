// Работа с папкой проекта на диске (File System Access API, Chrome/Edge).

LJ.disk = {
  pick() { return showDirectoryPicker({ mode: 'readwrite' }); },

  async _file(dir, path, create) {
    const parts = path.split('/');
    const name = parts.pop();
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
    return dir.getFileHandle(name, { create });
  },

  // Файл (File) или null, если его нет.
  async file(dir, path) {
    try { return await (await this._file(dir, path, false)).getFile(); }
    catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
  },

  // Текст файла или null, если файла нет.
  async read(dir, path) {
    const f = await this.file(dir, path);
    return f ? f.text() : null;
  },

  async write(dir, path, text) {
    const w = await (await this._file(dir, path, true)).createWritable();
    await w.write(text);
    await w.close();
  },

  stamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`;
  },

  // Кладёт копию текста в backups/ и возвращает путь.
  async backup(dir, text, label) {
    const path = `backups/journal-${this.stamp()}${label ? '-' + label : ''}.html`;
    await this.write(dir, path, text);
    return path;
  },

  // Оставляет в backups/ только последние keep копий (копии "-original" не трогает).
  async prune(dir, keep = 20) {
    try {
      const d = await dir.getDirectoryHandle('backups');
      const names = [];
      for await (const [n, h] of d.entries()) if (h.kind === 'file' && !n.includes('-original')) names.push(n);
      names.sort();
      for (const n of names.slice(0, Math.max(0, names.length - keep))) await d.removeEntry(n);
    } catch (e) { if (e.name !== 'NotFoundError') throw e; }
  }
};
