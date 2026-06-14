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

        <div v-if="loading" class="bk-loading">
          <Loader2 :size="22" class="spin" /> Chargement des disponibilités…
        </div>

        <div v-else-if="error" class="bk-empty">{{ error }}</div>

        <div v-else class="bk-grid-wrap">
          <div class="bk-grid">
            <div v-for="day in displayDays" :key="day.date" class="bk-day-col">
              <p class="bk-day-label">{{ shortDayLabel(day) }}</p>
              <div class="bk-slots">
                <button
                  v-for="slot in slotsForDay(day)"
                  :key="`${day.date}-${slot.time}`"
                  type="button"
                  class="bk-slot"
                  :class="{ selected: selectedSlot?.date === day.date && selectedSlot?.time === slot.time }"
                  @click="pickSlot(day.date, slot)"
                >
                  {{ slot.time }}
                </button>
                <p v-if="!slotsForDay(day).length" class="bk-no-slots">—</p>
              </div>
            </div>
          </div>
        </div>

        <p v-if="selectedSlot" class="bk-selected-hint">
          Créneau sélectionné : {{ selectedSlotLabel }}
        </p>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ChevronLeft, ChevronRight, CalendarDays, Loader2, Clock } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

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
  collaboratorIds: string[]
}

interface DayData {
  date: string
  label: string
  slots: DaySlot[]
  byCollaborator: Record<string, string[]>
}

const props = defineProps<{
  proId: string
  service: Service
  collaborators: Collaborator[]
}>()

defineEmits<{ close: [] }>()

const toast = useToast()
const ANY_COLLAB = ''

const selectedCollabId = ref('')
const weekStart        = ref(todayStr())
const loading          = ref(false)
const error            = ref('')
const days             = ref<DayData[]>([])
const selectedSlot     = ref<{ date: string; time: string; collaboratorIds: string[] } | null>(null)

const eligibleCollaborators = computed(() =>
  props.collaborators.filter(c =>
    !c.serviceIds?.length || c.serviceIds.some(id => String(id) === String(props.service._id))
  )
)

const displayDays = computed(() => days.value.slice(0, 7))

const selectedSlotLabel = computed(() => {
  if (!selectedSlot.value) return ''
  const day = days.value.find(d => d.date === selectedSlot.value!.date)
  const collabName = selectedCollabId.value
    ? eligibleCollaborators.value.find(c => c._id === selectedCollabId.value)
    : null
  const name = collabName ? collabName.firstName : 'Sans préférence'
  return `${day?.label || selectedSlot.value.date} à ${selectedSlot.value.time} avec ${name}`
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
    const times = day.byCollaborator[selectedCollabId.value] || []
    return times.map(time => ({ time, collaboratorIds: [selectedCollabId.value] }))
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
      d.slots?.length || Object.values(d.byCollaborator || {}).some(a => a.length)
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
  selectedSlot.value = { date, time: slot.time, collaboratorIds: slot.collaboratorIds }
  toast.info('La confirmation de RDV arrive au prochain sprint — créneau enregistré localement.')
}

watch(selectedCollabId, () => fetchWeek())

onMounted(() => {
  selectedCollabId.value = ANY_COLLAB
  fetchWeek()
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

.bk-no-slots {
  font-size: 0.85rem;
  color: #ccc;
  margin: 0.5rem 0;
}

.bk-selected-hint {
  margin: 1.25rem 0 0;
  padding: 0.75rem 1rem;
  background: #EADAF3;
  border-radius: 10px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.85rem;
  color: #4F3942;
  font-weight: 600;
}

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .bk-grid { grid-template-columns: repeat(4, minmax(68px, 1fr)); }
  .bk-card__head, .bk-collabs, .bk-datetime { padding-left: 1rem; padding-right: 1rem; }
}
</style>
