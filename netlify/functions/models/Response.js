const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  answers: {
    type: [String],
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  percentage: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

let Response;

try {
  Response = mongoose.model('Response');
} catch (error) {
  Response = mongoose.model('Response', responseSchema);
}

module.exports = Response;
