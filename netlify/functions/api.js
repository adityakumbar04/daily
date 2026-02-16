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

// Handle POST requests to save responses
async function handlePostResponses(event) {
  try {
    await connectDB();

    const body = JSON.parse(event.body);
    const { name, answers, score, totalQuestions, percentage, timestamp } = body;

    if (!name || !answers || score === undefined || !totalQuestions) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          status: 'error',
          message: 'Missing required fields'
        })
      };
    }

    const newResponse = new Response({
      name,
      answers,
      score,
      totalQuestions,
      percentage,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    await newResponse.save();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        message: 'Data saved successfully',
        data: newResponse
      })
    };

  } catch (error) {
    console.error('Error saving response:', error);
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

// Handle GET requests to retrieve responses
async function handleGetResponses(event) {
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

    const responses = await Response.find()
      .sort({ timestamp: -1 })
      .lean();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(responses)
    };

  } catch (error) {
    console.error('Error fetching responses:', error);
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

// Handle GET requests for stats
async function handleGetStats(event) {
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

// Main handler - routes based on path
exports.handler = async (event) => {
  // Enable CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    };
  }

  // Get the path from the event
  const path = event.path || event.rawUrl || '';

  if (path.includes('/responses')) {
    if (event.httpMethod === 'POST') {
      return handlePostResponses(event);
    } else if (event.httpMethod === 'GET') {
      return handleGetResponses(event);
    }
  } else if (path.includes('/stats')) {
    if (event.httpMethod === 'GET') {
      return handleGetStats(event);
    }
  }

  return {
    statusCode: 404,
    body: JSON.stringify({ status: 'error', message: 'Not found' })
  };
};
