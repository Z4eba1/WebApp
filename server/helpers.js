const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, pool, emailRegex, securityQuestions } = require('./config');

function isValidHttpUrl(value) {
    try {
        const parsedUrl = new URL(value);
        return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch (error) {
        return false;
    }
}

function createToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email, name: user.name, role: user.role || 'user' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

function normalizeMovie(movie) {
    return {
        id: movie.id,
        title: movie.title,
        description: movie.description,
        poster: movie.poster,
        watch_url: movie.watch_url,
        vyear: movie.vyear,
        rating: Number(movie.rating),
        genre: movie.genre,
        is_popular: Boolean(movie.is_popular),
        created_at: movie.created_at,
        updated_at: movie.updated_at,
        owner_id: movie.user_id,
        author: movie.author
    };
}

function normalizeComment(comment) {
    return {
        id: comment.id,
        movie_id: comment.movie_id,
        movie_title: comment.movie_title,
        user_id: comment.user_id,
        user_name: comment.user_name,
        text: comment.text,
        created_at: comment.created_at,
        updated_at: comment.updated_at
    };
}

function validateRegisterBody(body) {
    const errors = [];

    if (!body.name || String(body.name).trim().length < 2) {
        errors.push('Имя должно содержать не менее 2 символов.');
    }

    if (!body.email || !emailRegex.test(String(body.email).trim())) {
        errors.push('Укажите корректный email.');
    }

    if (!body.password || String(body.password).length < 6) {
        errors.push('Пароль должен содержать не менее 6 символов.');
    }

    if (!body.keyword || String(body.keyword).trim().length < 3) {
        errors.push('Ключевое слово должно содержать не менее 3 символов.');
    }

    return errors;
}

function validateRecoveryBody(body) {
    const errors = [];

    if (!body.email || !emailRegex.test(String(body.email).trim())) {
        errors.push('Укажите корректный email.');
    }

    if (!body.keyword || String(body.keyword).trim().length < 3) {
        errors.push('Введите корректное ключевое слово.');
    }

    if (!body.newPassword || String(body.newPassword).length < 6) {
        errors.push('Новый пароль должен содержать не менее 6 символов.');
    }

    return errors;
}

function normalizeSecurityAnswer(value) {
    return String(value || '').trim().toLowerCase();
}

function validateSecurityRegisterBody(body) {
    const errors = [];

    if (!body.name || String(body.name).trim().length < 2) {
        errors.push('Имя должно содержать не менее 2 символов.');
    }

    if (!body.email || !emailRegex.test(String(body.email).trim())) {
        errors.push('Укажите корректный email.');
    }

    if (!body.password || String(body.password).length < 6) {
        errors.push('Пароль должен содержать не менее 6 символов.');
    }

    if (false && (!body.securityQuestion || !securityQuestions.includes(String(body.securityQuestion).trim()))) {
        errors.push('Выберите контрольный вопрос.');
    }

    if (!body.securityAnswer || String(body.securityAnswer).trim().length < 3) {
        errors.push('Ответ на контрольный вопрос должен содержать не менее 3 символов.');
    }

    return errors;
}

function validateSecurityRecoveryBody(body) {
    const errors = [];

    if (!body.email || !emailRegex.test(String(body.email).trim())) {
        errors.push('Укажите корректный email.');
    }

    if (!body.securityQuestion || !securityQuestions.includes(String(body.securityQuestion).trim())) {
        errors.push('Выберите контрольный вопрос.');
    }

    if (!body.securityAnswer || String(body.securityAnswer).trim().length < 3) {
        errors.push('Введите ответ на контрольный вопрос.');
    }

    if (!body.newPassword || String(body.newPassword).length < 6) {
        errors.push('Новый пароль должен содержать не менее 6 символов.');
    }

    return errors;
}

function validateMovieBody(body) {
    const errors = [];

    if (!body.title || String(body.title).trim().length < 2) {
        errors.push('Название фильма должно содержать не менее 2 символов.');
    }

    if (body.description && String(body.description).trim().length > 1500) {
        errors.push('Описание слишком длинное.');
    }

    if (body.poster && String(body.poster).trim().length > 500) {
        errors.push('Ссылка на постер слишком длинная.');
    }

    if (body.watch_url && String(body.watch_url).trim().length > 1000) {
        errors.push('Ссылка на видео слишком длинная.');
    }

    if (body.watch_url && !isValidHttpUrl(String(body.watch_url).trim())) {
        errors.push('Укажите корректную ссылку на просмотр.');
    }

    if (body.vyear !== undefined && body.vyear !== null && body.vyear !== '') {
        const year = Number(body.vyear);
        if (!Number.isInteger(year) || year < 1888 || year > 2100) {
            errors.push('Год выпуска должен быть числом от 1888 до 2100.');
        }
    }

    if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
        const rating = Number(body.rating);
        if (Number.isNaN(rating) || rating < 0 || rating > 10) {
            errors.push('Рейтинг должен быть числом от 0 до 10.');
        }
    }

    if (body.genre && String(body.genre).trim().length > 100) {
        errors.push('Жанр слишком длинный.');
    }

    return errors;
}

async function authenticateToken(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: 'Требуется авторизация.' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = { ...payload, role: payload.role || 'user' };
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Сессия истекла или токен недействителен.' });
    }
}

function ensureAdmin(req, res, next) {
    if (!req.user || !req.user.userId) {
        return res.status(403).json({ message: 'Требуются права администратора.' });
    }

    pool.execute('SELECT role FROM users WHERE id = ?', [req.user.userId])
        .then(([rows]) => {
            if (!rows.length || rows[0].role !== 'admin') {
                return res.status(403).json({ message: 'Требуются права администратора.' });
            }
            next();
        })
        .catch((error) => {
            console.error('Ensure admin error:', error);
            res.status(500).json({ message: 'Ошибка сервера.' });
        });
}

async function getColumnNames(tableName) {
    const [rows] = await pool.query(`SHOW COLUMNS FROM ${tableName}`);
    return rows.map((row) => row.Field);
}

async function ensureMovieOwner(req, res, next) {
    const movieId = Number(req.params.id);

    if (!Number.isInteger(movieId)) {
        return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
    }

    const [rows] = await pool.execute('SELECT user_id FROM movies WHERE id = ?', [movieId]);

    if (!rows.length) {
        return res.status(404).json({ message: 'Фильм не найден.' });
    }

    if (rows[0].user_id !== req.user.userId) {
        return res.status(403).json({ message: 'Изменять фильм может только его автор.' });
    }

    next();
}

async function recalculateMovieRating(movieId) {
    const [rows] = await pool.execute(
        'SELECT AVG(rating) AS average_rating FROM movie_ratings WHERE movie_id = ?',
        [movieId]
    );
    const averageRating = rows[0].average_rating === null ? 0 : Number(rows[0].average_rating);

    await pool.execute(
        'UPDATE movies SET rating = ? WHERE id = ?',
        [averageRating.toFixed(1), movieId]
    );

    return averageRating;
}

async function initializeDatabase() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            keyword VARCHAR(100) NULL,
            security_question VARCHAR(255) NULL,
            security_answer VARCHAR(255) NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'user',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS movies (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT NULL,
            poster VARCHAR(500) NULL,
            watch_url VARCHAR(1000) NULL,
            vyear INT NULL,
            rating DECIMAL(3,1) NOT NULL DEFAULT 0,
            genre VARCHAR(100) NULL,
            is_popular BOOLEAN NOT NULL DEFAULT FALSE,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_movies_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS favorites (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            movie_id INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_movie (user_id, movie_id),
            CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_favorites_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS movie_ratings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            movie_id INT NOT NULL,
            rating DECIMAL(3,1) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_user_movie_rating (user_id, movie_id),
            CONSTRAINT fk_movie_ratings_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_movie_ratings_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
        )
    `);

    await pool.execute(`
        CREATE TABLE IF NOT EXISTS movie_comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            movie_id INT NOT NULL,
            text TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_movie_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            CONSTRAINT fk_movie_comments_movie FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
        )
    `);

    const userColumns = await getColumnNames('users');
    if (!userColumns.includes('keyword')) {
        await pool.execute('ALTER TABLE users ADD COLUMN keyword VARCHAR(100) NULL');
    }
    if (!userColumns.includes('security_question')) {
        await pool.execute('ALTER TABLE users ADD COLUMN security_question VARCHAR(255) NULL');
    }
    if (!userColumns.includes('security_answer')) {
        await pool.execute('ALTER TABLE users ADD COLUMN security_answer VARCHAR(255) NULL');
    }
    if (!userColumns.includes('role')) {
        await pool.execute("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'");
    }
    if (!userColumns.includes('created_at')) {
        await pool.execute('ALTER TABLE users ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }

    const movieColumns = await getColumnNames('movies');
    if (!movieColumns.includes('user_id')) {
        await pool.execute('ALTER TABLE movies ADD COLUMN user_id INT NULL');
    }
    if (!movieColumns.includes('vyear') && movieColumns.includes('year')) {
        await pool.execute('ALTER TABLE movies CHANGE COLUMN year vyear INT NULL');
    } else if (!movieColumns.includes('vyear')) {
        await pool.execute('ALTER TABLE movies ADD COLUMN vyear INT NULL');
    }
    if (!movieColumns.includes('watch_url')) {
        await pool.execute('ALTER TABLE movies ADD COLUMN watch_url VARCHAR(1000) NULL');
    }
    if (!movieColumns.includes('created_at')) {
        await pool.execute('ALTER TABLE movies ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }
    if (!movieColumns.includes('updated_at')) {
        await pool.execute('ALTER TABLE movies ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');
    }

    const favoriteColumns = await getColumnNames('favorites');
    if (!favoriteColumns.includes('created_at')) {
        await pool.execute('ALTER TABLE favorites ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP');
    }

    const [users] = await pool.execute('SELECT id FROM users ORDER BY id ASC LIMIT 1');
    let authorId;

    if (!users.length) {
        const passwordHash = await bcrypt.hash('demo1234', 10);
        const [result] = await pool.execute(
            'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
            ['demo@kinoweb.local', passwordHash, 'Demo Admin', 'admin']
        );
        authorId = result.insertId;
    } else {
        authorId = users[0].id;
    }

    await pool.execute('UPDATE movies SET user_id = ? WHERE user_id IS NULL', [authorId]);

    const [movies] = await pool.execute('SELECT COUNT(*) AS total FROM movies');
    if (movies[0].total > 0) {
        return;
    }

    for (const movie of demoMovies) {
        await pool.execute(
            `INSERT INTO movies (user_id, title, description, poster, vyear, rating, genre, is_popular)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [authorId, ...movie]
        );
    }
}

module.exports = {
    emailRegex,
    securityQuestions,
    createToken,
    normalizeMovie,
    normalizeComment,
    validateRegisterBody,
    validateRecoveryBody,
    normalizeSecurityAnswer,
    validateSecurityRegisterBody,
    validateSecurityRecoveryBody,
    validateMovieBody,
    authenticateToken,
    ensureAdmin,
    ensureMovieOwner,
    recalculateMovieRating,
    initializeDatabase
};
