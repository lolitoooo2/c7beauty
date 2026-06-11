<template>
  <div class="prestation-autocomplete" :class="`prestation-autocomplete--${variant}`">
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
    <Loader2 v-if="salonLoading" :size="14" class="prestation-autocomplete__spin" />

    <ul
      v-if="showDropdown && groupedSuggestions.length"
      class="prestation-autocomplete__dropdown"
      role="listbox"
    >
      <template v-for="group in groupedSuggestions" :key="group.key">
        <li class="prestation-autocomplete__section">{{ group.label }}</li>
        <li
          v-for="s in group.items"
          :key="s.id"
          role="option"
          :class="[
            'prestation-autocomplete__item',
            `prestation-autocomplete__item--${s.type}`,
            { highlighted: flatSuggestions[highlightIdx]?.id === s.id }
          ]"
          @mousedown.prevent="pick(s)"
          @mouseenter="highlightIdx = flatSuggestions.findIndex(i => i.id === s.id)"
        >
          <img
            v-if="s.type === 'salon' && s.shopPhoto"
            :src="`/api/media/shops/${s.shopPhoto}`"
            :alt="s.label"
            class="prestation-autocomplete__thumb"
          />
          <component
            v-else
            :is="iconFor(s.type)"
            :size="13"
            class="prestation-autocomplete__ico"
          />
          <div class="prestation-autocomplete__text">
            <span class="prestation-autocomplete__label">{{ s.label }}</span>
            <span v-if="s.sublabel" class="prestation-autocomplete__meta">{{ s.sublabel }}</span>
          </div>
          <span class="prestation-autocomplete__badge">{{ badgeFor(s.type) }}</span>
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Tag, Sparkles, Store, Loader2 } from 'lucide-vue-next'
import {
  usePrestationAutocomplete,
  type PrestationSuggestion,
  type PrestationSelectPayload
} from '@/composables/usePrestationAutocomplete'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  variant?: 'home' | 'search'
  ariaLabel?: string
}>(), {
  placeholder: 'Prestation, salon…',
  variant: 'search',
  ariaLabel: 'Prestation'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  select: [payload: PrestationSelectPayload]
  submit: []
  typing: []
  dismiss: []
}>()

const router = useRouter()

const {
  suggestions,
  salonLoading,
  showDropdown,
  loadCategories,
  refreshSuggestions,
  debouncedRefresh,
  onFocus,
  onBlur,
  clearSuggestions,
  toPayload
} = usePrestationAutocomplete()

const highlightIdx = ref(-1)

const flatSuggestions = computed(() => suggestions.value)

const groupedSuggestions = computed(() => {
  const cats   = suggestions.value.filter(s => s.type === 'category')
  const subs   = suggestions.value.filter(s => s.type === 'subcategory')
  const salons = suggestions.value.filter(s => s.type === 'salon')
  const groups = []

  if (cats.length)   groups.push({ key: 'cat',   label: 'Catégories',  items: cats })
  if (subs.length)   groups.push({ key: 'sub',   label: 'Prestations', items: subs })
  if (salons.length) groups.push({ key: 'salon', label: 'Salons',      items: salons })

  return groups
})

watch(suggestions, () => { highlightIdx.value = -1 })

onMounted(() => { loadCategories() })

function iconFor (type: PrestationSuggestion['type']) {
  if (type === 'category')    return Tag
  if (type === 'subcategory') return Sparkles
  return Store
}

function badgeFor (type: PrestationSuggestion['type']) {
  if (type === 'category')    return 'Catégorie'
  if (type === 'subcategory') return 'Prestation'
  return 'Salon'
}

function onInput (e: Event) {
  const value = (e.target as HTMLInputElement).value
  emit('update:modelValue', value)
  emit('typing')
  highlightIdx.value = -1

  if (!value.trim()) {
    loadCategories().then(() => refreshSuggestions(''))
    return
  }

  debouncedRefresh(value)
}

async function handleFocus () {
  onFocus()
  await loadCategories()
  if (!suggestions.value.length) {
    await refreshSuggestions(props.modelValue)
  }
}

function pick (s: PrestationSuggestion) {
  if (s.type === 'salon' && s.salonId) {
    clearSuggestions()
    showDropdown.value = false
    highlightIdx.value = -1
    router.push(`/salon/${s.salonId}`)
    return
  }

  emit('update:modelValue', s.label)
  emit('select', toPayload(s))
  clearSuggestions()
  showDropdown.value = false
  highlightIdx.value = -1
}

function moveHighlight (delta: number) {
  if (!flatSuggestions.value.length) return
  showDropdown.value = true
  const max = flatSuggestions.value.length - 1
  if (highlightIdx.value < 0) {
    highlightIdx.value = delta > 0 ? 0 : max
    return
  }
  highlightIdx.value = Math.max(0, Math.min(max, highlightIdx.value + delta))
}

function confirmHighlight () {
  if (highlightIdx.value >= 0 && flatSuggestions.value[highlightIdx.value]) {
    pick(flatSuggestions.value[highlightIdx.value])
  } else {
    emit('submit')
    closeDropdown()
  }
}

function closeDropdown () {
  showDropdown.value = false
  highlightIdx.value = -1
  emit('dismiss')
}
</script>

<style scoped>
.prestation-autocomplete {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.prestation-autocomplete input {
  width: 100%;
  border: none;
  background: transparent;
  outline: none;
  font-family: "Poppins", sans-serif;
  color: inherit;
}

.prestation-autocomplete__spin {
  flex-shrink: 0;
  color: #aaa;
  animation: spin 0.8s linear infinite;
}

.prestation-autocomplete__dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: auto;
  min-width: 100%;
  width: max(100%, 420px);
  max-width: min(540px, 96vw);
  margin: 0;
  padding: 0.35rem 0;
  list-style: none;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 300;
  max-height: 380px;
  overflow-y: auto;
}

.prestation-autocomplete__section {
  padding: 0.45rem 1rem 0.25rem;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #aaa;
  pointer-events: none;
}

.prestation-autocomplete__item {
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  padding: 0.65rem 1rem;
  cursor: pointer;
  transition: background 0.15s;
}

.prestation-autocomplete__item.highlighted,
.prestation-autocomplete__item:hover {
  background: #F8F2F5;
}

.prestation-autocomplete__item--salon .prestation-autocomplete__label {
  font-weight: 600;
}

.prestation-autocomplete__ico {
  flex-shrink: 0;
  color: #D1A1C7;
  margin-top: 0.15rem;
}

.prestation-autocomplete__thumb {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  object-fit: cover;
  background: #F3EAF7;
  border: 1px solid #E4E0DC;
}

.prestation-autocomplete__item--salon .prestation-autocomplete__ico {
  color: #4F3942;
}

.prestation-autocomplete__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.prestation-autocomplete__label {
  font-size: 0.85rem;
  color: #2C1810;
  line-height: 1.4;
  white-space: normal;
  word-break: break-word;
}

.prestation-autocomplete__meta {
  font-size: 0.72rem;
  color: #999;
  line-height: 1.3;
}

.prestation-autocomplete__badge {
  flex-shrink: 0;
  font-size: 0.6rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: #7A5570;
  background: #F3EAF7;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  margin-top: 0.1rem;
  white-space: nowrap;
}

.prestation-autocomplete--home .prestation-autocomplete__dropdown {
  width: max(100%, 380px);
  max-width: min(540px, 96vw);
}

.prestation-autocomplete--home input {
  font-size: 0.95rem;
  padding: 0.85rem 0;
  color: var(--color-prune, #4F3942);
}
.prestation-autocomplete--home input::placeholder {
  color: rgba(79, 57, 66, 0.45);
}

.prestation-autocomplete--search input {
  font-size: 0.88rem;
  padding: 0.6rem 0;
  color: #2C1810;
}
.prestation-autocomplete--search input::placeholder {
  color: #bbb;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
