import type { Component } from 'vue'
import {
  Sparkles,
  Scissors,
  Heart,
  Eye,
  HeartPulse,
  Droplets,
  Palette,
  GraduationCap,
} from 'lucide-vue-next'

const ICON_MAP: Record<string, Component> = {
  Sparkles,
  Scissors,
  Heart,
  Eye,
  HeartPulse,
  Droplets,
  Palette,
  GraduationCap,
}

export function getCategoryIcon (name?: string): Component {
  return ICON_MAP[name || ''] ?? Sparkles
}
