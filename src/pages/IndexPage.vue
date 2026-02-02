<template>
  <div class="row window-height">
    <div class="col-3 shadow-2 column" style="z-index: 500; background: #f5f5f5;">
       <ControlPanel 
         @trigger-auto-assign="runAutoAssign" 
         @trigger-clear="clearAssignments" 
         @reset-view="resetMapView"
         @search-street="handleSearchStreet"
       />
    </div>

    <div class="col-9 relative-position">
      <div id="map" style="height: 100%; width: 100%;"></div>
      
      <q-dialog v-model="editDialog">
        <q-card style="width: 400px">
          <q-card-section class="bg-primary text-white">
            <div class="text-h6">{{ selectedStreetName }}</div>
            <div class="text-caption">Zarządzanie odcinkiem</div>
          </q-card-section>

          <q-card-section class="q-pt-md">
            <div class="text-subtitle2 q-mb-xs">Obecne urządzenia na tej ulicy:</div>
            <div v-if="streetSummary.length > 0" class="q-mb-md bg-grey-2 q-pa-sm rounded-borders">
               <div v-for="(stat, idx) in streetSummary" :key="idx" class="row justify-between text-caption">
                  <span>{{ stat.inspector || 'Nieprzypisane' }}</span>
                  <span class="text-bold">{{ stat.count }} urz.</span>
               </div>
            </div>
            <div v-else class="text-caption text-grey italic q-mb-md">Brak danych w Excelu dla tej ulicy.</div>

            <div class="text-caption text-grey-8 q-mb-xs">Przypisz manualnie (nadpisz):</div>
            <q-select 
              v-model="tempInspector" 
              :options="store.inspectors" 
              label="Wybierz Inspektora" 
              outlined dense
              options-dense
            >
               <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section avatar>
                    <div :style="{backgroundColor: stringToColor(scope.opt)}" style="width:12px;height:12px;border-radius:50%"></div>
                  </q-item-section>
                  <q-item-section>
                    <q-item-label>{{ scope.opt }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
          </q-card-section>

          <q-card-actions align="right" class="bg-grey-1">
            <q-btn flat label="Anuluj" color="grey" v-close-popup />
            <q-btn flat label="Zapisz" color="primary" @click="saveManualAssignment" v-close-popup />
          </q-card-actions>
        </q-card>
      </q-dialog>

      <q-dialog v-model="detailsDialog" full-width full-height>
        <q-card class="column full-height">
          <q-card-section class="row items-center bg-primary text-white q-py-sm shadow-2" style="z-index:10">
            <div class="text-h6">{{ selectedStreetName }}</div>
            <q-space />
            <q-btn icon="close" flat round dense v-close-popup />
          </q-card-section>

          <q-card-section class="q-pb-none bg-grey-1">
             <div class="row q-gutter-sm">
                <q-input v-model="filterText" dense outlined placeholder="Szukaj w tabeli (Opiekun, Firma...)" class="col" bg-color="white">
                  <template v-slot:append><q-icon name="search" /></template>
                </q-input>
             </div>
          </q-card-section>

          <q-card-section class="col q-pa-none scroll">
            <q-table
              :rows="streetDetailsData"
              :columns="detailsColumns"
              :filter="filterText"
              row-key="_label"
              dense
              flat
              virtual-scroll
              :rows-per-page-options="[0]"
              style="height: 100%"
            >
              <template v-slot:body-cell-inspector="props">
                <q-td :props="props">
                  <div class="row items-center">
                    <div :style="{backgroundColor: stringToColor(props.value)}" style="width:8px;height:8px;border-radius:50%;margin-right:6px"></div>
                    {{ props.value }}
                  </div>
                </q-td>
              </template>
            </q-table>
          </q-card-section>
        </q-card>
      </q-dialog>

      <q-inner-loading :showing="store.loading">
        <q-spinner-gears size="50px" color="primary" />
        <div class="text-primary q-mt-sm">Przetwarzanie...</div>
      </q-inner-loading>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, watch, shallowRef } from 'vue'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useMainStore } from 'src/stores/mainStore'
import ControlPanel from 'src/components/ControlPanel.vue'
import { useQuasar, Notify, date } from 'quasar'

// --- KONFIGURACJA ---
const store = useMainStore()
const $q = useQuasar()
const map = shallowRef(null)
const streetIdLookup = shallowRef({}) 

// --- UI STATE ---
const editDialog = ref(false)
const detailsDialog = ref(false)
const selectedStreetName = ref('')
const selectedFeatureId = ref(null)
const tempInspector = ref('')
const streetDetailsData = ref([])
const streetSummary = ref([]) 
const filterText = ref('') 
let hoverPopup = null 

// --- TABELA KOLUMNY ---
const detailsColumns = [
  { name: 'user', label: 'Użytkownik', field: '_user', align: 'left', sortable: true },
  { name: 'label', label: 'Urządzenie', field: '_label', align: 'left', sortable: true },
  { name: 'date', label: 'Data badania', field: '_dateObj', format: val => val ? date.formatDate(val, 'YYYY-MM-DD') : '-', align: 'center', sortable: true },
  { name: 'inspector', label: 'Opiekun', field: '_inspector', align: 'left', sortable: true }
]

const stringToColor = (str) => {
  if (!str) return '#aaaaaa'
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 50%)`;
}

const generateStableId = (str) => {
  let hash = 0;
  if (str.length === 0) return hash;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; 
  }
  return Math.abs(hash);
}

// --- INIT ---
onMounted(async () => {
  await store.loadSavedData() 
  
  map.value = new maplibregl.Map({
    container: 'map',
    style: {
      version: 8,
      sources: { 'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OSM' } },
      layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
    },
    center: [19.4560, 51.7592], 
    zoom: 12
  })
  
  map.value.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

  hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, maxWidth: '300px' });
  map.value.on('load', () => { loadCityData(); map.value.jumpTo({ center: [19.4560, 51.7592], zoom: 12 }); })
})

watch(() => store.currentCity, () => { if(map.value) { map.value.flyTo({ center: store.currentCity.center, zoom: store.currentCity.zoom }); loadCityData() } })
let timeout = null
watch(
  [() => store.mode, () => store.assignments, () => store.devicesData, () => store.timelineStartMonth, () => store.timelineEndMonth, () => store.selectedInspectors],
  () => { clearTimeout(timeout); timeout = setTimeout(() => refreshMapStyles(), 100) },
  { deep: true }
)

const loadCityData = async () => {
  try {
    const rawData = store.currentCity.geoJsonData;
    const data = rawData.default || rawData;
    
    if (!data) return;

    const lookup = {}
    data.features.forEach(f => {
      const rawName = f.properties.name || f.properties.NAM || f.properties.nazwa || '';
      // KLUCZOWE: Używamy tej samej normalizacji co w Store
      const name = store.normalizeStreet(rawName)
      if (name) {
        f.id = generateStableId(name)
        if (!lookup[name]) lookup[name] = []
        lookup[name].push(f.id)
      } else { f.id = Math.floor(Math.random() * 100000000) }
    })
    streetIdLookup.value = lookup

    if (map.value.getSource('streets')) {
      map.value.getSource('streets').setData(data)
    } else {
      map.value.addSource('streets', { type: 'geojson', data, generateId: false })
      
      map.value.addLayer({
        id: 'streets-hitbox',
        type: 'line',
        source: 'streets',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-width': 15, 'line-opacity': 0 } 
      })

      map.value.addLayer({
        id: 'streets-lines',
        type: 'line',
        source: 'streets',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 12, 4, 16, 8],
          'line-opacity': 0.8,
          'line-color': ['coalesce', ['feature-state', 'color'], '#555']
        }
      })

      map.value.addSource('highlight', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.value.addLayer({
        id: 'highlight-line',
        type: 'line',
        source: 'highlight',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#00BCD4',
          'line-width': 10,
          'line-opacity': 0.6,
          'line-blur': 2
        }
      });

      setupInteractions()
    }
    setTimeout(() => refreshMapStyles(), 500)
  } catch (e) { console.error(e) } 
}

const setupInteractions = () => {
  map.value.on('click', 'streets-hitbox', (e) => {
    const feature = e.features[0]
    const rawName = feature.properties.name || 'Nieznana'

    if (store.mode === 'ASSIGN') {
      selectedFeatureId.value = feature.id
      selectedStreetName.value = rawName
      tempInspector.value = store.assignments[feature.id] || ''
      
      const devices = store.getStreetDetails(rawName)
      const summaryMap = {}
      devices.forEach(d => {
         const insp = d._inspector || 'Brak';
         summaryMap[insp] = (summaryMap[insp] || 0) + 1
      })
      streetSummary.value = Object.keys(summaryMap).map(key => ({ inspector: key, count: summaryMap[key] }))
      
      editDialog.value = true
    }
    else if (store.mode === 'HEATMAP') {
      selectedStreetName.value = rawName
      streetDetailsData.value = store.getStreetDetails(rawName)
      detailsDialog.value = true
    }
    else if (store.mode === 'DEADLINES') {
      selectedStreetName.value = rawName
      streetDetailsData.value = store.getDeadlineDetails(rawName)
      detailsDialog.value = true
    }
  })

  map.value.on('mousemove', 'streets-hitbox', (e) => {
    map.value.getCanvas().style.cursor = 'pointer' 
    
    const name = e.features[0].properties.name || 'Brak nazwy'
    let html = `<div style="font-weight:bold;">${name}</div>`
    
    // ZMIANA: Usunięto nieużywaną zmienną normName

    if (store.mode === 'ASSIGN') {
       const currentAssign = store.assignments[e.features[0].id]
       if (currentAssign) html += `<div style="font-size:10px;color:#666">${currentAssign}</div>`
    }
    else if (store.mode === 'HEATMAP') {
       const details = store.getStreetDetails(name)
       const count = details.length
       if (count > 0) html += `<div>Urządzeń: ${count}</div>`
    } 
    else if (store.mode === 'DEADLINES') {
       const details = store.getDeadlineDetails(name)
       const count = details.length
       if (count > 0) html += `<div style="color:red">Badania: ${count}</div>`
    }

    hoverPopup.setLngLat(e.lngLat).setHTML(html).addTo(map.value)
  })

  map.value.on('mouseleave', 'streets-hitbox', () => {
    map.value.getCanvas().style.cursor = ''
    hoverPopup.remove()
  })
}

const resetMapView = () => {
   if (map.value) {
      map.value.flyTo({ center: store.currentCity.center, zoom: store.currentCity.zoom, bearing: 0, pitch: 0 })
      if(map.value.getSource('highlight')) {
          map.value.getSource('highlight').setData({ type: 'FeatureCollection', features: [] });
      }
   }
}

const handleSearchStreet = (val) => {
   const ids = store.resolveStreetIds(val, streetIdLookup.value)
   
   if (ids && ids.length > 0) {
      const rawData = store.currentCity.geoJsonData;
      const data = rawData.default || rawData;
      const features = data.features.filter(f => ids.includes(f.id));

      if (features.length > 0) {
          const highlightData = { type: 'FeatureCollection', features: features };
          map.value.getSource('highlight').setData(highlightData);

          const bounds = new maplibregl.LngLatBounds();
          features.forEach(feature => {
              if(feature.geometry.type === 'LineString') {
                  feature.geometry.coordinates.forEach(coord => bounds.extend(coord));
              }
              if(feature.geometry.type === 'MultiLineString') {
                  feature.geometry.coordinates.forEach(line => line.forEach(coord => bounds.extend(coord)));
              }
          });
          map.value.fitBounds(bounds, { padding: 100, maxZoom: 16 });
          Notify.create({type:'info', message: `Znaleziono: ${val}`})
      }
   } else {
      if(map.value.getSource('highlight')) {
          map.value.getSource('highlight').setData({ type: 'FeatureCollection', features: [] });
      }
      Notify.create({type:'warning', message: 'Nie znaleziono ulicy na mapie.'})
   }
}

const refreshMapStyles = () => {
  if (!map.value || !map.value.getSource('streets')) return
  map.value.removeFeatureState({ source: 'streets' }) 
  const updates = new Map()

  const isInspectorSelected = (inspName) => {
      if (!store.selectedInspectors || store.selectedInspectors.length === 0) return true;
      return store.selectedInspectors.includes(inspName);
  }

  if (store.mode === 'ASSIGN') {
    for (const [id, inspector] of Object.entries(store.assignments)) {
      if (!isInspectorSelected(inspector)) continue;
      updates.set(parseInt(id), stringToColor(inspector))
    }
  } 
  else if (store.mode === 'HEATMAP') {
    for (const [excelStreetName, count] of Object.entries(store.streetDeviceCounts)) {
      if (count > 0) {
        let color = '#ef5350'
        if (count <= 2) color = '#66bb6a'
        else if (count <= 10) color = '#ffa726'
        
        const ids = store.resolveStreetIds(excelStreetName, streetIdLookup.value)
        if (ids) ids.forEach(id => updates.set(id, color))
      }
    }
  }
  else if (store.mode === 'DEADLINES') {
    const deadlines = store.deadlineHeatmap 
    for (const [excelStreetName, count] of Object.entries(deadlines)) {
      if (count > 0) {
        let color = '#fff176' 
        if (count > 2) color = '#fb8c00' 
        if (count > 5) color = '#d32f2f' 
        
        const ids = store.resolveStreetIds(excelStreetName, streetIdLookup.value)
        if (ids) ids.forEach(id => updates.set(id, color))
      }
    }
  }

  updates.forEach((color, id) => {
    map.value.setFeatureState({ source: 'streets', id: id }, { color: color })
  })
}

const runAutoAssign = () => {
  const singleTarget = store.selectedInspectors.length === 1 ? store.selectedInspectors[0] : null;

  let msg = ''
  if (singleTarget) {
     msg = `Czy chcesz automatycznie przypisać ulice <b>TYLKO dla inspektora: ${singleTarget}</b>?`
  } else {
     msg = `Czy chcesz automatycznie przypisać <b>WSZYSTKIE</b> ulice z pliku Excel?`
  }

  $q.dialog({
    title: 'Potwierdzenie automatyzacji',
    message: `${msg}<br><br><span class="text-negative text-bold">UWAGA: Ta operacja nadpisze istniejące przypisania dla tych ulic!</span>`,
    html: true,
    ok: {
      label: 'Wykonaj',
      color: 'negative'
    },
    cancel: {
      label: 'Anuluj',
      color: 'grey',
      flat: true
    }
  }).onOk(() => {
    const assignedCount = store.autoAssignFromExcel(streetIdLookup.value, singleTarget)
    
    if (assignedCount > 0) {
       Notify.create({ type: 'positive', message: `Zaktualizowano ${assignedCount} odcinków ulic.` })
       refreshMapStyles()
    } else {
       Notify.create({ type: 'warning', message: 'Nie znaleziono pasujących ulic do przypisania.' })
    }
  })
}

const clearAssignments = () => {
  store.assignments = {}
  store.saveData()
  refreshMapStyles()
  Notify.create({ type: 'info', message: 'Wyczyszczono pamięć.' })
}

const saveManualAssignment = () => {
  if (selectedFeatureId.value !== null) {
    store.assignments[selectedFeatureId.value] = tempInspector.value
    store.saveData()
    refreshMapStyles()
  }
}
</script>