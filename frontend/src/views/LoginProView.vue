<template>
  <AuthLayout>
    <div class="auth-form">
      <div class="auth-form__header">
        <div class="pro-badge">Espace Professionnel</div>
        <h1 class="auth-form__title">Connexion Pro</h1>
        <p class="auth-form__sub">
          Pas encore inscrit ?
          <RouterLink to="/register/pro" class="auth-link">Devenir pro →</RouterLink>
        </p>
      </div>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="form-field">
          <label for="email">Email professionnel</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="pro@email.com"
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

        <!-- Info KYC -->
        <div class="kyc-info">
          <Info :size="14" />
          Si votre dossier est en cours de validation, vous pourrez consulter votre espace mais pas encore accepter des réservations.
        </div>

        <p v-if="apiError" class="api-error">{{ apiError }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading">Connexion…</span>
          <span v-else>Accéder à mon espace</span>
        </button>
      </form>

      <p class="auth-form__client-link">
        Vous êtes un client ?
        <RouterLink to="/login/client" class="auth-link">Espace Client →</RouterLink>
      </p>
      <p class="auth-form__client-link">
        Vous êtes collaborateur(trice) ?
        <RouterLink to="/login/collaborateur" class="auth-link">Connexion collaborateur →</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Eye, EyeOff, Info } from 'lucide-vue-next'
import AuthLayout from '@/components/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const showPass = ref(false)
const loading  = ref(false)
const apiError = ref('')

const form   = reactive({ email: '', password: '' })
const errors = reactive<Record<string, string>>({})

const authStore = useAuthStore()
const router    = useRouter()
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
    if (data.role !== 'pro') {
      authStore.logout()
      apiError.value = 'Ce compte est un espace Client. Utilisez la connexion Client.'
      return
    }
    toast.success(`Bienvenue ${authStore.user?.firstName} !`)
    router.push('/espace-pro')
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
  display: inline-block;
  font-family: "Montserrat", sans-serif;
  font-size: 0.7rem; font-weight: 700;
  letter-spacing: 0.15em; text-transform: uppercase;
  color: #D1A1C7; background: #EADAF3;
  padding: 0.3rem 0.9rem; border-radius: 999px;
  margin-bottom: 0.75rem;
}

.auth-form__title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.9rem; font-weight: 700; color: #4F3942; margin-bottom: 0.4rem;
}
.auth-form__sub { font-size: 0.88rem; color: #888; }

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

.kyc-info {
  display: flex; align-items: flex-start; gap: 0.5rem;
  background: #EADAF3; border-radius: 10px; padding: 0.75rem 1rem;
  font-size: 0.78rem; color: #4F3942; line-height: 1.5; margin-bottom: 1rem;
}

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
.auth-form__client-link { text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: #888; }
</style>
