<template>
  <div class="agenda-cal" :class="{ 'agenda-cal--pro': proMode }">
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
import type {
  CalendarOptions,
  EventClickArg,
  DateClickArg,
  EventSourceFunc,
  EventContentArg,
  DatesSetArg,
  EventMountArg
} from '@fullcalendar/core'
import { Loader2 } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  apiPath: string
  collaboratorId?: string | null
  initialView?: 'timeGridWeek' | 'dayGridMonth' | 'timeGridDay'
  activeView?: 'day' | 'week'
  selectable?: boolean
  proMode?: boolean
}>()

const emit = defineEmits<{
  dateClick: [payload: { dateStr: string }]
  eventClick: [payload: {
    exceptionId?: string
    constraintId?: string
    bookingId?: string
    type?: string
    serviceName?: string
    clientName?: string
    clientPhone?: string
    timeLabel?: string
    endLabel?: string
    duration?: number
    price?: number
  }]
  select: [payload: { start: string; end: string; startTime: string; endTime: string; dateStr: string; dayOfWeek: number }]
  rangeChange: [payload: { from: string; to: string }]
}>()

const authStore = useAuthStore()
const fcRef     = ref<InstanceType<typeof FullCalendar> | null>(null)
const loading   = ref(false)
const displayBounds = ref({ slotMinTime: '09:00:00', slotMaxTime: '19:00:00' })

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
    .then(data => {
      if (data.bounds?.slotMinTime && data.bounds?.slotMaxTime) {
        displayBounds.value = data.bounds
      }
      success(data.data || [])
      if (props.proMode && props.activeView !== 'week') {
        queueMicrotask(() => {
          fcRef.value?.getApi()?.setOption('eventMaxStack', 999)
          closeFcPopover()
        })
      }
    })
    .catch(err => failure(err))
    .finally(() => { loading.value = false })
}

function escapeHtml (s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderEventContent (arg: EventContentArg) {
  const type = arg.event.extendedProps.type as string | undefined
  const isTimeGrid = arg.view.type.startsWith('timeGrid')

  if (type === 'booking') {
    const time    = escapeHtml(String(arg.event.extendedProps.timeLabel || ''))
    const end     = escapeHtml(String(arg.event.extendedProps.endLabel || ''))
    const svc     = escapeHtml(String(arg.event.extendedProps.serviceName || ''))
    const client  = escapeHtml(String(arg.event.extendedProps.clientName || ''))
    const range   = end ? `${time} – ${end}` : time
    const title   = escapeHtml(`${range} — ${svc}${client ? ` — ${client}` : ''}`)

    if (props.proMode && isTimeGrid) {
      const isWeek = arg.view.type === 'timeGridWeek'
      // Semaine : colonnes étroites → heure seule ; jour : heure + prestation
      if (isWeek) {
        return {
          html: `<div class="fc-booking-card fc-booking-card--week" title="${title}">
            <span class="fc-booking-card__time">${time}</span>
          </div>`
        }
      }
      return {
        html: `<div class="fc-booking-card fc-booking-card--col" title="${title}">
          <span class="fc-booking-card__time">${time}</span>
          <span class="fc-booking-card__svc">${svc}</span>
        </div>`
      }
    }

    return {
      html: `<div class="fc-booking-pill">
        <span class="fc-booking-pill__time">${time}</span>
        <span class="fc-booking-pill__svc">${svc}</span>
      </div>`
    }
  }

  if (type === 'open') {
    return { html: '' }
  }

  return true
}

function onEventDidMount (info: EventMountArg) {
  if (info.event.extendedProps.type !== 'booking') return
  const time   = String(info.event.extendedProps.timeLabel || '')
  const svc    = String(info.event.extendedProps.serviceName || '')
  const client = String(info.event.extendedProps.clientName || '')
  info.el.title = `${time} — ${svc}${client ? ` — ${client}` : ''}`
}

function closeFcPopover () {
  document.querySelector('.fc-popover')?.remove()
}

const calendarOptions = computed<CalendarOptions>(() => {
  const pro = !!props.proMode
  const isWeek = props.activeView === 'week'
  const viewFromProp = props.activeView === 'day'
    ? 'timeGridDay'
    : props.activeView === 'week'
      ? 'timeGridWeek'
      : (props.initialView || (pro ? 'timeGridDay' : 'timeGridWeek'))

  return {
    plugins      : [dayGridPlugin, timeGridPlugin, interactionPlugin],
    initialView  : viewFromProp,
    locale       : 'fr',
    firstDay     : 1,
    height       : pro ? 'calc(100vh - 260px)' : 'auto',
    expandRows   : pro,
    headerToolbar: pro
      ? { left: 'prev,next today', center: 'title', right: '' }
      : {
          left   : 'prev,next today',
          center : 'title',
          right  : 'timeGridDay,timeGridWeek,dayGridMonth'
        },
    slotMinTime       : pro ? displayBounds.value.slotMinTime : '07:00:00',
    slotMaxTime       : pro ? displayBounds.value.slotMaxTime : '21:00:00',
    slotDuration      : '00:30:00',
    slotLabelInterval : '01:00:00',
    scrollTime        : pro ? displayBounds.value.slotMinTime : '08:00:00',
    allDaySlot        : true,
    allDayText        : 'Journée',
    nowIndicator      : true,
    selectable        : !!props.selectable,
    selectMirror      : !!props.selectable,
    slotEventOverlap  : pro ? false : true,
    eventMaxStack     : pro ? (isWeek ? 3 : 999) : undefined,
    eventOrder        : 'start',
    eventMinHeight    : pro ? 28 : 28,
    events            : fetchEvents,
    eventContent      : renderEventContent,
    eventDidMount     : onEventDidMount,
    datesSet (info: DatesSetArg) {
      closeFcPopover()
      if (props.proMode) {
        const isWeek = info.view.type === 'timeGridWeek'
        info.view.calendar.setOption('eventMaxStack', isWeek ? 3 : 999)
      }
      emit('rangeChange', {
        from : info.startStr.slice(0, 10),
        to   : info.endStr.slice(0, 10)
      })
    },
    dateClick (info: DateClickArg) {
      if (props.selectable) return
      emit('dateClick', { dateStr: info.dateStr.slice(0, 10) })
    },
    select (info) {
      if (!props.selectable) return
      const start = info.start
      const end   = info.end
      const dateStr = info.startStr.slice(0, 10)
      const pad = (n: number) => String(n).padStart(2, '0')
      const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`
      const endTime   = `${pad(end.getHours())}:${pad(end.getMinutes())}`
      const js = start.getDay()
      const dayOfWeek = js === 0 ? 6 : js - 1
      emit('select', { start: info.startStr, end: info.endStr, startTime, endTime, dateStr, dayOfWeek })
      info.view.calendar.unselect()
    },
    eventClick (info: EventClickArg) {
      const ex = info.event.extendedProps as Record<string, unknown>
      emit('eventClick', {
        type          : ex.type as string | undefined,
        exceptionId   : ex.exceptionId as string | undefined,
        constraintId  : ex.constraintId as string | undefined,
        bookingId     : ex.bookingId as string | undefined,
        serviceName   : ex.serviceName as string | undefined,
        clientName    : ex.clientName as string | undefined,
        clientPhone   : ex.clientPhone as string | undefined,
        timeLabel     : ex.timeLabel as string | undefined,
        endLabel      : ex.endLabel as string | undefined,
        duration      : ex.duration as number | undefined,
        price         : ex.price as number | undefined
      })
    }
  }
})

watch(() => props.collaboratorId, () => {
  fcRef.value?.getApi()?.refetchEvents()
})

watch(() => props.activeView, (view) => {
  if (!view || !props.proMode) return
  const api = fcRef.value?.getApi()
  if (!api) return
  closeFcPopover()
  api.changeView(view === 'day' ? 'timeGridDay' : 'timeGridWeek')
})

watch(displayBounds, (b) => {
  const api = fcRef.value?.getApi()
  if (!api || !props.proMode) return
  api.setOption('slotMinTime', b.slotMinTime)
  api.setOption('slotMaxTime', b.slotMaxTime)
  api.setOption('scrollTime', b.slotMinTime)
  if (props.activeView === 'day') {
    api.setOption('eventMaxStack', 999)
    closeFcPopover()
  }
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

.agenda-cal--pro {
  padding: 1rem 1.1rem 1.1rem;
  box-shadow: 0 2px 16px rgba(79, 57, 66, 0.06);
  min-height: calc(100vh - 260px);
  max-height: calc(100vh - 260px);
  display: flex;
  flex-direction: column;
}

.agenda-cal--pro :deep(.fc) {
  flex: 1;
  min-height: 0;
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
  --fc-border-color: #E8E2DE;
  --fc-button-bg-color: #4F3942;
  --fc-button-border-color: #4F3942;
  --fc-button-hover-bg-color: #6B4F59;
  --fc-button-hover-border-color: #6B4F59;
  --fc-button-active-bg-color: #3a2830;
  --fc-today-bg-color: #faf7fc;
  --fc-event-border-color: transparent;
  --fc-now-indicator-color: #D1A1C7;
}

:deep(.fc-toolbar-title) {
  font-family: "Montserrat", sans-serif;
  font-size: 1.05rem !important;
  font-weight: 700;
  color: #2C1810;
  text-transform: capitalize;
}

:deep(.fc-col-header-cell-cushion),
:deep(.fc-timegrid-slot-label-cushion) {
  font-family: "Montserrat", sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  color: #666;
}

:deep(.fc-timegrid-event) {
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(79, 57, 66, 0.15);
  border: none !important;
  overflow: hidden;
}

:deep(.fc-timegrid-event .fc-event-main) {
  height: 100%;
  padding: 0;
}

:deep(.fc-event-main-frame) {
  height: 100%;
}

:deep(.fc-event--booking) {
  cursor: pointer;
  padding: 0 !important;
  background: #4F3942 !important;
}

:deep(.fc-booking-card) {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
  box-sizing: border-box;
}

:deep(.fc-booking-card--col) {
  padding: 3px 5px;
  gap: 1px;
  min-width: 0;
}

:deep(.fc-booking-card--col .fc-booking-card__time) {
  font-size: 0.68rem;
}

:deep(.fc-booking-card--col .fc-booking-card__svc) {
  font-size: 0.65rem;
  font-weight: 600;
}

:deep(.fc-booking-card--week) {
  padding: 2px 3px;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
}

:deep(.fc-booking-card--week .fc-booking-card__time) {
  font-size: 0.62rem;
  text-align: center;
  width: 100%;
}

:deep(.fc-booking-card--xs) {
  padding: 2px 6px;
}

:deep(.fc-booking-card__xs-line) {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  color: #fff;
  line-height: 1.25;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.fc-booking-card__xs-line strong) {
  font-family: "Montserrat", sans-serif;
  font-weight: 800;
}

:deep(.fc-booking-card--sm) {
  padding: 3px 7px;
  gap: 1px;
}

:deep(.fc-booking-card--lg) {
  padding: 6px 9px;
  gap: 3px;
}

:deep(.fc-booking-card__time) {
  font-family: "Montserrat", sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: 0.02em;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.fc-booking-card__svc) {
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.fc-booking-card--lg .fc-booking-card__svc) {
  font-size: 0.85rem;
  white-space: normal;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

:deep(.fc-booking-card__client) {
  font-size: 0.72rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.88);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.fc-booking-pill) {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 3px 5px;
  line-height: 1.2;
  overflow: hidden;
  height: 100%;
}

:deep(.fc-booking-pill__time) {
  font-family: "Montserrat", sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  color: #fff;
}

:deep(.fc-booking-pill__svc) {
  font-size: 0.65rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.fc-open-band) {
  display: block;
  font-size: 0.72rem;
  font-weight: 600;
  color: #4F3942;
  opacity: 0.45;
  padding: 4px 8px;
}

:deep(.fc-open-label) {
  font-size: 0.68rem;
  color: #4F3942;
  opacity: 0.7;
  padding: 2px 4px;
}

:deep(.fc-bg-event) {
  opacity: 1;
  background: rgba(234, 218, 243, 0.5) !important;
  border: none !important;
}

.agenda-cal--pro :deep(.fc-timegrid-col-events) {
  position: relative;
  z-index: 2;
}

.agenda-cal--pro :deep(.fc-timegrid-col-bg) {
  z-index: 1;
}

.agenda-cal--pro :deep(.fc-timegrid-col-bg .fc-bg-event) {
  left: 0 !important;
  right: 0 !important;
  width: 100% !important;
}

:deep(.fc-more-link) {
  font-family: "Montserrat", sans-serif;
  font-size: 0.62rem;
  font-weight: 700;
  color: #4F3942;
  background: rgba(234, 218, 243, 0.85);
  border-radius: 4px;
  padding: 1px 4px;
  margin: 0 1px;
}

.agenda-cal--pro :deep(.fc-timegrid-event-harness) {
  /* Laisser FullCalendar répartir les RDV côte à côte (slotEventOverlap: false) */
  box-sizing: border-box;
}

.agenda-cal--pro :deep(.fc-timegrid-event-harness .fc-timegrid-event) {
  margin: 0 1px;
}

.agenda-cal--pro :deep(.fc-scrollgrid) {
  border-radius: 10px;
  overflow: hidden;
}

.agenda-cal--pro :deep(.fc-timegrid-axis-cushion) {
  font-size: 0.75rem;
  color: #888;
}

.agenda-cal--pro :deep(.fc-daygrid-body),
.agenda-cal--pro :deep(.fc-scrollgrid-section-header) {
  flex-shrink: 0;
}
</style>
