const mongoose = require('mongoose');
const Response = require('./models/Response');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
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

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

function signAdminToken(username) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return jwt.sign(
    { role: 'admin', username: String(username || '') },
    secret,
    { expiresIn: '8h' }
  );
}

function verifyAdminTokenFromEvent(event) {
  const auth = String((event.headers && (event.headers.authorization || event.headers.Authorization)) || '');
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const token = m[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const decoded = jwt.verify(token, secret);
    if (!decoded || decoded.role !== 'admin') return null;
    return decoded;
  } catch {
    return null;
  }
}

function unauthorized() {
  return {
    statusCode: 401,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'error', message: 'Unauthorized' })
  };
}

async function handleAdminLogin(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const u = String(body.username || '');
    const p = String(body.password || '');
    if (!u || !p) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'error', message: 'Missing credentials' })
      };
    }

    if (!safeEqual(u, ADMIN_USERNAME) || !safeEqual(p, ADMIN_PASSWORD)) {
      return unauthorized();
    }

    const token = signAdminToken(u);
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        token,
        username: u,
        expiresInSeconds: 8 * 60 * 60
      })
    };
  } catch (error) {
    console.error('Admin login error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
}

function isAuthorized(event) {
  const decoded = verifyAdminTokenFromEvent(event);
  if (decoded) return true;

  // Back-compat: allow old password query param if present
  const params = new URLSearchParams(event.rawQuery || '');
  const pw = params.get('password');
  if (pw && safeEqual(pw, ADMIN_PASSWORD)) return true;

  return false;
}

function parseYmdToUtcDate(s) {
  const str = String(s || '');
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(Date.UTC(y, mo - 1, d, 0, 0, 0, 0));
}

function isoYmdUtc(date) {
  return new Date(date).toISOString().slice(0, 10);
}

async function handleGetReport(event) {
  try {
    if (!isAuthorized(event)) return unauthorized();

    const NUM_QUESTIONS = 18;
    const params = new URLSearchParams(event.rawQuery || '');
    const startParam = params.get('start');
    const endParam = params.get('end');

    const todayUtc = parseYmdToUtcDate(isoYmdUtc(new Date())) || new Date();
    const hasStart = !!(startParam && String(startParam).trim());
    const hasEnd = !!(endParam && String(endParam).trim());

    let startUtc;
    let endDayUtc;

    if (!hasStart && !hasEnd) {
      await connectDB();
      const first = await Response.findOne().sort({ timestamp: 1 }).select({ timestamp: 1 }).lean();
      const firstYmd = first && first.timestamp ? isoYmdUtc(first.timestamp) : isoYmdUtc(todayUtc);
      startUtc = parseYmdToUtcDate(firstYmd) || todayUtc;
      endDayUtc = todayUtc;
    } else {
      startUtc = parseYmdToUtcDate(startParam) || new Date(todayUtc.getTime() - 6 * 24 * 60 * 60 * 1000);
      endDayUtc = parseYmdToUtcDate(endParam) || todayUtc;
    }
    const endUtc = new Date(endDayUtc.getTime() + (24 * 60 * 60 * 1000) - 1);

    await connectDB();

    const responses = await Response.find({
      timestamp: { $gte: startUtc, $lte: endUtc }
    })
      .select({ answers: 1, timestamp: 1 })
      .lean();

    const byDate = new Map();
    const overallYes = Array(NUM_QUESTIONS).fill(0);
    let overallTotalResponses = 0;
    let yesTotal = 0;

    for (const r of responses) {
      const ts = r.timestamp ? new Date(r.timestamp) : null;
      if (!ts || isNaN(ts)) continue;
      const dateKey = isoYmdUtc(ts);
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, { date: dateKey, total: 0, yes: Array(NUM_QUESTIONS).fill(0) });
      }

      const day = byDate.get(dateKey);
      day.total += 1;
      overallTotalResponses += 1;

      const answers = Array.isArray(r.answers) ? r.answers : [];
      for (let i = 0; i < NUM_QUESTIONS; i++) {
        const a = answers[i];
        if (a === 'Yes') {
          day.yes[i] += 1;
          overallYes[i] += 1;
          yesTotal += 1;
        }
      }
    }

    const days = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const answerTotal = overallTotalResponses * NUM_QUESTIONS;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'success',
        start: isoYmdUtc(startUtc),
        end: isoYmdUtc(endDayUtc),
        questions: NUM_QUESTIONS,
        days,
        overall: {
          totalResponses: overallTotalResponses,
          yesByQuestion: overallYes,
          yesTotal,
          answerTotal
        }
      })
    };
  } catch (error) {
    console.error('Report error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: error.message })
    };
  }
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
    if (!isAuthorized(event)) return unauthorized();

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
    if (!isAuthorized(event)) return unauthorized();

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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      }
    };
  }

  // Get the path from the event
  const path = event.path || event.rawUrl || '';

  if (path.includes('/admin/login')) {
    if (event.httpMethod === 'POST') {
      return handleAdminLogin(event);
    }
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: 'Method not allowed' })
    };
  }

  if (path.includes('/report')) {
    if (event.httpMethod === 'GET') {
      return handleGetReport(event);
    }
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'error', message: 'Method not allowed' })
    };
  }

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
