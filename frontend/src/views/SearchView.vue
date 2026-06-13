<template>
  <div
    class="search-page"
    :class="{
      'search-page--mobile-map': isMobile && mobileView === 'map',
      'search-page--mobile-search': isMobile && !!mobileSearchMode
    }"
  >

    <!-- ── Header mobile (Planity) ── -->
    <header v-if="isMobile" class="mobile-header">
      <router-link to="/" class="mobile-header__menu" aria-label="Accueil">
        <Menu :size="22" />
      </router-link>
      <router-link to="/" class="mobile-header__logo">
        <img src="@/assets/logo.svg" alt="C7'Beauty" />
      </router-link>
      <RouterLink :to="espaceLink" class="mobile-header__user" aria-label="Mon espace">
        <User :size="18" />
      </RouterLink>
    </header>

    <!-- ── Header desktop ── -->
    <header
      v-else
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

    <!-- ── Barre récap mobile (vue liste / carte) ── -->
    <div
      v-if="isMobile && !mobileSearchMode"
      class="mobile-search-bar"
      @click="openMobileSummary"
    >
      <Search :size="18" class="mobile-search-bar__ico" />
      <div class="mobile-search-bar__text">
        <strong>{{ summaryPrestation }} • {{ summaryLieu }}</strong>
        <span>Rayon {{ radius }} km</span>
      </div>
      <Pencil :size="16" class="mobile-search-bar__edit" />
    </div>

    <!-- ── Chips mobile ── -->
    <div v-if="isMobile && !mobileSearchMode" class="mobile-chips">
      <button type="button" class="mobile-chip" @click="openMobilePrestation">
        <Tag :size="15" /> Prestations
      </button>
      <button
        type="button"
        class="mobile-chip"
        :class="{ 'mobile-chip--active': mobileView === 'map' }"
        @click="toggleMobileView"
      >
        <component :is="mobileView === 'map' ? List : Map" :size="15" />
        {{ mobileView === 'map' ? 'Liste' : 'Carte' }}
      </button>
      <button type="button" class="mobile-chip" @click="showMobileFilters = true">
        <SlidersHorizontal :size="15" /> Filtres
      </button>
    </div>

    <!-- ── Layout principal ── -->
    <div
      class="search-body"
      :class="{
        'search-body--locked': !isMobile && !!searchFocused,
        'search-body--mobile-list': isMobile && mobileView === 'list',
        'search-body--mobile-map': isMobile && mobileView === 'map'
      }"
    >

      <aside v-show="!isMobile || mobileView === 'list'" class="search-panel" ref="panelEl">
        <p v-if="!searched" class="panel-hint">
          Entrez une prestation et/ou un lieu pour commencer.
        </p>

        <div v-else-if="loading" class="panel-loading">
          <Loader2 :size="28" class="spin" />
          <span>Recherche en cours…</span>
        </div>

        <template v-else>
          <p v-if="isMobile" class="panel-title">Sélectionnez un salon</p>
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

      <div
        class="search-map"
        :class="{ 'search-map--mobile-full': isMobile && mobileView === 'map' }"
      >
        <div id="leaflet-map" ref="mapEl"></div>

        <Transition name="fade">
          <button v-if="mapMoved && (!isMobile || mobileView === 'map')" class="search-here-btn" @click="searchInView">
            <RefreshCw :size="14" /> Rechercher dans cette zone
          </button>
        </Transition>
      </div>

      <!-- Preview pro (mobile carte) -->
      <Transition name="slide-up">
        <article
          v-if="isMobile && mobileView === 'map' && selectedMapPro"
          class="mobile-map-preview"
          @click="goToSalon(selectedMapPro)"
        >
          <img
            v-if="selectedMapPro.shopPhotos?.[0]"
            :src="`/api/media/shops/${selectedMapPro.shopPhotos[0]}`"
            :alt="selectedMapPro.salonName"
            class="mobile-map-preview__img"
          />
          <div v-else class="mobile-map-preview__img mobile-map-preview__img--empty">
            <ImageOff :size="20" />
          </div>
          <div class="mobile-map-preview__body">
            <h3>{{ selectedMapPro.salonName }}</h3>
            <p>
              <MapPin :size="12" />
              {{ selectedMapPro.address }}, {{ selectedMapPro.postalCode }} {{ selectedMapPro.city }}
            </p>
          </div>
        </article>
      </Transition>

      <Transition name="fade">
        <div
          v-if="!isMobile && searchFocused"
          class="search-body__shield"
          aria-hidden="true"
          @click="closeSearchFocus"
        />
      </Transition>
    </div>

    <!-- ── Overlay recherche mobile (3 inputs) ── -->
    <Transition name="fade">
      <div v-if="isMobile && mobileSearchMode === 'summary'" class="mobile-overlay mobile-overlay--summary">
        <button type="button" class="mobile-overlay__close" @click="closeMobileSearch">
          <X :size="22" />
        </button>

        <button type="button" class="mobile-field" @click="openMobilePrestation">
          <Search :size="18" />
          <span>{{ summaryPrestation || 'Prestation, salon…' }}</span>
        </button>

        <button type="button" class="mobile-field" @click="openMobileLieu">
          <MapPin :size="18" />
          <span>{{ summaryLieu || 'Ville, code postal…' }}</span>
        </button>

        <div class="mobile-field mobile-field--static">
          <Clock :size="18" />
          <span>À tout moment</span>
        </div>

        <div class="mobile-chips mobile-chips--overlay">
          <button type="button" class="mobile-chip" @click="openMobilePrestation">
            <Tag :size="15" /> Prestations
          </button>
          <button type="button" class="mobile-chip" @click="switchToMapFromOverlay">
            <Map :size="15" /> Carte
          </button>
          <button type="button" class="mobile-chip" @click="showMobileFilters = true">
            <SlidersHorizontal :size="15" /> Filtres
          </button>
        </div>

        <button type="button" class="mobile-search-submit" @click="applyMobileSearch">
          Rechercher
        </button>
      </div>
    </Transition>

    <!-- ── Plein écran prestation ── -->
    <Transition name="slide-left">
      <div v-if="isMobile && mobileSearchMode === 'prestation'" class="mobile-fullscreen">
        <header class="mobile-fullscreen__head">
          <button type="button" @click="backToMobileSummary"><X :size="22" /></button>
          <span>Rechercher</span>
          <span class="mobile-fullscreen__spacer" />
        </header>

        <div class="mobile-fullscreen__input-wrap">
          <input
            ref="mobilePrestationInputRef"
            v-model="mobileDraftPrestation"
            type="search"
            placeholder="Nom du salon, prestations (coupe…)"
            autocomplete="off"
            @input="onMobilePrestationInput"
          />
          <Search :size="18" />
        </div>

        <p v-if="!mobileDraftPrestation.trim()" class="mobile-fullscreen__section">
          Recherches fréquentes
        </p>

        <ul class="mobile-fullscreen__list">
          <li
            v-for="s in mobilePrestationSuggestions"
            :key="s.id"
            @click="pickMobilePrestation(s)"
          >
            <img
              v-if="s.type === 'salon' && s.shopPhoto"
              :src="`/api/media/shops/${s.shopPhoto}`"
              :alt="s.label"
              class="mobile-fullscreen__thumb"
            />
            <component v-else :is="prestationIcon(s.type)" :size="16" />
            <div>
              <strong>{{ s.label }}</strong>
              <span v-if="s.sublabel">{{ s.sublabel }}</span>
            </div>
          </li>
        </ul>

        <div v-if="mobilePrestationLoading" class="mobile-fullscreen__loading">
          <Loader2 :size="22" class="spin" />
        </div>
      </div>
    </Transition>

    <!-- ── Plein écran lieu ── -->
    <Transition name="slide-left">
      <div v-if="isMobile && mobileSearchMode === 'lieu'" class="mobile-fullscreen">
        <header class="mobile-fullscreen__head">
          <button type="button" @click="backToMobileSummary"><X :size="22" /></button>
          <span>Lieu</span>
          <span class="mobile-fullscreen__spacer" />
        </header>

        <div class="mobile-fullscreen__input-wrap">
          <input
            ref="mobileLieuInputRef"
            v-model="mobileDraftLieu"
            type="search"
            placeholder="Ville, code postal…"
            autocomplete="off"
            @input="onMobileLieuInput"
          />
          <MapPin :size="18" />
        </div>

        <ul class="mobile-fullscreen__list">
          <li
            v-for="s in mobileLieuSuggestions"
            :key="s.id"
            @click="pickMobileLieu(s)"
          >
            <MapPin :size="16" />
            <div>
              <strong>{{ s.label }}</strong>
            </div>
          </li>
        </ul>

        <div v-if="mobileLieuLoading" class="mobile-fullscreen__loading">
          <Loader2 :size="22" class="spin" />
        </div>
      </div>
    </Transition>

    <!-- ── Filtres mobile (rayon) ── -->
    <Transition name="fade">
      <div v-if="showMobileFilters" class="mobile-filters-backdrop" @click.self="showMobileFilters = false">
        <div class="mobile-filters-sheet">
          <h3>Filtres</h3>
          <label class="mobile-filters__radius">
            Rayon de recherche : <strong>{{ radius }} km</strong>
            <input
              type="range" v-model.number="radius"
              :min="5" :max="50" :step="5"
              @change="doSearch"
            />
          </label>
          <button type="button" class="mobile-search-submit" @click="showMobileFilters = false">
            Appliquer
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRouter, useRoute, RouterLink } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  Search, MapPin, Loader2, SlidersHorizontal,
  SearchX, RefreshCw, User, Menu, Pencil, Map, List,
  X, Clock, Tag, Sparkles, Store, ImageOff
} from 'lucide-vue-next'
import ProCard from '@/components/ProCard.vue'
import LieuAutocompleteInput from '@/components/LieuAutocompleteInput.vue'
import PrestationAutocompleteInput from '@/components/PrestationAutocompleteInput.vue'
import { useAuthStore } from '@/stores/auth'
import { useLieuAutocomplete, type LieuSuggestion } from '@/composables/useLieuAutocomplete'
import {
  usePrestationAutocomplete,
  type PrestationSuggestion,
  type PrestationSelectPayload
} from '@/composables/usePrestationAutocomplete'

interface Pro {
  _id: string; salonName: string; address: string; city: string
  postalCode: string; categories: string[]; shopPhotos: string[]
  stats: { averageRating: number; reviewCount: number }
  servicesPreview: any[]; serviceCount: number
  location: { coordinates: [number, number] }
}
interface Category { _id: string; name: string; slug: string }

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

const mapEl        = ref<HTMLElement | null>(null)
const panelEl      = ref<HTMLElement | null>(null)
const lieuInputRef = ref<InstanceType<typeof LieuAutocompleteInput> | null>(null)
const cardRefs     = reactive<Record<string, any>>({})

const searchFocused = ref<'prestation' | 'lieu' | null>(null)

// ── Mobile ───────────────────────────────────────────
const MOBILE_BP = 768
const isMobile    = ref(typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BP : false)
const mobileView  = ref<'list' | 'map'>('list')
const mobileSearchMode = ref<null | 'summary' | 'prestation' | 'lieu'>(null)
const showMobileFilters = ref(false)
const selectedMapPro    = ref<Pro | null>(null)

const mobileDraftPrestation = ref('')
const mobileDraftLieu       = ref('')
const mobilePrestationInputRef = ref<HTMLInputElement | null>(null)
const mobileLieuInputRef       = ref<HTMLInputElement | null>(null)

const {
  suggestions: mobileLieuSuggestions,
  loading: mobileLieuLoading,
  debouncedFetch: debouncedMobileLieu,
  fetchSuggestions: fetchMobileLieu
} = useLieuAutocomplete()

const {
  suggestions: mobilePrestationSuggestions,
  salonLoading: mobilePrestationLoading,
  loadCategories: loadMobileCategories,
  refreshSuggestions: refreshMobilePrestation,
  debouncedRefresh: debouncedMobilePrestation,
  toPayload: toPrestationPayload
} = usePrestationAutocomplete()

const summaryPrestation = computed(() => {
  if (q.value.trim()) return q.value.trim()
  if (activeCategory.value) {
    const cat = categories.value.find(c => c.slug === activeCategory.value)
    if (cat) return cat.name
  }
  return 'Toutes prestations'
})

const summaryLieu = computed(() => lieu.value.trim() || 'Partout')

const espaceLink = computed(() => {
  if (authStore.isClient) return '/espace-client'
  if (authStore.isPro)    return '/espace-pro'
  return '/login/client'
})

const espaceLabel = computed(() => {
  if (authStore.isClient || authStore.isPro) return 'Mon espace'
  return 'Espace Client'
})

function checkMobile () {
  isMobile.value = window.innerWidth <= MOBILE_BP
}

function openMobileSummary () {
  mobileSearchMode.value = 'summary'
}

function closeMobileSearch () {
  mobileSearchMode.value = null
}

function backToMobileSummary () {
  mobileSearchMode.value = 'summary'
}

async function openMobilePrestation () {
  mobileDraftPrestation.value = q.value
  mobileSearchMode.value = 'prestation'
  await loadMobileCategories()
  await refreshMobilePrestation(mobileDraftPrestation.value)
  await nextTick()
  mobilePrestationInputRef.value?.focus()
}

async function openMobileLieu () {
  mobileDraftLieu.value = lieu.value
  mobileSearchMode.value = 'lieu'
  if (mobileDraftLieu.value.trim()) {
    await fetchMobileLieu(mobileDraftLieu.value)
  }
  await nextTick()
  mobileLieuInputRef.value?.focus()
}

function onMobilePrestationInput () {
  debouncedMobilePrestation(mobileDraftPrestation.value)
}

function onMobileLieuInput () {
  debouncedMobileLieu(mobileDraftLieu.value)
}

function pickMobilePrestation (s: PrestationSuggestion) {
  if (s.type === 'salon' && s.salonId) {
    router.push(`/salon/${s.salonId}`)
    closeMobileSearch()
    return
  }
  q.value = s.label
  activeCategory.value = s.categorySlug || null
  mobileSearchMode.value = 'summary'
}

function pickMobileLieu (s: LieuSuggestion) {
  lieu.value      = s.label
  searchLat.value = s.lat
  searchLng.value = s.lng
  mobileSearchMode.value = 'summary'
}

function applyMobileSearch () {
  closeMobileSearch()
  doSearch()
}

function switchToMapFromOverlay () {
  closeMobileSearch()
  mobileView.value = 'map'
  nextTick(() => {
    map?.invalidateSize()
    updateMarkers()
  })
}

function toggleMobileView () {
  mobileView.value = mobileView.value === 'list' ? 'map' : 'list'
  selectedMapPro.value = null
  nextTick(() => {
    map?.invalidateSize()
    if (mobileView.value === 'map') updateMarkers()
  })
}

function prestationIcon (type: PrestationSuggestion['type']) {
  if (type === 'category')    return Tag
  if (type === 'subcategory') return Sparkles
  return Store
}

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
let suppressMapEvents = false

function createPinIcon (highlighted = false) {
  if (isMobile.value) {
    return L.divIcon({
      className: '',
      html: `<div class="map-pin-mobile${highlighted ? ' map-pin-mobile--hl' : ''}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg></div>`,
      iconSize  : [40, 40],
      iconAnchor: [20, 20]
    })
  }
  return L.divIcon({
    className : '',
    html      : `<div class="map-pin${highlighted ? ' map-pin--hl' : ''}"></div>`,
    iconSize  : [14, 14],
    iconAnchor: [7, 7]
  })
}

function initMap () {
  if (!mapEl.value || map) return

  map = L.map(mapEl.value, { zoomControl: !isMobile.value }).setView(
    searchLat.value ? [searchLat.value, searchLng.value!] : [46.5, 2.2],
    searchLat.value ? 13 : 6
  )

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 18
  }).addTo(map)

  map.on('moveend zoomend', () => {
    if (suppressMapEvents) {
      suppressMapEvents = false
      return
    }
    if (!searched.value) return
    if (isMobile.value && mobileView.value !== 'map') return
    mapMoved.value = true
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(() => {
      if (mapMoved.value) searchInView()
    }, 800)
  })
}

function updateMarkers (options: { fitBounds?: boolean } = {}) {
  if (!map) return

  Object.values(markers).forEach(m => m.remove())
  markers = {}

  const highlightId = isMobile.value ? selectedMapPro.value?._id : hoveredId.value

  for (const pro of pros.value) {
    const [lng, lat] = pro.location?.coordinates ?? [0, 0]
    if (!lat && !lng) continue

    const marker = L.marker([lat, lng], { icon: createPinIcon(pro._id === highlightId) })
      .addTo(map!)

    if (!isMobile.value) {
      marker.bindTooltip(pro.salonName, { permanent: false, direction: 'top', offset: [0, -12] })
      marker.on('mouseover', () => {
        hoveredId.value = pro._id
        scrollToCard(pro._id)
      })
      marker.on('mouseout', () => { hoveredId.value = null })
    }

    marker.on('click', () => {
      if (isMobile.value) {
        selectedMapPro.value = pro
        updateMarkers()
      } else {
        goToSalon(pro)
      }
    })

    markers[pro._id] = marker
  }

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
  if (isMobile.value) return
  for (const [proId, marker] of Object.entries(markers)) {
    marker.setIcon(createPinIcon(proId === id))
  }
}

watch(hoveredId, highlightMarker)

watch(mobileView, () => {
  nextTick(() => {
    map?.invalidateSize()
  })
})

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
  selectedMapPro.value = null

  const params = new URLSearchParams()
  if (q.value)              params.set('q',        q.value)
  if (searchLat.value)      params.set('lat',       String(searchLat.value))
  if (searchLng.value)      params.set('lng',       String(searchLng.value))
  if (radius.value)         params.set('radius',    String(radius.value))
  if (activeCategory.value) params.set('category',  activeCategory.value)
  params.set('page',  String(page.value))
  params.set('limit', '30')

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
  selectedMapPro.value = null

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

function onResize () {
  const wasMobile = isMobile.value
  checkMobile()
  if (wasMobile !== isMobile.value) {
    mobileSearchMode.value = null
    mobileView.value = 'list'
    nextTick(() => {
      map?.invalidateSize()
      updateMarkers()
    })
  }
}

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', onResize)

  await fetchCategories()
  initMap()

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
  window.removeEventListener('resize', onResize)
  map?.remove()
  map = null
})
</script>

<style>
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
.map-pin-mobile {
  width: 40px; height: 40px; border-radius: 50%;
  background: #fff; border: none;
  box-shadow: 0 2px 10px rgba(0,0,0,.18);
  display: flex; align-items: center; justify-content: center;
  color: #4F3942;
  transition: background 0.18s, color 0.18s, transform 0.18s;
}
.map-pin-mobile--hl {
  background: #4F3942;
  color: #fff;
  transform: scale(1.08);
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

/* ── Desktop header ── */
.search-header {
  flex-shrink: 0;
  background: #fff;
  border-bottom: 1px solid #E4E0DC;
  position: relative;
  z-index: 500;
  overflow: visible;
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
  white-space: nowrap;
}

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
}

.search-field--lieu { border-left: 1px solid #E4E0DC; }
.search-field--active { flex: 1.3; background: rgba(255,255,255,.7); }
.search-icon { color: #aaa; flex-shrink: 0; }
.search-divider { width: 1px; background: #E4E0DC; height: 24px; flex-shrink: 0; }

.search-btn {
  background: #4F3942;
  color: #fff;
  border: none;
  padding: 0 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  border-radius: 0 999px 999px 0;
  flex-shrink: 0;
  min-width: 44px;
}

.search-btn__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
}

.radius-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #7A5570;
  font-size: 0.82rem;
  white-space: nowrap;
}
.radius-slider { width: 80px; accent-color: #4F3942; }
.radius-label  { font-weight: 700; color: #4F3942; min-width: 38px; }

.filters-bar {
  display: flex;
  gap: 0.5rem;
  overflow-x: auto;
  padding: 0 1.5rem 0.75rem;
  scrollbar-width: none;
}
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
  white-space: nowrap;
}
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

.panel-title {
  font-family: "Montserrat", sans-serif;
  font-size: 1.15rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0;
}

.panel-hint { color: #aaa; font-size: 0.85rem; text-align: center; margin: 2rem auto; }
.panel-loading {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.75rem; padding: 3rem 0; color: #aaa;
}
.panel-count { font-size: 0.82rem; color: #888; font-weight: 600; margin: 0; }
.panel-empty {
  display: flex; flex-direction: column; align-items: center;
  gap: 0.5rem; padding: 3rem 0; color: #ccc;
}
.cards-list { display: flex; flex-direction: column; gap: 0.75rem; }

.pagination { display: flex; gap: 0.4rem; justify-content: center; padding: 0.5rem 0; }
.page-btn {
  width: 32px; height: 32px; border-radius: 8px;
  background: #fff; border: 1px solid #E4E0DC;
  font-size: 0.8rem; cursor: pointer;
}
.page-btn.active { background: #4F3942; border-color: #4F3942; color: #fff; }

.search-map { flex: 1; position: relative; overflow: hidden; }
#leaflet-map { width: 100%; height: 100%; }

.search-here-btn {
  position: absolute; top: 12px; left: 50%; transform: translateX(-50%);
  background: #fff; border: 1px solid #E4E0DC; border-radius: 20px;
  padding: 0.45rem 1.1rem; font-size: 0.8rem; font-weight: 700;
  font-family: "Montserrat", sans-serif; color: #4F3942;
  cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.12);
  display: flex; align-items: center; gap: 0.4rem; z-index: 100;
}

/* ── Mobile header ── */
.mobile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  background: #fff;
  border-bottom: 1px solid #E4E0DC;
  flex-shrink: 0;
}

.mobile-header__menu,
.mobile-header__user {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  color: #4F3942;
  text-decoration: none;
  border-radius: 10px;
}

.mobile-header__user { background: #4F3942; color: #fff; }

.mobile-header__logo img { height: 28px; width: auto; display: block; }

/* ── Mobile search bar ── */
.mobile-search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin: 0.75rem 1rem 0;
  padding: 0.85rem 1rem;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0,0,0,.06);
  cursor: pointer;
}

.mobile-search-bar__ico { color: #7A5570; flex-shrink: 0; }
.mobile-search-bar__edit { color: #aaa; flex-shrink: 0; margin-left: auto; }

.mobile-search-bar__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.mobile-search-bar__text strong {
  font-size: 0.92rem;
  color: #2C1810;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mobile-search-bar__text span {
  font-size: 0.78rem;
  color: #999;
}

/* ── Mobile chips ── */
.mobile-chips {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  overflow-x: auto;
  flex-shrink: 0;
}

.mobile-chips--overlay { padding: 1rem 0 0; }

.mobile-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 0.9rem;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 999px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4F3942;
  cursor: pointer;
}

.mobile-chip--active {
  background: #F3EAF7;
  border-color: #D1A1C7;
}

/* ── Mobile body modes ── */
.search-body--mobile-list .search-map { display: none; }
.search-body--mobile-list .search-panel {
  width: 100%;
  border-right: none;
  flex: 1;
}

.search-body--mobile-map .search-panel { display: none; }

.search-map--mobile-full {
  position: absolute;
  inset: 0;
  z-index: 10;
}

/* ── Mobile map preview ── */
.mobile-map-preview {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: 1rem;
  z-index: 200;
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 4px 24px rgba(0,0,0,.15);
  cursor: pointer;
}

.mobile-map-preview__img {
  width: 72px;
  height: 72px;
  border-radius: 10px;
  object-fit: cover;
  flex-shrink: 0;
  background: #F3EAF7;
}

.mobile-map-preview__img--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ccc;
}

.mobile-map-preview__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.35rem;
}

.mobile-map-preview__body h3 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #2C1810;
}

.mobile-map-preview__body p {
  margin: 0;
  font-size: 0.78rem;
  color: #888;
  display: flex;
  align-items: flex-start;
  gap: 0.25rem;
  line-height: 1.35;
}

/* ── Mobile overlays ── */
.mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: #F0F0F0;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}

.mobile-overlay__close {
  align-self: flex-start;
  background: none;
  border: none;
  padding: 0.25rem;
  color: #4F3942;
  cursor: pointer;
  margin-bottom: 0.5rem;
}

.mobile-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 1rem 1.1rem;
  background: #fff;
  border: none;
  border-radius: 12px;
  font-family: "Poppins", sans-serif;
  font-size: 0.95rem;
  color: #2C1810;
  text-align: left;
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0,0,0,.04);
}

.mobile-field--static {
  cursor: default;
  color: #666;
}

.mobile-search-submit {
  margin-top: auto;
  width: 100%;
  padding: 0.95rem;
  background: #4F3942;
  color: #fff;
  border: none;
  border-radius: 12px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
}

/* ── Mobile fullscreen suggestions ── */
.mobile-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1100;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.mobile-fullscreen__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #E4E0DC;
}

.mobile-fullscreen__head button {
  background: none;
  border: none;
  color: #4F3942;
  cursor: pointer;
  padding: 0.25rem;
}

.mobile-fullscreen__head span {
  font-family: "Montserrat", sans-serif;
  font-weight: 700;
  font-size: 1rem;
}

.mobile-fullscreen__spacer { width: 30px; }

.mobile-fullscreen__input-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #E4E0DC;
}

.mobile-fullscreen__input-wrap input {
  flex: 1;
  border: none;
  outline: none;
  font-family: "Poppins", sans-serif;
  font-size: 0.95rem;
  color: #2C1810;
}

.mobile-fullscreen__section {
  padding: 1rem 1rem 0.5rem;
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #888;
}

.mobile-fullscreen__list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.mobile-fullscreen__list li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.95rem 1rem;
  border-bottom: 1px solid #F0F0F0;
  cursor: pointer;
}

.mobile-fullscreen__list li:active { background: #F8F2F5; }

.mobile-fullscreen__list strong {
  display: block;
  font-size: 0.92rem;
  font-weight: 500;
  color: #2C1810;
}

.mobile-fullscreen__list span {
  display: block;
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.1rem;
}

.mobile-fullscreen__thumb {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  flex-shrink: 0;
}

.mobile-fullscreen__loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #aaa;
}

/* ── Mobile filters sheet ── */
.mobile-filters-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0,0,0,.35);
  display: flex;
  align-items: flex-end;
}

.mobile-filters-sheet {
  width: 100%;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 1.25rem 1rem 1.5rem;
}

.mobile-filters-sheet h3 {
  margin: 0 0 1rem;
  font-family: "Montserrat", sans-serif;
}

.mobile-filters__radius {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 1rem;
}

.mobile-filters__radius input { width: 100%; accent-color: #4F3942; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.25s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-up-enter-active, .slide-up-leave-active { transition: transform 0.28s, opacity 0.28s; }
.slide-up-enter-from, .slide-up-leave-to { transform: translateY(100%); opacity: 0; }

.slide-left-enter-active, .slide-left-leave-active { transition: transform 0.28s; }
.slide-left-enter-from, .slide-left-leave-to { transform: translateX(100%); }

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 900px) {
  .search-header__inner { flex-wrap: wrap; }
  .search-header__center { order: 3; width: 100%; }
  .radius-control { display: none; }
}

@media (min-width: 769px) {
  .mobile-header,
  .mobile-search-bar,
  .mobile-chips,
  .mobile-overlay,
  .mobile-fullscreen,
  .mobile-filters-backdrop,
  .mobile-map-preview { display: none !important; }
}
</style>
