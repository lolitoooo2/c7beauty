const mongoose = require('mongoose')

const DEFAULT_DEPOSIT_PERCENT = 20

const platformSettingsSchema = new mongoose.Schema(
  {
    key : {
      type    : String,
      default : 'global',
      unique  : true
    },
    depositPercent : {
      type    : Number,
      default : DEFAULT_DEPOSIT_PERCENT,
      min     : 0,
      max     : 100
    }
  },
  {
    timestamps : true,
    collection : 'platform_settings'
  }
)

module.exports = mongoose.model('PlatformSettings', platformSettingsSchema)
module.exports.DEFAULT_DEPOSIT_PERCENT = DEFAULT_DEPOSIT_PERCENT
