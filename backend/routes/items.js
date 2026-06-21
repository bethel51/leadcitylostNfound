const express = require('express');
const router = express.Router();
const Item = require('../models/Item');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET api/items
// @desc    Get all items matching optional search query & category filter
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { type, category, search } = req.query;
    let query = {};

    if (type && type !== 'all') {
      query.type = type;
    }

    if (category && category !== 'all') {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    // Sort active first, then newest first
    const items = await Item.find(query);
    items.sort((a, b) => {
      if (a.status === 'returned' && b.status !== 'returned') return 1;
      if (a.status !== 'returned' && b.status === 'returned') return -1;
      return new Date(b.date) - new Date(a.date);
    });

    res.json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET api/items/notifications
// @desc    Get recent notifications for the logged in user
// @access  Protected
router.get('/notifications', protect, async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const notifications = [];

    // 1. Check if any of the user's reports got marked as returned recently
    const myReturnedItems = await Item.find({
      reporterName: req.user.name,
      status: 'returned',
      updatedAt: { $gte: oneHourAgo }
    });

    myReturnedItems.forEach(item => {
      notifications.push({
        message: `✅ Your item "${item.title}" has been successfully resolved/returned.`,
        time: item.date,
        type: 'resolved'
      });
    });

    // 2. Check for newly reported items in the same categories that the user reported
    const myReports = await Item.find({ reporterName: req.user.name });
    const categoriesOfInterest = [...new Set(myReports.map(item => item.category))];

    if (categoriesOfInterest.length > 0) {
      const recentMatches = await Item.find({
        category: { $in: categoriesOfInterest },
        reporterName: { $ne: req.user.name },
        createdAt: { $gte: oneHourAgo }
      }).limit(5);

      recentMatches.forEach(item => {
        notifications.push({
          message: `✨ New ${item.type} listing matches your interest: "${item.title}" in ${item.location}.`,
          time: item.createdAt,
          type: 'match'
        });
      });
    }

    // 3. Check for verification claim status updates for this user
    if (req.user.matricNumber) {
      const myClaimedItems = await Item.find({
        'verificationClaims.claimantMatric': { $regex: new RegExp('^' + req.user.matricNumber + '$', 'i') }
      });

      myClaimedItems.forEach(item => {
        item.verificationClaims.forEach(claim => {
          if (claim.claimantMatric.toLowerCase() === req.user.matricNumber.toLowerCase()) {
            if (claim.status === 'accepted') {
              notifications.push({
                message: `👮 Security has accepted your user verification claim request for "${item.title}".`,
                time: claim.claimDate || item.updatedAt,
                type: 'accepted'
              });
            } else if (claim.status === 'declined') {
              notifications.push({
                message: `❌ Security has declined your user verification claim request for "${item.title}".`,
                time: claim.claimDate || item.updatedAt,
                type: 'declined'
              });
            }
          }
        });
      });
    }

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET api/items/:id
// @desc    Get item by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST api/items
// @desc    Create a new report and perform fuzzy auto-match check
// @access  Protected
router.post('/', protect, async (req, res) => {
  try {
    const { title, type, category, location, date, description, reporterName, reporterContact, image } = req.body;

    const newItem = new Item({
      title,
      type,
      category,
      location,
      date,
      description,
      reporterName,
      reporterContact,
      image,
      reporterEmail: req.user.email || '',
      reporterMatric: req.user.matricNumber || '',
      reporterFaculty: req.user.faculty || '',
      reporterDept: req.user.department || '',
      reporterLevel: req.user.level || ''
    });

    // Fuzzy token match check
    const newTokens = title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(token => token.length >= 3);

    let match = null;
    if (newTokens.length > 0) {
      const targetType = type === 'lost' ? 'found' : 'lost';
      const candidates = await Item.find({ status: 'active', type: targetType, category });
      
      for (let cand of candidates) {
        const candTokens = cand.title.toLowerCase()
          .replace(/[^\w\s]/g, '')
          .split(/\s+/);
          
        const intersection = newTokens.filter(tok => candTokens.includes(tok));
        if (intersection.length > 0) {
          match = cand;
          break;
        }
      }
    }

    // Save item
    const savedItem = await newItem.save();

    res.status(201).json({
      item: savedItem,
      match: match // Contains potential auto-match reference if found
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST api/items/:id/claim
// @desc    Submit claim ownership verification details for found item
// @access  Protected
router.post('/:id/claim', protect, async (req, res) => {
  try {
    const { claimantName, claimantMatric, claimDetails } = req.body;
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.type !== 'found') {
      return res.status(400).json({ message: 'Only found items can be claimed' });
    }

    // Append claim request details
    item.verificationClaims.push({
      claimantName,
      claimantMatric,
      claimDetails,
      claimantEmail: req.user.email || '',
      claimantPhone: req.user.phoneNumber || '',
      claimantFaculty: req.user.faculty || '',
      claimantDept: req.user.department || '',
      claimantLevel: req.user.level || ''
    });

    await item.save();
    res.json({ message: 'Claim request submitted successfully', item });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT api/items/:id/resolve
// @desc    Mark item as returned/resolved
// @access  Protected (Admin only)
router.put('/:id/resolve', protect, adminOnly, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    item.status = 'returned';
    
    // Resolve all claims if any
    item.verificationClaims.forEach(claim => {
      claim.resolved = true;
      claim.status = 'accepted';
    });

    await item.save();
    res.json({ message: 'Item marked as successfully resolved/returned', item });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT api/items/:id/claims/:claimId/respond
// @desc    Respond to a verification claim (accept or decline)
// @access  Protected (Admin only)
router.put('/:id/claims/:claimId/respond', protect, adminOnly, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accept', 'decline'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action. Must be accept or decline.' });
    }

    const item = await Item.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    const claim = item.verificationClaims.id(req.params.claimId);
    if (!claim) {
      return res.status(404).json({ message: 'Claim not found' });
    }

    if (action === 'accept') {
      claim.status = 'accepted';
      claim.resolved = true;
      item.status = 'returned';
      
      // Mark other claims on this item as resolved & declined
      item.verificationClaims.forEach(c => {
        if (c._id.toString() !== claim._id.toString()) {
          c.status = 'declined';
          c.resolved = true;
        }
      });
    } else {
      claim.status = 'declined';
      claim.resolved = true;
    }

    await item.save();
    res.json({ message: `Claim request ${action}ed successfully`, item });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});



// @route   DELETE api/items/:id
// @desc    Delete item record
// @access  Protected (Admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    await Item.deleteOne({ _id: req.params.id });
    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
