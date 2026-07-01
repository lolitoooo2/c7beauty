const Client = require('../models/Client')

async function ensureStripeCustomer ({ stripe, client }) {
  if (client.stripeCustomerId) return client.stripeCustomerId

  const customer = await stripe.customers.create({
    email    : client.email,
    name     : `${client.firstName} ${client.lastName}`.trim(),
    metadata : { clientId: String(client._id) }
  })

  client.stripeCustomerId = customer.id
  await client.save()
  return customer.id
}

async function syncClientStripeCustomerId (clientId, customerId) {
  if (!customerId) return
  const id = typeof customerId === 'string' ? customerId : customerId?.id
  if (!id) return
  await Client.findByIdAndUpdate(clientId, { stripeCustomerId: id })
}

async function resolveOffSessionPaymentMethod ({ stripe, client, depositPaymentIntentId }) {
  if (!depositPaymentIntentId) return { customerId: client.stripeCustomerId, paymentMethodId: null }

  const pi = await stripe.paymentIntents.retrieve(depositPaymentIntentId)

  const customerId = typeof pi.customer === 'string'
    ? pi.customer
    : pi.customer?.id || client.stripeCustomerId

  if (customerId && !client.stripeCustomerId) {
    client.stripeCustomerId = customerId
    await client.save()
  }

  const paymentMethodId = typeof pi.payment_method === 'string'
    ? pi.payment_method
    : pi.payment_method?.id || null

  return { customerId, paymentMethodId }
}

module.exports = {
  ensureStripeCustomer,
  syncClientStripeCustomerId,
  resolveOffSessionPaymentMethod
}
