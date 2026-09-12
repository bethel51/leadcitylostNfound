const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendVerificationEmail, sendResetEmail, sendWelcomeEmail, sendActivationEmail, sendOfficialWelcomeEmail } = require('../config/email');

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
    const { name, matricNumber, email, phoneNumber, faculty, department, level, password, role } = req.body;

    const trimmedMatric = matricNumber ? matricNumber.trim().toLowerCase() : '';
    const trimmedEmail = email ? email.trim().toLowerCase() : '';
    const isNonStudent = role === 'admin' || role === 'staff';
    const verificationOTP = generateOTP();

    // Email is required for all account types (used for OTP verification)
    if (!trimmedEmail) {
      return res.status(400).json({ message: 'Email is required for account verification.' });
    }

    // Validate email format if provided
    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ message: 'Please provide a valid email address (e.g. name@domain.com).' });
      }
    }

    // Check if user exists by email or matric number
    const query = [];
    if (trimmedMatric) query.push({ matricNumber: trimmedMatric });
    if (trimmedEmail) query.push({ email: trimmedEmail });

    if (query.length > 0) {
      const userExists = await User.findOne({ $or: query });
      if (userExists) {
        // If the existing user is NOT verified, allow overwriting their account details (self-healing for typos/network failures)
        if (!userExists.isVerified) {
          userExists.name = name ? name.trim() : '';
          userExists.matricNumber = isNonStudent ? (trimmedEmail || `${role}-${Date.now()}`) : trimmedMatric;
          userExists.email = trimmedEmail || undefined;
          userExists.phoneNumber = phoneNumber ? phoneNumber.trim() : undefined;
          userExists.faculty = isNonStudent ? 'Staff' : faculty;
          userExists.department = isNonStudent ? 'Staff' : department;
          userExists.level = isNonStudent ? 'Staff' : level;
          userExists.password = password; // Pre-save hook will hash it
          userExists.role = role || 'student';
          userExists.emailVerificationOTP = verificationOTP;
          await userExists.save();

          if (userExists.email) {
            sendVerificationEmail(userExists.email, verificationOTP).catch(mailErr => {
              console.error('Email sending failed during registration overwrite:', mailErr);
            });
          }

          return res.status(201).json({
            message: 'Registration updated! A new OTP verification code has been sent to your email.',
            requiresVerification: true,
            email: userExists.email
          });
        }
        return res.status(400).json({ message: 'User with this matric number or email already exists' });
      }
    }
    const user = await User.create({
      name: name ? name.trim() : '',
      matricNumber: isNonStudent ? (trimmedEmail || `${role}-${Date.now()}`) : trimmedMatric,
      email: trimmedEmail || undefined,
      phoneNumber: phoneNumber ? phoneNumber.trim() : undefined,
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
        sendVerificationEmail(user.email, verificationOTP).catch(mailErr => {
          console.error('Email sending failed during registration:', mailErr);
        });
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

// @route   POST api/auth/resend-otp
// @desc    Resend verification OTP to user's email
// @access  Public
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(404).json({ message: 'No account found with this email.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Account is already verified. Please log in.' });
    }

    const newOTP = generateOTP();
    user.emailVerificationOTP = newOTP;
    await user.save();

    sendVerificationEmail(user.email, newOTP).catch(mailErr => {
      console.error('Resend OTP email failed:', mailErr);
    });

    res.json({ message: 'A new verification code has been sent to your email.' });
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

    // Send welcome email in background
    sendWelcomeEmail(user.email, user.name).catch(welcomeErr => {
      console.error('Welcome email sending failed:', welcomeErr);
    });

    res.json({
      message: 'Account successfully verified!',
      token: generateToken(user._id),
      user: {
        id: user._id,
        name: user.name,
        matricNumber: user.matricNumber,
        email: user.email,
        phoneNumber: user.phoneNumber,
        faculty: user.faculty,
        department: user.department,
        level: user.level,
        role: user.role,
        isVerified: user.isVerified,
        isActivated: user.role === 'admin' ? true : (user.isActivated || false),
        activationPaid: user.role === 'admin' ? true : (user.activationPaid || false)
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
    const trimmedIdentifier = identifier ? identifier.trim().toLowerCase() : '';

    // Find user by matricNumber or email
    const user = await User.findOne({
      $or: [
        { matricNumber: trimmedIdentifier },
        { email: trimmedIdentifier }
      ]
    });

    if (user && (await user.matchPassword(password))) {
      // Allow bypass of verification if user has no email configured (e.g. some student accounts)
      if (user.email && !user.isVerified) {
        // Resend Verification OTP on failed login due to verification
        const verificationOTP = generateOTP();
        user.emailVerificationOTP = verificationOTP;
        await user.save();
        
        sendVerificationEmail(user.email, verificationOTP).catch(mailErr => {
          console.error('Resending verification email failed:', mailErr);
        });

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
          phoneNumber: user.phoneNumber,
          faculty: user.faculty,
          department: user.department,
          level: user.level,
          role: user.role,
          isVerified: user.isVerified,
          isActivated: user.role === 'admin' ? true : (user.isActivated || false),
          activationPaid: user.role === 'admin' ? true : (user.activationPaid || false)
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

// @route   GET api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   PUT api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { name, email, matricNumber, department, faculty, phoneNumber, level } = req.body;

    if (name && name.trim() !== '') user.name = name.trim();
    if (email && email.trim() !== '') user.email = email.trim().toLowerCase();
    if (matricNumber && matricNumber.trim() !== '') user.matricNumber = matricNumber.trim().toLowerCase();
    if (department !== undefined) user.department = department.trim();
    if (faculty !== undefined) user.faculty = faculty.trim();
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber.trim();
    if (level !== undefined) user.level = level.toString().trim();

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      matricNumber: updatedUser.matricNumber,
      matric: updatedUser.matricNumber,
      email: updatedUser.email,
      phoneNumber: updatedUser.phoneNumber,
      phone: updatedUser.phoneNumber,
      faculty: updatedUser.faculty,
      department: updatedUser.department,
      dept: updatedUser.department,
      level: updatedUser.level,
      role: updatedUser.role,
      isVerified: updatedUser.isVerified,
      isActivated: updatedUser.role === 'admin' ? true : (updatedUser.isActivated || false),
      activationPaid: updatedUser.role === 'admin' ? true : (updatedUser.activationPaid || false)
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile', error: error.message });
  }
});

// @route   POST api/auth/initiate-activation-payment
// @desc    Process activation payment simulation and dispatch email OTP code
// @access  Private (JWT protected)
router.post('/initiate-activation-payment', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (user.isActivated) {
      return res.status(400).json({ message: 'Your account is already activated.' });
    }

    const { amount = 1000, paymentMethod = 'card' } = req.body;
    const activationOTP = generateOTP();
    const paymentRef = `LCU-ACT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    user.activationPaid = true;
    user.activationAmount = Number(amount) || 1000;
    user.activationPaymentRef = paymentRef;
    user.activationOTP = activationOTP;
    user.activationOTPExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry
    await user.save();

    if (user.email) {
      sendActivationEmail(user.email, activationOTP, user.name, paymentRef).catch(mailErr => {
        console.error('Failed to send activation email:', mailErr);
      });
    }

    res.json({
      success: true,
      message: 'Activation key payment confirmed! A 6-digit OTP code has been dispatched to your email.',
      paymentRef,
      email: user.email,
      amount: user.activationAmount
    });
  } catch (error) {
    console.error('Activation payment error:', error);
    res.status(500).json({ message: 'Server error processing activation payment', error: error.message });
  }
});

// @route   POST api/auth/verify-activation-otp
// @desc    Verify the activation OTP, permanently activate account, and dispatch welcome email
// @access  Private (JWT protected)
router.post('/verify-activation-otp', protect, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp || typeof otp !== 'string') {
      return res.status(400).json({ message: 'Please enter the 6-digit activation code.' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (user.isActivated) {
      return res.json({
        success: true,
        message: 'Account is already fully activated!',
        isActivated: true,
        user: {
          id: user._id,
          name: user.name,
          matricNumber: user.matricNumber,
          email: user.email,
          phoneNumber: user.phoneNumber,
          faculty: user.faculty,
          department: user.department,
          level: user.level,
          role: user.role,
          isVerified: user.isVerified,
          isActivated: true,
          activationPaid: true
        }
      });
    }

    if (!user.activationPaid) {
      return res.status(400).json({ message: 'Activation fee payment must be completed before verifying code.' });
    }

    const cleanInputOTP = otp.trim();
    if (!user.activationOTP || user.activationOTP !== cleanInputOTP) {
      return res.status(400).json({ message: 'Invalid activation code. Please check your email and try again.' });
    }

    if (user.activationOTPExpires && user.activationOTPExpires < Date.now()) {
      return res.status(400).json({ message: 'Activation code has expired. Please request a new code.' });
    }

    // Permanently mark account as activated
    user.isActivated = true;
    user.activatedAt = new Date();
    user.activationOTP = undefined;
    user.activationOTPExpires = undefined;
    await user.save();

    // Send official welcome email as requested
    if (user.email) {
      sendOfficialWelcomeEmail(user.email, user.name).catch(mailErr => {
        console.error('Failed to send official welcome email:', mailErr);
      });
    }

    res.json({
      success: true,
      message: 'Welcome to the official lost and found platform widely for leadcity university students!',
      user: {
        id: user._id,
        name: user.name,
        matricNumber: user.matricNumber,
        email: user.email,
        phoneNumber: user.phoneNumber,
        faculty: user.faculty,
        department: user.department,
        level: user.level,
        role: user.role,
        isVerified: user.isVerified,
        isActivated: true,
        activationPaid: true,
        activatedAt: user.activatedAt
      }
    });
  } catch (error) {
    console.error('Verify activation OTP error:', error);
    res.status(500).json({ message: 'Server error verifying activation code', error: error.message });
  }
});

// @route   POST api/auth/resend-activation-otp
// @desc    Resend activation key OTP code to user email
// @access  Private (JWT protected)
router.post('/resend-activation-otp', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (user.isActivated) {
      return res.status(400).json({ message: 'Account is already activated.' });
    }

    if (!user.activationPaid) {
      return res.status(400).json({ message: 'Please initiate activation payment first.' });
    }

    const newOTP = generateOTP();
    user.activationOTP = newOTP;
    user.activationOTPExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    if (user.email) {
      sendActivationEmail(user.email, newOTP, user.name, user.activationPaymentRef).catch(mailErr => {
        console.error('Resend activation OTP failed:', mailErr);
      });
    }

    res.json({
      success: true,
      message: 'A new 6-digit activation code has been sent to your email.'
    });
  } catch (error) {
    console.error('Resend activation OTP error:', error);
    res.status(500).json({ message: 'Server error resending activation code', error: error.message });
  }
});

module.exports = router;
