const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../middleware/ensureAuthenticated'); // Import the middleware
const Order = require('../models/Order');
const Cart = require('../models/Cart');

router.get('/order-history', ensureAuthenticated, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });

    // Debugging: Log the user ID and fetched orders
    console.log('User ID:', req.user._id);
    console.log('Orders fetched:', orders);

    res.render('order-history', { orders, user: req.user, messages: req.flash() });
  } catch (error) {
    console.error('Error fetching order history:', error);
    req.flash('error', 'Error fetching order history. Please try again.');
    res.redirect('/profile');
  }
});

// Route to handle checkout
router.post('/checkout', ensureAuthenticated, async (req, res) => {
  const { name, email, address, phone } = req.body;
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || cart.items.length === 0) {
      req.flash('error', 'No items in cart.');
      return res.redirect('/cart');
    }
    console.log('🛒 Cart Items:', cart.items);

    // Save order details
    const order = new Order({
      userId: req.user._id,
      name,
      email,
      address,
      phone,
      totalPrice: cart.totalPrice,
      items: cart.items,
    });
    await order.save();

    // Debugging: Log the saved order
    const savedOrder = await order.save(); // Save order in the database
    console.log('✅ Order successfully saved:', savedOrder);

    // Clear the cart
    await Cart.deleteOne({ userId: req.user._id });

    req.flash('success', `Order placed successfully! Total Price: ₹${cart.totalPrice.toFixed(2)}`);
    res.redirect('/');
  } catch (error) {
    console.error('Error during checkout:', error);
    req.flash('error', 'Error during checkout. Please try again.');
    res.redirect('/cart');
  }
});

// Export the router
module.exports = router;