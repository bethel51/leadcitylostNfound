const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['info', 'warning', 'urgent'],
    default: 'info'
  },
  postedBy: {
    type: String,
    default: 'Security Unit'
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Alert', AlertSchema);
