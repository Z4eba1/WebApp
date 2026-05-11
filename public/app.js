document.addEventListener('DOMContentLoaded', async () => {
    if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
    }

    bindGlobalEvents();
    await bootstrapSession();
    router();
});
