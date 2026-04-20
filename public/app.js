const APP_CONFIG = {
    apiBaseUrl: '/api',
    storageKeys: {
        token: 'kinoweb_token'
    },
    mobileBreakpoint: 640
};

function createInitialState() {
    return {
        token: localStorage.getItem(APP_CONFIG.storageKeys.token),
        user: null,
        favorites: [],
        movies: [],
        myMovies: [],
        mobileNavOpen: false
    };
}

const state = createInitialState();

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
        const toggle = event.target.closest('#nav-toggle');
        if (toggle) {
            event.preventDefault();
            toggleMobileNav();
            return;
        }

        const target = event.target.closest('[data-link]');
        if (!target) {
            if (state.mobileNavOpen && !event.target.closest('.site-header')) {
                closeMobileNav();
            }
            return;
        }

        event.preventDefault();
        navigate(target.dataset.link);
    });

    window.addEventListener('popstate', router);
    window.addEventListener('resize', handleViewportChange);
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
    closeMobileNav();
    window.history.pushState({}, '', path);
    router();
}

function normalizePath(pathname) {
    if (!pathname || pathname === '/') {
        return '/';
    }

    return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

async function router() {
    const currentPath = normalizePath(window.location.pathname);
    let match = null;
    let route = null;

    if (currentPath !== window.location.pathname) {
        window.history.replaceState({}, '', `${currentPath}${window.location.search}${window.location.hash}`);
    }

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

    try {
        updateNavigation();
        await route.view(match);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        renderRouteError(error);
    }
}

function renderRouteError(error) {
    const message = error instanceof Error && error.message
        ? error.message
        : 'Не удалось открыть страницу.';

    updateNavigation();
    setView(`
        <section class="section-block">
            <div class="empty-state">
                <h3>Не удалось открыть страницу</h3>
                <p>${escapeHtml(message)}</p>
                <div class="hero-actions">
                    <button class="primary-button" data-link="/" type="button">На главную</button>
                    <button class="ghost-button" data-link="/catalog" type="button">Открыть каталог</button>
                </div>
            </div>
        </section>
    `);
}
function updateNavigation() {
    const nav = document.getElementById('site-nav');
    const currentPath = window.location.pathname;

    if (state.user) {
        nav.innerHTML = `
            <button class="${getNavLinkClass('/', currentPath)}" data-link="/">Главная</button>
            <button class="${getNavLinkClass('/catalog', currentPath)}" data-link="/catalog">Каталог</button>
            <button class="${getNavLinkClass('/search', currentPath)}" data-link="/search">Поиск</button>
            <button class="${getNavLinkClass('/favorites', currentPath)}" data-link="/favorites">Избранное</button>
            <button class="${getNavLinkClass('/profile', currentPath)}" data-link="/profile">Профиль</button>
            <span class="nav-user">${escapeHtml(state.user.name)}</span>
            <button class="nav-button" id="logout-button" type="button">Выйти</button>
        `;

        document.getElementById('logout-button').addEventListener('click', () => {
            clearSession();
            navigate('/auth/login');
        });
        syncNavigationState();
        return;
    }

    nav.innerHTML = `
        <button class="${getNavLinkClass('/', currentPath)}" data-link="/">Главная</button>
        <button class="${getNavLinkClass('/catalog', currentPath)}" data-link="/catalog">Каталог</button>
        <button class="${getNavLinkClass('/search', currentPath)}" data-link="/search">Поиск</button>
        <button class="${getNavLinkClass('/auth/login', currentPath)}" data-link="/auth/login">Вход</button>
        <button class="nav-button" data-link="/auth/register" type="button">Регистрация</button>
    `;

    syncNavigationState();
}
function getNavLinkClass(path, currentPath) {
    return currentPath === path ? 'nav-link is-active' : 'nav-link';
}

function isMobileViewport() {
    return window.innerWidth <= APP_CONFIG.mobileBreakpoint;
}

function toggleMobileNav() {
    if (!isMobileViewport()) {
        return;
    }

    state.mobileNavOpen = !state.mobileNavOpen;
    syncNavigationState();
}

function closeMobileNav() {
    if (!state.mobileNavOpen) {
        return;
    }

    state.mobileNavOpen = false;
    syncNavigationState();
}

function handleViewportChange() {
    if (!isMobileViewport()) {
        state.mobileNavOpen = false;
    }

    syncNavigationState();
}

function syncNavigationState() {
    const header = document.querySelector('.site-header');
    const nav = document.getElementById('site-nav');
    const toggle = document.getElementById('nav-toggle');
    const isOpen = isMobileViewport() && state.mobileNavOpen;

    if (!header || !nav || !toggle) {
        return;
    }

    header.classList.toggle('nav-open', isOpen);
    nav.classList.toggle('is-open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    nav.setAttribute('aria-hidden', String(isMobileViewport() && !isOpen));

    nav.querySelectorAll('button, a').forEach((item) => {
        item.tabIndex = isMobileViewport() && !isOpen ? -1 : 0;
    });
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
async function renderCatalog() {
    const movies = await apiRequest('/movies');
    state.movies = movies;

    setView(renderCatalogMarkup(movies));
    bindCatalogFilters();
    attachMovieCardHandlers();
}

function renderCatalogMarkup(movies, values = {}) {
    return `
        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Каталог</span>
                    <h1>Фильмы</h1>
                </div>
            </div>

            <form id="catalog-filters" class="filter-grid">
                <input class="input-control" name="genre" type="text" placeholder="Жанр" value="${escapeAttribute(values.genre || '')}">
                <input class="input-control" name="year" type="number" placeholder="Год" value="${escapeAttribute(values.year || '')}">
                <input class="input-control" name="rating" type="number" min="0" max="10" step="0.1" placeholder="Мин. рейтинг" value="${escapeAttribute(values.rating || '')}">
            </form>

            ${renderMovieGrid(movies)}
        </section>
    `;
}
function bindCatalogFilters() {
    document.getElementById('catalog-filters').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const params = new URLSearchParams();
        const values = {};

        for (const [key, value] of form.entries()) {
            values[key] = value;
            if (String(value).trim()) {
                params.set(key, value);
            }
        }

        const filteredMovies = await apiRequest(`/movies?${params.toString()}`);
        state.movies = filteredMovies;
        setView(renderCatalogMarkup(filteredMovies, values));
        bindCatalogFilters();
        attachMovieCardHandlers();
    });
}

async function renderSearch() {
    setView(`
        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Поиск</span>
                    <h1>Найдите фильм</h1>
                </div>
            </div>
            <form id="search-form" class="search-row">
                <input class="input-control search-input" id="search-input" type="search" placeholder="Введите название, жанр или описание">
            </form>
            <div id="search-results"></div>
        </section>
    `);

    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    let searchRequestId = 0;
    let debounceTimer = null;

    const runSearch = async () => {
        const query = searchInput.value.trim();
        const currentRequestId = ++searchRequestId;

        if (!query) {
            searchResults.innerHTML = '';
            return;
        }

        const results = await apiRequest(`/movies/search?q=${encodeURIComponent(query)}`);
        if (currentRequestId !== searchRequestId) {
            return;
        }

        searchResults.innerHTML = renderMovieGrid(results);
        attachMovieCardHandlers();
    };

    searchForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearTimeout(debounceTimer);
        await runSearch();
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            runSearch().catch((error) => {
                searchResults.innerHTML = `
                    <div class="empty-state">
                        <h3>Поиск временно недоступен</h3>
                        <p>${escapeHtml(error.message)}</p>
                    </div>
                `;
            });
        }, 250);
    });
}
async function renderFavorites() {
    state.favorites = await apiRequest('/favorites');

    setView(`
        <section class="section-block">
            <div class="section-head">
                <div>
                    <h1>Избранное</h1>
                </div>
            </div>
            ${renderMovieGrid(state.favorites)}
        </section>
    `);

    attachMovieCardHandlers();
}
async function renderProfile() {
    const profile = await apiRequest('/auth/me');
    const myMovies = await apiRequest('/movies?user=me');
    state.myMovies = myMovies;

    setView(`
        <section class="section-block profile-layout">
            <div class="profile-card">
                <h1>${escapeHtml(profile.user.name)}</h1>
                <p>${escapeHtml(profile.user.email)}</p>
                <p>Дата регистрации: ${formatDate(profile.user.created_at)}</p>
            </div>

            <div class="profile-card">
                <div class="section-head compact">
                    <div>
                        <span class="eyebrow">CRUD</span>
                        <h2>Добавить фильм</h2>
                    </div>
                </div>
                <form id="movie-form" class="auth-form">
                    <input class="input-control" name="title" type="text" placeholder="Название" required>
                    <textarea class="input-control textarea-control" name="description" placeholder="Описание"></textarea>
                    <input class="input-control" name="poster" type="url" placeholder="Ссылка на постер">
                    <input class="input-control" name="watch_url" type="url" placeholder="Ссылка на просмотр (YouTube, Vimeo, mp4)">
                    <div class="filter-grid compact">
                        <input class="input-control" name="vyear" type="number" placeholder="Год">
                        <input class="input-control" name="rating" type="number" step="0.1" min="0" max="10" placeholder="Рейтинг">
                        <input class="input-control" name="genre" type="text" placeholder="Жанр">
                    </div>
                    <label class="checkbox-row">
                        <input name="is_popular" type="checkbox">
                        <span>Отметить как популярный</span>
                    </label>
                    <div id="movie-form-message" class="status-box hidden"></div>
                </form>
            </div>
        </section>

        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Мои фильмы</span>
                    <h2>Управление контентом</h2>
                </div>
            </div>
            ${renderMovieGrid(myMovies, true)}
        </section>
    `);

    document.getElementById('movie-form').addEventListener('submit', submitMovieForm);
    attachMovieCardHandlers();
    attachOwnerActions();
}
async function renderLogin() {
    if (state.user) {
        navigate('/profile');
        return;
    }

    setView(`
        <section class="auth-layout">
            <div class="auth-card">
                <span class="eyebrow">Аутентификация</span>
                <h1>Вход</h1>
                <form id="login-form" class="auth-form">
                    <input class="input-control" name="email" type="email" placeholder="Email" required>
                    <input class="input-control" name="password" type="password" placeholder="Пароль" minlength="6" required>
                    <button class="primary-button" id ="catalog-but" type="submit">Войти</button>
                    <div id="login-message" class="status-box hidden"></div>
                </form>
                <p class="form-note">Нет аккаунта? <button class="inline-link" data-link="/auth/register" type="button">Зарегистрироваться</button></p>
                <p class="form-note">Забыли пароль? <button class="inline-link" data-link="/auth/recover" type="button">Восстановить</button></p>
            </div>
        </section>
    `);

    document.getElementById('login-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const messageBox = document.getElementById('login-message');

        try {
            const data = await apiRequest('/auth/login', {
                method: 'POST',
                body: JSON.stringify({
                    email: formData.get('email'),
                    password: formData.get('password')
                })
            });

            state.token = data.token;
            localStorage.setItem(APP_CONFIG.storageKeys.token, data.token);
            state.user = data.user;
            state.favorites = await apiRequest('/favorites');
            updateNavigation();
            navigate('/profile');
        } catch (error) {
            showStatus(messageBox, error.message, 'error');
        }
    });
}
async function renderRegister() {
    if (state.user) {
        navigate('/profile');
        return;
    }

    setView(`
        <section class="auth-layout">
            <div class="auth-card">
                <span class="eyebrow">Аутентификация</span>
                <h1>Регистрация</h1>
                <form id="register-form" class="auth-form">
                    <input class="input-control" name="name" type="text" placeholder="Имя" required>
                    <input class="input-control" name="email" type="email" placeholder="Email" required>
                    <input class="input-control" name="keyword" type="text" placeholder="Ключевое слово для восстановления" minlength="3" required>
                    <input class="input-control" name="password" type="password" placeholder="Пароль" minlength="6" required>
                    <button class="primary-button" id="catalog-but" type="submit">Создать аккаунт</button>
                    <div id="register-message" class="status-box hidden"></div>
                </form>
                <p class="form-note">Уже есть аккаунт? <button class="inline-link" data-link="/auth/login" type="button">Войти</button></p>
            </div>
        </section>
    `);

    document.getElementById('register-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const messageBox = document.getElementById('register-message');

        try {
            const data = await apiRequest('/auth/register', {
                method: 'POST',
                body: JSON.stringify({
                    name: formData.get('name'),
                    email: formData.get('email'),
                    keyword: formData.get('keyword'),
                    password: formData.get('password')
                })
            });

            state.token = data.token;
            localStorage.setItem(APP_CONFIG.storageKeys.token, data.token);
            state.user = data.user;
            state.favorites = [];
            updateNavigation();
            navigate('/profile');
        } catch (error) {
            showStatus(messageBox, error.message, 'error');
        }
    });
}
async function renderRecover() {
    if (state.user) {
        navigate('/profile');
        return;
    }

    setView(`
        <section class="auth-layout">
            <div class="auth-card">
                <span class="eyebrow">Восстановление</span>
                <h1>Сброс пароля</h1>
                <p>Введите email, ключевое слово и новый пароль.</p>
                <form id="recover-form" class="auth-form">
                    <input class="input-control" name="email" type="email" placeholder="Email" required>
                    <input class="input-control" name="keyword" type="text" placeholder="Ключевое слово" minlength="3" required>
                    <input class="input-control" name="newPassword" type="password" placeholder="Новый пароль" minlength="6" required>
                    <button class="primary-button" type="submit">Сбросить пароль</button>
                    <div id="recover-message" class="status-box hidden"></div>
                </form>
                <p class="form-note">Вернуться ко входу? <button class="inline-link" data-link="/auth/login" type="button">Открыть страницу входа</button></p>
            </div>
        </section>
    `);

    const recoverForm = document.getElementById('recover-form');
    recoverForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const messageBox = document.getElementById('recover-message');

        try {
            const data = await apiRequest('/auth/recover', {
                method: 'POST',
                body: JSON.stringify({
                    email: formData.get('email'),
                    keyword: formData.get('keyword'),
                    newPassword: formData.get('newPassword')
                })
            });

            showStatus(messageBox, data.message, 'success');
            recoverForm.reset();
        } catch (error) {
            showStatus(messageBox, error.message, 'error');
        }
    });
}
async function renderMovieDetail(match) {
    const movie = await apiRequest(`/movies/${match[1]}`);
    const isFavorite = state.favorites.some((item) => item.id === movie.id);

    setView(`
        <div class="movie-detail-page">
            <div class="movie-backdrop" style="background-image: url('${escapeAttribute(movie.poster || 'https://placehold.co/1920x1080/102033/F3EDE0?text=KinoWeb')}')"></div>

            <div class="movie-content-wrapper">
                <div class="movie-header">
                    <div class="movie-poster-large">
                        <img src="${escapeAttribute(movie.poster || 'https://placehold.co/400x600/102033/F3EDE0?text=KinoWeb')}" alt="${escapeAttribute(movie.title)}">
                    </div>

                    <div class="movie-info">
                        <div class="movie-meta">
                            <span class="movie-genre">${escapeHtml(movie.genre || 'Без жанра')}</span>
                            <span class="movie-year">${movie.vyear || 'Год не указан'}</span>
                        </div>

                        <h1 class="movie-title">${escapeHtml(movie.title)}</h1>

                        <div class="movie-rating">
                            <div class="rating-stars">
                                ${renderStars(Number(movie.rating))}
                            </div>
                            <span class="rating-value">${Number(movie.rating).toFixed(1)}</span>
                        </div>

                        <div class="movie-details">
                            <div class="detail-item">
                                <span class="detail-label">Режиссёр:</span>
                                <span class="detail-value">${escapeHtml(movie.author || 'Неизвестно')}</span>
                            </div>
                        </div>

                        <p class="movie-description">${escapeHtml(movie.description || 'Описание пока отсутствует.')}</p>

                        <div class="movie-actions">
                            ${state.user ? `<button class="action-btn favorite-btn ${isFavorite ? 'active' : ''}" id="favorite-toggle" type="button">
                                <span class="btn-icon">${isFavorite ? '❤️' : '🤍'}</span>
                                ${isFavorite ? 'В избранном' : 'В избранное'}
                            </button>` : `<button class="action-btn login-btn" data-link="/auth/login" type="button">
                                <span class="btn-icon">🔐</span>
                                Войти, чтобы добавить в избранное
                            </button>`}

                            <button class="action-btn back-btn" data-link="/catalog" type="button">
                                <span class="btn-icon">⬅️</span>
                                Назад к каталогу
                            </button>
                        </div>
                    </div>
                </div>

                <div class="movie-player-section">
                    ${renderMovieWatchBlock(movie)}
                </div>
            </div>
        </div>
    `);

    if (state.user) {
        document.getElementById('favorite-toggle').addEventListener('click', async () => {
            await toggleFavorite(movie.id);
            await renderMovieDetail(match);
        });
    }
}
async function submitMovieForm(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const messageBox = document.getElementById('movie-form-message');

    try {
        await apiRequest('/movies', {
            method: 'POST',
            body: JSON.stringify({
                title: formData.get('title'),
                description: formData.get('description'),
                poster: formData.get('poster'),
                watch_url: formData.get('watch_url'),
                vyear: formData.get('vyear'),
                rating: formData.get('rating'),
                genre: formData.get('genre'),
                is_popular: formData.get('is_popular') === 'on'
            })
        });

        event.currentTarget.reset();
        showStatus(messageBox, 'Фильм добавлен.', 'success');
        await renderProfile();
    } catch (error) {
        showStatus(messageBox, error.message, 'error');
    }
}

function attachMovieCardHandlers() {
    document.querySelectorAll('[data-favorite-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            if (!state.user) {
                navigate('/auth/login');
                return;
            }

            await toggleFavorite(Number(button.dataset.favoriteId));
            router();
        });
    });
}

function attachOwnerActions() {
    document.querySelectorAll('[data-delete-movie-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            await apiRequest(`/movies/${button.dataset.deleteMovieId}`, { method: 'DELETE' });
            await renderProfile();
        });
    });
}

async function toggleFavorite(movieId) {
    const exists = state.favorites.some((item) => item.id === movieId);
    await apiRequest(`/favorites/${movieId}`, {
        method: exists ? 'DELETE' : 'POST'
    });
    state.favorites = await apiRequest('/favorites');
}

async function apiRequest(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (state.token) {
        headers.Authorization = `Bearer ${state.token}`;
    }

    const response = await fetch(`${APP_CONFIG.apiBaseUrl}${url}`, {
        ...options,
        headers
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'Произошла ошибка запроса.');
    }

    return data;
}

function clearSession() {
    localStorage.removeItem(APP_CONFIG.storageKeys.token);
    state.token = null;
    state.user = null;
    state.favorites = [];
    updateNavigation();
}

function renderMovieGrid(movies, canDelete = false) {
    if (!movies.length) {
        return document.getElementById('empty-state-template').innerHTML;
    }

    return `
        <div class="movie-grid">
            ${movies.map((movie) => {
        const isFavorite = state.favorites.some((item) => item.id === movie.id);
        return `
                    <article class="movie-card">
                        <div class="movie-cover">
                            <img src="${escapeAttribute(movie.poster || 'https://placehold.co/600x900/102033/F3EDE0?text=KinoWeb')}" alt="${escapeAttribute(movie.title)}">
                        </div>
                        <div class="movie-content">
                            <div class="movie-topline">
                                <span>${escapeHtml(movie.genre || 'Без жанра')}</span>
                                <span>${movie.vyear || 'Год не указан'}</span>
                            </div>
                            <h3>${escapeHtml(movie.title)}</h3>
                            <p>${escapeHtml(movie.description || 'Краткое описание недоступно.')}</p>
                            <div class="movie-footer">
                                <strong>${Number(movie.rating).toFixed(1)}</strong>
                                <div class="card-actions">
                                    ${movie.watch_url ? `<button class="small-button accent" data-link="/detail/${movie.id}" type="button">Смотреть</button>` : ''}
                                    <button class="small-button accent" data-favorite-id="${movie.id}" type="button">${isFavorite ? 'Убрать' : 'В избранное'}</button>
                                    ${canDelete ? `<button class="small-button danger" data-delete-movie-id="${movie.id}" type="button">Удалить</button>` : ''}
                                </div>
                            </div>
                        </div>
                    </article>
                `;
    }).join('')}
        </div>
    `;
}
function getMoviePlayerConfig(watchUrl) {
    if (!watchUrl) {
        return null;
    }

    try {
        const parsedUrl = new URL(watchUrl);
        const hostname = parsedUrl.hostname.replace(/^www\./, '');
        const pathname = parsedUrl.pathname;
        const directVideoPattern = /\.(mp4|webm|ogg)$/i;

        if (hostname === 'youtu.be') {
            const videoId = pathname.slice(1);
            return videoId ? { type: 'embed', src: `https://www.youtube.com/embed/${videoId}?rel=0` } : null;
        }

        if (hostname.includes('youtube.com')) {
            if (pathname === '/watch') {
                const videoId = parsedUrl.searchParams.get('v');
                return videoId ? { type: 'embed', src: `https://www.youtube.com/embed/${videoId}?rel=0` } : null;
            }

            if (pathname.startsWith('/embed/')) {
                return { type: 'embed', src: watchUrl };
            }
        }

        if (hostname === 'vimeo.com') {
            const videoId = pathname.split('/').filter(Boolean)[0];
            return videoId ? { type: 'embed', src: `https://player.vimeo.com/video/${videoId}` } : null;
        }

        if (hostname === 'player.vimeo.com' && pathname.startsWith('/video/')) {
            return { type: 'embed', src: watchUrl };
        }

        if (hostname.includes('rutube.ru')) {
            const parts = pathname.split('/').filter(Boolean);
            const videoIndex = parts.indexOf('video');
            const videoId = videoIndex >= 0 ? parts[videoIndex + 1] : null;
            return videoId ? { type: 'embed', src: `https://rutube.ru/play/embed/${videoId}` } : null;
        }

        if (directVideoPattern.test(pathname)) {
            return { type: 'video', src: watchUrl };
        }

        return { type: 'external', src: watchUrl };
    } catch (error) {
        return null;
    }
}

function renderMovieWatchBlock(movie) {
    const playerConfig = getMoviePlayerConfig(movie.watch_url);

    if (!playerConfig) {
        return `
            <section class="watch-panel watch-panel-empty">
                <div>
                    <span class="eyebrow">Просмотр</span>
                    <h2>Источник пока не добавлен</h2>
                    <p>Для этого фильма ещё нет ссылки на просмотр. Её можно добавить при создании фильма в личном кабинете.</p>
                </div>
            </section>
        `;
    }

    if (playerConfig.type === 'video') {
        return `
            <section class="watch-panel">
                <div class="watch-panel-head">
                    <div>
                        <span class="eyebrow">Просмотр</span>
                        <h2>Смотрите прямо на странице</h2>
                    </div>
                </div>
                <div class="watch-frame video-frame">
                    <video controls preload="metadata" poster="${escapeAttribute(movie.poster || '')}">
                        <source src="${escapeAttribute(playerConfig.src)}">
                    </video>
                </div>
            </section>
        `;
    }

    if (playerConfig.type === 'embed') {
        return `
            <section class="watch-panel">
                <div class="watch-panel-head">
                    <div>
                        <span class="eyebrow">Просмотр</span>
                        <h2>Смотрите прямо на странице</h2>
                    </div>
                </div>
                <div class="watch-frame">
                    <iframe src="${escapeAttribute(playerConfig.src)}" title="${escapeAttribute(movie.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
                </div>
            </section>
        `;
    }

    return `
        <section class="watch-panel watch-panel-empty">
            <div>
                <span class="eyebrow">Просмотр</span>
                <h2>Доступен внешний источник</h2>
                <p>Этот фильм открывается на внешнем сайте. Нажмите кнопку выше, чтобы перейти к просмотру.</p>
            </div>
        </section>
    `;
}
function showStatus(element, text, type) {
    element.textContent = text;
    element.className = `status-box ${type}`;
}

function formatDate(value) {
    return new Date(value).toLocaleDateString('ru-RU');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

function renderStars(rating) {
    const numRating = Number(rating) || 0;
    const clampedRating = Math.max(0, Math.min(5, numRating));
    const fullStars = Math.floor(clampedRating);
    const hasHalfStar = clampedRating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return '★'.repeat(fullStars) +
           (hasHalfStar ? '☆' : '') +
           '☆'.repeat(emptyStars);
}



