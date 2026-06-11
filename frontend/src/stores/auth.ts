import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type Role = 'client' | 'pro' | 'admin'

export interface ClientUser {
  _id: string
  role: 'client'
  firstName: string
  lastName: string
  email: string
  phone: string
  postalCode?: string | null
  avatar: string | null
  birthdate?: string
  myReferralCode?: string
  wallet: { cashback: number; points: number; prestationCount: number }
  socialLinks: { instagram: string | null; facebook: string | null }
  createdAt: string
}

export interface ProUser {
  _id: string
  role: 'pro'
  firstName: string
  lastName: string
  email: string
  phone: string
  avatar: string | null
  salonName: string
  siret: string
  address: string
  postalCode: string
  city: string
  categories: string[]
  isActive: boolean
  kyc: { status: 'pending' | 'approved' | 'rejected'; kbisUrl?: string | null; idCardUrl?: string | null }
  subscription: { plan: 'free' | 'premium'; expiresAt: string | null }
  stats: { reservationCount: number; averageRating: number; reviewCount: number }
  totalEarnings?: number
  socialLinks?: { instagram?: string | null; facebook?: string | null; tiktok?: string | null }
  createdAt: string
}

export type AuthUser = ClientUser | ProUser

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('c7_token'))
  const user  = ref<AuthUser | null>(
    JSON.parse(localStorage.getItem('c7_user') || 'null')
  )
  const role = ref<Role | null>(
    (localStorage.getItem('c7_role') as Role | null)
  )

  const isLoggedIn = computed(() => !!token.value)
  const isClient   = computed(() => role.value === 'client')
  const isPro      = computed(() => role.value === 'pro')
  const isAdmin    = computed(() => role.value === 'admin')
  const isPending  = computed(() =>
    isPro.value && (user.value as ProUser)?.kyc?.status === 'pending'
  )

  function setSession (t: string, u: AuthUser, r: Role) {
    token.value = t
    user.value  = { ...u, role: r }
    role.value  = r
    localStorage.setItem('c7_token', t)
    localStorage.setItem('c7_user',  JSON.stringify({ ...u, role: r }))
    localStorage.setItem('c7_role',  r)
  }

  function logout () {
    token.value = null
    user.value  = null
    role.value  = null
    localStorage.removeItem('c7_token')
    localStorage.removeItem('c7_user')
    localStorage.removeItem('c7_role')
  }

  async function registerClient (payload: Record<string, unknown>) {
    const res  = await fetch('/api/auth/register/client', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur inscription')
    setSession(data.token, data.user, 'client')
    return data
  }

  async function registerPro (payload: Record<string, unknown>) {
    // Envoi en FormData pour inclure les fichiers KYC
    const fd = new FormData()
    Object.entries(payload).forEach(([key, val]) => {
      if (val instanceof File) {
        fd.append(key, val)
      } else if (Array.isArray(val)) {
        fd.append(key, JSON.stringify(val))
      } else if (val !== undefined && val !== null) {
        fd.append(key, String(val))
      }
    })
    const res  = await fetch('/api/auth/register/pro', {
      method : 'POST',
      body   : fd  // pas de Content-Type header : le navigateur le gère avec le boundary
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur inscription')
    setSession(data.token, data.user, 'pro')
    return data
  }

  async function login (email: string, password: string) {
    const res  = await fetch('/api/auth/login', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Identifiants incorrects')
    setSession(data.token, data.user, data.role)
    return data
  }

  async function fetchMe () {
    if (!token.value) return
    const res  = await fetch('/api/auth/me', {
      headers : { Authorization: `Bearer ${token.value}` }
    })
    if (!res.ok) { logout(); return }
    const data = await res.json()
    setSession(token.value, data.user, data.role)
  }

  return {
    token, user, role,
    isLoggedIn, isClient, isPro, isAdmin, isPending,
    setSession, logout,
    registerClient, registerPro, login, fetchMe
  }
})
