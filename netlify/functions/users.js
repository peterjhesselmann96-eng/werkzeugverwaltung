const fs = require('fs').promises;
const path = require('path');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Standard-Daten
const DEFAULT_USERS = [
  { id: 1, name: 'Administrator', username: 'admin', password: 'admin123', role: 'admin' },
  { id: 2, name: 'Max Mustermann', username: 'max', password: 'max123', role: 'user' },
  { id: 3, name: 'Anna Schmidt', username: 'anna', password: 'anna123', role: 'user' }
];

// Hilfsfunktionen
async function ensureDataDir() {
  const dataDir = path.join(__dirname, 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

async function readUsers() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(USERS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Falls Datei nicht existiert, Standard-Daten verwenden
    await writeUsers(DEFAULT_USERS);
    return DEFAULT_USERS;
  }
}

async function writeUsers(users) {
  await ensureDataDir();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

exports.handler = async (event, context) => {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS Request (CORS Preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  try {
    const method = event.httpMethod;
    const body = event.body ? JSON.parse(event.body) : null;

    switch (method) {
      case 'GET':
        const users = await readUsers();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(users)
        };

      case 'POST':
        if (!body) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body required' })
          };
        }

        const currentUsers = await readUsers();
        const newId = Math.max(...currentUsers.map(u => u.id), 0) + 1;
        const newUser = { ...body, id: newId };
        
        currentUsers.push(newUser);
        await writeUsers(currentUsers);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newUser)
        };

      case 'PUT':
        if (!body || !body.id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'User ID required' })
          };
        }

        const usersForUpdate = await readUsers();
        const userIndex = usersForUpdate.findIndex(u => u.id === body.id);
        
        if (userIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' })
          };
        }

        usersForUpdate[userIndex] = body;
        await writeUsers(usersForUpdate);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(body)
        };

      case 'DELETE':
        const { id } = event.queryStringParameters || {};
        
        if (!id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'User ID required' })
          };
        }

        const usersForDelete = await readUsers();
        const filteredUsers = usersForDelete.filter(u => u.id !== parseInt(id));
        
        if (filteredUsers.length === usersForDelete.length) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' })
          };
        }

        await writeUsers(filteredUsers);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true })
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};