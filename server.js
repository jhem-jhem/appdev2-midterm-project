const http = require('http');
const fs = require('fs');
const url = require('url');
const { EventEmitter } = require('events');

const PORT = 3000;
const todosFile = './todos.json';
const logsFile = './logs.txt';

const logger = new EventEmitter();
logger.on('log', (message) => {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  fs.appendFile(logsFile, logMessage, (err) => {
    if (err) console.error('Logging error:', err);
  });
});

const readTodos = () => {
  try {
    const data = fs.readFileSync(todosFile);
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

const writeTodos = (todos) => {
  fs.writeFileSync(todosFile, JSON.stringify(todos, null, 2));
};

const sendJSON = (res, statusCode, data) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const method = req.method;
  const path = parsedUrl.pathname;
  const pathParts = path.split('/').filter(Boolean);

  logger.emit('log', `${method} ${path}`);

  if (method === 'GET' && path === '/todos') {
    const todos = readTodos();
    const { completed } = parsedUrl.query;
    const filtered = completed !== undefined
      ? todos.filter(t => String(t.completed) === completed)
      : todos;
    return sendJSON(res, 200, filtered);
  }

  if (method === 'GET' && pathParts[0] === 'todos' && pathParts[1]) {
    const todos = readTodos();
    const todo = todos.find(t => t.id === parseInt(pathParts[1]));
    return todo
      ? sendJSON(res, 200, todo)
      : sendJSON(res, 404, { error: 'Todo not found' });
  }

  if (method === 'POST' && path === '/todos') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const newTodo = JSON.parse(body);
        if (!newTodo.title) {
          return sendJSON(res, 400, { error: 'Title is required' });
        }

        const todos = readTodos();
        const id = todos.length ? Math.max(...todos.map(t => t.id)) + 1 : 1;
        const todo = {
          id,
          title: newTodo.title,
          completed: newTodo.completed ?? false
        };

        todos.push(todo);
        writeTodos(todos);
        return sendJSON(res, 200, todo);
      } catch {
        return sendJSON(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (method === 'PUT' && pathParts[0] === 'todos' && pathParts[1]) {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const updatedData = JSON.parse(body);
        const todos = readTodos();
        const index = todos.findIndex(t => t.id === parseInt(pathParts[1]));

        if (index === -1) {
          return sendJSON(res, 404, { error: 'Todo not found' });
        }

        todos[index] = {
          ...todos[index],
          ...updatedData
        };

        writeTodos(todos);
        return sendJSON(res, 200, todos[index]);
      } catch {
        return sendJSON(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (method === 'DELETE' && pathParts[0] === 'todos' && pathParts[1]) {
    const todos = readTodos();
    const id = parseInt(pathParts[1]);
    const index = todos.findIndex(t => t.id === id);

    if (index === -1) {
      return sendJSON(res, 404, { error: 'Todo not found' });
    }

    const deleted = todos.splice(index, 1)[0];
    writeTodos(todos);
    return sendJSON(res, 200, deleted);
  }

  sendJSON(res, 404, { error: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
