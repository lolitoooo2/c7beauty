<template>
  <div class="book-page" v-if="pro && service">

    <!-- Nav — identique à la fiche salon -->
    <nav class="salon-nav">
      <button type="button" class="back-btn" @click="goBackToSalon">
        <ArrowLeft :size="18" /> Retour au salon
      </button>
      <router-link to="/" class="salon-logo">
        <img src="@/assets/logo.svg" alt="C7'Beauty" />
      </router-link>
    </nav>

    <div class="book-content">
      <!-- En-tête salon -->
      <div class="salon-header">
        <div>
          <p class="book-step">Prise de rendez-vous</p>
          <h1 class="salon-name">{{ pro.salonName }}</h1>
          <p class="salon-location">
            <MapPin :size="15" /> {{ pro.address }}, {{ pro.city }} {{ pro.postalCode }}
          </p>
          <div v-if="pro.categories?.length" class="salon-cats">
            <span v-for="cat in pro.categories" :key="cat" class="cat-badge">{{ cat }}</span>
          </div>
        </div>
        <div class="salon-rating" v-if="pro.stats?.averageRating">
          <Star :size="20" :stroke-width="2" />
          <span class="rating-val">{{ pro.stats.averageRating.toFixed(1) }}</span>
          <span class="rating-count">{{ pro.stats.reviewCount }} avis</span>
        </div>
      </div>

      <BookingPanel
        :pro-id="proId"
        :service="service"
        :collaborators="collaborators"
        @close="goBackToSalon"
      />
    </div>
  </div>

  <div v-else-if="loading" class="page-loading">
    <Loader2 :size="36" class="spin" />
  </div>

  <div v-else class="page-error">
    <p>Prestation ou salon introuvable.</p>
    <button type="button" class="page-error__link" @click="goBackToSalon">Retour au salon</button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, MapPin, Star, Loader2 } from 'lucide-vue-next'
import BookingPanel from '@/components/BookingPanel.vue'
import { useToast } from '@/composables/useToast'

interface Service {
  _id: string
  name: string
  description?: string
  duration: number
  price: number
}

interface SalonCollaborator {
  _id: string
  firstName: string
  lastName: string
  photo?: string | null
  isOwner?: boolean
  serviceIds?: string[]
}

const route  = useRoute()
const router = useRouter()
const toast  = useToast()

const proId     = computed(() => String(route.params.id))
const serviceId = computed(() => String(route.params.serviceId))

function goBackToSalon () {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.replace(`/salon/${proId.value}`)
  }
}

const loading       = ref(true)
const pro           = ref<any>(null)
const service       = ref<Service | null>(null)
const collaborators = ref<SalonCollaborator[]>([])

async function load () {
  loading.value = true
  try {
    const [salonRes, svcRes] = await Promise.all([
      fetch(`/api/search/salon/${proId.value}`),
      fetch(`/api/services/pro/${proId.value}`)
    ])

    if (salonRes.ok) {
      const salonData = await salonRes.json()
      pro.value = salonData.pro
      collaborators.value = salonData.collaborators || []
    }

    if (svcRes.ok) {
      const svcData = await svcRes.json()
      for (const g of svcData.grouped || []) {
        const found = (g.services || []).find((s: Service) => String(s._id) === serviceId.value)
        if (found) { service.value = found; break }
      }
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  load()
  if (route.query.cancelled === '1') {
    toast.info('Paiement annulé. Vous pouvez choisir un autre créneau.')
    router.replace({ query: {} })
  }
})
</script>

<style scoped>
.book-page {
  min-height: 100vh;
  background: #F8F5F2;
  font-family: "Poppins", sans-serif;
}

/* Nav — reprise SalonView */
.salon-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: #fff;
  border-bottom: 1px solid #E4E0DC;
  position: sticky;
  top: 0;
  z-index: 100;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: "Montserrat", sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4F3942;
  text-decoration: none;
  transition: color 0.18s;
}
.back-btn:hover { color: #2C1810; }

.salon-logo img { height: 30px; }

.book-content {
  max-width: 1040px;
  margin: 0 auto;
  padding: 2rem 1.5rem 3rem;
}

.book-step {
  font-family: "Montserrat", sans-serif;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #D1A1C7;
  margin: 0 0 0.35rem;
}

.salon-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 2rem;
}

.salon-name {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 2rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0 0 0.5rem;
}

.salon-location {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  color: #888;
  font-size: 0.88rem;
  margin: 0 0 0.5rem;
}

.salon-cats { display: flex; flex-wrap: wrap; gap: 0.35rem; }

.cat-badge {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  background: #EADAF3;
  color: #4F3942;
  border-radius: 20px;
  padding: 0.2rem 0.65rem;
}

.salon-rating {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 14px;
  padding: 0.75rem 1rem;
  flex-shrink: 0;
  color: #4F3942;
}

.rating-val { font-size: 1.5rem; font-weight: 800; line-height: 1; }
.rating-count { font-size: 0.72rem; color: #aaa; }

.page-loading, .page-error {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #aaa;
  font-size: 0.9rem;
  background: #F8F5F2;
}

.page-error a, .page-error__link {
  background: none;
  border: none;
  padding: 0;
  color: #4F3942;
  font-weight: 600;
  font-family: inherit;
  font-size: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 640px) {
  .salon-name { font-size: 1.5rem; }
  .salon-header { flex-direction: column; }
  .salon-rating { flex-direction: row; gap: 0.4rem; align-self: flex-start; }
}
</style>
