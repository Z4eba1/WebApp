require('dotenv').config();
const mysql = require('mysql2/promise');
const path = require('path');

const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const ROOT_DIR = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const INDEX_FILE = path.resolve(PUBLIC_DIR, 'index.html');

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
const securityQuestions = [
    'Как звали вашего первого питомца?',
    'В каком городе вы родились?',
    'Какая ваша любимая книга?',
    'Как звали вашего первого учителя?',
    'Какой ваш любимый фильм?'
];

module.exports = {
    PORT,
    JWT_SECRET,
    PUBLIC_DIR,
    INDEX_FILE,
    pool,
    emailRegex,
    securityQuestions
};
