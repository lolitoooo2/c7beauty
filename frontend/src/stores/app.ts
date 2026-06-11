import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const appName = ref("C7'Beauty")

  return { appName }
})
