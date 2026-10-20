const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { normalizePhone } = require('../utils/validatePhone');

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, 'First name is required'],
      trim: true,
    },
    lastName: {
      type: String,
      required: [true, 'Last name is required'],
      trim: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      set: value => typeof value === 'string' && !value.trim() ? undefined : value,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: ['admin', 'employee', 'user', 'resident'],
      default: 'user',
    },
    isActive: { type: Boolean, default: true },
    // Additive demo provisioning ownership; never accepted by account APIs.
    demoProvisioningKey: { type: String, select: false, immutable: true },
    phone: {
      type: String,
      default: '',
    },
    phoneNormalized: { type: String, select: false },
    address: {
      type: String,
      default: '',
    },
    resetPasswordToken: {
      type: String,
      default: null,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 }, { name: 'email_optional_unique', unique: true, partialFilterExpression: { email: { $type: 'string' } } });
userSchema.index({ phoneNormalized: 1 }, { name: 'phone_normalized_unique', unique: true, partialFilterExpression: { phoneNormalized: { $type: 'string' } } });
userSchema.pre('validate', function () {
  if (this.isNew || this.isModified('phone')) this.phoneNormalized = normalizePhone(this.phone) || undefined;
});

// Pre-save hook to hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
