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
                <button class="primary-button" type="submit">Применить</button>
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
                <button class="primary-button" type="submit">Искать</button>
            </form>
            <div id="search-results"></div>
        </section>
    `);

    document.getElementById('search-form').addEventListener('submit', async (event) => {
        event.preventDefault();
        const query = document.getElementById('search-input').value.trim();
        const results = query ? await apiRequest(`/movies/search?q=${encodeURIComponent(query)}`) : [];
        document.getElementById('search-results').innerHTML = renderMovieGrid(results);
        attachMovieCardHandlers();
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
                    <div class="filter-grid compact">
                        <input class="input-control" name="vyear" type="number" placeholder="Год">
                        <input class="input-control" name="rating" type="number" step="0.1" min="0" max="10" placeholder="Рейтинг">
                        <input class="input-control" name="genre" type="text" placeholder="Жанр">
                    </div>
                    <label class="checkbox-row">
                        <input name="is_popular" type="checkbox">
                        <span>Отметить как популярный</span>
                    </label>
                    <button class="primary-button" type="submit">Сохранить фильм</button>
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
                    <button class="primary-button" id="catalog-but" type="submit">Войти</button>
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
            localStorage.setItem(TOKEN_KEY, data.token);
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
            localStorage.setItem(TOKEN_KEY, data.token);
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
                <p>Введите email, ключевое слово и новый пароль. Если данные совпадут, пароль обновится сразу.</p>
                <form id="recover-form" class="auth-form">
                    <input class="input-control" name="email" type="email" placeholder="Email" required>
                    <input class="input-control" name="keyword" type="text" placeholder="Ключевое слово" minlength="3" required>
                    <input class="input-control" name="newPassword" type="password" placeholder="Новый пароль" minlength="6" required>
                    <button class="primary-button" type="submit">Обновить пароль</button>
                    <div id="recover-message" class="status-box hidden"></div>
                </form>
                <p class="form-note">Вернуться ко входу? <button class="inline-link" data-link="/auth/login" type="button">Открыть страницу входа</button></p>
            </div>
        </section>
    `);

    document.getElementById('recover-form').addEventListener('submit', async (event) => {
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
            event.currentTarget.reset();
        } catch (error) {
            showStatus(messageBox, error.message, 'error');
        }
    });
}

async function renderMovieDetail(match) {
    const movie = await apiRequest(`/movies/${match[1]}`);
    const isFavorite = state.favorites.some((item) => item.id === movie.id);

    setView(`
        <section class="detail-layout">
            <div class="detail-poster">
                <img src="${escapeAttribute(movie.poster || 'https://placehold.co/600x900/102033/F3EDE0?text=KinoWeb')}" alt="${escapeAttribute(movie.title)}">
            </div>
            <div class="detail-info">
                <span class="eyebrow">${escapeHtml(movie.genre || 'Без жанра')}</span>
                <h1>${escapeHtml(movie.title)}</h1>
                <p class="detail-meta">Год: ${movie.vyear || 'Не указан'} · Рейтинг: ${Number(movie.rating).toFixed(1)} · Автор: ${escapeHtml(movie.author || 'Неизвестно')}</p>
                <p class="detail-description">${escapeHtml(movie.description || 'Описание пока отсутствует.')}</p>
                <div class="hero-actions">
                    ${state.user ? `<button class="primary-button" id="favorite-toggle" type="button">${isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}</button>` : `<button class="primary-button" data-link="/auth/login" type="button">Войти, чтобы добавить в избранное</button>`}
                    <button class="ghost-button" data-link="/catalog" type="button">Назад к каталогу</button>
                </div>
            </div>
        </section>
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

    const response = await fetch(`${API_URL}${url}`, {
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
    localStorage.removeItem(TOKEN_KEY);
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
                                    <button class="small-button" data-link="/detail/${movie.id}" type="button">Подробнее</button>
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