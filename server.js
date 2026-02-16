const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Response = require('./models/Response');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// POST endpoint - Save response
app.post('/api/responses', async (req, res) => {
  try {
    const { name, answers, score, totalQuestions, percentage, timestamp } = req.body;

    // Validate required fields
    if (!name || !answers || score === undefined || !totalQuestions) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
    }

    // Create new response document
    const newResponse = new Response({
      name,
      answers,
      score,
      totalQuestions,
      percentage,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    });

    // Save to MongoDB
    await newResponse.save();

    res.status(200).json({
      status: 'success',
      message: 'Data saved successfully',
      data: newResponse
    });

  } catch (error) {
    console.error('Error saving response:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// GET endpoint - Retrieve all responses
app.get('/api/responses', async (req, res) => {
  try {
    const adminPassword = req.query.password;
    
    // Simple password check
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }

    // Fetch all responses sorted by timestamp (newest first)
    const responses = await Response.find()
      .sort({ timestamp: -1 })
      .lean();

    res.status(200).json(responses);

  } catch (error) {
    console.error('Error fetching responses:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// GET endpoint - Get stats
app.get('/api/stats', async (req, res) => {
  try {
    const adminPassword = req.query.password;
    
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({
        status: 'error',
        message: 'Unauthorized'
      });
    }

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

    res.status(200).json(stats);

  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
