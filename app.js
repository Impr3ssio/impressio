const express = require('express');
const multer = require('multer');
const path = require('path');
const ejs = require('ejs');
const bodyParser = require('body-parser');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const flash = require('connect-flash');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const Order = require('./models/Order'); 

// Load environment variables FIRST
dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
require('dotenv').config();
const Razorpay = require('razorpay');
(async () => {
  const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
})();
const fs = require('fs');
const mongoose = require('mongoose');
const authRoutes = require('./routes/authRoutes');
const cartRoutes = require('./routes/cartRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const orderRoutes = require('./routes/orderRoutes');
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String },
  // ... other fields (address, phone, etc.)
});

// Initialize Express
const app = express();
const port = process.env.PORT || 3000;

// Set up view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json()); // For JSON data
app.use(express.urlencoded({ extended: true })); // For URL-encoded data
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://adminShubh:_K1ll3r_@82.112.238.93:27017/?authSource=admin', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Use routes
app.use('/', authRoutes);
app.use('/', cartRoutes);
app.use('/upload', uploadRoutes);
app.use('/order', orderRoutes);

// Import Mongoose models
const User = require('./models/User');
const Cart = require('./models/Cart');


// Passport configuration
// Replace your existing LocalStrategy with this:
passport.use(new LocalStrategy(
  {
    usernameField: 'email', // Explicitly tell Passport to use email field
    passwordField: 'password'
  },
  async (email, password, done) => {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return done(null, false, { message: 'Invalid email or password' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  }
));

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID || '496804778634-7c5vk81hc5qr5til6i7tmbu485rca4pe.apps.googleusercontent.com',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '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',
  callbackURL: 'https://impr3ssio.in//auth/google/callback',
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = new User({
        googleId: profile.id,
        username: profile.displayName,
        email: profile.emails[0].value,
        name: profile.displayName,
      });
      await user.save();
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});


// Use Vercel-compatible writable temp directory
const uploadDir = '/tmp/uploads';

// Ensure the upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage });


// Razorpay setup
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_oxKUjxLHGgTaZZ',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '8jHKa73oqzWNVJmJsbJDycpl',
});

// Function to calculate volume from STL file
function calculateVolume(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const stlContent = fs.readFileSync(filePath); // Read file as buffer
      const arrayBuffer = stlContent.buffer.slice( // Convert to ArrayBuffer
        stlContent.byteOffset,
        stlContent.byteOffset + stlContent.byteLength
      );

      const loader = new STLLoader();
      const geometry = loader.parse(arrayBuffer); // Pass ArrayBuffer to STLLoader

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

const stl = require('node-stl');

function calculateVolume(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const stlContent = fs.readFileSync(filePath);
      const stlModel = new stl(stlContent);

      if (!stlModel || !stlModel.volume) {
        throw new Error('Invalid STL file: Unable to parse geometry');
      }

      resolve(stlModel.volume);
    } catch (error) {
      console.error('Error parsing STL file:', error.message);
      reject(new Error('Invalid STL file. Please upload a valid STL file.'));
    }
  });
}

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error', 'Please log in to access this page.');
  res.redirect('/login');
}

// Routes
app.get('/', (req, res) => {
  res.render('index', { user: req.user, messages: req.flash() });
});

app.use('/uploads', express.static('uploads'));

app.get('/upload', ensureAuthenticated, (req, res) => {
  res.render('upload', { user: req.user, messages: req.flash() });
});

app.post('/upload', ensureAuthenticated, upload.array('stlFiles'), async (req, res) => {
  console.log('Request body:', req.body); // Log the request body
  console.log('Request files:', req.files); // Log the uploaded files
  const files = req.files;
  const material = req.body.material; // Get the selected material

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
      const price = volume * 4.96;

      cart.items.push({ filename: file.originalname, volume, price, material });
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

app.get('/checkout', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || cart.items.length === 0) {
      req.flash('error', 'No items in cart.');
      return res.redirect('/cart');
    }

    res.render('checkout', { user: req.user, totalPrice: cart.totalPrice, messages: req.flash() });
  } catch (error) {
    console.error('Error fetching cart:', error);
    req.flash('error', 'Error fetching cart. Please try again.');
    res.redirect('/cart');
  }
});  

app.post('/create-order', ensureAuthenticated, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ error: 'No items in cart.' });
    }

    const totalPrice = cart.totalPrice;
    if (isNaN(totalPrice)) {
      return res.status(400).json({ error: 'Invalid total price.' });
    }

    const options = {
      amount: Math.round(totalPrice * 100), // Convert to integer
      currency: 'INR',
      receipt: 'order_receipt',
    };

    const order = await razorpay.orders.create(options);
    res.json(order);
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.post('/checkout', ensureAuthenticated, async (req, res) => {
  const { name, email, address, phone } = req.body;
  
  try {
    // Validate required fields
    if (!name || !email || !address || !phone) {
      req.flash('error', 'All fields are required');
      return res.redirect('/checkout');
    }

    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || cart.items.length === 0) {
      req.flash('error', 'No items in cart.');
      return res.redirect('/cart');
    }

    // Save the order
    const order = new Order({
      userId: req.user._id,
      name,
      email,
      address,
      phone,
      totalPrice: cart.totalPrice,
      items: cart.items
    });
    await order.save();

    // Build email message
    let message = `<h2>Thank you for your order, ${name || 'Customer'}!</h2>`;
    message += `<p><strong>Order Summary:</strong></p><ul>`;

    cart.items.forEach((item, i) => {
      message += `
        <li>
          <strong>Item ${i + 1}</strong><br>
          Filename: ${item.filename}<br>
          Volume: ${item.volume.toFixed(2)} cm³<br>
          Quantity: ${item.quantity || 1}<br>
          Material: ${item.material}<br>
          Price: ₹${item.price.toFixed(2)}
        </li><br>
      `;
    });

    message += `</ul>`;
    message += `<p><strong>Total Price:</strong> ₹${cart.totalPrice.toFixed(2)}</p>`;
    message += `<p><strong>Delivery Address:</strong><br>${address}<br>Phone: ${phone}</p>`;

    // Verify transporter connection first
    await transporter.verify();

    // Send email with error handling
    const mailOptions = {
      from: `"IMPR3SSIO" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "IMPR3SSIO - Your Order Confirmation",
      html: message
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);

    // Clear cart
    await Cart.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { items: [], totalPrice: 0 } }
    );

    req.flash('success', 'Order placed successfully! Email sent.');
    res.redirect('/');
  } catch (error) {
    console.error('Checkout Error:', error);
    
    let errorMessage = 'Checkout failed. Please try again.';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please contact support.';
    } else if (error.responseCode === 535) {
      errorMessage = 'Email server rejected login. Please contact support.';
    }
    
    req.flash('error', errorMessage);
    res.redirect('/cart');
  }
});

app.get('/orders', ensureAuthenticated, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .exec();

    res.render('orders', {
      user: req.user,
      orders,
      currentUrl: '/orders',
      messages: req.flash()
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    req.flash('error', 'Failed to load orders');
    res.redirect('/profile');
  }
});


app.get('/profile', ensureAuthenticated, (req, res) => {
  res.render('profile', { user: req.user, messages: req.flash() });
});

app.get('/login', (req, res) => {
  res.render('login', { user: req.user, messages: req.flash() });
});

app.post('/login', passport.authenticate('local', {
  successRedirect: '/upload',
  failureRedirect: '/login',
  failureFlash: true,
}));

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', passport.authenticate('google', {
  successRedirect: '/upload',
  failureRedirect: '/login',
  failureFlash: true,
}));

app.get('/register', (req, res) => {
  res.render('register', { user: req.user, messages: req.flash() });
});

app.post('/register', async (req, res) => {
  const { username, password, name, email, address, phone } = req.body;
  try {
    const user = new User({ username, password, name, email, address, phone });
    await user.save();
    req.flash('success', 'Registration successful! Please log in.');
    res.redirect('/login');
  } catch (error) {
    console.error('Registration error:', error);
    req.flash('error', 'Registration failed. Please try again.');
    res.redirect('/register');
  }
});

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
      req.flash('error', 'Error during logout. Please try again.');
      return res.redirect('/');
    }
    res.redirect('/');
  });

});
app.get('/order-history', ensureAuthenticated, async (req, res) => {
  console.log('Order history route accessed'); // Debugging
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.render('order-history', { orders, user: req.user, messages: req.flash() });
    console.log('User ID:', req.user._id);
    console.log('Orders fetched:', Order); 
    console.log('Query Result:', await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }));
  } catch (error) {
    console.error('Error fetching order history:', error);
    req.flash('error', 'Error fetching order history. Please try again.');
    res.redirect('/profile');
  }
});

// Route to update the quantity of an item in the cart
app.post('/cart/update/:index', ensureAuthenticated, async (req, res) => {
  const index = parseInt(req.params.index); // Get the index of the item to update
  const quantity = parseInt(req.body.quantity); // Get the new quantity
  

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

    // Update the quantity and total price
    const item = cart.items[index];
    cart.totalPrice -= item.price * item.quantity; // Subtract old total
    item.quantity = quantity;
    cart.totalPrice += item.price * quantity; // Add new total

    // Save the updated cart
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
app.post('/cart/delete/:index', ensureAuthenticated, async (req, res) => {
  const index = parseInt(req.params.index); // Get the index of the item to delete

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

    // Save the updated cart
    await cart.save();

    req.flash('success', 'Item removed from cart.');
    res.redirect('/cart');
  } catch (error) {
    console.error('Error deleting item from cart:', error);
    req.flash('error', 'Failed to delete item from cart.');
    res.redirect('/cart');
  }
});
app.post('/cart/update-material/:index', ensureAuthenticated, async (req, res) => {
  const index = parseInt(req.params.index); // Get the index of the item to update
  const material = req.body.material; // Get the selected material

  if (isNaN(index) || index < 0 || !material) {
    req.flash('error', 'Invalid input.');
    return res.redirect('/cart');
  }

  try {
    const cart = await Cart.findOne({ userId: req.user._id });
    if (!cart || !cart.items || index >= cart.items.length) {
      req.flash('error', 'Item not found in cart.');
      return res.redirect('/cart');
    }

    // Update the material for the item
    cart.items[index].material = material;

    // Save the updated cart
    await cart.save();

    req.flash('success', 'Material updated successfully.');
    res.redirect('/cart');
  } catch (error) {
    console.error('Error updating material:', error);
    req.flash('error', 'Failed to update material.');
    res.redirect('/cart');
  }
});
// Reorder functionality
app.post('/reorder/:orderId', ensureAuthenticated, async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    
    if (!order || order.userId.toString() !== req.user._id.toString()) {
      req.flash('error', 'Order not found or unauthorized');
      return res.redirect('/order-history');
    }

    let cart = await Cart.findOne({ userId: req.user._id });
    if (!cart) {
      cart = new Cart({ userId: req.user._id, items: [], totalPrice: 0 });
    }

    // Add all items from the order to the cart
    order.items.forEach(item => {
      cart.items.push({
        filename: item.filename,
        volume: item.volume,
        price: item.price,
        material: item.material,
        quantity: item.quantity
      });
      cart.totalPrice += item.price * item.quantity;
    });

    await cart.save();
    req.flash('success', 'Items from order have been added to your cart');
    res.redirect('/cart');
  } catch (error) {
    console.error('Error during reorder:', error);
    req.flash('error', 'Failed to reorder items');
    res.redirect('/order-history');
  }
});
app.use(express.static('public')); // Must be before routes
// Edit Profile Routes
app.get('/profile/edit', ensureAuthenticated, (req, res) => {
  res.render('edit-profile', { 
    user: req.user, 
    currentUrl: '/profile/edit', // Add this line
    messages: req.flash() 
  });
});

app.post('/profile/edit', ensureAuthenticated, async (req, res) => {
  const { name, email, address, phone } = req.body;
  
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/profile');
    }

    // Update user fields
    user.name = name;
    user.email = email;
    user.address = address;
    user.phone = phone;

    await user.save();
    
    req.flash('success', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    req.flash('error', 'Failed to update profile');
    res.redirect('/profile/edit');
  }
});
app.use(express.static('public'));

// Then later in your routes:
app.post('/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  // Validation
  if (!name || !email || !message) {
    req.flash('error', 'Name, email and message are required');
    return res.redirect('/contact');
  }

  try {
    // Email to admin
    await transporter.sendMail({
      from: `"${name}" <${email}>`,
      to: process.env.ADMIN_EMAIL,
      subject: subject || `New message from ${name}`,
      text: message,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        ${subject ? `<p><strong>Subject:</strong> ${subject}</p>` : ''}
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    });

    // Confirmation to user
    await transporter.sendMail({
      from: `"IMPR3SSIO Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'We received your message!',
      html: `
        <h2>Thank you for contacting us, ${name}!</h2>
        <p>We've received your message and will respond soon.</p>
        <p><strong>Your message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    });

    req.flash('success', 'Message sent successfully!');
    res.redirect('/contact');
  } catch (error) {
    console.error('Email error:', error);
    req.flash('error', 'Failed to send message. Please try again.');
    res.redirect('/contact');
  }
});
// Add this with your other routes in app.js
app.get('/contact', (req, res) => {
  res.render('contact', {
    user: req.user,
    messages: req.flash(),
    currentUrl: '/contact'
  });
});
// Start the server
const serverless = require('serverless-http');
module.exports = serverless(app);