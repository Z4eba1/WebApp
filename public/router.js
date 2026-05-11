const routes = [
    { path: '/', view: renderHome },
    { path: '/catalog', view: renderCatalog },
    { path: '/search', view: renderSearch },
    { path: '/favorites', view: renderFavorites, private: true },
    { path: '/profile', view: renderProfile, private: true },
    { path: '/admin', view: renderAdmin, private: true, admin: true },
    { path: '/auth/login', view: renderLogin },
    { path: '/auth/register', view: renderRegister },
    { path: '/auth/recover', view: renderRecover },
    { path: /^\/detail\/(\d+)$/, view: renderMovieDetail }
];

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
    resetScrollPosition();
    window.history.pushState({}, '', withBasePath(path));
    router();
}

function resetScrollPosition() {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlScrollBehavior = html.style.scrollBehavior;
    const previousBodyScrollBehavior = body.style.scrollBehavior;

    html.style.scrollBehavior = 'auto';
    body.style.scrollBehavior = 'auto';
    html.scrollTop = 0;
    body.scrollTop = 0;
    window.scrollTo(0, 0);
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    html.style.scrollBehavior = previousHtmlScrollBehavior;
    body.style.scrollBehavior = previousBodyScrollBehavior;
}

function resetScrollPositionAfterRender() {
    resetScrollPosition();
    requestAnimationFrame(() => {
        resetScrollPosition();
        requestAnimationFrame(resetScrollPosition);
    });
    setTimeout(resetScrollPosition, 50);
    setTimeout(resetScrollPosition, 250);
}

function normalizePath(pathname) {
    const path = stripBasePath(pathname);

    if (!path || path === '/') {
        return '/';
    }

    return path.endsWith('/') ? path.slice(0, -1) : path;
}

function stripBasePath(pathname) {
    if (!APP_CONFIG.basePath || pathname === APP_CONFIG.basePath) {
        return pathname === APP_CONFIG.basePath ? '/' : pathname;
    }

    return pathname.startsWith(`${APP_CONFIG.basePath}/`)
        ? pathname.slice(APP_CONFIG.basePath.length)
        : pathname;
}

function withBasePath(path) {
    if (!APP_CONFIG.basePath || path.startsWith(APP_CONFIG.basePath)) {
        return path;
    }

    return `${APP_CONFIG.basePath}${path}`;
}

async function router() {
    const currentPath = normalizePath(window.location.pathname);
    let match = null;
    let route = null;

    if (currentPath !== window.location.pathname) {
        window.history.replaceState({}, '', `${withBasePath(currentPath)}${window.location.search}${window.location.hash}`);
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
        updateNavigation();
        renderNotFound();
        resetScrollPositionAfterRender();
        return;
    }

    if (route.private && !state.user) {
        window.history.replaceState({}, '', withBasePath('/auth/login'));
        return router();
    }

    if (route.admin && (!state.user || state.user.role !== 'admin')) {
        window.history.replaceState({}, '', withBasePath(state.user ? '/profile' : '/auth/login'));
        return router();
    }

    try {
        updateNavigation();
        resetScrollPosition();
        await route.view(match);
        resetScrollPositionAfterRender();
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

function renderNotFound() {
    setView(`
        <section class="section-block">
            <div class="empty-state">
                <h3>Страница не найдена</h3>
                <p>Проверьте адрес или вернитесь к каталогу фильмов.</p>
                <div class="hero-actions">
                    <button class="primary-button" data-link="/" type="button">На главную</button>
                    <button class="ghost-button" data-link="/catalog" type="button">Открыть каталог</button>
                </div>
            </div>
        </section>
    `);
}
