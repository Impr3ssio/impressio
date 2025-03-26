const express = require('express');
const router = express.Router();
const ensureAuthenticated = require('../middleware/ensureAuthenticated'); // Import the middleware
const Cart = require('../models/Cart'); // Import the Cart model

// Route to display the cart
router.get('/cart', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    const cartItems = cart ? cart.items : [];
    const totalPrice = cart ? cart.totalPrice : 0;
    res.render('cart', { cartItems, totalPrice, user: req.user, messages: req.flash() });
  } catch (error) {
    console.error('Error fetching cart:', error);
    req.flash('error', 'Error fetching cart. Please try again.');
    res.redirect('/');
  }
});

// Route to update an item in the cart
router.post('/cart/update/:index', ensureAuthenticated, async (req, res) => {
  const index = parseInt(req.params.index);
  const quantity = parseInt(req.body.quantity);
  const material = req.body.material;

  if (isNaN(index) || index < 0 || isNaN(quantity) || quantity < 1) {
    req.flash('error', 'Invalid input.');
    return res.redirect('/cart');
  }

  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || !cart.items || index >= cart.items.length) {
      req.flash('error', 'Item not found in cart.');
      return res.redirect('/cart');
    }

    // Update the quantity, material, and total price
    const item = cart.items[index];
    cart.totalPrice -= item.price * item.quantity; // Subtract old total
    item.quantity = quantity;
    item.material = material; // Update material
    cart.totalPrice += item.price * quantity; // Add new total

    await cart.save();
    req.flash('success', 'Cart updated successfully.');
    res.redirect('/cart');
  } catch (error) {
    console.error('Error updating cart:', error);
    req.flash('error', 'Failed to update cart.');
    res.redirect('/cart');
  }
});

// Route to delete an item from the cart
router.post('/cart/delete/:index', ensureAuthenticated, async (req, res) => {
  const index = parseInt(req.params.index);

  if (isNaN(index) || index < 0) {
    req.flash('error', 'Invalid item index.');
    return res.redirect('/cart');
  }

  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || !cart.items || index >= cart.items.length) {
      req.flash('error', 'Item not found in cart.');
      return res.redirect('/cart');
    }

    // Remove the item at the specified index
    const deletedItem = cart.items.splice(index, 1)[0];
    cart.totalPrice -= deletedItem.price * deletedItem.quantity; // Update total price

    await cart.save();
    req.flash('success', 'Item removed from cart.');
    res.redirect('/cart');
  } catch (error) {
    console.error('Error deleting item from cart:', error);
    req.flash('error', 'Failed to delete item from cart.');
    res.redirect('/cart');
  }
});

module.exports = router;