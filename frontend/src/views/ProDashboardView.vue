<template>
  <div class="dashboard">

    <!-- ── Sidebar ── -->
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar__top">
        <RouterLink to="/" class="sidebar__logo">
          <img src="@/assets/logo.svg" alt="C7'Beauty" />
        </RouterLink>
        <button class="sidebar__close" @click="sidebarOpen = false">
          <X :size="20" />
        </button>
      </div>

      <nav class="sidebar__nav">
        <button
          v-for="item in navItems" :key="item.id"
          class="sidebar__item"
          :class="{ active: activeSection === item.id }"
          @click="activeSection = item.id; sidebarOpen = false"
        >
          <component :is="item.icon" :size="19" :stroke-width="1.8" />
          <span>{{ item.label }}</span>
        </button>
      </nav>

      <div class="sidebar__pro-info">
        <div class="pro-badge-sm">{{ kycLabel }}</div>
      </div>

      <button class="sidebar__logout" @click="handleLogout">
        <LogOut :size="18" />
        <span>Se déconnecter</span>
      </button>
    </aside>

    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <!-- ── Main ── -->
    <div class="dashboard__main">

      <!-- Topbar -->
      <header class="topbar">
        <button class="topbar__burger" @click="sidebarOpen = true">
          <Menu :size="22" />
        </button>
        <div class="topbar__right">
          <span class="topbar__greeting">
            Bonjour, <strong>{{ pro?.firstName }}</strong> — <em>{{ pro?.salonName }}</em>
          </span>
          <div class="topbar__avatar">{{ initials }}</div>
        </div>
      </header>

      <!-- Banner KYC si en attente -->
      <div v-if="pro?.kyc?.status === 'pending'" class="kyc-banner">
        <Clock :size="16" />
        <span>Votre dossier KYC est en cours de vérification. Vous recevrez une réponse sous 48h.</span>
      </div>
      <div v-else-if="pro?.kyc?.status === 'rejected'" class="kyc-banner kyc-banner--rejected">
        <AlertCircle :size="16" />
        <span>Votre dossier a été refusé. Contactez le support pour plus d'informations.</span>
      </div>

      <!-- ── Accueil ── -->
      <section v-if="activeSection === 'home'" class="section-content">
        <h1 class="page-title">Mon espace pro</h1>

        <div class="cards-grid">
          <div class="summary-card summary-card--accent">
            <div class="summary-card__icon"><CalendarCheck :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ proStatsLoading ? '…' : proStats.todayCount }}</span>
              <span class="summary-card__label">RDV aujourd'hui</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-card__icon"><CalendarDays :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ proStatsLoading ? '…' : proStats.weekCount }}</span>
              <span class="summary-card__label">RDV cette semaine</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-card__icon"><TrendingUp :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">
                {{ proStatsLoading ? '…' : proStats.revenueWeek.toFixed(0) }}
                <span class="stat-unit">€</span>
              </span>
              <span class="summary-card__label">CA net prévu (semaine)</span>
            </div>
          </div>
          <div class="summary-card">
            <div class="summary-card__icon"><Clock :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ proStatsLoading ? '…' : proStats.totalConfirmed }}</span>
              <span class="summary-card__label">Réservations confirmées</span>
            </div>
          </div>
        </div>

        <div class="cards-grid cards-grid--secondary">
          <div class="summary-card summary-card--muted">
            <div class="summary-card__icon"><Star :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">
                {{ pro?.stats?.averageRating ? pro.stats.averageRating.toFixed(1) : '—' }}
                <span class="stat-unit">/ 5</span>
              </span>
              <span class="summary-card__label">Note moyenne</span>
            </div>
          </div>
          <div class="summary-card summary-card--muted">
            <div class="summary-card__icon"><MessageSquare :size="22" /></div>
            <div class="summary-card__body">
              <span class="summary-card__value">{{ pro?.stats?.reviewCount ?? 0 }}</span>
              <span class="summary-card__label">Avis clients</span>
            </div>
          </div>
        </div>

        <h2 class="section-title">Actions rapides</h2>
        <div class="actions-grid">
          <button v-for="a in quickActions" :key="a.id" class="action-card" @click="activeSection = a.target">
            <div class="action-card__icon"><component :is="a.icon" :size="26" :stroke-width="1.5" /></div>
            <span class="action-card__label">{{ a.label }}</span>
          </button>
        </div>

        <h2 class="section-title">Prochaine réservation</h2>
        <div v-if="proStatsLoading" class="svc-loading">
          <Loader2 :size="20" class="spin" />
        </div>
        <div v-else-if="nextProBooking" class="booking-preview">
          <p class="booking-preview__svc">{{ nextProBooking.serviceName }}</p>
          <p class="booking-preview__when">{{ formatProBookingDate(nextProBooking.start) }}</p>
          <p class="booking-preview__client">
            {{ nextProBooking.client?.firstName }} {{ nextProBooking.client?.lastName }}
            <span v-if="nextProBooking.client?.phone"> · {{ nextProBooking.client.phone }}</span>
          </p>
        </div>
        <div v-else class="empty-state">
          <CalendarX :size="36" />
          <p>Aucune réservation à venir.</p>
          <p class="empty-hint">Les réservations de vos clients apparaîtront ici.</p>
        </div>
      </section>

      <!-- ── Agenda ── -->
      <section v-else-if="activeSection === 'agenda'" class="section-content section-content--wide section-content--agenda">
        <div class="svc-header">
          <h1 class="page-title" style="margin:0">Mon agenda</h1>
          <select v-model="agendaCollaboratorId" class="agenda-select">
            <option value="">Salon (global)</option>
            <option v-for="c in collaborators" :key="c._id" :value="c._id">
              {{ c.firstName }} {{ c.lastName }}
            </option>
          </select>
        </div>
        <div class="pro-agenda-stats">
          <div class="pro-agenda-stats__card">
            <CalendarCheck :size="18" />
            <div>
              <span class="pro-agenda-stats__value">{{ proStatsLoading ? '…' : proStats.todayCount }}</span>
              <span class="pro-agenda-stats__label">Aujourd'hui</span>
            </div>
          </div>
          <div class="pro-agenda-stats__card">
            <CalendarDays :size="18" />
            <div>
              <span class="pro-agenda-stats__value">{{ proStatsLoading ? '…' : proStats.weekCount }}</span>
              <span class="pro-agenda-stats__label">Cette semaine</span>
            </div>
          </div>
          <div class="pro-agenda-stats__card">
            <TrendingUp :size="18" />
            <div>
              <span class="pro-agenda-stats__value">
                {{ proStatsLoading ? '…' : proStats.revenueWeek.toFixed(0) }} €
              </span>
              <span class="pro-agenda-stats__label">CA net (semaine)</span>
            </div>
          </div>
          <div class="pro-agenda-stats__card">
            <Clock :size="18" />
            <div>
              <span class="pro-agenda-stats__value">{{ agendaBookingsLoading ? '…' : agendaBookings.length }}</span>
              <span class="pro-agenda-stats__label">RDV période affichée</span>
            </div>
          </div>
        </div>
        <div class="agenda-toolbar">
          <div class="agenda-view-tabs">
            <button
              type="button"
              class="agenda-view-tab"
              :class="{ active: agendaViewMode === 'day' }"
              @click="agendaViewMode = 'day'"
            >
              <CalendarDays :size="16" /> Jour
            </button>
            <button
              type="button"
              class="agenda-view-tab"
              :class="{ active: agendaViewMode === 'week' }"
              @click="agendaViewMode = 'week'"
            >
              <CalendarCheck :size="16" /> Semaine
            </button>
            <button
              type="button"
              class="agenda-view-tab"
              :class="{ active: agendaViewMode === 'list' }"
              @click="agendaViewMode = 'list'"
            >
              <Clock :size="16" /> Liste
            </button>
          </div>
        </div>

        <p class="page-sub agenda-sub">
          <template v-if="agendaViewMode === 'day'">
            Vue jour — horaires du salon uniquement, sans scroll inutile. Cliquez sur un RDV pour le détail.
          </template>
          <template v-else-if="agendaViewMode === 'week'">
            Vue semaine — même plage horaire que vos ouvertures. Onglet Liste pour tout voir d'un coup.
          </template>
          <template v-else>
            Liste complète des rendez-vous de la période, triés par jour.
          </template>
        </p>

        <div v-if="!agendaCollaboratorId" class="agenda-hint">
          Sélectionnez un collaborateur pour gérer ses contraintes prestations.
        </div>

        <AgendaCalendar
          v-if="agendaViewMode === 'day'"
          ref="agendaCalRef"
          api-path="/api/pro/schedule/calendar"
          :collaborator-id="agendaCollaboratorId || null"
          :selectable="!!agendaCollaboratorId"
          :pro-mode="true"
          active-view="day"
          @date-click="openExceptionModal"
          @select="openConstraintModal"
          @event-click="onAgendaEventClick"
          @range-change="onAgendaRangeChange"
        />
        <AgendaCalendar
          v-else-if="agendaViewMode === 'week'"
          ref="agendaCalRef"
          api-path="/api/pro/schedule/calendar"
          :collaborator-id="agendaCollaboratorId || null"
          :selectable="!!agendaCollaboratorId"
          :pro-mode="true"
          active-view="week"
          @date-click="openExceptionModal"
          @select="openConstraintModal"
          @event-click="onAgendaEventClick"
          @range-change="onAgendaRangeChange"
        />

        <!-- Liste détaillée -->
        <div v-if="agendaViewMode === 'list'" class="agenda-bookings agenda-bookings--solo">
          <div class="agenda-bookings__head">
            <h2 class="agenda-bookings__title">Réservations de la période</h2>
            <span v-if="agendaBookingsLoading" class="agenda-bookings__meta">
              <Loader2 :size="14" class="spin" />
            </span>
            <span v-else class="agenda-bookings__meta">{{ agendaBookings.length }} rendez-vous</span>
          </div>

          <div v-if="!agendaBookingsLoading && !agendaBookings.length" class="empty-state agenda-bookings__empty">
            <CalendarX :size="28" />
            <p>Aucune réservation sur cette période.</p>
          </div>

          <div v-else class="agenda-bookings__days">
            <section
              v-for="group in agendaBookingsGrouped"
              :key="group.dayKey"
              class="agenda-bookings__day"
            >
              <h3 class="agenda-bookings__day-label">{{ group.label }}</h3>
              <button
                v-for="b in group.items"
                :key="b._id"
                type="button"
                class="agenda-booking-row"
                @click="openBookingDetail(b)"
              >
                <span class="agenda-booking-row__time">{{ formatBookingTimeRange(b.start, b.end) }}</span>
                <span class="agenda-booking-row__body">
                  <strong>{{ b.serviceName }}</strong>
                  <span>{{ b.client?.firstName }} {{ b.client?.lastName }}</span>
                </span>
                <ChevronRight :size="16" class="agenda-booking-row__chev" />
              </button>
            </section>
          </div>
        </div>

        <button
          v-if="agendaCollaboratorId"
          type="button"
          class="btn-outline constraint-add-btn"
          @click="openConstraintModalManual"
        >
          <Plus :size="14" /> Ajouter une contrainte prestation
        </button>
      </section>

      <!-- ── Horaires ── -->
      <section v-else-if="activeSection === 'hours'" class="section-content">
        <div class="svc-header">
          <h1 class="page-title" style="margin:0">Horaires d'ouverture</h1>
          <select v-model="hoursCollaboratorId" class="agenda-select">
            <option value="">Salon (par défaut)</option>
            <option v-for="c in nonOwnerCollaborators" :key="c._id" :value="c._id">
              {{ c.firstName }} {{ c.lastName }}
            </option>
          </select>
        </div>
        <p class="page-sub">Semaine type — appliquée toute l'année. Utilisez l'agenda pour fermer des jours ponctuels.</p>
        <WeeklyScheduleEditor :collaborator-id="hoursCollaboratorId || null" />
      </section>

      <!-- ── Prestations ── -->
      <section v-else-if="activeSection === 'services'" class="section-content">
        <div class="svc-header">
          <h1 class="page-title" style="margin:0">Mes prestations</h1>
          <button class="btn-primary" @click="openGroupModal(null)">
            <Plus :size="15" /> Nouveau groupe
          </button>
        </div>
        <p class="page-sub">Organisez vos prestations par groupes (ex : "Coupes", "Colorations"). Les clients voient exactement ce que vous écrivez.</p>

        <!-- Loader -->
        <div v-if="svcLoading" class="svc-loading">
          <Loader2 :size="24" class="spin" /> Chargement…
        </div>

        <!-- Catalogue vide -->
        <div v-else-if="svcGroups.length === 0" class="empty-state">
          <Scissors :size="40" />
          <p>Aucune prestation pour l'instant.</p>
          <p class="empty-hint">Créez votre premier groupe pour commencer.</p>
          <button class="btn-primary" style="margin-top:1rem" @click="openGroupModal(null)">
            <Plus :size="15" /> Créer un groupe
          </button>
        </div>

        <!-- Groupes -->
        <div v-else class="svc-groups">
          <div v-for="group in svcGroups" :key="group.groupLabel" class="svc-group">

            <!-- En-tête groupe -->
            <div class="svc-group__header">
              <h2 class="svc-group__name">{{ group.groupLabel }}</h2>
              <div class="svc-group__actions">
                <button class="btn-icon-sm" title="Renommer" @click="openGroupModal(group.groupLabel)">
                  <Pencil :size="14" />
                </button>
                <button class="btn-icon-sm" title="Ajouter une prestation" @click="openSvcModal(null, group.groupLabel)">
                  <Plus :size="14" />
                </button>
                <button class="btn-icon-sm danger" title="Supprimer le groupe" @click="deleteGroup(group.groupLabel)">
                  <Trash2 :size="14" />
                </button>
              </div>
            </div>

            <!-- Liste des prestations -->
            <div class="svc-list">
              <div v-for="svc in group.services" :key="svc._id" class="svc-item">
                <div class="svc-item__info">
                  <span class="svc-item__name">{{ svc.name }}</span>
                  <span v-if="svc.description" class="svc-item__desc">{{ svc.description }}</span>
                </div>
                <div class="svc-item__meta">
                  <span class="svc-item__duration"><Clock :size="13" /> {{ formatDuration(svc.duration) }}</span>
                  <span class="svc-item__price">{{ svc.price.toFixed(2) }} €</span>
                  <span class="svc-item__status" :class="svc.active ? 'on' : 'off'">
                    {{ svc.active ? 'Actif' : 'Masqué' }}
                  </span>
                  <button class="btn-icon-sm" title="Modifier" @click="openSvcModal(svc, svc.groupLabel)">
                    <Pencil :size="13" />
                  </button>
                  <button class="btn-icon-sm danger" title="Supprimer" @click="deleteService(svc._id)">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>

              <!-- Ajouter dans ce groupe -->
              <button class="svc-add-btn" @click="openSvcModal(null, group.groupLabel)">
                <Plus :size="14" /> Ajouter une prestation
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Collaborateurs ── -->
      <section v-else-if="activeSection === 'team'" class="section-content">
        <div class="svc-header">
          <h1 class="page-title" style="margin:0">Mon équipe</h1>
          <button type="button" class="btn-primary" @click="openColModal(null)">
            <Plus :size="15" /> Ajouter
          </button>
        </div>
        <p class="page-sub">
          Gérez vos collaborateurs et assignez-leur des prestations. Envoyez le lien d'invitation pour qu'ils accèdent à leur agenda sur mobile.
        </p>

        <div v-if="colLoading" class="svc-loading">
          <Loader2 :size="24" class="spin" /> Chargement…
        </div>

        <div v-else-if="collaborators.length === 0" class="empty-state">
          <Users :size="40" />
          <p>Aucun collaborateur.</p>
        </div>

        <div v-else class="col-list">
          <article v-for="c in collaborators" :key="c._id" class="col-card" :class="{ inactive: !c.active }">
            <div class="col-card__avatar">
              <img v-if="c.photo" :src="`/api/media/avatars/collaborators/${c.photo}`" :alt="c.firstName" />
              <span v-else>{{ colInitials(c) }}</span>
            </div>
            <div class="col-card__body">
              <div class="col-card__top">
                <h3>{{ c.firstName }} {{ c.lastName }}</h3>
                <span v-if="c.isOwner" class="col-badge col-badge--owner">Vous</span>
                <span v-else class="col-badge" :class="`col-badge--${c.accountStatus}`">
                  {{ colStatusLabel(c) }}
                </span>
              </div>
              <p class="col-card__email">{{ c.email }}</p>
              <p class="col-card__meta">{{ c.serviceIds.length }} prestation(s)</p>
            </div>
            <div v-if="!c.isOwner" class="col-card__actions">
              <button type="button" class="btn-icon-sm" title="Modifier" @click="openColModal(c)"><Pencil :size="14" /></button>
              <template v-if="c.accountStatus === 'pending'">
                <button type="button" class="btn-icon-sm" title="Renvoyer invitation" @click="resendInvite(c._id)"><RefreshCw :size="14" /></button>
              </template>
              <button type="button" class="btn-icon-sm danger" :title="c.active ? 'Désactiver' : 'Réactiver'" @click="toggleCol(c)">
                <Power :size="14" />
              </button>
              <button type="button" class="btn-icon-sm danger" title="Supprimer" @click="deleteCol(c)">
                <Trash2 :size="14" />
              </button>
            </div>
          </article>
        </div>

        <div v-if="lastInviteLink" class="invite-box">
          <p><strong>Lien d'invitation :</strong></p>
          <code>{{ lastInviteLink }}</code>
          <button class="btn-outline" type="button" @click="copyText(lastInviteLink)">Copier le lien</button>
        </div>
      </section>

      <!-- ── Avis ── -->
      <section v-else-if="activeSection === 'reviews'" class="section-content">
        <h1 class="page-title">Mes avis</h1>
        <div v-if="(pro?.stats?.reviewCount ?? 0) === 0" class="empty-state">
          <Star :size="36" />
          <p>Vous n'avez pas encore d'avis clients.</p>
        </div>
      </section>

      <!-- ── Profil ── -->
      <section v-else-if="activeSection === 'profile'" class="section-content">
        <h1 class="page-title">Mon profil</h1>

        <div class="profile-card">
          <div class="profile-card__avatar">{{ initials }}</div>
          <div class="profile-card__info">
            <h2 class="profile-card__name">{{ pro?.salonName }}</h2>
            <p class="profile-card__email">{{ pro?.email }}</p>
            <p class="profile-card__phone">{{ pro?.phone }}</p>
            <p class="profile-card__since">Membre depuis {{ joinDate }}</p>
          </div>
        </div>

        <!-- KYC status card -->
        <div class="kyc-status-card" :class="pro?.kyc?.status">
          <div class="kyc-status-card__left">
            <CheckCircle v-if="pro?.kyc?.status === 'approved'" :size="20" />
            <Clock v-else-if="pro?.kyc?.status === 'pending'" :size="20" />
            <AlertCircle v-else :size="20" />
            <div>
              <p class="kyc-label">Statut KYC : <strong>{{ kycLabel }}</strong></p>
              <p class="kyc-hint" v-if="pro?.kyc?.status === 'pending'">En cours de vérification (48h)</p>
              <p class="kyc-hint" v-else-if="pro?.kyc?.status === 'approved'">Compte actif — vous pouvez accepter des réservations</p>
              <p class="kyc-hint" v-else>Contactez le support</p>
            </div>
          </div>
        </div>

        <h2 class="section-title">Informations personnelles</h2>
        <form class="profile-form" @submit.prevent="saveProfile" novalidate>
          <div class="pf-row">
            <div class="pf-field">
              <label>Prénom</label>
              <input v-model="pf.firstName" type="text" placeholder="Prénom" />
            </div>
            <div class="pf-field">
              <label>Nom</label>
              <input v-model="pf.lastName" type="text" placeholder="Nom" />
            </div>
          </div>
          <div class="pf-field">
            <label>Téléphone</label>
            <input v-model="pf.phone" type="tel" placeholder="06 XX XX XX XX" />
          </div>
          <div class="pf-field">
            <label>Email <span class="pf-locked">— non modifiable</span></label>
            <input :value="pro?.email" type="email" disabled />
          </div>

          <h2 class="section-title">Établissement</h2>
          <div class="pf-field">
            <label>Nom du salon</label>
            <input v-model="pf.salonName" type="text" placeholder="Nom du salon" />
          </div>
          <div class="pf-field">
            <label>Adresse</label>
            <input v-model="pf.address" type="text" placeholder="Adresse complète" />
          </div>
          <div class="pf-row">
            <div class="pf-field">
              <label>Ville</label>
              <input v-model="pf.city" type="text" placeholder="Ville" />
            </div>
            <div class="pf-field">
              <label>Code postal</label>
              <input v-model="pf.postalCode" type="text" placeholder="75001" />
            </div>
          </div>

          <h2 class="section-title">Catégories proposées</h2>
          <div class="cats-edit-grid">
            <label v-for="cat in allCategories" :key="cat.slug" class="cat-toggle">
              <input type="checkbox" :value="cat.slug" v-model="pf.categories" />
              <span class="cat-toggle__chip">{{ cat.name }}</span>
            </label>
          </div>

          <h2 class="section-title">Réseaux sociaux</h2>
          <div class="pf-field">
            <label>Instagram</label>
            <input v-model="pf.instagram" type="text" placeholder="@votre_compte" />
          </div>
          <div class="pf-field">
            <label>TikTok</label>
            <input v-model="pf.tiktok" type="text" placeholder="@votre_compte" />
          </div>

          <p v-if="pfError"   class="api-error">{{ pfError }}</p>
          <p v-if="pfSuccess" class="api-success">{{ pfSuccess }}</p>

          <button type="submit" class="btn-primary" :disabled="pfSaving">
            {{ pfSaving ? 'Enregistrement…' : 'Enregistrer les modifications' }}
          </button>
        </form>

        <h2 class="section-title" style="margin-top:2rem">Sécurité</h2>
        <div class="security-card">
          <div class="security-card__item">
            <div>
              <p class="security-card__label">Mot de passe</p>
              <p class="security-card__hint">Dernière modification : —</p>
            </div>
            <button class="btn-outline" disabled>Modifier</button>
          </div>
        </div>
      </section>

      <!-- ── Médias ── -->
      <section v-else-if="activeSection === 'medias'" class="section-content">
        <h1 class="page-title">Mes photos</h1>
        <p class="page-sub">Ajoutez jusqu'à 5 photos de votre salon. La première est votre <strong>photo principale</strong> — c'est celle que les clients voient en premier.</p>

        <div class="shop-photos-grid">

          <!-- Slots photos existantes -->
          <div
            v-for="(filename, idx) in shopPhotos"
            :key="filename"
            class="photo-slot filled"
            :class="{
              main      : (idx as number) === 0,
              dragging  : dragIdx === (idx as number),
              'drag-over': dropIdx === (idx as number) && (idx as number) > 0
            }"
            :draggable="(idx as number) > 0"
            @dragstart="(idx as number) > 0 && onDragStart(idx as number)"
            @dragover.prevent="(idx as number) > 0 && onDragOver(idx as number)"
            @drop.prevent="(idx as number) > 0 && onDrop()"
            @dragend="onDragEnd"
          >
            <img :src="shopPhotoUrls[filename] || ''" class="photo-slot__img" alt="photo salon" />

            <!-- Icône glisser (sauf principale) -->
            <span v-if="(idx as number) > 0" class="drag-handle" title="Glisser pour réordonner">
              <GripVertical :size="16" />
            </span>

            <!-- Badge "Principale" sur la 1ère -->
            <span v-if="(idx as number) === 0" class="photo-badge-main">
              <Star :size="11" :stroke-width="2.5" style="flex-shrink:0" /> Principale
            </span>

            <!-- Bouton "Définir comme principale" sur les autres -->
            <button
              v-if="(idx as number) > 0"
              class="photo-btn-promote"
              title="Définir comme photo principale"
              @click="promotePhoto(idx as number)"
            >
              Définir principale
            </button>

            <!-- Suppression -->
            <button class="photo-btn-delete" title="Supprimer" @click="removePhoto(filename)">
              <X :size="14" />
            </button>
          </div>

          <!-- Slot d'ajout (si < 5 photos) -->
          <label
            v-if="shopPhotos.length < 5"
            class="photo-slot empty"
            :class="{ 'is-main-slot': shopPhotos.length === 0 }"
          >
            <input
              ref="photoInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="visually-hidden"
              @change="onPhotoFileChange"
              :disabled="photoUploading"
            />
            <div v-if="photoUploading" class="photo-slot__loader">
              <Loader2 :size="28" class="spin" />
            </div>
            <template v-else>
              <ImagePlus :size="28" />
              <span v-if="shopPhotos.length === 0" class="photo-slot__hint">
                Ajouter votre<br/><strong>photo principale</strong>
              </span>
              <span v-else class="photo-slot__hint">Ajouter une photo</span>
            </template>
          </label>

          <!-- Slots vides restants (indicateurs visuels) -->
          <div
            v-for="i in Math.max(0, 4 - shopPhotos.length)"
            :key="'empty-' + i"
            class="photo-slot ghost"
          />
        </div>

        <p class="photos-hint">
          <strong>{{ shopPhotos.length }}/5</strong> photos · JPG, PNG ou WEBP · 5 Mo max par photo
        </p>
      </section>

    </div>
  </div>

  <!-- ── Modale groupe ───────────────────────────── -->
  <Teleport to="body">
    <div v-if="groupModal.open" class="modal-overlay" @click.self="groupModal.open = false">
      <div class="svc-modal">
        <div class="svc-modal__header">
          <h3>{{ groupModal.isNew ? 'Nouveau groupe' : 'Renommer le groupe' }}</h3>
          <button @click="groupModal.open = false"><X :size="20" /></button>
        </div>
        <div class="svc-modal__body">
          <label class="svc-label">Nom du groupe <span class="req">*</span></label>
          <input v-model="groupModal.label" class="svc-input" placeholder="Ex : Coupes, Colorations, Soins…" @keydown.enter="submitGroup" />
          <p class="svc-hint">
            <template v-if="groupModal.isNew">Étape 1/2 — vous ajouterez votre première prestation juste après.</template>
            <template v-else>Ce nom apparaîtra tel quel sur votre page salon.</template>
          </p>
        </div>
        <p v-if="groupModal.error" class="svc-error">{{ groupModal.error }}</p>
        <div class="svc-modal__footer">
          <button class="btn-cancel" @click="groupModal.open = false">Annuler</button>
          <button class="btn-primary" @click="submitGroup" :disabled="groupModal.saving">
            <Loader2 v-if="groupModal.saving" :size="14" class="spin" />
            {{ groupModal.isNew ? 'Suivant →' : 'Renommer' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ── Modale prestation ───────────────────────── -->
    <div v-if="svcModal.open" class="modal-overlay" @click.self="svcModal.open = false">
      <div class="svc-modal large">
        <div class="svc-modal__header">
          <h3>{{ svcModal.id ? 'Modifier la prestation' : 'Nouvelle prestation' }}</h3>
          <button @click="svcModal.open = false"><X :size="20" /></button>
        </div>
        <div class="svc-modal__body">

          <div class="svc-row">
            <div class="svc-field">
              <label class="svc-label">Groupe <span class="req">*</span></label>
              <input
                v-model="svcModal.groupLabel"
                class="svc-input"
                placeholder="Ex : Coupes, Colorations…"
                list="group-suggestions"
              />
              <!-- Suggestions groupes existants -->
              <datalist id="group-suggestions">
                <option v-for="g in svcGroups" :key="g.groupLabel" :value="g.groupLabel" />
              </datalist>
              <span class="svc-hint">Tapez un nouveau nom ou choisissez un groupe existant.</span>
            </div>
          </div>

          <div class="svc-row">
            <div class="svc-field">
              <label class="svc-label">Nom de la prestation <span class="req">*</span></label>
              <input v-model="svcModal.name" class="svc-input" placeholder="Ex : Coupe femme, Balayage…" list="svc-suggestions" />
              <!-- Suggestions basées sur les sous-catégories globales -->
              <datalist id="svc-suggestions">
                <option v-for="s in svcSuggestions" :key="s" :value="s" />
              </datalist>
            </div>
          </div>

          <div class="svc-row two">
            <div class="svc-field">
              <label class="svc-label">Durée (minutes) <span class="req">*</span></label>
              <input v-model.number="svcModal.duration" type="number" min="5" step="5" class="svc-input" placeholder="45" />
            </div>
            <div class="svc-field">
              <label class="svc-label">Prix (€) <span class="req">*</span></label>
              <input v-model.number="svcModal.price" type="number" min="0" step="0.5" class="svc-input" placeholder="35" />
            </div>
          </div>

          <div class="svc-row">
            <div class="svc-field">
              <label class="svc-label">Description <span class="svc-opt">optionnel</span></label>
              <input v-model="svcModal.description" class="svc-input" placeholder="Ex : Shampoing et brushing inclus" />
            </div>
          </div>

          <div class="svc-row">
            <label class="svc-toggle-label">
              <input type="checkbox" v-model="svcModal.active" />
              <span>Prestation visible par les clients</span>
            </label>
          </div>

        </div>
        <p v-if="svcModal.error" class="svc-error">{{ svcModal.error }}</p>
        <div class="svc-modal__footer">
          <button class="btn-cancel" @click="svcModal.open = false">Annuler</button>
          <button class="btn-primary" @click="submitSvc" :disabled="svcModal.saving">
            <Loader2 v-if="svcModal.saving" :size="14" class="spin" />
            {{ svcModal.id ? 'Enregistrer' : 'Créer' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Modale collaborateur -->
  <Teleport to="body">
    <div v-if="colModal.open" class="modal-overlay" @click.self="colModal.open = false">
      <div class="svc-modal large">
        <div class="svc-modal__header">
          <h3>{{ colModal.id ? 'Modifier le collaborateur' : 'Nouveau collaborateur' }}</h3>
          <button type="button" @click="colModal.open = false"><X :size="20" /></button>
        </div>
        <div class="svc-modal__body">
          <div class="pf-row">
            <div class="pf-field">
              <label>Prénom <span class="req">*</span></label>
              <input v-model="colModal.firstName" type="text" class="svc-input" />
            </div>
            <div class="pf-field">
              <label>Nom <span class="req">*</span></label>
              <input v-model="colModal.lastName" type="text" class="svc-input" />
            </div>
          </div>
          <div class="pf-field">
            <label>Email <span class="req">*</span></label>
            <input v-model="colModal.email" type="email" class="svc-input" :disabled="!!colModal.id" />
          </div>
          <div class="pf-field">
            <label>Prestations assignées <span class="req">*</span></label>
            <div class="col-services-grid">
              <label v-for="svc in allServicesFlat" :key="svc._id" class="cat-toggle">
                <input type="checkbox" :value="svc._id" v-model="colModal.serviceIds" />
                <span class="cat-toggle__chip">{{ svc.name }}</span>
              </label>
            </div>
          </div>
        </div>
        <p v-if="colModal.error" class="svc-error">{{ colModal.error }}</p>
        <div class="svc-modal__footer">
          <button type="button" class="btn-cancel" @click="colModal.open = false">Annuler</button>
          <button type="button" class="btn-primary" @click="submitCol" :disabled="colModal.saving">
            <Loader2 v-if="colModal.saving" :size="14" class="spin" />
            {{ colModal.id ? 'Enregistrer' : 'Créer & inviter' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Modale exception planning -->
  <Teleport to="body">
    <div v-if="exceptionModal.open" class="modal-overlay" @click.self="exceptionModal.open = false">
      <div class="svc-modal">
        <div class="svc-modal__header">
          <h3>{{ exceptionModal.dateStr }} — Exception</h3>
          <button type="button" @click="exceptionModal.open = false"><X :size="20" /></button>
        </div>
        <div class="svc-modal__body">
          <div class="pf-field">
            <label>Type</label>
            <select v-model="exceptionModal.type" class="svc-input">
              <option value="closed">Fermé</option>
              <option value="custom_hours">Horaires spéciaux</option>
            </select>
          </div>
          <div v-if="exceptionModal.type === 'custom_hours'" class="pf-row">
            <div class="pf-field">
              <label>Ouverture</label>
              <input v-model="exceptionModal.start" type="time" class="svc-input" />
            </div>
            <div class="pf-field">
              <label>Fermeture</label>
              <input v-model="exceptionModal.end" type="time" class="svc-input" />
            </div>
          </div>
          <div class="pf-field">
            <label>Motif <span class="svc-opt">optionnel</span></label>
            <input v-model="exceptionModal.label" type="text" class="svc-input" placeholder="Congés, férié…" />
          </div>
        </div>
        <p v-if="exceptionModal.error" class="svc-error">{{ exceptionModal.error }}</p>
        <div class="svc-modal__footer">
          <button type="button" class="btn-cancel" @click="exceptionModal.open = false">Annuler</button>
          <button type="button" class="btn-primary" :disabled="exceptionModal.saving" @click="submitException">
            <Loader2 v-if="exceptionModal.saving" :size="14" class="spin" />
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Modale détail réservation -->
  <Teleport to="body">
    <div v-if="bookingDetailModal.open" class="modal-overlay" @click.self="bookingDetailModal.open = false">
      <div class="svc-modal">
        <div class="svc-modal__header">
          <h3>Détail du rendez-vous</h3>
          <button type="button" @click="bookingDetailModal.open = false"><X :size="20" /></button>
        </div>
        <div class="svc-modal__body booking-detail">
          <p class="booking-detail__svc">{{ bookingDetailModal.serviceName }}</p>
          <p class="booking-detail__when">
            {{ bookingDetailModal.timeLabel }} – {{ bookingDetailModal.endLabel }}
          </p>
          <dl class="booking-detail__list">
            <div>
              <dt>Client</dt>
              <dd>{{ bookingDetailModal.clientName || '—' }}</dd>
            </div>
            <div v-if="bookingDetailModal.clientPhone">
              <dt>Téléphone</dt>
              <dd><a :href="`tel:${bookingDetailModal.clientPhone}`">{{ bookingDetailModal.clientPhone }}</a></dd>
            </div>
            <div v-if="bookingDetailModal.duration">
              <dt>Durée</dt>
              <dd>{{ bookingDetailModal.duration }} min</dd>
            </div>
            <div v-if="bookingDetailModal.price != null">
              <dt>Prix total</dt>
              <dd>{{ bookingDetailModal.price.toFixed(2) }} €</dd>
            </div>
          </dl>
          <BookingPaymentSummary
            v-if="bookingDetailModal.payment"
            :payment="bookingDetailModal.payment"
            :commission="bookingDetailModal.commission"
            :service-validation="bookingDetailModal.serviceValidation"
            :dispute="bookingDetailModal.dispute"
            :no-show="bookingDetailModal.noShow"
            show-meta
            class="booking-detail__pay"
          />
          <ul v-if="bookingDetailModal.serviceValidation?.history?.length" class="booking-detail__history">
            <li v-for="(entry, idx) in bookingDetailModal.serviceValidation.history" :key="idx">
              {{ formatValidationHistory(entry) }}
            </li>
          </ul>
        </div>
        <div class="svc-modal__footer">
          <button
            v-if="bookingDetailModal.serviceValidation?.canValidateAsPro"
            type="button"
            class="btn-primary"
            :disabled="bookingDetailModal.validateLoading"
            @click="validateProBooking"
          >
            <Loader2 v-if="bookingDetailModal.validateLoading" :size="14" class="spin" />
            Confirmer la prestation
          </button>
          <button
            v-if="bookingDetailModal.noShow?.canMark"
            type="button"
            class="btn-cancel danger-text"
            :disabled="bookingDetailModal.noShowLoading"
            @click="markNoShowBooking"
          >
            <Loader2 v-if="bookingDetailModal.noShowLoading" :size="14" class="spin" />
            Signaler un no-show
          </button>
          <button
            v-if="bookingDetailIsFuture && bookingDetailModal.bookingId"
            type="button"
            class="btn-cancel danger-text"
            :disabled="bookingDetailModal.cancelLoading"
            @click="cancelProBooking"
          >
            <Loader2 v-if="bookingDetailModal.cancelLoading" :size="14" class="spin" />
            Annuler le rendez-vous
          </button>
          <button type="button" class="btn-primary" @click="bookingDetailModal.open = false">Fermer</button>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Modale contrainte prestation (Planity) -->
  <Teleport to="body">
    <div v-if="constraintModal.open" class="modal-overlay" @click.self="constraintModal.open = false">
      <div class="svc-modal large">
        <div class="svc-modal__header">
          <h3>Contrainte prestations</h3>
          <button type="button" @click="constraintModal.open = false"><X :size="20" /></button>
        </div>
        <div class="svc-modal__body">
          <p class="page-sub" style="margin-top:0">
            Sur cette plage horaire, seules les prestations cochées seront réservables par les clients.
          </p>
          <div class="pf-row">
            <div class="pf-field">
              <label>Début</label>
              <input v-model="constraintModal.startTime" type="time" class="svc-input" />
            </div>
            <div class="pf-field">
              <label>Fin</label>
              <input v-model="constraintModal.endTime" type="time" class="svc-input" />
            </div>
          </div>
          <div class="pf-field">
            <label>Répétition</label>
            <select v-model="constraintModal.repeatType" class="svc-input">
              <option value="weekly">Chaque semaine</option>
              <option value="once">Une seule fois</option>
            </select>
          </div>
          <div v-if="constraintModal.repeatType === 'weekly'" class="pf-field">
            <label>Jour</label>
            <select v-model.number="constraintModal.dayOfWeek" class="svc-input">
              <option v-for="d in weekDays" :key="d.value" :value="d.value">{{ d.label }}</option>
            </select>
          </div>
          <div v-else class="pf-row">
            <div class="pf-field">
              <label>Date début</label>
              <input v-model="constraintModal.startDate" type="date" class="svc-input" />
            </div>
            <div class="pf-field">
              <label>Date fin</label>
              <input v-model="constraintModal.endDate" type="date" class="svc-input" />
            </div>
          </div>
          <div class="pf-field">
            <label>Prestations autorisées <span class="req">*</span></label>
            <div class="col-services-grid">
              <label v-for="svc in collabServicesForConstraint" :key="svc._id" class="cat-toggle">
                <input type="checkbox" :value="svc._id" v-model="constraintModal.serviceIds" />
                <span class="cat-toggle__chip">{{ svc.name }}</span>
              </label>
            </div>
            <p v-if="!collabServicesForConstraint.length" class="empty-hint">
              Assignez des prestations à ce collaborateur dans Mon équipe.
            </p>
          </div>
          <div class="pf-field">
            <label>Libellé <span class="svc-opt">optionnel</span></label>
            <input v-model="constraintModal.label" type="text" class="svc-input" placeholder="Ex : Coupes matin" />
          </div>
        </div>
        <p v-if="constraintModal.error" class="svc-error">{{ constraintModal.error }}</p>
        <div class="svc-modal__footer">
          <button
            v-if="constraintModal.id"
            type="button"
            class="btn-cancel danger-text"
            :disabled="constraintModal.saving"
            @click="deleteConstraint"
          >
            Supprimer
          </button>
          <span v-else />
          <div class="svc-modal__footer-right">
            <button type="button" class="btn-cancel" @click="constraintModal.open = false">Annuler</button>
            <button type="button" class="btn-primary" :disabled="constraintModal.saving" @click="submitConstraint">
              <Loader2 v-if="constraintModal.saving" :size="14" class="spin" />
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  LayoutDashboard, CalendarCheck, Scissors, Star, MessageSquare,
  TrendingUp, User, LogOut, Menu, X, CalendarX, CalendarDays,
  Clock, AlertCircle, CheckCircle, ImagePlus, Loader2, Images, GripVertical,
  Plus, Pencil, Trash2, Users, RefreshCw, Power, ChevronRight
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import type { ProUser } from '@/stores/auth'
import AgendaCalendar from '@/components/AgendaCalendar.vue'
import WeeklyScheduleEditor from '@/components/WeeklyScheduleEditor.vue'
import BookingPaymentSummary, {
  type PaymentSummary,
  type CommissionSummary,
  type StatusInfo
} from '@/components/BookingPaymentSummary.vue'

const authStore   = useAuthStore()
const router      = useRouter()
const toast       = useToast()
const sidebarOpen = ref(false)
const activeSection = ref('home')

const pro = computed(() => authStore.user as ProUser | null)

// ── Profil éditable ────────────────────────────────
const pf = reactive({
  firstName : pro.value?.firstName ?? '',
  lastName  : pro.value?.lastName  ?? '',
  phone     : pro.value?.phone     ?? '',
  salonName : pro.value?.salonName ?? '',
  address   : pro.value?.address   ?? '',
  city      : pro.value?.city      ?? '',
  postalCode: pro.value?.postalCode ?? '',
  categories: [...(pro.value?.categories ?? [])],
  instagram : (pro.value as any)?.socialLinks?.instagram ?? '',
  tiktok    : (pro.value as any)?.socialLinks?.tiktok    ?? ''
})

const pfSaving  = ref(false)
const pfError   = ref('')
const pfSuccess = ref('')

async function saveProfile () {
  pfSaving.value = true; pfError.value = ''; pfSuccess.value = ''
  try {
    const res = await fetch('/api/pro', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body: JSON.stringify({
        firstName  : pf.firstName,
        lastName   : pf.lastName,
        phone      : pf.phone,
        salonName  : pf.salonName,
        address    : pf.address,
        city       : pf.city,
        postalCode : pf.postalCode,
        categories : pf.categories,
        socialLinks: { instagram: pf.instagram, tiktok: pf.tiktok }
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'pro')
    pfSuccess.value = 'Profil mis à jour avec succès !'
    toast.success('Profil mis à jour !')
  } catch (err: any) {
    pfError.value = err.message || 'Erreur lors de la mise à jour'
  } finally {
    pfSaving.value = false
  }
}

// ── Computed ──────────────────────────────────────
const initials = computed(() => {
  if (!pro.value) return '?'
  return ((pro.value.firstName[0] || '') + (pro.value.lastName[0] || '')).toUpperCase()
})

const fullName = computed(() =>
  pro.value ? `${pro.value.firstName} ${pro.value.lastName}` : ''
)

const joinDate = computed(() => {
  if (!pro.value?.createdAt) return '—'
  return new Date(pro.value.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

const kycLabel = computed(() => {
  const s = pro.value?.kyc?.status
  return s === 'approved' ? 'Approuvé' : s === 'rejected' ? 'Refusé' : 'En attente'
})

// ── Nav ───────────────────────────────────────────
const navItems = [
  { id: 'home',     label: 'Accueil',         icon: LayoutDashboard },
  { id: 'agenda',   label: 'Mon agenda',      icon: CalendarDays    },
  { id: 'hours',    label: 'Horaires',        icon: Clock           },
  { id: 'services', label: 'Prestations',     icon: Scissors        },
  { id: 'team',     label: 'Équipe',          icon: Users           },
  { id: 'medias',   label: 'Mes photos',      icon: Images          },
  { id: 'reviews',  label: 'Avis',            icon: Star            },
  { id: 'profile',  label: 'Mon profil',      icon: User            },
]

const quickActions = [
  { id: 'agenda',   label: 'Mon agenda',    icon: CalendarDays,  target: 'agenda'   },
  { id: 'services', label: 'Prestations',   icon: Scissors,      target: 'services' },
  { id: 'reviews',  label: 'Avis clients',  icon: Star,          target: 'reviews'  },
  { id: 'profile',  label: 'Mon profil',    icon: User,          target: 'profile'  },
]

// Catégories depuis l'API
interface ApiCategory { _id: string; name: string; slug: string }
const allCategories = ref<ApiCategory[]>([])

async function fetchCategories () {
  try {
    const res  = await fetch('/api/categories')
    const data = await res.json()
    allCategories.value = data.data || []
  } catch {}
}

// ── Photos du salon ────────────────────────────────────
// drag & drop state (index 0 = principale, non déplaçable)
const dragIdx = ref<number | null>(null)
const dropIdx = ref<number | null>(null)

function onDragStart (idx: number) { dragIdx.value = idx }
function onDragOver  (idx: number) { dropIdx.value = idx }
function onDragEnd   ()            { dragIdx.value = null; dropIdx.value = null }

async function onDrop () {
  if (dragIdx.value === null || dropIdx.value === null) return
  if (dragIdx.value === dropIdx.value) { onDragEnd(); return }

  // Garder le slot 0 (principale) fixe — on ne déplace que les indices 1+
  const reordered = [...shopPhotos.value]
  const [moved] = reordered.splice(dragIdx.value, 1)
  reordered.splice(dropIdx.value, 0, moved)

  onDragEnd()

  try {
    const res  = await fetch('/api/pro/photos/reorder', {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body   : JSON.stringify({ photos: reordered })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'pro')
    shopPhotos.value = data.user.shopPhotos
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur de réorganisation')
    await syncPhotos()   // rollback visuel
  }
}

const shopPhotos    = ref<string[]>((pro.value as any)?.shopPhotos ?? [])
const shopPhotoUrls = ref<Record<string, string>>({})
const photoUploading = ref(false)
const photoInput     = ref<HTMLInputElement | null>(null)

async function loadPhotoUrl (filename: string) {
  if (shopPhotoUrls.value[filename]) return
  try {
    const res  = await fetch(`/api/media/shops/${filename}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (!res.ok) return
    const blob = await res.blob()
    shopPhotoUrls.value[filename] = URL.createObjectURL(blob)
  } catch {}
}

async function syncPhotos () {
  const p = pro.value as any
  shopPhotos.value = p?.shopPhotos ?? []
  for (const f of shopPhotos.value) await loadPhotoUrl(f)
}

async function onPhotoFileChange (e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  photoUploading.value = true
  const fd = new FormData()
  fd.append('photo', file)
  try {
    const res  = await fetch('/api/pro/photos', {
      method : 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
      body   : fd
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'pro')
    shopPhotos.value = data.user.shopPhotos
    await loadPhotoUrl(data.user.shopPhotos.at(-1))
    toast.success('Photo ajoutée !')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur upload')
  } finally {
    photoUploading.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}

async function removePhoto (filename: string) {
  if (!confirm('Supprimer cette photo ?')) return
  try {
    const res  = await fetch(`/api/pro/photos/${filename}`, {
      method : 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'pro')
    URL.revokeObjectURL(shopPhotoUrls.value[filename])
    delete shopPhotoUrls.value[filename]
    shopPhotos.value = data.user.shopPhotos
    toast.success('Photo supprimée.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur suppression')
  }
}

async function promotePhoto (idx: number) {
  const reordered = [...shopPhotos.value]
  const [moved] = reordered.splice(idx, 1)
  reordered.unshift(moved)
  try {
    const res  = await fetch('/api/pro/photos/reorder', {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body   : JSON.stringify({ photos: reordered })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    authStore.setSession(authStore.token!, data.user, 'pro')
    shopPhotos.value = data.user.shopPhotos
    toast.success('Photo principale mise à jour !')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  }
}

// ── Catalogue de prestations ──────────────────────────
interface SvcItem {
  _id: string; groupLabel: string; name: string; description: string
  duration: number; price: number; active: boolean; order: number
}
interface SvcGroup { groupLabel: string; services: SvcItem[] }

const svcGroups  = ref<SvcGroup[]>([])
const svcLoading = ref(false)

async function fetchServices () {
  svcLoading.value = true
  try {
    const res  = await fetch('/api/pro/services', {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    svcGroups.value = data.grouped || []
  } catch {}
  finally { svcLoading.value = false }
}

function formatDuration (min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

// ── Suggestions depuis les sous-catégories globales ──
const svcSuggestions = computed(() => {
  const names: string[] = []
  for (const cat of allCategories.value as any[]) {
    for (const sub of (cat.subcategories || [])) {
      names.push(sub.name)
    }
  }
  return names
})

// ── Modale groupe ────────────────────────────────────
const groupModal = reactive({
  open: false, saving: false, error: '',
  isNew: true, oldLabel: '', label: ''
})

function openGroupModal (existingLabel: string | null) {
  Object.assign(groupModal, {
    open: true, saving: false, error: '',
    isNew: !existingLabel, oldLabel: existingLabel ?? '', label: existingLabel ?? ''
  })
}

async function submitGroup () {
  if (!groupModal.label.trim()) { groupModal.error = 'Le nom est obligatoire.'; return }

  if (groupModal.isNew) {
    // Pas d'appel API : on ouvre directement la modale prestation
    // avec le nom de groupe pré-rempli. Le groupe sera créé en base
    // dès que la première prestation sera sauvegardée.
    groupModal.open = false
    openSvcModal(null, groupModal.label.trim())
    return
  }

  // Renommer un groupe existant
  groupModal.saving = true; groupModal.error = ''
  try {
    const res = await fetch('/api/pro/services/group/rename', {
      method : 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body   : JSON.stringify({ oldLabel: groupModal.oldLabel, newLabel: groupModal.label.trim() })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Groupe renommé.')
    groupModal.open = false
    fetchServices()
  } catch (err: unknown) {
    groupModal.error = err instanceof Error ? err.message : 'Erreur'
  } finally { groupModal.saving = false }
}

async function deleteGroup (label: string) {
  if (!confirm(`Supprimer le groupe "${label}" et toutes ses prestations ?`)) return
  try {
    await fetch(`/api/pro/services/group/${encodeURIComponent(label)}`, {
      method : 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    toast.success('Groupe supprimé.')
    fetchServices()
  } catch { toast.error('Erreur suppression.') }
}

// ── Modale prestation ────────────────────────────────
const svcModal = reactive({
  open: false, saving: false, error: '',
  id: '', groupLabel: '', name: '', description: '',
  duration: 30, price: 0, active: true
})

function openSvcModal (item: SvcItem | null, defaultGroup: string) {
  Object.assign(svcModal, {
    open: true, saving: false, error: '',
    id          : item?._id         ?? '',
    groupLabel  : item?.groupLabel  ?? defaultGroup,
    name        : item?.name        ?? '',
    description : item?.description ?? '',
    duration    : item?.duration    ?? 30,
    price       : item?.price       ?? 0,
    active      : item?.active      ?? true
  })
}

async function submitSvc () {
  if (!svcModal.groupLabel || !svcModal.name || !svcModal.duration || svcModal.price < 0) {
    svcModal.error = 'Groupe, nom, durée et prix sont obligatoires.'; return
  }
  svcModal.saving = true; svcModal.error = ''
  const url    = svcModal.id ? `/api/pro/services/${svcModal.id}` : '/api/pro/services'
  const method = svcModal.id ? 'PUT' : 'POST'
  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body   : JSON.stringify({
        groupLabel  : svcModal.groupLabel,
        name        : svcModal.name,
        description : svcModal.description,
        duration    : svcModal.duration,
        price       : svcModal.price,
        active      : svcModal.active
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success(svcModal.id ? 'Prestation mise à jour.' : 'Prestation créée.')
    svcModal.open = false
    fetchServices()
  } catch (err: unknown) {
    svcModal.error = err instanceof Error ? err.message : 'Erreur'
  } finally { svcModal.saving = false }
}

async function deleteService (id: string) {
  if (!confirm('Supprimer cette prestation ?')) return
  try {
    await fetch(`/api/pro/services/${id}`, {
      method : 'DELETE',
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    toast.success('Prestation supprimée.')
    fetchServices()
  } catch { toast.error('Erreur suppression.') }
}

function handleLogout () {
  authStore.logout()
  toast.info('À bientôt !')
  router.push('/')
}

// ── Collaborateurs ────────────────────────────────────
interface CollaboratorItem {
  _id: string
  firstName: string
  lastName: string
  email: string
  photo: string | null
  isOwner: boolean
  active: boolean
  accountStatus: 'pending' | 'active' | 'disabled'
  serviceIds: string[]
}

const collaborators = ref<CollaboratorItem[]>([])
const colLoading    = ref(false)
const lastInviteLink = ref('')

const allServicesFlat = computed(() =>
  svcGroups.value.flatMap(g => g.services.filter(s => s.active))
)

const colModal = reactive({
  open: false, saving: false, error: '',
  id: '' as string,
  firstName: '', lastName: '', email: '',
  serviceIds: [] as string[]
})

function colInitials (c: CollaboratorItem) {
  return ((c.firstName[0] || '') + (c.lastName[0] || '')).toUpperCase()
}

function colStatusLabel (c: CollaboratorItem) {
  if (c.accountStatus === 'active') return 'Actif'
  if (c.accountStatus === 'pending') return 'Invitation en attente'
  return 'Désactivé'
}

async function fetchCollaborators () {
  colLoading.value = true
  try {
    const res  = await fetch('/api/pro/collaborators', {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    collaborators.value = data.data || []
  } catch {
    toast.error('Impossible de charger l\'équipe.')
  } finally {
    colLoading.value = false
  }
}

function openColModal (c: CollaboratorItem | null) {
  Object.assign(colModal, {
    open: true, saving: false, error: '',
    id: c?._id || '',
    firstName: c?.firstName || '',
    lastName: c?.lastName || '',
    email: c?.email || '',
    serviceIds: c ? [...c.serviceIds] : []
  })
}

async function submitCol () {
  colModal.error = ''
  if (!colModal.firstName.trim() || !colModal.lastName.trim() || !colModal.email.trim()) {
    colModal.error = 'Prénom, nom et email obligatoires.'
    return
  }
  if (!colModal.serviceIds.length) {
    colModal.error = 'Sélectionnez au moins une prestation.'
    return
  }

  colModal.saving = true
  try {
    const isEdit = !!colModal.id
    const url    = isEdit ? `/api/pro/collaborators/${colModal.id}` : '/api/pro/collaborators'
    const res    = await fetch(url, {
      method  : isEdit ? 'PUT' : 'POST',
      headers : { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body    : JSON.stringify({
        firstName  : colModal.firstName.trim(),
        lastName   : colModal.lastName.trim(),
        email      : colModal.email.trim(),
        serviceIds : colModal.serviceIds
      })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)

    if (!isEdit && data.invitePath) {
      lastInviteLink.value = `${window.location.origin}${data.invitePath}`
      toast.success('Collaborateur créé — copiez le lien d\'invitation.')
    } else {
      toast.success('Collaborateur mis à jour.')
    }

    colModal.open = false
    fetchCollaborators()
  } catch (err: unknown) {
    colModal.error = err instanceof Error ? err.message : 'Erreur'
  } finally {
    colModal.saving = false
  }
}

async function toggleCol (c: CollaboratorItem) {
  try {
    const res = await fetch(`/api/pro/collaborators/${c._id}/status`, {
      method  : 'PATCH',
      headers : { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body    : JSON.stringify({ active: !c.active })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success(data.message)
    fetchCollaborators()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  }
}

async function deleteCol (c: CollaboratorItem) {
  const label = `${c.firstName} ${c.lastName}`.trim()
  const msg = c.accountStatus === 'active'
    ? `Supprimer ${label} ? Son accès sera révoqué définitivement.`
    : `Supprimer ${label} ?`
  if (!confirm(msg)) return

  try {
    const res = await fetch(`/api/pro/collaborators/${c._id}`, {
      method  : 'DELETE',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Collaborateur supprimé.')
    if (lastInviteLink.value) lastInviteLink.value = ''
    fetchCollaborators()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur suppression.')
  }
}

async function resendInvite (id: string) {
  try {
    const res  = await fetch(`/api/pro/collaborators/${id}/resend-invite`, {
      method  : 'POST',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    lastInviteLink.value = `${window.location.origin}${data.invitePath}`
    toast.success('Nouveau lien généré.')
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  }
}

function copyText (text: string) {
  navigator.clipboard.writeText(text)
  toast.success('Lien copié !')
}

onMounted(async () => {
  fetchProStats()
  await fetchCategories()
  await syncPhotos()
  fetchServices()
  fetchCollaborators()
})

interface ProStats {
  todayCount: number
  weekCount: number
  monthCount: number
  totalConfirmed: number
  totalCancelled: number
  revenueToday: number
  revenueWeek: number
  revenueMonth: number
  nextBooking: {
    start: string
    serviceName: string
    client?: { firstName: string; lastName: string; phone?: string }
  } | null
}

const proStatsLoading = ref(false)
const proStats = ref<ProStats>({
  todayCount     : 0,
  weekCount      : 0,
  monthCount     : 0,
  totalConfirmed : 0,
  totalCancelled : 0,
  revenueToday   : 0,
  revenueWeek    : 0,
  revenueMonth   : 0,
  nextBooking    : null
})

const nextProBooking = computed(() => proStats.value.nextBooking)

async function fetchProStats () {
  proStatsLoading.value = true
  try {
    const params = new URLSearchParams()
    if (activeSection.value === 'agenda' && agendaCollaboratorId.value) {
      params.set('collaboratorId', agendaCollaboratorId.value)
    }
    const res = await fetch(`/api/pro/stats?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (!res.ok) return
    const data = await res.json()
    proStats.value = {
      todayCount     : data.todayCount ?? 0,
      weekCount      : data.weekCount ?? 0,
      monthCount     : data.monthCount ?? 0,
      totalConfirmed : data.totalConfirmed ?? 0,
      totalCancelled : data.totalCancelled ?? 0,
      revenueToday   : data.revenueToday ?? 0,
      revenueWeek    : data.revenueWeek ?? 0,
      revenueMonth   : data.revenueMonth ?? 0,
      nextBooking    : data.nextBooking ?? null
    }
  } catch { /* ignore */ }
  finally { proStatsLoading.value = false }
}

function formatProBookingDate (iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit'
  })
}

// ── Planning Sprint 2 ─────────────────────────────────
const agendaCollaboratorId = ref('')
const hoursCollaboratorId  = ref('')
const agendaCalRef         = ref<{ refetch?: () => void } | null>(null)
const agendaViewMode       = ref<'day' | 'week' | 'list'>('day')
const agendaRange          = ref({ from: '', to: '' })
const agendaBookings       = ref<AgendaBooking[]>([])
const agendaBookingsLoading = ref(false)

interface AgendaBooking {
  _id: string
  start: string
  end: string
  serviceName: string
  duration?: number
  price?: number
  payment?: PaymentSummary
  commission?: CommissionSummary | null
  serviceValidation?: StatusInfo
  dispute?: StatusInfo
  noShow?: StatusInfo
  client?: { firstName: string; lastName: string; phone?: string }
}

const bookingDetailModal = reactive({
  open               : false,
  bookingId          : '',
  serviceName        : '',
  clientName         : '',
  clientPhone        : '',
  timeLabel          : '',
  endLabel           : '',
  duration           : 0,
  price              : null as number | null,
  payment            : null as PaymentSummary | null,
  commission         : null as CommissionSummary | null,
  serviceValidation  : null as StatusInfo | null,
  dispute            : null as StatusInfo | null,
  noShow             : null as StatusInfo | null,
  startIso           : '',
  cancelLoading      : false,
  validateLoading    : false,
  noShowLoading      : false
})

const agendaBookingsGrouped = computed(() => {
  const groups = new Map<string, { dayKey: string; label: string; items: AgendaBooking[] }>()
  for (const b of agendaBookings.value) {
    const d = new Date(b.start)
    const dayKey = d.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    const label = d.toLocaleDateString('fr-FR', {
      timeZone : 'Europe/Paris',
      weekday  : 'long',
      day      : 'numeric',
      month    : 'long'
    })
    if (!groups.has(dayKey)) groups.set(dayKey, { dayKey, label, items: [] })
    groups.get(dayKey)!.items.push(b)
  }
  return Array.from(groups.values())
})

function formatBookingTime (iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    timeZone : 'Europe/Paris',
    hour     : '2-digit',
    minute   : '2-digit'
  })
}

function formatBookingTimeRange (start: string, end: string) {
  return `${formatBookingTime(start)} – ${formatBookingTime(end)}`
}

function openBookingDetailFromEvent (payload: {
  bookingId?: string
  serviceName?: string
  clientName?: string
  clientPhone?: string
  timeLabel?: string
  endLabel?: string
  duration?: number
  price?: number
  payment?: PaymentSummary | null
  commission?: CommissionSummary | null
  serviceValidation?: StatusInfo | null
  dispute?: StatusInfo | null
  noShow?: StatusInfo | null
  startIso?: string
}) {
  Object.assign(bookingDetailModal, {
    open              : true,
    bookingId         : payload.bookingId || '',
    serviceName       : payload.serviceName || 'Rendez-vous',
    clientName        : payload.clientName || '',
    clientPhone       : payload.clientPhone || '',
    timeLabel         : payload.timeLabel || '',
    endLabel          : payload.endLabel || '',
    duration          : payload.duration || 0,
    price             : payload.price ?? null,
    payment           : payload.payment ?? null,
    commission        : payload.commission ?? null,
    serviceValidation : payload.serviceValidation ?? null,
    dispute           : payload.dispute ?? null,
    noShow            : payload.noShow ?? null,
    startIso          : payload.startIso || '',
    cancelLoading     : false,
    validateLoading   : false,
    noShowLoading     : false
  })
}

function openBookingDetail (b: AgendaBooking) {
  openBookingDetailFromEvent({
    bookingId         : b._id,
    serviceName       : b.serviceName,
    clientName        : b.client ? `${b.client.firstName} ${b.client.lastName}`.trim() : '',
    clientPhone       : b.client?.phone || '',
    timeLabel         : formatBookingTime(b.start),
    endLabel          : formatBookingTime(b.end),
    duration          : b.duration,
    price             : b.price,
    payment           : b.payment ?? null,
    commission        : b.commission ?? null,
    serviceValidation : b.serviceValidation ?? null,
    dispute           : b.dispute ?? null,
    noShow            : b.noShow ?? null,
    startIso          : b.start
  })
}

const bookingDetailIsFuture = computed(() => {
  if (!bookingDetailModal.startIso) return false
  return new Date(bookingDetailModal.startIso) > new Date()
})

function formatValidationHistory (entry: { action: string; by: string; at: string; note?: string | null }) {
  const when = new Date(entry.at).toLocaleString('fr-FR', {
    timeZone : 'Europe/Paris',
    day      : 'numeric',
    month    : 'short',
    hour     : '2-digit',
    minute   : '2-digit'
  })
  const labels: Record<string, string> = {
    pro_validated         : 'Validé par le professionnel',
    client_validated      : 'Validé par le client',
    contestation_started  : 'Période de contestation ouverte',
    ready_for_payment     : 'Prêt pour paiement final',
    no_show_settled       : 'No-show / annulation tardive — acompte conservé'
  }
  const label = labels[entry.action] || entry.action
  return `${when} — ${label}`
}

async function validateProBooking () {
  if (!bookingDetailModal.bookingId || !bookingDetailModal.serviceValidation?.canValidateAsPro) return
  if (!confirm('Confirmer que la prestation a bien été réalisée ?')) return

  bookingDetailModal.validateLoading = true
  try {
    const res = await fetch(`/api/pro/bookings/${bookingDetailModal.bookingId}/validate`, {
      method  : 'PATCH',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)

    toast.success('Prestation validée.')
    bookingDetailModal.open = false
    await fetchAgendaBookings()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  } finally {
    bookingDetailModal.validateLoading = false
  }
}

async function markNoShowBooking () {
  if (!bookingDetailModal.bookingId || !bookingDetailModal.noShow?.canMark) return
  if (!confirm('Confirmer que le client ne s\'est pas présenté ? L\'acompte sera conservé.')) return

  bookingDetailModal.noShowLoading = true
  try {
    const res = await fetch(`/api/pro/bookings/${bookingDetailModal.bookingId}/no-show`, {
      method  : 'PATCH',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)

    toast.success('No-show enregistré.')
    bookingDetailModal.open = false
    await fetchAgendaBookings()
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Erreur')
  } finally {
    bookingDetailModal.noShowLoading = false
  }
}

async function cancelProBooking () {
  if (!bookingDetailModal.bookingId || !bookingDetailIsFuture.value) return
  if (!confirm('Annuler ce rendez-vous ? Le client en sera informé par vos soins.')) return

  bookingDetailModal.cancelLoading = true
  try {
    const res = await fetch(`/api/pro/bookings/${bookingDetailModal.bookingId}/cancel`, {
      method  : 'PATCH',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur')

    toast.success('Rendez-vous annulé.')
    bookingDetailModal.open = false
    fetchAgendaBookings()
    fetchProStats()
    agendaCalRef.value?.refetch?.()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'Impossible d\'annuler.')
  } finally {
    bookingDetailModal.cancelLoading = false
  }
}

async function fetchAgendaBookings () {
  if (!agendaRange.value.from || activeSection.value !== 'agenda') return
  agendaBookingsLoading.value = true
  try {
    const params = new URLSearchParams({
      from : agendaRange.value.from,
      to   : agendaRange.value.to
    })
    if (agendaCollaboratorId.value) params.set('collaboratorId', agendaCollaboratorId.value)
    const res = await fetch(`/api/pro/bookings?${params}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    if (!res.ok) return
    const data = await res.json()
    agendaBookings.value = data.data || []
  } catch { /* ignore */ }
  finally { agendaBookingsLoading.value = false }
}

function onAgendaRangeChange ({ from, to }: { from: string; to: string }) {
  agendaRange.value = { from, to }
  fetchAgendaBookings()
}

watch(agendaCollaboratorId, () => {
  fetchProStats()
  fetchAgendaBookings()
  agendaCalRef.value?.refetch?.()
})

watch(agendaViewMode, (mode) => {
  if (mode === 'list' && !agendaRange.value.from) {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const mon = new Date(now)
    mon.setDate(now.getDate() + diff)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    agendaRange.value = { from: fmt(mon), to: fmt(sun) }
    fetchAgendaBookings()
  }
})

watch(activeSection, (section) => {
  if (section === 'team') fetchCollaborators()
  if (section === 'agenda' || section === 'hours') fetchCollaborators()
  if (section === 'home' || section === 'agenda') fetchProStats()
  if (section === 'agenda' && agendaRange.value.from) fetchAgendaBookings()
})

const nonOwnerCollaborators = computed(() =>
  collaborators.value.filter(c => !c.isOwner)
)

const exceptionModal = reactive({
  open: false, saving: false, error: '',
  dateStr: '',
  type: 'closed' as 'closed' | 'custom_hours',
  start: '09:00', end: '17:00',
  label: ''
})

function openExceptionModal ({ dateStr }: { dateStr: string }) {
  Object.assign(exceptionModal, {
    open: true, saving: false, error: '',
    dateStr, type: 'closed', start: '09:00', end: '17:00', label: ''
  })
}

async function submitException () {
  exceptionModal.error = ''
  exceptionModal.saving = true
  try {
    const body: Record<string, unknown> = {
      startDate      : exceptionModal.dateStr,
      endDate        : exceptionModal.dateStr,
      type           : exceptionModal.type,
      label          : exceptionModal.label,
      collaboratorId : agendaCollaboratorId.value || null
    }
    if (exceptionModal.type === 'custom_hours') {
      body.slots = [{ start: exceptionModal.start, end: exceptionModal.end }]
    }
    const res = await fetch('/api/pro/schedule/exceptions', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
      body    : JSON.stringify(body)
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Exception enregistrée.')
    exceptionModal.open = false
    agendaCalRef.value?.refetch?.()
  } catch (err: unknown) {
    exceptionModal.error = err instanceof Error ? err.message : 'Erreur'
  } finally {
    exceptionModal.saving = false
  }
}

const weekDays = [
  { value: 0, label: 'Lundi' },
  { value: 1, label: 'Mardi' },
  { value: 2, label: 'Mercredi' },
  { value: 3, label: 'Jeudi' },
  { value: 4, label: 'Vendredi' },
  { value: 5, label: 'Samedi' },
  { value: 6, label: 'Dimanche' }
]

const constraintModal = reactive({
  open: false,
  saving: false,
  error: '',
  id: '' as string,
  startTime: '10:00',
  endTime: '19:00',
  repeatType: 'weekly' as 'weekly' | 'once',
  dayOfWeek: 0,
  startDate: '',
  endDate: '',
  serviceIds: [] as string[],
  label: ''
})

const collabServicesForConstraint = computed(() => {
  const collab = collaborators.value.find(c => c._id === agendaCollaboratorId.value)
  if (!collab?.serviceIds?.length) return []
  const ids = new Set(collab.serviceIds.map(String))
  return allServicesFlat.value.filter(s => ids.has(String(s._id)))
})

function resetConstraintModal () {
  Object.assign(constraintModal, {
    open: true,
    saving: false,
    error: '',
    id: '',
    startTime: '10:00',
    endTime: '19:00',
    repeatType: 'weekly',
    dayOfWeek: 0,
    startDate: '',
    endDate: '',
    serviceIds: [] as string[],
    label: ''
  })
}

function openConstraintModalManual () {
  if (!agendaCollaboratorId.value) {
    toast.info('Sélectionnez d\'abord un collaborateur.')
    return
  }
  resetConstraintModal()
  const today = new Date()
  constraintModal.startDate = today.toISOString().slice(0, 10)
  constraintModal.endDate   = constraintModal.startDate
  constraintModal.dayOfWeek = today.getDay() === 0 ? 6 : today.getDay() - 1
}

function openConstraintModal (payload: {
  startTime: string
  endTime: string
  dateStr: string
  dayOfWeek: number
}) {
  if (!agendaCollaboratorId.value) return
  resetConstraintModal()
  constraintModal.startTime = payload.startTime
  constraintModal.endTime   = payload.endTime
  constraintModal.dayOfWeek = payload.dayOfWeek
  constraintModal.startDate = payload.dateStr
  constraintModal.endDate   = payload.dateStr
}

async function loadConstraint (id: string) {
  try {
    const res  = await fetch(`/api/pro/schedule/constraints?collaboratorId=${agendaCollaboratorId.value}`, {
      headers: { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    const c    = (data.data || []).find((x: { _id: string }) => x._id === id)
    if (!c) return
    Object.assign(constraintModal, {
      open: true,
      saving: false,
      error: '',
      id: c._id,
      startTime: c.startTime,
      endTime: c.endTime,
      repeatType: c.repeatType,
      dayOfWeek: c.dayOfWeek ?? 0,
      startDate: c.startDate ? String(c.startDate).slice(0, 10) : '',
      endDate: c.endDate ? String(c.endDate).slice(0, 10) : '',
      serviceIds: (c.serviceIds || []).map((s: string | { _id: string }) =>
        typeof s === 'string' ? s : s._id
      ),
      label: c.label || ''
    })
  } catch {
    toast.error('Impossible de charger la contrainte.')
  }
}

function onAgendaEventClick (payload: {
  type?: string
  constraintId?: string
  bookingId?: string
  serviceName?: string
  clientName?: string
  clientPhone?: string
  timeLabel?: string
  endLabel?: string
  startIso?: string
  duration?: number
  price?: number
}) {
  if (payload.type === 'booking' && payload.bookingId) {
    const full = agendaBookings.value.find(b => b._id === payload.bookingId)
    if (full) openBookingDetail(full)
    else openBookingDetailFromEvent(payload)
    return
  }
  if (payload.type === 'service_constraint' && payload.constraintId) {
    loadConstraint(payload.constraintId)
  }
}

async function submitConstraint () {
  if (!agendaCollaboratorId.value) return
  if (!constraintModal.serviceIds.length) {
    constraintModal.error = 'Sélectionnez au moins une prestation.'
    return
  }

  constraintModal.error  = ''
  constraintModal.saving = true
  try {
    const body: Record<string, unknown> = {
      collaboratorId : agendaCollaboratorId.value,
      startTime      : constraintModal.startTime,
      endTime        : constraintModal.endTime,
      repeatType     : constraintModal.repeatType,
      serviceIds     : constraintModal.serviceIds,
      label          : constraintModal.label
    }
    if (constraintModal.repeatType === 'weekly') {
      body.dayOfWeek = constraintModal.dayOfWeek
    } else {
      body.startDate = constraintModal.startDate
      body.endDate   = constraintModal.endDate || constraintModal.startDate
    }

    const isEdit = !!constraintModal.id
    const res    = await fetch(
      isEdit ? `/api/pro/schedule/constraints/${constraintModal.id}` : '/api/pro/schedule/constraints',
      {
        method  : isEdit ? 'PUT' : 'POST',
        headers : { 'Content-Type': 'application/json', Authorization: `Bearer ${authStore.token}` },
        body    : JSON.stringify(body)
      }
    )
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Contrainte enregistrée.')
    constraintModal.open = false
    agendaCalRef.value?.refetch?.()
  } catch (err: unknown) {
    constraintModal.error = err instanceof Error ? err.message : 'Erreur'
  } finally {
    constraintModal.saving = false
  }
}

async function deleteConstraint () {
  if (!constraintModal.id || !confirm('Supprimer cette contrainte ?')) return
  constraintModal.saving = true
  try {
    const res  = await fetch(`/api/pro/schedule/constraints/${constraintModal.id}`, {
      method  : 'DELETE',
      headers : { Authorization: `Bearer ${authStore.token}` }
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message)
    toast.success('Contrainte supprimée.')
    constraintModal.open = false
    agendaCalRef.value?.refetch?.()
  } catch (err: unknown) {
    constraintModal.error = err instanceof Error ? err.message : 'Erreur'
  } finally {
    constraintModal.saving = false
  }
}
</script>

<style>
body { margin: 0; }
</style>

<style scoped>
/* ═══════════════════════════════════════
   Même palette que ClientDashboardView
═══════════════════════════════════════ */
.dashboard {
  display: flex; min-height: 100vh;
  background: #F8F5F2; font-family: "Poppins", sans-serif;
}

/* ── Sidebar ── */
.sidebar {
  width: 240px; flex-shrink: 0;
  background: #fff; border-right: 1px solid #E4E0DC;
  display: flex; flex-direction: column;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
}
.sidebar__top {
  display: flex; align-items: center; justify-content: space-between;
  height: 64px; padding: 0 1.25rem;
  border-bottom: 1px solid #F0EBE8; flex-shrink: 0;
}
.sidebar__logo img { height: 28px; width: auto; }
.sidebar__close { display: none; background: none; border: none; cursor: pointer; color: #4F3942; padding: 4px; }
.sidebar__nav { flex: 1; padding: 1rem 0.75rem; display: flex; flex-direction: column; gap: 0.25rem; }
.sidebar__item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.7rem 0.9rem; border-radius: 10px;
  font-family: "Montserrat", sans-serif; font-size: 0.83rem; font-weight: 500;
  color: #888; background: none; border: none; cursor: pointer;
  text-align: left; width: 100%; transition: all 0.22s ease;
}
.sidebar__item:hover  { background: #F8F5F2; color: #4F3942; }
.sidebar__item.active { background: #EADAF3; color: #4F3942; font-weight: 600; }

.sidebar__pro-info { padding: 0.75rem 1.25rem; }
.pro-badge-sm {
  display: inline-block;
  font-family: "Montserrat", sans-serif; font-size: 0.68rem; font-weight: 700;
  letter-spacing: 0.1em; text-transform: uppercase;
  padding: 0.2rem 0.75rem; border-radius: 999px;
  background: #EADAF3; color: #4F3942;
}

.sidebar__logout {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 1.25rem 1.5rem 0.7rem;
  font-family: "Montserrat", sans-serif; font-size: 0.82rem; font-weight: 500;
  color: #aaa; background: none; border: none; border-top: 1px solid #F0EBE8;
  cursor: pointer; width: 100%; transition: color 0.2s;
}
.sidebar__logout:hover { color: #c0565b; }

/* ── Main ── */
.dashboard__main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.topbar {
  background: #fff; border-bottom: 1px solid #E4E0DC;
  padding: 0 2rem; height: 64px;
  display: flex; align-items: center; justify-content: space-between;
  position: sticky; top: 0; z-index: 10;
}
.topbar__burger { display: none; background: none; border: none; cursor: pointer; color: #4F3942; padding: 4px; }
.topbar__right  { display: flex; align-items: center; gap: 1rem; margin-left: auto; }
.topbar__greeting {
  font-family: "Montserrat", sans-serif; font-size: 0.88rem;
  font-weight: 400; color: #555;
}
.topbar__greeting em { font-style: normal; color: #4F3942; font-weight: 600; }
.topbar__avatar {
  width: 38px; height: 38px; border-radius: 50%;
  background: linear-gradient(135deg, #4F3942, #D1A1C7);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 700;
}

/* ── KYC Banner ── */
.kyc-banner {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.75rem 2rem;
  background: #fef0e3; border-bottom: 1px solid #f5d8b0;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem;
  font-weight: 500; color: #c87941;
}
.kyc-banner--rejected { background: #fdecea; border-color: #f5c0c2; color: #c0565b; }

/* ── Section ── */
.section-content { padding: 2rem 2rem 3rem; max-width: 900px; }
.section-content--wide { max-width: 1100px; }

.section-content--agenda {
  padding-bottom: 1rem;
}

.section-content--agenda .page-sub.agenda-sub {
  margin-bottom: 0.65rem;
}
.agenda-select {
  border: 1px solid #E4E0DC; border-radius: 10px; padding: 0.5rem 0.75rem;
  font-family: "Montserrat", sans-serif; font-size: 0.82rem; color: #4F3942;
  background: #fff;
}
.agenda-hint {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 0.75rem;
  padding: 0.65rem 1rem;
  background: #FDFBFA;
  border: 1px dashed #E4E0DC;
  border-radius: 10px;
}
.constraint-add-btn { margin-top: 1rem; }

.agenda-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
}

.agenda-view-tabs {
  display: inline-flex;
  gap: 0.35rem;
  padding: 0.3rem;
  background: #F0EBE8;
  border-radius: 12px;
}

.agenda-view-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1rem;
  border: none;
  border-radius: 9px;
  background: transparent;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  transition: background 0.18s, color 0.18s, box-shadow 0.18s;
}

.agenda-view-tab:hover {
  color: #4F3942;
}

.agenda-view-tab.active {
  background: #fff;
  color: #4F3942;
  box-shadow: 0 1px 4px rgba(79, 57, 66, 0.12);
}

.agenda-sub {
  margin-top: 0;
  margin-bottom: 1rem;
}

.agenda-bookings--solo {
  margin-top: 0;
}

.agenda-bookings--compact {
  margin-top: 1rem;
  padding: 1rem 1.25rem;
}

.agenda-bookings__link {
  background: none;
  border: none;
  padding: 0;
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #4F3942;
  cursor: pointer;
  text-decoration: underline;
}

.svc-modal__footer-right { display: flex; gap: 0.5rem; margin-left: auto; }
.svc-modal__footer { display: flex; align-items: center; gap: 0.75rem; }
.danger-text { color: #c0392b !important; }
.booking-preview {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 14px;
  padding: 1.25rem; margin-bottom: 1rem;
}
.booking-preview__svc { font-weight: 700; color: #2C1810; margin: 0 0 0.35rem; }
.booking-preview__when { color: #4F3942; font-size: 0.88rem; margin: 0 0 0.25rem; }
.booking-preview__client { color: #888; font-size: 0.82rem; margin: 0; }

/* ── Liste RDV agenda ── */
.agenda-bookings {
  margin-top: 1.5rem;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 16px;
  padding: 1.25rem 1.5rem;
}

.agenda-bookings__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 2px solid #EADAF3;
}

.agenda-bookings__title {
  font-family: "Montserrat", sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0;
}

.agenda-bookings__meta {
  font-size: 0.78rem;
  color: #888;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.agenda-bookings__empty {
  padding: 1.5rem 0;
}

.agenda-bookings__days {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.agenda-bookings__day-label {
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: capitalize;
  color: #4F3942;
  margin: 0 0 0.5rem;
}

.agenda-booking-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  padding: 0.75rem 0.85rem;
  margin-bottom: 0.4rem;
  background: #FDFBFA;
  border: 1px solid #E4E0DC;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.18s, background 0.18s;
}

.agenda-booking-row:hover {
  border-color: #D1A1C7;
  background: #fff;
}

.agenda-booking-row__time {
  flex-shrink: 0;
  min-width: 108px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.82rem;
  font-weight: 700;
  color: #4F3942;
}

.agenda-booking-row__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.agenda-booking-row__body strong {
  font-size: 0.88rem;
  color: #2C1810;
}

.agenda-booking-row__body span {
  font-size: 0.78rem;
  color: #888;
}

.agenda-booking-row__chev {
  flex-shrink: 0;
  color: #ccc;
}

.booking-detail__svc {
  font-family: "Montserrat", sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  color: #2C1810;
  margin: 0 0 0.35rem;
}

.booking-detail__when {
  font-size: 0.9rem;
  color: #4F3942;
  margin: 0 0 1.25rem;
}

.booking-detail__list {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.booking-detail__list div {
  display: grid;
  grid-template-columns: 100px 1fr;
  gap: 0.5rem;
}

.booking-detail__list dt {
  font-size: 0.78rem;
  font-weight: 600;
  color: #888;
  margin: 0;
}

.booking-detail__list dd {
  margin: 0;
  font-size: 0.88rem;
  color: #2C1810;
}

.booking-detail__list a {
  color: #4F3942;
  text-decoration: none;
}

.booking-detail__list a:hover {
  text-decoration: underline;
}

.booking-detail__pay {
  margin-top: 1rem;
}

.booking-detail__history {
  margin: 0.85rem 0 0;
  padding-left: 1.1rem;
  color: #666;
  font-size: 0.78rem;
  line-height: 1.5;
}

.page-title {
  font-family: "Playfair Display", Georgia, serif;
  font-size: 2rem; font-weight: 700; color: #4F3942; margin-bottom: 1.75rem;
}
.section-title {
  font-family: "Montserrat", sans-serif; font-size: 0.78rem; font-weight: 700;
  letter-spacing: 0.12em; text-transform: uppercase; color: #aaa; margin: 2rem 0 1rem;
}

/* ── Cards ── */
.cards-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 1rem;
}
.summary-card {
  background: #fff; border-radius: 14px; padding: 1.25rem;
  display: flex; align-items: center; gap: 1rem;
  border: 1px solid #E4E0DC; transition: box-shadow 0.25s;
}
.summary-card:hover { box-shadow: 0 4px 18px rgba(79,57,66,0.08); }
.summary-card--accent { background: #4F3942; border-color: #4F3942; }
.summary-card--accent .summary-card__icon { background: rgba(255,255,255,0.15); color: #fff; }
.summary-card--accent .summary-card__value,
.summary-card--accent .summary-card__label { color: #fff; }
.summary-card__icon {
  width: 42px; height: 42px; border-radius: 10px;
  background: #EADAF3; color: #4F3942;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.summary-card__body { display: flex; flex-direction: column; gap: 0.2rem; }
.summary-card__value {
  font-family: "Montserrat", sans-serif; font-size: 1.1rem;
  font-weight: 700; color: #4F3942; line-height: 1;
}
.stat-unit { font-size: 0.7rem; font-weight: 400; opacity: 0.6; }
.summary-card__label { font-family: "Montserrat", sans-serif; font-size: 0.72rem; color: #aaa; }

.cards-grid--secondary {
  margin-top: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
}

.summary-card--muted {
  opacity: 0.85;
  background: #faf8f6;
}

.summary-card--muted .summary-card__icon {
  background: #f0ebe8;
  color: #aaa;
}

.pro-agenda-stats {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.pro-agenda-stats__card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 12px;
  padding: 0.75rem 0.9rem;
  color: #4F3942;
}

.pro-agenda-stats__value {
  display: block;
  font-family: "Montserrat", sans-serif;
  font-size: 1.05rem;
  font-weight: 700;
  line-height: 1.1;
}

.pro-agenda-stats__label {
  display: block;
  font-size: 0.68rem;
  color: #888;
  margin-top: 0.1rem;
}

/* ── Actions ── */
.actions-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem;
}
.action-card {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 14px;
  padding: 1.5rem 1rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  cursor: pointer; transition: all 0.25s ease;
}
.action-card:hover { border-color: #D1A1C7; box-shadow: 0 4px 18px rgba(79,57,66,0.1); transform: translateY(-2px); }
.action-card__icon {
  width: 52px; height: 52px; border-radius: 14px;
  background: #EADAF3; color: #4F3942;
  display: flex; align-items: center; justify-content: center;
}
.action-card__label {
  font-family: "Montserrat", sans-serif; font-size: 0.78rem; font-weight: 600;
  color: #4F3942; text-align: center;
}

/* ── Empty state ── */
.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 1rem;
  padding: 3rem 2rem; background: #fff;
  border-radius: 16px; border: 1px solid #E4E0DC; color: #ccc; text-align: center;
}
.empty-state p { font-family: "Poppins", sans-serif; font-size: 0.92rem; font-weight: 300; color: #aaa; margin: 0; }
.empty-hint { font-size: 0.8rem !important; color: #ccc !important; }

/* ── Categories ── */
.cats-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.cat-chip {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.9rem; border-radius: 999px;
  font-family: "Montserrat", sans-serif; font-size: 0.78rem; font-weight: 500;
  background: #F8F5F2; color: #aaa; border: 1.5px solid #E4E0DC;
}
.cat-chip.active { background: #EADAF3; color: #4F3942; border-color: #D1A1C7; }

.cats-edit-grid { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1rem; }
.cat-toggle { display: flex; cursor: pointer; }
.cat-toggle input[type="checkbox"] { display: none; }
.cat-toggle__chip {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.9rem; border-radius: 999px;
  font-family: "Montserrat", sans-serif; font-size: 0.78rem; font-weight: 500;
  background: #F8F5F2; color: #aaa; border: 1.5px solid #E4E0DC;
  transition: all 0.2s; user-select: none;
}
.cat-toggle input:checked + .cat-toggle__chip {
  background: #EADAF3; color: #4F3942; border-color: #D1A1C7;
}
.cat-toggle:hover .cat-toggle__chip { border-color: #D1A1C7; color: #4F3942; }

/* ── KYC Status Card ── */
.kyc-status-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1rem 1.25rem; border-radius: 14px; margin-bottom: 2rem;
  border: 1px solid #E4E0DC; background: #fff;
}
.kyc-status-card.approved { background: #edf7ed; border-color: #b7dfb8; }
.kyc-status-card.rejected { background: #fdecea; border-color: #f5c0c2; }
.kyc-status-card.pending  { background: #fef0e3; border-color: #f5d8b0; }
.kyc-status-card__left { display: flex; align-items: center; gap: 0.75rem; }
.kyc-status-card.approved .kyc-status-card__left { color: #2e7d32; }
.kyc-status-card.rejected .kyc-status-card__left { color: #c0565b; }
.kyc-status-card.pending  .kyc-status-card__left { color: #c87941; }
.kyc-label { font-family: "Montserrat", sans-serif; font-size: 0.85rem; color: #4F3942; margin: 0; }
.kyc-hint  { font-size: 0.75rem; color: #888; margin-top: 0.2rem; }

/* ── Profile ── */
.profile-card {
  background: #fff; border-radius: 16px; border: 1px solid #E4E0DC;
  padding: 2rem; display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem;
}
.profile-card__avatar {
  width: 72px; height: 72px; border-radius: 50%;
  background: linear-gradient(135deg, #4F3942, #D1A1C7);
  color: #fff; display: flex; align-items: center; justify-content: center;
  font-family: "Montserrat", sans-serif; font-size: 1.4rem; font-weight: 700; flex-shrink: 0;
}
.profile-card__name { font-family: "Playfair Display", serif; font-size: 1.4rem; font-weight: 700; color: #4F3942; margin-bottom: 0.25rem; }
.profile-card__email, .profile-card__phone { font-size: 0.88rem; color: #555; font-weight: 300; margin-bottom: 0.15rem; }
.profile-card__since { font-size: 0.78rem; color: #aaa; margin-top: 0.5rem; }

/* ── Profile form ── */
.profile-form { display: flex; flex-direction: column; }
.pf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.pf-field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 1rem; }
.pf-field label { font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 600; color: #4F3942; letter-spacing: 0.04em; }
.pf-locked { font-weight: 300; color: #bbb; font-size: 0.75rem; }
.pf-field input {
  padding: 0.72rem 1rem; font-family: "Poppins", sans-serif;
  font-size: 0.9rem; font-weight: 300; color: #111;
  background: #F8F5F2; border: 1.5px solid #E4E0DC; border-radius: 10px; outline: none;
  transition: border-color 0.25s, box-shadow 0.25s;
}
.pf-field input:focus { border-color: #D1A1C7; box-shadow: 0 0 0 3px rgba(209,161,199,0.18); }
.pf-field input:disabled { opacity: 0.5; cursor: not-allowed; }

.api-error   { background: #fdecea; color: #c0565b; border-radius: 10px; padding: 0.7rem 1rem; font-size: 0.82rem; margin-bottom: 0.75rem; }
.api-success { background: #edf7ed; color: #2e7d32; border-radius: 10px; padding: 0.7rem 1rem; font-size: 0.82rem; margin-bottom: 0.75rem; }

/* ── Security ── */
.security-card { background: #fff; border: 1px solid #E4E0DC; border-radius: 14px; padding: 1.25rem; }
.security-card__item { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.security-card__label { font-family: "Montserrat", sans-serif; font-size: 0.88rem; font-weight: 600; color: #4F3942; }
.security-card__hint  { font-size: 0.78rem; color: #aaa; margin-top: 0.2rem; }

.btn-outline {
  padding: 0.55rem 1.25rem;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem; font-weight: 600;
  letter-spacing: 0.06em; text-transform: uppercase;
  color: #4F3942; background: transparent;
  border: 1.5px solid #E4E0DC; border-radius: 999px; cursor: pointer;
  transition: border-color 0.25s;
}
.btn-outline:disabled { opacity: 0.4; cursor: not-allowed; }

.btn-primary {
  display: inline-flex; align-items: center; gap: 0.5rem;
  padding: 0.75rem 1.75rem;
  font-family: "Montserrat", sans-serif; font-size: 0.82rem; font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase;
  color: #fff; background: #4F3942; border: none;
  border-radius: 999px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(79,57,66,0.22); transition: background 0.28s;
}
.btn-primary:hover:not(:disabled) { background: #D1A1C7; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* ── Responsive ── */
.sidebar-overlay {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.4); z-index: 49;
}

@media (max-width: 900px) {
  .actions-grid { grid-template-columns: repeat(2, 1fr); }
  .cards-grid   { grid-template-columns: repeat(2, 1fr); }
}

/* ── Prestations ── */
.svc-header {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.5rem;
}
.svc-loading {
  display: flex; align-items: center; gap: 0.6rem;
  color: #aaa; font-size: 0.88rem; padding: 2rem 0;
}

.svc-groups { display: flex; flex-direction: column; gap: 1.25rem; }

.svc-group {
  background: #fff; border: 1px solid #E4E0DC; border-radius: 14px; overflow: hidden;
}
.svc-group__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.9rem 1.25rem; border-bottom: 1px solid #F0EBE8;
  background: #FDFBFA;
}
.svc-group__name {
  font-family: "Montserrat", sans-serif; font-size: 0.92rem;
  font-weight: 700; color: #2C1810; margin: 0;
}
.svc-group__actions { display: flex; gap: 0.35rem; }

.btn-icon-sm {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 7px;
  background: #F0EBE8; border: 1px solid #E4E0DC; cursor: pointer;
  color: #7A5570; transition: all 0.18s;
}
.btn-icon-sm:hover { background: #EADAF3; border-color: #D1A1C7; color: #4F3942; }
.btn-icon-sm.danger { color: #c0565b; }
.btn-icon-sm.danger:hover { background: #fdecea; border-color: #f5c0c2; }

.svc-list { padding: 0.5rem 0; }

.svc-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.7rem 1.25rem; gap: 1rem; flex-wrap: wrap;
  border-bottom: 1px solid #F8F5F2; transition: background 0.15s;
}
.svc-item:last-of-type { border-bottom: none; }
.svc-item:hover { background: #FDFBFA; }

.svc-item__info { flex: 1; min-width: 0; }
.svc-item__name {
  display: block; font-family: "Montserrat", sans-serif;
  font-size: 0.88rem; font-weight: 600; color: #2C1810;
}
.svc-item__desc {
  display: block; font-size: 0.78rem; color: #888; margin-top: 0.15rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.svc-item__meta {
  display: flex; align-items: center; gap: 0.6rem; flex-shrink: 0; flex-wrap: wrap;
}
.svc-item__duration {
  display: inline-flex; align-items: center; gap: 0.25rem;
  font-size: 0.78rem; color: #888; font-family: "Montserrat", sans-serif;
}
.svc-item__price {
  font-family: "Montserrat", sans-serif; font-size: 0.88rem;
  font-weight: 700; color: #4F3942; min-width: 52px; text-align: right;
}
.svc-item__status {
  font-size: 0.7rem; font-weight: 700; font-family: "Montserrat", sans-serif;
  text-transform: uppercase; border-radius: 20px; padding: 0.15rem 0.5rem;
}
.svc-item__status.on  { background: #d4f5e0; color: #1a7a40; }
.svc-item__status.off { background: #F0EBE8; color: #aaa; }

.svc-add-btn {
  display: flex; align-items: center; gap: 0.4rem;
  width: 100%; padding: 0.65rem 1.25rem;
  background: none; border: none; cursor: pointer;
  font-family: "Montserrat", sans-serif; font-size: 0.8rem;
  font-weight: 600; color: #9B7A96; transition: color 0.18s;
}
.svc-add-btn:hover { color: #4F3942; }

/* ── Modales services ── */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.35);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000; padding: 1rem;
}
.svc-modal {
  background: #fff; border-radius: 16px; width: 100%; max-width: 420px;
  box-shadow: 0 20px 60px rgba(0,0,0,.18); overflow: hidden;
}
.svc-modal.large { max-width: 560px; }

.svc-modal__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.1rem 1.5rem; border-bottom: 1px solid #E4E0DC;
}
.svc-modal__header h3 {
  font-family: "Montserrat", sans-serif; font-size: 1rem; font-weight: 700; color: #2C1810; margin: 0;
}
.svc-modal__header button {
  background: none; border: none; cursor: pointer; color: #888;
}

.svc-modal__body { padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.9rem; }

.svc-row { display: flex; flex-direction: column; }
.svc-row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.svc-field { display: flex; flex-direction: column; gap: 0.3rem; }
.svc-label { font-family: "Montserrat", sans-serif; font-size: 0.78rem; font-weight: 600; color: #555; }
.svc-input {
  border: 1px solid #E4E0DC; border-radius: 8px; padding: 0.55rem 0.75rem;
  font-size: 0.88rem; font-family: "Poppins", sans-serif; outline: none;
  transition: border-color 0.18s;
}
.svc-input:focus { border-color: #D1A1C7; }

.svc-hint { font-size: 0.75rem; color: #aaa; margin: -0.5rem 0 0; }
.svc-opt  { font-weight: 400; color: #aaa; }

.svc-toggle-label {
  display: flex; align-items: center; gap: 0.5rem;
  font-family: "Montserrat", sans-serif; font-size: 0.83rem; color: #555; cursor: pointer;
}

.svc-error { color: #c0565b; font-size: 0.82rem; padding: 0 1.5rem; margin: 0; }

.svc-modal__footer {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding: 1rem 1.5rem; border-top: 1px solid #E4E0DC;
}
.btn-cancel {
  background: #F8F5F2; border: 1px solid #E4E0DC; border-radius: 10px;
  padding: 0.55rem 1.1rem; font-family: "Montserrat", sans-serif;
  font-size: 0.82rem; font-weight: 600; color: #666; cursor: pointer;
}
.btn-cancel:hover { background: #F0EBE8; }
.req { color: #c0565b; }

/* ── Photos du salon ── */
.page-sub { font-size: 0.88rem; color: #666; margin: -0.5rem 0 1.75rem; line-height: 1.5; }

.shop-photos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.photo-slot {
  aspect-ratio: 4/3;
  border-radius: 14px;
  overflow: hidden;
  position: relative;
}

/* Slot rempli */
.photo-slot.filled {
  border: 2px solid #E4E0DC;
}
.photo-slot.filled.main {
  border-color: #D1A1C7;
  box-shadow: 0 0 0 3px #EADAF3;
}
.photo-slot__img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}

/* Badge principale */
.photo-badge-main {
  position: absolute; top: 8px; left: 8px;
  display: inline-flex; align-items: center; gap: 0.25rem;
  background: rgba(79,57,66,.85); color: #fff;
  font-size: 0.7rem; font-weight: 700; font-family: "Montserrat", sans-serif;
  padding: 0.2rem 0.55rem; border-radius: 20px; letter-spacing: 0.03em;
  backdrop-filter: blur(4px);
}

/* Bouton "Définir principale" */
.photo-btn-promote {
  position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
  background: rgba(79,57,66,.82); color: #fff;
  font-size: 0.68rem; font-weight: 700; font-family: "Montserrat", sans-serif;
  padding: 0.25rem 0.7rem; border-radius: 20px; border: none; cursor: pointer;
  white-space: nowrap; backdrop-filter: blur(4px);
  opacity: 0; transition: opacity 0.2s;
}
.photo-slot.filled:hover .photo-btn-promote { opacity: 1; }

/* Icône drag handle */
.drag-handle {
  position: absolute; top: 8px; left: 8px;
  color: rgba(255,255,255,.8); cursor: grab;
  opacity: 0; transition: opacity 0.2s;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,.4));
}
.photo-slot.filled:hover .drag-handle { opacity: 1; }
.photo-slot.dragging { opacity: 0.4; cursor: grabbing; }
.photo-slot.drag-over {
  border-color: #4F3942;
  box-shadow: 0 0 0 3px rgba(79,57,66,.25);
  transform: scale(1.02);
  transition: transform 0.15s, box-shadow 0.15s;
}

/* Bouton suppression */
.photo-btn-delete {
  position: absolute; top: 8px; right: 8px;
  background: rgba(192,86,91,.88); color: #fff;
  border: none; border-radius: 50%; width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; backdrop-filter: blur(4px);
  opacity: 0; transition: opacity 0.2s;
}
.photo-slot.filled:hover .photo-btn-delete { opacity: 1; }

/* Slot ajout */
.photo-slot.empty {
  border: 2px dashed #D1A1C7; background: #FBF8FC;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 0.5rem; cursor: pointer; transition: background 0.2s, border-color 0.2s;
  color: #9B7A96;
}
.photo-slot.empty:hover { background: #F3EAF6; border-color: #9B7A96; }
.photo-slot.empty.is-main-slot { border-color: #4F3942; color: #4F3942; }

.photo-slot__hint { font-size: 0.75rem; font-family: "Montserrat", sans-serif; text-align: center; line-height: 1.4; }
.photo-slot__loader { display: flex; align-items: center; justify-content: center; height: 100%; }

/* Slots fantômes */
.photo-slot.ghost {
  border: 2px dashed #E4E0DC; background: #FAFAFA; border-radius: 14px;
}

.photos-hint {
  font-size: 0.8rem; color: #aaa; font-family: "Montserrat", sans-serif;
}

.spin { animation: spin-anim 0.8s linear infinite; }
@keyframes spin-anim { to { transform: rotate(360deg); } }

.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap;
}

.col-list { display: flex; flex-direction: column; gap: 0.75rem; }

.col-card {
  display: flex; align-items: center; gap: 1rem;
  background: #fff; border: 1px solid #E4E0DC; border-radius: 14px;
  padding: 1rem; transition: opacity 0.2s;
}
.col-card.inactive { opacity: 0.55; }

.col-card__avatar {
  width: 52px; height: 52px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg, #4F3942, #D1A1C7);
  display: flex; align-items: center; justify-content: center;
  font-family: "Montserrat", sans-serif; font-weight: 700; color: #fff;
  overflow: hidden;
}
.col-card__avatar img { width: 100%; height: 100%; object-fit: cover; }

.col-card__body { flex: 1; min-width: 0; }
.col-card__top { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.col-card__top h3 { margin: 0; font-size: 0.95rem; font-weight: 700; color: #4F3942; }
.col-card__email { margin: 0.15rem 0 0; font-size: 0.8rem; color: #888; }
.col-card__meta { margin: 0.2rem 0 0; font-size: 0.75rem; color: #aaa; }

.col-badge {
  font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.05em; padding: 0.15rem 0.5rem; border-radius: 999px;
  background: #F3EAF7; color: #7A5570;
}
.col-badge--owner { background: #4F3942; color: #fff; }
.col-badge--active { background: #e8f5e9; color: #2e7d32; }
.col-badge--pending { background: #fff3e0; color: #e65100; }
.col-badge--disabled { background: #fdecea; color: #c0565b; }

.col-card__actions { display: flex; gap: 0.35rem; flex-shrink: 0; }

.col-services-grid {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  max-height: 180px; overflow-y: auto; padding: 0.25rem 0;
}

.invite-box {
  margin-top: 1.5rem; padding: 1rem; background: #fff;
  border: 1px dashed #D1A1C7; border-radius: 12px;
}
.invite-box p { margin: 0 0 0.5rem; font-size: 0.85rem; color: #4F3942; }
.invite-box code {
  display: block; word-break: break-all; font-size: 0.75rem;
  background: #F8F5F2; padding: 0.5rem; border-radius: 8px; margin-bottom: 0.75rem;
}

@media (max-width: 768px) {
  .sidebar { position: fixed; left: -100%; top: 0; bottom: 0; z-index: 50; transition: left 0.3s ease; width: 260px; }
  .sidebar.open { left: 0; }
  .sidebar__close   { display: flex; }
  .sidebar-overlay  { display: block; }
  .topbar__burger   { display: flex; }
  .topbar           { padding: 0 1rem; }
  .topbar__greeting { display: none; }
  .section-content  { padding: 1.5rem 1rem 3rem; }
  .actions-grid     { grid-template-columns: repeat(2, 1fr); }
  .pf-row           { grid-template-columns: 1fr; }
  .shop-photos-grid { grid-template-columns: repeat(2, 1fr); }
}
</style>
