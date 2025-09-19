const fs = require('fs').promises;
const path = require('path');

const WERKZEUGE_FILE = path.join(__dirname, 'data', 'werkzeuge.json');

// Standard-Daten
const DEFAULT_WERKZEUGE = [
  {
    id: 1,
    name: 'Bohrmaschine',
    owner: 'admin',
    image: null,
    status: 'available',
    borrower: null,
    borrowedDate: null
  },
  {
    id: 2,
    name: 'Hammer',
    owner: 'max',
    image: null,
    status: 'borrowed',
    borrower: 'anna',
    borrowedDate: new Date().toISOString()
  }
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

async function readWerkzeuge() {
  try {
    await ensureDataDir();
    const data = await fs.readFile(WERKZEUGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // Falls Datei nicht existiert, Standard-Daten verwenden
    await writeWerkzeuge(DEFAULT_WERKZEUGE);
    return DEFAULT_WERKZEUGE;
  }
}

async function writeWerkzeuge(werkzeuge) {
  await ensureDataDir();
  await fs.writeFile(WERKZEUGE_FILE, JSON.stringify(werkzeuge, null, 2));
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
        const werkzeuge = await readWerkzeuge();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(werkzeuge)
        };

      case 'POST':
        if (!body) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body required' })
          };
        }

        const currentWerkzeuge = await readWerkzeuge();
        const newId = Math.max(...currentWerkzeuge.map(w => w.id), 0) + 1;
        const newWerkzeug = { 
          ...body, 
          id: newId,
          status: body.status || 'available',
          borrower: null,
          borrowedDate: null
        };
        
        currentWerkzeuge.push(newWerkzeug);
        await writeWerkzeuge(currentWerkzeuge);

        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(newWerkzeug)
        };

      case 'PUT':
        if (!body || !body.id) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Werkzeug ID required' })
          };
        }

        const werkzeugeForUpdate = await readWerkzeuge();
        const werkzeugIndex = werkzeugeForUpdate.findIndex(w => w.id === body.id);
        
        if (werkzeugIndex === -1) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Werkzeug not found' })
          };
        }

        werkzeugeForUpdate[werkzeugIndex] = body;
        await writeWerkzeuge(werkzeugeForUpdate);

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
            body: JSON.stringify({ error: 'Werkzeug ID required' })
          };
        }

        const werkzeugeForDelete = await readWerkzeuge();
        const filteredWerkzeuge = werkzeugeForDelete.filter(w => w.id !== parseInt(id));
        
        if (filteredWerkzeuge.length === werkzeugeForDelete.length) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Werkzeug not found' })
          };
        }

        await writeWerkzeuge(filteredWerkzeuge);

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