<template>
  <div class="salon-page" v-if="pro">

    <!-- ── Nav retour ── -->
    <nav class="salon-nav">
      <button class="back-btn" @click="$router.back()">
        <ArrowLeft :size="18" /> Retour aux résultats
      </button>
      <router-link to="/" class="salon-logo">
        <img src="@/assets/logo.svg" alt="C7'Beauty" />
      </router-link>
    </nav>

    <!-- ── Galerie photos ── -->
    <div class="salon-gallery">
      <template v-if="pro.shopPhotos?.length">
        <div class="gallery-main" @click="openLightbox(galleryIdx)">
          <img :src="photoUrl(pro.shopPhotos[galleryIdx])" :alt="pro.salonName" class="gallery-main__img" />
          <div class="gallery-overlay"><Maximize2 :size="20" /> Agrandir</div>
        </div>
        <div class="gallery-thumbs" v-if="pro.shopPhotos.length > 1">
          <div
            v-for="(photo, i) in pro.shopPhotos.slice(1, 5)"
            :key="i"
            class="gallery-thumb"
            :class="{ active: galleryIdx === i + 1 }"
            @click="galleryIdx = i + 1"
          >
            <img :src="photoUrl(photo)" :alt="`Photo ${i + 2}`" />
          </div>
        </div>
      </template>
      <div v-else class="gallery-placeholder">
        <ImageOff :size="48" /> Aucune photo
      </div>
    </div>

    <!-- ── Lightbox ── -->
    <Teleport to="body">
      <div v-if="lightbox.open" class="lightbox" @click.self="lightbox.open = false">
        <button class="lightbox-close" @click="lightbox.open = false"><X :size="24" /></button>
        <button class="lightbox-prev" @click="lightbox.idx = Math.max(0, lightbox.idx - 1)">
          <ChevronLeft :size="28" />
        </button>
        <img :src="photoUrl(pro.shopPhotos[lightbox.idx])" class="lightbox-img" />
        <button class="lightbox-next" @click="lightbox.idx = Math.min(pro.shopPhotos.length - 1, lightbox.idx + 1)">
          <ChevronRight :size="28" />
        </button>
        <p class="lightbox-count">{{ lightbox.idx + 1 }} / {{ pro.shopPhotos.length }}</p>
      </div>
    </Teleport>

    <!-- ── Contenu ── -->
    <div class="salon-content">

      <!-- Colonne principale -->
      <main class="salon-main">

        <!-- En-tête -->
        <div class="salon-header">
          <div>
            <h1 class="salon-name">{{ pro.salonName }}</h1>
            <p class="salon-location">
              <MapPin :size="15" /> {{ pro.address }}, {{ pro.city }} {{ pro.postalCode }}
            </p>
            <div class="salon-cats">
              <span v-for="cat in pro.categories" :key="cat" class="cat-badge">{{ cat }}</span>
            </div>
          </div>
          <div class="salon-rating" v-if="pro.stats?.averageRating">
            <Star :size="20" :stroke-width="2" />
            <span class="rating-val">{{ pro.stats.averageRating.toFixed(1) }}</span>
            <span class="rating-count">{{ pro.stats.reviewCount }} avis</span>
          </div>
        </div>

        <!-- Prestations -->
        <section class="salon-section">
          <h2 class="section-title">Prestations</h2>

          <div v-if="servicesLoading" class="svc-loading">
            <Loader2 :size="22" class="spin" /> Chargement…
          </div>

          <div v-else-if="serviceGroups.length === 0" class="svc-empty">
            Aucune prestation renseignée pour l'instant.
          </div>

          <div v-else class="svc-groups">
            <div v-for="group in serviceGroups" :key="group.groupLabel" class="svc-group">
              <h3 class="svc-group-name">{{ group.groupLabel }}</h3>
              <div class="svc-list">
                <div v-for="svc in group.services" :key="svc._id" class="svc-row">
                  <div class="svc-info">
                    <span class="svc-name">{{ svc.name }}</span>
                    <span v-if="svc.description" class="svc-desc">{{ svc.description }}</span>
                  </div>
                  <div class="svc-meta">
                    <span class="svc-duration"><Clock :size="13" /> {{ formatDuration(svc.duration) }}</span>
                    <span class="svc-price">{{ svc.price.toFixed(2) }} €</span>
                    <button class="svc-book-btn" @click="bookService(svc)">Réserver</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Avis -->
        <section class="salon-section">
          <h2 class="section-title">Avis clients</h2>
          <div class="reviews-placeholder">
            <MessageSquare :size="32" />
            <p>Les avis seront disponibles prochainement.</p>
          </div>
        </section>

      </main>

      <!-- Colonne latérale -->
      <aside class="salon-aside">
        <div class="aside-card">
          <h3 class="aside-title">Informations</h3>
          <div class="aside-info">
            <MapPin :size="15" />
            <div>
              <p>{{ pro.address }}</p>
              <p>{{ pro.postalCode }} {{ pro.city }}</p>
            </div>
          </div>
          <div v-if="pro.socialLinks?.instagram" class="aside-info">
            <Instagram :size="15" />
            <a :href="`https://instagram.com/${pro.socialLinks.instagram}`" target="_blank">
              @{{ pro.socialLinks.instagram }}
            </a>
          </div>
        </div>

        <!-- Mini carte -->
        <div class="aside-map" id="salon-mini-map" ref="miniMapEl"></div>

        <button class="btn-rdv-main" @click="bookService(null)">
          <CalendarDays :size="16" /> Prendre RDV
        </button>
      </aside>
    </div>
  </div>

  <!-- Chargement page -->
  <div v-else-if="pageLoading" class="page-loading">
    <Loader2 :size="36" class="spin" />
  </div>

  <!-- Erreur -->
  <div v-else class="page-error">
    <p>Salon introuvable.</p>
    <router-link to="/recherche">Retour à la recherche</router-link>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  ArrowLeft, MapPin, Star, Clock, Loader2, MessageSquare,
  ImageOff, X, ChevronLeft, ChevronRight, Maximize2,
  CalendarDays, Instagram
} from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

interface Service { _id: string; name: string; description: string; duration: number; price: number }
interface ServiceGroup { groupLabel: string; services: Service[] }

const route  = useRoute()
const router = useRouter()
const toast  = useToast()

const pro            = ref<any>(null)
const pageLoading    = ref(true)
const serviceGroups  = ref<ServiceGroup[]>([])
const servicesLoading = ref(false)
const galleryIdx     = ref(0)
const lightbox       = reactive({ open: false, idx: 0 })
const miniMapEl      = ref<HTMLElement | null>(null)
let miniMap: L.Map | null = null

function photoUrl (filename: string) {
  return `/api/media/shops/${filename}`
}

function openLightbox (idx: number) {
  lightbox.idx  = idx
  lightbox.open = true
}

function formatDuration (min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60), m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function bookService (svc: Service | null) {
  toast.info('La prise de RDV arrive bientôt !')
}

async function fetchPro () {
  pageLoading.value = true
  try {
    const res  = await fetch(`/api/search/pros?proId=${route.params.id}`)
    // La route de recherche ne supporte pas proId direct → on utilise l'endpoint public services
    // On charge le pro depuis son profil public
    const resPro = await fetch(`/api/search/salon/${route.params.id}`)
    if (!resPro.ok) { pageLoading.value = false; return }
    const data = await resPro.json()
    pro.value = data.pro
  } catch {}
  finally { pageLoading.value = false }
}

async function fetchServices () {
  servicesLoading.value = true
  try {
    const res  = await fetch(`/api/services/pro/${route.params.id}`)
    const data = await res.json()
    serviceGroups.value = data.grouped || []
  } catch {}
  finally { servicesLoading.value = false }
}

function initMiniMap () {
  if (!miniMapEl.value || !pro.value?.location?.coordinates) return
  const [lng, lat] = pro.value.location.coordinates
  if (!lat && !lng) return

  miniMap = L.map(miniMapEl.value, { zoomControl: false, dragging: false, scrollWheelZoom: false })
    .setView([lat, lng], 15)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(miniMap)
  L.divIcon({ className: '', html: '<div class="map-pin"></div>', iconSize: [14, 14], iconAnchor: [7, 7] })
  L.marker([lat, lng], {
    icon: L.divIcon({ className: '', html: '<div class="map-pin map-pin--hl"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })
  }).addTo(miniMap)
}

onMounted(async () => {
  await fetchPro()
  await fetchServices()
  initMiniMap()
})

onBeforeUnmount(() => { miniMap?.remove(); miniMap = null })
</script>

<style scoped>
.salon-page { min-height: 100vh; background: #F8F5F2; font-family: "Poppins", sans-serif; }

/* Nav */
.salon-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.75rem 1.5rem; background: #fff; border-bottom: 1px solid #E4E0DC;
  position: sticky; top: 0; z-index: 100;
}
.back-btn {
  display: flex; align-items: center; gap: 0.4rem;
  background: none; border: none; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.85rem;
  font-weight: 600; color: #4F3942; transition: color 0.18s;
}
.back-btn:hover { color: #2C1810; }
.salon-logo img { height: 30px; }

/* Galerie */
.salon-gallery {
  display: grid; grid-template-columns: 1fr 180px;
  gap: 6px; height: 400px;
  background: #F0EBE8; overflow: hidden;
}
.gallery-main {
  position: relative; overflow: hidden; cursor: pointer;
}
.gallery-main__img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gallery-overlay {
  position: absolute; inset: 0; background: rgba(0,0,0,0);
  display: flex; align-items: center; justify-content: center;
  gap: 0.4rem; color: #fff; font-size: 0.85rem; font-weight: 600;
  transition: background 0.2s;
}
.gallery-main:hover .gallery-overlay { background: rgba(0,0,0,.25); }

.gallery-thumbs { display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
.gallery-thumb {
  flex: 1; overflow: hidden; cursor: pointer; opacity: 0.75;
  transition: opacity 0.18s;
}
.gallery-thumb.active, .gallery-thumb:hover { opacity: 1; }
.gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }

.gallery-placeholder {
  grid-column: 1/-1;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; gap: 0.5rem; color: #ccc;
}

/* Lightbox */
.lightbox {
  position: fixed; inset: 0; background: rgba(0,0,0,.92);
  display: flex; align-items: center; justify-content: center;
  z-index: 2000;
}
.lightbox-img { max-width: 90vw; max-height: 85vh; border-radius: 8px; }
.lightbox-close {
  position: absolute; top: 1rem; right: 1rem;
  background: rgba(255,255,255,.15); border: none; color: #fff;
  border-radius: 50%; width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.18s;
}
.lightbox-close:hover { background: rgba(255,255,255,.3); }
.lightbox-prev, .lightbox-next {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,.15); border: none; color: #fff;
  border-radius: 50%; width: 48px; height: 48px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.18s;
}
.lightbox-prev { left: 1.5rem; }
.lightbox-next { right: 1.5rem; }
.lightbox-prev:hover, .lightbox-next:hover { background: rgba(255,255,255,.3); }
.lightbox-count {
  position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%);
  color: rgba(255,255,255,.7); font-size: 0.85rem;
}

/* Contenu */
.salon-content {
  max-width: 1100px; margin: 0 auto;
  padding: 2rem 1.5rem;
  display: grid; grid-template-columns: 1fr 320px; gap: 2rem;
}

.salon-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  gap: 1rem; margin-bottom: 1.5rem;
}
.salon-name {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 2rem; font-weight: 700; color: #2C1810; margin: 0 0 0.5rem;
}
.salon-location {
  display: flex; align-items: center; gap: 0.35rem;
  color: #888; font-size: 0.88rem; margin: 0 0 0.5rem;
}
.salon-cats { display: flex; flex-wrap: wrap; gap: 0.35rem; }
.cat-badge {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; background: #EADAF3; color: #4F3942;
  border-radius: 20px; padding: 0.2rem 0.65rem;
}
.salon-rating {
  display: flex; flex-direction: column; align-items: center;
  background: #fff; border: 1px solid #E4E0DC; border-radius: 14px;
  padding: 0.75rem 1rem; flex-shrink: 0; color: #4F3942;
}
.rating-val { font-size: 1.5rem; font-weight: 800; line-height: 1; }
.rating-count { font-size: 0.72rem; color: #aaa; }

/* Sections */
.salon-section { margin-bottom: 2.5rem; }
.section-title {
  font-family: "Montserrat", sans-serif; font-size: 1.1rem;
  font-weight: 700; color: #2C1810; margin: 0 0 1rem;
  padding-bottom: 0.5rem; border-bottom: 2px solid #EADAF3;
}

/* Groupes services */
.svc-loading { display: flex; align-items: center; gap: 0.5rem; color: #aaa; }
.svc-empty   { color: #aaa; font-size: 0.88rem; }
.svc-groups  { display: flex; flex-direction: column; gap: 1.25rem; }
.svc-group   { background: #fff; border-radius: 14px; border: 1px solid #E4E0DC; overflow: hidden; }
.svc-group-name {
  font-family: "Montserrat", sans-serif; font-size: 0.88rem;
  font-weight: 700; color: #4F3942; margin: 0;
  padding: 0.75rem 1.25rem; background: #FDFBFA;
  border-bottom: 1px solid #F0EBE8;
}
.svc-list { padding: 0; }
.svc-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.85rem 1.25rem; border-bottom: 1px solid #F8F5F2; gap: 1rem;
}
.svc-row:last-child { border-bottom: none; }
.svc-info { flex: 1; }
.svc-name  { display: block; font-size: 0.9rem; font-weight: 500; color: #2C1810; }
.svc-desc  { display: block; font-size: 0.78rem; color: #aaa; margin-top: 0.15rem; }
.svc-meta  { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }
.svc-duration {
  display: flex; align-items: center; gap: 0.25rem;
  font-size: 0.78rem; color: #888;
}
.svc-price { font-size: 0.95rem; font-weight: 700; color: #4F3942; min-width: 56px; text-align: right; }
.svc-book-btn {
  background: #4F3942; color: #fff; border: none; border-radius: 8px;
  padding: 0.35rem 0.85rem; font-size: 0.75rem; font-weight: 700;
  font-family: "Montserrat", sans-serif; cursor: pointer; transition: background 0.18s;
}
.svc-book-btn:hover { background: #3a2830; }

/* Avis placeholder */
.reviews-placeholder {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.5rem; padding: 2rem; color: #ccc; text-align: center;
}

/* Aside */
.salon-aside { display: flex; flex-direction: column; gap: 1rem; }
.aside-card {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 14px; padding: 1.25rem;
}
.aside-title {
  font-family: "Montserrat", sans-serif; font-size: 0.88rem;
  font-weight: 700; color: #2C1810; margin: 0 0 0.75rem;
}
.aside-info {
  display: flex; gap: 0.6rem; font-size: 0.83rem; color: #555;
  margin-bottom: 0.6rem; align-items: flex-start;
}
.aside-info a { color: #4F3942; text-decoration: none; }
.aside-info a:hover { text-decoration: underline; }

.aside-map {
  height: 200px; border-radius: 14px; overflow: hidden;
  border: 1px solid #E4E0DC;
}

.btn-rdv-main {
  display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  width: 100%; padding: 0.9rem; background: #4F3942; color: #fff;
  border: none; border-radius: 12px; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.92rem; font-weight: 700;
  transition: background 0.18s;
}
.btn-rdv-main:hover { background: #3a2830; }

/* Page loading / error */
.page-loading, .page-error {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; height: 60vh; gap: 1rem;
  color: #aaa; font-size: 0.9rem;
}

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 768px) {
  .salon-gallery { grid-template-columns: 1fr; height: 260px; }
  .gallery-thumbs { display: none; }
  .salon-content { grid-template-columns: 1fr; }
  .salon-aside   { order: -1; }
}
</style>
