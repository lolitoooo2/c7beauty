<template>
  <div class="pay-block" :class="`pay-block--${variant}`">
    <div class="pay-block__head">
      <span class="pay-badge" :class="payment.status">{{ payment.statusLabel }}</span>
    </div>

    <dl class="pay-block__amounts">
      <div>
        <dt>Total prestation</dt>
        <dd>{{ formatEur(payment.totalPrice) }}</dd>
      </div>
      <div v-if="payment.depositAmount != null">
        <dt>Acompte payé</dt>
        <dd>{{ formatEur(payment.depositAmount) }}</dd>
      </div>
      <div v-if="payment.remainingAmount != null && payment.remainingAmount > 0">
        <dt>Solde restant</dt>
        <dd>{{ formatEur(payment.remainingAmount) }}</dd>
      </div>
    </dl>

    <div v-if="showMeta" class="pay-block__meta">
      <div v-if="serviceValidation" class="pay-meta-row">
        <span class="pay-meta-label">Validation</span>
        <span class="pay-meta-value">{{ serviceValidation.statusLabel }}</span>
      </div>
      <div v-if="dispute?.deadline && dispute.canReport" class="pay-contestation">
        <p class="pay-contestation__timer">
          Temps restant : <strong>{{ countdownLabel }}</strong>
        </p>
        <button
          type="button"
          class="pay-contestation__btn"
          @click="$emit('report-dispute')"
        >
          Signaler un problème
        </button>
      </div>
      <div v-else-if="dispute?.disputeOpen" class="pay-meta-row">
        <span class="pay-meta-label">Litige</span>
        <span class="pay-meta-value pay-meta-value--warn">{{ dispute.statusLabel }}</span>
      </div>
      <div v-else-if="dispute?.deadline" class="pay-meta-row">
        <span class="pay-meta-label">Contestation</span>
        <span class="pay-meta-value">{{ dispute.statusLabel }}</span>
      </div>
      <div v-else-if="dispute && dispute.status !== 'not_started'" class="pay-meta-row">
        <span class="pay-meta-label">Contestation</span>
        <span class="pay-meta-value">{{ dispute.statusLabel }}</span>
      </div>
      <div v-if="noShow && noShow.statusLabel !== '—'" class="pay-meta-row">
        <span class="pay-meta-label">No-show</span>
        <span class="pay-meta-value">{{ noShow.statusLabel }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface PaymentSummary {
  status: string
  statusLabel: string
  totalPrice: number
  depositAmount: number | null
  remainingAmount: number | null
  depositPercent?: number | null
}

export interface StatusInfo {
  status: string
  statusLabel: string
  canValidate?: boolean
  canValidateAsPro?: boolean
  canValidateAsClient?: boolean
  contestationEndsAt?: string | null
  deadline?: string | null
  canTriggerFinalPayment?: boolean
  canReport?: boolean
  disputeOpen?: boolean
  available?: boolean
  canMark?: boolean
  history?: Array<{ action: string; by: string; at: string; note?: string | null }>
}

const props = defineProps<{
  payment: PaymentSummary
  serviceValidation?: StatusInfo | null
  dispute?: StatusInfo | null
  noShow?: StatusInfo | null
  variant?: 'compact' | 'full'
  showMeta?: boolean
}>()

defineEmits<{ 'report-dispute': [] }>()

const nowMs = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

const countdownLabel = computed(() => {
  if (!props.dispute?.deadline || !props.dispute?.canReport) return '—'
  const remaining = new Date(props.dispute.deadline).getTime() - nowMs.value
  if (remaining <= 0) return 'Délai expiré'
  const h = Math.floor(remaining / 3_600_000)
  const m = Math.floor((remaining % 3_600_000) / 60_000)
  const s = Math.floor((remaining % 60_000) / 1_000)
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`
})

onMounted(() => {
  tickTimer = setInterval(() => { nowMs.value = Date.now() }, 1000)
})

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})

function formatEur (value: number | null | undefined) {
  if (value == null) return '—'
  return `${value.toFixed(2)} €`
}
</script>

<style scoped>
.pay-block {
  background: #faf7f8;
  border: 1px solid #ece6ea;
  border-radius: 12px;
  padding: 0.85rem 1rem;
}

.pay-block--compact {
  padding: 0.65rem 0.85rem;
}

.pay-block__head {
  margin-bottom: 0.65rem;
}

.pay-badge {
  display: inline-block;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: #ece6ea;
  color: #4F3942;
}

.pay-badge.deposit_paid { background: #e8f4ec; color: #2d6a4f; }
.pay-badge.ready_for_final { background: #e8f0fa; color: #1d4ed8; }
.pay-badge.balance_charge_failed { background: #fef3cd; color: #92400e; }
.pay-badge.dispute_blocked { background: #fdecea; color: #b42318; }
.pay-badge.paid_in_full,
.pay-badge.legacy_paid { background: #e8f4ec; color: #2d6a4f; }
.pay-badge.cancelled { background: #fdecea; color: #b42318; }

.pay-block__amounts {
  display: grid;
  gap: 0.35rem;
  margin: 0;
}

.pay-block__amounts div {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.pay-block__amounts dt {
  font-size: 0.78rem;
  color: #888;
}

.pay-block__amounts dd {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 600;
  color: #2C1810;
}

.pay-block__meta {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid #ece6ea;
  display: grid;
  gap: 0.35rem;
}

.pay-meta-row {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.78rem;
}

.pay-meta-label { color: #888; }
.pay-meta-value { color: #4F3942; font-weight: 500; }
.pay-meta-value--warn { color: #b42318; }

.pay-contestation {
  display: grid;
  gap: 0.5rem;
}

.pay-contestation__timer {
  margin: 0;
  font-size: 0.78rem;
  color: #4F3942;
}

.pay-contestation__timer strong {
  font-variant-numeric: tabular-nums;
}

.pay-contestation__btn {
  align-self: start;
  border: 1px solid #b42318;
  background: #fff;
  color: #b42318;
  border-radius: 8px;
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.pay-contestation__btn:hover {
  background: #fdecea;
}
</style>
