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

function renderSecurityQuestionOptions(selectedQuestion = '') {
    return `
        <option value="" disabled ${selectedQuestion ? '' : 'selected'}>Выберите контрольный вопрос</option>
        ${SECURITY_QUESTIONS.map((question) => `
            <option value="${escapeAttribute(question)}" ${question === selectedQuestion ? 'selected' : ''}>${escapeHtml(question)}</option>
        `).join('')}
    `;
}

function renderMovieFeedback(movie, comments, userRating) {
    return `
        <section class="movie-feedback">
            <div class="feedback-panel">
                <div class="section-head compact">
                    <div>
                        <span class="eyebrow">Оценки</span>
                        <h2>Оцените фильм</h2>
                    </div>
                    <strong class="feedback-score">${Number(movie.rating).toFixed(1)}</strong>
                </div>
                ${state.user ? `
                    <form id="rating-form" class="rating-form">
                        <label class="rating-range">
                            <span>Ваша оценка</span>
                            <input name="rating" type="range" min="1" max="10" step="0.1" value="${escapeAttribute(userRating || Math.max(1, Number(movie.rating) || 7))}">
                            <output id="rating-output">${Number(userRating || Math.max(1, Number(movie.rating) || 7)).toFixed(1)}</output>
                        </label>
                        <button class="small-button accent" type="submit">${userRating ? 'Изменить оценку' : 'Поставить оценку'}</button>
                        <div id="rating-message" class="status-box hidden"></div>
                    </form>
                ` : `
                    <div class="empty-state compact">
                        <h3>Оценки доступны после входа</h3>
                        <p>Войдите в аккаунт, чтобы повлиять на рейтинг фильма.</p>
                    </div>
                `}
            </div>

            <div class="feedback-panel">
                <div class="section-head compact">
                    <div>
                        <span class="eyebrow">Обсуждение</span>
                        <h2>Комментарии</h2>
                    </div>
                </div>
                ${state.user ? `
                    <form id="comment-form" class="comment-form">
                        <textarea class="input-control textarea-control" name="text" placeholder="Поделитесь впечатлением" minlength="2" maxlength="1000" required></textarea>
                        <button class="small-button accent" type="submit">Отправить</button>
                        <div id="comment-message" class="status-box hidden"></div>
                    </form>
                ` : ''}
                ${renderCommentsList(comments)}
            </div>
        </section>
    `;
}

function renderCommentsList(comments) {
    if (!comments.length) {
        return `
            <div class="empty-state compact">
                <h3>Комментариев пока нет</h3>
                <p>Станьте первым, кто оставит мнение об этом фильме.</p>
            </div>
        `;
    }

    return `
        <div class="comments-list">
            ${comments.map((comment) => `
                <article class="comment-card">
                    <div class="comment-head">
                        <strong>${escapeHtml(comment.user_name || 'Пользователь')}</strong>
                        <span>${formatDate(comment.created_at)}</span>
                    </div>
                    <p>${escapeHtml(comment.text)}</p>
                </article>
            `).join('')}
        </div>
    `;
}

function renderProfileComments(comments) {
    if (!comments.length) {
        return document.getElementById('empty-state-template').innerHTML;
    }

    return `
        <div class="comments-list profile-comments-list">
            ${comments.map((comment) => `
                <article class="comment-card">
                    <div class="comment-head">
                        <button class="inline-link" data-link="/detail/${comment.movie_id}" type="button">${escapeHtml(comment.movie_title || 'Фильм')}</button>
                        <span>${formatDate(comment.created_at)}</span>
                    </div>
                    <p>${escapeHtml(comment.text)}</p>
                </article>
            `).join('')}
        </div>
    `;
}

function bindMovieFeedback(movieId, match) {
    const ratingForm = document.getElementById('rating-form');
    const ratingInput = ratingForm?.querySelector('[name="rating"]');
    const ratingOutput = document.getElementById('rating-output');
    if (ratingInput && ratingOutput) {
        ratingInput.addEventListener('input', () => {
            ratingOutput.textContent = Number(ratingInput.value).toFixed(1);
        });
    }

    ratingForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const messageBox = document.getElementById('rating-message');
        const formData = new FormData(event.currentTarget);

        try {
            const data = await apiRequest(`/movies/${movieId}/rating`, {
                method: 'POST',
                body: JSON.stringify({ rating: formData.get('rating') })
            });
            showStatus(messageBox, data.message, 'success');
            await renderMovieDetail(match);
        } catch (error) {
            showStatus(messageBox, error.message, 'error');
        }
    });

    document.getElementById('comment-form')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const messageBox = document.getElementById('comment-message');
        const formData = new FormData(event.currentTarget);

        try {
            const data = await apiRequest(`/movies/${movieId}/comments`, {
                method: 'POST',
                body: JSON.stringify({ text: formData.get('text') })
            });
            showStatus(messageBox, data.message, 'success');
            event.currentTarget.reset();
            await renderMovieDetail(match);
        } catch (error) {
            showStatus(messageBox, error.message, 'error');
        }
    });
}

function renderPaginatedMovieList(movies, page, paginationName) {
    const totalPages = getTotalPages(movies.length);
    const currentPage = clampPage(page, totalPages);
    const startIndex = (currentPage - 1) * APP_CONFIG.catalogPageSize;
    const visibleMovies = movies.slice(startIndex, startIndex + APP_CONFIG.catalogPageSize);
    const wrapperId = paginationName === 'home-popular' ? ' id="home-popular-list"' : '';

    return `
        <div${wrapperId}>
            ${renderMovieGrid(visibleMovies)}
            ${renderPagination(currentPage, totalPages, paginationName)}
        </div>
    `;
}

function getTotalPages(totalItems) {
    return Math.max(1, Math.ceil(totalItems / APP_CONFIG.catalogPageSize));
}

function clampPage(page, totalPages) {
    const numericPage = Number(page);
    if (!Number.isInteger(numericPage)) {
        return 1;
    }

    return Math.min(Math.max(numericPage, 1), totalPages);
}

function getPaginationItems(currentPage, totalPages) {
    const pages = new Set([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
    const result = [];
    let previousPage = 0;

    [...pages]
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b)
        .forEach((page) => {
            if (previousPage && page - previousPage > 1) {
                result.push('gap');
            }

            result.push(page);
            previousPage = page;
        });

    return result;
}

function renderPagination(currentPage, totalPages, paginationName) {
    if (totalPages <= 1) {
        return '';
    }

    const previousPage = Math.max(1, currentPage - 1);
    const nextPage = Math.min(totalPages, currentPage + 1);
    const ariaLabel = paginationName === 'home-popular' ? 'Пагинация популярных фильмов' : 'Пагинация каталога';

    return `
        <nav class="pagination" aria-label="${ariaLabel}">
            <button class="pagination-button pagination-arrow" data-pagination="${paginationName}" data-page="${previousPage}" type="button" ${currentPage === 1 ? 'disabled' : ''} aria-label="Предыдущая страница">&#8249;</button>
            <div class="pagination-pages">
                ${getPaginationItems(currentPage, totalPages).map((item) => {
        if (item === 'gap') {
            return '<span class="pagination-gap">...</span>';
        }

        return `
                    <button class="pagination-button ${item === currentPage ? 'is-active' : ''}" data-pagination="${paginationName}" data-page="${item}" type="button" ${item === currentPage ? 'aria-current="page"' : ''}>
                        ${item}
                    </button>
                `;
    }).join('')}
            </div>
            <button class="pagination-button pagination-arrow" data-pagination="${paginationName}" data-page="${nextPage}" type="button" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Следующая страница">&#8250;</button>
        </nav>
    `;
}

function renderLatestSlider(movies) {
    if (!movies.length) {
        return '';
    }

    return `
        <section class="latest-slider" aria-label="Новинки">
            <div class="latest-slider-head">
                <div>
                    <span class="eyebrow">Новинки</span>
                    <h1>Последние добавления</h1>
                </div>
                <div class="slider-controls">
                    <button class="slider-button" data-slider-prev type="button" aria-label="Предыдущий фильм">&#8249;</button>
                    <button class="slider-button" data-slider-next type="button" aria-label="Следующий фильм">&#8250;</button>
                </div>
            </div>
            <div class="latest-viewport">
                <div class="latest-track" data-latest-track>
                    ${movies.map((movie) => {
        const isFavorite = state.favorites.some((item) => item.id === movie.id);
        return `
                        <article class="latest-slide">
                            <img class="latest-backdrop" src="${escapeAttribute(movie.poster || 'https://placehold.co/1200x675/102033/F3EDE0?text=KinoWeb')}" alt="">
                            <div class="latest-poster">
                                <img src="${escapeAttribute(movie.poster || 'https://placehold.co/600x900/102033/F3EDE0?text=KinoWeb')}" alt="${escapeAttribute(movie.title)}">
                            </div>
                            <div class="latest-info">
                                <div class="movie-topline">
                                    <span>${escapeHtml(movie.genre || 'Без жанра')}</span>
                                    <span>${movie.vyear || 'Год не указан'}</span>
                                </div>
                                <h2>${escapeHtml(movie.title)}</h2>
                                <p>${escapeHtml(movie.description || 'Краткое описание недоступно.')}</p>
                                <div class="latest-actions">
                                    <strong>${Number(movie.rating).toFixed(1)}</strong>
                                    <button class="small-button accent" data-link="/detail/${movie.id}" type="button">${movie.watch_url ? 'Смотреть' : 'Подробнее'}</button>
                                    <button class="small-button accent" data-favorite-id="${movie.id}" type="button">${isFavorite ? 'Убрать' : 'В избранное'}</button>
                                </div>
                            </div>
                        </article>
                    `;
    }).join('')}
                </div>
            </div>
        </section>
    `;
}

function clearLatestSliderTimer() {
    if (!state.latestSliderTimer) {
        return;
    }

    clearInterval(state.latestSliderTimer);
    state.latestSliderTimer = null;
}

function bindLatestSlider() {
    const track = document.querySelector('[data-latest-track]');
    if (!track) {
        return;
    }

    const originalSlides = Array.from(track.querySelectorAll('.latest-slide'));
    if (originalSlides.length <= 1) {
        document.querySelector('.slider-controls')?.remove();
        return;
    }

    const firstClone = originalSlides[0].cloneNode(true);
    const lastClone = originalSlides[originalSlides.length - 1].cloneNode(true);
    firstClone.dataset.clone = 'true';
    lastClone.dataset.clone = 'true';
    track.append(firstClone);
    track.prepend(lastClone);

    let currentIndex = 1;
    let isAnimating = false;
    const lastRealIndex = originalSlides.length;

    const updatePosition = () => {
        track.style.transform = `translateX(-${currentIndex * 100}%)`;
    };

    const jumpToSlide = (index) => {
        currentIndex = index;
        track.classList.remove('is-sliding');
        updatePosition();
        track.offsetHeight;
        requestAnimationFrame(() => track.classList.add('is-sliding'));
    };

    const moveSlider = (direction) => {
        if (isAnimating) {
            return;
        }

        isAnimating = true;
        currentIndex += direction;
        track.classList.add('is-sliding');
        updatePosition();
    };

    const restartAutoplay = () => {
        clearLatestSliderTimer();
        state.latestSliderTimer = setInterval(() => moveSlider(1), 5000);
    };

    jumpToSlide(1);

    document.querySelector('[data-slider-prev]')?.addEventListener('click', () => {
        moveSlider(-1);
        restartAutoplay();
    });
    document.querySelector('[data-slider-next]')?.addEventListener('click', () => {
        moveSlider(1);
        restartAutoplay();
    });

    track.addEventListener('transitionend', () => {
        if (currentIndex === 0) {
            jumpToSlide(lastRealIndex);
            isAnimating = false;
            return;
        }

        if (currentIndex === lastRealIndex + 1) {
            jumpToSlide(1);
            isAnimating = false;
            return;
        }

        isAnimating = false;
    });

    restartAutoplay();
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
                        <h2>Твое кино здесь</h2>
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
