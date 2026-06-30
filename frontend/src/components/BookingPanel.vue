<template>
  <div class="booking-panel">
    <!-- Prestation sélectionnée -->
    <section class="bk-block">
      <div class="bk-card">
        <div class="bk-card__head">
          <div>
            <p class="bk-card__label">Prestation sélectionnée</p>
            <h2 class="bk-card__title">{{ service.name }}</h2>
            <p class="bk-card__meta">
              <Clock :size="13" /> {{ formatDuration(service.duration) }} · {{ service.price.toFixed(2) }} €
            </p>
          </div>
          <button type="button" class="bk-remove" @click="$emit('close')">Supprimer</button>
        </div>

        <div class="bk-collabs">
          <p class="bk-collabs__label">Choisir avec qui ?</p>
          <div class="bk-collabs__row">
            <label
              class="bk-collab"
              :class="{ active: selectedCollabId === ANY_COLLAB }"
            >
              <div class="bk-collab__avatar bk-collab__avatar--any">?</div>
              <span class="bk-collab__name">Sans préférence</span>
              <input type="radio" name="collab" :value="ANY_COLLAB" v-model="selectedCollabId" />
            </label>

            <label
              v-for="c in eligibleCollaborators"
              :key="c._id"
              class="bk-collab"
              :class="{ active: selectedCollabId === c._id }"
            >
              <div class="bk-collab__avatar">
                <img v-if="c.photo" :src="`/api/media/avatars/collaborators/${c.photo}`" :alt="c.firstName" />
                <span v-else>{{ initials(c) }}</span>
              </div>
              <span class="bk-collab__name">{{ c.firstName }}</span>
              <input type="radio" name="collab" :value="c._id" v-model="selectedCollabId" />
            </label>
          </div>
        </div>
      </div>
    </section>

    <!-- Date & heure -->
    <section class="bk-block">
      <div class="bk-datetime">
        <div class="bk-datetime__head">
          <h2 class="bk-datetime__title">Choix de la date &amp; heure</h2>
          <div class="bk-datetime__actions">
            <button type="button" class="bk-nav-btn" @click="shiftWeek(-7)" aria-label="Semaine précédente">
              <ChevronLeft :size="18" />
            </button>
            <button type="button" class="bk-nav-btn" @click="shiftWeek(7)" aria-label="Semaine suivante">
              <ChevronRight :size="18" />
            </button>
            <label class="bk-date-btn">
              <CalendarDays :size="15" />
              Choisir une date
              <input type="date" v-model="weekStart" class="bk-date-input" @change="fetchWeek" />
            </label>
          </div>
        </div>

        <div v-if="loading" class="bk-loading">
          <Loader2 :size="22" class="spin" /> Chargement des disponibilités…
        </div>

        <div v-else-if="error" class="bk-empty">{{ error }}</div>

        <div v-else class="bk-grid-wrap">
          <div class="bk-grid">
            <div v-for="day in displayDays" :key="day.date" class="bk-day-col">
              <p class="bk-day-label">{{ shortDayLabel(day) }}</p>
              <div class="bk-slots">
                <template
                  v-for="slot in slotsForDay(day)"
                  :key="`${day.date}-${slot.time}`"
                >
                  <span
                    v-if="!slot.inSchedule"
                    class="bk-slot bk-slot--gap"
                    aria-hidden="true"
                  >&nbsp;</span>
                  <button
                    v-else-if="slot.available"
                    type="button"
                    class="bk-slot"
                    :class="{ selected: selectedSlot?.date === day.date && selectedSlot?.time === slot.time }"
                    @click="pickSlot(day.date, slot)"
                  >
                    {{ slot.time }}
                  </button>
                  <span
                    v-else-if="slot.occupied"
                    class="bk-slot bk-slot--disabled"
                    title="Créneau réservé"
                  >
                    {{ slot.time }}
                  </span>
                  <span
                    v-else
                    class="bk-slot bk-slot--blocked"
                    title="Créneau indisponible"
                  >
                    {{ slot.time }}
                  </span>
                </template>
                <p v-if="!slotsForDay(day).some(s => s.inSchedule)" class="bk-no-slots">—</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Paiement — affiché dès qu'un créneau est choisi -->
    <section
      v-if="selectedSlot && !confirmed"
      ref="paymentSectionEl"
      class="bk-block bk-payment"
    >
      <div class="bk-payment__card">
        <header class="bk-payment__head">
          <div>
            <p class="bk-payment__step">Étape 3 · Paiement</p>
            <h2 class="bk-payment__title">Finaliser votre rendez-vous</h2>
            <p class="bk-payment__sub">Vous restez sur C7'Beauty · paiement sécurisé par Stripe</p>
          </div>
          <button type="button" class="bk-payment__back" @click="clearSlot">
            Changer de créneau
          </button>
        </header>

        <div class="bk-payment__recap">
          <p class="bk-payment__recap-label">Votre créneau</p>
          <p class="bk-payment__recap-when">{{ selectedSlotLabel }}</p>
          <p v-if="assignedCollabName" class="bk-payment__recap-who">
            avec <strong>{{ assignedCollabName }}</strong>
          </p>
          <p v-else-if="selectedCollabId === ANY_COLLAB" class="bk-payment__recap-who">
            Premier collaborateur disponible
          </p>
          <div class="bk-payment__recap-price">
            <template v-if="loyaltyPreview?.halfPriceEligible">
              <span class="bk-payment__price-old">{{ service.price.toFixed(2) }} €</span>
              <span class="bk-payment__price-new">{{ displayPrice.toFixed(2) }} €</span>
              <span class="bk-payment__badge">-50 % fidélité</span>
            </template>
            <template v-else>
              <span class="bk-payment__price-new">{{ service.name }} · {{ displayPrice.toFixed(2) }} €</span>
            </template>
          </div>
          <p v-if="depositPercent < 100" class="bk-payment__deposit">
            Acompte {{ depositPercent }} % : <strong>{{ depositAmount.toFixed(2) }} €</strong>
            <span class="bk-payment__deposit-total">(sur {{ displayPrice.toFixed(2) }} €)</span>
          </p>
          <p v-if="loyaltyPreview?.cashbackEarn" class="bk-payment__cashback">
            +{{ loyaltyPreview.cashbackEarn.toFixed(2) }} € cashback après paiement
          </p>
        </div>

        <div v-if="!authStore.isClient" class="bk-payment__login">
          <p>Connectez-vous pour régler votre rendez-vous.</p>
          <button type="button" class="bk-confirm-btn" @click="goLogin">
            Se connecter pour payer
          </button>
        </div>

        <template v-else>
          <div v-if="paymentLoading" class="bk-payment__loading">
            <Loader2 :size="28" class="spin" />
            <p>Préparation du paiement sécurisé…</p>
          </div>

          <div ref="stripeMountEl" class="bk-payment__stripe" />

          <p v-if="paymentError" class="bk-payment__error">{{ paymentError }}</p>
          <p v-if="paymentError" class="bk-payment__retry">
            <button type="button" class="bk-payment__retry-btn" @click="startCheckout">
              Réessayer le paiement
            </button>
          </p>
        </template>

        <p class="bk-payment__trust">
          🔒 Paiement chiffré — nous ne stockons jamais vos coordonnées bancaires.
        </p>
      </div>
    </section>

    <!-- Confirmation -->
    <section v-if="confirmed" class="bk-block bk-done">
      <CheckCircle :size="32" class="bk-done__icon" />
      <h2 class="bk-done__title">Rendez-vous confirmé !</h2>
      <p class="bk-done__detail">{{ selectedSlotLabel }}</p>
      <router-link to="/espace-client" class="bk-confirm-btn bk-confirm-btn--link">
        Voir mes réservations →
      </router-link>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { loadStripe, type StripeEmbeddedCheckout } from '@stripe/stripe-js'
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Clock, CheckCircle } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

interface Service {
  _id: string
  name: string
  duration: number
  price: number
}

interface Collaborator {
  _id: string
  firstName: string
  lastName: string
  photo?: string | null
  isOwner?: boolean
  serviceIds?: string[]
}

interface DaySlot {
  time: string
  available: boolean
  inSchedule: boolean
  occupied?: boolean
  collaboratorIds?: string[]
}

interface DayData {
  date: string
  label: string
  slots: DaySlot[]
  byCollaborator: Record<string, DaySlot[]>
}

const props = defineProps<{
  proId: string
  service: Service
  collaborators: Collaborator[]
}>()

defineEmits<{ close: [] }>()

const authStore = useAuthStore()
const router    = useRouter()
const ANY_COLLAB = ''

const selectedCollabId = ref('')
const weekStart        = ref(todayStr())
const loading          = ref(false)
const error            = ref('')
const days             = ref<DayData[]>([])
const selectedSlot     = ref<{ date: string; time: string; collaboratorIds: string[] } | null>(null)
const holdId           = ref<string | null>(null)
const assignedCollabId = ref<string | null>(null)
const confirmed        = ref(false)
const paymentSectionEl = ref<HTMLElement | null>(null)
const paymentLoading   = ref(false)
const paymentError     = ref('')
const stripeMountEl    = ref<HTMLElement | null>(null)
let embeddedCheckout: StripeEmbeddedCheckout | null = null
let checkoutAbort = false

interface LoyaltyPreview {
  prestationCount: number
  fullPriceTarget: number
  halfPriceEligible: boolean
  halfPriceUsedThisMonth: boolean
  originalPrice: number
  finalPrice: number
  halfPriceApplied: boolean
  discountPercent: number
  cashbackEarn: number
  cashbackMinEur: number
}

const loyaltyPreview = ref<LoyaltyPreview | null>(null)
const depositPercent = ref(20)
const HOLD_STORAGE_KEY = 'c7_booking_hold'

const displayPrice = computed(() =>
  loyaltyPreview.value?.finalPrice ?? props.service.price
)

const depositAmount = computed(() =>
  Math.round(displayPrice.value * depositPercent.value / 100 * 100) / 100
)

const eligibleCollaborators = computed(() =>
  props.collaborators.filter(c =>
    !c.serviceIds?.length || c.serviceIds.some(id => String(id) === String(props.service._id))
  )
)

const displayDays = computed(() => days.value.slice(0, 7))

const selectedSlotLabel = computed(() => {
  if (!selectedSlot.value) return ''
  const day = days.value.find(d => d.date === selectedSlot.value!.date)
  return `${day?.label || selectedSlot.value.date} à ${selectedSlot.value.time}`
})

const assignedCollabName = computed(() => {
  const id = assignedCollabId.value || selectedCollabId.value
  if (!id) return null
  const c = eligibleCollaborators.value.find(x => x._id === id)
  return c ? `${c.firstName} ${c.lastName}` : null
})

function todayStr () {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function initials (c: Collaborator) {
  return `${c.firstName[0] || ''}${c.lastName[0] || ''}`.toUpperCase()
}

function formatDuration (min: number) {
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function shortDayLabel (day: DayData) {
  const parts = day.label.split(' ')
  if (parts.length >= 3) return `${parts[0]}\n${parts[1]} ${parts[2]}`
  return day.label
}

function slotsForDay (day: DayData) {
  if (selectedCollabId.value) {
    return day.byCollaborator[selectedCollabId.value] || []
  }
  return day.slots
}

function teardownCheckout () {
  if (embeddedCheckout) {
    embeddedCheckout.destroy()
    embeddedCheckout = null
  }
  if (stripeMountEl.value) stripeMountEl.value.innerHTML = ''
}

function clearSlot () {
  checkoutAbort = true
  teardownCheckout()
  selectedSlot.value = null
  holdId.value = null
  assignedCollabId.value = null
  paymentError.value = ''
  paymentLoading.value = false
  sessionStorage.removeItem(HOLD_STORAGE_KEY)
}

function goLogin () {
  router.push({
    path  : '/login/client',
    query : { redirect: router.currentRoute.value.fullPath }
  })
}

function scrollToPayment () {
  requestAnimationFrame(() => {
    paymentSectionEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

function shiftWeek (delta: number) {
  const d = new Date(weekStart.value + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  weekStart.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  fetchWeek()
}

async function fetchWeek () {
  loading.value = true
  error.value   = ''
  clearSlot()
  try {
    const params = new URLSearchParams({
      proId     : props.proId,
      serviceId : props.service._id,
      from      : weekStart.value,
      days      : '7'
    })
    if (selectedCollabId.value) params.set('collaboratorId', selectedCollabId.value)

    const res  = await fetch(`/api/availability/booking?${params}`)
    const data = await res.json()
    if (!res.ok) {
      error.value = data.message || 'Impossible de charger les disponibilités.'
      days.value  = []
      return
    }
    days.value = data.days || []
    const hasSlots = days.value.some(d =>
      d.slots?.some((s: DaySlot) => s.available)
    )
    if (!hasSlots) error.value = 'Aucun créneau disponible sur cette période.'
  } catch {
    error.value = 'Erreur réseau.'
    days.value  = []
  } finally {
    loading.value = false
  }
}

async function pickSlot (date: string, slot: DaySlot) {
  if (!slot.available) return

  checkoutAbort = true
  teardownCheckout()
  paymentError.value = ''
  paymentLoading.value = false
  confirmed.value = false

  const collaboratorIds = slot.collaboratorIds?.length
    ? slot.collaboratorIds
    : selectedCollabId.value
      ? [selectedCollabId.value]
      : []

  selectedSlot.value = { date, time: slot.time, collaboratorIds }
  holdId.value = null
  assignedCollabId.value = null

  await nextTick()
  scrollToPayment()

  if (authStore.isClient) {
    await startCheckout()
  }
}

async function createHold () {
  if (!selectedSlot.value) return null

  const headers: Record<string, string> = {
    'Content-Type' : 'application/json',
    Authorization  : `Bearer ${authStore.token}`
  }

  const body: Record<string, unknown> = {
    proId           : props.proId,
    serviceId       : props.service._id,
    date            : selectedSlot.value.date,
    startTime       : selectedSlot.value.time,
    collaboratorIds : selectedSlot.value.collaboratorIds
  }
  if (selectedCollabId.value) body.collaboratorId = selectedCollabId.value

  const res  = await fetch('/api/bookings/hold', { method: 'POST', headers, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Créneau indisponible.')

  holdId.value = data.holdId
  assignedCollabId.value = data.collaboratorId
  sessionStorage.setItem(HOLD_STORAGE_KEY, data.holdId)
  return data.holdId as string
}

async function mountEmbeddedCheckout ({
  clientSecret,
  sessionId,
  publishableKey
}: {
  clientSecret: string
  sessionId: string
  publishableKey: string
}) {
  const pk = publishableKey || import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  if (!pk) throw new Error('Clé Stripe publishable manquante.')

  const stripe = await loadStripe(pk)
  if (!stripe) throw new Error('Impossible de charger Stripe.')

  teardownCheckout()

  const checkout = await stripe.initEmbeddedCheckout({
    clientSecret,
    onComplete: () => {
      sessionStorage.removeItem(HOLD_STORAGE_KEY)
      router.push({
        name  : 'salon-booking-success',
        params: { id: props.proId, serviceId: props.service._id },
        query : { session_id: sessionId }
      })
    }
  })

  embeddedCheckout = checkout
  await nextTick()
  if (stripeMountEl.value) checkout.mount(stripeMountEl.value)
}

async function fetchLoyaltyPreview () {
  if (!authStore.isClient || !authStore.token) {
    loyaltyPreview.value = null
    return
  }
  try {
    const res = await fetch(
      `/api/client/loyalty/preview?price=${props.service.price}`,
      { headers: { Authorization: `Bearer ${authStore.token}` } }
    )
    if (res.ok) loyaltyPreview.value = await res.json()
  } catch {
    loyaltyPreview.value = null
  }
}

async function startCheckout () {
  if (!selectedSlot.value || !authStore.isClient) return

  checkoutAbort = false
  paymentError.value = ''
  paymentLoading.value = true

  try {
    let currentHoldId = holdId.value
    if (!currentHoldId) {
      currentHoldId = await createHold()
    }

    const res = await fetch('/api/bookings/checkout', {
      method  : 'POST',
      headers : {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ holdId: currentHoldId })
    })
    const data = await res.json()
    if (res.status === 403 && data.code === 'EMAIL_NOT_VERIFIED') {
      router.push({
        name  : 'verify-email-pending',
        query : { email: data.email || authStore.user?.email || '' }
      })
      return
    }
    if (!res.ok) throw new Error(data.message || 'Paiement impossible.')
    if (!data.clientSecret) throw new Error('Session de paiement introuvable.')
    if (checkoutAbort) return

    paymentLoading.value = false
    await nextTick()
    await mountEmbeddedCheckout({
      clientSecret   : data.clientSecret,
      sessionId      : data.sessionId,
      publishableKey : data.publishableKey
    })
  } catch (err: unknown) {
    if (checkoutAbort) return
    paymentError.value = err instanceof Error ? err.message : 'Erreur de paiement'
    if (paymentError.value.includes('expiré') || paymentError.value.includes('pris')) {
      holdId.value = null
      sessionStorage.removeItem(HOLD_STORAGE_KEY)
    }
  } finally {
    paymentLoading.value = false
  }
}

watch(selectedCollabId, () => fetchWeek())

watch(() => authStore.isClient, async (isClient) => {
  await fetchLoyaltyPreview()
  if (isClient && selectedSlot.value && !embeddedCheckout && !paymentLoading.value) {
    await nextTick()
    await startCheckout()
  }
})

onBeforeUnmount(() => {
  checkoutAbort = true
  teardownCheckout()
})

async function fetchDepositSettings () {
  try {
    const res = await fetch('/api/settings')
    if (res.ok) {
      const data = await res.json()
      if (typeof data.depositPercent === 'number') {
        depositPercent.value = data.depositPercent
      }
    }
  } catch {
    /* valeur par défaut 20 % */
  }
}

onMounted(() => {
  selectedCollabId.value = ANY_COLLAB
  fetchWeek()
  fetchLoyaltyPreview()
  fetchDepositSettings()
})
</script>

<style scoped>
.booking-panel {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  font-family: "Poppins", sans-serif;
}

.bk-block { margin: 0; }

.bk-card {
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 14px;
  overflow: hidden;
}

.bk-card__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: #FDFBFA;
  border-bottom: 1px solid #F0EBE8;
}

.bk-card__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #4F3942;
  margin: 0 0 0.4rem;
}

.bk-card__title {
  font-family: "Montserrat", sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0 0 0.3rem;
  line-height: 1.35;
}

.bk-card__meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: #888;
  margin: 0;
}

.bk-remove {
  background: none;
  border: none;
  color: #888;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  text-decoration: underline;
  flex-shrink: 0;
  padding: 0;
}
.bk-remove:hover { color: #4F3942; }

.bk-collabs { padding: 1.25rem 1.5rem 1.5rem; }

.bk-collabs__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.88rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #EADAF3;
}

.bk-collabs__row {
  display: flex;
  gap: 0.65rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.bk-collab {
  flex: 0 0 auto;
  min-width: 108px;
  max-width: 128px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 0.65rem;
  border: 2px solid #E4E0DC;
  border-radius: 12px;
  cursor: pointer;
  text-align: center;
  position: relative;
  background: #fff;
  transition: border-color 0.18s, box-shadow 0.18s;
}

.bk-collab:hover { border-color: #D1A1C7; background: #FDFBFA; }
.bk-collab.active {
  border-color: #4F3942;
  background: #FDFBFA;
  box-shadow: 0 2px 10px rgba(79, 57, 66, 0.08);
}

.bk-collab input[type="radio"] {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 16px;
  height: 16px;
  accent-color: #4F3942;
}

.bk-collab__avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-weight: 700;
  font-size: 0.9rem;
  background: #EADAF3;
  color: #4F3942;
}

.bk-collab__avatar--any { background: #F0EBE8; color: #888; }
.bk-collab__avatar img { width: 100%; height: 100%; object-fit: cover; }

.bk-collab__name {
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #2C1810;
  line-height: 1.25;
}

.bk-datetime {
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 14px;
  padding: 1.25rem 1.5rem 1.5rem;
}

.bk-datetime__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #EADAF3;
}

.bk-datetime__title {
  font-family: "Montserrat", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0;
}

.bk-datetime__actions {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.bk-nav-btn {
  width: 36px;
  height: 36px;
  border: 1px solid #E4E0DC;
  border-radius: 10px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #4F3942;
}

.bk-date-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.85rem;
  border: 1px solid #E4E0DC;
  border-radius: 10px;
  background: #fff;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4F3942;
  cursor: pointer;
  position: relative;
}

.bk-date-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.bk-loading, .bk-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem;
  color: #aaa;
  font-size: 0.88rem;
}

.bk-grid-wrap {
  overflow-x: auto;
  margin: 0 -0.25rem;
  padding: 0 0.25rem;
}

.bk-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(68px, 1fr));
  gap: 0.5rem;
  min-width: 480px;
}

.bk-day-col { text-align: center; }

.bk-day-label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  color: #4F3942;
  margin: 0 0 0.75rem;
  line-height: 1.35;
  white-space: pre-line;
}

.bk-slots {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.bk-slot {
  padding: 0.45rem 0.2rem;
  border: 1px solid #E4E0DC;
  border-radius: 8px;
  background: #F8F5F2;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: #2C1810;
  cursor: pointer;
  transition: background 0.18s, border-color 0.18s, color 0.18s;
}

.bk-slot:hover { background: #EADAF3; border-color: #D1A1C7; }
.bk-slot.selected { background: #4F3942; border-color: #4F3942; color: #fff; }

.bk-slot--disabled,
.bk-slot--blocked {
  display: block;
  padding: 0.45rem 0.2rem;
  border-radius: 8px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  text-align: center;
  cursor: not-allowed;
  user-select: none;
}

.bk-slot--disabled { border: 1px solid #F0EBE8; background: #fff; color: #ccc; }
.bk-slot--blocked { border: 1px dashed #E4E0DC; background: #FAFAFA; color: #bbb; }

.bk-slot--gap {
  display: block;
  padding: 0.45rem 0.2rem;
  visibility: hidden;
  pointer-events: none;
}

.bk-no-slots { font-size: 0.85rem; color: #ccc; margin: 0.5rem 0; }

/* Section paiement inline */
.bk-payment__card {
  background: #fff;
  border: 2px solid #D1A1C7;
  border-radius: 16px;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(79, 57, 66, 0.1);
  scroll-margin-top: 5rem;
}

.bk-payment__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #F0EBE8;
}

.bk-payment__step {
  font-family: "Montserrat", sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #D1A1C7;
  margin: 0 0 0.25rem;
}

.bk-payment__title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.45rem;
  color: #2C1810;
  margin: 0 0 0.35rem;
}

.bk-payment__sub {
  font-size: 0.82rem;
  color: #888;
  margin: 0;
}

.bk-payment__back {
  flex-shrink: 0;
  background: #F8F5F2;
  border: 1px solid #E4E0DC;
  border-radius: 10px;
  padding: 0.5rem 0.85rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4F3942;
  cursor: pointer;
}

.bk-payment__recap {
  background: #FDFBFA;
  border: 1px solid #F0EBE8;
  border-radius: 12px;
  padding: 1rem 1.15rem;
  margin-bottom: 1.25rem;
}

.bk-payment__recap-label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #D1A1C7;
  margin: 0 0 0.35rem;
}

.bk-payment__recap-when {
  font-family: "Montserrat", sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0 0 0.25rem;
}

.bk-payment__recap-who {
  font-size: 0.85rem;
  color: #666;
  margin: 0 0 0.65rem;
}

.bk-payment__recap-price {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.5rem;
}

.bk-payment__price-old {
  text-decoration: line-through;
  color: #bbb;
  font-size: 0.9rem;
}

.bk-payment__price-new {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 1.05rem;
  color: #4F3942;
}

.bk-payment__badge {
  font-size: 0.68rem;
  font-weight: 600;
  color: #4F3942;
  background: #EADAF3;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
}

.bk-payment__deposit {
  margin: 0.5rem 0 0;
  font-size: 0.88rem;
  color: #4F3942;
}

.bk-payment__deposit-total {
  color: #888;
  font-size: 0.82rem;
}

.bk-payment__cashback {
  margin: 0.5rem 0 0;
  font-size: 0.78rem;
  color: #2e7d32;
}

.bk-payment__login {
  text-align: center;
  padding: 1.5rem 1rem;
  color: #666;
  font-size: 0.9rem;
}

.bk-payment__login p { margin: 0 0 1rem; }

.bk-payment__loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem 1rem;
  color: #888;
  font-size: 0.88rem;
}

.bk-payment__stripe {
  min-height: 420px;
}

.bk-payment__error {
  margin: 0.75rem 0 0;
  font-size: 0.85rem;
  color: #c0565b;
  text-align: center;
}

.bk-payment__retry {
  text-align: center;
  margin: 0.5rem 0 0;
}

.bk-payment__retry-btn {
  background: none;
  border: none;
  color: #4F3942;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  font-family: inherit;
  font-size: 0.85rem;
}

.bk-payment__trust {
  margin: 1rem 0 0;
  font-size: 0.75rem;
  color: #aaa;
  text-align: center;
}

.bk-confirm-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.9rem;
  background: #4F3942;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s;
}
.bk-confirm-btn:hover:not(:disabled) { background: #3a2830; }

.bk-confirm-btn--link {
  display: flex;
  text-decoration: none;
  margin-top: 0.5rem;
}

.bk-done {
  background: #fff;
  border: 1px solid #4F3942;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
}

.bk-done__icon { color: #4F3942; margin-bottom: 0.75rem; }
.bk-done__title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.5rem;
  color: #2C1810;
  margin: 0 0 0.5rem;
}
.bk-done__detail { color: #666; margin: 0 0 1.25rem; font-size: 0.9rem; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .bk-grid { grid-template-columns: repeat(4, minmax(68px, 1fr)); }
  .bk-card__head, .bk-collabs, .bk-datetime, .bk-payment__card {
    padding-left: 1rem;
    padding-right: 1rem;
  }
  .bk-payment__head { flex-direction: column; }
}
</style>
