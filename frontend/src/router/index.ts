import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import HomeView from '@/views/HomeView.vue'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    role?: string          // rôle requis pour accéder à la page
    guestOnly?: boolean    // page destinée aux non-connectés
    forRole?: string       // si guestOnly : redirige uniquement si le rôle courant correspond
  }
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView
    },

    // ── Auth Client ───────────────────────────
    {
      path: '/register/client',
      name: 'register-client',
      component: () => import('@/views/RegisterClientView.vue'),
      meta: { guestOnly: true, forRole: 'client' }
    },
    {
      path: '/login/client',
      name: 'login-client',
      component: () => import('@/views/LoginClientView.vue'),
      meta: { guestOnly: true, forRole: 'client' }
    },

    // ── Auth Pro ──────────────────────────────
    {
      path: '/register/pro',
      name: 'register-pro',
      component: () => import('@/views/RegisterProView.vue'),
      meta: { guestOnly: true, forRole: 'pro' }
    },
    {
      path: '/register/pro/pending',
      name: 'register-pro-pending',
      component: () => import('@/views/RegisterProPendingView.vue')
    },
    {
      path: '/login/pro',
      name: 'login-pro',
      component: () => import('@/views/LoginProView.vue'),
      meta: { guestOnly: true, forRole: 'pro' }
    },

    // ── Auth Admin ────────────────────────────
    {
      path: '/login/admin',
      name: 'login-admin',
      component: () => import('@/views/LoginAdminView.vue'),
      meta: { guestOnly: true, forRole: 'admin' }
    },

    // ── Auth Collaborateur ────────────────────
    {
      path: '/login/collaborateur',
      name: 'login-collaborator',
      component: () => import('@/views/LoginCollaboratorView.vue'),
      meta: { guestOnly: true, forRole: 'collaborator' }
    },
    {
      path: '/invitation/collaborateur/:token',
      name: 'invite-collaborator',
      component: () => import('@/views/AcceptInviteCollaboratorView.vue')
    },

    // ── Espaces privés ────────────────────────
    {
      path: '/espace-client',
      name: 'client-dashboard',
      component: () => import('@/views/ClientDashboardView.vue'),
      meta: { requiresAuth: true, role: 'client' }
    },
    {
      path: '/espace-collaborateur',
      name: 'collaborator-dashboard',
      component: () => import('@/views/CollaboratorDashboardView.vue'),
      meta: { requiresAuth: true, role: 'collaborator' }
    },
    {
      path: '/espace-pro',
      name: 'pro-dashboard',
      component: () => import('@/views/ProDashboardView.vue'),
      meta: { requiresAuth: true, role: 'pro' }
    },
    {
      path: '/admin',
      name: 'admin-dashboard',
      component: () => import('@/views/AdminDashboardView.vue'),
      meta: { requiresAuth: true, role: 'admin' }
    },

    // ── Recherche & pages publiques ───────────
    {
      path: '/recherche',
      name: 'search',
      component: () => import('@/views/SearchView.vue')
    },
    {
      path: '/salon/:id',
      name: 'salon',
      component: () => import('@/views/SalonView.vue')
    },
    {
      path: '/salon/:id/reserver/:serviceId',
      name: 'salon-booking',
      component: () => import('@/views/BookingView.vue')
    },

    // ── Catch all ────────────────────────────
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// ── Navigation guard ────────────────────────────────────
router.beforeEach((to) => {
  const auth = useAuthStore()

  // 1. Page protégée → doit être connecté
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'home' }
  }

  // 2. Page protégée avec rôle spécifique → mauvais rôle
    if (to.meta.requiresAuth && to.meta.role && auth.role !== to.meta.role) {
      if (auth.isClient) return { name: 'client-dashboard' }
      if (auth.isPro)    return { name: 'pro-dashboard' }
      if (auth.isCollaborator) return { name: 'collaborator-dashboard' }
      if (auth.isAdmin)  return { name: 'admin-dashboard' }
      return { name: 'home' }
    }

  // 3. Page guestOnly → redirige SEULEMENT si le rôle courant correspond à forRole
  //    Exemple : client connecté sur /login/pro → laissé passer (rôle ≠ forRole)
  //              client connecté sur /login/client → redirigé vers son dashboard
  if (to.meta.guestOnly && auth.isLoggedIn) {
    if (!to.meta.forRole || auth.role === to.meta.forRole) {
      if (auth.isClient) return { name: 'client-dashboard' }
      if (auth.isPro)    return { name: 'pro-dashboard' }
      if (auth.isCollaborator) return { name: 'collaborator-dashboard' }
      if (auth.isAdmin)  return { name: 'admin-dashboard' }
    }
    // Rôle différent → on laisse accéder la page (connexion avec un autre compte)
  }
})

export default router
