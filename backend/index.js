const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Разрешаем запросы с фронтенда
app.use(express.json()); // Парсим JSON

// ------------------- Конфигурация JWT -------------------
const ACCESS_SECRET = process.env.ACCESS_SECRET;
const REFRESH_SECRET = process.env.REFRESH_SECRET;
const ACCESS_EXPIRES_IN = '15m';
const REFRESH_EXPIRES_IN = '7d';

// ------------------- Хранилища данных (in-memory) -------------------
// Пользователи: { id, username, email, passwordHash, role, isBlocked? }
let users = [
  // Создаем тестового админа при старте для удобства
  {
    id: uuidv4(),
    username: 'admin',
    email: 'admin@example.com',
    passwordHash: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    isBlocked: false,
  },
  {
    id: uuidv4(),
    username: 'seller',
    email: 'seller@example.com',
    passwordHash: bcrypt.hashSync('seller123', 10),
    role: 'seller',
    isBlocked: false,
  },
  {
    id: uuidv4(),
    username: 'user',
    email: 'user@example.com',
    passwordHash: bcrypt.hashSync('user123', 10),
    role: 'user',
    isBlocked: false,
  },
];

// Товары: { id, title, category, description, price }
let products = [];

// Хранилище активных refresh-токенов (Set для простоты)
let refreshTokens = new Set();

// ------------------- Вспомогательные функции -------------------
const generateAccessToken = (user) => {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email, role: user.role },
    ACCESS_SECRET,
    { expiresIn: ACCESS_EXPIRES_IN }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email, role: user.role },
    REFRESH_SECRET,
    { expiresIn: REFRESH_EXPIRES_IN }
  );
};

// ------------------- Middleware -------------------
// 1. Мидлвар для проверки аутентификации
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  try {
    const decoded = jwt.verify(token, ACCESS_SECRET);
    req.user = decoded; // Добавляем информацию о пользователе в запрос
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// 2. Мидлвар для проверки ролей (фабрика)
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    next();
  };
};

// ------------------- Аутентификация (Auth) -------------------
// POST /api/auth/register - доступ: Гость
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password are required' });
  }

  // Проверяем, не существует ли уже пользователь с таким email
  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(409).json({ error: 'User with this email already exists' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = {
      id: uuidv4(),
      username,
      email,
      passwordHash,
      role: 'user', // По умолчанию все новые пользователи имеют роль 'user'
      isBlocked: false,
    };
    users.push(newUser);

    // Не возвращаем хеш пароля в ответе
    res.status(201).json({
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/login - доступ: Гость
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Проверка, не заблокирован ли пользователь
  if (user.isBlocked) {
    return res.status(403).json({ error: 'Your account is blocked. Contact administrator.' });
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  refreshTokens.add(refreshToken);

  res.json({ accessToken, refreshToken });
});

// POST /api/auth/refresh - доступ: Гость
app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }
  if (!refreshTokens.has(refreshToken)) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const user = users.find(u => u.id === decoded.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Удаляем старый refresh-токен (ротация)
    refreshTokens.delete(refreshToken);

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    refreshTokens.add(newRefreshToken);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
});

// GET /api/auth/me - доступ: Пользователь
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = users.find(u => u.id === req.user.sub);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
});

// ------------------- Управление пользователями (только Админ) -------------------
// GET /api/users - доступ: Администратор
app.get('/api/users', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  // Возвращаем всех пользователей, но без паролей
  const usersToReturn = users.map(({ passwordHash, ...userData }) => userData);
  res.json(usersToReturn);
});

// GET /api/users/:id - доступ: Администратор
app.get('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  const { passwordHash, ...userData } = user;
  res.json(userData);
});

// PUT /api/users/:id - доступ: Администратор (обновление информации пользователя)
app.put('/api/users/:id', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  const { username, email, role } = req.body;
  // Обновляем только разрешенные поля
  if (username) users[userIndex].username = username;
  if (email) users[userIndex].email = email;
  if (role && ['user', 'seller', 'admin'].includes(role)) {
    users[userIndex].role = role;
  }

  const { passwordHash, ...userData } = users[userIndex];
  res.json(userData);
});

// DELETE /api/users/:id - доступ: Администратор (блокировка пользователя)
app.delete('/api/users/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  const userIndex = users.findIndex(u => u.id === req.params.id);
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Блокируем пользователя (логическое удаление)
  users[userIndex].isBlocked = true;
  // По хорошему, нужно также удалить его refresh-токены, но для простоты опустим

  res.status(204).send(); // No Content
});

// ------------------- Управление товарами (CRUD) -------------------
// POST /api/products - доступ: Продавец
app.post('/api/products', authMiddleware, roleMiddleware(['seller', 'admin']), (req, res) => {
  const { title, category, description, price } = req.body;
  if (!title || !category || !description || !price) {
    return res.status(400).json({ error: 'All product fields are required' });
  }

  const newProduct = {
    id: uuidv4(),
    title,
    category,
    description,
    price: Number(price),
  };
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// GET /api/products - доступ: Пользователь
app.get('/api/products', authMiddleware, (req, res) => {
  res.json(products);
});

// GET /api/products/:id - доступ: Пользователь
app.get('/api/products/:id', authMiddleware, (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// PUT /api/products/:id - доступ: Продавец
app.put('/api/products/:id', authMiddleware, roleMiddleware(['seller', 'admin']), (req, res) => {
  const productIndex = products.findIndex(p => p.id === req.params.id);
  if (productIndex === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const { title, category, description, price } = req.body;
  if (title) products[productIndex].title = title;
  if (category) products[productIndex].category = category;
  if (description) products[productIndex].description = description;
  if (price) products[productIndex].price = Number(price);

  res.json(products[productIndex]);
});

// DELETE /api/products/:id - доступ: Администратор
app.delete('/api/products/:id', authMiddleware, roleMiddleware(['admin']), (req, res) => {
  const initialLength = products.length;
  products = products.filter(p => p.id !== req.params.id);
  if (products.length === initialLength) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.status(204).send(); // No Content
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});