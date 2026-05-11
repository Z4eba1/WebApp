function updateNavigation() {
    const nav = document.getElementById('site-nav');
    const currentPath = normalizePath(window.location.pathname);

    if (state.user) {
        nav.innerHTML = `
            <button class="${getNavLinkClass('/', currentPath)}" data-link="/">Главная</button>
            <button class="${getNavLinkClass('/catalog', currentPath)}" data-link="/catalog">Каталог</button>
            <button class="${getNavLinkClass('/search', currentPath)}" data-link="/search">Поиск</button>
            <button class="${getNavLinkClass('/favorites', currentPath)}" data-link="/favorites">Избранное</button>
            <button class="${getNavLinkClass('/profile', currentPath)}" data-link="/profile">Профиль</button>
            ${state.user.role === 'admin' ? `<button class="${getNavLinkClass('/admin', currentPath)}" data-link="/admin">Админ</button>` : ''}
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
    clearLatestSliderTimer();
    document.getElementById('app-view').innerHTML = html;
}
