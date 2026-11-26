const express = require('express');
const router = express.Router();
const Inquiry = require('../models/Inquiry');
const { protect, adminOnly } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { 
  sendInquiryNotificationToAdmin, 
  sendInquiryReplyToUser 
} = require('../config/email');

// Optional auth helper: extracts user if token provided without rejecting if guest
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (e) {
      // Guest or expired token, proceed without error
    }
  }
  next();
};

/**
 * @route   POST /api/support
 * @desc    Submit a support inquiry or message
 * @access  Public / Student
 */
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { name, email, matricNumber, category, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, email, and message details are required.' 
      });
    }

    const newInquiry = new Inquiry({
      userId: req.user ? req.user._id : null,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      matricNumber: matricNumber ? matricNumber.trim() : (req.user ? req.user.matricNumber : ''),
      category: category || 'general',
      message: message.trim(),
      status: 'pending'
    });

    const savedInquiry = await newInquiry.save();

    // Send email alert to Admin (ifeanyichukwubethel1@gmail.com)
    sendInquiryNotificationToAdmin({
      name: savedInquiry.name,
      email: savedInquiry.email,
      matricNumber: savedInquiry.matricNumber,
      category: savedInquiry.category,
      message: savedInquiry.message
    }).catch(err => console.error('Admin inquiry alert email error:', err.message));

    res.status(201).json({
      success: true,
      message: 'Support inquiry submitted successfully. Campus Security has been alerted via email.',
      data: savedInquiry
    });
  } catch (error) {
    console.error('Error creating inquiry:', error);
    res.status(500).json({ success: false, message: 'Server error submitting inquiry.' });
  }
});

/**
 * @route   GET /api/support/my
 * @desc    Get current user's submitted inquiries
 * @access  Protected (or query by email)
 */
router.get('/my', optionalAuth, async (req, res) => {
  try {
    let query = {};
    if (req.user) {
      query = { $or: [{ userId: req.user._id }, { email: req.user.email.toLowerCase() }] };
    } else if (req.query.email) {
      query = { email: req.query.email.trim().toLowerCase() };
    } else {
      return res.status(400).json({ success: false, message: 'Please provide user credentials or email.' });
    }

    const inquiries = await Inquiry.find(query).sort({ createdAt: -1 });
    res.json({ success: true, data: inquiries });
  } catch (error) {
    console.error('Error fetching student inquiries:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving inquiries.' });
  }
});

/**
 * @route   GET /api/support/admin/all
 * @desc    Get all inquiries for Admin Console
 * @access  Admin Only
 */
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const inquiries = await Inquiry.find().sort({ status: 1, createdAt: -1 });
    res.json({ success: true, data: inquiries });
  } catch (error) {
    console.error('Error fetching admin inquiries:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving inquiries.' });
  }
});

/**
 * @route   PUT /api/support/admin/:id/reply
 * @desc    Reply to an inquiry and notify student
 * @access  Admin Only
 */
router.put('/admin/:id/reply', protect, adminOnly, async (req, res) => {
  try {
    const { reply } = req.body;
    if (!reply || !reply.trim()) {
      return res.status(400).json({ success: false, message: 'Reply message cannot be empty.' });
    }

    const inquiry = await Inquiry.findById(req.params.id);
    if (!inquiry) {
      return res.status(404).json({ success: false, message: 'Inquiry not found.' });
    }

    inquiry.adminReply = reply.trim();
    inquiry.status = 'replied';
    inquiry.repliedAt = new Date();
    inquiry.repliedBy = req.user.name || 'Campus Security Duty Desk';

    await inquiry.save();

    // Send email response to student
    sendInquiryReplyToUser({
      toEmail: inquiry.email,
      name: inquiry.name,
      category: inquiry.category,
      originalMessage: inquiry.message,
      adminReply: inquiry.adminReply
    }).catch(err => console.error('Student inquiry response email error:', err.message));

    res.json({
      success: true,
      message: 'Official response logged and dispatched to student email.',
      data: inquiry
    });
  } catch (error) {
    console.error('Error replying to inquiry:', error);
    res.status(500).json({ success: false, message: 'Server error sending inquiry reply.' });
  }
});

module.exports = router;
