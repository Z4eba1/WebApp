const mysql = require('mysql2/promise');

require('dotenv').config();
const express = require('express');

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