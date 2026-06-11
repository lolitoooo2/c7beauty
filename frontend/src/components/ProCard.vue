<template>
  <article
    class="pro-card"
    :class="{ highlighted }"
    @mouseenter="$emit('hover', pro._id)"
    @mouseleave="$emit('hover', null)"
    @click="$emit('select', pro)"
  >
    <!-- ── Carousel photos ── -->
    <div class="pro-card__gallery" @click.stop>
      <template v-if="pro.shopPhotos && pro.shopPhotos.length">
        <img
          :src="photoUrl(pro.shopPhotos[carouselIdx])"
          :alt="pro.salonName"
          class="pro-card__img"
          loading="lazy"
        />
        <!-- Flèches carousel -->
        <button
          v-if="pro.shopPhotos.length > 1"
          class="carousel-btn prev"
          @click="prev"
          :disabled="carouselIdx === 0"
        >
          <ChevronLeft :size="16" />
        </button>
        <button
          v-if="pro.shopPhotos.length > 1"
          class="carousel-btn next"
          @click="next"
          :disabled="carouselIdx === pro.shopPhotos.length - 1"
        >
          <ChevronRight :size="16" />
        </button>
        <!-- Dots -->
        <div v-if="pro.shopPhotos.length > 1" class="carousel-dots">
          <span
            v-for="(_, i) in pro.shopPhotos"
            :key="i"
            class="dot"
            :class="{ active: i === carouselIdx }"
          />
        </div>
      </template>
      <!-- Placeholder si pas de photos -->
      <div v-else class="pro-card__img-placeholder">
        <ImageOff :size="32" />
      </div>
    </div>

    <!-- ── Infos ── -->
    <div class="pro-card__body">
      <div class="pro-card__top">
        <h3 class="pro-card__name">{{ pro.salonName }}</h3>
        <!-- Note -->
        <div v-if="pro.stats?.averageRating" class="pro-card__rating">
          <Star :size="13" :stroke-width="2" />
          {{ pro.stats.averageRating.toFixed(1) }}
          <span class="pro-card__reviews">({{ pro.stats.reviewCount }})</span>
        </div>
      </div>

      <p class="pro-card__address">
        <MapPin :size="12" />
        {{ pro.address }}, {{ pro.city }}
      </p>

      <!-- Catégories chips -->
      <div class="pro-card__cats">
        <span v-for="cat in (pro.categories || []).slice(0, 3)" :key="cat" class="cat-chip">
          {{ cat }}
        </span>
      </div>

      <!-- Aperçu prestations -->
      <div v-if="pro.servicesPreview?.length" class="pro-card__services">
        <span v-for="svc in pro.servicesPreview" :key="svc._id" class="svc-pill">
          {{ svc.name }} <strong>{{ svc.price }}€</strong>
        </span>
        <span v-if="pro.serviceCount > 4" class="svc-more">
          +{{ pro.serviceCount - 4 }} autres
        </span>
      </div>

      <div class="pro-card__footer">
        <router-link :to="`/salon/${pro._id}`" class="btn-rdv" @click.stop>
          Voir le salon
        </router-link>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Star, MapPin, ChevronLeft, ChevronRight, ImageOff } from 'lucide-vue-next'

interface ServicePreview { _id: string; name: string; price: number; duration: number }
interface Pro {
  _id: string
  salonName: string
  address: string
  city: string
  postalCode: string
  categories: string[]
  shopPhotos: string[]
  stats: { averageRating: number; reviewCount: number }
  servicesPreview: ServicePreview[]
  serviceCount: number
  location: { coordinates: [number, number] }
}

const props = defineProps<{ pro: Pro; highlighted?: boolean }>()
defineEmits<{
  (e: 'hover', id: string | null): void
  (e: 'select', pro: Pro): void
}>()

const carouselIdx = ref(0)

function prev () { if (carouselIdx.value > 0) carouselIdx.value-- }
function next () {
  if (carouselIdx.value < (props.pro.shopPhotos?.length ?? 0) - 1) carouselIdx.value++
}

function photoUrl (filename: string) {
  return `/api/media/shops/${filename}`
}
</script>

<style scoped>
.pro-card {
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 16px;
  overflow: hidden;
  cursor: pointer;
  transition: box-shadow 0.22s, transform 0.22s, border-color 0.22s;
  font-family: "Poppins", sans-serif;
}
.pro-card:hover,
.pro-card.highlighted {
  box-shadow: 0 8px 30px rgba(79,57,66,.15);
  border-color: #D1A1C7;
  transform: translateY(-2px);
}

/* Gallery */
.pro-card__gallery {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: #F0EBE8;
}
.pro-card__img {
  width: 100%; height: 100%; object-fit: cover; display: block;
  transition: transform 0.4s ease;
}
.pro-card:hover .pro-card__img { transform: scale(1.03); }

.pro-card__img-placeholder {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #ccc;
}

/* Carousel controls */
.carousel-btn {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(255,255,255,.88); border: none; border-radius: 50%;
  width: 30px; height: 30px; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: #4F3942; box-shadow: 0 2px 8px rgba(0,0,0,.15);
  transition: background 0.18s;
  opacity: 0;
}
.pro-card:hover .carousel-btn { opacity: 1; }
.carousel-btn.prev { left: 8px; }
.carousel-btn.next { right: 8px; }
.carousel-btn:disabled { opacity: 0.3 !important; cursor: default; }

.carousel-dots {
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 4px;
}
.dot {
  width: 6px; height: 6px; border-radius: 50%;
  background: rgba(255,255,255,.55); transition: background 0.18s;
}
.dot.active { background: #fff; }

/* Body */
.pro-card__body { padding: 0.9rem 1rem 1rem; }

.pro-card__top {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 0.5rem; margin-bottom: 0.3rem;
}
.pro-card__name {
  font-family: "Montserrat", sans-serif;
  font-size: 0.95rem; font-weight: 700; color: #2C1810; margin: 0;
  line-height: 1.3;
}
.pro-card__rating {
  display: inline-flex; align-items: center; gap: 0.2rem;
  font-size: 0.8rem; font-weight: 700; color: #4F3942; flex-shrink: 0;
}
.pro-card__reviews { font-weight: 400; color: #aaa; font-size: 0.75rem; }

.pro-card__address {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.78rem; color: #888; margin: 0 0 0.6rem;
}

.pro-card__cats {
  display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.6rem;
}
.cat-chip {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; background: #F8F2F5; color: #7A5570;
  border-radius: 20px; padding: 0.15rem 0.55rem;
}

.pro-card__services {
  display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.75rem;
}
.svc-pill {
  font-size: 0.75rem; background: #F8F5F2; color: #555;
  border-radius: 8px; padding: 0.2rem 0.5rem;
}
.svc-pill strong { color: #4F3942; }
.svc-more { font-size: 0.72rem; color: #aaa; align-self: center; }

.pro-card__footer { display: flex; justify-content: flex-end; }

.btn-rdv {
  background: #4F3942; color: #fff; border-radius: 10px;
  padding: 0.45rem 1rem; font-size: 0.78rem; font-weight: 700;
  font-family: "Montserrat", sans-serif; text-decoration: none;
  transition: background 0.18s;
}
.btn-rdv:hover { background: #3a2830; }
</style>
