# MongoDB Migration Guide

## Overview
This project has been migrated from Google Sheets to MongoDB for data storage and retrieval. The application is now powered by Node.js/Express with Mongoose for database management.

## Setup Instructions

### 1. Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account (free tier available at https://www.mongodb.com/cloud/atlas)

### 2. Create MongoDB Database
1. Sign up for MongoDB Atlas (free tier)
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string (looks like: `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`)

### 3. Local Development Setup

#### Install Dependencies
```bash
npm install
```

#### Set Environment Variables
Create a `.env` file in the root directory:
```
MONGODB_URI=mongodb+srv://akumbar691_db_user:1AYO4nNaHqozcO9z@cluster0.dhfareu.mongodb.net/?appName=Cluster0
PORT=3000
NODE_ENV=development
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
JWT_SECRET=your_long_random_secret_here
```

Replace:
- `username` and `password` with your MongoDB credentials
- `cluster` with your MongoDB cluster name
- `your_secure_password_here` with a secure admin password

#### Run Locally
```bash
npm start
```

Or with auto-reload during development:
```bash
npm run dev
```

Server will start on `http://localhost:3000`

### 4. Netlify Deployment

#### Connect to Netlify
1. Push your code to GitHub
2. Go to https://netlify.com
3. Click "New site from Git"
4. Choose your repository
5. Set build command to: `npm install`
6. Set publish directory to: `.`

#### Set Environment Variables in Netlify
1. Go to your site settings on Netlify
2. Navigate to "Build & deploy" → "Environment"
3. Add the same environment variables:
   - `MONGODB_URI` - Your MongoDB connection string
   - `ADMIN_PASSWORD` - Your admin password

The API will be available at: `https://your-netlify-site.netlify.app/api/`

### 5. API Endpoints

#### Submit Response (POST)
```
POST /api/responses
Content-Type: application/json

{
  "name": "User Name",
  "answers": ["Yes", "No", "Yes", ...],
  "score": 15,
  "totalQuestions": 18,
  "percentage": 83,
  "timestamp": "2026-02-16T10:30:00.000Z"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Data saved successfully",
  "data": { ... }
}
```

#### Get All Responses (GET)
```
GET /api/responses
```

Returns array of all responses sorted by timestamp (newest first)

#### Get Statistics (GET)
```
GET /api/stats
```

**Response:**
```json
{
  "totalMembers": 42,
  "highestScore": 18,
  "lowestScore": 8,
  "avgPerformance": 85
}
```

### 6. Admin Dashboard Access
1. Open `admin.html` in your browser
2. Sign in with your admin username/password (from your `.env` file)
3. View leaderboard and statistics

### 7. Updated Files
The following frontend files automatically use the new MongoDB API:
- `script.js` - Form submission now sends to `/api/responses`
- `admin.js` - Dashboard fetches from `/api/responses` and `/api/stats`

### 8. Troubleshooting

**"Failed to load data" error in admin dashboard:**
- Check that `ADMIN_PASSWORD` matches in both frontend (admin.js) and backend (.env)
- Verify MongoDB connection string is correct
- Check browser console for detailed error messages

**CORS errors:**
- CORS headers are automatically configured in netlify.toml
- For local development with a separate frontend, the Express server includes CORS middleware

**MongoDB connection issues:**
- Verify connection string format
- Check that MongoDB IP whitelist includes your server's IP
- For local development, you may need to allow connections from your machine IP

### 9. Database Schema

The MongoDB collection stores documents with this structure:
```javascript
{
  name: String,           // User's name
  answers: [String],      // Array of "Yes"/"No" answers
  score: Number,          // Number of "Yes" answers
  totalQuestions: Number, // Total questions (18)
  percentage: Number,     // Score percentage
  timestamp: Date         // Submission time
}
```

### 10. Switching Between Local and Remote

**For local development:**
- Run `npm start` or `npm run dev`
- Update `script.js` and `admin.js` to use `http://localhost:3000/api/` if needed

**For production (Netlify):**
- Use relative URLs (`/api/responses`) which automatically point to your Netlify Functions
- Environment variables are managed in Netlify dashboard

## Security Notes
- ✅ MongoDB connection string is stored in environment variables (never in code)
- ✅ Admin username/password required to log in
- ✅ Data retrieval endpoints require an `Authorization: Bearer <token>` header
- ⚠️ Change `ADMIN_PASSWORD` in `.env` to a strong, unique password
- ⚠️ Set `JWT_SECRET` to a long random secret (required)
- ⚠️ Never commit `.env` file to git (it's in `.gitignore`)

## Migration Notes
- Google Apps Script has been replaced with Netlify Functions (serverless)
- Google Sheets has been replaced with MongoDB Atlas
- No more CORS issues since it's the same deployment
- Better scalability and real-time data querying with MongoDB
