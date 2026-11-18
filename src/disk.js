// Работа с папкой проекта на диске (File System Access API, Chrome/Edge).

LJ.disk = {
  pick() { return showDirectoryPicker({ mode: 'readwrite' }); },

  async _file(dir, path, create) {
    const parts = path.split('/');
    const name = parts.pop();
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
    return dir.getFileHandle(name, { create });
  },

  // Текст файла или null, если файла нет.
  async read(dir, path) {
    try { return await (await (await this._file(dir, path, false)).getFile()).text(); }
    catch (e) { if (e.name === 'NotFoundError') return null; throw e; }
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
  }
};
