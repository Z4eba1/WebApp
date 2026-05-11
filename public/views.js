async function renderHome() {
    const popularMovies = await apiRequest('/movies?popular=true');
    const latestMovies = await apiRequest('/movies');
    state.popularMovies = popularMovies;
    state.homePopularPage = 1;

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

        ${renderLatestSlider(latestMovies.slice(0, 6))}

        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Главная</span>
                    <h2>Популярные фильмы</h2>
                </div>
                <button class="link-button" data-link="/catalog" type="button">Смотреть всё</button>
            </div>
            ${renderPaginatedMovieList(popularMovies, state.homePopularPage, 'home-popular')}
        </section>
    `);

    bindLatestSlider();
    bindHomePopularPagination();
    attachMovieCardHandlers();
}
async function renderCatalog() {
    const movies = await apiRequest('/movies');
    state.movies = movies;
    state.catalogPage = 1;

    setView(renderCatalogMarkup(movies, {}, state.catalogPage));
    bindCatalogFilters();
    bindCatalogPagination();
    attachMovieCardHandlers();
}

function renderCatalogMarkup(movies, values = {}, page = 1) {
    const totalPages = getTotalPages(movies.length);
    const currentPage = clampPage(page, totalPages);
    const startIndex = (currentPage - 1) * APP_CONFIG.catalogPageSize;
    const visibleMovies = movies.slice(startIndex, startIndex + APP_CONFIG.catalogPageSize);

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

            <div id="catalog-results">
                ${renderCatalogResults(visibleMovies, currentPage, totalPages)}
            </div>
        </section>
    `;
}

function renderCatalogResults(visibleMovies, currentPage, totalPages) {
    return `
        ${renderMovieGrid(visibleMovies)}
        ${renderPagination(currentPage, totalPages, 'catalog')}
    `;
}

function updateCatalogResults(movies, values = {}, page = 1) {
    const totalPages = getTotalPages(movies.length);
    const currentPage = clampPage(page, totalPages);
    const startIndex = (currentPage - 1) * APP_CONFIG.catalogPageSize;
    const visibleMovies = movies.slice(startIndex, startIndex + APP_CONFIG.catalogPageSize);
    const results = document.getElementById('catalog-results');

    if (!results) {
        return;
    }

    results.innerHTML = renderCatalogResults(visibleMovies, currentPage, totalPages);
    bindCatalogPagination(values);
    attachMovieCardHandlers();
}

function bindCatalogFilters() {
    const filtersForm = document.getElementById('catalog-filters');
    let filterTimer = null;

    const runFilters = async () => {
        const { params, values } = getCatalogFilterData(filtersForm);
        const queryString = params.toString();
        const filteredMovies = await apiRequest(`/movies${queryString ? `?${queryString}` : ''}`);

        state.movies = filteredMovies;
        state.catalogPage = 1;
        updateCatalogResults(filteredMovies, values, state.catalogPage);
    };

    filtersForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearTimeout(filterTimer);
        await runFilters();
    });

    filtersForm.addEventListener('input', () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => {
            runFilters().catch(renderRouteError);
        }, 300);
    });
}

function getCatalogFilterData(filtersForm) {
    const form = new FormData(filtersForm);
    const params = new URLSearchParams();
    const values = {};

    for (const [key, value] of form.entries()) {
        const trimmedValue = String(value).trim();
        values[key] = trimmedValue;

        if (trimmedValue) {
            params.set(key, trimmedValue);
        }
    }

    return { params, values };
}

function bindCatalogPagination(values = {}) {
    document.querySelectorAll('[data-pagination="catalog"]').forEach((button) => {
        button.addEventListener('click', () => {
            state.catalogPage = Number(button.dataset.page);
            updateCatalogResults(state.movies, values, state.catalogPage);
            document.querySelector('.section-block')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

function bindHomePopularPagination() {
    document.querySelectorAll('[data-pagination="home-popular"]').forEach((button) => {
        button.addEventListener('click', () => {
            state.homePopularPage = Number(button.dataset.page);
            const target = document.getElementById('home-popular-list');
            if (!target) {
                return;
            }

            target.innerHTML = renderPaginatedMovieList(state.popularMovies, state.homePopularPage, 'home-popular');
            bindHomePopularPagination();
            attachMovieCardHandlers();
            target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
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
    const myCommentsResponse = await apiRequest('/comments/me');
    state.myMovies = myMovies;
    const isAdmin = profile.user.role === 'admin';

    setView(`
        <section class="section-block profile-layout">
            <div class="profile-card profile-card--stacked">
                <div class="section-head compact">
                    <div>
                        <span class="eyebrow">Профиль</span>
                        <h2>Мой профиль</h2>
                    </div>
                </div>
                
                <div class="profile-edit-field">
                    <div class="profile-edit-display" data-field="name">
                        <span class="profile-field-label">Имя:</span>
                        <span class="profile-field-value">${escapeHtml(profile.user.name)}</span>
                        <button class="profile-edit-btn" type="button" data-field="name" title="Редактировать">✎</button>
                    </div>
                    <div class="profile-edit-form" data-field="name" style="display: none;">
                        <input class="input-control profile-edit-input" type="text" value="${escapeAttribute(profile.user.name)}" required>
                        <div class="profile-edit-actions">
                            <button class="small-button primary profile-save-btn" type="button" data-field="name">Сохранить</button>
                            <button class="small-button secondary profile-cancel-btn" type="button" data-field="name">Отмена</button>
                        </div>
                    </div>
                </div>

                <div class="profile-edit-field">
                    <div class="profile-edit-display" data-field="email">
                        <span class="profile-field-label">Email:</span>
                        <span class="profile-field-value">${escapeHtml(profile.user.email)}</span>
                        <button class="profile-edit-btn" type="button" data-field="email" title="Редактировать">✎</button>
                    </div>
                    <div class="profile-edit-form" data-field="email" style="display: none;">
                        <input class="input-control profile-edit-input" type="email" value="${escapeAttribute(profile.user.email)}" required>
                        <div class="profile-edit-actions">
                            <button class="small-button primary profile-save-btn" type="button" data-field="email">Сохранить</button>
                            <button class="small-button secondary profile-cancel-btn" type="button" data-field="email">Отмена</button>
                        </div>
                    </div>
                </div>

                <div class="profile-edit-field">
                    <div class="profile-edit-display" data-field="security">
                        <span class="profile-field-label">Вопрос:</span>
                        <span class="profile-field-value">${escapeHtml(profile.user.security_question || 'Не выбран')}</span>
                        <button class="profile-edit-btn" type="button" data-field="security" title="Редактировать">✎</button>
                    </div>
                    <div class="profile-edit-form" data-field="security" style="display: none;">
                        <select class="input-control profile-edit-input" name="securityQuestion" required>
                            ${renderSecurityQuestionOptions(profile.user.security_question)}
                        </select>
                        <input class="input-control profile-edit-input" name="securityAnswer" type="text" placeholder="Новый ответ" minlength="3" required>
                        <div class="profile-edit-actions">
                            <button class="small-button primary profile-save-btn" type="button" data-field="security">Сохранить</button>
                            <button class="small-button secondary profile-cancel-btn" type="button" data-field="security">Отмена</button>
                        </div>
                    </div>
                </div>

                <div class="profile-card--info">
                    <p class="profile-field">Роль: <strong>${escapeHtml(profile.user.role === 'admin' ? 'Администратор' : 'Пользователь')}</strong></p>
                    <p class="profile-field">Дата регистрации: ${formatDate(profile.user.created_at)}</p>
                </div>

                <div id="profile-form-message" class="status-box hidden"></div>
            </div>

            ${isAdmin ? `
                <div class="profile-card profile-card--admin">
                    <div class="section-head compact">
                        <div>
                            <span class="eyebrow">CRUD</span>
                            <h2>Добавить фильм</h2>
                        </div>
                    </div>
                    <form id="movie-form" class="auth-form profile-admin-form">
                        <input class="input-control" name="title" type="text" placeholder="Название" required>
                        <textarea class="input-control textarea-control" name="description" placeholder="Описание"></textarea>
                        <input class="input-control" name="poster" type="url" placeholder="Ссылка на постер">
                        <input class="input-control" name="watch_url" type="url" placeholder="Ссылка на просмотр (YouTube, Vimeo, mp4)">
                        <div class="filter-grid compact">
                            <input class="input-control" name="vyear" type="number" placeholder="Год">
                            <input class="input-control" name="rating" type="number" step="0.1" min="0" max="10" placeholder="Рейтинг">
                            <input class="input-control" name="genre" type="text" placeholder="Жанр">
                        </div>
                        <label class="checkbox-row checkbox-row--centered">
                            <input name="is_popular" type="checkbox">
                            <span>Отметить как популярный</span>
                        </label>
                        <div id="movie-form-message" class="status-box hidden"></div>
                    </form>
                </div>
            ` : ''}
        </section>

        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Комментарии</span>
                    <h2>Мои комментарии</h2>
                </div>
            </div>
            ${renderProfileComments(myCommentsResponse.comments)}
        </section>

        ${isAdmin ? `
        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Мои фильмы</span>
                    <h2>Управление контентом</h2>
                </div>
            </div>
            ${renderMovieGrid(myMovies, isAdmin)}
        </section>
        ` : ''}
    `);

    // Обработка кнопок редактирования
    document.querySelectorAll('.profile-edit-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const display = document.querySelector(`.profile-edit-display[data-field="${field}"]`);
            const form = document.querySelector(`.profile-edit-form[data-field="${field}"]`);
            display.style.display = 'none';
            form.style.display = 'flex';
            form.querySelector('.profile-edit-input').focus();
        });
    });

    // Кнопки сохранения
    document.querySelectorAll('.profile-save-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
            const field = btn.dataset.field;
            const form = document.querySelector(`.profile-edit-form[data-field="${field}"]`);
            const input = form.querySelector('.profile-edit-input');
            const value = input.value.trim();
            const messageBox = document.getElementById('profile-form-message');

            if (!value || (field === 'security' && !form.querySelector('[name="securityAnswer"]').value.trim())) {
                messageBox.textContent = 'Поле не может быть пустым.';
                messageBox.classList.remove('hidden');
                messageBox.classList.add('error');
                return;
            }

            try {
                const updateData = {};
                if (field === 'security') {
                    updateData.securityQuestion = form.querySelector('[name="securityQuestion"]').value;
                    updateData.securityAnswer = form.querySelector('[name="securityAnswer"]').value.trim();
                } else {
                    updateData[field] = value;
                }
                
                const response = await apiRequest('/auth/profile', {
                    method: 'PUT',
                    body: JSON.stringify(updateData)
                });

                messageBox.textContent = 'Профиль обновлен.';
                messageBox.classList.remove('hidden', 'error');
                messageBox.classList.add('success');
                
                state.user = response.user;
                setTimeout(() => {
                    renderProfile();
                }, 800);
            } catch (error) {
                messageBox.textContent = error.message || 'Ошибка при обновлении профиля.';
                messageBox.classList.remove('hidden');
                messageBox.classList.add('error');
            }
        });
    });

    // Кнопки отмены
    document.querySelectorAll('.profile-cancel-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const field = btn.dataset.field;
            const display = document.querySelector(`.profile-edit-display[data-field="${field}"]`);
            const form = document.querySelector(`.profile-edit-form[data-field="${field}"]`);
            display.style.display = 'flex';
            form.style.display = 'none';
        });
    });

    if (isAdmin) {
        document.getElementById('movie-form').addEventListener('submit', submitMovieForm);
    }
    attachMovieCardHandlers();
    attachOwnerActions();
}
async function renderAdmin() {
    const usersResponse = await apiRequest('/users');
    const profile = await apiRequest('/auth/me');

    setView(`
        <section class="section-block">
            <div class="section-head">
                <div>
                    <span class="eyebrow">Админ</span>
                    <h1>Управление системой</h1>
                </div>
            </div>

            <div class="admin-grid">
                <div class="admin-card">
                    <h2>Пользователи</h2>
                    <div class="user-list">
                        ${usersResponse.users.map((user) => `
                            <div class="user-row">
                                <form class="edit-user-form" data-user-id="${user.id}">
                                    <input class="input-control" name="name" type="text" value="${escapeAttribute(user.name)}" required>
                                    <input class="input-control" name="email" type="email" value="${escapeAttribute(user.email)}" required>
                                    <select class="input-control" name="role">
                                        <option value="user" ${user.role === 'user' ? 'selected' : ''}>Пользователь</option>
                                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Администратор</option>
                                    </select>
                                    <select class="input-control" name="securityQuestion">
                                        ${renderSecurityQuestionOptions(user.security_question)}
                                    </select>
                                    <input class="input-control" name="securityAnswer" type="text" placeholder="Новый ответ на вопрос">
                                    <div class="form-actions">
                                        <button class="small-button primary" type="submit">Сохранить</button>
                                        ${user.id !== profile.user.id ? `<button class="small-button danger" type="button" data-delete-user-id="${user.id}">Удалить</button>` : ''}
                                    </div>
                                </form>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        </section>
    `);

    attachAdminUserActions();
}

function attachAdminUserActions() {
    document.querySelectorAll('.edit-user-form').forEach((form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const userId = Number(event.currentTarget.dataset.userId);
            const formData = new FormData(event.currentTarget);

            await apiRequest(`/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    name: formData.get('name'),
                    email: formData.get('email'),
                    role: formData.get('role'),
                    ...(formData.get('securityAnswer') ? {
                        securityQuestion: formData.get('securityQuestion'),
                        securityAnswer: formData.get('securityAnswer')
                    } : {})
                })
            });
            await renderAdmin();
        });
    });

    document.querySelectorAll('[data-delete-user-id]').forEach((button) => {
        button.addEventListener('click', async () => {
            if (confirm('Удалить этого пользователя?')) {
                await apiRequest(`/users/${button.dataset.deleteUserId}`, { method: 'DELETE' });
                await renderAdmin();
            }
        });
    });
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
                    <select class="input-control" name="securityQuestion" required>
                        ${renderSecurityQuestionOptions()}
                    </select>
                    <input class="input-control" name="securityAnswer" type="text" placeholder="Ответ на контрольный вопрос" minlength="3" required>
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
                    securityQuestion: formData.get('securityQuestion'),
                    securityAnswer: formData.get('securityAnswer'),
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
                <form id="recover-form" class="auth-form">
                    <input class="input-control" name="email" type="email" placeholder="Email" required>
                    <input class="input-control" name="securityAnswer" type="text" placeholder="Ответ на вопрос" minlength="3" required>
                    <input class="input-control" name="newPassword" type="password" placeholder="Новый пароль" minlength="6" required>
                    <button class="primary-button" type="submit">Сбросить пароль</button>
                    <div id="recover-message" class="status-box hidden"></div>
                </form>
                <p class="form-note">Вернуться ко входу? <button class="inline-link" data-link="/auth/login" type="button">Открыть страницу входа</button></p>
            </div>
        </section>
    `);

    const recoverForm = document.getElementById('recover-form');
    const recoveryEmail = recoverForm.querySelector('[name="email"]');
    const recoveryAnswer = recoverForm.querySelector('[name="securityAnswer"]');
    let recoveryQuestionTimer = null;
    let recoveryQuestionRequestId = 0;

    const loadRecoveryQuestion = async () => {
        const email = recoveryEmail.value.trim();
        const currentRequestId = ++recoveryQuestionRequestId;

        if (!email) {
            recoveryAnswer.placeholder = 'Ответ на вопрос';
            return;
        }

        if (!recoveryEmail.checkValidity()) {
            recoveryAnswer.placeholder = 'Введите корректный email';
            return;
        }

        recoveryAnswer.placeholder = 'Загружаем вопрос...';

        try {
            const data = await apiRequest(`/auth/recovery-question?email=${encodeURIComponent(email)}`);
            if (currentRequestId !== recoveryQuestionRequestId) {
                return;
            }

            recoveryAnswer.placeholder = data.securityQuestion;
        } catch (error) {
            if (currentRequestId !== recoveryQuestionRequestId) {
                return;
            }

            recoveryAnswer.placeholder = 'Ответ на вопрос';
        }
    };

    recoveryEmail.addEventListener('input', () => {
        clearTimeout(recoveryQuestionTimer);
        recoveryQuestionTimer = setTimeout(() => {
            loadRecoveryQuestion();
        }, 300);
    });

    recoveryEmail.addEventListener('blur', () => {
        clearTimeout(recoveryQuestionTimer);
        loadRecoveryQuestion();
    });

    recoverForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearTimeout(recoveryQuestionTimer);
        const formData = new FormData(event.currentTarget);
        const messageBox = document.getElementById('recover-message');

        try {
            const data = await apiRequest('/auth/recover', {
                method: 'POST',
                body: JSON.stringify({
                    email: formData.get('email'),
                    securityAnswer: formData.get('securityAnswer'),
                    newPassword: formData.get('newPassword')
                })
            });

            showStatus(messageBox, data.message, 'success');
            recoverForm.reset();
            recoveryAnswer.placeholder = 'Ответ на вопрос';
        } catch (error) {
            showStatus(messageBox, error.message, 'error');
        }
    });
}
async function renderMovieDetail(match) {
    const movie = await apiRequest(`/movies/${match[1]}`);
    const commentsResponse = await apiRequest(`/movies/${match[1]}/comments`);
    const myRatingResponse = state.user ? await apiRequest(`/movies/${match[1]}/my-rating`) : { rating: null };
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

                ${renderMovieFeedback(movie, commentsResponse.comments, myRatingResponse.rating)}
            </div>
        </div>
    `);

    if (state.user) {
        document.getElementById('favorite-toggle').addEventListener('click', async () => {
            await toggleFavorite(movie.id);
            await renderMovieDetail(match);
        });
    }

    bindMovieFeedback(movie.id, match);
    resetScrollPositionAfterRender();
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
            if (window.location.pathname === '/admin') {
                await renderAdmin();
            } else {
                await renderProfile();
            }
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
