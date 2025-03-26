const express = require('express');

const app = express();

// Middleware to ensure user is authenticated
function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
      return next();
    }
    req.flash('error', 'Please log in to access this page.');
    res.redirect('/login');
  }
  
  // Order History Route
 app.get('/order-history', ensureAuthenticated, async (req, res) => {
    try {
      const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
      res.render('order-history', { orders, user: req.user, messages: req.flash() });
    } catch (error) {
      console.error('Error fetching order history:', error);
      req.flash('error', 'Error fetching order history. Please try again.');
      res.redirect('/profile');
    }
  });
  // middleware/ensureAuthenticated.js
module.exports = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to access this page.');
  res.redirect('/login');
};