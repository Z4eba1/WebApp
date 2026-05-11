const express = require('express');
const cors = require('cors');
const { PORT, PUBLIC_DIR } = require('./server/config');
const { initializeDatabase } = require('./server/helpers');
const { registerRoutes } = require('./server/routes');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(PUBLIC_DIR));

registerRoutes(app);

async function start() {
    try {
        await initializeDatabase();
        app.listen(PORT, () => {
            console.log(`KinoWeb server started on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

start();
