<template>
  <div class="agenda-cal">
    <div v-if="loading" class="agenda-cal__overlay">
      <Loader2 :size="24" class="spin" />
    </div>
    <FullCalendar ref="fcRef" :options="calendarOptions" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import FullCalendar from '@fullcalendar/vue3'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { CalendarOptions, EventClickArg, DateClickArg, EventSourceFunc } from '@fullcalendar/core'
import { Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  apiPath: string
  collaboratorId?: string | null
  initialView?: 'timeGridWeek' | 'dayGridMonth' | 'timeGridDay'
}>()

const emit = defineEmits<{
  dateClick: [payload: { dateStr: string }]
  eventClick: [payload: { exceptionId?: string; type?: string }]
}>()

const authStore = useAuthStore()
const fcRef     = ref<InstanceType<typeof FullCalendar> | null>(null)
const loading   = ref(false)

const fetchEvents: EventSourceFunc = (info, success, failure) => {
  loading.value = true
  const from = info.startStr.slice(0, 10)
  const to   = info.endStr.slice(0, 10)
  const params = new URLSearchParams({ from, to })
  if (props.collaboratorId) params.set('collaboratorId', props.collaboratorId)

  fetch(`${props.apiPath}?${params}`, {
    headers: { Authorization: `Bearer ${authStore.token}` }
  })
    .then(res => res.json())
    .then(data => success(data.data || []))
    .catch(err => failure(err))
    .finally(() => { loading.value = false })
}

const calendarOptions = computed<CalendarOptions>(() => ({
  plugins      : [dayGridPlugin, timeGridPlugin, interactionPlugin],
  initialView  : props.initialView || 'timeGridWeek',
  locale       : 'fr',
  firstDay     : 1,
  height       : 'auto',
  headerToolbar: {
    left   : 'prev,next today',
    center : 'title',
    right  : 'timeGridDay,timeGridWeek,dayGridMonth'
  },
  slotMinTime    : '07:00:00',
  slotMaxTime    : '21:00:00',
  allDaySlot     : true,
  nowIndicator   : true,
  selectable     : false,
  events         : fetchEvents,
  dateClick (info: DateClickArg) {
    emit('dateClick', { dateStr: info.dateStr.slice(0, 10) })
  },
  eventClick (info: EventClickArg) {
    const ex = info.event.extendedProps as { exceptionId?: string; type?: string }
    emit('eventClick', { exceptionId: ex.exceptionId, type: ex.type })
  }
}))

watch(() => props.collaboratorId, () => {
  fcRef.value?.getApi()?.refetchEvents()
})

function refetch () {
  fcRef.value?.getApi()?.refetchEvents()
}

defineExpose({ refetch })
</script>

<style scoped>
.agenda-cal {
  position: relative;
  background: #fff;
  border: 1px solid #E4E0DC;
  border-radius: 16px;
  padding: 0.75rem;
  overflow: hidden;
}

.agenda-cal__overlay {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.65);
  color: #888;
}

.spin { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

:deep(.fc) {
  font-family: "Poppins", sans-serif;
  --fc-border-color: #F0EBE8;
  --fc-button-bg-color: #4F3942;
  --fc-button-border-color: #4F3942;
  --fc-button-hover-bg-color: #D1A1C7;
  --fc-button-hover-border-color: #D1A1C7;
  --fc-today-bg-color: #faf7fc;
}
:deep(.fc-toolbar-title) {
  font-family: "Montserrat", sans-serif;
  font-size: 1rem !important;
  font-weight: 700;
  color: #4F3942;
}
</style>
