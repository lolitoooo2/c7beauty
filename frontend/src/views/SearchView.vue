<template>
  <div class="search-page">

    <!-- ── Header : logo + search bar + mon espace ── -->
    <header
      class="search-header"
      :class="{ 'search-header--focused': !!searchFocused }"
    >
      <div class="search-header__inner">
        <router-link to="/" class="search-logo">
          <img src="@/assets/logo.svg" alt="C7'Beauty" />
        </router-link>

        <div class="search-header__center">
          <div
            class="search-bar"
            :class="{ 'search-bar--focused': !!searchFocused }"
          >
            <div
              class="search-field search-field--prestation"
              :class="{ 'search-field--active': searchFocused === 'prestation' }"
              @focusin="setSearchFocus('prestation')"
            >
              <Search :size="16" class="search-icon" />
              <PrestationAutocompleteInput
                v-model="q"
                variant="search"
                placeholder="Prestation, salon…"
                aria-label="Prestation"
                @select="onPrestationSelect"
                @submit="onSearchSubmit"
                @typing="activeCategory = null"
                @dismiss="closeSearchFocus"
              />
            </div>
            <div class="search-divider" />
            <div
              class="search-field search-field--lieu"
              :class="{ 'search-field--active': searchFocused === 'lieu' }"
              @focusin="setSearchFocus('lieu')"
            >
              <MapPin :size="16" class="search-icon" />
              <LieuAutocompleteInput
                ref="lieuInputRef"
                v-model="lieu"
                variant="search"
                placeholder="Ville, code postal…"
                aria-label="Lieu"
                @select="selectLieu"
                @dismiss="closeSearchFocus"
              />
            </div>
            <button class="search-btn" type="button" @click="onSearchSubmit">
              <Search v-if="!searchFocused" :size="18" />
              <span v-else class="search-btn__label">Rechercher</span>
            </button>
          </div>

          <div v-show="!searchFocused" class="radius-control" title="Rayon de recherche">
            <SlidersHorizontal :size="15" />
            <input
              type="range" v-model.number="radius"
              :min="5" :max="50" :step="5"
              class="radius-slider"
              @change="doSearch"
            />
            <span class="radius-label">{{ radius }} km</span>
          </div>
        </div>

        <RouterLink :to="espaceLink" class="btn-espace">
          <User :size="16" />
          <span>{{ espaceLabel }}</span>
        </RouterLink>
      </div>

      <!-- Filtres catégories -->
      <div v-show="!searchFocused" class="filters-bar">
        <button
          class="filter-chip"
          :class="{ active: !activeCategory }"
          @click="setCategory(null)"
        >Tous</button>
        <button
          v-for="cat in categories"
          :key="cat.slug"
          class="filter-chip"
          :class="{ active: activeCategory === cat.slug }"
          @click="setCategory(cat.slug)"
        >{{ cat.name }}</button>
      </div>
    </header>

    <!-- ── Layout principal ── -->
    <div class="search-body" :class="{ 'search-body--locked': !!searchFocused }">

      <!-- Panel gauche : liste des cards -->
      <aside class="search-panel" ref="panelEl">
        <p v-if="!searched" class="panel-hint">
          Entrez une prestation et/ou un lieu pour commencer.
        </p>

        <div v-else-if="loading" class="panel-loading">
          <Loader2 :size="28" class="spin" />
          <span>Recherche en cours…</span>
        </div>

        <template v-else>
          <p class="panel-count">
            <strong>{{ total }}</strong> salon{{ total > 1 ? 's' : '' }} trouvé{{ total > 1 ? 's' : '' }}
          </p>

          <div v-if="pros.length === 0" class="panel-empty">
            <SearchX :size="36" />
            <p>Aucun salon dans cette zone.</p>
            <p class="panel-hint">Essayez d'élargir le rayon ou de changer de zone.</p>
          </div>

          <div v-else class="cards-list">
            <ProCard
              v-for="pro in pros"
              :key="pro._id"
              :pro="pro"
              :highlighted="hoveredId === pro._id"
              @hover="onCardHover"
              @select="goToSalon"
              :ref="el => { if (el) cardRefs[pro._id] = el as any }"
            />
          </div>

          <!-- Pagination -->
          <div v-if="pages > 1" class="pagination">
            <button
              v-for="p in pages"
              :key="p"
              class="page-btn"
              :class="{ active: p === page }"
              @click="goPage(p)"
            >{{ p }}</button>
          </div>
        </template>
      </aside>

      <!-- Carte Leaflet -->
      <div class="search-map">
        <div id="leaflet-map" ref="mapEl"></div>

        <!-- Badge "Rechercher ici" après déplacement -->
        <Transition name="fade">
          <button v-if="mapMoved" class="search-here-btn" @click="searchInView">
            <RefreshCw :size="14" /> Rechercher dans cette zone
          </button>
        </Transition>
      </div>

      <!-- Voile blur + clic pour fermer (au-dessus carte Leaflet + liste) -->
      <Transition name="fade">
        <div
          v-if="searchFocused"
          class="search-body__shield"
          aria-hidden="true"
          @click="closeSearchFocus"
        />
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, MapPin, Loader2, SlidersHorizontal,
  SearchX, RefreshCw, User
} from 'lucide-vue-next'
import ProCard from '@/components/ProCard.vue'
import LieuAutocompleteInput from '@/components/LieuAutocompleteInput.vue'
import PrestationAutocompleteInput from '@/components/PrestationAutocompleteInput.vue'
import { useAuthStore } from '@/stores/auth'
import type { LieuSuggestion } from '@/composables/useLieuAutocomplete'
import type { PrestationSelectPayload } from '@/composables/usePrestationAutocomplete'

// ── Types ────────────────────────────────────────────
interface Pro {
  _id: string; salonName: string; address: string; city: string
  postalCode: string; categories: string[]; shopPhotos: string[]
  stats: { averageRating: number; reviewCount: number }
  servicesPreview: any[]; serviceCount: number
  location: { coordinates: [number, number] }
}
interface Category { _id: string; name: string; slug: string }

// ── State ────────────────────────────────────────────
const router    = useRouter()
const route     = useRoute()
const authStore = useAuthStore()

const q              = ref((route.query.q as string) || '')
const lieu           = ref((route.query.lieu as string) || '')
const radius         = ref(Number(route.query.radius) || 10)
const activeCategory = ref<string | null>((route.query.category as string) || null)

const searchLat = ref<number | null>(route.query.lat ? Number(route.query.lat) : null)
const searchLng = ref<number | null>(route.query.lng ? Number(route.query.lng) : null)

const pros       = ref<Pro[]>([])
const total      = ref(0)
const page       = ref(1)
const pages      = ref(1)
const loading    = ref(false)
const searched   = ref(false)
const hoveredId  = ref<string | null>(null)
const mapMoved   = ref(false)

const categories = ref<Category[]>([])

const mapEl       = ref<HTMLElement | null>(null)
const panelEl     = ref<HTMLElement | null>(null)
const lieuInputRef = ref<InstanceType<typeof LieuAutocompleteInput> | null>(null)
const cardRefs    = reactive<Record<string, any>>({})

/** Champ actif : agrandit l'input + blur du fond */
const searchFocused = ref<'prestation' | 'lieu' | null>(null)

const espaceLink = computed(() => {
  if (authStore.isClient) return '/espace-client'
  if (authStore.isPro)    return '/espace-pro'
  return '/login/client'
})

const espaceLabel = computed(() => {
  if (authStore.isClient || authStore.isPro) return 'Mon espace'
  return 'Espace Client'
})

function setSearchFocus (field: 'prestation' | 'lieu') {
  searchFocused.value = field
}

function closeSearchFocus () {
  searchFocused.value = null
  ;(document.activeElement as HTMLElement | null)?.blur()
}

function onSearchSubmit () {
  closeSearchFocus()
  doSearch()
}

// ── Leaflet ──────────────────────────────────────────
let map     : L.Map | null = null
let markers : Record<string, L.Marker> = {}
let moveTimer: ReturnType<typeof setTimeout> | null = null
/** Ignore moveend/zoomend déclenchés par fitBounds, flyTo, etc. */
let suppressMapEvents = false

// Icônes personnalisées (évite le bug de chemin Vite + Leaflet)
function createPinIcon (highlighted = false) {
  return L.divIcon({
    className : '',
    html      : `<div class="map-pin${highlighted ? ' map-pin--hl' : ''}"></div>`,
    iconSize  : [14, 14],
    iconAnchor: [7, 7]
  })
}

function initMap () {
  if (!mapEl.value || map) return

  map = L.map(mapEl.value, { zoomControl: true }).setView(
    searchLat.value ? [searchLat.value, searchLng.value!] : [46.5, 2.2],
    searchLat.value ? 13 : 6
  )

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18
  }).addTo(map)

  // Recherche auto après déplacement/zoom utilisateur (debounced)
  map.on('moveend zoomend', () => {
    if (suppressMapEvents) {
      suppressMapEvents = false
      return
    }
    if (!searched.value) return
    mapMoved.value = true
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      if (mapMoved.value) searchInView()
    }, 800)
  })
}

function updateMarkers (options: { fitBounds?: boolean } = {}) {
  if (!map) return

  // Supprimer anciens markers
  Object.values(markers).forEach(m => m.remove())
  markers = {}

  for (const pro of pros.value) {
    const [lng, lat] = pro.location?.coordinates ?? [0, 0]
    if (!lat && !lng) continue

    const marker = L.marker([lat, lng], { icon: createPinIcon() })
      .addTo(map!)
      .bindTooltip(pro.salonName, { permanent: false, direction: 'top', offset: [0, -12] })

    // Hover marker → highlight card
    marker.on('mouseover', () => {
      hoveredId.value = pro._id
      scrollToCard(pro._id)
    })
    marker.on('mouseout', () => { hoveredId.value = null })
    marker.on('click', () => goToSalon(pro))

    markers[pro._id] = marker
  }

  // Ajuster la vue uniquement sur recherche explicite (pas après searchInView)
  if (!options.fitBounds) return

  const coords = pros.value
    .map(p => p.location?.coordinates)
    .filter(c => c && (c[0] || c[1]))
    .map(c => [c![1], c![0]] as [number, number])

  if (coords.length > 0) {
    suppressMapEvents = true
    map!.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 14 })
  }
}

function highlightMarker (id: string | null) {
  for (const [proId, marker] of Object.entries(markers)) {
    marker.setIcon(createPinIcon(proId === id))
  }
}

watch(hoveredId, highlightMarker)

// ── Recherche ────────────────────────────────────────
async function resolveLieuCoords () {
  if (!lieu.value.trim() || (searchLat.value && searchLng.value)) return

  let suggestion: LieuSuggestion | null = null
  const trimmed = lieu.value.trim()

  if (/^\d{5}$/.test(trimmed)) {
    suggestion = await lieuInputRef.value?.resolvePostalCode(trimmed) ?? null
  } else {
    const list = await lieuInputRef.value?.fetchSuggestions(trimmed, { silent: true })
    suggestion = list?.[0] ?? null
  }

  if (suggestion) {
    lieu.value      = suggestion.label
    searchLat.value = suggestion.lat
    searchLng.value = suggestion.lng
  }
}

async function doSearch (resetPage = true) {
  if (resetPage) page.value = 1
  await resolveLieuCoords()
  mapMoved.value = false
  searched.value = true
  loading.value  = true

  const params = new URLSearchParams()
  if (q.value)              params.set('q',        q.value)
  if (searchLat.value)      params.set('lat',       String(searchLat.value))
  if (searchLng.value)      params.set('lng',       String(searchLng.value))
  if (radius.value)         params.set('radius',    String(radius.value))
  if (activeCategory.value) params.set('category',  activeCategory.value)
  params.set('page',  String(page.value))
  params.set('limit', '30')

  // Sync URL
  router.replace({ query: {
    ...(q.value && { q: q.value }),
    ...(lieu.value && { lieu: lieu.value }),
    ...(searchLat.value && { lat: String(searchLat.value) }),
    ...(searchLng.value && { lng: String(searchLng.value) }),
    ...(radius.value !== 10 && { radius: String(radius.value) }),
    ...(activeCategory.value && { category: activeCategory.value })
  }})

  try {
    const res  = await fetch(`/api/search/pros?${params}`)
    const data = await res.json()
    pros.value  = data.data  || []
    total.value = data.total || 0
    pages.value = data.pages || 1
    await nextTick()
    updateMarkers({ fitBounds: resetPage })
  } catch {
    pros.value = []
  } finally {
    loading.value = false
  }
}

async function searchInView () {
  if (!map) return
  mapMoved.value = false
  searched.value = true
  loading.value  = true
  page.value     = 1

  const bounds = map.getBounds()
  const params = new URLSearchParams({
    swLat: String(bounds.getSouth()),
    swLng: String(bounds.getWest()),
    neLat: String(bounds.getNorth()),
    neLng: String(bounds.getEast()),
    limit: '30',
    page : '1'
  })
  if (q.value)              params.set('q',       q.value)
  if (activeCategory.value) params.set('category', activeCategory.value)

  try {
    const res  = await fetch(`/api/search/pros?${params}`)
    const data = await res.json()
    pros.value  = data.data  || []
    total.value = data.total || 0
    pages.value = data.pages || 1
    await nextTick()
    // Ne pas fitBounds ici : la vue est déjà celle choisie par l'utilisateur
    updateMarkers({ fitBounds: false })
  } catch {
    pros.value = []
  } finally {
    loading.value = false
  }
}

function selectLieu (s: LieuSuggestion) {
  lieu.value           = s.label
  searchLat.value      = s.lat
  searchLng.value      = s.lng
  closeSearchFocus()
  if (map) {
    suppressMapEvents = true
    map.flyTo([s.lat, s.lng], 13, { duration: 1 })
  }
  doSearch()
}

function onPrestationSelect (payload: PrestationSelectPayload) {
  q.value = payload.label
  activeCategory.value = payload.categorySlug || null
  closeSearchFocus()
  doSearch()
}

// ── Catégories filtres ───────────────────────────────
async function fetchCategories () {
  try {
    const res  = await fetch('/api/categories')
    const data = await res.json()
    categories.value = data.data || []
  } catch {}
}

function setCategory (slug: string | null) {
  activeCategory.value = slug
  doSearch()
}

// ── Navigation ───────────────────────────────────────
function goToSalon (pro: Pro) {
  router.push(`/salon/${pro._id}`)
}

function goPage (p: number) {
  page.value = p
  doSearch(false)
  panelEl.value?.scrollTo({ top: 0, behavior: 'smooth' })
}

function scrollToCard (id: string) {
  const el = cardRefs[id]?.$el
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

function onCardHover (id: string | null) {
  hoveredId.value = id
}

// ── Init ─────────────────────────────────────────────
onMounted(async () => {
  await fetchCategories()
  initMap()

  // Pré-remplir lieu depuis code postal client connecté
  const client = authStore.user as { postalCode?: string } | null
  if (!lieu.value && client?.postalCode) {
    const suggestion = await lieuInputRef.value?.prefill(client.postalCode)
    if (suggestion) {
      lieu.value      = suggestion.label
      searchLat.value = suggestion.lat
      searchLng.value = suggestion.lng
      if (map) {
        suppressMapEvents = true
        map.setView([suggestion.lat, suggestion.lng], 13, { animate: false })
      }
      doSearch()
      return
    }
  }

  doSearch()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<style>
/* Styles Leaflet globaux (non scoped) */
.map-pin {
  width: 14px; height: 14px; border-radius: 50%;
  background: #4F3942; border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,.3);
  transition: background 0.18s, transform 0.18s;
}
.map-pin--hl {
  background: #D1A1C7;
  transform: scale(1.6);
  border-color: #4F3942;
}
</style>

<style scoped>
* { box-sizing: border-box; }

.search-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  font-family: "Poppins", sans-serif;
  background: #F8F5F2;
}

/* ── Body ── */
.search-body {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
  position: relative;
}

.search-body--locked .search-panel,
.search-body--locked .search-map {
  filter: blur(7px);
  transition: filter 0.28s ease;
  pointer-events: none;
  user-select: none;
}

.search-body__shield {
  position: absolute;
  inset: 0;
  z-index: 900;
  background: rgba(248, 245, 242, 0.3);
  cursor: default;
}

/* ── Header ── */
.search-header {
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #E4E0DC;
  position: relative;
  z-index: 500;
  overflow: visible;
  transition: box-shadow 0.28s;
}

.search-header--focused {
  z-index: 600;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

.search-header__inner {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
}

.search-header__center {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.search-logo { flex-shrink: 0; }
.search-logo img { height: 32px; width: auto; display: block; }

.btn-espace {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 1rem;
  background: #4F3942;
  color: #fff;
  border-radius: 999px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.18s;
  white-space: nowrap;
}
.btn-espace:hover { background: #3a2830; }

/* ── Barre de recherche (dans le header) ── */
.search-bar {
  flex: 1;
  min-width: 0;
  max-width: 640px;
  display: flex;
  align-items: stretch;
  background: #F8F5F2;
  border: 1.5px solid #E4E0DC;
  border-radius: 999px;
  overflow: visible;
  transition: max-width 0.28s, min-height 0.28s, box-shadow 0.28s, border-color 0.28s, border-radius 0.28s;
  min-height: 42px;
}

.search-header--focused .search-bar,
.search-bar--focused {
  flex: 1;
  max-width: none;
  min-height: 54px;
  background: #fff;
  border-color: #D1A1C7;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.search-field {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0 0.85rem;
  position: relative;
  min-width: 0;
  transition: flex 0.28s, padding 0.28s, background 0.28s;
}

.search-field--lieu { border-left: 1px solid #E4E0DC; }

.search-field--active {
  flex: 1.3;
  background: rgba(255, 255, 255, 0.7);
  padding: 0.3rem 0.95rem;
}

.search-icon { color: #aaa; flex-shrink: 0; }
.search-field--active .search-icon { color: #4F3942; }

.search-field--active :deep(.prestation-autocomplete input),
.search-field--active :deep(.lieu-autocomplete input) {
  font-size: 0.95rem;
  font-weight: 500;
}

.search-divider {
  width: 1px;
  background: #E4E0DC;
  align-self: center;
  height: 24px;
  flex-shrink: 0;
}

.search-btn {
  background: #4F3942;
  color: #fff;
  border: none;
  padding: 0 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 0 999px 999px 0;
  transition: background 0.18s;
  flex-shrink: 0;
  min-width: 44px;
}

.search-bar--focused .search-btn {
  border-radius: 0 14px 14px 0;
  padding: 0 1.25rem;
}

.search-btn:hover { background: #3a2830; }

.search-btn__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
}

/* Dropdowns au-dessus du blur */
.search-header :deep(.lieu-autocomplete__dropdown),
.search-header :deep(.prestation-autocomplete__dropdown) {
  z-index: 700;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.14);
}

/* Slider rayon */
.radius-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #7A5570;
  font-size: 0.82rem;
  white-space: nowrap;
  flex-shrink: 0;
}
.radius-slider { width: 80px; accent-color: #4F3942; cursor: pointer; }
.radius-label  { font-weight: 700; color: #4F3942; min-width: 38px; }

/* Filtres catégories */
.filters-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0 1.5rem 0.75rem;
  scrollbar-width: none;
}
.filters-bar::-webkit-scrollbar { display: none; }

.filter-chip {
  flex-shrink: 0;
  border: 1.5px solid #E4E0DC;
  background: #fff;
  border-radius: 20px;
  padding: 0.3rem 0.9rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  transition: all 0.18s;
  white-space: nowrap;
}
.filter-chip:hover  { border-color: #D1A1C7; color: #4F3942; }
.filter-chip.active { background: #4F3942; border-color: #4F3942; color: #fff; }

.search-panel {
  width: 420px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 1rem;
  background: #F8F5F2;
  border-right: 1px solid #E4E0DC;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.panel-hint { color: #aaa; font-size: 0.85rem; text-align: center; margin: 2rem auto; }
.panel-loading {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem 0; color: #aaa; font-size: 0.88rem;
}
.panel-count { font-size: 0.82rem; color: #888; font-weight: 600; margin: 0; }
.panel-empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.5rem; padding: 3rem 0; color: #ccc;
}
.panel-empty p { margin: 0; font-size: 0.88rem; color: #aaa; }

.cards-list { display: flex; flex-direction: column; gap: 0.75rem; }

.pagination { display: flex; gap: 0.4rem; justify-content: center; padding: 0.5rem 0; }
.page-btn {
  width: 32px; height: 32px; border-radius: 8px;
  background: #fff; border: 1px solid #E4E0DC;
  font-size: 0.8rem; cursor: pointer; transition: all 0.18s;
}
.page-btn.active  { background: #4F3942; border-color: #4F3942; color: #fff; }
.page-btn:hover:not(.active) { border-color: #D1A1C7; }

.search-map {
  flex: 1;
  position: relative;
  overflow: hidden;
}
#leaflet-map { width: 100%; height: 100%; }

.search-here-btn {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  background: #fff; border: 1px solid #E4E0DC; border-radius: 20px;
  padding: 0.45rem 1.1rem; font-size: 0.8rem; font-weight: 700;
  font-family: "Montserrat", sans-serif; color: #4F3942;
  cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.12);
  display: flex; align-items: center; gap: 0.4rem; z-index: 100;
  transition: background 0.18s;
  pointer-events: auto;
}
.search-here-btn:hover { background: #F8F2F5; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.28s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .search-header__inner { flex-wrap: wrap; }
  .search-header__center { order: 3; width: 100%; }
  .radius-control { display: none; }
}

@media (max-width: 768px) {
  .search-body    { flex-direction: column; }
  .search-panel   { width: 100%; height: 45vh; border-right: none; border-bottom: 1px solid #E4E0DC; }
  .search-map     { height: 55vh; }
  .btn-espace span { display: none; }
}
</style>
