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

        <!-- Collaborateurs — ligne horizontale Planity -->
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

        <div class="bk-layout">
          <!-- Calendrier -->
          <div class="bk-layout__calendar">
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

          <!-- Récap — colonne droite sticky sur desktop, au-dessus sur mobile -->
          <aside
            ref="summaryEl"
            class="bk-summary"
            :class="{ 'bk-summary--active': selectedSlot || confirmed, 'bk-summary--done': confirmed }"
          >
            <template v-if="confirmed">
              <p class="bk-summary__label">Confirmé</p>
              <CheckCircle :size="28" class="bk-summary__icon-ok" />
              <p class="bk-summary__title">Rendez-vous confirmé !</p>
              <p class="bk-summary__detail">{{ selectedSlotLabel || 'Votre créneau est enregistré.' }}</p>
              <router-link to="/espace-client" class="bk-confirm-btn bk-confirm-btn--link">
                Voir mes réservations →
              </router-link>
            </template>

            <template v-else-if="selectedSlot">
              <p class="bk-summary__label">Votre créneau</p>
              <p class="bk-summary__title">{{ selectedSlotLabel }}</p>
              <p v-if="assignedCollabName" class="bk-summary__detail">
                avec <strong>{{ assignedCollabName }}</strong>
              </p>
              <p v-else-if="selectedCollabId === ANY_COLLAB" class="bk-summary__detail">
                Premier collaborateur disponible
              </p>
              <div class="bk-summary__price">
                {{ service.name }} · {{ service.price.toFixed(2) }} €
              </div>
              <button
                type="button"
                class="bk-confirm-btn"
                :disabled="confirming"
                @click="confirmBooking"
              >
                <Loader2 v-if="confirming" :size="16" class="spin" />
                {{ authStore.isClient ? 'Confirmer le rendez-vous' : 'Se connecter pour confirmer' }}
              </button>
              <p v-if="confirmError" class="bk-confirm-error">{{ confirmError }}</p>
            </template>

            <template v-else>
              <p class="bk-summary__label">Récapitulatif</p>
              <p class="bk-summary__placeholder">
                Sélectionnez un créneau dans le calendrier pour confirmer votre rendez-vous.
              </p>
            </template>
          </aside>
        </div>
      </div>
    </section>

    <!-- Barre fixe mobile quand créneau sélectionné -->
    <Teleport to="body">
      <div
        v-if="selectedSlot && !confirmed"
        class="bk-mobile-bar"
      >
        <div class="bk-mobile-bar__info">
          <span class="bk-mobile-bar__time">{{ selectedSlotLabel }}</span>
          <span v-if="assignedCollabName" class="bk-mobile-bar__who">{{ assignedCollabName }}</span>
        </div>
        <button
          type="button"
          class="bk-mobile-bar__btn"
          :disabled="confirming"
          @click="confirmBooking"
        >
          <Loader2 v-if="confirming" :size="15" class="spin" />
          {{ authStore.isClient ? 'Confirmer' : 'Connexion' }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Clock, CheckCircle } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'
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

const toast     = useToast()
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
const confirming       = ref(false)
const confirmError     = ref('')
const confirmed        = ref(false)
const summaryEl        = ref<HTMLElement | null>(null)

const HOLD_STORAGE_KEY = 'c7_booking_hold'

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

function shiftWeek (delta: number) {
  const d = new Date(weekStart.value + 'T12:00:00')
  d.setDate(d.getDate() + delta)
  weekStart.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  fetchWeek()
}

async function fetchWeek () {
  loading.value = true
  error.value   = ''
  selectedSlot.value = null
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

function pickSlot (date: string, slot: DaySlot) {
  if (!slot.available) return
  const collaboratorIds = slot.collaboratorIds?.length
    ? slot.collaboratorIds
    : selectedCollabId.value
      ? [selectedCollabId.value]
      : []
  selectedSlot.value = { date, time: slot.time, collaboratorIds }
  holdId.value = null
  assignedCollabId.value = null
  confirmError.value = ''
  confirmed.value = false
  requestAnimationFrame(() => {
    summaryEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

async function createHold () {
  if (!selectedSlot.value) return null

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (authStore.token) headers.Authorization = `Bearer ${authStore.token}`

  const body: Record<string, unknown> = {
    proId     : props.proId,
    serviceId : props.service._id,
    date      : selectedSlot.value.date,
    startTime : selectedSlot.value.time,
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

async function confirmBooking () {
  if (!selectedSlot.value) return
  confirmError.value = ''
  confirming.value = true

  try {
    let currentHoldId = holdId.value
    if (!currentHoldId) {
      currentHoldId = await createHold()
    }

    if (!authStore.isClient) {
      const returnUrl = router.currentRoute.value.fullPath
      router.push({ path: '/login/client', query: { redirect: returnUrl } })
      return
    }

    const res = await fetch('/api/bookings/confirm', {
      method  : 'POST',
      headers : {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ holdId: currentHoldId })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Confirmation impossible.')

    sessionStorage.removeItem(HOLD_STORAGE_KEY)
    confirmed.value = true
    toast.success('Rendez-vous confirmé !')
    fetchWeek()
  } catch (err: unknown) {
    confirmError.value = err instanceof Error ? err.message : 'Erreur'
    holdId.value = null
    sessionStorage.removeItem(HOLD_STORAGE_KEY)
  } finally {
    confirming.value = false
  }
}

async function resumePendingHold () {
  const stored = sessionStorage.getItem(HOLD_STORAGE_KEY)
  if (!stored || !authStore.isClient) return
  holdId.value = stored
  confirming.value = true
  try {
    const res = await fetch('/api/bookings/confirm', {
      method  : 'POST',
      headers : {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ holdId: stored })
    })
    const data = await res.json()
    if (res.ok) {
      sessionStorage.removeItem(HOLD_STORAGE_KEY)
      confirmed.value = true
      toast.success('Rendez-vous confirmé !')
    } else if (res.status === 410 || res.status === 409) {
      sessionStorage.removeItem(HOLD_STORAGE_KEY)
      holdId.value = null
    }
  } finally {
    confirming.value = false
  }
}

watch(selectedCollabId, () => fetchWeek())

onMounted(() => {
  selectedCollabId.value = ANY_COLLAB
  fetchWeek()
  if (sessionStorage.getItem(HOLD_STORAGE_KEY) && authStore.isClient) {
    resumePendingHold()
  }
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

/* Carte prestation — style svc-group */
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
  transition: color 0.18s;
}
.bk-remove:hover { color: #4F3942; }

.bk-collabs {
  padding: 1.25rem 1.5rem 1.5rem;
}

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
  scrollbar-width: thin;
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
  transition: border-color 0.18s, background 0.18s, box-shadow 0.18s;
  position: relative;
  background: #fff;
}

.bk-collab:hover {
  border-color: #D1A1C7;
  background: #FDFBFA;
}

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

.bk-collab__avatar--any {
  background: #F0EBE8;
  color: #888;
}

.bk-collab__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.bk-collab__name {
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #2C1810;
  line-height: 1.25;
}

/* Bloc date & heure */
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
  transition: background 0.18s, border-color 0.18s;
}
.bk-nav-btn:hover {
  background: #EADAF3;
  border-color: #D1A1C7;
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
  transition: background 0.18s, border-color 0.18s;
}
.bk-date-btn:hover {
  background: #FDFBFA;
  border-color: #D1A1C7;
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

/* Layout calendrier + récap */
.bk-layout {
  display: grid;
  grid-template-columns: 1fr 280px;
  gap: 1.25rem;
  align-items: start;
}

.bk-layout__calendar {
  min-width: 0;
}

.bk-summary {
  position: sticky;
  top: 5.5rem;
  background: #FDFBFA;
  border: 1px solid #E4E0DC;
  border-radius: 14px;
  padding: 1.25rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.bk-summary--active {
  border-color: #D1A1C7;
  box-shadow: 0 4px 20px rgba(79, 57, 66, 0.08);
}

.bk-summary--done {
  border-color: #4F3942;
  background: #fff;
  text-align: center;
}

.bk-summary__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #D1A1C7;
  margin: 0 0 0.5rem;
}

.bk-summary__title {
  font-family: "Montserrat", sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0 0 0.4rem;
  line-height: 1.35;
}

.bk-summary__detail {
  font-size: 0.85rem;
  color: #666;
  margin: 0 0 0.75rem;
  line-height: 1.4;
}

.bk-summary__price {
  font-size: 0.82rem;
  color: #888;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #F0EBE8;
}

.bk-summary__placeholder {
  font-size: 0.85rem;
  color: #aaa;
  line-height: 1.5;
  margin: 0;
}

.bk-summary__icon-ok {
  color: #4F3942;
  margin: 0.25rem auto 0.75rem;
  display: block;
}

.bk-confirm-btn--link {
  display: flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  margin-top: 0.5rem;
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

.bk-slot:hover {
  background: #EADAF3;
  border-color: #D1A1C7;
  color: #4F3942;
}

.bk-slot.selected {
  background: #4F3942;
  border-color: #4F3942;
  color: #fff;
}

.bk-slot--disabled {
  display: block;
  padding: 0.45rem 0.2rem;
  border: 1px solid #F0EBE8;
  border-radius: 8px;
  background: #fff;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: #ccc;
  text-align: center;
  cursor: not-allowed;
  user-select: none;
}

.bk-slot--blocked {
  display: block;
  padding: 0.45rem 0.2rem;
  border: 1px dashed #E4E0DC;
  border-radius: 8px;
  background: #FAFAFA;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: #bbb;
  text-align: center;
  cursor: not-allowed;
  user-select: none;
}

.bk-slot--gap {
  display: block;
  padding: 0.45rem 0.2rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  visibility: hidden;
  pointer-events: none;
}

.bk-no-slots {
  font-size: 0.85rem;
  color: #ccc;
  margin: 0.5rem 0;
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
.bk-confirm-btn:disabled { opacity: 0.65; cursor: not-allowed; }

.bk-confirm-error {
  margin: 0.75rem 0 0;
  font-size: 0.82rem;
  color: #c0565b;
  text-align: center;
}

/* Barre fixe mobile */
.bk-mobile-bar {
  display: none;
}

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .bk-layout {
    grid-template-columns: 1fr;
  }

  .bk-summary {
    position: static;
    order: -1;
  }

  .bk-mobile-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 200;
    padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
    background: #fff;
    border-top: 1px solid #E4E0DC;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  }

  .bk-mobile-bar__info {
    flex: 1;
    min-width: 0;
  }

  .bk-mobile-bar__time {
    display: block;
    font-family: "Montserrat", sans-serif;
    font-size: 0.78rem;
    font-weight: 700;
    color: #2C1810;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bk-mobile-bar__who {
    display: block;
    font-size: 0.72rem;
    color: #888;
  }

  .bk-mobile-bar__btn {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.65rem 1.1rem;
    background: #4F3942;
    color: #fff;
    border: none;
    border-radius: 10px;
    font-family: "Montserrat", sans-serif;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
  }

  .booking-panel {
    padding-bottom: 5rem;
  }
}

@media (max-width: 640px) {
  .bk-grid { grid-template-columns: repeat(4, minmax(68px, 1fr)); }
  .bk-card__head, .bk-collabs, .bk-datetime { padding-left: 1rem; padding-right: 1rem; }
}
</style>
