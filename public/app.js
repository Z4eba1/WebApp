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

