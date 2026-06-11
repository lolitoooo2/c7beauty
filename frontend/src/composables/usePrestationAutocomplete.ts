import { ref } from 'vue'

export interface ApiSubcategory {
  _id: string
  name: string
  slug: string
  active?: boolean
}

export interface ApiCategory {
  _id: string
  name: string
  slug: string
  subcategories?: ApiSubcategory[]
}

export interface PrestationSuggestion {
  id: string
  type: 'category' | 'subcategory' | 'salon'
  label: string
  sublabel?: string
  categorySlug?: string
  subcategorySlug?: string
  salonId?: string
  city?: string
  shopPhoto?: string | null
}

export interface PrestationSelectPayload {
  type: 'category' | 'subcategory' | 'salon'
  label: string
  categorySlug?: string
  subcategorySlug?: string
  salonId?: string
}

function normalize (str: string) {
  return str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')
}

function matches (query: string, text: string) {
  return normalize(text).includes(normalize(query))
}

function buildLocalSuggestions (query: string, categories: ApiCategory[]): PrestationSuggestion[] {
  const q = query.trim()
  const results: PrestationSuggestion[] = []

  if (!q) {
    return categories.map(cat => ({
      id           : `cat-${cat.slug}`,
      type         : 'category',
      label        : cat.name,
      categorySlug : cat.slug
    }))
  }

  const matchingCatSlugs = new Set<string>()

  for (const cat of categories) {
    if (matches(q, cat.name) || matches(q, cat.slug.replace(/-/g, ' '))) {
      matchingCatSlugs.add(cat.slug)
      results.push({
        id           : `cat-${cat.slug}`,
        type         : 'category',
        label        : cat.name,
        categorySlug : cat.slug
      })
    }
  }

  for (const cat of categories) {
    const catMatched = matchingCatSlugs.has(cat.slug)
    const subs = (cat.subcategories || []).filter(s => s.active !== false)

    for (const sub of subs) {
      if (catMatched || matches(q, sub.name)) {
        results.push({
          id              : `sub-${cat.slug}-${sub.slug}`,
          type            : 'subcategory',
          label           : sub.name,
          sublabel        : cat.name,
          categorySlug    : cat.slug,
          subcategorySlug : sub.slug
        })
      }
    }
  }

  return results
}

export function usePrestationAutocomplete () {
  const categories       = ref<ApiCategory[]>([])
  const suggestions      = ref<PrestationSuggestion[]>([])
  const salonLoading     = ref(false)
  const showDropdown     = ref(false)
  const categoriesLoaded = ref(false)

  let salonTimer: ReturnType<typeof setTimeout> | null = null

  async function loadCategories () {
    if (categoriesLoaded.value) return categories.value
    try {
      const res  = await fetch('/api/categories')
      const data = await res.json()
      categories.value = data.data || []
      categoriesLoaded.value = true
    } catch {
      categories.value = []
    }
    return categories.value
  }

  async function fetchSalonSuggestions (q: string): Promise<PrestationSuggestion[]> {
    const trimmed = q.trim()
    if (trimmed.length < 2) return []

    salonLoading.value = true
    try {
      const res  = await fetch(`/api/search/salons?q=${encodeURIComponent(trimmed)}&limit=5`)
      const data = await res.json()
      return (data.data || []).map((pro: any) => ({
        id        : `salon-${pro._id}`,
        type      : 'salon' as const,
        label     : pro.salonName,
        sublabel  : [pro.postalCode, pro.city].filter(Boolean).join(' '),
        salonId   : pro._id,
        city      : pro.city,
        shopPhoto : pro.shopPhotos?.[0] || null
      }))
    } catch {
      return []
    } finally {
      salonLoading.value = false
    }
  }

  async function refreshSuggestions (query: string) {
    await loadCategories()
    const local  = buildLocalSuggestions(query, categories.value)
    const salons = query.trim().length >= 2
      ? await fetchSalonSuggestions(query)
      : []
    suggestions.value = [...local, ...salons]
    return suggestions.value
  }

  function debouncedRefresh (query: string) {
    if (salonTimer) clearTimeout(salonTimer)
    salonTimer = setTimeout(() => refreshSuggestions(query), 300)
  }

  function onFocus () {
    showDropdown.value = true
  }

  function onBlur () {
    setTimeout(() => { showDropdown.value = false }, 200)
  }

  function clearSuggestions () {
    suggestions.value = []
  }

  function toPayload (s: PrestationSuggestion): PrestationSelectPayload {
    return {
      type            : s.type,
      label           : s.label,
      categorySlug    : s.categorySlug,
      subcategorySlug : s.subcategorySlug,
      salonId         : s.salonId
    }
  }

  return {
    categories,
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
  }
}
