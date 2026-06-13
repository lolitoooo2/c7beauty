<template>
  <AuthLayout>
    <div class="auth-form">
      <div v-if="loadingInvite" class="loading-box">
        <Loader2 :size="28" class="spin" /> Chargement…
      </div>

      <div v-else-if="inviteError" class="api-error">{{ inviteError }}</div>

      <template v-else-if="invite">
        <div class="auth-form__header">
          <div class="pro-badge">Invitation</div>
          <h1 class="auth-form__title">Bienvenue {{ invite.firstName }} !</h1>
          <p class="auth-form__sub">
            Activez votre accès collaborateur pour <strong>{{ invite.salonName }}</strong>.
          </p>
        </div>

        <form @submit.prevent="handleSubmit" novalidate>
          <div class="form-field">
            <label>Email</label>
            <input :value="invite.email" type="email" disabled />
          </div>

          <div class="form-field">
            <label for="password">Choisissez un mot de passe</label>
            <input id="password" v-model="password" type="password" minlength="8" placeholder="8 caractères minimum" />
          </div>

          <div class="form-field">
            <label for="password2">Confirmez le mot de passe</label>
            <input id="password2" v-model="password2" type="password" placeholder="••••••••" />
          </div>

          <p v-if="apiError" class="api-error">{{ apiError }}</p>

          <button type="submit" class="btn-submit" :disabled="submitting">
            {{ submitting ? 'Activation…' : 'Activer mon compte' }}
          </button>
        </form>
      </template>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2 } from 'lucide-vue-next'
import AuthLayout from '@/components/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

interface InviteInfo {
  firstName: string
  lastName: string
  email: string
  salonName: string
}

const route   = useRoute()
const router  = useRouter()
const authStore = useAuthStore()
const toast   = useToast()

const invite       = ref<InviteInfo | null>(null)
const loadingInvite = ref(true)
const inviteError  = ref('')
const password     = ref('')
const password2    = ref('')
const apiError     = ref('')
const submitting   = ref(false)

onMounted(async () => {
  try {
    const res  = await fetch(`/api/auth/invite/collaborator/${route.params.token}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    invite.value = data
  } catch (err: unknown) {
    inviteError.value = err instanceof Error ? err.message : 'Invitation invalide.'
  } finally {
    loadingInvite.value = false
  }
})

async function handleSubmit () {
  apiError.value = ''
  if (password.value.length < 8) {
    apiError.value = 'Mot de passe : 8 caractères minimum.'
    return
  }
  if (password.value !== password2.value) {
    apiError.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  submitting.value = true
  try {
    await authStore.acceptCollaboratorInvite(String(route.params.token), password.value)
    toast.success('Compte activé !')
    router.push('/espace-collaborateur')
  } catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'Erreur activation.'
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.auth-form__header { margin-bottom: 1.75rem; }
.pro-badge {
  display: inline-block; font-family: "Montserrat", sans-serif;
  font-size: 0.7rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;
  color: #D1A1C7; background: #EADAF3; padding: 0.3rem 0.9rem; border-radius: 999px; margin-bottom: 0.75rem;
}
.auth-form__title { font-family: "Playfair Display", Georgia, serif; font-size: 1.9rem; font-weight: 700; color: #4F3942; margin-bottom: 0.4rem; }
.auth-form__sub { font-size: 0.88rem; color: #888; line-height: 1.5; }
.form-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.form-field label { font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 600; color: #4F3942; }
.form-field input {
  padding: 0.72rem 1rem; font-family: "Poppins", sans-serif; font-size: 0.9rem;
  background: #F8F5F2; border: 1.5px solid #E4E0DC; border-radius: 10px; outline: none;
}
.form-field input:disabled { opacity: 0.7; }
.api-error { background: #fdecea; color: #c0565b; border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.85rem; margin-bottom: 0.75rem; text-align: center; }
.loading-box { display: flex; align-items: center; justify-content: center; gap: 0.75rem; padding: 2rem; color: #888; }
.btn-submit {
  width: 100%; margin-top: 0.5rem; padding: 0.9rem;
  font-family: "Montserrat", sans-serif; font-size: 0.88rem; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: #fff; background: #4F3942;
  border: none; border-radius: 999px; cursor: pointer;
}
.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
