const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const express = require('express');

require('dotenv').config();

const app = express();
const PORT = 3001;

app.listen(PORT, () => {
    console.log(`Server started on ${PORT}`);
});

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    database: 'kinoweb'
});

async function initializeDatabase() {
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255),
            password_hash VARCHAR(255)
        )
    `);
}

function createToken(user) {
    return jwt.sign({ userId: user.id }, 'secret');
}

app.post('/api/auth/register', async (req, res) => {
    const hash = await bcrypt.hash(req.body.password, 10);

    const [result] = await pool.execute(
        'INSERT INTO users (email, password_hash) VALUES (?, ?)',
        [req.body.email, hash]
    );

    res.json({ id: result.insertId });
});

app.get('/api/movies', async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM movies');
    res.json(rows);
});

app.post('/api/favorites/:id', async (req, res) => {
    await pool.execute(
        'INSERT INTO favorites (user_id, movie_id) VALUES (?, ?)',
        [1, req.params.id]
    );
    res.json({ ok: true });
});

const routes = {
    "/": () => setView("<h1>Главная</h1>")
};

function router() {
    const path = location.pathname;
    routes[path]?.();
}

function setView(html) {
    document.getElementById('app-view').innerHTML = html;
}

window.addEventListener("popstate", router);

function renderLogin() {
    setView(`
        <form id="login">
            <input name="email">
            <input name="password">
            <button>Login</button>
        </form>
    `);
}

async function renderCatalog() {
    const movies = await fetch('/api/movies').then(r => r.json());

    setView(movies.map(m => `<div>${m.title}</div>`).join(''));
}

async function search(q) {
    return fetch(`/api/movies/search?q=${q}`).then(r => r.json());
}

function renderProfile() {
    setView(`<h1>Профиль</h1>`);
}

function toggleFavorite(id) {
    fetch(`/api/favorites/${id}`, { method: 'POST' });
}