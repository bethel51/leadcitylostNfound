const mongoose = require('mongoose');

const InquirySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  matricNumber: {
    type: String,
    default: '',
    trim: true
  },
  category: {
    type: String,
    enum: ['general', 'activation', 'claim', 'urgent'],
    default: 'general'
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'replied'],
    default: 'pending'
  },
  adminReply: {
    type: String,
    default: null
  },
  repliedAt: {
    type: Date,
    default: null
  },
  repliedBy: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Inquiry', InquirySchema);
