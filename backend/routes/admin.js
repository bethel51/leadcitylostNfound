const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const User = require('../models/User');
const VerificationLog = require('../models/VerificationLog');
const Alert = require('../models/Alert');
const { protect, adminOnly } = require('../middleware/auth');
const { sendEmail: _sendEmailRaw } = require('../config/email');

// Helper: send a broadcast email to one recipient
const sendBroadcastEmail = async ({ to, name, title, message, priority }) => {
  const priorityColor = priority === 'urgent' ? '#dc2626' : priority === 'important' ? '#d97706' : '#1a56db';
  const priorityLabel = priority === 'urgent' ? '🚨 URGENT' : priority === 'important' ? '⚠️ IMPORTANT' : 'ℹ️ NOTICE';
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:auto;padding:28px 22px;border:1.5px solid #e2e8f0;border-radius:12px;background:#ffffff;">
      <div style="text-align:center;border-bottom:2px solid #0f2b5c;padding-bottom:14px;margin-bottom:18px;">
        <h1 style="color:#0f2b5c;margin:0;font-size:1.4rem;">LEAD CITY UNIVERSITY</h1>
        <p style="color:#d4af37;font-weight:700;margin:4px 0 0;font-size:0.82rem;text-transform:uppercase;letter-spacing:1.2px;">Campus Security Broadcast — LCU FindMe Portal</p>
      </div>
      <div style="background:${priorityColor}10;border-left:4px solid ${priorityColor};padding:10px 14px;border-radius:4px;margin-bottom:18px;">
        <strong style="color:${priorityColor};font-size:0.85rem;">${priorityLabel}</strong>
      </div>
      <p style="font-size:0.95rem;color:#1e293b;">Hello <strong>${name || 'Student'}</strong>,</p>
      <h2 style="color:#0f2b5c;font-size:1.15rem;margin:0 0 10px;">${title}</h2>
      <p style="color:#334155;line-height:1.65;font-size:0.95rem;">${message}</p>
      <div style="text-align:center;margin:28px 0;">
        <a href="https://leadcitylostnfound-byfi.onrender.com/dashboard.html" style="display:inline-block;padding:11px 28px;font-weight:700;font-size:0.9rem;color:#ffffff;background:linear-gradient(135deg,#0f2b5c,#1a56db);text-decoration:none;border-radius:8px;">Go To Portal Dashboard</a>
      </div>
      <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0 14px;">
      <p style="text-align:center;font-size:0.78rem;color:#94a3b8;margin:0;">&copy; 2026 Lead City University &bull; Campus Security Command</p>
    </div>
  `;
  const text = `${priorityLabel} — ${title}\n\nHello ${name || 'Student'},\n\n${message}\n\n© 2026 Lead City University Campus Security Command`;
  // Use the low-level sendEmail helper from email.js
  const https = require('https');
  const payload = JSON.stringify({
    sender: { name: process.env.SMTP_FROM_NAME || 'LCU FindMe Portal', email: process.env.SMTP_SENDER || '2bethel4u@gmail.com' },
    to: [{ email: to }],
    replyTo: { name: process.env.SMTP_FROM_NAME || 'LCU FindMe Portal', email: process.env.SMTP_SENDER || '2bethel4u@gmail.com' },
    subject: `[Campus Security] ${title}`,
    htmlContent: html,
    textContent: text,
    headers: { 'X-Mailer': 'LCU-FindMe-Portal/1.0', 'Precedence': 'bulk' }
  });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.brevo.com', path: '/v3/smtp/email', method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => { console.warn('Broadcast email error for', to, ':', e.message); resolve({ error: e.message }); });
    req.write(payload);
    req.end();
  });
};

// ============================================================
// 1. DASHBOARD STATS
// ============================================================
// @route   GET api/admin/stats
// @desc    Get aggregate platform statistics for admin dashboard
// @access  Protected (Admin only)
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalItems = await Item.countDocuments();
    const activeLost = await Item.countDocuments({ type: 'lost', status: { $ne: 'returned' } });
    const activeFound = await Item.countDocuments({ type: 'found', status: { $ne: 'returned' } });
    const returnedItems = await Item.countDocuments({ status: 'returned' });

    // Claims aggregate
    const allItemsWithClaims = await Item.find({ 'verificationClaims.0': { $exists: true } });
    let totalClaims = 0;
    let pendingClaims = 0;
    let acceptedClaims = 0;

    allItemsWithClaims.forEach(item => {
      (item.verificationClaims || []).forEach(claim => {
        totalClaims++;
        if (claim.status === 'pending' || !claim.status) pendingClaims++;
        if (claim.status === 'accepted') acceptedClaims++;
      });
    });

    // Users stats
    const totalUsers = await User.countDocuments();
    const activatedUsers = await User.countDocuments({ isActivated: true });
    const verifiedUsers = await User.countDocuments({ isVerified: true });
    const studentUsers = await User.countDocuments({ role: 'student' });
    const staffUsers = await User.countDocuments({ role: { $in: ['staff', 'admin'] } });

    // Category breakdown
    const categoryAggregation = await Item.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Chain of custody count
    const totalHandovers = await VerificationLog.countDocuments();

    res.json({
      success: true,
      stats: {
        totalItems,
        activeLost,
        activeFound,
        returnedItems,
        totalClaims,
        pendingClaims,
        acceptedClaims,
        totalUsers,
        activatedUsers,
        verifiedUsers,
        studentUsers,
        staffUsers,
        totalHandovers,
        categories: categoryAggregation
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Server Error fetching admin stats', error: error.message });
  }
});

// ============================================================
// 2. USER & STUDENT DIRECTORY MANAGEMENT
// ============================================================
// @route   GET api/admin/users
// @desc    Get registered users with search and filter
// @access  Protected (Admin only)
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const { search, role, isActivated, isVerified, limit = 100 } = req.query;
    let query = {};

    if (role && role !== 'all') {
      query.role = role;
    }

    if (isActivated === 'true') query.isActivated = true;
    if (isActivated === 'false') query.isActivated = false;

    if (isVerified === 'true') query.isVerified = true;
    if (isVerified === 'false') query.isVerified = false;

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { name: { $regex: term, $options: 'i' } },
        { matricNumber: { $regex: term, $options: 'i' } },
        { email: { $regex: term, $options: 'i' } },
        { faculty: { $regex: term, $options: 'i' } },
        { department: { $regex: term, $options: 'i' } },
        { phoneNumber: { $regex: term, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: users.length, users });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'Server Error fetching users', error: error.message });
  }
});

// @route   PUT api/admin/users/:id/activation
// @desc    Toggle or manually override user account activation
// @access  Protected (Admin only)
router.put('/users/:id/activation', protect, adminOnly, async (req, res) => {
  try {
    const { isActivated, reason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.isActivated = isActivated !== undefined ? Boolean(isActivated) : !user.isActivated;
    if (user.isActivated) {
      user.activationPaid = true;
      user.activatedAt = user.activatedAt || new Date();
      user.activationPaymentRef = user.activationPaymentRef || `ADMIN-OVERRIDE-${Date.now()}`;
    } else {
      user.activationPaid = false;
    }

    await user.save();

    res.json({
      success: true,
      message: `User account ${user.isActivated ? 'activated' : 'deactivated'} successfully.`,
      user: {
        id: user._id,
        name: user.name,
        matricNumber: user.matricNumber,
        email: user.email,
        isActivated: user.isActivated,
        activationPaid: user.activationPaid,
        activatedAt: user.activatedAt
      }
    });
  } catch (error) {
    console.error('Admin toggle activation error:', error);
    res.status(500).json({ message: 'Server Error updating activation', error: error.message });
  }
});

// @route   PUT api/admin/users/:id/verify
// @desc    Toggle email verification status for a user
// @access  Protected (Admin only)
router.put('/users/:id/verify', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.isVerified = !user.isVerified;
    await user.save();

    res.json({
      success: true,
      message: `User verification status set to ${user.isVerified ? 'Verified' : 'Unverified'}.`,
      isVerified: user.isVerified
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT api/admin/users/:id/role
// @desc    Update user role (student, staff, admin)
// @access  Protected (Admin only)
router.put('/users/:id/role', protect, adminOnly, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'staff', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.role = role;
    await user.save();

    res.json({
      success: true,
      message: `User role updated to ${role}.`,
      user: { id: user._id, name: user.name, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE api/admin/users/:id
// @desc    Delete user account permanently
// @access  Protected (Admin only)
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Prevent deleting the currently logged in admin user
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'Cannot delete your own active admin account.' });
    }

    await User.deleteOne({ _id: req.params.id });
    res.json({ success: true, message: 'User account removed permanently.' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ============================================================
// 3. CENTRALIZED CLAIMS & DISPUTES INBOX
// ============================================================
// @route   GET api/admin/claims
// @desc    Get all verification claims across all items
// @access  Protected (Admin only)
router.get('/claims', protect, adminOnly, async (req, res) => {
  try {
    const { status = 'all' } = req.query;
    const items = await Item.find({ 'verificationClaims.0': { $exists: true } });

    const claimsList = [];
    items.forEach(item => {
      (item.verificationClaims || []).forEach(claim => {
        const claimStatus = claim.status || 'pending';
        if (status === 'all' || claimStatus === status) {
          claimsList.push({
            claimId: claim._id,
            itemId: item._id,
            itemTitle: item.title,
            itemType: item.type,
            itemCategory: item.category,
            itemLocation: item.location,
            itemStatus: item.status,
            itemImage: item.image,
            reporterName: item.reporterName,
            reporterEmail: item.reporterEmail,
            claimantName: claim.claimantName,
            claimantMatric: claim.claimantMatric,
            claimantEmail: claim.claimantEmail,
            claimantPhone: claim.claimantPhone,
            claimantFaculty: claim.claimantFaculty,
            claimantDept: claim.claimantDept,
            claimantLevel: claim.claimantLevel,
            claimDetails: claim.claimDetails,
            claimDate: claim.claimDate,
            status: claimStatus,
            resolved: claim.resolved
          });
        }
      });
    });

    // Sort newest claims first
    claimsList.sort((a, b) => new Date(b.claimDate) - new Date(a.claimDate));

    res.json({ success: true, count: claimsList.length, claims: claimsList });
  } catch (error) {
    console.error('Admin get claims error:', error);
    res.status(500).json({ message: 'Server Error fetching claims', error: error.message });
  }
});

// ============================================================
// 4. CHAIN OF CUSTODY (VERIFICATION LEDGER)
// ============================================================
// @route   GET api/admin/verifications
// @desc    Get all persistent verification log entries
// @access  Protected (Admin only)
router.get('/verifications', protect, adminOnly, async (req, res) => {
  try {
    const logs = await VerificationLog.find().sort({ timestamp: -1 });
    res.json({ success: true, count: logs.length, logs });
  } catch (error) {
    console.error('Admin get verifications error:', error);
    res.status(500).json({ message: 'Server Error fetching verification logs', error: error.message });
  }
});

// @route   POST api/admin/verifications
// @desc    Record a new in-person handover into permanent ledger
// @access  Protected (Admin only)
router.post('/verifications', protect, adminOnly, async (req, res) => {
  try {
    const {
      itemId,
      itemTitle,
      claimantName,
      claimantId,
      claimantEmail,
      claimantPhone,
      officerName,
      station,
      notes
    } = req.body;

    if (!itemId || !itemTitle || !claimantName || !claimantId) {
      return res.status(400).json({ message: 'Item ID, Title, Claimant Name, and ID are required.' });
    }

    const logEntry = await VerificationLog.create({
      itemId,
      itemTitle,
      claimantName,
      claimantId,
      claimantEmail: claimantEmail || '',
      claimantPhone: claimantPhone || '',
      officerName: officerName || req.user.name || 'CSO Duty Officer',
      station: station || 'Security Post',
      notes: notes || '',
      timestamp: new Date()
    });

    res.status(201).json({ success: true, message: 'Handover logged successfully', log: logEntry });
  } catch (error) {
    console.error('Admin create verification log error:', error);
    res.status(500).json({ message: 'Server Error saving verification log', error: error.message });
  }
});

// ============================================================
// 5. CAMPUS SECURITY ALERTS & BROADCASTS
// ============================================================
// @route   GET api/admin/alerts
// @desc    Get all campus security notices
// @access  Public or Protected
router.get('/alerts', async (req, res) => {
  try {
    const alerts = await Alert.find({ active: true }).sort({ createdAt: -1 });
    res.json({ success: true, alerts });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST api/admin/alerts
// @desc    Create a new campus security broadcast
// @access  Protected (Admin only)
router.post('/alerts', protect, adminOnly, async (req, res) => {
  try {
    const { title, message, priority } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: 'Title and message are required' });
    }

    const alert = await Alert.create({
      title: title.trim(),
      message: message.trim(),
      priority: priority || 'info',
      postedBy: req.user.name || 'Campus Security Command'
    });

    // ── Bulk-email all registered users (fire-and-forget; non-blocking) ──
    User.find({}, 'name email').then(users => {
      if (!users || users.length === 0) return;
      const tasks = users.map(u =>
        sendBroadcastEmail({ to: u.email, name: u.name, title: title.trim(), message: message.trim(), priority: priority || 'info' })
          .catch(err => console.warn(`Broadcast email failed for ${u.email}:`, err.message))
      );
      Promise.allSettled(tasks).then(results => {
        const sent = results.filter(r => r.status === 'fulfilled').length;
        console.log(`[Broadcast] Alert "${title}" emailed to ${sent}/${users.length} users.`);
      });
    }).catch(err => console.warn('[Broadcast] Could not load users for email:', err.message));

    res.status(201).json({ success: true, message: 'Broadcast alert created and email dispatch started.', alert });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE api/admin/alerts/:id
// @desc    Deactivate/remove an alert
// @access  Protected (Admin only)
router.delete('/alerts/:id', protect, adminOnly, async (req, res) => {
  try {
    await Alert.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Alert removed' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// ============================================================
// 6. SECURITY INTAKE (DIRECT PROPERTY INTAKE AT GATE/DESK)
// ============================================================
// @route   POST api/admin/intake
// @desc    Direct intake of recovered item by security personnel
// @access  Protected (Admin only)
router.post('/intake', protect, adminOnly, async (req, res) => {
  try {
    const {
      title,
      category,
      location,
      description,
      finderName,
      finderContact,
      binTag,
      image
    } = req.body;

    if (!title || !category || !location || !description) {
      return res.status(400).json({ message: 'Title, category, location, and description are required.' });
    }

    const intakeItem = await Item.create({
      title: title.trim(),
      type: 'found',
      category: category.trim(),
      location: `${location.trim()} (Logged at Security Desk - ${binTag || 'Main Bin'})`,
      date: new Date(),
      description: `${description.trim()} [Security Intake Bin: ${binTag || 'Security Safe'}]`,
      reporterName: `Security Intake (Finder: ${finderName || 'Anonymous / Turn-in'})`,
      reporterContact: finderContact || 'Campus Security Desk Gate A',
      reporterEmail: req.user.email || 'security@lcu.edu.ng',
      reporterMatric: 'STAFF-SECURITY',
      status: 'active',
      image: image || null
    });

    res.status(201).json({
      success: true,
      message: 'Property intake logged successfully into custody.',
      item: intakeItem
    });
  } catch (error) {
    console.error('Security intake error:', error);
    res.status(500).json({ message: 'Server Error during property intake', error: error.message });
  }
});

module.exports = router;
