<template>
  <AuthLayout>
    <div class="auth-form">
      <div class="auth-form__header">
        <div class="pro-badge">Espace Collaborateur</div>
        <h1 class="auth-form__title">Connexion</h1>
        <p class="auth-form__sub">Accédez à votre agenda depuis votre téléphone.</p>
      </div>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="form-field">
          <label for="email">Email</label>
          <input id="email" v-model="form.email" type="email" placeholder="marie@email.com" autocomplete="email" />
        </div>

        <div class="form-field">
          <label for="password">Mot de passe</label>
          <div class="input-pass">
            <input id="password" v-model="form.password" :type="showPass ? 'text' : 'password'" placeholder="••••••••" autocomplete="current-password" />
            <button type="button" class="pass-toggle" @click="showPass = !showPass">
              <EyeOff v-if="showPass" :size="16" /><Eye v-else :size="16" />
            </button>
          </div>
        </div>

        <p v-if="apiError" class="api-error">{{ apiError }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? 'Connexion…' : 'Accéder à mon agenda' }}
        </button>
      </form>

      <p class="auth-form__alt-link">
        Vous gérez le salon ?
        <RouterLink to="/login/pro" class="auth-link">Connexion Pro →</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { Eye, EyeOff } from 'lucide-vue-next'
import AuthLayout from '@/components/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const form = reactive({ email: '', password: '' })
const showPass = ref(false)
const loading  = ref(false)
const apiError = ref('')

const authStore = useAuthStore()
const router    = useRouter()
const toast     = useToast()

async function handleSubmit () {
  loading.value = true
  apiError.value = ''
  try {
    await authStore.loginCollaborator(form.email, form.password)
    toast.success(`Bonjour ${authStore.user?.firstName} !`)
    router.push('/espace-collaborateur')
  } catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'Identifiants incorrects'
  } finally {
    loading.value = false
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
.auth-form__sub { font-size: 0.88rem; color: #888; }
.form-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.form-field label { font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 600; color: #4F3942; }
.form-field input {
  padding: 0.72rem 1rem; font-family: "Poppins", sans-serif; font-size: 0.9rem;
  background: #F8F5F2; border: 1.5px solid #E4E0DC; border-radius: 10px; outline: none;
}
.input-pass { position: relative; }
.input-pass input { width: 100%; padding-right: 2.5rem; }
.pass-toggle { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #aaa; }
.api-error { background: #fdecea; color: #c0565b; border-radius: 10px; padding: 0.75rem 1rem; font-size: 0.85rem; margin-bottom: 0.75rem; text-align: center; }
.btn-submit {
  width: 100%; margin-top: 0.5rem; padding: 0.9rem;
  font-family: "Montserrat", sans-serif; font-size: 0.88rem; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase; color: #fff; background: #4F3942;
  border: none; border-radius: 999px; cursor: pointer;
}
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
.auth-link { color: #D1A1C7; font-weight: 500; text-decoration: none; }
.auth-link:hover { color: #4F3942; }
.auth-form__alt-link { text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: #888; }
</style>
