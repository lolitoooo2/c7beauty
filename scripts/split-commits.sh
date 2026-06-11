#!/usr/bin/env bash
# Découpe l'historique en commits thématiques — à lancer depuis la racine du repo.
# Usage : bash scripts/split-commits.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
  echo "→ Démarrage du découpage en commits…"
else
  echo "Rien à committer."
  exit 0
fi

commit() {
  local msg="$1"
  shift
  for path in "$@"; do
    if [[ "$path" == *".gitkeep" ]]; then
      git add -f "$path"
    else
      git add "$path"
    fi
  done
  git commit -m "$msg"
  echo "✓ $msg"
}

# ── 0. Sécurité & doc ─────────────────────────────────────
commit "Ajouter gitignore pour exclure secrets, uploads et PDFs." \
  .gitignore

commit "Documenter le projet et le déploiement production." \
  README.md

# ── 1. Infrastructure ─────────────────────────────────────
commit "Configurer le volume Docker user_uploads pour les fichiers utilisateurs." \
  docker-compose.yml \
  backend/uploads/kyc/.gitkeep

commit "Ajouter les Dockerfiles et templates d'environnement backend." \
  backend/Dockerfile \
  backend/.env.example \
  backend/.env.prod.example \
  backend/controllers/.gitkeep \
  backend/middleware/.gitkeep \
  backend/models/.gitkeep \
  backend/utils/.gitkeep

# ── 2. Modèles MongoDB ────────────────────────────────────
commit "Ajouter les modèles MongoDB Client, Pro, Admin, Category et Service." \
  backend/models/Client.js \
  backend/models/Pro.js \
  backend/models/Admin.js \
  backend/models/Category.js \
  backend/models/Service.js

# ── 3. Middleware ─────────────────────────────────────────
commit "Ajouter l'authentification JWT et le middleware d'upload Multer." \
  backend/middleware/auth.js \
  backend/middleware/upload.js

# ── 4. Géocodage ──────────────────────────────────────────
commit "Ajouter l'utilitaire de géocodage via api-adresse.data.gouv.fr." \
  backend/utils/geocode.js

# ── 5. Auth ───────────────────────────────────────────────
commit "Implémenter l'inscription et la connexion client/pro/admin." \
  backend/controllers/authController.js \
  backend/routes/auth.js

# ── 6. Catégories ─────────────────────────────────────────
commit "Ajouter les catégories de prestations avec seed et CRUD admin." \
  backend/seed/categories.js \
  backend/controllers/categoryController.js \
  backend/routes/categories.js

# ── 7. Client API ────────────────────────────────────────
commit "Ajouter l'API client (profil, avatar)." \
  backend/controllers/clientController.js \
  backend/routes/client.js

# ── 8. Pro API ────────────────────────────────────────────
commit "Ajouter l'API pro (profil, photos salon, géocodage)." \
  backend/controllers/proController.js \
  backend/routes/pro.js

# ── 9. Services pro ───────────────────────────────────────
commit "Ajouter la collection Service et la gestion des prestations pro." \
  backend/controllers/serviceController.js \
  backend/routes/services.js

# ── 10. Recherche ─────────────────────────────────────────
commit "Implémenter la recherche géospatiale et les suggestions salon." \
  backend/controllers/searchController.js \
  backend/routes/search.js

# ── 11. Admin API ─────────────────────────────────────────
commit "Ajouter le dashboard admin (CRUD clients/pros, KYC, catégories)." \
  backend/controllers/adminController.js \
  backend/routes/admin.js

# ── 12. Serveur ───────────────────────────────────────────
commit "Brancher les routes API, servir les médias et lancer le seed." \
  backend/server.js \
  backend/routes/index.js \
  backend/package.json

# ── 13. Assets frontend ───────────────────────────────────
commit "Ajouter le bootstrap Vue (Vite, TypeScript, main, Pinia)." \
  frontend/Dockerfile \
  frontend/.env.example \
  frontend/vite.config.ts \
  frontend/tsconfig.json \
  frontend/tsconfig.app.json \
  frontend/tsconfig.node.json \
  frontend/src/main.ts \
  frontend/src/stores/app.ts \
  frontend/public/.gitkeep \
  frontend/src/assets/.gitkeep \
  frontend/src/components/.gitkeep \
  frontend/src/services/.gitkeep \
  frontend/src/types/.gitkeep

commit "Ajouter logo, favicon et image hero de la home page." \
  frontend/public/favicon.svg \
  frontend/src/assets/logo.svg \
  frontend/src/assets/home-hero.jpg \
  frontend/index.html

# ── 14. UI partagée ───────────────────────────────────────
commit "Ajouter les toasts globaux et le composable useToast." \
  frontend/src/composables/useToast.ts \
  frontend/src/components/ToastContainer.vue \
  frontend/src/App.vue

# ── 15. Auth frontend ─────────────────────────────────────
commit "Ajouter le store Pinia auth et les guards de navigation." \
  frontend/src/stores/auth.ts \
  frontend/src/router/index.ts

# ── 16. Layout auth ───────────────────────────────────────
commit "Ajouter le layout et les pages de connexion." \
  frontend/src/components/AuthLayout.vue \
  frontend/src/views/LoginClientView.vue \
  frontend/src/views/LoginProView.vue \
  frontend/src/views/LoginAdminView.vue

# ── 17. Inscription ───────────────────────────────────────
commit "Ajouter les pages d'inscription client et pro." \
  frontend/src/views/RegisterClientView.vue \
  frontend/src/views/RegisterProView.vue \
  frontend/src/views/RegisterProPendingView.vue

# ── 18. Dashboard client ──────────────────────────────────
commit "Ajouter l'espace client avec édition de profil et avatar." \
  frontend/src/views/ClientDashboardView.vue

# ── 19. Dashboard pro ─────────────────────────────────────
commit "Ajouter l'espace pro (profil, photos salon, prestations)." \
  frontend/src/views/ProDashboardView.vue

# ── 20. Dashboard admin ───────────────────────────────────
commit "Ajouter l'espace admin (KYC, CRUD, catégories)." \
  frontend/src/views/AdminDashboardView.vue

# ── 21. Home page ─────────────────────────────────────────
commit "Implémenter la page d'accueil avec navbar, hero et catégories." \
  frontend/src/views/HomeView.vue

# ── 22. Dépendances carte ─────────────────────────────────
commit "Ajouter Leaflet pour la carte interactive de recherche." \
  frontend/package.json

# ── 23. Recherche frontend ────────────────────────────────
commit "Ajouter la page recherche carte, fiche salon et ProCard." \
  frontend/src/components/ProCard.vue \
  frontend/src/views/SearchView.vue \
  frontend/src/views/SalonView.vue

# ── 24. Autocomplétion ────────────────────────────────────
commit "Ajouter l'autocomplétion lieu et prestation sur home et recherche." \
  frontend/src/composables/useLieuAutocomplete.ts \
  frontend/src/composables/usePrestationAutocomplete.ts \
  frontend/src/components/LieuAutocompleteInput.vue \
  frontend/src/components/PrestationAutocompleteInput.vue

# ── 25. Nginx ─────────────────────────────────────────────
commit "Configurer Nginx pour les uploads multipart et les gros fichiers." \
  frontend/nginx.conf

# ── 26. Production ────────────────────────────────────────
commit "Ajouter la configuration Docker et Nginx pour le déploiement production." \
  docker-compose.prod.yml \
  deploy/nginx-vhost.example.conf

# ── 27. Script (optionnel) ────────────────────────────────
commit "Ajouter le script de découpage historique git en commits thématiques." \
  scripts/split-commits.sh

echo ""
echo "Terminé. $(git rev-list --count HEAD) commits au total."
echo "Fichiers non commités (références design, volontairement exclus) :"
git status -s -- "Charte_Graphique_C7Beauty 2.pdf" maquette.pdf 2>/dev/null || true
