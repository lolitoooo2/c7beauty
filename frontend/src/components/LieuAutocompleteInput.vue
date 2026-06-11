<template>
  <div class="lieu-autocomplete" :class="`lieu-autocomplete--${variant}`">
    <input
      :value="modelValue"
      type="text"
      :placeholder="placeholder"
      autocomplete="off"
      spellcheck="false"
      :aria-label="ariaLabel"
      @input="onInput"
      @focus="handleFocus"
      @blur="onBlur"
      @keydown.down.prevent="moveHighlight(1)"
      @keydown.up.prevent="moveHighlight(-1)"
      @keydown.enter.prevent="confirmHighlight"
      @keydown.escape="closeDropdown"
    />
    <Loader2 v-if="loading" :size="14" class="lieu-autocomplete__spin" />

    <ul
      v-if="showDropdown && suggestions.length"
      class="lieu-autocomplete__dropdown"
      role="listbox"
    >
      <li
        v-for="(s, idx) in suggestions"
        :key="s.id"
        role="option"
        :class="{ highlighted: idx === highlightIdx }"
        @mousedown.prevent="pick(s)"
        @mouseenter="highlightIdx = idx"
      >
        <MapPin :size="12" />
        <span class="lieu-autocomplete__label">{{ s.label }}</span>
        <span v-if="s.postcode && !s.label.includes(s.postcode)" class="lieu-autocomplete__meta">
          {{ s.postcode }}
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { MapPin, Loader2 } from 'lucide-vue-next'
import { useLieuAutocomplete, type LieuSuggestion } from '@/composables/useLieuAutocomplete'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  variant?: 'home' | 'search'
  ariaLabel?: string
}>(), {
  placeholder: 'Ville, code postal…',
  variant: 'search',
  ariaLabel: 'Lieu'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [suggestion: LieuSuggestion]
  dismiss: []
}>()

const {
  suggestions,
  loading,
  showDropdown,
  resolvePostalCode,
  fetchSuggestions,
  debouncedFetch,
  onFocus,
  onBlur,
  clearSuggestions
} = useLieuAutocomplete()

const highlightIdx = ref(-1)

watch(suggestions, () => { highlightIdx.value = -1 })

function onInput (e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
  highlightIdx.value = -1
  if (!value.trim()) {
    clearSuggestions()
    return
  }
  debouncedFetch(value)
}

function handleFocus () {
  onFocus()
  if (props.modelValue.trim() && !suggestions.value.length) {
    fetchSuggestions(props.modelValue)
  }
}

function pick (s: LieuSuggestion) {
  emit('update:modelValue', s.label)
  emit('select', s)
  clearSuggestions()
  showDropdown.value = false
  highlightIdx.value = -1
}

function moveHighlight (delta: number) {
  if (!suggestions.value.length) return
  showDropdown.value = true
  const max = suggestions.value.length - 1
  if (highlightIdx.value < 0) {
    highlightIdx.value = delta > 0 ? 0 : max
    return
  }
  highlightIdx.value = Math.max(0, Math.min(max, highlightIdx.value + delta))
}

function confirmHighlight () {
  if (highlightIdx.value >= 0 && suggestions.value[highlightIdx.value]) {
    pick(suggestions.value[highlightIdx.value])
  }
}

function closeDropdown () {
  showDropdown.value = false
  highlightIdx.value = -1
  emit('dismiss')
}

/** Préremplissage rapide (code postal client) — ville/CP uniquement */
async function prefill (q: string): Promise<LieuSuggestion | null> {
  const trimmed = q.trim()
  let suggestion: LieuSuggestion | null = null

  if (/^\d{5}$/.test(trimmed)) {
    suggestion = await resolvePostalCode(trimmed)
  } else {
    const list = await fetchSuggestions(trimmed, { silent: true })
    suggestion = list[0] || null
  }

  emit('update:modelValue', suggestion?.label ?? trimmed)
  showDropdown.value = false
  return suggestion
}

defineExpose({ prefill, fetchSuggestions, resolvePostalCode })
</script>

<style scoped>
.lieu-autocomplete {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.lieu-autocomplete input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-family: "Poppins", sans-serif;
  color: inherit;
}

.lieu-autocomplete__spin {
  flex-shrink: 0;
  color: #aaa;
  animation: spin 0.8s linear infinite;
}

.lieu-autocomplete__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 0.4rem 0;
  list-style: none;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 300;
  max-height: 240px;
  overflow-y: auto;
}

.lieu-autocomplete__dropdown li {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  font-size: 0.85rem;
  color: #2C1810;
  cursor: pointer;
  transition: background 0.15s;
}

.lieu-autocomplete__dropdown li.highlighted,
.lieu-autocomplete__dropdown li:hover {
  background: #F8F2F5;
}

.lieu-autocomplete__label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lieu-autocomplete__meta {
  flex-shrink: 0;
  font-size: 0.75rem;
  color: #999;
  font-weight: 600;
}

/* Variante Home (hero) */
.lieu-autocomplete--home input {
  font-size: 0.95rem;
  padding: 0.85rem 0;
  color: var(--color-prune, #4F3942);
}
.lieu-autocomplete--home input::placeholder {
  color: rgba(79, 57, 66, 0.45);
}
.lieu-autocomplete--home .lieu-autocomplete__dropdown {
  min-width: 280px;
}

/* Variante Search */
.lieu-autocomplete--search input {
  font-size: 0.88rem;
  padding: 0.6rem 0;
  color: #2C1810;
}
.lieu-autocomplete--search input::placeholder {
  color: #bbb;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
