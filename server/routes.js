const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { INDEX_FILE, JWT_SECRET, pool, emailRegex, securityQuestions } = require('./config');
const {
    createToken,
    normalizeMovie,
    normalizeComment,
    normalizeSecurityAnswer,
    validateSecurityRegisterBody,
    validateSecurityRecoveryBody,
    validateMovieBody,
    authenticateToken,
    ensureAdmin,
    recalculateMovieRating
} = require('./helpers');

function registerRoutes(app) {
    app.post('/api/auth/register', async (req, res) => {
        try {
            const payload = {
                name: String(req.body.name || '').trim(),
                email: String(req.body.email || '').trim().toLowerCase(),
                password: String(req.body.password || ''),
                securityQuestion: String(req.body.securityQuestion || '').trim(),
                securityAnswer: String(req.body.securityAnswer || '').trim()
            };
            const errors = validateSecurityRegisterBody(payload);
    
            if (errors.length) {
                return res.status(400).json({ message: errors[0], errors });
            }
    
            const [existingUsers] = await pool.execute('SELECT id FROM users WHERE email = ?', [payload.email]);
            if (existingUsers.length) {
                return res.status(409).json({ message: 'Пользователь с таким email уже существует.' });
            }
    
            const passwordHash = await bcrypt.hash(payload.password, 10);
            const [result] = await pool.execute(
                'INSERT INTO users (email, password_hash, name, security_question, security_answer, keyword) VALUES (?, ?, ?, ?, ?, ?)',
                [payload.email, passwordHash, payload.name, payload.securityQuestion, normalizeSecurityAnswer(payload.securityAnswer), normalizeSecurityAnswer(payload.securityAnswer)]
            );
    
            const user = { id: result.insertId, email: payload.email, name: payload.name, role: 'user' };
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
    
    app.get('/api/auth/recovery-question', async (req, res) => {
        try {
            const email = String(req.query.email || '').trim().toLowerCase();
    
            if (!emailRegex.test(email)) {
                return res.status(400).json({ message: 'Укажите корректный email.' });
            }
    
            const [users] = await pool.execute(
                'SELECT security_question FROM users WHERE email = ?',
                [email]
            );
    
            if (!users.length || !users[0].security_question) {
                return res.status(404).json({ message: 'Пользователь с таким email не найден.' });
            }
    
            res.json({ securityQuestion: users[0].security_question });
        } catch (error) {
            console.error('Get recovery question error:', error);
            res.status(500).json({ message: 'Не удалось получить контрольный вопрос.' });
        }
    });
    
    app.post('/api/auth/recover', async (req, res) => {
        try {
            const payload = {
                email: String(req.body.email || '').trim().toLowerCase(),
                securityAnswer: String(req.body.securityAnswer || '').trim(),
                newPassword: String(req.body.newPassword || '')
            };
            const errors = validateSecurityRecoveryBody(payload);
    
            if (errors.length) {
                return res.status(400).json({ message: errors[0], errors });
            }
    
            const [users] = await pool.execute(
                'SELECT id, keyword, security_question, security_answer FROM users WHERE email = ?',
                [payload.email]
            );
    
            if (!users.length) {
                return res.status(404).json({ message: 'Пользователь с таким email не найден.' });
            }
    
            const user = users[0];
            const expectedAnswer = user.security_answer || user.keyword;
            if (!user.security_question || !expectedAnswer || expectedAnswer !== normalizeSecurityAnswer(payload.securityAnswer)) {
                return res.status(401).json({ message: 'Неверный контрольный вопрос или ответ.' });
            }
            user.keyword = expectedAnswer;
            payload.keyword = user.keyword;
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
                'SELECT id, email, password_hash, name, role, created_at FROM users WHERE email = ?',
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
                    role: user.role,
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
                'SELECT id, email, name, role, keyword, security_question, created_at FROM users WHERE id = ?',
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
    
    app.put('/api/auth/profile', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            const updates = [];
            const values = [];
    
            if (req.body.name !== undefined) {
                const name = String(req.body.name).trim();
                if (name.length < 2) {
                    return res.status(400).json({ message: 'Имя должно содержать не менее 2 символов.' });
                }
                updates.push('name = ?');
                values.push(name);
            }
    
            if (req.body.email !== undefined) {
                const email = String(req.body.email).trim().toLowerCase();
                if (!emailRegex.test(email)) {
                    return res.status(400).json({ message: 'Укажите корректный email.' });
                }
                updates.push('email = ?');
                values.push(email);
            }
    
            if (req.body.keyword !== undefined) {
                const keyword = String(req.body.keyword).trim();
                if (keyword.length < 3) {
                    return res.status(400).json({ message: 'Ключевое слово должно содержать не менее 3 символов.' });
                }
                updates.push('keyword = ?');
                values.push(keyword);
            }
    
            if (req.body.securityQuestion !== undefined || req.body.securityAnswer !== undefined) {
                const securityQuestion = String(req.body.securityQuestion || '').trim();
                const securityAnswer = String(req.body.securityAnswer || '').trim();
                if (!securityQuestions.includes(securityQuestion)) {
                    return res.status(400).json({ message: 'Выберите контрольный вопрос.' });
                }
                if (securityAnswer.length < 3) {
                    return res.status(400).json({ message: 'Ответ на контрольный вопрос должен содержать не менее 3 символов.' });
                }
                updates.push('security_question = ?', 'security_answer = ?', 'keyword = ?');
                values.push(securityQuestion, normalizeSecurityAnswer(securityAnswer), normalizeSecurityAnswer(securityAnswer));
            }
    
            if (!updates.length) {
                return res.status(400).json({ message: 'Нет данных для обновления.' });
            }
    
            values.push(userId);
            await pool.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
    
            const [rows] = await pool.execute(
                'SELECT id, email, name, role, keyword, security_question, created_at FROM users WHERE id = ?',
                [userId]
            );
    
            if (!rows.length) {
                return res.status(404).json({ message: 'Пользователь не найден.' });
            }
    
            res.json({ 
                message: 'Профиль обновлен.',
                user: rows[0]
            });
        } catch (error) {
            console.error('Profile update error:', error);
            res.status(500).json({ message: 'Не удалось обновить профиль.' });
        }
    });
    
    app.get('/api/movies/search', async (req, res) => {
        try {
            const search = String(req.query.q || '').trim();
    
            if (!search) {
                return res.json([]);
            }
    
            const [rows] = await pool.execute(
                `SELECT m.*, u.name AS author
                 FROM movies m
                 JOIN users u ON u.id = m.user_id
                 WHERE m.title LIKE ? OR m.description LIKE ? OR m.genre LIKE ?
                 ORDER BY m.is_popular DESC, m.rating DESC, m.created_at DESC`,
                [`%${search}%`, `%${search}%`, `%${search}%`]
            );
    
            res.json(rows.map(normalizeMovie));
        } catch (error) {
            console.error('Movie search error:', error);
            res.status(500).json({ message: 'Не удалось выполнить поиск.' });
        }
    });
    
    app.get('/api/movies', async (req, res) => {
        try {
            const conditions = [];
            const values = [];
    
            if (req.query.popular === 'true') {
                conditions.push('m.is_popular = TRUE');
            }
    
            if (req.query.genre) {
                conditions.push('LOWER(m.genre) LIKE LOWER(?)');
                values.push(`%${String(req.query.genre).trim()}%`);
            }
    
            if (req.query.year) {
                conditions.push('m.vyear = ?');
                values.push(Number(req.query.year));
            }
    
            if (req.query.rating) {
                conditions.push('m.rating >= ?');
                values.push(Number(req.query.rating));
            }
    
            if (req.query.user === 'me' && req.headers.authorization) {
                try {
                    const token = req.headers.authorization.startsWith('Bearer ')
                        ? req.headers.authorization.slice(7)
                        : null;
                    if (token) {
                        const payload = jwt.verify(token, JWT_SECRET);
                        conditions.push('m.user_id = ?');
                        values.push(payload.userId);
                    }
                } catch (error) {
                    // Ignore invalid optional token on public list endpoint.
                }
            }
    
            const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
            const [rows] = await pool.execute(
                `SELECT m.*, u.name AS author
                 FROM movies m
                 JOIN users u ON u.id = m.user_id
                 ${whereClause}
                 ORDER BY m.is_popular DESC, m.rating DESC, m.created_at DESC`,
                values
            );
    
            res.json(rows.map(normalizeMovie));
        } catch (error) {
            console.error('Get movies error:', error);
            res.status(500).json({ message: 'Не удалось получить список фильмов.' });
        }
    });
    
    app.get('/api/movies/:id', async (req, res) => {
        try {
            const movieId = Number(req.params.id);
            if (!Number.isInteger(movieId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
            }
    
            const [rows] = await pool.execute(
                `SELECT m.*, u.name AS author
                 FROM movies m
                 JOIN users u ON u.id = m.user_id
                 WHERE m.id = ?`,
                [movieId]
            );
    
            if (!rows.length) {
                return res.status(404).json({ message: 'Фильм не найден.' });
            }
    
            res.json(normalizeMovie(rows[0]));
        } catch (error) {
            console.error('Get movie by id error:', error);
            res.status(500).json({ message: 'Не удалось получить фильм.' });
        }
    });
    
    app.get('/api/movies/:id/comments', async (req, res) => {
        try {
            const movieId = Number(req.params.id);
            if (!Number.isInteger(movieId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
            }
    
            const [rows] = await pool.execute(
                `SELECT c.*, u.name AS user_name, m.title AS movie_title
                 FROM movie_comments c
                 JOIN users u ON u.id = c.user_id
                 JOIN movies m ON m.id = c.movie_id
                 WHERE c.movie_id = ?
                 ORDER BY c.created_at DESC`,
                [movieId]
            );
    
            res.json({ comments: rows.map(normalizeComment) });
        } catch (error) {
            console.error('Get movie comments error:', error);
            res.status(500).json({ message: 'Не удалось получить комментарии.' });
        }
    });
    
    app.get('/api/movies/:id/my-rating', authenticateToken, async (req, res) => {
        try {
            const movieId = Number(req.params.id);
            if (!Number.isInteger(movieId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
            }
    
            const [rows] = await pool.execute(
                'SELECT rating FROM movie_ratings WHERE user_id = ? AND movie_id = ?',
                [req.user.userId, movieId]
            );
    
            res.json({ rating: rows.length ? Number(rows[0].rating) : null });
        } catch (error) {
            console.error('Get user rating error:', error);
            res.status(500).json({ message: 'Не удалось получить вашу оценку.' });
        }
    });
    
    app.post('/api/movies/:id/rating', authenticateToken, async (req, res) => {
        try {
            const movieId = Number(req.params.id);
            const rating = Number(req.body.rating);
    
            if (!Number.isInteger(movieId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
            }
    
            if (Number.isNaN(rating) || rating < 1 || rating > 10) {
                return res.status(400).json({ message: 'Оценка должна быть числом от 1 до 10.' });
            }
    
            const [movies] = await pool.execute('SELECT id FROM movies WHERE id = ?', [movieId]);
            if (!movies.length) {
                return res.status(404).json({ message: 'Фильм не найден.' });
            }
    
            await pool.execute(
                `INSERT INTO movie_ratings (user_id, movie_id, rating)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = CURRENT_TIMESTAMP`,
                [req.user.userId, movieId, rating]
            );
    
            const averageRating = await recalculateMovieRating(movieId);
            res.json({ message: 'Оценка сохранена.', rating, averageRating });
        } catch (error) {
            console.error('Set movie rating error:', error);
            res.status(500).json({ message: 'Не удалось сохранить оценку.' });
        }
    });
    
    app.post('/api/movies/:id/comments', authenticateToken, async (req, res) => {
        try {
            const movieId = Number(req.params.id);
            const text = String(req.body.text || '').trim();
    
            if (!Number.isInteger(movieId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
            }
    
            if (text.length < 2 || text.length > 1000) {
                return res.status(400).json({ message: 'Комментарий должен содержать от 2 до 1000 символов.' });
            }
    
            const [movies] = await pool.execute('SELECT id FROM movies WHERE id = ?', [movieId]);
            if (!movies.length) {
                return res.status(404).json({ message: 'Фильм не найден.' });
            }
    
            const [result] = await pool.execute(
                'INSERT INTO movie_comments (user_id, movie_id, text) VALUES (?, ?, ?)',
                [req.user.userId, movieId, text]
            );
    
            const [rows] = await pool.execute(
                `SELECT c.*, u.name AS user_name, m.title AS movie_title
                 FROM movie_comments c
                 JOIN users u ON u.id = c.user_id
                 JOIN movies m ON m.id = c.movie_id
                 WHERE c.id = ?`,
                [result.insertId]
            );
    
            res.status(201).json({ message: 'Комментарий добавлен.', comment: normalizeComment(rows[0]) });
        } catch (error) {
            console.error('Add movie comment error:', error);
            res.status(500).json({ message: 'Не удалось добавить комментарий.' });
        }
    });
    
    app.get('/api/comments/me', authenticateToken, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                `SELECT c.*, u.name AS user_name, m.title AS movie_title
                 FROM movie_comments c
                 JOIN users u ON u.id = c.user_id
                 JOIN movies m ON m.id = c.movie_id
                 WHERE c.user_id = ?
                 ORDER BY c.created_at DESC`,
                [req.user.userId]
            );
    
            res.json({ comments: rows.map(normalizeComment) });
        } catch (error) {
            console.error('Get my comments error:', error);
            res.status(500).json({ message: 'Не удалось получить ваши комментарии.' });
        }
    });
    
    app.post('/api/movies', authenticateToken, ensureAdmin, async (req, res) => {
        try {
            const payload = {
                title: String(req.body.title || '').trim(),
                description: String(req.body.description || '').trim(),
                poster: String(req.body.poster || '').trim(),
                watch_url: String(req.body.watch_url || '').trim(),
                vyear: req.body.vyear === '' ? null : req.body.vyear,
                rating: req.body.rating === '' ? 0 : req.body.rating,
                genre: String(req.body.genre || '').trim(),
                is_popular: Boolean(req.body.is_popular)
            };
    
            const errors = validateMovieBody(payload);
            if (errors.length) {
                return res.status(400).json({ message: errors[0], errors });
            }
    
            const [result] = await pool.execute(
                `INSERT INTO movies (user_id, title, description, poster, watch_url, vyear, rating, genre, is_popular)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.userId,
                    payload.title,
                    payload.description || null,
                    payload.poster || null,
                    payload.watch_url || null,
                    payload.vyear ? Number(payload.vyear) : null,
                    Number(payload.rating || 0),
                    payload.genre || null,
                    payload.is_popular
                ]
            );
    
            const [rows] = await pool.execute(
                `SELECT m.*, u.name AS author
                 FROM movies m
                 JOIN users u ON u.id = m.user_id
                 WHERE m.id = ?`,
                [result.insertId]
            );
    
            res.status(201).json({
                message: 'Фильм добавлен.',
                movie: normalizeMovie(rows[0])
            });
        } catch (error) {
            console.error('Create movie error:', error);
            res.status(500).json({ message: 'Не удалось добавить фильм.' });
        }
    });
    
    app.put('/api/movies/:id', authenticateToken, ensureAdmin, async (req, res) => {
        try {
            const payload = {
                title: String(req.body.title || '').trim(),
                description: String(req.body.description || '').trim(),
                poster: String(req.body.poster || '').trim(),
                watch_url: String(req.body.watch_url || '').trim(),
                vyear: req.body.vyear === '' ? null : req.body.vyear,
                rating: req.body.rating === '' ? 0 : req.body.rating,
                genre: String(req.body.genre || '').trim(),
                is_popular: Boolean(req.body.is_popular)
            };
    
            const errors = validateMovieBody(payload);
            if (errors.length) {
                return res.status(400).json({ message: errors[0], errors });
            }
    
            await pool.execute(
                `UPDATE movies
                 SET title = ?, description = ?, poster = ?, watch_url = ?, vyear = ?, rating = ?, genre = ?, is_popular = ?
                 WHERE id = ?`,
                [
                    payload.title,
                    payload.description || null,
                    payload.poster || null,
                    payload.watch_url || null,
                    payload.vyear ? Number(payload.vyear) : null,
                    Number(payload.rating || 0),
                    payload.genre || null,
                    payload.is_popular,
                    Number(req.params.id)
                ]
            );
    
            const [rows] = await pool.execute(
                `SELECT m.*, u.name AS author
                 FROM movies m
                 JOIN users u ON u.id = m.user_id
                 WHERE m.id = ?`,
                [Number(req.params.id)]
            );
    
            res.json({
                message: 'Фильм обновлён.',
                movie: normalizeMovie(rows[0])
            });
        } catch (error) {
            console.error('Update movie error:', error);
            res.status(500).json({ message: 'Не удалось обновить фильм.' });
        }
    });
    
    app.delete('/api/movies/:id', authenticateToken, ensureAdmin, async (req, res) => {
        try {
            await pool.execute('DELETE FROM movies WHERE id = ?', [Number(req.params.id)]);
            res.json({ message: 'Фильм удалён.' });
        } catch (error) {
            console.error('Delete movie error:', error);
            res.status(500).json({ message: 'Не удалось удалить фильм.' });
        }
    });
    
    app.get('/api/users', authenticateToken, ensureAdmin, async (req, res) => {
        try {
            const [users] = await pool.execute(
                'SELECT id, email, name, role, keyword, security_question, created_at FROM users ORDER BY created_at DESC'
            );
    
            res.json({ users });
        } catch (error) {
            console.error('Get users error:', error);
            res.status(500).json({ message: 'Не удалось получить список пользователей.' });
        }
    });
    
    app.put('/api/users/:id', authenticateToken, ensureAdmin, async (req, res) => {
        try {
            const userId = Number(req.params.id);
            if (!Number.isInteger(userId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор пользователя.' });
            }
    
            const updates = [];
            const values = [];
    
            if (req.body.name !== undefined) {
                updates.push('name = ?');
                values.push(String(req.body.name).trim());
            }
            if (req.body.email !== undefined) {
                updates.push('email = ?');
                values.push(String(req.body.email).trim().toLowerCase());
            }
            if (req.body.role !== undefined) {
                const role = String(req.body.role).trim();
                if (!['user', 'admin'].includes(role)) {
                    return res.status(400).json({ message: 'Неверная роль пользователя.' });
                }
                updates.push('role = ?');
                values.push(role);
            }
            if (req.body.keyword !== undefined) {
                updates.push('keyword = ?');
                values.push(String(req.body.keyword).trim());
            }
            if (req.body.securityQuestion !== undefined || req.body.securityAnswer !== undefined) {
                const securityQuestion = String(req.body.securityQuestion || '').trim();
                const securityAnswer = String(req.body.securityAnswer || '').trim();
                if (!securityQuestions.includes(securityQuestion)) {
                    return res.status(400).json({ message: 'Выберите контрольный вопрос.' });
                }
                if (securityAnswer.length < 3) {
                    return res.status(400).json({ message: 'Ответ на контрольный вопрос должен содержать не менее 3 символов.' });
                }
                updates.push('security_question = ?', 'security_answer = ?', 'keyword = ?');
                values.push(securityQuestion, normalizeSecurityAnswer(securityAnswer), normalizeSecurityAnswer(securityAnswer));
            }
    
            if (!updates.length) {
                return res.status(400).json({ message: 'Нет данных для обновления.' });
            }
    
            values.push(userId);
            await pool.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
                values
            );
    
            const [rows] = await pool.execute(
                'SELECT id, email, name, role, keyword, security_question, created_at FROM users WHERE id = ?',
                [userId]
            );
    
            if (!rows.length) {
                return res.status(404).json({ message: 'Пользователь не найден.' });
            }
    
            res.json({ message: 'Пользователь обновлён.', user: rows[0] });
        } catch (error) {
            console.error('Update user error:', error);
            res.status(500).json({ message: 'Не удалось обновить пользователя.' });
        }
    });
    
    app.delete('/api/users/:id', authenticateToken, ensureAdmin, async (req, res) => {
        try {
            const userId = Number(req.params.id);
            if (!Number.isInteger(userId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор пользователя.' });
            }
    
            if (userId === req.user.userId) {
                return res.status(400).json({ message: 'Нельзя удалить собственный аккаунт.' });
            }
    
            const [result] = await pool.execute('DELETE FROM users WHERE id = ?', [userId]);
            if (!result.affectedRows) {
                return res.status(404).json({ message: 'Пользователь не найден.' });
            }
    
            res.json({ message: 'Пользователь удалён.' });
        } catch (error) {
            console.error('Delete user error:', error);
            res.status(500).json({ message: 'Не удалось удалить пользователя.' });
        }
    });
    
    app.get('/api/favorites', authenticateToken, async (req, res) => {
        try {
            const [rows] = await pool.execute(
                `SELECT m.*, u.name AS author
                 FROM favorites f
                 JOIN movies m ON m.id = f.movie_id
                 JOIN users u ON u.id = m.user_id
                 WHERE f.user_id = ?
                 ORDER BY f.created_at DESC`,
                [req.user.userId]
            );
    
            res.json(rows.map(normalizeMovie));
        } catch (error) {
            console.error('Get favorites error:', error);
            res.status(500).json({ message: 'Не удалось получить избранное.' });
        }
    });
    
    app.post('/api/favorites/:movieId', authenticateToken, async (req, res) => {
        try {
            const movieId = Number(req.params.movieId);
            if (!Number.isInteger(movieId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
            }
    
            const [movies] = await pool.execute('SELECT id FROM movies WHERE id = ?', [movieId]);
            if (!movies.length) {
                return res.status(404).json({ message: 'Фильм не найден.' });
            }
    
            await pool.execute(
                'INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)',
                [req.user.userId, movieId]
            );
    
            res.status(201).json({ message: 'Фильм добавлен в избранное.' });
        } catch (error) {
            if (error && error.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ message: 'Фильм уже находится в избранном.' });
            }
    
            console.error('Add favorite error:', error);
            res.status(500).json({ message: 'Не удалось добавить фильм в избранное.' });
        }
    });
    
    app.delete('/api/favorites/:movieId', authenticateToken, async (req, res) => {
        try {
            const movieId = Number(req.params.movieId);
            if (!Number.isInteger(movieId)) {
                return res.status(400).json({ message: 'Некорректный идентификатор фильма.' });
            }
    
            const [result] = await pool.execute(
                'DELETE FROM favorites WHERE user_id = ? AND movie_id = ?',
                [req.user.userId, movieId]
            );
    
            if (!result.affectedRows) {
                return res.status(404).json({ message: 'Фильм не найден в избранном.' });
            }
    
            res.json({ message: 'Фильм удалён из избранного.' });
        } catch (error) {
            console.error('Delete favorite error:', error);
            res.status(500).json({ message: 'Не удалось удалить фильм из избранного.' });
        }
    });
    
    app.get('/api/health', async (req, res) => {
        try {
            await pool.query('SELECT 1');
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        } catch (error) {
            res.status(500).json({ status: 'error', message: 'Database connection failed.' });
        }
    });

    app.use('/api', (req, res) => {
        res.status(404).json({ message: 'Маршрут API не найден.' });
    });
    
    app.use(async (req, res, next) => {
        const requestPath = req.path || '/';
    
        if (requestPath.startsWith('/api') || path.extname(requestPath)) {
            next();
            return;
        }
    
        try {
            const appShell = await fs.readFile(INDEX_FILE, 'utf8');
            res.type('html').send(appShell);
        } catch (error) {
            console.error('SPA fallback error:', {
                requestPath,
                indexFile: INDEX_FILE,
                message: error.message
            });
            res.status(500).send('Failed to load application shell.');
        }
    });

    app.use((req, res) => {
        res.status(404).send('Page not found.');
    });
}

module.exports = { registerRoutes };
