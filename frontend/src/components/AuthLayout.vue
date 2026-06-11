<template>
  <div class="auth-page">
    <!-- Colonne gauche : visuel brand -->
    <aside class="auth-aside" aria-hidden="true">
      <div class="auth-aside__overlay"></div>
      <img :src="heroImg" alt="" class="auth-aside__bg" />
      <div class="auth-aside__content">
        <RouterLink to="/">
          <img src="@/assets/logo.svg" alt="C7'Beauty" class="auth-aside__logo" />
        </RouterLink>
        <blockquote class="auth-aside__quote">
          Réservez, embellissez, partagez
        </blockquote>
      </div>
    </aside>

    <!-- Colonne droite : formulaire -->
    <main class="auth-main">
      <div class="auth-main__inner">
        <!-- Logo mobile -->
        <RouterLink to="/" class="auth-mobile-logo">
          <img src="@/assets/logo.svg" alt="C7'Beauty" />
        </RouterLink>

        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import heroImg from '@/assets/home-hero.jpg'
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
}

/* ── Aside ── */
.auth-aside {
  position: relative;
  overflow: hidden;
}

.auth-aside__bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}

.auth-aside__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    160deg,
    rgba(79, 57, 66, 0.78) 0%,
    rgba(209, 161, 199, 0.35) 100%
  );
  z-index: 1;
}

.auth-aside__content {
  position: relative;
  z-index: 2;
  padding: 2.5rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.auth-aside__logo {
  height: 36px;
  width: auto;
  filter: brightness(0) invert(1);
}

.auth-aside__quote {
  font-family: "Playfair Display", Georgia, serif;
  font-size: clamp(1.4rem, 2.5vw, 2rem);
  font-weight: 700;
  font-style: italic;
  color: white;
  line-height: 1.3;
  max-width: 22rem;
}

/* ── Main ── */
.auth-main {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem 2rem;
  overflow-y: auto;
}

.auth-main__inner {
  width: 100%;
  max-width: 440px;
}

.auth-mobile-logo {
  display: none;
  margin-bottom: 2rem;
}

.auth-mobile-logo img {
  height: 32px;
  width: auto;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .auth-page {
    grid-template-columns: 1fr;
  }

  .auth-aside {
    display: none;
  }

  .auth-mobile-logo {
    display: block;
  }
}
</style>
