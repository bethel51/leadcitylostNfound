const mongoose = require('mongoose');

const VerificationLogSchema = new mongoose.Schema({
  itemTitle: {
    type: String,
    required: true,
    trim: true
  },
  itemId: {
    type: String,
    required: true,
    trim: true
  },
  claimantName: {
    type: String,
    required: true,
    trim: true
  },
  claimantId: {
    type: String,
    required: true,
    trim: true
  },
  claimantEmail: {
    type: String,
    default: '',
    trim: true
  },
  claimantPhone: {
    type: String,
    default: '',
    trim: true
  },
  officerName: {
    type: String,
    required: true,
    trim: true
  },
  station: {
    type: String,
    default: 'Security Post A',
    trim: true
  },
  notes: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('VerificationLog', VerificationLogSchema);
