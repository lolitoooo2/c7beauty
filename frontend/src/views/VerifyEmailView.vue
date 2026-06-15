<template>
  <AuthLayout>
    <div class="auth-form verify-page">
      <div v-if="loading" class="verify-state">
        <Loader2 :size="36" class="spin" />
        <p>Vérification en cours…</p>
      </div>

      <div v-else-if="success" class="verify-state verify-state--ok">
        <CheckCircle2 :size="48" />
        <h1>Email vérifié !</h1>
        <p>Votre compte client est activé.</p>
        <RouterLink to="/espace-client" class="btn-submit btn-submit--link">
          Accéder à mon espace
        </RouterLink>
      </div>

      <div v-else class="verify-state verify-state--error">
        <CircleAlert :size="48" />
        <h1>Vérification impossible</h1>
        <p>{{ error }}</p>
        <RouterLink
          :to="{ path: '/verify-email/pending', query: email ? { email } : {} }"
          class="btn-submit btn-submit--link"
        >
          Renvoyer un email
        </RouterLink>
      </div>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { Loader2, CheckCircle2, CircleAlert } from 'lucide-vue-next'
import AuthLayout from '@/components/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'

const route     = useRoute()
const authStore = useAuthStore()

const loading = ref(true)
const success = ref(false)
const error   = ref('')
const email   = ref('')

onMounted(async () => {
  const token = String(route.query.token || '')
  if (!token) {
    loading.value = false
    error.value = 'Lien invalide.'
    return
  }

  try {
    const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Lien expiré ou invalide.')

    authStore.setSession(data.token, data.user, 'client')
    success.value = true
  } catch (err: unknown) {
    error.value = err instanceof Error ? err.message : 'Erreur'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.verify-page { min-height: 280px; }
.verify-state {
  display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.75rem;
  color: #555;
}
.verify-state h1 {
  font-family: "Playfair Display", Georgia, serif; font-size: 1.6rem; color: #4F3942; margin: 0.25rem 0;
}
.verify-state--ok { color: #2e7d32; }
.verify-state--error { color: #c0565b; }
.verify-state--error p { color: #666; }
.btn-submit {
  display: inline-block; margin-top: 0.5rem; padding: 0.85rem 1.5rem;
  background: #4F3942; color: #fff; border-radius: 999px; font-weight: 700; text-decoration: none;
}
.btn-submit--link { text-align: center; }
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
