<template>
  <AuthLayout>
    <div class="auth-form">
      <div class="auth-form__header">
        <h1 class="auth-form__title">Bon retour !</h1>
        <p class="auth-form__sub">
          Pas encore de compte ?
          <RouterLink to="/register/client" class="auth-link">S'inscrire</RouterLink>
        </p>
      </div>

      <!-- OAuth -->
      <div class="oauth-group">
        <button type="button" class="oauth-btn" disabled>
          <GoogleIcon /> Continuer avec Google
        </button>
        <button type="button" class="oauth-btn" disabled>
          <InstagramIcon /> Continuer avec Instagram
        </button>
        <button type="button" class="oauth-btn" disabled>
          <FacebookIcon /> Continuer avec Facebook
        </button>
      </div>

      <div class="auth-divider"><span>ou</span></div>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="form-field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="marie@email.com"
            autocomplete="email"
            :class="{ error: errors.email }"
          />
          <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
        </div>

        <div class="form-field">
          <div class="label-row">
            <label for="password">Mot de passe</label>
            <a href="#" class="forgot-link">Mot de passe oublié ?</a>
          </div>
          <div class="input-pass">
            <input
              id="password"
              v-model="form.password"
              :type="showPass ? 'text' : 'password'"
              placeholder="••••••••"
              autocomplete="current-password"
              :class="{ error: errors.password }"
            />
            <button type="button" class="pass-toggle" @click="showPass = !showPass">
              <EyeOff v-if="showPass" :size="16" /><Eye v-else :size="16" />
            </button>
          </div>
          <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
        </div>

        <p v-if="apiError" class="api-error">{{ apiError }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading">Connexion…</span>
          <span v-else>Se connecter</span>
        </button>
      </form>

      <p class="auth-form__pro-link">
        Vous êtes un professionnel ?
        <RouterLink to="/login/pro" class="auth-link">Espace Pro →</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { Eye, EyeOff } from 'lucide-vue-next'
import AuthLayout from '@/components/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const GoogleIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`
}
const InstagramIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="ig2" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f09433"/><stop offset="50%" stop-color="#dc2743"/><stop offset="100%" stop-color="#bc1888"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#ig2)"/><circle cx="12" cy="12" r="4" stroke="white" stroke-width="1.8" fill="none"/><circle cx="17.5" cy="6.5" r="1.2" fill="white"/></svg>`
}
const FacebookIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>`
}

const showPass = ref(false)
const loading  = ref(false)
const apiError = ref('')

const form   = reactive({ email: '', password: '' })
const errors = reactive<Record<string, string>>({})

const authStore = useAuthStore()
const router    = useRouter()
const route     = useRoute()
const toast     = useToast()

function validate() {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.email.includes('@')) errors.email    = 'Email invalide'
  if (!form.password)            errors.password = 'Mot de passe requis'
  return !Object.keys(errors).length
}

async function handleSubmit() {
  if (!validate()) return
  loading.value  = true
  apiError.value = ''
  try {
    const data = await authStore.login(form.email, form.password)
    if (data.role !== 'client') {
      authStore.logout()
      apiError.value = 'Ce compte est un espace Pro. Utilisez la connexion Pro.'
      return
    }
    toast.success(`Bon retour ${authStore.user?.firstName} ! 👋`)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.push(redirect && redirect.startsWith('/') ? redirect : '/espace-client')
  } catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'Identifiants incorrects'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-form__header { margin-bottom: 1.75rem; }
.auth-form__title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.9rem; font-weight: 700; color: #4F3942; margin-bottom: 0.4rem;
}
.auth-form__sub { font-size: 0.88rem; color: #888; }

.oauth-group { display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 1.25rem; }
.oauth-btn {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.7rem 1.25rem;
  font-family: "Montserrat", sans-serif; font-size: 0.85rem; font-weight: 500;
  color: #333; background: #fff;
  border: 1.5px solid #E4E0DC; border-radius: 999px;
  cursor: not-allowed; opacity: 0.6;
}

.auth-divider {
  display: flex; align-items: center; gap: 1rem;
  margin: 1.25rem 0; color: #ccc; font-size: 0.8rem;
}
.auth-divider::before, .auth-divider::after {
  content: ''; flex: 1; height: 1px; background: #E4E0DC;
}

.form-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.form-field label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.8rem; font-weight: 600; color: #4F3942; letter-spacing: 0.04em;
}

.label-row { display: flex; justify-content: space-between; align-items: center; }
.forgot-link {
  font-family: "Montserrat", sans-serif; font-size: 0.75rem; font-weight: 500;
  color: #D1A1C7; text-decoration: none; transition: color 0.2s;
}
.forgot-link:hover { color: #4F3942; }

.form-field input {
  padding: 0.72rem 1rem;
  font-family: "Poppins", sans-serif; font-size: 0.9rem; font-weight: 300; color: #111;
  background: #F8F5F2; border: 1.5px solid #E4E0DC; border-radius: 10px; outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}
.form-field input:focus { border-color: #D1A1C7; box-shadow: 0 0 0 3px rgba(209,161,199,0.18); }
.form-field input.error { border-color: #c0565b; }

.input-pass { position: relative; }
.input-pass input { width: 100%; padding-right: 2.5rem; }
.pass-toggle {
  position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #aaa; display: flex; padding: 0;
}
.pass-toggle:hover { color: #4F3942; }
.field-error { font-size: 0.75rem; color: #c0565b; }

.api-error {
  background: #fdecea; color: #c0565b; border-radius: 10px;
  padding: 0.75rem 1rem; font-size: 0.85rem; margin-bottom: 0.75rem; text-align: center;
}

.btn-submit {
  width: 100%; margin-top: 0.5rem; padding: 0.9rem;
  font-family: "Montserrat", sans-serif; font-size: 0.88rem;
  font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: #fff; background: #4F3942; border: none; border-radius: 999px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(79,57,66,0.25); transition: background 0.28s;
}
.btn-submit:hover:not(:disabled) { background: #D1A1C7; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.auth-link { color: #D1A1C7; font-weight: 500; text-decoration: none; }
.auth-link:hover { color: #4F3942; }
.auth-form__pro-link { text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: #888; }
</style>
