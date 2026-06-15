const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { sendVerificationEmail, sendResetEmail } = require('../config/email');

// Helper to generate Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d'
  });
};

// Generate random 6-digit numeric OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// @route   POST api/auth/register
// @desc    Register user and send verification OTP
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, matricNumber, email, faculty, department, level, password, role } = req.body;

    // Check if email is provided (especially for staff/admin or optional student email)
    if (!email && (role === 'staff' || role === 'admin')) {
      return res.status(400).json({ message: 'Email is required for staff or security officer registration.' });
    }

    // Check if user exists by email or matric number
    const query = [];
    if (matricNumber) query.push({ matricNumber: matricNumber.toLowerCase() });
    if (email) query.push({ email: email.toLowerCase() });

    if (query.length > 0) {
      const userExists = await User.findOne({ $or: query });
      if (userExists) {
        return res.status(400).json({ message: 'User with this matric number or email already exists' });
      }
    }

    // Generate Verification OTP
    const verificationOTP = generateOTP();

    // Set defaults for admin and staff if student fields are missing
    const isNonStudent = role === 'admin' || role === 'staff';
    const user = await User.create({
      name,
      matricNumber: isNonStudent ? (email || `${role}-${Date.now()}`).toLowerCase() : matricNumber,
      email: email ? email.toLowerCase() : undefined,
      faculty: isNonStudent ? 'Staff' : faculty,
      department: isNonStudent ? 'Staff' : department,
      level: isNonStudent ? 'Staff' : level,
      password,
      role: role || 'student',
      isVerified: false,
      emailVerificationOTP: verificationOTP
    });

    if (user) {
      // Send verification email in background if email exists
      if (user.email) {
        try {
          console.log(`[AUTH] Registration OTP generated for ${user.email}: ${verificationOTP}`);
          await sendVerificationEmail(user.email, verificationOTP);
        } catch (mailErr) {
          console.error('Email sending failed during registration:', mailErr);
        }
      }

      res.status(201).json({
        message: 'Registration successful! An OTP verification code has been sent to your email.',
        requiresVerification: true,
        email: user.email
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST api/auth/verify-otp
// @desc    Verify registration OTP
// @access  Public
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerificationOTP !== otp) {
      return res.status(400).json({ message: 'Invalid verification code' });
    }

    user.isVerified = true;
    user.emailVerificationOTP = undefined;
    await user.save();

    res.json({
      message: 'Account successfully verified!',
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        matricNumber: user.matricNumber,
        email: user.email,
        faculty: user.faculty,
        department: user.department,
        level: user.level,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token (enforces verification)
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body; 

    // Find user by matricNumber or email
    const user = await User.findOne({
      $or: [
        { matricNumber: identifier.toLowerCase() },
        { email: identifier.toLowerCase() }
      ]
    });

    if (user && (await user.matchPassword(password))) {
      // Allow bypass of verification if user has no email configured (e.g. some student accounts)
      if (user.email && !user.isVerified) {
        // Resend Verification OTP on failed login due to verification
        const verificationOTP = generateOTP();
        user.emailVerificationOTP = verificationOTP;
        await user.save();
        
        try {
          console.log(`[AUTH] Resent Verification OTP for ${user.email}: ${verificationOTP}`);
          await sendVerificationEmail(user.email, verificationOTP);
        } catch (mailErr) {
          console.error('Resending verification email failed:', mailErr);
        }

        return res.status(403).json({
          message: 'Account not verified. A new verification OTP code has been sent to your email.',
          requiresVerification: true,
          email: user.email
        });
      }

      res.json({
        token: generateToken(user._id),
        user: {
          id: user._id,
          name: user.name,
          matricNumber: user.matricNumber,
          email: user.email,
          faculty: user.faculty,
          department: user.department,
          level: user.level,
          role: user.role
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST api/auth/forgot-password
// @desc    Send password reset OTP
// @access  Public
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ message: 'No account registered with this email address.' });
    }

    const resetOTP = generateOTP();
    user.resetPasswordOTP = resetOTP;
    user.resetPasswordOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
    await user.save();

    try {
      console.log(`[AUTH] Password Reset OTP generated for ${user.email}: ${resetOTP}`);
      await sendResetEmail(user.email, resetOTP);
    } catch (mailErr) {
      console.error('Password reset email failed:', mailErr);
      return res.status(500).json({ message: 'Failed to send reset email. Contact support.' });
    }

    res.json({ message: 'Password reset code sent to your registered email address.' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST api/auth/reset-password
// @desc    Reset password using OTP
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({
      email: email.toLowerCase(),
      resetPasswordOTP: otp,
      resetPasswordOTPExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired password reset verification code.' });
    }

    // Reset password (middleware schema pre('save') hashes it automatically)
    user.password = newPassword;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful! You can now log in securely.' });
  } catch (error) {
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
