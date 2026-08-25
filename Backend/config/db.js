/**
 * MongoDB Connection Configuration with Resilient Fallback Mode
 * Connects to local or MongoDB Atlas, with automatic graceful fallback.
 */

const mongoose = require('mongoose');

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/buy-chhatke';
  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 4000
    });
    isConnected = true;
    console.log(`[Database] Connected to MongoDB${uri.startsWith('mongodb+srv://') ? ' Atlas' : ''}.`);
  } catch (err) {
    isConnected = false;
    console.log(`[Database] MongoDB offline (${err.message}). Activating In-Memory / File-Persisted Deal Store mode.`);
  }
}

function isDbConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = {
  connectDB,
  isDbConnected
};
