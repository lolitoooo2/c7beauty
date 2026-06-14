<template>
  <div class="sched-editor">
    <div v-if="loading" class="sched-editor__loading">
      <Loader2 :size="22" class="spin" /> Chargement…
    </div>

    <template v-else>
      <div v-if="collaboratorId && inherited" class="sched-inherit-banner">
        ↪ Ce collaborateur <strong>hérite des horaires du salon</strong>.
        Modifiez ci-dessous pour créer des horaires personnalisés.
      </div>
      <div v-else-if="collaboratorId && hasCustom" class="sched-custom-banner">
        ✎ Horaires <strong>personnalisés</strong> pour ce collaborateur.
        <button type="button" class="sched-reset-btn" :disabled="resetting" @click="resetToSalon">
          Revenir aux horaires du salon
        </button>
      </div>
      <p v-else class="sched-editor__hint">
        Semaine type du salon — appliquée à tous les collaborateurs sans horaires propres.
      </p>

      <div class="sched-days">
        <article v-for="day in days" :key="day.dayOfWeek" class="sched-day">
          <header class="sched-day__head">
            <label class="sched-day__toggle" :class="{ 'is-off': !day.isOpen }">
              <span class="sched-switch">
                <input v-model="day.isOpen" type="checkbox" class="sched-switch__input" />
                <span class="sched-switch__track" aria-hidden="true"></span>
              </span>
              <strong class="sched-day__name">{{ dayLabels[day.dayOfWeek] }}</strong>
              <span class="sched-day__badge">{{ day.isOpen ? 'Ouvert' : 'Fermé' }}</span>
            </label>
          </header>

          <div v-if="day.isOpen" class="sched-day__slots">
            <div v-for="(slot, idx) in day.slots" :key="idx" class="sched-slot">
              <input v-model="slot.start" type="time" class="sched-time" />
              <span>→</span>
              <input v-model="slot.end" type="time" class="sched-time" />
              <button type="button" class="sched-slot__rm" @click="removeSlot(day, idx)">×</button>
            </div>
            <button type="button" class="sched-add-slot" @click="addSlot(day)">+ Plage horaire</button>
          </div>
        </article>
      </div>

      <div class="sched-editor__footer">
        <button type="button" class="btn-primary" :disabled="saving" @click="save">
          <Loader2 v-if="saving" :size="14" class="spin" />
          {{ saveLabel }}
        </button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

interface TimeSlot { start: string; end: string }
interface DaySchedule { dayOfWeek: number; isOpen: boolean; slots: TimeSlot[] }

const props = defineProps<{ collaboratorId?: string | null }>()

const authStore = useAuthStore()
const toast     = useToast()

const dayLabels = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']

const loading   = ref(true)
const saving    = ref(false)
const resetting = ref(false)
const inherited = ref(false)
const hasCustom = ref(false)
const days      = ref<DaySchedule[]>([])

const saveLabel = computed(() => {
  if (!props.collaboratorId) return 'Enregistrer les horaires du salon'
  if (inherited.value) return 'Personnaliser pour ce collaborateur'
  return 'Enregistrer les horaires'
})

function emptyDays (): DaySchedule[] {
  return Array.from({ length: 7 }, (_, i) => ({
    dayOfWeek : i,
    isOpen    : false,
    slots     : []
  }))
}

function addSlot (day: DaySchedule) {
  day.slots.push({ start: '09:00', end: '12:00' })
}

function removeSlot (day: DaySchedule, idx: number) {
  day.slots.splice(idx, 1)
  if (!day.slots.length) day.isOpen = false
}

async function load () {
  loading.value = true
  try {
    const params = new URLSearchParams()
    if (props.collaboratorId) params.set('collaboratorId', props.collaboratorId)
    const res  = await fetch(`/api/pro/schedule/weekly?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    inherited.value = !!data.inherited
    hasCustom.value = !!data.hasCustom
    days.value = (data.data?.days?.length ? data.data.days : emptyDays()) as DaySchedule[]
  } catch {
    days.value = emptyDays()
    toast.error('Impossible de charger les horaires.')
  } finally {
    loading.value = false
  }
}

async function save () {
  saving.value = true
  try {
    const res = await fetch('/api/pro/schedule/weekly', {
      method  : 'PUT',
      headers : {
        'Content-Type': 'application/json',
        Authorization : `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        collaboratorId : props.collaboratorId || null,
        days           : days.value
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    inherited.value = !!data.inherited
    hasCustom.value = !!data.hasCustom
    toast.success(data.message || 'Horaires enregistrés.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur enregistrement.')
  } finally {
    saving.value = false
  }
}

async function resetToSalon () {
  if (!props.collaboratorId) return
  if (!confirm('Ce collaborateur reprendra les horaires du salon. Continuer ?')) return
  resetting.value = true
  try {
    const params = new URLSearchParams({ collaboratorId: props.collaboratorId })
    const res = await fetch(`/api/pro/schedule/weekly/custom?${params}`, {
      method  : 'DELETE',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    inherited.value = true
    hasCustom.value = false
    days.value = data.data?.days || emptyDays()
    toast.success('Horaires du salon réappliqués.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur.')
  } finally {
    resetting.value = false
  }
}

onMounted(load)
watch(() => props.collaboratorId, load)
</script>

<style scoped>
.sched-inherit-banner,
.sched-custom-banner {
  background: #EADAF3; border-radius: 10px; padding: 0.85rem 1rem;
  font-size: 0.85rem; color: #4F3942; line-height: 1.5; margin-bottom: 1rem;
}
.sched-custom-banner { background: #f3f0ff; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }
.sched-reset-btn {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 8px;
  padding: 0.35rem 0.75rem; font-size: 0.78rem; cursor: pointer; color: #4F3942;
}
.sched-reset-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.sched-editor__hint { font-size: 0.85rem; color: #888; margin: 0 0 1.25rem; line-height: 1.5; }
.sched-editor__loading { display: flex; align-items: center; gap: 0.6rem; padding: 2rem; color: #888; }

.sched-days { display: flex; flex-direction: column; gap: 0.75rem; }

.sched-day {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 12px; padding: 0.85rem 1rem;
  transition: border-color 0.2s, background 0.2s;
}
.sched-day:has(.sched-day__toggle.is-off) {
  background: #FAFAF8;
  border-color: #EEEAE6;
}

.sched-day__head { margin-bottom: 0.5rem; }
.sched-day__toggle {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  cursor: pointer;
  user-select: none;
}
.sched-day__toggle.is-off .sched-day__name { color: #aaa; }
.sched-day__name {
  font-family: "Montserrat", sans-serif;
  font-size: 0.9rem;
  font-weight: 600;
  color: #4F3942;
  flex: 1;
}

.sched-day__badge {
  font-family: "Montserrat", sans-serif;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #EADAF3;
  color: #4F3942;
}
.sched-day__toggle.is-off .sched-day__badge {
  background: #F0EBE8;
  color: #aaa;
}

/* Toggle switch charte C7'Beauty */
.sched-switch {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  width: 46px;
  height: 26px;
}
.sched-switch__input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}
.sched-switch__track {
  position: absolute;
  inset: 0;
  background: #E4E0DC;
  border-radius: 999px;
  transition: background 0.22s ease, box-shadow 0.22s ease;
}
.sched-switch__track::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(79, 57, 66, 0.18);
  transition: transform 0.22s ease;
}
.sched-switch__input:checked + .sched-switch__track {
  background: linear-gradient(135deg, #4F3942 0%, #6B4F62 100%);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
}
.sched-switch__input:checked + .sched-switch__track::after {
  transform: translateX(20px);
}
.sched-switch__input:focus-visible + .sched-switch__track {
  outline: 2px solid #D1A1C7;
  outline-offset: 2px;
}
.sched-switch__input:disabled + .sched-switch__track {
  opacity: 0.45;
  cursor: not-allowed;
}

.sched-day__slots { display: flex; flex-direction: column; gap: 0.5rem; }
.sched-slot { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.sched-time {
  border: 1px solid #E4E0DC; border-radius: 8px; padding: 0.4rem 0.55rem;
  font-family: "Poppins", sans-serif; font-size: 0.85rem;
}
.sched-slot__rm {
  background: #fdecea; border: none; border-radius: 6px; width: 28px; height: 28px;
  cursor: pointer; color: #c0565b; font-size: 1.1rem;
}
.sched-add-slot {
  align-self: flex-start; background: none; border: 1px dashed #D1A1C7; border-radius: 8px;
  padding: 0.35rem 0.75rem; font-size: 0.78rem; color: #9B7A96; cursor: pointer;
}

.sched-editor__footer { margin-top: 1.25rem; display: flex; justify-content: flex-end; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 0.4rem;
  background: #4F3942; color: #fff; border: none; border-radius: 999px;
  padding: 0.65rem 1.25rem; font-family: "Montserrat", sans-serif;
  font-size: 0.82rem; font-weight: 600; cursor: pointer;
}
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (min-width: 769px) {
  .sched-days { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
}
</style>
