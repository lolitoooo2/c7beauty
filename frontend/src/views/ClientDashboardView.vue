<template>
  <div class="dashboard">

    <!-- ── Sidebar ── -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar__top">
        <RouterLink to="/" class="sidebar__logo">
          <img src="@/assets/logo.svg" alt="C7'Beauty" />
        </RouterLink>
        <button class="sidebar__close" @click="sidebarOpen = false" aria-label="Fermer">
          <X :size="20" />
        </button>
      </div>

      <nav class="sidebar__nav">
        <button
          v-for="item in navItems"
          :key="item.id"
          class="sidebar__item"
          :class="{ active: activeSection === item.id }"
          @click="activeSection = item.id; sidebarOpen = false"
        >
          <component :is="item.icon" :size="19" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <button class="sidebar__logout" @click="handleLogout">
        <LogOut :size="18" />
        <span>Se déconnecter</span>
      </button>
    </aside>

    <!-- Overlay mobile -->
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <!-- ── Main ── -->
    <div class="dashboard__main">

      <!-- Topbar -->
      <header class="topbar">
        <button class="topbar__burger" @click="sidebarOpen = true" aria-label="Menu">
          <Menu :size="22" />
        </button>
        <div class="topbar__right">
          <span class="topbar__greeting">
            <Sun :size="16" class="greeting-icon" />
            Bonjour, <strong>{{ client?.firstName }}</strong>
          </span>
          <div class="topbar__avatar" :title="fullName">
            <img v-if="avatarUrl" :src="avatarUrl" class="topbar__avatar-img" alt="avatar" />
            <span v-else>{{ initials }}</span>
          </div>
        </div>
      </header>

      <!-- ── Accueil ── -->
      <section v-if="activeSection === 'home'" class="section-content">
        <h1 class="page-title">Tableau de bord</h1>

        <!-- Cartes résumé -->
        <div class="cards-grid">
          <div class="summary-card summary-card--accent">
            <div class="summary-card__icon"><Wallet :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ client?.wallet?.cashback?.toFixed(2) ?? '0.00' }} €</span>
              <span class="summary-card__label">Cashback disponible</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-card__icon"><Star :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ client?.wallet?.points ?? 0 }}</span>
              <span class="summary-card__label">Points fidélité</span>
            </div>
          </div>

          <div class="summary-card">
            <div class="summary-card__icon"><CalendarCheck :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ client?.wallet?.prestationCount ?? 0 }} / 9</span>
              <span class="summary-card__label">Vers -50 % (10e RDV)</span>
            </div>
          </div>

          <div v-if="referralEnabled" class="summary-card">
            <div class="summary-card__icon"><Users :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value referral">{{ client?.myReferralCode ?? '—' }}</span>
              <span class="summary-card__label">Mon code parrainage</span>
            </div>
          </div>
        </div>

        <!-- Actions rapides -->
        <h2 class="section-title">Actions rapides</h2>
        <div class="actions-grid">
          <button
            v-for="action in quickActions"
            :key="action.id"
            class="action-card"
            @click="activeSection = action.target"
          >
            <div class="action-card__icon">
              <component :is="action.icon" :size="26" :stroke-width="1.5" />
            </div>
            <span class="action-card__label">{{ action.label }}</span>
          </button>
        </div>

        <!-- Prochaine réservation -->
        <h2 class="section-title">Prochaine réservation</h2>
        <div v-if="bookingsLoading" class="svc-loading-inline">
          <Loader2 :size="20" class="spin" />
        </div>
        <div v-else-if="nextBooking" class="booking-card">
          <div class="booking-card__main">
            <h3>{{ nextBooking.pro?.salonName }}</h3>
            <p class="booking-card__svc">{{ nextBooking.serviceName }}</p>
            <p class="booking-card__when">{{ formatBookingDate(nextBooking.start) }}</p>
            <p v-if="nextBooking.collaborator" class="booking-card__who">
              avec {{ nextBooking.collaborator.firstName }} {{ nextBooking.collaborator.lastName }}
            </p>
            <BookingPaymentSummary
              v-if="nextBooking.payment"
              :payment="nextBooking.payment"
              :commission="nextBooking.commission"
              variant="compact"
              class="booking-card__pay"
            />
          </div>
          <span class="booking-card__price">{{ nextBooking.price.toFixed(2) }} €</span>
        </div>
        <div v-else class="empty-state">
          <CalendarX :size="36" />
          <p>Aucune réservation à venir.</p>
          <router-link to="/recherche" class="btn-primary">Réserver maintenant</router-link>
        </div>
      </section>

      <!-- ── Réservations ── -->
      <section v-else-if="activeSection === 'booking'" class="section-content">
        <h1 class="page-title">Réserver une prestation</h1>
        <p class="page-sub">Recherchez un salon près de chez vous et choisissez votre prestation.</p>
        <router-link to="/recherche" class="btn-primary">Lancer une recherche</router-link>
      </section>

      <!-- ── Historique ── -->
      <section v-else-if="activeSection === 'history'" class="section-content">
        <h1 class="page-title">Mes réservations</h1>

        <div v-if="bookingsLoading" class="svc-loading-inline">
          <Loader2 :size="22" class="spin" /> Chargement…
        </div>

        <template v-else>
          <h2 class="section-title">À venir</h2>
          <div v-if="!upcomingBookings.length" class="empty-state compact">
            <p>Aucun rendez-vous à venir.</p>
          </div>
          <div v-else class="booking-list">
            <article v-for="b in upcomingBookings" :key="b._id" class="booking-card booking-card--row">
              <div class="booking-card__main">
                <h3>{{ b.pro?.salonName }}</h3>
                <p class="booking-card__svc">{{ b.serviceName }} · {{ b.price.toFixed(2) }} €</p>
                <p class="booking-card__when">{{ formatBookingDate(b.start) }}</p>
                <BookingPaymentSummary
                  v-if="b.payment"
                  :payment="b.payment"
                  :commission="b.commission"
                  :service-validation="b.serviceValidation"
                  :dispute="b.dispute"
                  variant="compact"
                  show-meta
                  class="booking-card__pay"
                  @report-dispute="openDisputeModal(b._id)"
                />
              </div>
              <div class="booking-card__actions">
                <button
                  v-if="b.serviceValidation?.canValidateAsClient"
                  type="button"
                  class="btn-primary btn-compact"
                  :disabled="validatingBookingId === b._id"
                  @click="validateClientBooking(b._id)"
                >
                  <Loader2 v-if="validatingBookingId === b._id" :size="14" class="spin" />
                  Confirmer la prestation
                </button>
                <button type="button" class="btn-outline danger" @click="cancelBooking(b._id)">Annuler</button>
              </div>
            </article>
          </div>

          <h2 class="section-title">Passées / annulées</h2>
          <div v-if="!pastBookings.length" class="empty-state compact">
            <p>Aucun historique pour l'instant.</p>
          </div>
          <div v-else class="booking-list">
            <article v-for="b in pastBookings" :key="b._id" class="booking-card booking-card--row muted">
              <div class="booking-card__main">
                <h3>{{ b.pro?.salonName }}</h3>
                <p class="booking-card__svc">{{ b.serviceName }}</p>
                <p class="booking-card__when">{{ formatBookingDate(b.start) }}</p>
                <span class="booking-status" :class="b.status">{{ statusLabel(b.status) }}</span>
                <BookingPaymentSummary
                  v-if="b.payment"
                  :payment="b.payment"
                  :commission="b.commission"
                  :service-validation="b.serviceValidation"
                  :dispute="b.dispute"
                  variant="compact"
                  show-meta
                  class="booking-card__pay"
                  @report-dispute="openDisputeModal(b._id)"
                />
                <button
                  v-if="b.serviceValidation?.canValidateAsClient"
                  type="button"
                  class="btn-primary btn-compact"
                  :disabled="validatingBookingId === b._id"
                  @click="validateClientBooking(b._id)"
                >
                  <Loader2 v-if="validatingBookingId === b._id" :size="14" class="spin" />
                  Confirmer la prestation
                </button>
              </div>
            </article>
          </div>
        </template>
      </section>

      <!-- ── Cagnotte ── -->
      <section v-else-if="activeSection === 'wallet'" class="section-content">
        <h1 class="page-title">Ma cagnotte</h1>

        <div class="wallet-hero">
          <div class="wallet-hero__amount">{{ client?.wallet?.cashback?.toFixed(2) ?? '0.00' }} €</div>
          <div class="wallet-hero__label">Cashback disponible</div>
          <div class="wallet-hero__note">+1 € cashback dès 25 € de prestation · Plafond 30 € · Reset annuel</div>
        </div>

        <div class="cards-grid" style="margin-top:1.5rem">
          <div class="summary-card">
            <div class="summary-card__icon"><Star :size="20" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ client?.wallet?.points ?? 0 }} pts</span>
              <span class="summary-card__label">Points accumulés</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-card__icon"><Gift :size="20" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ client?.wallet?.prestationCount ?? 0 }} / 9</span>
              <span class="summary-card__label">10e prestation : -50 % (1×/mois)</span>
            </div>
          </div>
        </div>

        <template v-if="referralEnabled">
          <h2 class="section-title">Parrainage</h2>
          <div class="referral-card">
            <div class="referral-card__code">{{ client?.myReferralCode ?? '—' }}</div>
            <p class="referral-card__text">
              Partagez ce code. Vous gagnez <strong>5 €</strong> et votre filleul aussi !
            </p>
            <button class="btn-primary" @click="copyReferral">
              <Copy :size="15" /> Copier le code
            </button>
          </div>
        </template>
      </section>

      <!-- ── Profil ── -->
      <section v-else-if="activeSection === 'profile'" class="section-content">
        <h1 class="page-title">Mon profil</h1>

        <div class="profile-card">
          <!-- Zone avatar avec bouton caméra -->
          <div class="profile-card__avatar-wrap">
            <div class="profile-card__avatar-ring" :class="{ loading: avatarLoading }">
              <img v-if="avatarUrl" :src="avatarUrl" class="profile-card__avatar-img" alt="photo de profil" />
              <span v-else class="profile-card__avatar-initials">{{ initials }}</span>
              <div v-if="avatarLoading" class="avatar-overlay">
                <Loader2 :size="22" class="spin" />
              </div>
            </div>
            <div class="avatar-actions">
              <button class="avatar-btn" title="Changer la photo" @click="avatarInput?.click()" :disabled="avatarLoading">
                <Camera :size="15" /> Photo
              </button>
              <button v-if="avatarUrl" class="avatar-btn danger" title="Supprimer" @click="deleteAvatar" :disabled="avatarLoading">
                <Trash2 :size="15" />
              </button>
            </div>
            <!-- Input file caché -->
            <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" class="visually-hidden" @change="onAvatarFileChange" />
          </div>

          <div class="profile-card__info">
            <h2 class="profile-card__name">{{ fullName }}</h2>
            <p class="profile-card__email">{{ client?.email }}</p>
            <p class="profile-card__phone">{{ profileForm.phone || client?.phone }}</p>
            <p class="profile-card__since">Membre depuis {{ joinDate }}</p>
          </div>
        </div>

        <h2 class="section-title">Modifier mes informations</h2>
        <form class="profile-form" @submit.prevent="saveProfile" novalidate>
          <div class="pf-row">
            <div class="pf-field">
              <label for="pf-firstName">Prénom</label>
              <input id="pf-firstName" v-model="profileForm.firstName" type="text" placeholder="Prénom" />
            </div>
            <div class="pf-field">
              <label for="pf-lastName">Nom</label>
              <input id="pf-lastName" v-model="profileForm.lastName" type="text" placeholder="Nom" />
            </div>
          </div>

          <div class="pf-row">
            <div class="pf-field">
              <label for="pf-phone">Téléphone</label>
              <input id="pf-phone" v-model="profileForm.phone" type="tel" placeholder="06 XX XX XX XX" />
            </div>
            <div class="pf-field">
              <label for="pf-postal">Code postal <span class="pf-locked">(optionnel)</span></label>
              <input id="pf-postal" v-model="profileForm.postalCode" type="text"
                placeholder="75001" maxlength="5" inputmode="numeric" />
            </div>
          </div>

          <div class="pf-field">
            <label for="pf-email">Email <span class="pf-locked">— non modifiable</span></label>
            <input id="pf-email" :value="client?.email" type="email" disabled />
          </div>

          <p v-if="profileError" class="api-error">{{ profileError }}</p>
          <p v-if="profileSuccess" class="api-success">{{ profileSuccess }}</p>

          <button type="submit" class="btn-primary" :disabled="profileSaving">
            <span v-if="profileSaving">Enregistrement…</span>
            <span v-else>Enregistrer les modifications</span>
          </button>
        </form>

        <h2 class="section-title" style="margin-top:2rem">Sécurité</h2>
        <div class="security-card">
          <div class="security-card__item">
            <div>
              <p class="security-card__label">Mot de passe</p>
              <p class="security-card__hint">Dernière modification : —</p>
            </div>
            <button class="btn-outline" disabled>Modifier</button>
          </div>
        </div>
      </section>

    </div>
  </div>

  <div v-if="disputeModal.open" class="modal-overlay" @click.self="disputeModal.open = false">
    <div class="dispute-modal">
      <h3>Signaler un problème</h3>
      <p class="dispute-modal__hint">
        Décrivez brièvement le problème rencontré. Le paiement du solde sera suspendu le temps du traitement.
      </p>
      <textarea
        v-model="disputeModal.reason"
        rows="4"
        maxlength="1000"
        placeholder="Motif du litige (optionnel)"
      />
      <div class="dispute-modal__actions">
        <button type="button" class="btn-outline" @click="disputeModal.open = false">Annuler</button>
        <button
          type="button"
          class="btn-primary danger"
          :disabled="disputingBookingId === disputeModal.bookingId"
          @click="submitDispute"
        >
          <Loader2 v-if="disputingBookingId === disputeModal.bookingId" :size="14" class="spin" />
          Confirmer le litige
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  LayoutDashboard, CalendarCheck, ClipboardList, Wallet,
  User, LogOut, Menu, X, Star, Users, Sparkles,
  CalendarX, Gift, Copy, Sun, Camera, Trash2, Loader2
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { ClientUser } from '@/stores/auth'
import BookingPaymentSummary, {
  type PaymentSummary,
  type CommissionSummary,
  type StatusInfo
} from '@/components/BookingPaymentSummary.vue'

const authStore     = useAuthStore()
const router        = useRouter()
const toast         = useToast()
const sidebarOpen   = ref(false)
const activeSection = ref('home')

interface BookingItem {
  _id: string
  start: string
  end: string
  status: string
  serviceName: string
  price: number
  payment?: PaymentSummary
  commission?: CommissionSummary | null
  serviceValidation?: StatusInfo
  dispute?: StatusInfo
  pro?: { salonName: string; address?: string; city?: string; postalCode?: string }
  collaborator?: { firstName: string; lastName: string; photo?: string | null }
}

const validatingBookingId = ref<string | null>(null)
const disputingBookingId  = ref<string | null>(null)
const referralEnabled     = ref(false)
const disputeModal = reactive({
  open      : false,
  bookingId : '',
  reason    : ''
})

const bookingsLoading   = ref(false)
const upcomingBookings  = ref<BookingItem[]>([])
const pastBookings      = ref<BookingItem[]>([])
const nextBooking       = computed(() => upcomingBookings.value[0] || null)

const client = computed(() => authStore.user as ClientUser | null)

// ── Profil éditable ───────────────────────────
const profileForm = reactive({
  firstName:  client.value?.firstName  ?? '',
  lastName:   client.value?.lastName   ?? '',
  phone:      client.value?.phone      ?? '',
  postalCode: client.value?.postalCode ?? ''
})
const profileSaving = ref(false)
const profileError  = ref('')
const profileSuccess = ref('')

async function saveProfile() {
  profileSaving.value = true
  profileError.value  = ''
  profileSuccess.value = ''
  try {
    const res  = await fetch('/api/client', {
      method  : 'PUT',
      headers : {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authStore.token}`
      },
      body: JSON.stringify({
        firstName:  profileForm.firstName,
        lastName:   profileForm.lastName,
        phone:      profileForm.phone,
        postalCode: profileForm.postalCode || null
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'client')
    profileSuccess.value = 'Profil mis à jour avec succès !'
    toast.success('Profil mis à jour !')
  } catch (err: unknown) {
    profileError.value = err instanceof Error ? err.message : 'Erreur lors de la mise à jour'
  } finally {
    profileSaving.value = false
  }
}

// ── Avatar ─────────────────────────────────────
const avatarUrl     = ref<string | null>(null)
const avatarLoading = ref(false)
const avatarInput   = ref<HTMLInputElement | null>(null)

function avatarSrc (filename: string | null | undefined) {
  if (!filename) return null
  return `/api/media/avatars/clients/${filename}`
}

// Charger l'avatar depuis l'objet client en session
function syncAvatar () {
  const c = client.value as any
  if (c?.avatar) {
    // on fait un fetch avec auth pour éviter les 401 dans <img>
    fetch(avatarSrc(c.avatar)!, { headers: { Authorization: `Bearer ${authStore.token}` } })
      .then(r => r.blob())
      .then(b => { avatarUrl.value = URL.createObjectURL(b) })
      .catch(() => { avatarUrl.value = null })
  } else {
    avatarUrl.value = null
  }
}

onMounted(syncAvatar)

async function uploadAvatar (file: File) {
  avatarLoading.value = true
  const fd = new FormData()
  fd.append('avatar', file)
  try {
    const res  = await fetch('/api/client/avatar', {
      method : 'PUT',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body   : fd
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'client')
    avatarUrl.value = URL.createObjectURL(file)
    toast.success('Photo de profil mise à jour !')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur upload avatar')
  } finally {
    avatarLoading.value = false
  }
}

async function deleteAvatar () {
  if (!confirm('Supprimer votre photo de profil ?')) return
  avatarLoading.value = true
  try {
    const res  = await fetch('/api/client/avatar', {
      method : 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'client')
    if (avatarUrl.value) URL.revokeObjectURL(avatarUrl.value)
    avatarUrl.value = null
    toast.success('Photo de profil supprimée.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur suppression avatar')
  } finally {
    avatarLoading.value = false
  }
}

function onAvatarFileChange (e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadAvatar(file)
}

const fullName = computed(() =>
  client.value ? `${client.value.firstName} ${client.value.lastName}` : ''
)

const initials = computed(() => {
  if (!client.value) return '?'
  return (client.value.firstName[0] + client.value.lastName[0]).toUpperCase()
})

const joinDate = computed(() => {
  if (!client.value?.createdAt) return '—'
  return new Date(client.value.createdAt).toLocaleDateString('fr-FR', {
    month: 'long', year: 'numeric'
  })
})

const navItems = [
  { id: 'home',    label: 'Accueil',       icon: LayoutDashboard },
  { id: 'booking', label: 'Réserver',      icon: Sparkles        },
  { id: 'history', label: 'Réservations',  icon: ClipboardList   },
  { id: 'wallet',  label: 'Ma cagnotte',   icon: Wallet          },
  { id: 'profile', label: 'Mon profil',    icon: User            },
]

const quickActions = [
  { id: 'reserve',  label: 'Réserver',       icon: Sparkles,      target: 'booking' },
  { id: 'history',  label: 'Historique',      icon: ClipboardList, target: 'history' },
  { id: 'wallet',   label: 'Ma cagnotte',     icon: Wallet,        target: 'wallet'  },
  { id: 'profile',  label: 'Mon profil',      icon: User,          target: 'profile' },
]

function copyReferral() {
  if (!client.value?.myReferralCode) return
  navigator.clipboard.writeText(client.value.myReferralCode)
  toast.success('Code copié dans le presse-papier !')
}

function handleLogout() {
  authStore.logout()
  toast.info('À bientôt !')
  router.push('/')
}

function formatBookingDate (iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit'
  })
}

function statusLabel (status: string) {
  if (status === 'cancelled') return 'Annulé'
  if (status === 'completed') return 'Terminé'
  return 'Passé'
}

async function fetchReferralSetting () {
  try {
    const res = await fetch('/api/settings')
    if (!res.ok) return
    const data = await res.json()
    referralEnabled.value = Boolean(data.referralCashbackEnabled)
  } catch {
    referralEnabled.value = false
  }
}

async function fetchBookings () {
  bookingsLoading.value = true
  try {
    const headers = { Authorization: `Bearer ${authStore.token}` }
    const [upRes, pastRes] = await Promise.all([
      fetch('/api/client/bookings?upcoming=1', { headers }),
      fetch('/api/client/bookings?past=1', { headers })
    ])
    if (upRes.ok) {
      const data = await upRes.json()
      upcomingBookings.value = data.data || []
    }
    if (pastRes.ok) {
      const data = await pastRes.json()
      pastBookings.value = data.data || []
    }
  } catch { /* ignore */ }
  finally { bookingsLoading.value = false }
}

async function cancelBooking (id: string) {
  if (!confirm('Annuler ce rendez-vous ?')) return
  try {
    const res = await fetch(`/api/client/bookings/${id}/cancel`, {
      method  : 'PATCH',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Rendez-vous annulé.')
    fetchBookings()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  }
}

async function validateClientBooking (id: string) {
  if (!confirm('Confirmer que la prestation s\'est bien déroulée ?')) return
  validatingBookingId.value = id
  try {
    const res = await fetch(`/api/client/bookings/${id}/validate`, {
      method  : 'PATCH',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Prestation confirmée. Vous disposez de 24h pour signaler un problème.')
    fetchBookings()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  } finally {
    validatingBookingId.value = null
  }
}

function openDisputeModal (id: string) {
  disputeModal.open      = true
  disputeModal.bookingId = id
  disputeModal.reason    = ''
}

async function submitDispute () {
  if (!disputeModal.bookingId) return
  disputingBookingId.value = disputeModal.bookingId
  try {
    const res = await fetch(`/api/client/bookings/${disputeModal.bookingId}/dispute`, {
      method  : 'PATCH',
      headers : {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${authStore.token}`
      },
      body: JSON.stringify({ reason: disputeModal.reason.trim() || undefined })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Litige enregistré. Le paiement du solde est suspendu.')
    disputeModal.open = false
    fetchBookings()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  } finally {
    disputingBookingId.value = null
  }
}

onMounted(() => {
  fetchReferralSetting()
  fetchBookings()
})
watch(activeSection, (s) => { if (s === 'history' || s === 'home') fetchBookings() })
</script>

<style>
body { margin: 0; }
</style>

<style scoped>
/* ════════════════════════════════
   LAYOUT
════════════════════════════════ */
.dashboard {
  display: flex;
  min-height: 100vh;
  background: var(--color-ivoire, #F8F5F2);
  font-family: "Poppins", sans-serif;
}

/* ── Sidebar ── */
.sidebar {
  width: 240px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid #E4E0DC;
  display: flex;
  flex-direction: column;
  padding: 0;
  position: sticky;
  top: 0;
  height: 100vh;
  overflow-y: auto;
}

.sidebar__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;             /* même hauteur que .topbar */
  padding: 0 1.25rem;
  border-bottom: 1px solid #F0EBE8;
  flex-shrink: 0;
}

.sidebar__logo img {
  height: 28px;
  width: auto;
}

.sidebar__close {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: #4F3942;
  padding: 4px;
}

.sidebar__nav {
  flex: 1;
  padding: 1rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.sidebar__item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 0.9rem;
  border-radius: 10px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.83rem;
  font-weight: 500;
  color: #888;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.22s ease;
}

.sidebar__item:hover { background: #F8F5F2; color: #4F3942; }
.sidebar__item.active { background: #EADAF3; color: #4F3942; font-weight: 600; }

.sidebar__logout {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1.5rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 500;
  color: #aaa;
  background: none;
  border: none;
  border-top: 1px solid #F0EBE8;
  cursor: pointer;
  width: 100%;
  transition: color 0.2s;
  margin-top: 1rem;
  padding-top: 1.25rem;
}

.sidebar__logout:hover { color: #c0565b; }

/* ── Main ── */
.dashboard__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ── Topbar ── */
.topbar {
  background: #fff;
  border-bottom: 1px solid #E4E0DC;
  padding: 0 2rem;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 10;
}

.topbar__burger {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  color: #4F3942;
  padding: 4px;
}

.topbar__right {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-left: auto;
}

.topbar__greeting {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.88rem;
  font-weight: 400;
  color: #555;
}
.greeting-icon { color: #D1A1C7; flex-shrink: 0; }

.topbar__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4F3942, #D1A1C7);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: "Montserrat", sans-serif;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  overflow: hidden;
}

.topbar__avatar-img {
  width: 100%; height: 100%; object-fit: cover;
}

/* ── Spin animation ── */
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── visually-hidden ── */
.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}

/* ── Section ── */
.section-content {
  padding: 2rem 2rem 3rem;
  max-width: 900px;
}

.page-title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 2rem;
  font-weight: 700;
  color: #4F3942;
  margin-bottom: 1.75rem;
}

.section-title {
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #aaa;
  margin: 2rem 0 1rem;
}

/* ── Summary cards ── */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 1rem;
}

.summary-card {
  background: #fff;
  border-radius: 14px;
  padding: 1.25rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  border: 1px solid #E4E0DC;
  transition: box-shadow 0.25s;
}

.summary-card:hover { box-shadow: 0 4px 18px rgba(79,57,66,0.08); }

.summary-card--accent { background: #4F3942; border-color: #4F3942; }
.summary-card--accent .summary-card__icon { background: rgba(255,255,255,0.15); color: white; }
.summary-card--accent .summary-card__value,
.summary-card--accent .summary-card__label { color: white; }

.summary-card__icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  background: #EADAF3;
  color: #4F3942;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.summary-card__body { display: flex; flex-direction: column; gap: 0.2rem; }

.summary-card__value {
  font-family: "Montserrat", sans-serif;
  font-size: 1.1rem;
  font-weight: 700;
  color: #4F3942;
  line-height: 1;
}

.summary-card__value.referral {
  font-size: 0.85rem;
  letter-spacing: 0.08em;
}

.summary-card__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.72rem;
  font-weight: 400;
  color: #aaa;
}

/* ── Quick actions ── */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.action-card {
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 14px;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
  transition: all 0.25s ease;
}

.action-card:hover {
  border-color: #D1A1C7;
  box-shadow: 0 4px 18px rgba(79,57,66,0.1);
  transform: translateY(-2px);
}

.action-card__icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: #EADAF3;
  color: #4F3942;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-card__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4F3942;
  text-align: center;
}

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 2rem;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #E4E0DC;
  color: #ccc;
  text-align: center;
}

.empty-state p {
  font-family: "Poppins", sans-serif;
  font-size: 0.92rem;
  font-weight: 300;
  color: #aaa;
}

.empty-state.compact { padding: 1.5rem; }

.page-sub {
  color: #888;
  font-size: 0.9rem;
  margin: -1rem 0 1.25rem;
}

.svc-loading-inline {
  display: flex; align-items: center; gap: 0.5rem; color: #aaa; padding: 1rem 0;
}

.booking-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 2rem; }

.booking-card {
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 14px;
  padding: 1.15rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.booking-card--row { align-items: flex-start; }
.booking-card.muted { opacity: 0.75; }

.booking-card__actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.5rem;
  flex-shrink: 0;
}

.btn-compact {
  padding: 0.45rem 0.85rem;
  font-size: 0.78rem;
  white-space: nowrap;
}

.booking-card__main h3 {
  font-family: "Montserrat", sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0 0 0.25rem;
}

.booking-card__svc, .booking-card__when, .booking-card__who {
  font-size: 0.82rem;
  color: #888;
  margin: 0.15rem 0 0;
}

.booking-card__price {
  font-weight: 800;
  color: #4F3942;
  flex-shrink: 0;
}

.booking-card__pay {
  margin-top: 0.65rem;
  max-width: 320px;
}

.booking-status {
  display: inline-block;
  margin-top: 0.35rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  color: #aaa;
}

.btn-outline.danger { color: #c0565b; border-color: #f0c4c4; flex-shrink: 0; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Wallet ── */
.wallet-hero {
  background: linear-gradient(135deg, #4F3942, #8a5e72);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  text-align: center;
  color: white;
}

.wallet-hero__amount {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 3rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 0.5rem;
}

.wallet-hero__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.88rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  opacity: 0.8;
  margin-bottom: 0.4rem;
}

.wallet-hero__note {
  font-size: 0.75rem;
  opacity: 0.5;
  font-family: "Poppins", sans-serif;
}

/* ── Referral ── */
.referral-card {
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 16px;
  padding: 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.referral-card__code {
  font-family: "Montserrat", sans-serif;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  color: #4F3942;
  background: #EADAF3;
  padding: 0.6rem 2rem;
  border-radius: 10px;
}

.referral-card__text {
  font-size: 0.88rem;
  color: #555;
  font-weight: 300;
  max-width: 320px;
}

/* ── Profile ── */
.profile-card {
  background: #fff;
  border-radius: 16px;
  border: 1px solid #E4E0DC;
  padding: 2rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

/* Bloc avatar + boutons */
.profile-card__avatar-wrap {
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem; flex-shrink: 0;
}

.profile-card__avatar-ring {
  position: relative;
  width: 80px; height: 80px; border-radius: 50%;
  background: linear-gradient(135deg, #4F3942, #D1A1C7);
  overflow: hidden;
}
.profile-card__avatar-ring.loading { opacity: 0.6; }

.profile-card__avatar-img {
  width: 100%; height: 100%; object-fit: cover;
}

.profile-card__avatar-initials {
  display: flex; align-items: center; justify-content: center;
  width: 100%; height: 100%;
  color: white; font-family: "Montserrat", sans-serif;
  font-size: 1.4rem; font-weight: 700;
}

.avatar-overlay {
  position: absolute; inset: 0;
  background: rgba(79,57,66,.45);
  display: flex; align-items: center; justify-content: center;
  color: #fff;
}

.avatar-actions { display: flex; gap: 0.4rem; }

.avatar-btn {
  display: inline-flex; align-items: center; gap: 0.3rem;
  background: #F8F5F2; border: 1px solid #E4E0DC; border-radius: 8px;
  padding: 0.3rem 0.65rem; font-size: 0.75rem; font-weight: 600;
  font-family: "Montserrat", sans-serif; color: #4F3942;
  cursor: pointer; transition: all 0.18s;
}
.avatar-btn:hover:not(:disabled) { background: #EADAF3; border-color: #D1A1C7; }
.avatar-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.avatar-btn.danger { color: #c0565b; }
.avatar-btn.danger:hover:not(:disabled) { background: #fdecea; border-color: #f5c0c2; }

.profile-card__name {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.4rem;
  font-weight: 700;
  color: #4F3942;
  margin-bottom: 0.25rem;
}

.profile-card__email,
.profile-card__phone {
  font-size: 0.88rem;
  color: #555;
  font-weight: 300;
  margin-bottom: 0.15rem;
}

.profile-card__since {
  font-size: 0.78rem;
  color: #aaa;
  margin-top: 0.5rem;
}

/* ── Profile form ── */
.profile-form { display: flex; flex-direction: column; gap: 0; }

.pf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }

.pf-field {
  display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem;
}

.pf-field label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.8rem; font-weight: 600; color: #4F3942; letter-spacing: 0.04em;
}

.pf-locked { font-weight: 300; color: #bbb; font-size: 0.75rem; }

.pf-field input {
  padding: 0.72rem 1rem;
  font-family: "Poppins", sans-serif; font-size: 0.9rem; font-weight: 300;
  color: #111; background: #F8F5F2;
  border: 1.5px solid #E4E0DC; border-radius: 10px; outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}
.pf-field input:focus { border-color: #D1A1C7; box-shadow: 0 0 0 3px rgba(209,161,199,0.18); }
.pf-field input:disabled { opacity: 0.5; cursor: not-allowed; }

.api-error {
  background: #fdecea; color: #c0565b; border-radius: 10px;
  padding: 0.7rem 1rem; font-size: 0.82rem; margin-bottom: 0.75rem;
}

.api-success {
  background: #edf7ed; color: #2e7d32; border-radius: 10px;
  padding: 0.7rem 1rem; font-size: 0.82rem; margin-bottom: 0.75rem;
}

/* ── Security ── */
.security-card {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 14px; padding: 1.25rem;
}

.security-card__item {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}

.security-card__label {
  font-family: "Montserrat", sans-serif; font-size: 0.88rem; font-weight: 600; color: #4F3942;
}

.security-card__hint { font-size: 0.78rem; color: #aaa; margin-top: 0.2rem; }

.btn-outline {
  padding: 0.55rem 1.25rem;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: #4F3942; background: transparent;
  border: 1.5px solid #E4E0DC; border-radius: 999px; cursor: pointer;
  transition: border-color 0.25s;
}
.btn-outline:hover:not(:disabled) { border-color: #4F3942; }
.btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.75rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
  background: #4F3942;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79,57,66,0.22);
  transition: background 0.28s;
}

.btn-primary:hover { background: #D1A1C7; }

/* ── Responsive ── */
.sidebar-overlay {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  z-index: 49;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}

.dispute-modal {
  background: #fff;
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  padding: 1.25rem;
  box-shadow: 0 20px 60px rgba(0,0,0,.18);
}

.dispute-modal h3 {
  margin: 0 0 0.5rem;
  font-size: 1.1rem;
  color: #2C1810;
}

.dispute-modal__hint {
  margin: 0 0 0.85rem;
  font-size: 0.82rem;
  color: #666;
  line-height: 1.45;
}

.dispute-modal textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #ece6ea;
  border-radius: 10px;
  padding: 0.65rem 0.75rem;
  font-family: inherit;
  font-size: 0.85rem;
  resize: vertical;
}

.dispute-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

.btn-primary.danger {
  background: #b42318;
  border-color: #b42318;
}

.btn-primary.danger:hover {
  background: #912018;
}

@media (max-width: 900px) {
  .actions-grid { grid-template-columns: repeat(2, 1fr); }
  .cards-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: -100%;
    top: 0; bottom: 0;
    z-index: 50;
    transition: left 0.3s ease;
    width: 260px;
  }

  .sidebar.open { left: 0; }
  .sidebar__close { display: flex; }
  .sidebar-overlay { display: block; }
  .topbar__burger { display: flex; }
  .topbar { padding: 0 1rem; }
  .section-content { padding: 1.5rem 1rem 3rem; }
  .actions-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 480px) {
  .actions-grid { grid-template-columns: repeat(2, 1fr); }
  .cards-grid { grid-template-columns: 1fr 1fr; }
  .page-title { font-size: 1.6rem; }
}
</style>
