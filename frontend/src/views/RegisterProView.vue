<template>
  <AuthLayout>
    <div class="auth-form">
      <div class="auth-form__header">
        <h1 class="auth-form__title">Inscription Pro</h1>
        <p class="auth-form__sub">
          Déjà inscrit ?
          <RouterLink to="/login/pro" class="auth-link">Se connecter →</RouterLink>
        </p>
      </div>

      <!-- Stepper -->
      <div class="stepper">
        <div v-for="(s, i) in steps" :key="i" class="stepper__item" :class="{ active: step === i, done: step > i }">
          <div class="stepper__dot">
            <Check v-if="step > i" :size="13" />
            <span v-else>{{ i + 1 }}</span>
          </div>
          <span class="stepper__label">{{ s }}</span>
          <div v-if="i < steps.length - 1" class="stepper__line"></div>
        </div>
      </div>

      <!-- ── Étape 1 : Infos perso ── -->
      <form v-if="step === 0" @submit.prevent="nextStep" novalidate>
        <div class="form-row">
          <div class="form-field">
            <label for="firstName">Prénom *</label>
            <input id="firstName" v-model="form.firstName" type="text" placeholder="Jean" autocomplete="given-name" :class="{ error: errors.firstName }" />
            <span v-if="errors.firstName" class="field-error">{{ errors.firstName }}</span>
          </div>
          <div class="form-field">
            <label for="lastName">Nom *</label>
            <input id="lastName" v-model="form.lastName" type="text" placeholder="Dupont" autocomplete="family-name" :class="{ error: errors.lastName }" />
            <span v-if="errors.lastName" class="field-error">{{ errors.lastName }}</span>
          </div>
        </div>

        <div class="form-field">
          <label for="email">Email professionnel *</label>
          <input id="email" v-model="form.email" type="email" placeholder="pro@email.com" autocomplete="email" :class="{ error: errors.email }" />
          <span v-if="errors.email" class="field-error">{{ errors.email }}</span>
        </div>

        <div class="form-field">
          <label for="phone">Téléphone *</label>
          <input id="phone" v-model="form.phone" type="tel" placeholder="06 12 34 56 78" autocomplete="tel" :class="{ error: errors.phone }" />
          <span v-if="errors.phone" class="field-error">{{ errors.phone }}</span>
        </div>

        <div class="form-row">
          <div class="form-field">
            <label for="password">Mot de passe *</label>
            <div class="input-pass">
              <input id="password" v-model="form.password" :type="showPass ? 'text' : 'password'" placeholder="••••••••" :class="{ error: errors.password }" />
              <button type="button" class="pass-toggle" @click="showPass = !showPass">
                <EyeOff v-if="showPass" :size="16" /><Eye v-else :size="16" />
              </button>
            </div>
            <span v-if="errors.password" class="field-error">{{ errors.password }}</span>
          </div>
          <div class="form-field">
            <label for="confirmPassword">Confirmer *</label>
            <div class="input-pass">
              <input id="confirmPassword" v-model="form.confirmPassword" :type="showConfirm ? 'text' : 'password'" placeholder="••••••••" :class="{ error: errors.confirmPassword }" />
              <button type="button" class="pass-toggle" @click="showConfirm = !showConfirm">
                <EyeOff v-if="showConfirm" :size="16" /><Eye v-else :size="16" />
              </button>
            </div>
            <span v-if="errors.confirmPassword" class="field-error">{{ errors.confirmPassword }}</span>
          </div>
        </div>

        <button type="submit" class="btn-submit">Suivant →</button>
      </form>

      <!-- ── Étape 2 : Établissement ── -->
      <form v-if="step === 1" @submit.prevent="nextStep" novalidate>

        <!-- Recherche auto-complétion SIRENE -->
        <div class="form-field company-search-wrap">
          <label for="companyQuery">Rechercher votre entreprise *</label>
          <div class="company-input" :class="{ error: errors.salonName, focused: companyFocused }">
            <Building2 :size="16" class="company-input__ico" />
            <input
              id="companyQuery"
              v-model="companyQuery"
              type="text"
              placeholder="Nom de société ou SIRET…"
              autocomplete="off"
              @input="onCompanyInput"
              @focus="companyFocused = true; showDropdown = true"
              @blur="onCompanyBlur"
            />
            <Loader2 v-if="loadingCompany" :size="16" class="company-input__spin" />
            <CheckCircle2 v-else-if="companySelected" :size="16" class="company-input__ok" />
          </div>
          <span v-if="errors.salonName" class="field-error">{{ errors.salonName }}</span>

          <!-- Dropdown résultats -->
          <transition name="dropdown">
            <ul
              v-if="showDropdown && companyResults.length"
              class="company-dropdown"
              role="listbox"
            >
              <li
                v-for="c in companyResults"
                :key="c.siret"
                class="company-result"
                role="option"
                @mousedown.prevent="selectCompany(c)"
              >
                <div class="company-result__name">{{ c.nom }}</div>
                <div class="company-result__meta">
                  <span class="badge-siret">SIRET {{ formatSiret(c.siret) }}</span>
                  <span>{{ c.adresse }}</span>
                </div>
              </li>
            </ul>
            <div v-else-if="showDropdown && companyQuery.length >= 3 && !loadingCompany && !companyResults.length" class="company-dropdown company-dropdown--empty">
              Aucune entreprise trouvée
            </div>
          </transition>
        </div>

        <!-- Champs pré-remplis (lecture seule si auto-rempli, sinon éditables) -->
        <div class="prefilled-grid" :class="{ 'is-filled': companySelected }">
          <div class="prefilled-grid__label">
            <Sparkles :size="13" />
            Informations pré-remplies automatiquement
          </div>

          <div class="form-field">
            <label for="salonName">Nom de l'entreprise *</label>
            <input id="salonName" v-model="form.salonName" type="text" placeholder="Beauty Studio" :class="{ error: errors.salonName }" />
          </div>

          <div class="form-field">
            <label for="siret">SIRET *</label>
            <input id="siret" v-model="form.siret" type="text" placeholder="14 chiffres" maxlength="18" :class="{ error: errors.siret }" />
            <span v-if="errors.siret" class="field-error">{{ errors.siret }}</span>
          </div>

          <div class="form-field">
            <label for="address">Adresse *</label>
            <input id="address" v-model="form.address" type="text" placeholder="12 rue de la Paix" :class="{ error: errors.address }" />
          </div>

          <div class="form-row">
            <div class="form-field">
              <label for="postalCode">Code postal *</label>
              <input id="postalCode" v-model="form.postalCode" type="text" placeholder="75001" :class="{ error: errors.postalCode }" />
            </div>
            <div class="form-field">
              <label for="city">Ville *</label>
              <input id="city" v-model="form.city" type="text" placeholder="Paris" :class="{ error: errors.city }" />
            </div>
          </div>
        </div>

        <!-- Catégories -->
        <div class="form-field">
          <label>Catégorie(s) de prestations *</label>
          <div v-if="categoriesLoading" class="cats-loading">Chargement…</div>
          <div v-else class="categories-grid">
            <label v-for="cat in categories" :key="cat.slug" class="category-chip" :class="{ selected: form.categories.includes(cat.slug) }">
              <input type="checkbox" :value="cat.slug" v-model="form.categories" class="visually-hidden" />
              {{ cat.name }}
            </label>
          </div>
          <span v-if="errors.categories" class="field-error">{{ errors.categories }}</span>
        </div>

        <div class="form-actions two">
          <button type="button" class="btn-back" @click="step--">← Retour</button>
          <button type="submit" class="btn-submit">Suivant →</button>
        </div>
      </form>

      <!-- ── Étape 3 : Documents & IBAN ── -->
      <form v-if="step === 2" @submit.prevent="handleSubmit" novalidate>
        <p class="step-info">
          <Info :size="15" />
          Vos documents sont vérifiés sous 48h. Votre compte sera actif après validation.
        </p>

        <div class="form-field">
          <label>Kbis ou justificatif d'activité *</label>
          <div class="file-drop" :class="{ filled: form.kbis }" @click="($refs.kbisInput as HTMLInputElement).click()">
            <Upload :size="18" />
            <span v-if="form.kbis">{{ (form.kbis as File).name }}</span>
            <span v-else>PDF, JPG — max 5 Mo</span>
          </div>
          <input ref="kbisInput" type="file" accept=".pdf,.jpg,.jpeg,.png" class="visually-hidden" @change="onFile('kbis', $event)" />
          <span v-if="errors.kbis" class="field-error">{{ errors.kbis }}</span>
        </div>

        <div class="form-field">
          <label>Pièce d'identité *</label>
          <div class="file-drop" :class="{ filled: form.idCard }" @click="($refs.idInput as HTMLInputElement).click()">
            <Upload :size="18" />
            <span v-if="form.idCard">{{ (form.idCard as File).name }}</span>
            <span v-else>PDF, JPG — max 5 Mo</span>
          </div>
          <input ref="idInput" type="file" accept=".pdf,.jpg,.jpeg,.png" class="visually-hidden" @change="onFile('idCard', $event)" />
          <span v-if="errors.idCard" class="field-error">{{ errors.idCard }}</span>
        </div>

        <div class="form-field">
          <label for="iban">IBAN (pour vos versements) *</label>
          <input id="iban" v-model="form.iban" type="text" placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX" :class="{ error: errors.iban }" />
          <span v-if="errors.iban" class="field-error">{{ errors.iban }}</span>
        </div>

        <div class="form-check" :class="{ error: errors.cgu }">
          <input id="cgu" v-model="form.cgu" type="checkbox" />
          <label for="cgu">
            J'accepte les <a href="#" class="auth-link">CGU</a>,
            <a href="#" class="auth-link">conditions Pro</a>
            et la <a href="#" class="auth-link">Politique de confidentialité</a> *
          </label>
        </div>
        <span v-if="errors.cgu" class="field-error">{{ errors.cgu }}</span>

        <p v-if="apiError" class="api-error">{{ apiError }}</p>

        <div class="form-actions two">
          <button type="button" class="btn-back" @click="step--">← Retour</button>
          <button type="submit" class="btn-submit" :disabled="loading">
            <span v-if="loading">Envoi…</span>
            <span v-else>Soumettre ma demande</span>
          </button>
        </div>
      </form>

      <p class="auth-form__client-link">
        Vous êtes un client ?
        <RouterLink to="/register/client" class="auth-link">Inscription Client →</RouterLink>
      </p>
    </div>
  </AuthLayout>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  Eye, EyeOff, Check, CheckCircle2, Upload, Info, Building2, Loader2
} from 'lucide-vue-next'
import AuthLayout from '@/components/AuthLayout.vue'
import { useAuthStore } from '@/stores/auth'

// ── Types ──────────────────────────────────────
interface CompanyResult {
  nom: string
  siret: string
  adresse: string
  codePostal: string
  ville: string
}

// ── State ──────────────────────────────────────
const step         = ref(0)
const showPass     = ref(false)
const showConfirm  = ref(false)
const loading      = ref(false)
const apiError     = ref('')

const authStore = useAuthStore()
const router    = useRouter()

onMounted(fetchCategories)

const companyQuery    = ref('')
const companyResults  = ref<CompanyResult[]>([])
const companyFocused  = ref(false)
const companySelected = ref(false)
const showDropdown    = ref(false)
const loadingCompany  = ref(false)

const steps = ['Infos perso', 'Établissement', 'Documents']

// Catégories chargées depuis l'API
interface ApiCategory { _id: string; name: string; slug: string; icon: string }
const categories       = ref<ApiCategory[]>([])
const categoriesLoading = ref(false)

async function fetchCategories () {
  categoriesLoading.value = true
  try {
    const res = await fetch('/api/categories')
    const data = await res.json()
    categories.value = data.data || []
  } catch {}
  finally { categoriesLoading.value = false }
}

const form = reactive({
  firstName: '', lastName: '', email: '', phone: '',
  password: '', confirmPassword: '',
  salonName: '', siret: '', address: '', city: '', postalCode: '',
  categories: [] as string[],
  kbis: null as File | null,
  idCard: null as File | null,
  iban: '',
  cgu: false
})

const errors = reactive<Record<string, string>>({})

// ── SIRENE autocomplete ─────────────────────────
let debounceTimer: ReturnType<typeof setTimeout>

async function onCompanyInput() {
  companySelected.value = false
  showDropdown.value = true
  clearTimeout(debounceTimer)

  if (companyQuery.value.length < 3) {
    companyResults.value = []
    return
  }

  debounceTimer = setTimeout(async () => {
    loadingCompany.value = true
    try {
      const q = encodeURIComponent(companyQuery.value)
      const res = await fetch(
        `https://recherche-entreprises.api.gouv.fr/search?q=${q}&page=1&per_page=6`
      )
      const data = await res.json()

      companyResults.value = (data.results ?? []).map((r: any) => ({
        nom: r.nom_complet ?? r.nom_raison_sociale ?? '',
        siret: r.siege?.siret ?? '',
        adresse: [r.siege?.adresse, r.siege?.code_postal, r.siege?.libelle_commune]
          .filter(Boolean).join(' '),
        codePostal: r.siege?.code_postal ?? '',
        ville: r.siege?.libelle_commune ?? ''
      })).filter((c: CompanyResult) => c.siret)
    } catch {
      companyResults.value = []
    } finally {
      loadingCompany.value = false
    }
  }, 320)
}

function selectCompany(c: CompanyResult) {
  companyQuery.value    = c.nom
  form.salonName        = c.nom
  form.siret            = c.siret
  form.address          = c.adresse.replace(c.codePostal, '').replace(c.ville, '').trim()
  form.postalCode       = c.codePostal
  form.city             = c.ville

  companyResults.value  = []
  showDropdown.value    = false
  companySelected.value = true
}

function onCompanyBlur() {
  companyFocused.value = false
  setTimeout(() => { showDropdown.value = false }, 150)
}

function formatSiret(s: string) {
  return s.replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, '$1 $2 $3 $4')
}

// ── Validation ─────────────────────────────────
function clearErrors() { Object.keys(errors).forEach(k => delete errors[k]) }

function validateStep0(): boolean {
  clearErrors()
  if (!form.firstName.trim())   errors.firstName = 'Prénom requis'
  if (!form.lastName.trim())    errors.lastName  = 'Nom requis'
  if (!form.email.includes('@'))errors.email     = 'Email invalide'
  if (form.phone.replace(/\s/g,'').length < 10) errors.phone = 'Téléphone invalide'
  if (form.password.length < 8) errors.password  = '8 caractères minimum'
  if (form.password !== form.confirmPassword) errors.confirmPassword = 'Les mots de passe ne correspondent pas'
  return !Object.keys(errors).length
}

function validateStep1(): boolean {
  clearErrors()
  if (!form.salonName.trim())                    errors.salonName  = 'Nom requis'
  if (!/^\d{14}$/.test(form.siret.replace(/\s/g,''))) errors.siret = 'SIRET invalide'
  if (!form.address.trim())                      errors.address    = 'Adresse requise'
  if (!/^\d{5}$/.test(form.postalCode))          errors.postalCode = 'Code postal invalide'
  if (!form.city.trim())                         errors.city       = 'Ville requise'
  if (!form.categories.length)                   errors.categories = 'Sélectionnez au moins une catégorie'
  return !Object.keys(errors).length
}

function validateStep2(): boolean {
  clearErrors()
  if (!form.kbis)            errors.kbis   = 'Document requis'
  if (!form.idCard)          errors.idCard = 'Pièce d\'identité requise'
  if (!form.iban.trim())     errors.iban   = 'IBAN requis'
  if (!form.cgu)             errors.cgu    = 'Vous devez accepter les CGU'
  return !Object.keys(errors).length
}

function nextStep() {
  const validators = [validateStep0, validateStep1]
  if (validators[step.value]()) step.value++
}

function onFile(field: 'kbis' | 'idCard', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) form[field] = file
}

async function handleSubmit() {
  if (!validateStep2()) return
  loading.value = true
  apiError.value = ''
  try {
    await authStore.registerPro({
      firstName:  form.firstName,
      lastName:   form.lastName,
      email:      form.email,
      phone:      form.phone,
      password:   form.password,
      salonName:  form.salonName,
      siret:      form.siret,
      address:    form.address,
      postalCode: form.postalCode,
      city:       form.city,
      categories: form.categories,
      iban:       form.iban || undefined,
      kbis:       form.kbis   ?? undefined,   // fichier KBIS
      idCard:     form.idCard ?? undefined    // pièce d'identité
    })
    // Redirection vers une page "en attente de validation"
    router.push('/register/pro/pending')
  } catch (err: unknown) {
    apiError.value = err instanceof Error ? err.message : 'Erreur lors de l\'inscription'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.auth-form__header { margin-bottom: 1.5rem; }

.auth-form__title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.9rem;
  font-weight: 700;
  color: #4F3942;
  margin-bottom: 0.4rem;
}

.auth-form__sub { font-size: 0.88rem; color: #888; }

/* ── Stepper ── */
.stepper {
  display: flex;
  align-items: flex-start;
  margin-bottom: 2rem;
}

.stepper__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
}

.stepper__dot {
  width: 30px; height: 30px;
  border-radius: 50%;
  border: 2px solid #E4E0DC;
  display: flex; align-items: center; justify-content: center;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem; font-weight: 700;
  color: #bbb; background: #fff;
  transition: all 0.3s ease;
  z-index: 1;
}

.stepper__item.active .stepper__dot { border-color: #4F3942; color: #4F3942; }
.stepper__item.done .stepper__dot   { border-color: #4F3942; background: #4F3942; color: white; }

.stepper__label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.68rem; font-weight: 600;
  color: #bbb; margin-top: 0.4rem;
  text-align: center; letter-spacing: 0.04em;
}

.stepper__item.active .stepper__label,
.stepper__item.done .stepper__label { color: #4F3942; }

.stepper__line {
  position: absolute; top: 15px; left: 50%;
  width: 100%; height: 2px;
  background: #E4E0DC; z-index: 0;
  transition: background 0.3s;
}

.stepper__item.done .stepper__line { background: #4F3942; }

/* ── Fields ── */
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
  font-size: 0.8rem; font-weight: 600;
  color: #4F3942; letter-spacing: 0.04em;
}

.form-field input {
  padding: 0.72rem 1rem;
  font-family: "Poppins", sans-serif;
  font-size: 0.9rem; font-weight: 300;
  color: #111;
  background: #F8F5F2;
  border: 1.5px solid #E4E0DC;
  border-radius: 10px;
  outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.form-field input:focus {
  border-color: #D1A1C7;
  box-shadow: 0 0 0 3px rgba(209,161,199,0.18);
}

.form-field input.error { border-color: #c0565b; }

/* ── Company search ── */
.company-search-wrap {
  position: relative;
  z-index: 10;
}

.company-input {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 1rem;
  background: #F8F5F2;
  border: 1.5px solid #E4E0DC;
  border-radius: 10px;
  transition: border-color 0.25s, box-shadow 0.25s;
}

.company-input.focused {
  border-color: #D1A1C7;
  box-shadow: 0 0 0 3px rgba(209,161,199,0.18);
}

.company-input.error { border-color: #c0565b; }

.company-input input {
  flex: 1;
  border: none !important;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0.72rem 0;
  margin: 0;
}

.company-input__ico { color: #D1A1C7; flex-shrink: 0; }

.company-input__spin {
  color: #bbb;
  flex-shrink: 0;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.company-input__ok { color: #4F3942; flex-shrink: 0; }

/* Dropdown */
.company-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0; right: 0;
  background: white;
  border: 1.5px solid #E4E0DC;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(79,57,66,0.12);
  overflow: hidden;
  list-style: none;
  max-height: 260px;
  overflow-y: auto;
}

.company-dropdown--empty {
  padding: 1rem;
  font-size: 0.85rem;
  color: #aaa;
  text-align: center;
}

.company-result {
  padding: 0.8rem 1rem;
  cursor: pointer;
  transition: background 0.18s;
  border-bottom: 1px solid #F8F5F2;
}

.company-result:last-child { border-bottom: none; }
.company-result:hover { background: #EADAF3; }

.company-result__name {
  font-family: "Montserrat", sans-serif;
  font-size: 0.88rem;
  font-weight: 600;
  color: #4F3942;
  margin-bottom: 0.2rem;
}

.company-result__meta {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 0.75rem;
  color: #888;
}

.badge-siret {
  background: #EADAF3;
  color: #4F3942;
  padding: 1px 7px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 0.7rem;
  white-space: nowrap;
}

/* Transition dropdown */
.dropdown-enter-active, .dropdown-leave-active { transition: opacity 0.18s, transform 0.18s; }
.dropdown-enter-from, .dropdown-leave-to { opacity: 0; transform: translateY(-6px); }

/* Prefilled grid */
.prefilled-grid {
  background: #F8F5F2;
  border: 1.5px solid #E4E0DC;
  border-radius: 14px;
  padding: 1rem 1rem 0;
  margin-bottom: 1rem;
  transition: border-color 0.3s;
}

.prefilled-grid.is-filled {
  border-color: #4F3942;
  background: #faf7fb;
}

.prefilled-grid__label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-family: "Montserrat", sans-serif;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #D1A1C7;
  margin-bottom: 0.75rem;
}

.prefilled-grid .form-field label { color: #888; font-size: 0.75rem; }
.prefilled-grid .form-field input { background: white; }

/* Password */
.input-pass { position: relative; }
.input-pass input { width: 100%; padding-right: 2.5rem; }
.pass-toggle {
  position: absolute; right: 0.75rem; top: 50%;
  transform: translateY(-50%);
  background: none; border: none; cursor: pointer; color: #aaa;
  display: flex; padding: 0;
}
.pass-toggle:hover { color: #4F3942; }

/* Categories */
.categories-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.25rem; }
.cats-loading { font-size: 0.82rem; color: #aaa; padding: 0.5rem 0; }

.category-chip {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.42rem 0.85rem;
  font-family: "Montserrat", sans-serif; font-size: 0.78rem; font-weight: 500;
  color: #4F3942;
  background: #F8F5F2; border: 1.5px solid #E4E0DC;
  border-radius: 999px; cursor: pointer;
  transition: all 0.22s ease; user-select: none;
}

.category-chip.selected { background: #4F3942; border-color: #4F3942; color: #fff; }
.category-chip:hover { border-color: #D1A1C7; }

/* Step info */
.step-info {
  display: flex; align-items: flex-start; gap: 0.5rem;
  background: #EADAF3; border-radius: 10px;
  padding: 0.75rem 1rem;
  font-size: 0.82rem; color: #4F3942; margin-bottom: 1.25rem; line-height: 1.5;
}

/* File drop */
.file-drop {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.9rem 1rem;
  background: #F8F5F2; border: 1.5px dashed #E4E0DC;
  border-radius: 10px; cursor: pointer;
  font-size: 0.83rem; color: #aaa;
  transition: border-color 0.25s;
}

.file-drop:hover { border-color: #D1A1C7; color: #4F3942; }
.file-drop.filled { border-style: solid; border-color: #4F3942; color: #4F3942; }

/* Checkbox */
.form-check { display: flex; align-items: flex-start; gap: 0.6rem; margin-bottom: 0.5rem; }
.form-check input[type="checkbox"] { margin-top: 3px; accent-color: #4F3942; flex-shrink: 0; }
.form-check label { font-size: 0.8rem; color: #555; line-height: 1.5; }
.form-check.error label { color: #c0565b; }
.field-error { font-size: 0.75rem; color: #c0565b; }

/* Actions */
.form-actions { margin-top: 1.25rem; }
.form-actions.two { display: grid; grid-template-columns: auto 1fr; gap: 0.75rem; }

.btn-submit {
  width: 100%; padding: 0.9rem;
  font-family: "Montserrat", sans-serif; font-size: 0.88rem;
  font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;
  color: #fff; background: #4F3942;
  border: none; border-radius: 999px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(79,57,66,0.25);
  transition: background 0.28s ease;
}

.btn-submit:hover:not(:disabled) { background: #D1A1C7; }
.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-back {
  padding: 0.9rem 1.5rem;
  font-family: "Montserrat", sans-serif; font-size: 0.88rem; font-weight: 600;
  color: #4F3942; background: transparent;
  border: 1.5px solid #E4E0DC; border-radius: 999px; cursor: pointer;
  white-space: nowrap; transition: border-color 0.25s;
}

.btn-back:hover { border-color: #4F3942; }

.auth-link { color: #D1A1C7; font-weight: 500; text-decoration: none; }
.auth-link:hover { color: #4F3942; }

.auth-form__client-link { text-align: center; margin-top: 1.5rem; font-size: 0.85rem; color: #888; }

.api-error {
  background: #fdecea;
  color: #c0565b;
  border-radius: 10px;
  padding: 0.75rem 1rem;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  text-align: center;
}

.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap;
}

@media (max-width: 480px) {
  .form-row { grid-template-columns: 1fr; }
  .form-actions.two { grid-template-columns: 1fr; }
}
</style>
