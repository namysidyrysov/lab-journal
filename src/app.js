// Шаг 1: только проверка, что браузер подходит.
const check = document.getElementById('check');
if (window.showDirectoryPicker) {
  check.textContent = '✓ Браузер подходит. Каркас работает.';
  check.className = 'ok';
} else {
  check.textContent = '✗ Нужен Chrome или Edge: этот браузер не умеет работать с папками.';
  check.className = 'bad';
}
