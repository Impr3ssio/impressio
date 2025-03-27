const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
(async () => {
    const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
})();
const Cart = require('../models/Cart');
const ensureAuthenticated = require('../middleware/ensureAuthenticated');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});

const upload = multer({ storage });

// Route to handle file uploads
router.post('/upload', ensureAuthenticated, upload.array('stlFiles'), async (req, res) => {
  console.log('Request body:', req.body); // Log the request body
  console.log('Request files:', req.files); // Log the uploaded files
const files = req.files;

  // Check if files were uploaded
  if (!files || files.length === 0) {
    req.flash('error', 'No files uploaded.');
    return res.redirect('/upload');
  }

  try {
    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [], totalPrice: 0 });
    }

    // Process each uploaded file
    for (const file of files) {
      const filePath = file.path;
      const volume = await calculateVolume(filePath);
      const price = volume * 0.00192;

      cart.items.push({ filename: file.originalname, volume, price });
      cart.totalPrice += price;
    }

    await cart.save();
    res.redirect('/cart');
  } catch (error) {
    console.error('Error processing files:', error);
    req.flash('error', 'Error processing files. Please try again.');
    res.redirect('/upload');
  }
});

// Function to calculate volume from STL file
function calculateVolume(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const stlContent = fs.readFileSync(filePath, null); // Read file as binary buffer
      const loader = new STLLoader();
      const geometry = loader.parse(stlContent.buffer); // Pass ArrayBuffer to STLLoader

      if (!geometry || !geometry.attributes || !geometry.attributes.position) {
        throw new Error('Invalid STL file: Unable to parse geometry');
      }

      const positions = geometry.attributes.position.array;
      let volume = 0;

      for (let i = 0; i < positions.length; i += 9) {
        const p1 = [positions[i], positions[i + 1], positions[i + 2]];
        const p2 = [positions[i + 3], positions[i + 4], positions[i + 5]];
        const p3 = [positions[i + 6], positions[i + 7], positions[i + 8]];

        // Calculate the signed volume of the tetrahedron formed by the face and the origin
        const v321 = p3[0] * p2[1] * p1[2];
        const v231 = p2[0] * p3[1] * p1[2];
        const v312 = p3[0] * p1[1] * p2[2];
        const v132 = p1[0] * p3[1] * p2[2];
        const v213 = p2[0] * p1[1] * p3[2];
        const v123 = p1[0] * p2[1] * p3[2];

        volume += (-v321 + v231 + v312 - v132 - v213 + v123) / 6;
      }

      resolve(Math.abs(volume)); // Return absolute value of volume
    } catch (error) {
      console.error('Error parsing STL file:', error.message);
      reject(new Error('Invalid STL file. Please upload a valid STL file.'));
    }
  });
}

module.exports = router;
