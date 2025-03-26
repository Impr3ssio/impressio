const express = require('express');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');

// Login route
router.get('/login', (req, res) => {
  res.render('login', { messages: req.flash() });
});

router.post('/login', passport.authenticate('local', {
  successRedirect: '/upload',
  failureRedirect: '/login',
  failureFlash: true,
}));

// Google OAuth routes
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', passport.authenticate('google', {
  successRedirect: '/profile',
  failureRedirect: '/login',
  failureFlash: true,
}));

// Logout route
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      req.flash('error', 'Error during logout. Please try again.');
      return res.redirect('/');
    }
    res.redirect('/');
  });
});

module.exports = router;