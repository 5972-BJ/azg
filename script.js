// ===== AZG 公共脚本 =====

// 后端地址（本地后端默认跑在 3000 端口）
var API_BASE = 'http://localhost:3000';

// ---------- 顶部标签栏（由各页面的 PAGES / CURRENT 驱动） ----------
(function () {
    if (typeof PAGES === 'undefined') return;
    var bar = document.getElementById('tabBar');
    if (!bar) return;
    Object.keys(PAGES).forEach(function (key) {
        if (key === CURRENT) return; // 当前页本身不显示成标签
        var p = PAGES[key];
        var a = document.createElement('a');
        a.className = 'tab';
        a.href = p.href;
        a.textContent = p.label;
        bar.appendChild(a);
    });
})();

// ---------- 深色/浅色主题切换 ----------
(function () {
    var btn = document.getElementById('themeBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
        var isDark = document.documentElement.classList.toggle('dark');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    });
})();

// ---------- 登录状态与请求封装 ----------
function getToken() {
    return localStorage.getItem('token');
}

function getUser() {
    try {
        return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) {
        return null;
    }
}

// 未登录则跳转到登录页；已登录返回 true
function requireLogin(loginPath) {
    if (getToken()) return true;
    location.href = loginPath || 'login.html';
    return false;
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    location.href = 'index.html';
}

// 统一请求：自动带上 token（放在 token 请求头，与后端 checkToken 约定一致）
function api(url, options) {
    options = options || {};
    options.headers = options.headers || {};
    var token = getToken();
    if (token) options.headers['token'] = token;
    return fetch(API_BASE + url, options).then(function (res) {
        return res.json();
    });
}

// ---------- 渲染侧边栏登录区 ----------
(function () {
    var loginLink = document.getElementById('loginLink');
    if (!loginLink) return;
    var userName = document.getElementById('userName');
    var logoutLink = document.getElementById('logoutLink');
    var user = getUser();
    if (user) {
        loginLink.style.display = 'none';
        userName.style.display = 'block';
        userName.textContent = '👤 ' + user.username;
        logoutLink.style.display = 'block';
    } else {
        loginLink.style.display = 'block';
        userName.style.display = 'none';
        logoutLink.style.display = 'none';
    }
})();
