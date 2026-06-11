<template>
  <!-- ── Navbar ── -->
  <header class="navbar" :class="{ 'navbar--scrolled': scrolled }">
    <div class="navbar__inner">
      <RouterLink to="/" class="navbar__logo">
        <img src="@/assets/logo.svg" alt="C7'Beauty" />
      </RouterLink>

      <nav class="navbar__nav" aria-label="Navigation principale">
        <a href="#" class="nav-link">Lieu</a>
        <a href="#" class="nav-link">Prestation</a>
      </nav>

      <div class="navbar__actions">
        <RouterLink :to="clientLink" class="btn btn--ghost">
          {{ isClient ? 'Mon espace' : 'Espace Client' }}
        </RouterLink>
        <RouterLink :to="proLink" class="btn btn--primary">
          {{ isPro ? 'Espace Pro' : 'Devenir Pro' }}
        </RouterLink>
      </div>

      <button class="navbar__burger" @click="menuOpen = !menuOpen" :aria-expanded="menuOpen" aria-label="Menu">
        <span></span><span></span><span></span>
      </button>
    </div>

    <!-- Menu mobile -->
    <div class="navbar__mobile" :class="{ open: menuOpen }">
      <a href="#" class="nav-link" @click="menuOpen = false">Lieu</a>
      <a href="#" class="nav-link" @click="menuOpen = false">Prestation</a>
      <RouterLink :to="clientLink" class="btn btn--ghost" @click="menuOpen = false">
        {{ isClient ? 'Mon espace' : 'Espace Client' }}
      </RouterLink>
      <RouterLink :to="proLink" class="btn btn--primary" @click="menuOpen = false">
        {{ isPro ? 'Espace Pro' : 'Devenir Pro' }}
      </RouterLink>
    </div>
  </header>

  <main>
    <!-- ── Hero ── -->
    <section class="hero">
      <div class="hero__bg">
        <img :src="heroImg" alt="" class="hero__img" aria-hidden="true" />
        <div class="hero__overlay"></div>
      </div>
      <div class="hero__content">
        <p class="hero__slogan">Réservez, embellissez, partagez</p>
        <h1 class="hero__title">Réservez<br /><em>maintenant</em></h1>

        <!-- Search bar -->
        <form class="search-bar" @submit.prevent="handleSearch" role="search">
          <div class="search-bar__field search-bar__field--lieu">
            <MapPin class="search-bar__ico" :size="18" />
            <LieuAutocompleteInput
              ref="lieuInputRef"
              v-model="searchLieu"
              variant="home"
              placeholder="Lieu, ville, code postal…"
              aria-label="Lieu"
              @select="onLieuSelect"
            />
          </div>
          <div class="search-bar__sep" aria-hidden="true"></div>
          <div class="search-bar__field search-bar__field--prestation">
            <Sparkles class="search-bar__ico" :size="18" />
            <PrestationAutocompleteInput
              v-model="searchPrestation"
              variant="home"
              placeholder="Prestation (coiffure, ongles…)"
              aria-label="Prestation"
              @select="onPrestationSelect"
              @submit="submitSearch"
              @typing="onPrestationTyping"
            />
          </div>
          <button type="submit" class="search-bar__btn" aria-label="Rechercher">
            <Search :size="20" />
          </button>
        </form>
      </div>
    </section>

    <!-- ── Prestations ── -->
    <section class="section section--light" id="prestations">
      <div class="container">
        <h2 class="section__title">Découvrez les prestations</h2>
        <p class="section__sub">Coiffure, beauté, bien-être — trouvez le professionnel qu'il vous faut.</p>

        <div class="prestations-grid">
          <article class="prestation-card" v-for="p in prestations" :key="p.slug">
            <Sparkles class="prestation-card__icon" :size="32" :stroke-width="1.5" />
            <h3 class="prestation-card__label">{{ p.name }}</h3>
          </article>
        </div>

        <div class="section__cta">
          <a href="#" class="btn btn--outline btn--lg">DÉCOUVREZ TOUTES LES PRESTATIONS</a>
        </div>
      </div>
    </section>

    <!-- ── Pro du moment ── -->
    <section class="section section--ivory" id="pro-moment">
      <div class="container">
        <h2 class="section__title">Coiffeur du Moment</h2>

        <div class="pro-card">
          <div class="pro-card__badge">✦ À la une</div>
          <div class="pro-card__body">
            <h3 class="pro-card__name">Prince Barber</h3>
            <address class="pro-card__address">
              123 Avenue de la Paix<br />77000 Melun
            </address>
            <a href="#" class="btn btn--primary">Réserver</a>
          </div>
          <div class="pro-card__visual">
            <div class="pro-card__avatar">PB</div>
          </div>
        </div>
      </div>
    </section>
  </main>

  <!-- ── Footer ── -->
  <footer class="footer">
    <div class="container footer__inner">
      <div class="footer__brand">
        <img src="@/assets/logo.svg" alt="C7'Beauty" class="footer__logo" />
        <p class="footer__slogan">Réservez, embellissez, partagez</p>
      </div>

      <nav class="footer__links" aria-label="Liens footer">
        <a href="#">CGV / CGU</a>
        <a href="#">Mentions légales</a>
        <a href="#">Prestations</a>
        <a href="#">FAQ / Aide</a>
        <a href="#">Espace PRO</a>
        <a href="#">Espace Client</a>
        <a href="#">Devenir ambassadeur</a>
        <a href="#">À propos</a>
      </nav>
    </div>
    <p class="footer__copy">© {{ new Date().getFullYear() }} C7'Beauty — Tous droits réservés</p>
  </footer>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import heroImg from '@/assets/home-hero.jpg'
import { useAuthStore } from '@/stores/auth'
import { Sparkles, MapPin, Search } from 'lucide-vue-next'
import LieuAutocompleteInput from '@/components/LieuAutocompleteInput.vue'
import PrestationAutocompleteInput from '@/components/PrestationAutocompleteInput.vue'
import type { LieuSuggestion } from '@/composables/useLieuAutocomplete'
import type { PrestationSelectPayload } from '@/composables/usePrestationAutocomplete'

const authStore = useAuthStore()
const { isLoggedIn, isClient, isPro } = authStore

// Liens navbar intelligents selon le rôle connecté
const clientLink = computed(() => isClient ? '/espace-client' : '/login/client')
const proLink    = computed(() => isPro    ? '/espace-pro'    : '/login/pro')
const scrolled = ref(false)
const menuOpen = ref(false)
const searchLieu = ref('')
const searchPrestation = ref('')
const searchCategorySlug = ref<string | null>(null)
const searchLat = ref<number | null>(null)
const searchLng = ref<number | null>(null)
const lieuInputRef = ref<InstanceType<typeof LieuAutocompleteInput> | null>(null)

function onLieuSelect (s: LieuSuggestion) {
  searchLieu.value = s.label
  searchLat.value  = s.lat
  searchLng.value  = s.lng
}

function onPrestationSelect (payload: PrestationSelectPayload) {
  searchPrestation.value   = payload.label
  searchCategorySlug.value = payload.categorySlug || null
}

function onPrestationTyping () {
  searchCategorySlug.value = null
}

function onScroll() {
  scrolled.value = window.scrollY > 60
}

const router = useRouter()

function handleSearch() {
  submitSearch()
}

async function submitSearch () {
  if (searchLieu.value && !searchLat.value) {
    const trimmed = searchLieu.value.trim()
    let suggestion: LieuSuggestion | null = null
    if (/^\d{5}$/.test(trimmed)) {
      suggestion = await lieuInputRef.value?.resolvePostalCode(trimmed) ?? null
    } else {
      const list = await lieuInputRef.value?.fetchSuggestions(trimmed, { silent: true })
      suggestion = list?.[0] ?? null
    }
    if (suggestion) onLieuSelect(suggestion)
  }

  const params = new URLSearchParams()
  if (searchPrestation.value) params.set('q',    searchPrestation.value)
  if (searchCategorySlug.value) params.set('category', searchCategorySlug.value)
  if (searchLieu.value)       params.set('lieu',  searchLieu.value)
  if (searchLat.value)        params.set('lat',   String(searchLat.value))
  if (searchLng.value)        params.set('lng',   String(searchLng.value))
  router.push(`/recherche?${params.toString()}`)
}

// Catégories depuis l'API
interface ApiCategory { _id: string; name: string; slug: string }
const prestations = ref<ApiCategory[]>([])

async function fetchPrestations () {
  try {
    const res  = await fetch('/api/categories')
    const data = await res.json()
    prestations.value = data.data || []
  } catch {}
}

onMounted(async () => {
  window.addEventListener('scroll', onScroll)
  fetchPrestations()

  const client = authStore.user as { postalCode?: string } | null
  if (!searchLieu.value && client?.postalCode) {
    const suggestion = await lieuInputRef.value?.prefill(client.postalCode)
    if (suggestion) onLieuSelect(suggestion)
  }
})
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;600;700&family=Playfair+Display:ital,wght@0,700;1,700&family=Poppins:wght@300;400&display=swap');

:root {
  --color-prune:   #4F3942;
  --color-rose:    #D1A1C7;
  --color-lavande: #EADAF3;
  --color-ivoire:  #F8F5F2;
  --color-gris:    #E4E0DC;
  --color-noir:    #000000;
  --color-blanc:   #FFFFFF;

  --font-display: "Playfair Display", Georgia, serif;
  --font-ui:      "Montserrat", system-ui, sans-serif;
  --font-body:    "Poppins", system-ui, sans-serif;

  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --navbar-h: 72px;
}

*,
*::before,
*::after { box-sizing: border-box; margin: 0; padding: 0; }

html { font-size: 100%; scroll-behavior: smooth; }

body {
  font-family: var(--font-body);
  font-weight: 300;
  color: var(--color-noir);
  background: var(--color-blanc);
  overflow-x: hidden;
}
</style>

<style scoped>
/* ════════════════════════════════
   NAVBAR
════════════════════════════════ */
.navbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 100;
  height: var(--navbar-h);
  transition: background 0.35s ease, box-shadow 0.35s ease;
}

.navbar--scrolled {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(12px);
  box-shadow: 0 1px 0 rgba(79, 57, 66, 0.08);
}

.navbar__inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 100%;
  padding: 0 2rem;
  display: flex;
  align-items: center;
  gap: 2rem;
}

.navbar__logo img {
  height: 36px;
  width: auto;
  display: block;
  /* blanc sur hero, prune après scroll */
  filter: brightness(0) invert(1);
  transition: filter 0.35s ease;
}

.navbar--scrolled .navbar__logo img {
  filter: none;
}

.navbar__nav {
  display: flex;
  gap: 2rem;
  margin-left: auto;
}

.nav-link {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.9);
  text-decoration: none;
  transition: color 0.25s ease;
}

.navbar--scrolled .nav-link {
  color: var(--color-prune);
}

.nav-link:hover { color: var(--color-rose); }

.navbar__actions {
  display: flex;
  gap: 0.75rem;
  margin-left: 1rem;
}

.navbar__burger {
  display: none;
  flex-direction: column;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  margin-left: auto;
}

.navbar__burger span {
  display: block;
  width: 24px;
  height: 2px;
  background: white;
  border-radius: 2px;
  transition: background 0.3s;
}

.navbar--scrolled .navbar__burger span { background: var(--color-prune); }

/* Mobile nav */
.navbar__mobile {
  display: none;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem 2rem 2rem;
  background: white;
  border-top: 1px solid var(--color-gris);
}

.navbar__mobile.open { display: flex; }

/* ════════════════════════════════
   BUTTONS
════════════════════════════════ */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.5rem;
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  text-decoration: none;
  border-radius: 999px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.28s ease;
  white-space: nowrap;
}

.btn--primary {
  background: var(--color-prune);
  color: var(--color-blanc);
  border-color: var(--color-prune);
  box-shadow: 0 4px 14px rgba(79, 57, 66, 0.22);
}

.btn--primary:hover {
  background: var(--color-rose);
  border-color: var(--color-rose);
  box-shadow: 0 6px 18px rgba(209, 161, 199, 0.4);
}

.btn--ghost {
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  border-color: rgba(255, 255, 255, 0.6);
}

.btn--ghost:hover {
  background: rgba(255, 255, 255, 0.15);
  color: white;
}

.navbar--scrolled .btn--ghost {
  color: var(--color-prune);
  border-color: var(--color-prune);
}

.navbar--scrolled .btn--ghost:hover {
  background: var(--color-lavande);
}

.btn--outline {
  background: transparent;
  color: var(--color-prune);
  border-color: var(--color-prune);
}

.btn--outline:hover {
  background: var(--color-prune);
  color: var(--color-blanc);
}

.btn--lg {
  padding: 0.9rem 2.5rem;
  font-size: 0.9rem;
}

/* ════════════════════════════════
   HERO
════════════════════════════════ */
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
}

.hero__bg {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.hero__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    120deg,
    rgba(79, 57, 66, 0.72) 0%,
    rgba(79, 57, 66, 0.35) 55%,
    transparent 100%
  );
}

.hero__content {
  position: relative;
  z-index: 1;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: calc(var(--navbar-h) + 4rem) 2rem 6rem;
}

.hero__slogan {
  font-family: var(--font-ui);
  font-size: clamp(0.75rem, 1.8vw, 0.9rem);
  font-weight: 300;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--color-rose);
  margin-bottom: 1rem;
  opacity: 0;
  animation: fadeUp 0.8s var(--ease-out-expo) 0.3s forwards;
}

.hero__title {
  font-family: var(--font-display);
  font-size: clamp(3rem, 9vw, 6.5rem);
  font-weight: 700;
  line-height: 1.05;
  color: var(--color-blanc);
  margin-bottom: 2.5rem;
  opacity: 0;
  animation: fadeUp 0.9s var(--ease-out-expo) 0.5s forwards;
}

.hero__title em {
  font-style: italic;
  font-weight: 700;
  color: var(--color-rose);
}

.hero__content .btn {
  opacity: 0;
  animation: fadeUp 0.8s var(--ease-out-expo) 0.8s forwards;
}

/* ════════════════════════════════
   SEARCH BAR
════════════════════════════════ */
.search-bar {
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.97);
  border-radius: 999px;
  padding: 0.35rem 0.35rem 0.35rem 1.5rem;
  max-width: 640px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  gap: 0;
  overflow: visible;
  opacity: 0;
  animation: fadeUp 0.8s var(--ease-out-expo) 0.9s forwards;
}

.search-bar__field--lieu,
.search-bar__field--prestation {
  position: relative;
}

.search-bar__field {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex: 1;
  min-width: 0;
}

.search-bar__ico {
  color: var(--color-rose);
  flex-shrink: 0;
}

.search-bar__field input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-family: var(--font-body);
  font-size: 0.92rem;
  font-weight: 300;
  color: var(--color-noir);
  padding: 0.6rem 0;
}

.search-bar__field input::placeholder {
  color: #999;
}

.search-bar__sep {
  width: 1px;
  height: 24px;
  background: var(--color-gris);
  margin: 0 1rem;
  flex-shrink: 0;
}

.search-bar__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-prune);
  border: none;
  cursor: pointer;
  color: white;
  flex-shrink: 0;
  box-shadow: 0 4px 14px rgba(79, 57, 66, 0.3);
  transition: background 0.28s ease, transform 0.2s ease;
}

.search-bar__btn:hover {
  background: var(--color-rose);
  transform: scale(1.07);
}

/* icône dans la carte prestation */
.prestation-card__icon {
  color: var(--color-prune);
  margin-bottom: 0.75rem;
  transition: color 0.25s ease;
}

.prestation-card:hover .prestation-card__icon {
  color: var(--color-rose);
}

/* ════════════════════════════════
   SECTIONS
════════════════════════════════ */
.section {
  padding: 6rem 0;
}

.section--light { background: var(--color-blanc); }
.section--ivory { background: var(--color-ivoire); }

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem;
}

.section__title {
  font-family: var(--font-display);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 700;
  color: var(--color-prune);
  text-align: center;
  margin-bottom: 0.75rem;
}

.section__sub {
  font-family: var(--font-body);
  font-size: 1rem;
  font-weight: 300;
  color: var(--color-prune);
  opacity: 0.6;
  text-align: center;
  margin-bottom: 3rem;
}

.section__cta {
  text-align: center;
  margin-top: 3rem;
}

/* ── Prestations grid ── */
.prestations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.25rem;
}

.prestation-card {
  background: var(--color-ivoire);
  border: 1px solid var(--color-gris);
  border-radius: 16px;
  padding: 2rem 1rem;
  text-align: center;
  transition: box-shadow 0.28s ease, transform 0.28s ease;
  cursor: pointer;
}

.prestation-card:hover {
  box-shadow: 0 8px 28px rgba(79, 57, 66, 0.12);
  transform: translateY(-4px);
}


.prestation-card__label {
  font-family: var(--font-ui);
  font-size: 0.85rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  color: var(--color-prune);
}

/* ── Pro du moment ── */
.pro-card {
  position: relative;
  max-width: 640px;
  margin: 0 auto;
  background: var(--color-blanc);
  border-radius: 20px;
  padding: 2.5rem 2rem;
  box-shadow: 0 8px 40px rgba(79, 57, 66, 0.1);
  display: flex;
  align-items: center;
  gap: 2rem;
  overflow: hidden;
}

.pro-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 5px;
  height: 100%;
  background: linear-gradient(to bottom, var(--color-prune), var(--color-rose));
  border-radius: 5px 0 0 5px;
}

.pro-card__badge {
  position: absolute;
  top: 1rem; right: 1.25rem;
  font-family: var(--font-ui);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-rose);
}

.pro-card__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.pro-card__name {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-prune);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.pro-card__address {
  font-family: var(--font-body);
  font-size: 0.9rem;
  font-weight: 300;
  color: var(--color-prune);
  opacity: 0.65;
  font-style: normal;
  line-height: 1.6;
}

.pro-card__visual {
  flex-shrink: 0;
}

.pro-card__avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-prune), var(--color-rose));
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-ui);
  font-size: 1.3rem;
  font-weight: 700;
  color: white;
  letter-spacing: 0.05em;
}

/* ════════════════════════════════
   FOOTER
════════════════════════════════ */
.footer {
  background: var(--color-prune);
  padding: 4rem 0 2rem;
}

.footer__inner {
  display: flex;
  flex-wrap: wrap;
  gap: 3rem;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 3rem;
}

.footer__logo {
  height: 32px;
  width: auto;
  filter: brightness(0) invert(1);
  margin-bottom: 0.75rem;
}

.footer__slogan {
  font-family: var(--font-ui);
  font-size: 0.78rem;
  font-weight: 300;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
}

.footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 2rem;
}

.footer__links a {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 400;
  letter-spacing: 0.05em;
  color: rgba(255, 255, 255, 0.65);
  text-decoration: none;
  transition: color 0.25s ease;
}

.footer__links a:hover { color: var(--color-rose); }

.footer__copy {
  text-align: center;
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 300;
  color: rgba(255, 255, 255, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding-top: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding-left: 2rem;
  padding-right: 2rem;
}

/* ════════════════════════════════
   ANIMATIONS
════════════════════════════════ */
@keyframes fadeUp {
  from { opacity: 0; transform: translateY(1.5rem); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ════════════════════════════════
   RESPONSIVE
════════════════════════════════ */
@media (max-width: 768px) {
  .navbar__nav,
  .navbar__actions { display: none; }

  .navbar__burger { display: flex; }

  .hero__title { font-size: clamp(2.5rem, 12vw, 4rem); }

  .search-bar {
    flex-direction: column;
    border-radius: 20px;
    padding: 1rem 1.25rem;
    gap: 0.75rem;
    align-items: stretch;
  }

  .search-bar__sep {
    width: 100%;
    height: 1px;
    margin: 0;
  }

  .search-bar__btn {
    width: 100%;
    height: 44px;
    border-radius: 999px;
  }

  .pro-card { flex-direction: column; text-align: center; }
  .pro-card::before { width: 100%; height: 5px; }
  .pro-card__badge { position: static; }

  .footer__inner { flex-direction: column; gap: 2rem; }
}
</style>
