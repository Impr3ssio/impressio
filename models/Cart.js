const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      filename: { type: String, required: true },
      volume: { type: Number, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, default: 1 },
      material: { type: String, default: 'PLA' }, // Add material field
    },
  ],
  totalPrice: { type: Number, default: 0 },
});

module.exports = mongoose.model('Cart', cartSchema);