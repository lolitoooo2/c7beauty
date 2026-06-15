<template>
  <AuthLayout>
    <div class="auth-form">
      <div class="auth-form__header">
        <h1 class="auth-form__title">Créer un compte</h1>
        <p class="auth-form__sub">
          Déjà inscrit ?
          <RouterLink to="/login" class="auth-link">Se connecter</RouterLink>
        </p>
      </div>

      <!-- OAuth -->
      <div class="oauth-group">
        <button type="button" class="oauth-btn" disabled>
          <GoogleIcon />
          Continuer avec Google
        </button>
        <button type="button" class="oauth-btn" disabled>
          <InstagramIcon />
          Continuer avec Instagram
        </button>
        <button type="button" class="oauth-btn" disabled>
          <FacebookIcon />
          Continuer avec Facebook
        </button>
      </div>

      <div class="auth-divider"><span>ou</span></div>

      <!-- Formulaire -->
      <form @submit.prevent="handleSubmit" novalidate>
        <div class="form-row">
          <div class="form-field">
            <label for="firstName">Prénom *</label>
            <input
              id="firstName"
              v-model="form.firstName"
              type="text"
              placeholder="Marie"
              autocomplete="given-name"
              :class="{ error: errors.firstName }"
            />
            <span v-if="errors.firstName" class="field-error">{{ errors.firstName }}</span>
          </div>
          <div class="form-field">
            <label for="lastName">Nom *</label>
            <input
              id="lastName"
              v-model="form.lastName"
              type="text"
              placeholder="Dupont"
              autocomplete="family-name"
              :class="{ error: errors.lastName }"
            />
            <span v-if="errors.lastName" class="field-error">{{ errors.lastName }}</span>
          </div>
        </div>

        <div class="form-field">
          <label for="email">Email *</label>
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

        <div class="form-row">
          <div class="form-field">
            <label for="phone">Téléphone *</label>
            <input
              id="phone"
              v-model="form.phone"
              type="tel"
              placeholder="06 12 34 56 78"
              autocomplete="tel"
              :class="{ error: errors.phone }"
            />
            <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
          </div>

          <div class="form-field">
            <label for="postalCode">Code postal <span class="optional">(optionnel)</span></label>
            <input
              id="postalCode"
              v-model="form.postalCode"
              type="text"
              placeholder="75001"
              maxlength="5"
              inputmode="numeric"
              autocomplete="postal-code"
              :class="{ error: errors.postalCode }"
            />
            <span v-if="errors.postalCode" class="field-error">{{ errors.postalCode }}</span>
          </div>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="password">Mot de passe *</label>
            <div class="input-pass">
              <input
                id="password"
                v-model="form.password"
                :type="showPass ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="new-password"
                :class="{ error: errors.password }"
              />
              <button type="button" class="pass-toggle" @click="showPass = !showPass" :aria-label="showPass ? 'Masquer' : 'Afficher'">
                <EyeOff v-if="showPass" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
            <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
          </div>
          <div class="form-field">
            <label for="confirmPassword">Confirmer *</label>
            <div class="input-pass">
              <input
                id="confirmPassword"
                v-model="form.confirmPassword"
                :type="showConfirm ? 'text' : 'password'"
                placeholder="••••••••"
                autocomplete="new-password"
                :class="{ error: errors.confirmPassword }"
              />
              <button type="button" class="pass-toggle" @click="showConfirm = !showConfirm" :aria-label="showConfirm ? 'Masquer' : 'Afficher'">
                <EyeOff v-if="showConfirm" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
            <span v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</span>
          </div>
        </div>

        <div class="form-field">
          <label for="birthdate">Date de naissance <span class="optional">(optionnel)</span></label>
          <input
            id="birthdate"
            v-model="form.birthdate"
            type="date"
            autocomplete="bday"
          />
        </div>

        <div class="form-field">
          <label for="referral">Code parrainage <span class="optional">(optionnel)</span></label>
          <input
            id="referral"
            v-model="form.referral"
            type="text"
            placeholder="EX : C7-XXXX"
          />
        </div>

        <!-- CGU -->
        <div class="form-check" :class="{ error: errors.cgu }">
          <input id="cgu" v-model="form.cgu" type="checkbox" />
          <label for="cgu">
            J'accepte les
            <a href="#" class="auth-link">Conditions Générales d'Utilisation</a>
            et la
            <a href="#" class="auth-link">Politique de confidentialité</a> *
          </label>
        </div>
        <span v-if="errors.cgu" class="field-error">{{ errors.cgu }}</span>

        <p v-if="apiError" class="api-error">{{ apiError }}</p>

        <button type="submit" class="btn-submit" :disabled="loading">
          <span v-if="loading">Création en cours…</span>
          <span v-else>Créer mon compte</span>
        </button>
      </form>

      <p class="auth-form__pro-link">
        Vous êtes un professionnel ?
        <RouterLink to="/register/pro" class="auth-link">Inscription Pro →</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Eye, EyeOff } from 'lucide-vue-next'
import AuthLayout from '@/components/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

// Icônes OAuth inline (SVG simples)
const GoogleIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>`
}

const InstagramIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f09433"/>
        <stop offset="25%" stop-color="#e6683c"/>
        <stop offset="50%" stop-color="#dc2743"/>
        <stop offset="75%" stop-color="#cc2366"/>
        <stop offset="100%" stop-color="#bc1888"/>
      </linearGradient>
    </defs>
    <rect width="24" height="24" rx="6" fill="url(#ig)"/>
    <circle cx="12" cy="12" r="4" stroke="white" stroke-width="1.8" fill="none"/>
    <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
  </svg>`
}

const FacebookIcon = {
  template: `<svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
  </svg>`
}

const showPass    = ref(false)
const showConfirm = ref(false)
const loading     = ref(false)
const apiError    = ref('')

const authStore = useAuthStore()
const router    = useRouter()
const toast     = useToast()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  postalCode: '',
  password: '',
  confirmPassword: '',
  birthdate: '',
  referral: '',
  cgu: false
})

const errors = reactive<Record<string, string>>({})

function validate(): boolean {
  Object.keys(errors).forEach(k => delete errors[k])
  if (!form.firstName.trim())         errors.firstName = 'Prénom requis'
  if (!form.lastName.trim())          errors.lastName  = 'Nom requis'
  if (!form.email.includes('@'))      errors.email     = 'Email invalide'
  if (form.phone.replace(/\s/g,'').length < 10) errors.phone = 'Téléphone invalide'
  if (form.postalCode && !/^\d{5}$/.test(form.postalCode)) errors.postalCode = '5 chiffres requis'
  if (form.password.length < 8)       errors.password  = '8 caractères minimum'
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Les mots de passe ne correspondent pas'
  if (!form.cgu)                      errors.cgu       = 'Vous devez accepter les CGU'
  return Object.keys(errors).length === 0
}

async function handleSubmit() {
  if (!validate()) return
  loading.value = true
  apiError.value = ''
  try {
    await authStore.registerClient({
      firstName:    form.firstName,
      lastName:     form.lastName,
      email:        form.email,
      phone:        form.phone,
      postalCode:   form.postalCode || undefined,
      password:     form.password,
      birthdate:    form.birthdate || undefined,
      referralCode: form.referral  || undefined
    })
    router.push({
      name  : 'verify-email-pending',
      query : { email: form.email }
    })
  } catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'Erreur lors de l\'inscription'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-form__header {
  margin-bottom: 1.75rem;
}

.auth-form__title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.9rem;
  font-weight: 700;
  color: #4F3942;
  margin-bottom: 0.4rem;
}

.auth-form__sub {
  font-size: 0.88rem;
  color: #888;
}

/* OAuth */
.oauth-group {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-bottom: 1.25rem;
}

.oauth-btn {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.7rem 1.25rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  color: #333;
  background: #fff;
  border: 1.5px solid #E4E0DC;
  border-radius: 999px;
  cursor: not-allowed;
  opacity: 0.6;
  transition: border-color 0.25s;
}

/* Divider */
.auth-divider {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin: 1.25rem 0;
  color: #ccc;
  font-size: 0.8rem;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #E4E0DC;
}

/* Fields */
.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  margin-bottom: 1rem;
}

.form-field label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  color: #4F3942;
  letter-spacing: 0.04em;
}

.optional {
  font-weight: 300;
  color: #aaa;
}

.form-field input {
  padding: 0.72rem 1rem;
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem;
  font-weight: 300;
  color: #111;
  background: #F8F5F2;
  border: 1.5px solid #E4E0DC;
  border-radius: 10px;
  outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.form-field input:focus {
  border-color: #D1A1C7;
  box-shadow: 0 0 0 3px rgba(209, 161, 199, 0.18);
}

.form-field input.error {
  border-color: #c0565b;
}

/* Password toggle */
.input-pass {
  position: relative;
}

.input-pass input {
  width: 100%;
  padding-right: 2.5rem;
}

.pass-toggle {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #aaa;
  display: flex;
  padding: 0;
}

.pass-toggle:hover { color: #4F3942; }

/* Checkbox */
.form-check {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.form-check input[type="checkbox"] {
  margin-top: 3px;
  accent-color: #4F3942;
  flex-shrink: 0;
}

.form-check label {
  font-size: 0.8rem;
  color: #555;
  line-height: 1.5;
}

.form-check.error label { color: #c0565b; }

.field-error {
  font-size: 0.75rem;
  color: #c0565b;
}

/* Submit */
.btn-submit {
  width: 100%;
  margin-top: 1.25rem;
  padding: 0.9rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #fff;
  background: #4F3942;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(79, 57, 66, 0.25);
  transition: background 0.28s ease, transform 0.2s ease;
}

.btn-submit:hover:not(:disabled) {
  background: #D1A1C7;
  box-shadow: 0 6px 18px rgba(209, 161, 199, 0.4);
}

.btn-submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.api-error {
  background: #fdecea;
  color: #c0565b;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  margin-top: 0.75rem;
  text-align: center;
}

.auth-link {
  color: #D1A1C7;
  font-weight: 500;
  text-decoration: none;
  transition: color 0.2s;
}

.auth-link:hover { color: #4F3942; }

.auth-form__pro-link {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.85rem;
  color: #888;
}

@media (max-width: 480px) {
  .form-row { grid-template-columns: 1fr; }
}
</style>
