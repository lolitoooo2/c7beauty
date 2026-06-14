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
              <span class="collab-summary__value">—</span>
              <span class="collab-summary__label">RDV {{ tabLabel }}</span>
            </div>
          </div>
          <div class="collab-summary__card collab-summary__card--muted">
            <Clock :size="20" />
            <div>
              <span class="collab-summary__value">—</span>
              <span class="collab-summary__label">Prochain créneau</span>
            </div>
          </div>
        </div>

        <section class="collab-panel collab-panel--calendar">
          <AgendaCalendar
            :key="activeTab"
            api-path="/api/collaborator/schedule/calendar"
            :initial-view="calendarView"
          />
          <p class="collab-rdv-hint">Les rendez-vous clients s'afficheront ici au Sprint 3.</p>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { CalendarDays, CalendarCheck, Clock, Loader2, LogOut } from 'lucide-vue-next'
import { useAuthStore, type CollaboratorUser } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import AgendaCalendar from '@/components/AgendaCalendar.vue'

const authStore = useAuthStore()
const router    = useRouter()
const toast     = useToast()

const collab    = computed(() => authStore.user as CollaboratorUser | null)
const salonName = ref('Mon salon')
const activeTab = ref<'today' | 'week' | 'month'>('week')

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

const calendarView = computed(() => {
  if (activeTab.value === 'today') return 'timeGridDay' as const
  if (activeTab.value === 'month') return 'dayGridMonth' as const
  return 'timeGridWeek' as const
})

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

@media (min-width: 1100px) {
  .collab-summary {
    grid-template-columns: repeat(2, minmax(0, 280px));
  }
}
</style>
