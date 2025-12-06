const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Function to generate unique 6-character numeric ID
const generateUserId = () => {
  const chars = '0123456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
};

const userSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    required: false,
    uppercase: true,
    minlength: 6,
    maxlength: 6,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'host', 'admin', 'coinSeller'],
    default: 'user'
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    trim: true
  },
  dob: {
    type: Date,
    required: [true, 'Date of birth is required']
  },
  gender: {
    type: String,
    required: [true, 'Gender is required'],
    enum: ['male', 'female', 'other'],
    lowercase: true
  },
  coinBalance: {
    type: Number,
    default: 0,
    min: [0, 'Coin balance cannot be negative']
  },
  avatar: {
    type: String,
    default: null
  },
  isCoinSeller: {
    type: Boolean,
    default: false
  },
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters'],
    default: ''
  },
  isAgent: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  refreshToken: {
    type: String,
    select: false
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true
});

// Generate unique userId before saving
userSchema.pre('save', async function(next) {
  // Generate userId if it's a new document
  if (this.isNew && !this.userId) {
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      this.userId = generateUserId();
      
      // Check if this userId already exists
      const existingUser = await mongoose.model('User').findOne({ userId: this.userId });
      
      if (!existingUser) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return next(new Error('Unable to generate unique user ID. Please try again.'));
    }
  }

  // Hash password if modified
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to exclude sensitive fields
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.refreshToken;
  delete user.__v;
  return user;
};

// Static method to find user by userId or email
userSchema.statics.findByCredential = async function(credential) {
  const isEmail = /^\S+@\S+\.\S+$/.test(credential);
  
  if (isEmail) {
    return await this.findOne({ email: credential.toLowerCase() }).select('+password');
  } else {
    // Assume it's a userId
    return await this.findOne({ userId: credential.toUpperCase() }).select('+password');
  }
};

module.exports = mongoose.model('User', userSchema);