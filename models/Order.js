const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  address: { type: String, required: true },
  phone: { type: String, required: true },
  totalPrice: { type: Number, required: true },
  items: [
    {
      filename: { type: String, required: true },
      volume: { type: Number, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, default: 1 },
    },
  ],
  status: { type: String, default: 'Pending' }, // Add status field
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);