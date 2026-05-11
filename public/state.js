const APP_CONFIG = {
    basePath: getAppBasePath(),
    apiBaseUrl: `${getAppBasePath()}/api`,
    storageKeys: {
        token: 'kinoweb_token'
    },
    catalogPageSize: 9,
    mobileBreakpoint: 1100
};

function getAppBasePath() {
    const firstPathSegment = window.location.pathname.split('/').filter(Boolean)[0];

    if (window.location.hostname.endsWith('github.io') && firstPathSegment) {
        return `/${firstPathSegment}`;
    }

    return '';
}

function createInitialState() {
    return {
        token: localStorage.getItem(APP_CONFIG.storageKeys.token),
        user: null,
        favorites: [],
        movies: [],
        popularMovies: [],
        myMovies: [],
        latestSliderTimer: null,
        catalogPage: 1,
        homePopularPage: 1,
        mobileNavOpen: false
    };
}

const state = createInitialState();
const SECURITY_QUESTIONS = [
    'Как звали вашего первого питомца?',
    'В каком городе вы родились?',
    'Какая ваша любимая книга?',
    'Как звали вашего первого учителя?',
    'Какой ваш любимый фильм?'
];
