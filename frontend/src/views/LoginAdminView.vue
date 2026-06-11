<template>
  <div class="admin-login">
    <div class="admin-login__card">
      <img src="@/assets/logo.svg" alt="C7'Beauty" class="admin-login__logo" />
      <div class="admin-badge">Administration</div>
      <h1 class="admin-login__title">Accès réservé</h1>

      <form @submit.prevent="handleSubmit" novalidate>
        <div class="form-field">
          <label for="email">Email</label>
          <input id="email" v-model="form.email" type="email" placeholder="admin@c7beauty.fr"
            autocomplete="email" :class="{ error: errors.email }" />
          <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
        </div>

        <div class="form-field">
          <label for="password">Mot de passe</label>
          <div class="input-pass">
            <input id="password" v-model="form.password" :type="showPass ? 'text' : 'password'"
              placeholder="••••••••" autocomplete="current-password" :class="{ error: errors.password }" />
            <button type="button" class="pass-toggle" @click="showPass = !showPass">
              <EyeOff v-if="showPass" :size="16" /><Eye v-else :size="16" />
            </button>
          </div>
          <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
        </div>

        <p v-if="apiError" class="api-error">{{ apiError }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading">Connexion…</span>
          <span v-else>Accéder au panneau</span>
        </button>
      </form>

      <RouterLink to="/" class="back-link">← Retour au site</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Eye, EyeOff } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const showPass = ref(false)
const loading  = ref(false)
const apiError = ref('')
const form     = reactive({ email: '', password: '' })
const errors   = reactive<Record<string, string>>({})
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
  loading.value = true; apiError.value = ''
  try {
    const res  = await fetch('/api/auth/login/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(data.token, data.user, 'admin')
    toast.success('Bienvenue dans le panneau admin.')
    router.push('/admin')
  } catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'Identifiants incorrects'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.admin-login {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0d0b0f;
  padding: 2rem;
}

.admin-login__card {
  background: #1a1520;
  border: 1px solid rgba(209,161,199,0.15);
  border-radius: 20px;
  padding: 3rem 2.5rem;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.admin-login__logo {
  height: 36px;
  width: auto;
  margin: 0 auto 1.5rem;
  display: block;
  filter: brightness(0) invert(1);
}

.admin-badge {
  display: inline-block;
  font-family: "Montserrat", sans-serif;
  font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.2em; text-transform: uppercase;
  color: #D1A1C7;
  background: rgba(209,161,199,0.12);
  border: 1px solid rgba(209,161,199,0.25);
  padding: 0.3rem 1rem;
  border-radius: 999px;
  margin-bottom: 1rem;
}

.admin-login__title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.8rem; font-weight: 700;
  color: #f5f0eb;
  margin-bottom: 2rem;
}

.form-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; text-align: left; }

.form-field label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem; font-weight: 600;
  color: rgba(209,161,199,0.8); letter-spacing: 0.06em;
}

.form-field input {
  padding: 0.75rem 1rem;
  font-family: "Poppins", sans-serif; font-size: 0.9rem; font-weight: 300;
  color: #f5f0eb;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px; outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}
.form-field input:focus { border-color: #D1A1C7; box-shadow: 0 0 0 3px rgba(209,161,199,0.15); }
.form-field input.error { border-color: #c0565b; }

.input-pass { position: relative; }
.input-pass input { width: 100%; padding-right: 2.5rem; }
.pass-toggle {
  position: absolute; right: 0.75rem; top: 50%;
  transform: translateY(-50%);
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,0.3); display: flex; padding: 0;
}
.pass-toggle:hover { color: #D1A1C7; }
.field-error { font-size: 0.75rem; color: #e57373; }

.api-error {
  background: rgba(192,86,91,0.15); color: #e57373;
  border: 1px solid rgba(192,86,91,0.3);
  border-radius: 10px; padding: 0.75rem 1rem;
  font-size: 0.82rem; margin-bottom: 0.75rem;
}

.btn-submit {
  width: 100%; margin-top: 0.75rem; padding: 0.9rem;
  font-family: "Montserrat", sans-serif; font-size: 0.85rem;
  font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase;
  color: #0d0b0f; background: #D1A1C7;
  border: none; border-radius: 999px; cursor: pointer;
  transition: background 0.28s, transform 0.2s;
}
.btn-submit:hover:not(:disabled) { background: #e0bbd8; }
.btn-submit:active { transform: scale(0.98); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

.back-link {
  display: block; margin-top: 1.5rem;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem;
  color: rgba(255,255,255,0.25); text-decoration: none;
  transition: color 0.2s;
}
.back-link:hover { color: rgba(255,255,255,0.6); }
</style>
