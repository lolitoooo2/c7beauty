<template>
  <AuthLayout>
    <div class="auth-form verify-pending">
      <div class="verify-icon">✉️</div>
      <h1 class="auth-form__title">Vérifiez votre email</h1>
      <p class="verify-text">
        Un email de confirmation a été envoyé à
        <strong>{{ email }}</strong>.
      </p>
      <p class="verify-text verify-text--muted">
        Cliquez sur le lien dans l'email pour activer votre compte et réserver vos prestations.
      </p>

      <p v-if="message" class="verify-success">{{ message }}</p>
      <p v-if="error" class="api-error">{{ error }}</p>

      <button type="button" class="btn-submit" :disabled="loading" @click="resend">
        {{ loading ? 'Envoi…' : 'Renvoyer l\'email' }}
      </button>

      <p class="auth-form__sub" style="margin-top:1.5rem">
        Déjà vérifié ?
        <RouterLink to="/login/client" class="auth-link">Se connecter</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AuthLayout from '@/components/AuthLayout.vue'

const route   = useRoute()
const email   = computed(() => String(route.query.email || ''))
const loading = ref(false)
const error   = ref('')
const message = ref('')

async function resend () {
  if (!email.value) {
    error.value = 'Email introuvable.'
    return
  }
  loading.value = true
  error.value = ''
  message.value = ''
  try {
    const res = await fetch('/api/auth/resend-verification', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ email: email.value })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur')
    message.value = data.message || 'Email renvoyé.'
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Erreur'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.verify-pending { text-align: center; }
.verify-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
.verify-text { font-size: 0.92rem; color: #555; line-height: 1.55; margin: 0 0 0.75rem; }
.verify-text--muted { color: #888; font-size: 0.85rem; }
.verify-success { color: #2e7d32; font-size: 0.88rem; margin-bottom: 1rem; }
.auth-form__title { font-family: "Playfair Display", Georgia, serif; font-size: 1.75rem; color: #4F3942; margin-bottom: 1rem; }
.api-error { color: #c0565b; font-size: 0.88rem; margin-bottom: 1rem; }
.btn-submit {
  width: 100%; padding: 0.85rem; background: #4F3942; color: #fff;
  border: none; border-radius: 999px; font-weight: 700; cursor: pointer;
}
.btn-submit:disabled { opacity: 0.65; cursor: not-allowed; }
.auth-link { color: #4F3942; font-weight: 600; }
</style>
