# KinoWeb — Online Cinema Web Application

### Название проекта

KinoWeb — онлайн-кинотеатр

### Описание проекта

KinoWeb — это веб-приложение онлайн-кинотеатра, позволяющее пользователям просматривать каталог фильмов, искать контент, добавлять фильмы в избранное, оставлять оценки и комментарии, а также управлять личным профилем.

Приложение построено по клиент-серверной архитектуре с разделением frontend и backend. Пользователь может зарегистрироваться, авторизоваться, просматривать фильмы и получать подробную информацию о них.

Проект демонстрирует разработку FullStack веб-приложения с использованием Vanilla JavaScript, Node.js, Express и MySQL.

### Целевая аудитория

* пользователи онлайн-кинотеатров
* любители фильмов
* пользователи, создающие персональные коллекции фильмов
* студенты, изучающие FullStack-разработку

### Ключевой функционал

* регистрация пользователей
* авторизация
* восстановление пароля через контрольный вопрос
* просмотр каталога фильмов
* страница фильма
* поиск фильмов
* избранные фильмы
* оценки и комментарии к фильмам
* личный кабинет
* администрирование фильмов и пользователей
* REST API
* обработка 404 для неизвестных страниц и API-маршрутов

### Структура приложения

| Раздел | URL | Тип доступа | Описание |
|---|---|---|---|
| Главная | `/` | Публичный | Главная страница |
| Аутентификация | `/auth/login`, `/auth/register`, `/auth/recover` | Публичный | Вход, регистрация, восстановление |
| Каталог | `/catalog` | Публичный | Список фильмов с фильтрами |
| Страница фильма | `/detail/:id` | Публичный | Детальная страница фильма |
| Поиск | `/search` | Публичный | Поиск фильмов |
| Личный кабинет | `/profile` | Приватный | Профиль пользователя |
| Избранное | `/favorites` | Приватный | Сохранённые фильмы |
| Админ-панель | `/admin` | Приватный, admin | Управление контентом и пользователями |

#
# Технологический стек

### Frontend

Vanilla JavaScript.

Frontend реализован без фреймворков. Код разделён на несколько файлов:

* `public/state.js` — состояние и настройки приложения
* `public/router.js` — SPA-роутинг и обработка неизвестных страниц
* `public/navigation.js` — навигация
* `public/views.js` — страницы приложения
* `public/helpers.js` — общие frontend-функции
* `public/app.js` — точка входа

#### Роутинг

* History API
* динамическая загрузка страниц
* SPA-навигация без перезагрузки

#### State Management

* LocalStorage
* JWT token
* глобальное состояние приложения

### Backend

Node.js + Express.js.

Backend разделён на несколько файлов:

* `server.js` — запуск приложения
* `server/config.js` — настройки, пути, подключение к MySQL
* `server/helpers.js` — валидация, middleware, нормализация данных, инициализация БД
* `server/routes.js` — API-маршруты и fallback для SPA

### База данных

MySQL.

Используются таблицы:

* `users`
* `movies`
* `favorites`
* `movie_ratings`
* `movie_comments`

### Инфраструктура

| Компонент | Размещение |
|---|---|
| Frontend | Static files в `public` |
| Backend | Node.js server |
| Database | MySQL server |

### Архитектура

Browser → Frontend → REST API → Backend → MySQL

#
# Запуск проекта

### Установка зависимостей

```bash
npm install
```

### Переменные окружения

Создайте `.env` файл или используйте существующий:

```env
PORT=3001
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=kinoweb
DB_PORT=3306
JWT_SECRET=your_secret
```

### Запуск

```bash
npm start
```

или

```bash
npm run dev
```

После запуска приложение доступно по адресу:

```text
http://localhost:3001
```

#
# Визуальное проектирование интерфейса

### Главная страница (`/`)

#### Тип доступа: публичный

Основные блоки:

* шапка с логотипом KinoWeb и навигацией
* баннер-блок
* слайдер новинок
* популярные фильмы

GET `/api/movies?popular=true`

### Аутентификация

#### Вход (`/auth/login`)

* email
* пароль
* кнопка входа

#### Регистрация (`/auth/register`)

* имя
* email
* пароль
* контрольный вопрос
* ответ на контрольный вопрос

#### Восстановление (`/auth/recover`)

* email
* получение контрольного вопроса
* ответ на контрольный вопрос
* новый пароль

### Каталог (`/catalog`)

#### Тип доступа: публичный

* фильтры: жанр, год, рейтинг
* сетка фильмов
* пагинация

GET `/api/movies`

### Страница фильма (`/detail/:id`)

#### Тип доступа: публичный

* постер
* название
* рейтинг
* описание
* блок просмотра
* избранное
* оценки и комментарии

GET `/api/movies/:id`

### Поиск (`/search`)

#### Тип доступа: публичный

* поле поиска
* динамические результаты

GET `/api/movies/search?q=`

### Личный кабинет (`/profile`)

#### Тип доступа: приватный

* имя пользователя
* email
* контрольный вопрос
* список добавленных фильмов
* комментарии пользователя
* выход

### Избранное (`/favorites`)

#### Тип доступа: приватный

GET `/api/favorites`

* список сохранённых фильмов
* удаление из избранного

### Админ-панель (`/admin`)

#### Тип доступа: приватный, роль `admin`

* добавление фильма
* редактирование фильма
* удаление фильма
* управление пользователями

#
# Схема данных и API

### User

| Поле | Тип |
|---|---|
| id | INT |
| email | VARCHAR |
| password_hash | VARCHAR |
| name | VARCHAR |
| keyword | VARCHAR |
| security_question | VARCHAR |
| security_answer | VARCHAR |
| role | VARCHAR |
| created_at | DATETIME |

### Movie

| Поле | Тип |
|---|---|
| id | INT |
| user_id | INT |
| title | VARCHAR |
| description | TEXT |
| poster | VARCHAR |
| watch_url | VARCHAR |
| vyear | INT |
| rating | DECIMAL |
| genre | VARCHAR |
| is_popular | BOOLEAN |
| created_at | DATETIME |
| updated_at | DATETIME |

### Favorite

| Поле | Тип |
|---|---|
| id | INT |
| user_id | INT |
| movie_id | INT |
| created_at | DATETIME |

### Movie Rating

| Поле | Тип |
|---|---|
| id | INT |
| user_id | INT |
| movie_id | INT |
| rating | DECIMAL |
| created_at | DATETIME |
| updated_at | DATETIME |

### Movie Comment

| Поле | Тип |
|---|---|
| id | INT |
| user_id | INT |
| movie_id | INT |
| text | TEXT |
| created_at | DATETIME |
| updated_at | DATETIME |

### API Endpoints

#### Аутентификация

POST `/api/auth/register`

POST `/api/auth/login`

GET `/api/auth/me`

PUT `/api/auth/profile`

GET `/api/auth/recovery-question`

POST `/api/auth/recover`

#### Фильмы

GET `/api/movies`

GET `/api/movies?popular=true`

GET `/api/movies/search?q=`

GET `/api/movies/:id`

POST `/api/movies`

PUT `/api/movies/:id`

DELETE `/api/movies/:id`

#### Оценки и комментарии

GET `/api/movies/:id/comments`

POST `/api/movies/:id/comments`

GET `/api/movies/:id/my-rating`

POST `/api/movies/:id/rating`

GET `/api/comments/me`

#### Избранное

GET `/api/favorites`

POST `/api/favorites/:movieId`

DELETE `/api/favorites/:movieId`

#### Пользователи

GET `/api/users`

PUT `/api/users/:id`

DELETE `/api/users/:id`

#### Сервисные маршруты

GET `/api/health`
