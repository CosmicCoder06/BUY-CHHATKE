const crypto = require('crypto');
const mongoose = require('mongoose');
const { isDbConnected } = require('../config/db');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  name: { type: String, required: true, trim: true },
  passwordHash: { type: String, required: true },
  verified: { type: Boolean, default: true }
}, { timestamps: true });

const MongooseUser = mongoose.model('User', UserSchema);
const memoryUsers = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, expected] = String(storedHash || '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

async function findByEmail(email) {
  if (isDbConnected()) return MongooseUser.findOne({ email }).lean();
  return memoryUsers.get(email) || null;
}

async function create(user) {
  if (isDbConnected()) {
    const created = await MongooseUser.create(user);
    return created.toObject();
  }
  const created = { ...user, _id: `user_${crypto.randomUUID()}`, createdAt: new Date() };
  memoryUsers.set(user.email, created);
  return created;
}

async function updatePassword(email, passwordHash) {
  if (isDbConnected()) {
    return MongooseUser.findOneAndUpdate(
      { email },
      { $set: { passwordHash } },
      { returnDocument: 'after' }
    ).lean();
  }
  const user = memoryUsers.get(email);
  if (!user) return null;
  user.passwordHash = passwordHash;
  return user;
}

module.exports = { findByEmail, create, updatePassword, hashPassword, verifyPassword };
