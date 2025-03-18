const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const { Pool } = require('pg'); // Змінено з SQLite на pg

// Ініціалізація додатку
const app = express();
const PORT = process.env.PORT || 3000;

// Конфігурація підключення до PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://samostiyna_web_user:e1WMOdsx4ZHYP2LnJilAr34WiBuruRcy@dpg-cvcmi9fnoe9s73cebcm0-a.oregon-postgres.render.com/samostiyna_web',
    ssl: {
        rejectUnauthorized: false // Необхідно для Render
    }
});

// Налаштування шаблонізатора EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Налаштування middleware
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d' // Кешування статичних файлів на 1 день
}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 } // Термін життя сесії - 1 година
}));

// Функція для ініціалізації бази даних
async function initializeDatabase() {
    try {
        const client = await pool.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                due_date DATE,
                priority TEXT CHECK(priority IN ('Низький', 'Середній', 'Високий')) DEFAULT 'Середній',
                completed BOOLEAN DEFAULT FALSE,
                user_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
            
            CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        `);
        client.release();
        console.log('Таблиці PostgreSQL успішно створені');
    } catch (err) {
        console.error('Помилка ініціалізації бази даних:', err);
    }
}

// Middleware для перевірки аутентифікації
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    res.redirect('/login');
};

// Головна сторінка
app.get('/', (req, res) => {
    res.render('index');
});

// Сторінка реєстрації
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const client = await pool.connect();
    try {
        const { username, email, password } = req.body;

        // Перевірка чи такий користувач вже існує
        const existingUserResult = await client.query(
            'SELECT id FROM users WHERE username = $1 OR email = $2',
            [username, email]
        );

        if (existingUserResult.rows.length > 0) {
            return res.render('register', { error: 'Користувач з таким іменем або email вже існує' });
        }

        // Створення нового користувача
        await client.query(
            'INSERT INTO users (username, email, password) VALUES ($1, $2, $3)',
            [username, email, password]
        );

        res.redirect('/login');
    } catch (error) {
        console.error('Помилка реєстрації:', error);
        res.render('register', { error: 'Помилка під час реєстрації. Спробуйте пізніше.' });
    } finally {
        client.release();
    }
});

// Сторінка входу
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', async (req, res) => {
    const client = await pool.connect();
    try {
        const { username, password } = req.body;

        // Пошук користувача
        const userResult = await client.query(
            'SELECT id, username, password FROM users WHERE username = $1',
            [username]
        );

        const user = userResult.rows[0];

        if (!user || user.password !== password) {
            return res.render('login', { error: 'Невірне ім\'я користувача або пароль' });
        }

        // Встановлення сесії
        req.session.userId = user.id;
        req.session.username = user.username;

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Помилка входу:', error);
        res.render('login', { error: 'Помилка під час входу. Спробуйте пізніше.' });
    } finally {
        client.release();
    }
});

// Вихід з системи
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Сторінка з завданнями (dashboard)
app.get('/dashboard', isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        // Отримання всіх завдань користувача з обмеженням
        const tasksResult = await client.query(
            'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
            [req.session.userId]
        );

        res.render('dashboard', {
            username: req.session.username,
            tasks: tasksResult.rows
        });
    } catch (error) {
        console.error('Помилка отримання завдань:', error);
        res.render('dashboard', {
            username: req.session.username,
            tasks: [],
            error: 'Помилка отримання завдань'
        });
    } finally {
        client.release();
    }
});

// Додавання нового завдання
app.post('/tasks', isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const { title, description, dueDate, priority } = req.body;

        // Створення нового завдання
        await client.query(
            'INSERT INTO tasks (title, description, due_date, priority, user_id) VALUES ($1, $2, $3, $4, $5)',
            [title, description, dueDate || null, priority, req.session.userId]
        );

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Помилка додавання завдання:', error);
        res.redirect('/dashboard');
    } finally {
        client.release();
    }
});

// Позначення завдання як виконане/невиконане
app.post('/tasks/:id/toggle', isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const taskId = req.params.id;

        // Отримуємо поточний стан завдання
        const taskResult = await client.query(
            'SELECT completed FROM tasks WHERE id = $1 AND user_id = $2',
            [taskId, req.session.userId]
        );

        if (taskResult.rows.length > 0) {
            // Змінюємо стан на протилежний
            const newStatus = !taskResult.rows[0].completed;
            await client.query(
                'UPDATE tasks SET completed = $1 WHERE id = $2 AND user_id = $3',
                [newStatus, taskId, req.session.userId]
            );
        }

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Помилка оновлення завдання:', error);
        res.redirect('/dashboard');
    } finally {
        client.release();
    }
});

// Видалення завдання
app.post('/tasks/:id/delete', isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query(
            'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
            [req.params.id, req.session.userId]
        );

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Помилка видалення завдання:', error);
        res.redirect('/dashboard');
    } finally {
        client.release();
    }
});

// Редагування завдання
app.get('/tasks/:id/edit', isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const taskResult = await client.query(
            'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
            [req.params.id, req.session.userId]
        );

        if (taskResult.rows.length === 0) {
            return res.redirect('/dashboard');
        }

        const task = taskResult.rows[0];
        res.render('edit-task', { task });
    } catch (error) {
        console.error('Помилка отримання завдання:', error);
        res.redirect('/dashboard');
    } finally {
        client.release();
    }
});

app.post('/tasks/:id/update', isAuthenticated, async (req, res) => {
    const client = await pool.connect();
    try {
        const { title, description, dueDate, priority } = req.body;

        await client.query(
            'UPDATE tasks SET title = $1, description = $2, due_date = $3, priority = $4 WHERE id = $5 AND user_id = $6',
            [title, description, dueDate || null, priority, req.params.id, req.session.userId]
        );

        res.redirect('/dashboard');
    } catch (error) {
        console.error('Помилка оновлення завдання:', error);
        res.redirect('/dashboard');
    } finally {
        client.release();
    }
});

// Ініціалізація бази даних і запуск сервера
initializeDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`Сервер запущено на порту ${PORT}`);
        console.log(`Відкрийте у браузері: http://localhost:${PORT}`);
    });
});

// Коректне завершення роботи програми
process.on('SIGINT', async () => {
    try {
        await pool.end();
        console.log('З\'єднання з базою даних закрито');
    } catch (err) {
        console.error('Помилка закриття бази даних:', err);
    }
    process.exit(0);
});