const mongoose = require('mongoose');

// Define User Schema
const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address']
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 4
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  dateOfBirth: {
    type: Date
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', 'prefer-not-to-say']
  },
  isDoctor: {
    type: Boolean,
    default: false
  },
  specialty: {
    type: String,
    trim: true
  },
  googleCalendarRefreshToken: {
    type: String,
    default: null
  },
  googleCalendarAccessToken: {
    type: String,
    default: null
  },
  googleCalendarExpiryDate: {
    type: Date,
    default: null
  },
  googleCalendarEmail: {
    type: String,
    default: null,
    trim: true
  },
  googleCalendarConnectedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Export User model
module.exports = mongoose.model('User', userSchema);
