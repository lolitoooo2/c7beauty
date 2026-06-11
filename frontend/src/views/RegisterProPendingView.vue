<template>
  <div class="pending-page">
    <div class="pending-card">
      <img src="@/assets/logo.svg" alt="C7'Beauty" class="pending-logo" />

      <div class="pending-icon">
        <Clock :size="40" />
      </div>

      <h1 class="pending-title">Demande envoyée !</h1>
      <p class="pending-text">
        Merci <strong>{{ user?.firstName }}</strong>. Votre dossier est bien reçu.<br />
        Notre équipe va le vérifier dans les <strong>48h</strong>.<br />
        Vous recevrez un email de confirmation dès validation.
      </p>

      <div class="pending-steps">
        <div class="ps-item done">
          <CheckCircle2 :size="18" />
          <span>Dossier soumis</span>
        </div>
        <div class="ps-line"></div>
        <div class="ps-item">
          <Clock :size="18" />
          <span>Vérification KYC</span>
        </div>
        <div class="ps-line"></div>
        <div class="ps-item">
          <Star :size="18" />
          <span>Compte actif</span>
        </div>
      </div>

      <RouterLink to="/" class="btn-home">Retour à l'accueil</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { Clock, CheckCircle2, Star } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const { user } = useAuthStore()
</script>

<style scoped>
.pending-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #F8F5F2 0%, #EADAF3 100%);
  padding: 2rem;
}

.pending-card {
  background: white;
  border-radius: 24px;
  padding: 3rem 2.5rem;
  max-width: 480px;
  width: 100%;
  text-align: center;
  box-shadow: 0 16px 48px rgba(79, 57, 66, 0.1);
}

.pending-logo {
  height: 32px;
  width: auto;
  margin: 0 auto 2rem;
  display: block;
}

.pending-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #EADAF3;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem;
  color: #4F3942;
}

.pending-title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.8rem;
  font-weight: 700;
  color: #4F3942;
  margin-bottom: 1rem;
}

.pending-text {
  font-family: "Poppins", sans-serif;
  font-size: 0.92rem;
  font-weight: 300;
  color: #555;
  line-height: 1.7;
  margin-bottom: 2rem;
}

/* Steps */
.pending-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-bottom: 2rem;
}

.ps-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  color: #ccc;
  font-family: "Montserrat", sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.ps-item.done { color: #4F3942; }

.ps-line {
  flex: 1;
  height: 2px;
  background: #E4E0DC;
  margin: 0 0.5rem;
  margin-bottom: 1.4rem;
}

.btn-home {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.9rem 2.5rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
  background: #4F3942;
  border-radius: 999px;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(79, 57, 66, 0.25);
  transition: background 0.28s;
}

.btn-home:hover { background: #D1A1C7; }
</style>
