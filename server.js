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