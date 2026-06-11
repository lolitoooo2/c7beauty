import { ref } from 'vue'

export interface LieuSuggestion {
  id: string
  label: string
  lat: number
  lng: number
  postcode?: string
  city?: string
}

/** Types autorisés : ville / commune / localité — pas d'adresse exacte */
const ALLOWED_TYPES = new Set(['municipality', 'locality'])

function formatLabel (p: Record<string, string>) {
  if (p.postcode && p.city) return `${p.postcode} ${p.city}`
  if (p.city) return p.city
  if (p.name) return p.name
  return p.label
}

function mapFeatures (features: any[]): LieuSuggestion[] {
  const seen    = new Set<string>()
  const results: LieuSuggestion[] = []

  for (const f of features) {
    const p = f.properties
    if (!p || !f.geometry?.coordinates) continue
    if (p.type && !ALLOWED_TYPES.has(p.type)) continue

    const label = formatLabel(p)
    const key   = `${p.citycode || p.city || ''}|${p.postcode || ''}`
    if (seen.has(key)) continue
    seen.add(key)

    results.push({
      id      : p.id || key,
      label,
      lat     : f.geometry.coordinates[1],
      lng     : f.geometry.coordinates[0],
      postcode: p.postcode,
      city    : p.city || p.name
    })

    if (results.length >= 6) break
  }

  return results
}

function buildSearchUrl (q: string) {
  const trimmed = q.trim()
  // q est obligatoire sur l'API adresse — postcode seul renvoie 400
  return `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(trimmed)}&limit=8&type=municipality`
}

export function useLieuAutocomplete () {
  const suggestions  = ref<LieuSuggestion[]>([])
  const loading      = ref(false)
  const showDropdown = ref(false)

  let timer: ReturnType<typeof setTimeout> | null = null

  /** Résolution rapide d'un code postal (préremplissage) */
  async function resolvePostalCode (postalCode: string): Promise<LieuSuggestion | null> {
    const code = postalCode.trim()
    if (!/^\d{5}$/.test(code)) return null

    try {
      const res  = await fetch(
        `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(code)}&limit=1&type=municipality`
      )
      const data = await res.json()
      return mapFeatures(data.features || [])[0] || null
    } catch {
      return null
    }
  }

  async function fetchSuggestions (q: string, options: { silent?: boolean } = {}) {
    const trimmed = q.trim()
    if (!trimmed) {
      suggestions.value = []
      return []
    }

    if (!options.silent) loading.value = true
    try {
      const res  = await fetch(buildSearchUrl(trimmed))
      const data = await res.json()
      suggestions.value = mapFeatures(data.features || [])
      return suggestions.value
    } catch {
      suggestions.value = []
      return []
    } finally {
      if (!options.silent) loading.value = false
    }
  }

  function debouncedFetch (q: string) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fetchSuggestions(q), 250)
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

  return {
    suggestions,
    loading,
    showDropdown,
    resolvePostalCode,
    fetchSuggestions,
    debouncedFetch,
    onFocus,
    onBlur,
    clearSuggestions
  }
}
