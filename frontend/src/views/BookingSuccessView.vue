<template>
  <div class="success-page">
    <nav class="success-nav">
      <router-link to="/" class="success-logo">
        <img src="@/assets/logo.svg" alt="C7'Beauty" />
      </router-link>
    </nav>

    <div class="success-card">
      <div v-if="loading" class="success-state">
        <Loader2 :size="40" class="spin" />
        <h1>Confirmation en cours…</h1>
        <p>Nous validons votre paiement Stripe.</p>
      </div>

      <div v-else-if="error" class="success-state success-state--error">
        <CircleAlert :size="40" />
        <h1>Problème de confirmation</h1>
        <p>{{ error }}</p>
        <router-link
          v-if="proId && serviceId"
          :to="`/salon/${proId}/reserver/${serviceId}`"
          class="success-btn"
        >
          Retour à la réservation
        </router-link>
        <router-link v-else to="/espace-client" class="success-btn success-btn--ghost">
          Mon espace client
        </router-link>
      </div>

      <div v-else-if="booking" class="success-state success-state--ok">
        <CheckCircle2 :size="48" class="success-icon" />
        <h1>Rendez-vous confirmé !</h1>
        <p class="success-sub">Votre paiement a bien été enregistré. Un email de confirmation vous a été envoyé.</p>

        <div class="success-details">
          <p class="success-details__salon">{{ booking.pro?.salonName }}</p>
          <p class="success-details__service">{{ booking.serviceName }}</p>
          <p class="success-details__when">
            <Calendar :size="16" />
            {{ formatWhen(booking.start) }}
          </p>
          <p class="success-details__price">
            Total : {{ booking.price.toFixed(2) }} €
            <span v-if="loyalty?.halfPriceApplied" class="success-badge">-50 % fidélité</span>
          </p>
          <p v-if="booking.depositAmount != null" class="success-details__paid">
            Acompte réglé : {{ booking.depositAmount.toFixed(2) }} €
          </p>
          <p v-if="booking.remainingAmount != null && booking.remainingAmount > 0" class="success-details__remaining">
            Solde restant : {{ booking.remainingAmount.toFixed(2) }} € (après la prestation)
          </p>
          <p v-if="loyalty?.cashbackEarned" class="success-cashback">
            +{{ loyalty.cashbackEarned.toFixed(2) }} € ajoutés à votre cagnotte
          </p>
        </div>

        <div class="success-actions">
          <router-link to="/espace-client" class="success-btn">
            Voir mes rendez-vous
          </router-link>
          <router-link
            v-if="proId"
            :to="`/salon/${proId}`"
            class="success-btn success-btn--ghost"
          >
            Retour au salon
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Loader2, CheckCircle2, CircleAlert, Calendar } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

interface BookingResult {
  _id: string
  start: string
  serviceName: string
  price: number
  depositAmount?: number | null
  remainingAmount?: number | null
  pro?: { salonName: string }
}

interface LoyaltyResult {
  halfPriceApplied?: boolean
  cashbackEarned?: number
}

const route     = useRoute()
const authStore = useAuthStore()

const proId     = computed(() => String(route.params.id))
const serviceId = computed(() => String(route.params.serviceId))
const sessionId = computed(() => String(route.query.session_id || ''))

const loading = ref(true)
const error   = ref('')
const booking = ref<BookingResult | null>(null)
const loyalty = ref<LoyaltyResult | null>(null)

function formatWhen (iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday : 'long',
    day     : 'numeric',
    month   : 'long',
    hour    : '2-digit',
    minute  : '2-digit'
  })
}

async function pollStatus (attempt = 0) {
  if (!sessionId.value) {
    error.value = 'Session de paiement introuvable.'
    loading.value = false
    return
  }

  if (!authStore.isClient) {
    error.value = 'Connectez-vous pour voir votre confirmation.'
    loading.value = false
    return
  }

  try {
    const res = await fetch(
      `/api/bookings/checkout/status?session_id=${encodeURIComponent(sessionId.value)}`,
      { headers: { Authorization: `Bearer ${authStore.token}` } }
    )
    const data = await res.json()

    if (data.status === 'succeeded' && data.booking) {
      booking.value = data.booking
      loyalty.value = data.loyalty || null
      loading.value = false
      sessionStorage.removeItem('c7_booking_hold')
      await authStore.fetchMe()
      return
    }

    if (data.status === 'expired' || data.status === 'failed') {
      error.value = 'Le paiement a expiré ou a échoué. Vous pouvez réessayer.'
      loading.value = false
      return
    }

    if (attempt >= 20) {
      error.value = 'La confirmation prend plus de temps que prévu. Consultez vos rendez-vous dans quelques instants.'
      loading.value = false
      return
    }

    setTimeout(() => pollStatus(attempt + 1), 1500)
  } catch {
    error.value = 'Impossible de vérifier le paiement.'
    loading.value = false
  }
}

onMounted(() => pollStatus())
</script>

<style scoped>
.success-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #faf7f8 0%, #f3ecef 100%);
  padding: 1.5rem;
}

.success-nav {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}

.success-logo img { height: 36px; }

.success-card {
  max-width: 480px;
  margin: 0 auto;
  background: #fff;
  border-radius: 20px;
  box-shadow: 0 8px 40px rgba(58, 40, 48, 0.08);
  padding: 2.5rem 2rem;
}

.success-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.75rem;
  color: #3a2830;
}

.success-state h1 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0.5rem 0 0;
}

.success-state p { color: #6b5a62; margin: 0; }

.success-state--ok .success-icon { color: #2d8a5e; }

.success-state--error { color: #b42318; }
.success-state--error p { color: #6b5a62; }

.success-sub { font-size: 0.95rem; }

.success-details {
  width: 100%;
  margin: 1.25rem 0;
  padding: 1.25rem;
  background: #faf7f8;
  border-radius: 12px;
  text-align: left;
}

.success-details__salon {
  font-weight: 700;
  font-size: 1.05rem;
  margin: 0 0 0.25rem;
}

.success-details__service { margin: 0 0 0.75rem; color: #6b5a62; }

.success-details__when,
.success-details__price,
.success-details__paid,
.success-details__remaining {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0.35rem 0;
  font-size: 0.95rem;
}

.success-details__paid {
  color: #2d8a5e;
  font-weight: 600;
}

.success-details__remaining {
  color: #6b5a62;
  font-size: 0.88rem;
}

.success-badge {
  font-size: 0.75rem;
  background: #e8d5f0;
  color: #5c3d6e;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  margin-left: 0.35rem;
}

.success-cashback {
  margin: 0.5rem 0 0;
  color: #2d8a5e;
  font-size: 0.9rem;
  font-weight: 600;
}

.success-actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.5rem;
}

.success-btn {
  display: block;
  width: 100%;
  padding: 0.85rem 1rem;
  border-radius: 10px;
  background: #3a2830;
  color: #fff;
  text-align: center;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
}

.success-btn--ghost {
  background: transparent;
  color: #3a2830;
  border: 1.5px solid #ddd;
}

.spin { animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
