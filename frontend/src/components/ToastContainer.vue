<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="toast"
          :class="`toast--${t.type}`"
        >
          <CheckCircle2 v-if="t.type === 'success'" :size="18" />
          <XCircle      v-else-if="t.type === 'error'"   :size="18" />
          <Info         v-else                            :size="18" />
          <span>{{ t.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CheckCircle2, XCircle, Info } from 'lucide-vue-next'
import { useToast } from '@/composables/useToast'

const { toasts } = useToast()
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 1.25rem;
  right: 1.25rem;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.85rem 1.25rem;
  border-radius: 12px;
  font-family: "Montserrat", sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  min-width: 260px;
  max-width: 380px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  pointer-events: all;
}

.toast--success {
  background: #4F3942;
  color: white;
}

.toast--error {
  background: #c0565b;
  color: white;
}

.toast--info {
  background: #EADAF3;
  color: #4F3942;
}

/* Transition */
.toast-enter-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from   { opacity: 0; transform: translateX(2rem); }
.toast-leave-to     { opacity: 0; transform: translateX(2rem); }
</style>
