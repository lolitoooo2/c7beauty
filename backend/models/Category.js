const mongoose = require('mongoose')

const subcategorySchema = new mongoose.Schema({
  name   : { type: String, required: true, trim: true },
  slug   : { type: String, required: true, trim: true, lowercase: true },
  active : { type: Boolean, default: true }
}, { _id: true })

const categorySchema = new mongoose.Schema(
  {
    name        : { type: String, required: true, trim: true },
    slug        : { type: String, required: true, unique: true, trim: true, lowercase: true },
    icon        : { type: String, default: 'Sparkles' },  // nom de l'icône Lucide
    description : { type: String, default: '' },
    subcategories: [subcategorySchema],
    active : { type: Boolean, default: true },
    order  : { type: Number, default: 0 }
  },
  {
    timestamps : true,
    collection : 'categories'
  }
)

module.exports = mongoose.model('Category', categorySchema)
