const mongoose = require('mongoose');
const Response = require('./models/Response');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
let mongoConnection = null;

async function connectDB() {
  if (mongoConnection && mongoose.connection.readyState === 1) {
    return mongoConnection;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  mongoConnection = await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    bufferCommands: false
  });

  return mongoConnection;
}

// Handle GET requests for stats
async function handleGet(event) {
  try {
    const params = new URLSearchParams(event.rawQuery);
    const adminPassword = params.get('password');

    if (adminPassword !== ADMIN_PASSWORD) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'error',
          message: 'Unauthorized'
        })
      };
    }

    await connectDB();

    const count = await Response.countDocuments();
    const responses = await Response.find().lean();

    const scores = responses.map(r => r.score || 0);
    const percentages = responses.map(r => r.percentage || 0);

    const stats = {
      totalMembers: count,
      highestScore: scores.length ? Math.max(...scores) : 0,
      lowestScore: scores.length ? Math.min(...scores) : 0,
      avgPerformance: percentages.length ? Math.round(percentages.reduce((a, b) => a + b, 0) / percentages.length) : 0
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stats)
    };

  } catch (error) {
    console.error('Error fetching stats:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'error',
        message: error.message
      })
    };
  }
}

// Main handler
exports.handler = async (event) => {
  // Enable CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  if (event.httpMethod === 'GET') {
    return handleGet(event);
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ status: 'error', message: 'Method not allowed' })
  };
};
