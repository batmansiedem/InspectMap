<template>
  <div class="column full-height q-pa-md bg-grey-2 scroll">
    <div class="text-h6 text-primary q-mb-sm">Planer UDT</div>

    <q-select v-model="store.currentCity" :options="store.availableCities" option-label="name" label="Miasto" dense outlined bg-color="white" class="q-mb-xs" />
    
    <q-file v-model="excelFile" label="Baza Urządzeń (Excel)" dense outlined bg-color="white" accept=".xlsx, .xls" class="q-mb-md" :loading="store.loading" @update:model-value="store.loadExcel">
      <template v-slot:prepend><q-icon name="table_view" /></template>
    </q-file>

    <q-separator class="q-mb-md" />

    <q-input v-model="searchQuery" label="Znajdź ulicę" dense outlined bg-color="white" class="q-mb-md" @keyup.enter="$emit('search-street', searchQuery)">
       <template v-slot:append>
          <q-btn round dense flat icon="search" @click="$emit('search-street', searchQuery)" />
       </template>
    </q-input>

    <q-btn outline color="primary" label="Wycentruj mapę" icon="my_location" class="full-width q-mb-md" @click="$emit('reset-view')" size="sm" />

    <div class="text-subtitle2 q-mb-xs">Tryb widoku:</div>
    <q-list bordered separator class="bg-white q-mb-md border-grey-4">
      <q-item 
        v-for="opt in modeOptions" 
        :key="opt.value"
        clickable 
        v-ripple.mat
        :active="store.mode === opt.value"
        active-class="bg-primary text-white"
        @click="store.mode = opt.value"
        class="q-py-sm"
      >
        <q-item-section avatar style="min-width: 40px">
          <q-icon :name="opt.icon" />
        </q-item-section>
        <q-item-section>
          <q-item-label class="text-weight-medium">{{ opt.label }}</q-item-label>
        </q-item-section>
      </q-item>
    </q-list>

    <div class="q-mb-md animate-fade">
      <q-select 
        v-model="store.selectedInspectors" 
        :options="store.inspectors" 
        label="Filtruj inspektorów" 
        dense outlined bg-color="white" 
        multiple 
        use-chips
        stack-label
        class="q-mb-sm"
      >
        <template v-slot:option="{ itemProps, opt, selected, toggleOption }">
          <q-item v-bind="itemProps">
            <q-item-section side>
              <q-checkbox :model-value="selected" @update:model-value="toggleOption(opt)" />
            </q-item-section>
            
            <q-item-section avatar>
              <div :style="{backgroundColor: stringToColor(opt)}" style="width:12px;height:12px;border-radius:50%"></div>
            </q-item-section>
            
            <q-item-section>
              <q-item-label>{{ opt }}</q-item-label>
            </q-item-section>
          </q-item>
        </template>
      </q-select>
    </div>

    <div v-if="store.mode === 'ASSIGN'" class="q-mb-md animate-fade">
      <div class="row q-gutter-xs q-mb-sm">
        <q-btn color="positive" label="Auto z Excela" size="sm" icon="auto_fix_high" class="col" @click="$emit('trigger-auto-assign')" />
        <q-btn color="negative" label="Wyczyść" size="sm" icon="delete" class="col" @click="$emit('trigger-clear')" />
      </div>

      <q-separator class="q-my-sm"/>
      <div class="text-caption text-grey-8 q-mb-xs">Plik przydziałów (JSON):</div>
      <div class="row q-gutter-xs">
         <q-btn color="grey-8" label="Eksportuj" size="sm" icon="download" class="col" @click="store.exportAssignments" />
         <q-file v-model="jsonFile" label="Importuj" dense outlined class="col" accept=".json" style="padding:0" @update:model-value="store.importAssignmentsJSON">
            <template v-slot:prepend><q-icon name="upload" size="xs"/></template>
         </q-file>
      </div>
    </div>

    <div v-if="store.mode === 'DEADLINES'" class="q-mb-md animate-fade bg-white q-pa-sm rounded-borders shadow-1">
       <div class="text-caption text-bold">Zakres badań:</div>
       
       <div class="row q-col-gutter-xs q-mb-sm">
          <div class="col-6">
             <div class="text-caption text-grey">Od (miesiąc):</div>
             <q-input v-model.number="store.timelineStartMonth" type="number" dense outlined min="0" />
          </div>
          <div class="col-6">
             <div class="text-caption text-grey">Do (miesiąc):</div>
             <q-input v-model.number="store.timelineEndMonth" type="number" dense outlined min="0" />
          </div>
       </div>

       <div class="text-center text-primary text-bold q-mb-sm">
          {{ formatDateRange }}
       </div>

       <q-range
         v-model="rangeModel"
         :min="0"
         :max="24"
         label
         color="primary"
         markers
       />
       
       <div class="q-pa-sm bg-orange-1 q-mt-sm rounded-borders text-caption">
         <q-icon name="touch_app" color="orange" /> Najedź na ulicę, by zobaczyć badania w tym okresie.
       </div>
    </div>

    <q-space />
    
    <div v-if="store.mode !== 'ASSIGN'" class="bg-white q-pa-sm rounded-borders q-mt-md shadow-1">
      <div class="text-caption text-center q-mb-xs">Natężenie</div>
      <div style="background: linear-gradient(to right, #66bb6a, #ffa726, #ef5350); height: 8px; border-radius: 4px;"></div>
      <div class="row justify-between text-caption text-grey" style="font-size:9px">
        <span>Mało</span><span>Średnio</span><span>Dużo</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useMainStore } from 'src/stores/mainStore'
import { date } from 'quasar'

const store = useMainStore()
const excelFile = ref(null)
const jsonFile = ref(null) 
const searchQuery = ref('')
const rangeModel = ref({ min: 0, max: 1 }) 

// Ten watcher automatycznie aktualizuje store, gdy ruszasz suwakiem
watch(() => rangeModel.value, (val) => {
   store.timelineStartMonth = val.min
   store.timelineEndMonth = val.max
})

// Inicjalizacja pozycji suwaka na podstawie store
watch(() => store.timelineStartMonth, () => rangeModel.value.min = store.timelineStartMonth, { immediate: true })
watch(() => store.timelineEndMonth, () => rangeModel.value.max = store.timelineEndMonth, { immediate: true })

defineEmits(['trigger-auto-assign', 'trigger-clear', 'reset-view', 'search-street'])

const modeOptions = [
  { label: 'Przydzielanie', value: 'ASSIGN', icon: 'edit_location' },
  { label: 'Heatmapa', value: 'HEATMAP', icon: 'layers' },
  { label: 'Terminy', value: 'DEADLINES', icon: 'event' }
]

const formatDateRange = computed(() => {
  const d1 = new Date(); d1.setMonth(d1.getMonth() + store.timelineStartMonth);
  const d2 = new Date(); d2.setMonth(d2.getMonth() + store.timelineEndMonth);
  return `${date.formatDate(d1, 'MM.YYYY')} - ${date.formatDate(d2, 'MM.YYYY')}`
})

const stringToColor = (str) => {
  if (!str) return '#aaa'
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 50%)`;
}
</script>

<style scoped>
.animate-fade { animation: fadeIn 0.4s ease-out; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>