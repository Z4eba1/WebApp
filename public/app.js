const API_URL = '/api';
const TOKEN_KEY = 'kinoweb_token';

const state = {
    token: localStorage.getItem(TOKEN_KEY),
    user: null,
    favorites: [],
    movies: [],
    myMovies: []
};

const routes = [
    { path: '/', view: renderHome },
    { path: '/catalog', view: renderCatalog },
    { path: '/search', view: renderSearch },
    { path: '/favorites', view: renderFavorites, private: true },
    { path: '/profile', view: renderProfile, private: true },
    { path: '/auth/login', view: renderLogin },
    { path: '/auth/register', view: renderRegister },
    { path: '/auth/recover', view: renderRecover },
    { path: /^\/detail\/(\d+)$/, view: renderMovieDetail }
];

document.addEventListener('DOMContentLoaded', async () => {
    bindGlobalEvents();
    await bootstrapSession();
    router();
});

function bindGlobalEvents() {
    document.body.addEventListener('click', (event) => {
        const target = event.target.closest('[data-link]');
        if (!target) {
            return;
        }

        event.preventDefault();
        navigate(target.dataset.link);
    });

    window.addEventListener('popstate', router);
}

async function bootstrapSession() {
    if (!state.token) {
        updateNavigation();
        return;
    }

    try {
        const data = await apiRequest('/auth/me');
        state.user = data.user;
        state.favorites = await apiRequest('/favorites');
    } catch (error) {
        clearSession();
    }

    updateNavigation();
}

function navigate(path) {
    window.history.pushState({}, '', path);
    router();
}

async function router() {
    const currentPath = window.location.pathname;
    let match = null;
    let route = null;

    for (const candidate of routes) {
        if (typeof candidate.path === 'string' && candidate.path === currentPath) {
            route = candidate;
            break;
        }

        if (candidate.path instanceof RegExp) {
            const result = currentPath.match(candidate.path);
            if (result) {
                route = candidate;
                match = result;
                break;
            }
        }
    }

    if (!route) {
        window.history.replaceState({}, '', '/');
        return router();
    }

    if (route.private && !state.user) {
        window.history.replaceState({}, '', '/auth/login');
        return router();
    }

    updateNavigation();
    await route.view(match);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateNavigation() {
    const nav = document.getElementById('site-nav');

    if (state.user) {
        nav.innerHTML = `
            <button class="nav-link" data-link="/">Главная</button>
            <button class="nav-link" data-link="/catalog">Каталог</button>
            <button class="nav-link" data-link="/search">Поиск</button>
            <button class="nav-link" data-link="/favorites">Избранное</button>
            <button class="nav-link" data-link="/profile">Профиль</button>
            <span class="nav-user">${escapeHtml(state.user.name)}</span>
            <button class="nav-button" id="logout-button" type="button">Выйти</button>
        `;

        document.getElementById('logout-button').addEventListener('click', () => {
            clearSession();
            navigate('/auth/login');
        });
        return;
    }

    nav.innerHTML = `
        <button class="nav-link" data-link="/">Главная</button>
        <button class="nav-link" data-link="/catalog">Каталог</button>
        <button class="nav-link" data-link="/search">Поиск</button>
        <button class="nav-link" data-link="/auth/login">Вход</button>
        <button class="nav-button" data-link="/auth/register" type="button">Регистрация</button>
    `;
}

function setView(html) {
    document.getElementById('app-view').innerHTML = html;
}

async function renderHome() {
    const popularMovies = await apiRequest('/movies?popular=true');
    const latestMovies = await apiRequest('/movies');

    setView(`
        <section class="hero-card">
            <div class="hero-text">
                <span class="eyebrow">KinoWeb</span>
                <h1>Смотри, сохраняй и управляй своей коллекцией фильмов</h1>
                    <button class="primary-button" id ="catalog-but" data-link="/catalog" type="button">Открыть каталог</button>
            </div>
            <div class="hero-panel">
                <div class="stat-card">
                    <strong>${popularMovies.length}</strong>
                    <span>Популярных фильмов</span>
                </div>
                <div class="stat-card">
                    <strong>${latestMovies.length}</strong>
                    <span>Фильмов в каталоге</span>
                </div>
                <div class="stat-card">
                    <strong>${state.user ? 'Да' : 'Нет'}</strong>
                    <span>Активная сессия</span>
                </div>
            </div>
        </section>

        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Главная</span>
                    <h2>Популярные фильмы</h2>
                </div>
                <button class="link-button" data-link="/catalog" type="button">Смотреть всё</button>
            </div>
            ${renderMovieGrid(popularMovies)}
        </section>

        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Новинки</span>
                    <h2>Последние добавления</h2>
                </div>
            </div>
            ${renderMovieGrid(latestMovies.slice(0, 6))}
        </section>
    `);

    attachMovieCardHandlers();
}

