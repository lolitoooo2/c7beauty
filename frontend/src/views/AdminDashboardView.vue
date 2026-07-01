<template>
  <div class="admin-shell">
    <!-- SIDEBAR -->
    <aside class="admin-sidebar" :class="{ collapsed: sidebarClosed }">
      <div class="sidebar-header">
        <img src="@/assets/logo.svg" alt="C7Beauty" class="sidebar-logo" />
        <button class="sidebar-toggle" @click="sidebarClosed = !sidebarClosed">
          <PanelLeftClose v-if="!sidebarClosed" :size="18" />
          <PanelLeftOpen v-else :size="18" />
        </button>
      </div>

      <nav class="sidebar-nav">
        <button v-for="item in navItems" :key="item.key"
          class="nav-item" :class="{ active: section === item.key }"
          @click="section = item.key">
          <component :is="item.icon" :size="18" />
          <span class="nav-label">{{ item.label }}</span>
          <span v-if="item.badge && stats" class="nav-badge">{{ stats[item.badge as keyof typeof stats] }}</span>
        </button>
      </nav>

      <div class="sidebar-footer">
        <div class="admin-info">
          <div class="admin-avatar">{{ adminInitials }}</div>
          <div class="admin-meta">
            <span class="admin-name">{{ adminUser?.firstName }}</span>
            <span class="admin-role">Admin</span>
          </div>
        </div>
        <button class="btn-logout" @click="handleLogout">
          <LogOut :size="16" />
          <span class="nav-label">Déconnexion</span>
        </button>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="admin-main">
      <!-- Header -->
      <div class="admin-topbar">
        <div class="topbar-title">
          <h1>{{ currentSection?.label }}</h1>
        </div>
        <div class="topbar-right">
          <span class="topbar-date">{{ today }}</span>
        </div>
      </div>

      <!-- ── TABLEAU DE BORD ─────────────────────── -->
      <section v-if="section === 'dashboard'" class="section-content">
        <div class="stats-grid" v-if="stats">
          <div class="stat-card">
            <Users :size="22" class="stat-icon purple" />
            <div class="stat-info">
              <span class="stat-val">{{ stats.clients }}</span>
              <span class="stat-label">Clients</span>
            </div>
          </div>
          <div class="stat-card">
            <Scissors :size="22" class="stat-icon pink" />
            <div class="stat-info">
              <span class="stat-val">{{ stats.pros }}</span>
              <span class="stat-label">Professionnels</span>
            </div>
          </div>
          <div class="stat-card accent">
            <Clock :size="22" class="stat-icon orange" />
            <div class="stat-info">
              <span class="stat-val">{{ stats.pending }}</span>
              <span class="stat-label">Demandes KYC en attente</span>
            </div>
          </div>
          <div class="stat-card">
            <CheckCircle :size="22" class="stat-icon green" />
            <div class="stat-info">
              <span class="stat-val">{{ stats.approved }}</span>
              <span class="stat-label">Pros validés</span>
            </div>
          </div>
        </div>

        <div class="quick-actions">
          <h2 class="section-title">Actions rapides</h2>
          <div class="qa-grid">
            <button class="qa-btn" @click="section = 'kyc'">
              <FileCheck :size="20" /><span>Traiter les dossiers KYC</span>
            </button>
            <button class="qa-btn" @click="section = 'pros'; openCreateModal('pro')">
              <UserPlus :size="20" /><span>Créer un Pro</span>
            </button>
            <button class="qa-btn" @click="section = 'clients'; openCreateModal('client')">
              <UserPlus :size="20" /><span>Créer un Client</span>
            </button>
          </div>
        </div>
      </section>

      <!-- ── DEMANDES KYC ─────────────────────────── -->
      <section v-else-if="section === 'kyc'" class="section-content">
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-wrap">
              <Search :size="16" />
              <input v-model="kyc.search" placeholder="Rechercher un pro…" @input="fetchKycList" />
            </div>
            <select v-model="kyc.statusFilter" @change="fetchKycList" class="filter-select">
              <option value="">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="approved">Approuvés</option>
              <option value="rejected">Refusés</option>
            </select>
          </div>
          <span class="total-label">{{ kyc.total }} dossier(s)</span>
        </div>

        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Pro</th><th>Salon</th><th>SIRET</th>
                <th>Date</th><th>Statut</th><th>Documents</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="kyc.loading"><td colspan="7" class="loading-row"><div class="spinner-sm"></div> Chargement…</td></tr>
              <tr v-else-if="!kyc.list.length"><td colspan="7" class="empty-row">Aucun dossier trouvé.</td></tr>
              <tr v-for="pro in kyc.list" :key="pro._id">
                <td>
                  <div class="cell-user">
                    <div class="avatar-sm">{{ initials(pro) }}</div>
                    <div>
                      <span class="cell-name">{{ pro.firstName }} {{ pro.lastName }}</span>
                      <span class="cell-sub">{{ pro.email }}</span>
                    </div>
                  </div>
                </td>
                <td>{{ pro.salonName }}</td>
                <td><code>{{ pro.siret }}</code></td>
                <td>{{ formatDate(pro.createdAt) }}</td>
                <td><span :class="['badge', pro.kyc?.status]">{{ kycLabel(pro.kyc?.status) }}</span></td>
                <td>
                  <div class="doc-btns">
                    <button v-if="pro.kyc?.kbisUrl" class="doc-btn"
                      @click="openDoc(pro.kyc.kbisUrl, 'KBIS')">
                      <FileText :size="14" /> KBIS
                    </button>
                    <button v-if="pro.kyc?.idCardUrl" class="doc-btn"
                      @click="openDoc(pro.kyc.idCardUrl, 'Pièce d\'identité')">
                      <FileText :size="14" /> ID
                    </button>
                    <span v-if="!pro.kyc?.kbisUrl && !pro.kyc?.idCardUrl" class="no-doc">—</span>
                  </div>
                </td>
                <td>
                  <div class="action-btns">
                    <button class="btn-approve" title="Approuver"
                      @click="setKycStatus(pro._id, 'approved')" :disabled="pro.kyc?.status === 'approved'">
                      <Check :size="15" />
                    </button>
                    <button class="btn-reject" title="Refuser"
                      @click="openRejectModal(pro)" :disabled="pro.kyc?.status === 'rejected'">
                      <X :size="15" />
                    </button>
                    <button class="btn-icon" title="Modifier" @click="openEditModal('pro', pro)">
                      <Pencil :size="15" />
                    </button>
                    <button class="btn-icon danger" title="Supprimer" @click="confirmDelete('pro', pro._id)">
                      <Trash2 :size="15" />
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination :page="kyc.page" :pages="kyc.pages" @change="p => { kyc.page = p; fetchKycList() }" />
      </section>

      <!-- ── LISTE PROS ────────────────────────────── -->
      <section v-else-if="section === 'pros'" class="section-content">
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-wrap">
              <Search :size="16" />
              <input v-model="pros.search" placeholder="Nom, email, salon…" @input="debounceFetchPros" />
            </div>
            <select v-model="pros.statusFilter" @change="fetchProsList" class="filter-select">
              <option value="">Tous les statuts</option>
              <option value="pending">KYC en attente</option>
              <option value="approved">Approuvés</option>
              <option value="rejected">Refusés</option>
            </select>
          </div>
          <button class="btn-create" @click="openCreateModal('pro')">
            <UserPlus :size="16" /> Nouveau Pro
          </button>
        </div>

        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Pro</th><th>Salon</th><th>Ville</th><th>KYC</th><th>Actif</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              <tr v-if="pros.loading"><td colspan="7" class="loading-row"><div class="spinner-sm"></div> Chargement…</td></tr>
              <tr v-else-if="!pros.list.length"><td colspan="7" class="empty-row">Aucun professionnel trouvé.</td></tr>
              <tr v-for="pro in pros.list" :key="pro._id">
                <td>
                  <div class="cell-user">
                    <div class="avatar-sm">{{ initials(pro) }}</div>
                    <div>
                      <span class="cell-name">{{ pro.firstName }} {{ pro.lastName }}</span>
                      <span class="cell-sub">{{ pro.email }}</span>
                    </div>
                  </div>
                </td>
                <td>{{ pro.salonName }}</td>
                <td>{{ pro.city || '—' }}</td>
                <td><span :class="['badge', pro.kyc?.status]">{{ kycLabel(pro.kyc?.status) }}</span></td>
                <td>
                  <span :class="['badge', pro.isActive ? 'approved' : 'rejected']">
                    {{ pro.isActive ? 'Oui' : 'Non' }}
                  </span>
                </td>
                <td>{{ formatDate(pro.createdAt) }}</td>
                <td>
                  <div class="action-btns">
                    <button class="btn-icon" title="Modifier" @click="openEditModal('pro', pro)"><Pencil :size="15" /></button>
                    <button class="btn-icon danger" title="Supprimer" @click="confirmDelete('pro', pro._id)"><Trash2 :size="15" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination :page="pros.page" :pages="pros.pages" @change="p => { pros.page = p; fetchProsList() }" />
      </section>

      <!-- ── LISTE CLIENTS ─────────────────────────── -->
      <section v-else-if="section === 'clients'" class="section-content">
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-wrap">
              <Search :size="16" />
              <input v-model="clients.search" placeholder="Nom, email, téléphone, code postal…" @input="debounceFetchClients" />
            </div>
          </div>
          <button class="btn-create" @click="openCreateModal('client')">
            <UserPlus :size="16" /> Nouveau Client
          </button>
        </div>

        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Client</th><th>Téléphone</th><th>CP</th><th>Email</th><th>Cashback</th><th>Points</th><th>Parrain</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              <tr v-if="clients.loading"><td colspan="9" class="loading-row"><div class="spinner-sm"></div> Chargement…</td></tr>
              <tr v-else-if="!clients.list.length"><td colspan="9" class="empty-row">Aucun client trouvé.</td></tr>
              <tr v-for="c in clients.list" :key="c._id">
                <td>
                  <div class="cell-user">
                    <div class="avatar-sm">{{ initials(c) }}</div>
                    <div>
                      <span class="cell-name">{{ c.firstName }} {{ c.lastName }}</span>
                      <span class="cell-sub">{{ c.email }}</span>
                    </div>
                  </div>
                </td>
                <td>{{ c.phone || '—' }}</td>
                <td>
                  <code v-if="c.postalCode">{{ c.postalCode }}</code>
                  <span v-else class="no-doc">—</span>
                </td>
                <td>
                  <span class="email-badge" :class="c.emailVerified ? 'ok' : 'pending'">
                    {{ c.emailVerified ? 'Vérifié' : 'En attente' }}
                  </span>
                </td>
                <td>{{ (c.wallet?.cashback ?? 0).toFixed(2) }} €</td>
                <td>{{ c.wallet?.points ?? 0 }}</td>
                <td><code v-if="c.myReferralCode">{{ c.myReferralCode }}</code><span v-else>—</span></td>
                <td>{{ formatDate(c.createdAt) }}</td>
                <td>
                  <div class="action-btns">
                    <button v-if="!c.emailVerified" class="btn-icon" title="Forcer vérification" @click="forceVerifyClient(c._id)"><Check :size="15" /></button>
                    <button v-if="!c.emailVerified" class="btn-icon" title="Renvoyer email" @click="resendClientVerify(c._id)"><Mail :size="15" /></button>
                    <button class="btn-icon" title="Modifier" @click="openEditModal('client', c)"><Pencil :size="15" /></button>
                    <button class="btn-icon danger" title="Supprimer" @click="confirmDelete('client', c._id)"><Trash2 :size="15" /></button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination :page="clients.page" :pages="clients.pages" @change="p => { clients.page = p; fetchClientsList() }" />
      </section>

      <!-- ── EMAILS ─────────────────────────────────── -->
      <section v-else-if="section === 'emails'" class="section-content">
        <div class="toolbar">
          <div class="toolbar-left">
            <select v-model="emails.statusFilter" class="filter-select" @change="fetchEmailLogs">
              <option value="">Tous statuts</option>
              <option value="sent">Envoyés</option>
              <option value="failed">Échecs</option>
              <option value="skipped">Ignorés</option>
            </select>
            <select v-model="emails.typeFilter" class="filter-select" @change="fetchEmailLogs">
              <option value="">Tous types</option>
              <option value="email_verification">Vérification email</option>
              <option value="booking_confirmation">Confirmation RDV</option>
            </select>
          </div>
          <span class="total-label">{{ emails.total }} email(s)</span>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr><th>Date</th><th>Destinataire</th><th>Type</th><th>Sujet</th><th>Statut</th><th>Erreur</th></tr>
            </thead>
            <tbody>
              <tr v-if="emails.loading"><td colspan="6" class="loading-row"><div class="spinner-sm"></div> Chargement…</td></tr>
              <tr v-else-if="!emails.list.length"><td colspan="6" class="empty-row">Aucun email enregistré.</td></tr>
              <tr v-for="e in emails.list" :key="e._id">
                <td>{{ formatDate(e.createdAt) }}</td>
                <td>{{ e.to }}</td>
                <td><code>{{ e.type }}</code></td>
                <td>{{ e.subject }}</td>
                <td><span class="email-badge" :class="e.status">{{ e.status }}</span></td>
                <td class="cell-sub">{{ e.error || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination :page="emails.page" :pages="emails.pages" @change="p => { emails.page = p; fetchEmailLogs() }" />
      </section>

      <!-- ── PAIEMENTS ───────────────────────────────── -->
      <section v-else-if="section === 'payments'" class="section-content">
        <div class="toolbar">
          <div class="toolbar-left">
            <select v-model="payments.statusFilter" class="filter-select" @change="fetchPayments">
              <option value="">Tous statuts</option>
              <option value="succeeded">Réussis</option>
              <option value="pending">En attente</option>
              <option value="failed">Échoués</option>
              <option value="expired">Expirés</option>
            </select>
          </div>
          <span class="total-label">{{ payments.total }} paiement(s)</span>
        </div>
        <div class="table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Client</th>
                <th>Salon</th>
                <th>Prestation</th>
                <th>Acompte</th>
                <th>Solde</th>
                <th>Commission</th>
                <th>Validation</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="payments.loading"><td colspan="9" class="loading-row"><div class="spinner-sm"></div> Chargement…</td></tr>
              <tr v-else-if="!payments.list.length"><td colspan="9" class="empty-row">Aucun paiement enregistré.</td></tr>
              <tr v-for="p in payments.list" :key="p._id">
                <td>{{ formatDate(p.createdAt) }}</td>
                <td>
                  <span class="cell-name">{{ p.clientName }}</span>
                  <span class="cell-sub">{{ p.clientEmail }}</span>
                </td>
                <td>{{ p.salonName }}</td>
                <td>
                  <span class="cell-name">{{ p.serviceName }}</span>
                  <span v-if="p.totalPrice != null" class="cell-sub">{{ p.totalPrice.toFixed(2) }} € total</span>
                </td>
                <td>{{ p.amount?.toFixed(2) }} €</td>
                <td>{{ p.remainingAmount?.toFixed(2) ?? '0.00' }} €</td>
                <td>
                  <span class="cell-name">{{ p.platformCommission?.toFixed(2) }} €</span>
                  <span class="cell-sub">Pro : {{ p.proShare?.toFixed(2) }} € · {{ p.commissionPercent ?? '—' }} %</span>
                </td>
                <td><code>{{ p.validationStatus || '—' }}</code></td>
                <td>
                  <span class="pay-admin-badge" :class="p.status">{{ p.statusLabel }}</span>
                  <span v-if="p.paymentPhase === 'balance'" class="cell-sub">Solde · tentative {{ p.chargeAttempt }}</span>
                  <span v-if="p.failureReason" class="cell-sub cell-sub--warn">{{ p.failureReason }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <Pagination :page="payments.page" :pages="payments.pages" @change="p => { payments.page = p; fetchPayments() }" />
      </section>

      <!-- ── PARAMÈTRES ──────────────────────────────── -->
      <section v-else-if="section === 'settings'" class="section-content">
        <div class="toolbar">
          <div class="toolbar-left">
            <h2 class="section-heading">Paramètres de la plateforme</h2>
          </div>
        </div>

        <div v-if="platformSettings.loading" class="loading-row">
          <div class="spinner-sm"></div> Chargement…
        </div>

        <form v-else class="settings-card" @submit.prevent="savePlatformSettings">
          <div class="settings-field">
            <label for="depositPercent">Pourcentage d'acompte</label>
            <div class="settings-input-row">
              <input
                id="depositPercent"
                v-model.number="platformSettings.depositPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                required
              />
              <span class="settings-suffix">%</span>
            </div>
            <p class="settings-hint">
              Appliqué aux nouvelles réservations. Les réservations existantes conservent leur pourcentage.
            </p>
          </div>

          <div class="settings-field">
            <label for="commissionPercent">Taux de commission C7'Beauty</label>
            <div class="settings-input-row">
              <input
                id="commissionPercent"
                v-model.number="platformSettings.commissionPercent"
                type="number"
                min="0"
                max="100"
                step="1"
                required
              />
              <span class="settings-suffix">%</span>
            </div>
            <p class="settings-hint">
              Prélevé sur chaque paiement (acompte, solde, no-show). Les paiements déjà effectués conservent leur taux.
            </p>
          </div>

          <div class="settings-field settings-field--toggle">
            <label class="settings-toggle">
              <input
                id="referralCashbackEnabled"
                v-model="platformSettings.referralCashbackEnabled"
                type="checkbox"
              />
              <span>Cashback parrainage (+5 € parrain / filleul)</span>
            </label>
            <p class="settings-hint">
              Désactivé par défaut. Tant que cette option est off, le parrainage n'est ni affiché ni exécuté côté client.
            </p>
          </div>

          <p v-if="platformSettings.error" class="settings-error">{{ platformSettings.error }}</p>

          <div class="settings-actions">
            <button type="submit" class="btn-primary-filled settings-save" :disabled="platformSettings.saving">
              <Loader2 v-if="platformSettings.saving" :size="15" class="spin" />
              Enregistrer
            </button>
          </div>
        </form>
      </section>

      <!-- ── CATÉGORIES ──────────────────────────────── -->
      <section v-else-if="section === 'categories'" class="section-content">
        <div class="toolbar">
          <div class="toolbar-left">
            <h2 class="section-heading">Catégories de prestations</h2>
          </div>
          <button class="btn-create" @click="openCatModal(null)">
            <Plus :size="16" /> Nouvelle catégorie
          </button>
        </div>

        <div v-if="catsLoading" class="loading-row"><div class="spinner-sm"></div> Chargement…</div>

        <div v-else class="cats-list">
          <div v-for="cat in catsList" :key="cat._id" class="cat-card">
            <div class="cat-card__header">
              <span class="cat-card__name">{{ cat.name }}</span>
              <span class="cat-card__slug">{{ cat.slug }}</span>
              <span class="cat-status" :class="cat.active ? 'active' : 'inactive'">
                {{ cat.active ? 'Active' : 'Inactive' }}
              </span>
              <div class="cat-card__actions">
                <button class="btn-icon" title="Modifier" @click="openCatModal(cat)"><Pencil :size="15" /></button>
                <button class="btn-icon danger" title="Supprimer" @click="deleteCat(cat._id)"><Trash2 :size="15" /></button>
              </div>
            </div>
            <!-- Sous-catégories -->
            <div class="subcats">
              <span v-for="sub in cat.subcategories" :key="sub._id" class="subcat-chip">
                {{ sub.name }}
                <button class="subcat-del" @click="deleteSubcat(cat._id, sub._id)" title="Supprimer">×</button>
              </span>
              <button class="subcat-add" @click="openSubcatModal(cat)">+ Ajouter</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>

  <!-- ── MODAL DOCUMENT ─────────────────────────────── -->
  <Teleport to="body">
    <div v-if="docModal.open" class="modal-overlay" @click.self="closeDocModal">
      <div class="doc-modal">
        <div class="modal-header">
          <h3>{{ docModal.title }}</h3>
          <button @click="closeDocModal"><X :size="20" /></button>
        </div>
        <div class="doc-viewer">
          <div v-if="docModal.loading" class="doc-loading">
            <div class="spinner-sm"></div>
            <span>Chargement du document…</span>
          </div>
          <p v-else-if="docModal.error" class="doc-error">{{ docModal.error }}</p>
          <template v-else-if="docModal.url">
            <iframe v-if="docModal.isPdf" :src="docModal.url" class="doc-frame"></iframe>
            <img v-else :src="docModal.url" class="doc-img" alt="document KYC" />
          </template>
        </div>
      </div>
    </div>

    <!-- ── MODAL REFUS KYC ──────────────────────────── -->
    <div v-if="rejectModal.open" class="modal-overlay" @click.self="rejectModal.open = false">
      <div class="form-modal">
        <div class="modal-header">
          <h3>Motif de refus</h3>
          <button @click="rejectModal.open = false"><X :size="20" /></button>
        </div>
        <p class="modal-sub">{{ rejectModal.proName }}</p>
        <textarea v-model="rejectModal.reason" rows="4" placeholder="Expliquer le motif de refus…" class="modal-textarea"></textarea>
        <div class="modal-actions">
          <button class="btn-cancel" @click="rejectModal.open = false">Annuler</button>
          <button class="btn-danger-filled" @click="confirmReject">Refuser le dossier</button>
        </div>
      </div>
    </div>

    <!-- ── MODAL EDIT / CREATE ──────────────────────── -->
    <div v-if="editModal.open" class="modal-overlay" @click.self="editModal.open = false">
      <div class="form-modal large">
        <div class="modal-header">
          <h3>{{ editModal.mode === 'create' ? 'Créer' : 'Modifier' }} — {{ editModal.type === 'pro' ? 'Professionnel' : 'Client' }}</h3>
          <button @click="editModal.open = false"><X :size="20" /></button>
        </div>

        <!-- Champs pro -->
        <template v-if="editModal.type === 'pro'">
          <div class="modal-grid">
            <div class="mf"><label>Prénom</label><input v-model="editModal.data.firstName" /></div>
            <div class="mf"><label>Nom</label><input v-model="editModal.data.lastName" /></div>
            <div class="mf"><label>Email</label><input v-model="editModal.data.email" :disabled="editModal.mode === 'edit'" /></div>
            <div class="mf"><label>Téléphone</label><input v-model="editModal.data.phone" /></div>
            <div class="mf"><label>Nom du salon</label><input v-model="editModal.data.salonName" /></div>
            <div class="mf"><label>SIRET</label><input v-model="editModal.data.siret" :disabled="editModal.mode === 'edit'" /></div>
            <div class="mf"><label>Adresse</label><input v-model="editModal.data.address" /></div>
            <div class="mf"><label>Ville</label><input v-model="editModal.data.city" /></div>
            <div class="mf"><label>Code postal</label><input v-model="editModal.data.postalCode" /></div>
            <div class="mf"><label>IBAN</label><input v-model="editModal.data.iban" /></div>
            <div class="mf" v-if="editModal.mode === 'create'">
              <label>Mot de passe</label>
              <input v-model="editModal.data.password" type="password" />
            </div>
            <div class="mf">
              <label>Statut KYC</label>
              <select v-model="editModal.data['kyc.status']">
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
                <option value="rejected">Refusé</option>
              </select>
            </div>
          </div>
        </template>

        <!-- Champs client -->
        <template v-else>
          <div class="modal-grid">
            <div class="mf"><label>Prénom</label><input v-model="editModal.data.firstName" /></div>
            <div class="mf"><label>Nom</label><input v-model="editModal.data.lastName" /></div>
            <div class="mf"><label>Email</label><input v-model="editModal.data.email" :disabled="editModal.mode === 'edit'" /></div>
            <div class="mf"><label>Téléphone</label><input v-model="editModal.data.phone" /></div>
            <div class="mf">
              <label>Code postal <span style="font-weight:300;color:#bbb">(optionnel)</span></label>
              <input v-model="editModal.data.postalCode" type="text" placeholder="75001" maxlength="5" inputmode="numeric" />
            </div>
            <div class="mf" v-if="editModal.mode === 'create'">
              <label>Mot de passe</label>
              <input v-model="editModal.data.password" type="password" />
            </div>
          </div>
        </template>

        <p v-if="editModal.error" class="api-error">{{ editModal.error }}</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="editModal.open = false">Annuler</button>
          <button class="btn-primary-filled" @click="submitEditModal" :disabled="editModal.saving">
            {{ editModal.saving ? 'Enregistrement…' : (editModal.mode === 'create' ? 'Créer' : 'Enregistrer') }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── MODAL CONFIRMATION SUPPRESSION ──────────── -->
    <div v-if="deleteModal.open" class="modal-overlay" @click.self="deleteModal.open = false">
      <div class="form-modal small">
        <div class="modal-header">
          <h3>Confirmer la suppression</h3>
          <button @click="deleteModal.open = false"><X :size="20" /></button>
        </div>
        <p class="modal-sub">Cette action est irréversible.</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="deleteModal.open = false">Annuler</button>
          <button class="btn-danger-filled" @click="submitDelete">Supprimer</button>
        </div>
      </div>
    </div>

    <!-- ── MODAL CATÉGORIE ──────────────────────────── -->
    <div v-if="catModal.open" class="modal-overlay" @click.self="catModal.open = false">
      <div class="form-modal">
        <div class="modal-header">
          <h3>{{ catModal.id ? 'Modifier la catégorie' : 'Nouvelle catégorie' }}</h3>
          <button @click="catModal.open = false"><X :size="20" /></button>
        </div>
        <div class="modal-grid">
          <div class="mf full"><label>Nom <span class="req">*</span></label><input v-model="catModal.name" placeholder="Ex : Coiffure" /></div>
          <div class="mf full"><label>Slug <span class="req">*</span></label><input v-model="catModal.slug" placeholder="Ex : coiffure" /></div>
          <div class="mf full"><label>Icône (nom Lucide)</label><input v-model="catModal.icon" placeholder="Ex : Scissors" /></div>
          <div class="mf full"><label>Description</label><input v-model="catModal.description" /></div>
          <div class="mf full">
            <label>
              <input type="checkbox" v-model="catModal.active" style="margin-right:.4rem" /> Active
            </label>
          </div>
        </div>
        <p v-if="catModal.error" class="modal-error">{{ catModal.error }}</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="catModal.open = false">Annuler</button>
          <button class="btn-primary" @click="submitCat" :disabled="catModal.saving">
            <Loader2 v-if="catModal.saving" :size="15" class="spin" /> Enregistrer
          </button>
        </div>
      </div>
    </div>

    <!-- ── MODAL SOUS-CATÉGORIE ─────────────────────── -->
    <div v-if="subcatModal.open" class="modal-overlay" @click.self="subcatModal.open = false">
      <div class="form-modal">
        <div class="modal-header">
          <h3>Ajouter une sous-catégorie</h3>
          <button @click="subcatModal.open = false"><X :size="20" /></button>
        </div>
        <p class="modal-sub">{{ subcatModal.catName }}</p>
        <div class="modal-grid">
          <div class="mf full"><label>Nom <span class="req">*</span></label><input v-model="subcatModal.name" placeholder="Ex : Coupe femme" /></div>
          <div class="mf full"><label>Slug <span class="req">*</span></label><input v-model="subcatModal.slug" placeholder="Ex : coupe-femme" /></div>
        </div>
        <p v-if="subcatModal.error" class="modal-error">{{ subcatModal.error }}</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="subcatModal.open = false">Annuler</button>
          <button class="btn-primary" @click="submitSubcat" :disabled="subcatModal.saving">
            <Loader2 v-if="subcatModal.saving" :size="15" class="spin" /> Ajouter
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch, defineComponent, h } from 'vue'
import { useRouter } from 'vue-router'
import {
  LayoutDashboard, Users, Scissors, FileCheck, Search,
  LogOut, PanelLeftClose, PanelLeftOpen, Clock, CheckCircle,
  UserPlus, Pencil, Trash2, FileText, Check, X, Plus, Loader2, Tag, Mail, Settings, CreditCard
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const router    = useRouter()
const authStore = useAuthStore()
const toast     = useToast()

// ── Sidebar ──────────────────────────────────────────
const sidebarClosed = ref(false)
const section = ref<'dashboard' | 'kyc' | 'pros' | 'clients' | 'categories' | 'emails' | 'payments' | 'settings'>('dashboard')

const navItems = [
  { key: 'dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
  { key: 'kyc',        label: 'Demandes KYC',    icon: FileCheck, badge: 'pending' },
  { key: 'pros',       label: 'Professionnels',  icon: Scissors },
  { key: 'clients',    label: 'Clients',         icon: Users },
  { key: 'emails',     label: 'Emails',          icon: Mail },
  { key: 'payments',   label: 'Paiements',       icon: CreditCard },
  { key: 'categories', label: 'Catégories',      icon: Tag },
  { key: 'settings',   label: 'Paramètres',      icon: Settings }
] as const

const currentSection = computed(() => navItems.find(n => n.key === section.value))

// ── Admin user ────────────────────────────────────────
const adminUser = computed(() => authStore.user)
const adminInitials = computed(() => {
  const u = adminUser.value as any
  if (!u) return 'A'
  return ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || 'A'
})

const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

// ── API helper ────────────────────────────────────────
async function api (url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authStore.token}`,
      ...(options.headers || {})
    }
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Erreur serveur')
  return data
}

// ── Stats ─────────────────────────────────────────────
const stats = ref<{ clients: number; pros: number; pending: number; approved: number } | null>(null)

async function fetchStats () {
  try { stats.value = await api('/api/admin/stats') }
  catch {}
}

// ── KYC list ─────────────────────────────────────────
const kyc = reactive({ list: [] as any[], total: 0, page: 1, pages: 1, loading: false, search: '', statusFilter: 'pending' })

async function fetchKycList () {
  kyc.loading = true
  try {
    const p = new URLSearchParams({
      page: String(kyc.page), limit: '20',
      search: kyc.search, status: kyc.statusFilter
    })
    const d = await api(`/api/admin/pros?${p}`)
    kyc.list = d.data; kyc.total = d.total; kyc.pages = d.pages
  } finally { kyc.loading = false }
}

// ── Pros list ─────────────────────────────────────────
const pros = reactive({ list: [] as any[], total: 0, page: 1, pages: 1, loading: false, search: '', statusFilter: '' })

async function fetchProsList () {
  pros.loading = true
  try {
    const p = new URLSearchParams({ page: String(pros.page), limit: '20', search: pros.search, status: pros.statusFilter })
    const d = await api(`/api/admin/pros?${p}`)
    pros.list = d.data; pros.total = d.total; pros.pages = d.pages
  } finally { pros.loading = false }
}

// ── Clients list ──────────────────────────────────────
const clients = reactive({ list: [] as any[], total: 0, page: 1, pages: 1, loading: false, search: '' })

async function fetchClientsList () {
  clients.loading = true
  try {
    const p = new URLSearchParams({ page: String(clients.page), limit: '20', search: clients.search })
    const d = await api(`/api/admin/clients?${p}`)
    clients.list = d.data; clients.total = d.total; clients.pages = d.pages
  } finally { clients.loading = false }
}

// Debounce
let proTimer = 0, clientTimer = 0
function debounceFetchPros () { clearTimeout(proTimer); proTimer = setTimeout(fetchProsList, 300) }
function debounceFetchClients () { clearTimeout(clientTimer); clientTimer = setTimeout(fetchClientsList, 300) }

async function forceVerifyClient (id: string) {
  try {
    await api(`/api/admin/clients/${id}/verify-email`, { method: 'PATCH' })
    toast.success('Email marqué comme vérifié.')
    fetchClientsList()
  } catch (err: any) { toast.error(err.message) }
}

async function resendClientVerify (id: string) {
  try {
    await api(`/api/admin/clients/${id}/resend-verification`, { method: 'POST' })
    toast.success('Email de vérification renvoyé.')
  } catch (err: any) { toast.error(err.message) }
}

// ── Email logs ────────────────────────────────────────
const emails = reactive({
  list: [] as any[],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  statusFilter: '',
  typeFilter: ''
})

async function fetchEmailLogs () {
  emails.loading = true
  try {
    const p = new URLSearchParams({ page: String(emails.page), limit: '30' })
    if (emails.statusFilter) p.set('status', emails.statusFilter)
    if (emails.typeFilter) p.set('type', emails.typeFilter)
    const d = await api(`/api/admin/emails?${p}`)
    emails.list = d.data
    emails.total = d.total
    emails.pages = d.pages
  } finally { emails.loading = false }
}

const payments = reactive({
  list: [] as any[],
  total: 0,
  page: 1,
  pages: 1,
  loading: false,
  statusFilter: ''
})

async function fetchPayments () {
  payments.loading = true
  try {
    const p = new URLSearchParams({ page: String(payments.page), limit: '30' })
    if (payments.statusFilter) p.set('status', payments.statusFilter)
    const d = await api(`/api/admin/payments?${p}`)
    payments.list = d.data
    payments.total = d.total
    payments.pages = d.pages
  } finally { payments.loading = false }
}

// ── KYC actions ──────────────────────────────────────
async function setKycStatus (id: string, status: string, rejectReason?: string) {
  try {
    await api(`/api/admin/pros/${id}/kyc`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejectReason })
    })
    toast.success(status === 'approved' ? 'Dossier approuvé !' : 'Dossier refusé.')
    fetchStats(); fetchKycList()
  } catch (err: any) { toast.error(err.message) }
}

const rejectModal = reactive({ open: false, proId: '', proName: '', reason: '' })

function openRejectModal (pro: any) {
  rejectModal.proId  = pro._id
  rejectModal.proName = `${pro.firstName} ${pro.lastName} — ${pro.salonName}`
  rejectModal.reason = ''
  rejectModal.open   = true
}

async function confirmReject () {
  await setKycStatus(rejectModal.proId, 'rejected', rejectModal.reason)
  rejectModal.open = false
}

// ── Document modal ────────────────────────────────────
const docModal = reactive({ open: false, url: '', title: '', isPdf: false, loading: false, error: '' })

// Libère le Blob URL précédent pour éviter les fuites mémoire
function releaseBlobUrl () {
  if (docModal.url.startsWith('blob:')) URL.revokeObjectURL(docModal.url)
}

function closeDocModal () {
  docModal.open = false
  releaseBlobUrl()
  docModal.url = ''
}

async function openDoc (filename: string, title: string) {
  releaseBlobUrl()
  docModal.url     = ''
  docModal.error   = ''
  docModal.loading = true
  docModal.isPdf   = filename.toLowerCase().endsWith('.pdf')
  docModal.title   = title
  docModal.open    = true
  try {
    // On fetch avec le header Authorization car <img src> / <iframe src>
    // ne peuvent pas envoyer de token Bearer nativement
    const res = await fetch(`/api/admin/docs/${filename}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (!res.ok) throw new Error(`Erreur ${res.status}`)
    const blob = await res.blob()
    docModal.url = URL.createObjectURL(blob)
  } catch (err: any) {
    docModal.error = err.message || 'Impossible de charger le document.'
  } finally {
    docModal.loading = false
  }
}

// ── Edit / Create modal ───────────────────────────────
const editModal = reactive({
  open: false, mode: 'create' as 'create' | 'edit',
  type: 'pro' as 'pro' | 'client',
  id: '', data: {} as any, error: '', saving: false
})

function openCreateModal (type: 'pro' | 'client') {
  editModal.mode  = 'create'
  editModal.type  = type
  editModal.id    = ''
  editModal.data  = type === 'pro'
    ? { firstName: '', lastName: '', email: '', phone: '', salonName: '', siret: '', address: '', city: '', postalCode: '', iban: '', password: '', 'kyc.status': 'approved' }
    : { firstName: '', lastName: '', email: '', phone: '', postalCode: '', password: '' }
  editModal.error = ''
  editModal.open  = true
}

function openEditModal (type: 'pro' | 'client', item: any) {
  editModal.mode  = 'edit'
  editModal.type  = type
  editModal.id    = item._id
  editModal.data  = type === 'pro'
    ? {
        firstName: item.firstName, lastName: item.lastName,
        email: item.email, phone: item.phone || '',
        salonName: item.salonName, siret: item.siret,
        address: item.address || '', city: item.city || '',
        postalCode: item.postalCode || '', iban: item.iban || '',
        'kyc.status': item.kyc?.status || 'pending'
      }
    : { firstName: item.firstName, lastName: item.lastName, email: item.email, phone: item.phone || '', postalCode: item.postalCode || '' }
  editModal.error = ''; editModal.open = true
}

async function submitEditModal () {
  editModal.saving = true; editModal.error = ''
  try {
    const url = editModal.mode === 'create'
      ? `/api/admin/${editModal.type}s`
      : `/api/admin/${editModal.type}s/${editModal.id}`
    await api(url, { method: editModal.mode === 'create' ? 'POST' : 'PUT', body: JSON.stringify(editModal.data) })
    toast.success(editModal.mode === 'create' ? 'Compte créé avec succès !' : 'Modifications enregistrées.')
    editModal.open = false
    if (editModal.type === 'pro') { fetchProsList(); fetchStats() }
    else { fetchClientsList(); fetchStats() }
  } catch (err: any) { editModal.error = err.message }
  finally { editModal.saving = false }
}

// ── Delete modal ──────────────────────────────────────
const deleteModal = reactive({ open: false, type: '' as 'pro' | 'client', id: '' })

function confirmDelete (type: 'pro' | 'client', id: string) {
  deleteModal.type = type; deleteModal.id = id; deleteModal.open = true
}

async function submitDelete () {
  try {
    await api(`/api/admin/${deleteModal.type}s/${deleteModal.id}`, { method: 'DELETE' })
    toast.success('Supprimé avec succès.')
    deleteModal.open = false
    if (deleteModal.type === 'pro') { fetchProsList(); fetchStats() }
    else { fetchClientsList(); fetchStats() }
  } catch (err: any) { toast.error(err.message) }
}

// ── Helpers ───────────────────────────────────────────
function initials (u: any) {
  return ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || '?'
}
function formatDate (d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
function kycLabel (status?: string) {
  const map: Record<string, string> = { pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé' }
  return map[status || 'pending'] || status || '?'
}
function handleLogout () {
  authStore.logout(); router.push('/login/admin')
}

// ── Catégories ────────────────────────────────────────
interface AdminCategory {
  _id: string; name: string; slug: string; icon: string
  description: string; active: boolean; order: number
  subcategories: { _id: string; name: string; slug: string; active: boolean }[]
}
const catsList   = ref<AdminCategory[]>([])
const catsLoading = ref(false)

async function fetchCats () {
  catsLoading.value = true
  try {
    const res  = await fetch('/api/admin/categories', {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    catsList.value = data.data || []
  } catch {}
  finally { catsLoading.value = false }
}

const catModal = reactive({
  open: false, saving: false, error: '',
  id: '', name: '', slug: '', icon: '', description: '', active: true
})

function openCatModal (cat: AdminCategory | null) {
  Object.assign(catModal, {
    open: true, saving: false, error: '',
    id: cat?._id || '', name: cat?.name || '', slug: cat?.slug || '',
    icon: cat?.icon || '', description: cat?.description || '',
    active: cat?.active ?? true
  })
}

async function submitCat () {
  if (!catModal.name || !catModal.slug) { catModal.error = 'Nom et slug obligatoires.'; return }
  catModal.saving = true; catModal.error = ''
  const url    = catModal.id ? `/api/admin/categories/${catModal.id}` : '/api/admin/categories'
  const method = catModal.id ? 'PUT' : 'POST'
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({
        name: catModal.name, slug: catModal.slug, icon: catModal.icon,
        description: catModal.description, active: catModal.active
      })
    })
    if (!res.ok) { const d = await res.json(); catModal.error = d.message || 'Erreur'; return }
    toast.success(catModal.id ? 'Catégorie modifiée.' : 'Catégorie créée.')
    catModal.open = false
    fetchCats()
  } catch { catModal.error = 'Erreur réseau.' }
  finally { catModal.saving = false }
}

async function deleteCat (id: string) {
  if (!confirm('Supprimer cette catégorie ?')) return
  await fetch(`/api/admin/categories/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authStore.token}` }
  })
  toast.success('Catégorie supprimée.')
  fetchCats()
}

const subcatModal = reactive({
  open: false, saving: false, error: '',
  catId: '', catName: '', name: '', slug: ''
})

function openSubcatModal (cat: AdminCategory) {
  Object.assign(subcatModal, {
    open: true, saving: false, error: '',
    catId: cat._id, catName: cat.name, name: '', slug: ''
  })
}

async function submitSubcat () {
  if (!subcatModal.name || !subcatModal.slug) { subcatModal.error = 'Nom et slug obligatoires.'; return }
  subcatModal.saving = true; subcatModal.error = ''
  try {
    const res = await fetch(`/api/admin/categories/${subcatModal.catId}/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({ name: subcatModal.name, slug: subcatModal.slug })
    })
    if (!res.ok) { const d = await res.json(); subcatModal.error = d.message || 'Erreur'; return }
    toast.success('Sous-catégorie ajoutée.')
    subcatModal.open = false
    fetchCats()
  } catch { subcatModal.error = 'Erreur réseau.' }
  finally { subcatModal.saving = false }
}

async function deleteSubcat (catId: string, subId: string) {
  if (!confirm('Supprimer cette sous-catégorie ?')) return
  await fetch(`/api/admin/categories/${catId}/subcategories/${subId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${authStore.token}` }
  })
  toast.success('Sous-catégorie supprimée.')
  fetchCats()
}

// ── Paramètres plateforme ─────────────────────────────
const platformSettings = reactive({
  depositPercent: 20,
  commissionPercent: 10,
  referralCashbackEnabled: false,
  loading: false,
  saving: false,
  error: ''
})

async function fetchPlatformSettings () {
  platformSettings.loading = true
  platformSettings.error = ''
  try {
    const d = await api('/api/admin/settings')
    platformSettings.depositPercent          = d.data.depositPercent
    platformSettings.commissionPercent       = d.data.commissionPercent
    platformSettings.referralCashbackEnabled = Boolean(d.data.referralCashbackEnabled)
  } catch (err: any) {
    platformSettings.error = err.message || 'Impossible de charger les paramètres.'
  } finally {
    platformSettings.loading = false
  }
}

async function savePlatformSettings () {
  const deposit = Number(platformSettings.depositPercent)
  const commission = Number(platformSettings.commissionPercent)

  if (!Number.isFinite(deposit) || deposit < 0 || deposit > 100) {
    platformSettings.error = 'Le pourcentage d\'acompte doit être entre 0 et 100.'
    return
  }
  if (!Number.isFinite(commission) || commission < 0 || commission > 100) {
    platformSettings.error = 'Le taux de commission doit être entre 0 et 100.'
    return
  }

  platformSettings.saving = true
  platformSettings.error = ''
  try {
    const d = await api('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify({
        depositPercent: deposit,
        commissionPercent: commission,
        referralCashbackEnabled: platformSettings.referralCashbackEnabled
      })
    })
    platformSettings.depositPercent          = d.data.depositPercent
    platformSettings.commissionPercent       = d.data.commissionPercent
    platformSettings.referralCashbackEnabled = Boolean(d.data.referralCashbackEnabled)
    toast.success('Paramètres enregistrés.')
  } catch (err: any) {
    platformSettings.error = err.message
  } finally {
    platformSettings.saving = false
  }
}

// ── Init ──────────────────────────────────────────────
onMounted(() => {
  fetchStats(); fetchKycList(); fetchProsList(); fetchClientsList(); fetchCats()
})

watch(section, (s) => {
  if (s === 'emails') fetchEmailLogs()
  if (s === 'payments') fetchPayments()
  if (s === 'settings') fetchPlatformSettings()
})

// ── Pagination component ──────────────────────────────
const Pagination = defineComponent({
  props: { page: Number, pages: Number },
  emits: ['change'],
  setup (props, { emit }) {
    return () => {
      if (!props.pages || props.pages <= 1) return null
      const items = []
      for (let i = 1; i <= props.pages!; i++) {
        items.push(h('button', {
          class: ['page-btn', { active: i === props.page }],
          onClick: () => emit('change', i)
        }, String(i)))
      }
      return h('div', { class: 'pagination' }, items)
    }
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════
   Palette claire — identique au ClientDashboardView
   bg:     #F8F5F2
   card:   #fff
   border: #E4E0DC / #F0EBE8
   text:   #4F3942 / #111
   accent: #D1A1C7 / #EADAF3
   ═══════════════════════════════════════════════════════ */

/* ── Shell ────────────────────────────────────────────── */
.admin-shell {
  display: flex;
  min-height: 100vh;
  background: #F8F5F2;
  color: #111;
  font-family: "Poppins", sans-serif;
}

/* ── Sidebar ──────────────────────────────────────────── */
.admin-sidebar {
  width: 250px;
  min-height: 100vh;
  background: #fff;
  border-right: 1px solid #E4E0DC;
  display: flex;
  flex-direction: column;
  position: sticky; top: 0;
  height: 100vh;
  overflow-y: auto;
  transition: width 0.3s ease;
  overflow-x: hidden;
  flex-shrink: 0;
}
.admin-sidebar.collapsed { width: 64px; }

.sidebar-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.25rem 1.25rem;
  border-bottom: 1px solid #F0EBE8;
  min-height: 64px;
}
.sidebar-logo { height: 28px; width: auto; flex-shrink: 0; }
.admin-sidebar.collapsed .sidebar-logo { display: none; }

.sidebar-toggle {
  background: none; border: none; color: #aaa;
  cursor: pointer; padding: 0.25rem; display: flex;
  transition: color 0.2s; flex-shrink: 0;
}
.sidebar-toggle:hover { color: #4F3942; }

.sidebar-nav {
  flex: 1; padding: 0.75rem;
  display: flex; flex-direction: column; gap: 0.25rem;
}

.nav-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.7rem 0.9rem; border: none; background: none;
  color: #888; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.83rem; font-weight: 500;
  text-align: left; transition: all 0.22s ease;
  border-radius: 10px; white-space: nowrap; width: 100%;
}
.nav-item:hover  { background: #F8F5F2; color: #4F3942; }
.nav-item.active { background: #EADAF3; color: #4F3942; font-weight: 600; }

.nav-label { flex: 1; }
.admin-sidebar.collapsed .nav-label { display: none; }

.nav-badge {
  background: #c0565b; color: #fff;
  font-size: 0.65rem; font-weight: 700;
  padding: 0.1rem 0.45rem; border-radius: 999px; min-width: 18px; text-align: center;
}
.admin-sidebar.collapsed .nav-badge { display: none; }

.sidebar-footer {
  padding: 1rem 1.25rem; border-top: 1px solid #F0EBE8;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.admin-info { display: flex; align-items: center; gap: 0.75rem; overflow: hidden; }
.admin-avatar {
  width: 34px; height: 34px; border-radius: 50%;
  background: linear-gradient(135deg, #4F3942, #D1A1C7);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.75rem; font-weight: 700; color: #fff;
  flex-shrink: 0;
}
.admin-meta { display: flex; flex-direction: column; overflow: hidden; }
.admin-name {
  font-size: 0.83rem; font-weight: 600; color: #4F3942;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.admin-role { font-size: 0.68rem; color: #aaa; }
.admin-sidebar.collapsed .admin-meta { display: none; }

.btn-logout {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 0; background: none; border: none;
  color: #aaa; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.82rem; font-weight: 500;
  transition: color 0.2s; white-space: nowrap;
}
.btn-logout:hover { color: #c0565b; }
.admin-sidebar.collapsed .btn-logout .nav-label { display: none; }

/* ── Main ─────────────────────────────────────────────── */
.admin-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

.admin-topbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 2rem;
  height: 64px;
  border-bottom: 1px solid #E4E0DC;
  background: #fff; position: sticky; top: 0; z-index: 5;
}
.admin-topbar h1 {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 1.35rem; font-weight: 700; color: #4F3942;
}
.topbar-date { font-size: 0.78rem; color: #aaa; }

/* ── Section ──────────────────────────────────────────── */
.section-content { padding: 2rem; flex: 1; }

/* ── Stats ────────────────────────────────────────────── */
.stats-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem; margin-bottom: 2rem;
}
.stat-card {
  background: #fff; border: 1px solid #E4E0DC;
  border-radius: 16px; padding: 1.25rem 1.5rem;
  display: flex; align-items: center; gap: 1rem;
  transition: transform 0.2s, box-shadow 0.2s;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(79,57,66,0.08); }
.stat-card.accent { border-color: #f5c0c2; background: #fff5f5; }

.stat-icon { padding: 0.6rem; border-radius: 10px; }
.stat-icon.purple { color: #8c5e8a; background: #EADAF3; }
.stat-icon.pink   { color: #D1A1C7; background: #f5eaf3; }
.stat-icon.orange { color: #c87941; background: #fef0e3; }
.stat-icon.green  { color: #2e7d32; background: #edf7ed; }

.stat-info { display: flex; flex-direction: column; }
.stat-val { font-size: 1.8rem; font-weight: 700; font-family: "Montserrat", sans-serif; line-height: 1; color: #4F3942; }
.stat-label { font-size: 0.75rem; color: #aaa; margin-top: 0.2rem; }

/* ── Quick actions ────────────────────────────────────── */
.quick-actions { margin-top: 1rem; }
.section-title {
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase;
  color: #aaa; margin-bottom: 1rem;
}
.qa-grid { display: flex; gap: 1rem; flex-wrap: wrap; }
.qa-btn {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.75rem 1.25rem;
  background: #EADAF3; border: 1px solid #d8c2d4;
  color: #4F3942; border-radius: 12px; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.82rem; font-weight: 600;
  transition: all 0.2s;
}
.qa-btn:hover { background: #D1A1C7; color: #fff; transform: translateY(-1px); }

/* ── Toolbar ──────────────────────────────────────────── */
.toolbar {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; margin-bottom: 1.25rem; flex-wrap: wrap;
}
.toolbar-left { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }

.search-wrap {
  display: flex; align-items: center; gap: 0.5rem;
  background: #fff; border: 1px solid #E4E0DC;
  border-radius: 10px; padding: 0.5rem 0.85rem;
  color: #aaa;
}
.search-wrap input {
  background: none; border: none; outline: none;
  color: #111; font-family: "Poppins", sans-serif;
  font-size: 0.85rem; font-weight: 300; width: 220px;
}
.search-wrap input::placeholder { color: #ccc; }

.filter-select {
  background: #fff; border: 1px solid #E4E0DC;
  color: #4F3942; border-radius: 10px; padding: 0.5rem 0.85rem;
  font-family: "Poppins", sans-serif; font-size: 0.85rem; outline: none;
}
.total-label { font-size: 0.8rem; color: #aaa; }

.btn-create {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  background: #4F3942; color: #fff;
  border: none; border-radius: 999px; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 700;
  transition: background 0.2s;
}
.btn-create:hover { background: #D1A1C7; }

/* ── Table ────────────────────────────────────────────── */
.table-wrap {
  background: #fff; border: 1px solid #E4E0DC;
  border-radius: 16px; overflow: hidden; overflow-x: auto;
}
.admin-table { width: 100%; border-collapse: collapse; }
.admin-table th {
  padding: 0.85rem 1rem; text-align: left;
  font-family: "Montserrat", sans-serif; font-size: 0.7rem;
  font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
  color: #aaa;
  border-bottom: 1px solid #F0EBE8;
  background: #F8F5F2;
}
.admin-table td {
  padding: 0.85rem 1rem; font-size: 0.85rem; color: #333;
  border-bottom: 1px solid #F0EBE8;
  vertical-align: middle;
}
.admin-table tr:last-child td { border-bottom: none; }
.admin-table tr:hover td { background: #FDFAF8; }
.loading-row, .empty-row { text-align: center; color: #bbb; padding: 2.5rem !important; }

.cell-user { display: flex; align-items: center; gap: 0.75rem; }
.avatar-sm {
  width: 32px; height: 32px; border-radius: 50%;
  background: linear-gradient(135deg, #4F3942, #D1A1C7);
  display: flex; align-items: center; justify-content: center;
  font-size: 0.68rem; font-weight: 700; color: #fff; flex-shrink: 0;
}
.cell-name { display: block; font-weight: 500; font-size: 0.85rem; color: #4F3942; }
.cell-sub  { display: block; font-size: 0.72rem; color: #aaa; }
.cell-sub--warn { color: #b42318; }

.badge {
  display: inline-block; padding: 0.2rem 0.65rem;
  border-radius: 999px; font-size: 0.7rem; font-weight: 600;
  font-family: "Montserrat", sans-serif;
}
.badge.pending  { background: #fef0e3; color: #c87941; }
.badge.approved { background: #edf7ed; color: #2e7d32; }
.badge.rejected { background: #fdecea; color: #c0565b; }

code { font-size: 0.75rem; color: #888; background: #F8F5F2; padding: 0.1rem 0.4rem; border-radius: 4px; }

.doc-btns { display: flex; gap: 0.4rem; flex-wrap: wrap; }
.doc-btn {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.3rem 0.6rem;
  background: #EADAF3; border: 1px solid #d8c2d4;
  color: #4F3942; border-radius: 6px; cursor: pointer;
  font-size: 0.72rem; font-weight: 600; transition: all 0.2s;
}
.doc-btn:hover { background: #D1A1C7; color: #fff; }
.no-doc { color: #ccc; font-size: 0.8rem; }

.action-btns { display: flex; gap: 0.4rem; }
.btn-approve, .btn-reject, .btn-icon {
  width: 30px; height: 30px; border-radius: 8px; border: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s; flex-shrink: 0;
}
.btn-approve { background: #edf7ed; color: #2e7d32; }
.btn-approve:hover:not(:disabled) { background: #c8e6c9; }
.btn-reject  { background: #fdecea; color: #c0565b; }
.btn-reject:hover:not(:disabled)  { background: #f9c4c6; }
.btn-icon    { background: #F8F5F2; color: #888; border: 1px solid #E4E0DC; }
.btn-icon:hover { background: #EADAF3; color: #4F3942; border-color: #d8c2d4; }
.btn-icon.danger { color: #c0565b; }
.btn-icon.danger:hover { background: #fdecea; border-color: #f5c0c2; }
button:disabled { opacity: 0.35; cursor: not-allowed; }

/* ── Pagination ────────────────────────────────────────── */
:deep(.pagination) { display: flex; gap: 0.4rem; justify-content: center; padding: 1.5rem 0; }
:deep(.page-btn) {
  width: 34px; height: 34px; border-radius: 8px; border: 1px solid #E4E0DC;
  background: #fff; color: #888;
  cursor: pointer; font-family: "Montserrat", sans-serif; font-size: 0.8rem;
  transition: all 0.2s;
}
:deep(.page-btn:hover)  { border-color: #D1A1C7; color: #4F3942; }
:deep(.page-btn.active) { background: #4F3942; border-color: #4F3942; color: #fff; font-weight: 700; }

/* ── Modals ────────────────────────────────────────────── */
.modal-overlay {
  position: fixed; inset: 0;
  background: rgba(79,57,66,0.45); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1.5rem;
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1.25rem;
}
.modal-header h3 {
  font-family: "Playfair Display", serif; font-size: 1.2rem; font-weight: 700; color: #4F3942;
}
.modal-header button {
  background: none; border: none; color: #aaa;
  cursor: pointer; display: flex; transition: color 0.2s;
}
.modal-header button:hover { color: #4F3942; }
.modal-sub { color: #888; font-size: 0.85rem; margin-bottom: 1rem; }

.doc-modal {
  background: #fff; border: 1px solid #E4E0DC;
  border-radius: 20px; padding: 1.5rem; width: 100%; max-width: 860px;
}
.doc-viewer { border-radius: 12px; overflow: hidden; background: #F8F5F2; min-height: 400px; }
.doc-frame { width: 100%; height: 540px; border: none; display: block; }
.doc-img   { max-width: 100%; max-height: 540px; display: block; margin: auto; object-fit: contain; }
.doc-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.75rem; min-height: 400px;
  color: #888; font-size: 0.85rem; font-family: "Montserrat", sans-serif;
}
.doc-error {
  text-align: center; padding: 3rem;
  color: #c0565b; font-size: 0.85rem;
}

.form-modal {
  background: #fff; border: 1px solid #E4E0DC;
  border-radius: 20px; padding: 1.75rem; width: 100%;
}
.form-modal.large  { max-width: 680px; }
.form-modal.small  { max-width: 420px; }
.form-modal:not(.large):not(.small) { max-width: 480px; }

.modal-textarea {
  width: 100%; min-height: 100px; padding: 0.75rem 1rem;
  background: #F8F5F2; border: 1px solid #E4E0DC;
  color: #111; border-radius: 10px; font-family: "Poppins", sans-serif;
  font-size: 0.88rem; resize: vertical; outline: none; margin-bottom: 1rem;
}
.modal-textarea:focus { border-color: #D1A1C7; box-shadow: 0 0 0 3px rgba(209,161,199,0.15); }

.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
.mf { display: flex; flex-direction: column; gap: 0.3rem; }
.mf label {
  font-family: "Montserrat", sans-serif; font-size: 0.72rem; font-weight: 600;
  color: #4F3942; letter-spacing: 0.05em;
}
.mf input, .mf select {
  padding: 0.6rem 0.85rem;
  background: #F8F5F2; border: 1px solid #E4E0DC;
  color: #111; border-radius: 8px; font-family: "Poppins", sans-serif;
  font-size: 0.85rem; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
.mf input:focus, .mf select:focus {
  border-color: #D1A1C7;
  box-shadow: 0 0 0 3px rgba(209,161,199,0.15);
  background: #fff;
}
.mf input:disabled { opacity: 0.5; cursor: not-allowed; }
.mf select option { background: #fff; }

.modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.25rem; }

.btn-cancel {
  padding: 0.65rem 1.25rem; background: none; border: 1px solid #E4E0DC;
  color: #888; border-radius: 999px; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; transition: all 0.2s;
}
.btn-cancel:hover { border-color: #4F3942; color: #4F3942; }

.btn-primary-filled {
  padding: 0.65rem 1.5rem; background: #4F3942; color: #fff;
  border: none; border-radius: 999px; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 700;
  transition: background 0.2s;
}
.btn-primary-filled:hover:not(:disabled) { background: #D1A1C7; }
.btn-primary-filled:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-danger-filled {
  padding: 0.65rem 1.5rem; background: #c0565b; color: #fff;
  border: none; border-radius: 999px; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 700;
  transition: background 0.2s;
}
.btn-danger-filled:hover { background: #d46b70; }

.api-error {
  background: #fdecea; color: #c0565b;
  border: 1px solid #f5c0c2; border-radius: 10px;
  padding: 0.65rem 0.9rem; font-size: 0.82rem; margin-bottom: 0.5rem;
}

.spinner-sm {
  width: 16px; height: 16px;
  border: 2px solid #E4E0DC; border-top-color: #4F3942;
  border-radius: 50%;
  animation: spin 0.8s linear infinite; display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Catégories ── */
.cats-list { display: flex; flex-direction: column; gap: 1rem; }
.cat-card {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 12px; padding: 1rem 1.25rem;
}
.cat-card__header {
  display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem;
}
.cat-card__name { font-weight: 600; font-size: 0.95rem; color: #2C1810; }
.cat-card__slug {
  font-size: 0.75rem; color: #888; background: #F0ECE8; border-radius: 6px; padding: 0.1rem 0.45rem;
}
.cat-status {
  font-size: 0.72rem; font-weight: 700; border-radius: 20px; padding: 0.15rem 0.5rem;
  text-transform: uppercase;
}
.cat-status.active   { background: #d4f5e0; color: #1a7a40; }
.cat-status.inactive { background: #fdecea; color: #c0565b; }

.email-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}
.email-badge.ok, .email-badge.sent { background: #d4f5e0; color: #1a7a40; }
.email-badge.pending { background: #fff3cd; color: #856404; }
.email-badge.failed { background: #fdecea; color: #c0565b; }
.email-badge.skipped { background: #eee; color: #666; }
.cat-card__actions { margin-left: auto; display: flex; gap: 0.35rem; }

.subcats { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.subcat-chip {
  background: #F8F2F5; border: 1px solid #E4D4E2; border-radius: 20px;
  padding: 0.2rem 0.6rem; font-size: 0.78rem; color: #4F3942;
  display: inline-flex; align-items: center; gap: 0.3rem;
}
.subcat-del {
  background: none; border: none; color: #c0565b; font-size: 0.9rem;
  cursor: pointer; line-height: 1; padding: 0 2px;
}
.subcat-del:hover { color: #a0404a; }
.subcat-add {
  background: none; border: 1px dashed #C4A4C0; color: #7A5570; border-radius: 20px;
  padding: 0.2rem 0.75rem; font-size: 0.78rem; cursor: pointer;
}
.subcat-add:hover { background: #F8F2F5; }

.section-heading { font-size: 1.1rem; font-weight: 700; color: #2C1810; }
.modal-error { color: #c0565b; font-size: 0.82rem; margin: 0.25rem 0; }
.req { color: #c0565b; }
.mf.full { grid-column: 1 / -1; }

.settings-card {
  max-width: 420px;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 16px;
  padding: 1.5rem;
}

.settings-field label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #4F3942;
  margin-bottom: 0.5rem;
}

.settings-field + .settings-field {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid #F0EBE8;
}

.settings-input-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings-input-row input {
  width: 100px;
  padding: 0.55rem 0.75rem;
  border: 1px solid #D8D2CC;
  border-radius: 10px;
  font-size: 1rem;
}

.settings-input-row input:focus {
  outline: none;
  border-color: #D1A1C7;
  box-shadow: 0 0 0 3px rgba(209,161,199,0.15);
}

.settings-suffix {
  font-size: 1rem;
  color: #7A5570;
}

.settings-hint {
  margin: 0.65rem 0 0;
  font-size: 0.78rem;
  color: #8A7A82;
  line-height: 1.45;
}

.settings-field--toggle {
  padding-top: 0.5rem;
  border-top: 1px solid #F0EBE8;
}

.settings-toggle {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  font-size: 0.88rem;
  font-weight: 600;
  color: #2C1810;
  cursor: pointer;
}

.settings-toggle input {
  width: 1rem;
  height: 1rem;
}

.settings-error {
  margin: 0.75rem 0 0;
  font-size: 0.82rem;
  color: #B42318;
}

.settings-actions {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid #F0EBE8;
}

.settings-save {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  min-width: 140px;
  justify-content: center;
}

.pay-admin-badge {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  background: #ece6ea;
  color: #4F3942;
}

.pay-admin-badge.succeeded { background: #e8f4ec; color: #2d6a4f; }
.pay-admin-badge.pending { background: #fff4e5; color: #b45309; }
.pay-admin-badge.failed,
.pay-admin-badge.expired { background: #fdecea; color: #b42318; }

@media (max-width: 768px) {
  .admin-sidebar { width: 64px; }
  .admin-sidebar .nav-label,
  .admin-sidebar .admin-meta,
  .admin-sidebar .sidebar-logo { display: none; }
  .admin-sidebar .nav-badge    { display: none; }
  .modal-grid { grid-template-columns: 1fr; }
  .section-content { padding: 1.25rem; }
}
</style>
