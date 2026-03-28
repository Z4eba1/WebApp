require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const PUBLIC_DIR = path.join(__dirname, 'public');

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'kinoweb',
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createToken(user) {
    return jwt.sign(
        { userId: user.id, email: user.email, name: user.name },
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
        req.user = payload;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Сессия истекла или токен недействителен.' });
    }
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

async function initializeDatabase() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            keyword VARCHAR(100) NULL,
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

    const userColumns = await getColumnNames('users');
    if (!userColumns.includes('keyword')) {
        await pool.execute('ALTER TABLE users ADD COLUMN keyword VARCHAR(100) NULL');
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
            'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
            ['demo@kinoweb.local', passwordHash, 'Demo User']
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

app.post('/api/auth/register', async (req, res) => {
    try {
        const payload = {
            name: String(req.body.name || '').trim(),
            email: String(req.body.email || '').trim().toLowerCase(),
            password: String(req.body.password || ''),
            keyword: String(req.body.keyword || '').trim()
        };
        const errors = validateRegisterBody(payload);

        if (errors.length) {
            return res.status(400).json({ message: errors[0], errors });
        }

        const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', [payload.email]);
        if (existingUsers.length) {
            return res.status(409).json({ message: 'Пользователь с таким email уже существует.' });
        }

        const passwordHash = await bcrypt.hash(payload.password, 10);
        const [result] = await pool.execute(
            'INSERT INTO users (email, password_hash, name, keyword) VALUES (?, ?, ?, ?)',
            [payload.email, passwordHash, payload.name, payload.keyword]
        );

        const user = { id: result.insertId, email: payload.email, name: payload.name };
        const token = createToken(user);

        res.status(201).json({
            message: 'Регистрация прошла успешно.',
            token,
            user
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Не удалось зарегистрировать пользователя.' });
    }
});

app.post('/api/auth/recover', async (req, res) => {
    try {
        const payload = {
            email: String(req.body.email || '').trim().toLowerCase(),
            keyword: String(req.body.keyword || '').trim(),
            newPassword: String(req.body.newPassword || '')
        };
        const errors = validateRecoveryBody(payload);

        if (errors.length) {
            return res.status(400).json({ message: errors[0], errors });
        }

        const [users] = await pool.execute(
            'SELECT id, keyword FROM users WHERE email = ?',
            [payload.email]
        );

        if (!users.length) {
            return res.status(404).json({ message: 'Пользователь с таким email не найден.' });
        }

        const user = users[0];
        if (!user.keyword || user.keyword !== payload.keyword) {
            return res.status(401).json({ message: 'Неверное ключевое слово.' });
        }

        const passwordHash = await bcrypt.hash(payload.newPassword, 10);
        await pool.execute(
            'UPDATE users SET password_hash = ? WHERE id = ?',
            [passwordHash, user.id]
        );

        res.json({ message: 'Пароль обновлён. Теперь можно войти с новым паролем.' });
    } catch (error) {
        console.error('Recover password error:', error);
        res.status(500).json({ message: 'Не удалось восстановить пароль.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const email = String(req.body.email || '').trim().toLowerCase();
        const password = String(req.body.password || '');

        if (!emailRegex.test(email) || password.length < 6) {
            return res.status(400).json({ message: 'Проверьте email и пароль.' });
        }

        const [users] = await pool.execute(
            'SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?',
            [email]
        );

        if (!users.length) {
            return res.status(401).json({ message: 'Неверный email или пароль.' });
        }

        const user = users[0];
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Неверный email или пароль.' });
        }

        const token = createToken(user);
        res.json({
            message: 'Вход выполнен.',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                created_at: user.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Не удалось выполнить вход.' });
    }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const [users] = await pool.execute(
            'SELECT id, email, name, created_at FROM users WHERE id = ?',
            [req.user.userId]
        );

        if (!users.length) {
            return res.status(404).json({ message: 'Пользователь не найден.' });
        }

        res.json({ user: users[0] });
    } catch (error) {
        console.error('Auth me error:', error);
        res.status(500).json({ message: 'Не удалось получить профиль.' });
    }
});