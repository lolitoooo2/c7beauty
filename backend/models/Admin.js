const mongoose = require('mongoose')
const bcrypt   = require('bcryptjs')

/**
 * Collection : admins
 * Entité totalement distincte des clients et pros.
 */
const adminSchema = new mongoose.Schema(
  {
    firstName : { type: String, required: true, trim: true },
    lastName  : { type: String, required: true, trim: true },
    email     : { type: String, required: true, unique: true, lowercase: true, trim: true },
    password  : { type: String, required: true, minlength: 8, select: false },
    isSuperAdmin : { type: Boolean, default: false }
  },
  {
    timestamps : true,
    collection : 'admins'
  }
)

adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next()
  this.password = await bcrypt.hash(this.password, 12)
  next()
})

adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password)
}

adminSchema.methods.toJSON = function () {
  const obj = this.toObject()
  delete obj.password
  return obj
}

module.exports = mongoose.model('Admin', adminSchema)
