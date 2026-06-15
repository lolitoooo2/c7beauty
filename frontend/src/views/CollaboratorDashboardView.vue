<template>
  <div class="collab-app">

    <!-- ── Sidebar desktop ── -->
    <aside class="collab-sidebar">
      <div class="collab-sidebar__top">
        <RouterLink to="/" class="collab-sidebar__logo">
          <img src="@/assets/logo.svg" alt="C7'Beauty" />
        </RouterLink>
      </div>

      <div class="collab-sidebar__profile">
        <div class="collab-sidebar__avatar">{{ initials }}</div>
        <div>
          <p class="collab-sidebar__name">{{ collab?.firstName }} {{ collab?.lastName }}</p>
          <p class="collab-sidebar__salon">{{ salonName }}</p>
        </div>
      </div>

      <nav class="collab-sidebar__nav">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="collab-sidebar__item"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >
          <component :is="t.icon" :size="18" :stroke-width="1.8" />
          <span>{{ t.label }}</span>
        </button>
      </nav>

      <button type="button" class="collab-sidebar__logout" @click="handleLogout">
        <LogOut :size="18" />
        <span>Se déconnecter</span>
      </button>
    </aside>

    <div class="collab-shell">

      <!-- ── Header mobile ── -->
      <header class="collab-header collab-header--mobile">
        <div class="collab-header__top">
          <img src="@/assets/logo.svg" alt="C7'Beauty" class="collab-header__logo" />
          <button type="button" class="collab-header__logout" @click="handleLogout">
            <LogOut :size="18" />
          </button>
        </div>
        <p class="collab-header__salon">{{ salonName }}</p>
        <h1>Bonjour, {{ collab?.firstName }}</h1>
      </header>

      <!-- ── Topbar desktop ── -->
      <header class="collab-topbar">
        <div>
          <p class="collab-topbar__eyebrow">{{ salonName }}</p>
          <h1 class="collab-topbar__title">Mon agenda — {{ tabTitle }}</h1>
        </div>
        <div class="collab-topbar__right">
          <span class="collab-topbar__greeting">
            Bonjour, <strong>{{ collab?.firstName }}</strong>
          </span>
          <div class="collab-topbar__avatar">{{ initials }}</div>
        </div>
      </header>

      <!-- ── Tabs mobile ── -->
      <div class="collab-tabs collab-tabs--mobile">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="collab-tab"
          :class="{ active: activeTab === t.id }"
          @click="activeTab = t.id"
        >{{ t.label }}</button>
      </div>

      <main class="collab-main">
        <!-- Résumé desktop -->
        <div class="collab-summary">
          <div class="collab-summary__card">
            <CalendarCheck :size="20" />
            <div>
              <span class="collab-summary__value">{{ periodBookingsCount }}</span>
              <span class="collab-summary__label">RDV {{ tabLabel }}</span>
            </div>
          </div>
          <div class="collab-summary__card" :class="{ 'collab-summary__card--muted': !nextBooking }">
            <Clock :size="20" />
            <div>
              <span class="collab-summary__value">{{ nextBookingLabel }}</span>
              <span class="collab-summary__label">Prochain rendez-vous</span>
            </div>
          </div>
        </div>

        <section class="collab-panel collab-panel--calendar">
          <AgendaCalendar
            v-if="activeTab === 'today'"
            ref="agendaCalRef"
            api-path="/api/collaborator/schedule/calendar"
            :pro-mode="true"
            active-view="day"
            @event-click="onBookingClick"
            @range-change="onRangeChange"
          />
          <AgendaCalendar
            v-else-if="activeTab === 'week'"
            ref="agendaCalRef"
            api-path="/api/collaborator/schedule/calendar"
            :pro-mode="true"
            active-view="week"
            @event-click="onBookingClick"
            @range-change="onRangeChange"
          />
          <AgendaCalendar
            v-else
            ref="agendaCalRef"
            api-path="/api/collaborator/schedule/calendar"
            initial-view="dayGridMonth"
            @event-click="onBookingClick"
            @range-change="onRangeChange"
          />
          <p class="collab-rdv-hint">Cliquez sur un rendez-vous pour voir le détail client.</p>
        </section>
      </main>
    </div>
  </div>

  <!-- Modale détail RDV -->
  <Teleport to="body">
    <div v-if="bookingModal.open" class="collab-modal-overlay" @click.self="bookingModal.open = false">
      <div class="collab-modal">
        <div class="collab-modal__head">
          <h3>Détail du rendez-vous</h3>
          <button type="button" @click="bookingModal.open = false">×</button>
        </div>
        <div class="collab-modal__body">
          <p class="collab-modal__svc">{{ bookingModal.serviceName }}</p>
          <p class="collab-modal__when">{{ bookingModal.timeLabel }} – {{ bookingModal.endLabel }}</p>
          <dl class="collab-modal__list">
            <div>
              <dt>Client</dt>
              <dd>{{ bookingModal.clientName || '—' }}</dd>
            </div>
            <div v-if="bookingModal.clientPhone">
              <dt>Téléphone</dt>
              <dd><a :href="`tel:${bookingModal.clientPhone}`">{{ bookingModal.clientPhone }}</a></dd>
            </div>
            <div v-if="bookingModal.duration">
              <dt>Durée</dt>
              <dd>{{ bookingModal.duration }} min</dd>
            </div>
            <div v-if="bookingModal.price != null">
              <dt>Prix</dt>
              <dd>{{ bookingModal.price.toFixed(2) }} €</dd>
            </div>
          </dl>
        </div>
        <div class="collab-modal__foot">
          <button
            v-if="bookingModalIsFuture && bookingModal.bookingId"
            type="button"
            class="collab-modal__cancel"
            :disabled="bookingModal.cancelLoading"
            @click="cancelCollabBooking"
          >
            <Loader2 v-if="bookingModal.cancelLoading" :size="14" class="spin" />
            Annuler le rendez-vous
          </button>
          <button type="button" class="collab-modal__close" @click="bookingModal.open = false">Fermer</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { CalendarDays, CalendarCheck, Clock, Loader2, LogOut } from 'lucide-vue-next'
import { useAuthStore, type CollaboratorUser } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AgendaCalendar from '@/components/AgendaCalendar.vue'

interface CollabBooking {
  _id: string
  start: string
  end: string
  serviceName: string
  duration?: number
  price?: number
  client?: { firstName: string; lastName: string; phone?: string }
}

const authStore = useAuthStore()
const router    = useRouter()
const toast     = useToast()

const collab         = computed(() => authStore.user as CollaboratorUser | null)
const salonName      = ref('Mon salon')
const activeTab      = ref<'today' | 'week' | 'month'>('week')
const collabBookings = ref<CollabBooking[]>([])
const agendaRange    = ref({ from: '', to: '' })
const agendaCalRef   = ref<InstanceType<typeof AgendaCalendar> | null>(null)

const bookingModal = reactive({
  open          : false,
  bookingId     : '',
  serviceName   : '',
  clientName    : '',
  clientPhone   : '',
  timeLabel     : '',
  endLabel      : '',
  duration      : 0,
  price         : null as number | null,
  startIso      : '',
  cancelLoading : false
})

const tabs = [
  { id: 'today' as const, label: 'Aujourd\'hui', icon: CalendarCheck },
  { id: 'week'  as const, label: 'Semaine',      icon: CalendarDays },
  { id: 'month' as const, label: 'Mois',         icon: Clock }
]

const initials = computed(() => {
  const c = collab.value
  if (!c) return '?'
  return ((c.firstName[0] || '') + (c.lastName[0] || '')).toUpperCase()
})

const tabLabel = computed(() => {
  if (activeTab.value === 'today') return 'aujourd\'hui'
  if (activeTab.value === 'week')  return 'cette semaine'
  return 'ce mois'
})

const tabTitle = computed(() => {
  if (activeTab.value === 'today') return 'Aujourd\'hui'
  if (activeTab.value === 'week')  return 'Semaine'
  return 'Mois'
})

const periodBookingsCount = computed(() => collabBookings.value.length)

const nextBooking = computed(() => {
  const now = Date.now()
  return collabBookings.value
    .filter(b => new Date(b.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())[0] || null
})

const nextBookingLabel = computed(() => {
  if (!nextBooking.value) return '—'
  return formatBookingTime(nextBooking.value.start)
})

const bookingModalIsFuture = computed(() => {
  if (!bookingModal.startIso) return false
  return new Date(bookingModal.startIso) > new Date()
})

function formatBookingTime (iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone : 'Europe/Paris',
    hour     : '2-digit',
    minute   : '2-digit'
  })
}

async function loadProfile () {
  try {
    const meRes = await fetch('/api/collaborator/me', {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (meRes.ok) {
      const meData = await meRes.json()
      salonName.value = meData.pro?.salonName || 'Salon'
    }
  } catch {
    toast.error('Impossible de charger le profil.')
  }
}

async function fetchCollabBookings () {
  if (!agendaRange.value.from || !agendaRange.value.to) return
  try {
    const params = new URLSearchParams({
      from : agendaRange.value.from,
      to   : agendaRange.value.to
    })
    const res = await fetch(`/api/collaborator/bookings?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (!res.ok) return
    const data = await res.json()
    collabBookings.value = data.data || []
  } catch {
    toast.error('Impossible de charger les rendez-vous.')
  }
}

function onRangeChange (payload: { from: string; to: string }) {
  agendaRange.value = payload
  fetchCollabBookings()
}

function onBookingClick (payload: {
  type?: string
  bookingId?: string
  serviceName?: string
  clientName?: string
  clientPhone?: string
  timeLabel?: string
  endLabel?: string
  startIso?: string
  duration?: number
  price?: number
}) {
  if (payload.type !== 'booking' || !payload.bookingId) return
  Object.assign(bookingModal, {
    open          : true,
    bookingId     : payload.bookingId,
    serviceName   : payload.serviceName || 'Rendez-vous',
    clientName    : payload.clientName || '',
    clientPhone   : payload.clientPhone || '',
    timeLabel     : payload.timeLabel || '',
    endLabel      : payload.endLabel || '',
    duration      : payload.duration || 0,
    price         : payload.price ?? null,
    startIso      : payload.startIso || '',
    cancelLoading : false
  })
}

async function cancelCollabBooking () {
  if (!bookingModal.bookingId || !bookingModalIsFuture.value) return
  if (!confirm('Annuler ce rendez-vous ?')) return

  bookingModal.cancelLoading = true
  try {
    const res = await fetch(`/api/collaborator/bookings/${bookingModal.bookingId}/cancel`, {
      method  : 'PATCH',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur')

    toast.success('Rendez-vous annulé.')
    bookingModal.open = false
    fetchCollabBookings()
    agendaCalRef.value?.refetch?.()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Impossible d\'annuler.')
  } finally {
    bookingModal.cancelLoading = false
  }
}

function handleLogout () {
  authStore.logout()
  router.push('/login/collaborateur')
}

onMounted(loadProfile)
</script>

<style scoped>
/* ═══════════════════════════════════════
   Mobile first (≤768px) — inchangé visuellement
═══════════════════════════════════════ */
.collab-app {
  min-height: 100vh;
  background: #F8F5F2;
  font-family: "Poppins", sans-serif;
}

.collab-sidebar,
.collab-topbar,
.collab-summary {
  display: none;
}

.collab-shell {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.collab-header {
  background: #fff;
  padding: 1rem 1.25rem 1.25rem;
  border-bottom: 1px solid #E4E0DC;
}

.collab-header__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.collab-header__logo { height: 28px; width: auto; }

.collab-header__logout {
  width: 40px; height: 40px; border-radius: 10px;
  border: none; background: #F3EAF7; color: #4F3942; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}

.collab-header__salon {
  margin: 0 0 0.25rem;
  font-size: 0.78rem;
  color: #999;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.collab-header h1 {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-size: 1.35rem;
  font-weight: 700;
  color: #4F3942;
}

.collab-tabs {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: #fff;
  border-bottom: 1px solid #E4E0DC;
  overflow-x: auto;
}

.collab-tab {
  flex-shrink: 0;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid #E4E0DC;
  background: #fff;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
}

.collab-tab.active {
  background: #4F3942;
  border-color: #4F3942;
  color: #fff;
}

.collab-main {
  flex: 1;
  padding: 1rem;
}

.collab-panel {
  background: transparent;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.collab-panel__head {
  display: none;
}

.collab-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 1rem;
  text-align: center;
  color: #aaa;
}

.collab-empty p { margin: 0; font-size: 0.95rem; color: #888; }

.collab-empty__hint {
  font-size: 0.8rem;
  line-height: 1.45;
  max-width: 280px;
}

.collab-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.collab-list__item {
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  color: #4F3942;
}

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ═══════════════════════════════════════
   Desktop (≥769px)
═══════════════════════════════════════ */
@media (min-width: 769px) {
  .collab-app {
    display: flex;
    min-height: 100vh;
  }

  .collab-sidebar {
    display: flex;
    flex-direction: column;
    width: 240px;
    flex-shrink: 0;
    background: #fff;
    border-right: 1px solid #E4E0DC;
    position: sticky;
    top: 0;
    height: 100vh;
    overflow-y: auto;
  }

  .collab-sidebar__top {
    display: flex;
    align-items: center;
    height: 64px;
    padding: 0 1.25rem;
    border-bottom: 1px solid #F0EBE8;
  }

  .collab-sidebar__logo img { height: 28px; width: auto; }

  .collab-sidebar__profile {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1.25rem;
    border-bottom: 1px solid #F0EBE8;
  }

  .collab-sidebar__avatar {
    width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, #4F3942, #D1A1C7);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-family: "Montserrat", sans-serif; font-size: 0.85rem; font-weight: 700;
  }

  .collab-sidebar__name {
    margin: 0 0 0.15rem;
    font-family: "Montserrat", sans-serif;
    font-size: 0.88rem; font-weight: 600; color: #4F3942;
  }

  .collab-sidebar__salon {
    margin: 0;
    font-size: 0.75rem; color: #999;
  }

  .collab-sidebar__nav {
    flex: 1;
    padding: 1rem 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .collab-sidebar__item {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 0.7rem 0.9rem; border-radius: 10px;
    font-family: "Montserrat", sans-serif; font-size: 0.83rem; font-weight: 500;
    color: #888; background: none; border: none; cursor: pointer;
    text-align: left; width: 100%; transition: all 0.22s ease;
  }

  .collab-sidebar__item:hover  { background: #F8F5F2; color: #4F3942; }
  .collab-sidebar__item.active { background: #EADAF3; color: #4F3942; font-weight: 600; }

  .collab-sidebar__logout {
    display: flex; align-items: center; gap: 0.75rem;
    padding: 1.25rem 1.5rem 1rem;
    font-family: "Montserrat", sans-serif; font-size: 0.82rem; font-weight: 500;
    color: #aaa; background: none; border: none; border-top: 1px solid #F0EBE8;
    cursor: pointer; width: 100%; transition: color 0.2s;
  }

  .collab-sidebar__logout:hover { color: #c0565b; }

  .collab-shell {
    flex: 1;
    max-width: none;
    margin: 0;
    min-width: 0;
  }

  .collab-header--mobile,
  .collab-tabs--mobile {
    display: none;
  }

  .collab-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: #fff;
    border-bottom: 1px solid #E4E0DC;
    padding: 0 2rem;
    height: 64px;
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .collab-topbar__eyebrow {
    margin: 0 0 0.1rem;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #999;
  }

  .collab-topbar__title {
    margin: 0;
    font-family: "Montserrat", sans-serif;
    font-size: 1.05rem;
    font-weight: 700;
    color: #4F3942;
  }

  .collab-topbar__right {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .collab-topbar__greeting {
    font-family: "Montserrat", sans-serif;
    font-size: 0.88rem;
    color: #555;
  }

  .collab-topbar__avatar {
    width: 38px; height: 38px; border-radius: 50%;
    background: linear-gradient(135deg, #4F3942, #D1A1C7);
    color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 700;
  }

  .collab-main {
    padding: 2rem;
    max-width: 960px;
  }

  .collab-summary {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .collab-summary__card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #fff;
    border: 1px solid #E4E0DC;
    border-radius: 14px;
    padding: 1.1rem 1.25rem;
    color: #4F3942;
  }

  .collab-summary__card--muted {
    color: #aaa;
  }

  .collab-summary__value {
    display: block;
    font-family: "Montserrat", sans-serif;
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.1;
    color: #4F3942;
  }

  .collab-summary__card--muted .collab-summary__value {
    color: #ccc;
  }

  .collab-summary__label {
    display: block;
    font-size: 0.78rem;
    color: #888;
    margin-top: 0.15rem;
  }

  .collab-panel {
    background: #fff;
    border: 1px solid #E4E0DC;
    border-radius: 16px;
    box-shadow: 0 2px 12px rgba(79, 57, 66, 0.04);
    overflow: hidden;
  }

  .collab-panel__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.25rem 1.5rem;
    border-bottom: 1px solid #F0EBE8;
  }

  .collab-panel__head h2 {
    margin: 0;
    font-family: "Montserrat", sans-serif;
    font-size: 0.95rem;
    font-weight: 700;
    color: #4F3942;
  }

  .collab-panel__count {
    font-size: 0.78rem;
    color: #aaa;
    font-family: "Montserrat", sans-serif;
  }

  .collab-empty {
    padding: 4rem 2rem;
  }

  .collab-empty__hint {
    max-width: 360px;
  }

  .collab-panel--calendar { padding: 0.5rem; border: none; box-shadow: none; background: transparent; }
  .collab-rdv-hint {
    margin: 0.75rem 0 0; font-size: 0.78rem; color: #aaa; text-align: center;
  }
}

.collab-modal-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(44, 24, 16, 0.45);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem;
}

.collab-modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(79, 57, 66, 0.18);
  overflow: hidden;
}

.collab-modal__head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #F0EBE8;
}

.collab-modal__head h3 {
  margin: 0;
  font-family: "Montserrat", sans-serif;
  font-size: 1rem;
  font-weight: 700;
  color: #4F3942;
}

.collab-modal__head button {
  border: none; background: none; font-size: 1.5rem; line-height: 1;
  color: #999; cursor: pointer;
}

.collab-modal__body { padding: 1.25rem; }

.collab-modal__svc {
  margin: 0 0 0.35rem;
  font-family: "Montserrat", sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: #4F3942;
}

.collab-modal__when {
  margin: 0 0 1rem;
  font-size: 0.88rem;
  color: #888;
}

.collab-modal__list {
  margin: 0;
  display: grid;
  gap: 0.65rem;
}

.collab-modal__list dt {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: #aaa;
}

.collab-modal__list dd {
  margin: 0.15rem 0 0;
  font-size: 0.92rem;
  color: #4F3942;
}

.collab-modal__list a { color: #4F3942; }

.collab-modal__foot {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  padding: 0.85rem 1.25rem 1.15rem;
  border-top: 1px solid #F0EBE8;
}

.collab-modal__cancel {
  padding: 0.55rem 1rem;
  border-radius: 10px;
  border: 1px solid #e8b4b8;
  background: #fff5f5;
  color: #c0565b;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

.collab-modal__close {
  padding: 0.55rem 1rem;
  border-radius: 10px;
  border: none;
  background: #4F3942;
  color: #fff;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}

@media (min-width: 1100px) {
  .collab-summary {
    grid-template-columns: repeat(2, minmax(0, 280px));
  }
}
</style>
