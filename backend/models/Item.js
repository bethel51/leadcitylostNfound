const mongoose = require('mongoose');

const ClaimSchema = new mongoose.Schema({
  claimantName: { type: String, required: true },
  claimantMatric: { type: String, required: true },
  claimDetails: { type: String, required: true },
  claimDate: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  }
});

const ItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['lost', 'found'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  location: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  reporterName: {
    type: String,
    required: true
  },
  reporterContact: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'returned'],
    default: 'active'
  },
  image: {
    type: String,
    default: null
  },
  verificationClaims: [ClaimSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Item', ItemSchema);
