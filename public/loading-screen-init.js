(function () {
  var y = document.getElementById('app-loading-year');
  if (y) y.textContent = String(new Date().getFullYear());
  var lang = 'en';
  try {
    if (localStorage.getItem('safelift3d.lang.en_v1') !== '1') {
      if (localStorage.getItem('safelift3d.lang') === '"vi"') {
        localStorage.removeItem('safelift3d.lang');
      }
      localStorage.setItem('safelift3d.lang.en_v1', '1');
    }
    var savedLang = localStorage.getItem('safelift3d.lang');
    if (savedLang) {
      var cleaned = savedLang.replace(/^"|"$/g, '');
      if (cleaned === 'en' || cleaned === 'vi') lang = cleaned;
    }
  } catch (e) {}
  document.documentElement.lang = lang;
  var status = document.getElementById('app-loading-status');
  var developer = document.getElementById('app-loading-developer');
  if (lang === 'en') {
    if (status) status.textContent = 'Loading Physics Engine…';
    if (developer) developer.textContent = 'Developed by Lê Việt Phương (Mr)';
  } else {
    if (status) status.textContent = 'Đang tải Physics Engine…';
    if (developer) developer.textContent = 'Phát triển bởi Lê Việt Phương (Mr)';
  }
})();
