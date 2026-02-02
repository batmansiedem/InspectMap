import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as XLSX from 'xlsx'
import { Notify, exportFile } from 'quasar'
import lodzGeoData from 'src/assets/lodz.json' 

export const useMainStore = defineStore('main', () => {
  // --- KONFIGURACJA ---
  const currentCity = ref({ 
    name: 'Łódź', 
    geoJsonData: lodzGeoData,
    center: [19.4560, 51.7592], 
    zoom: 12 
  })
  const availableCities = ref([{ name: 'Łódź', geoJsonData: lodzGeoData, center: [19.4560, 51.7592], zoom: 12 }])

  // --- DANE ---
  const assignments = ref({}) 
  const devicesData = ref([]) 
  const inspectors = ref([]) 

  // --- UI STATE ---
  const mode = ref('ASSIGN') 
  const selectedInspectors = ref([]) 
  const timelineStartMonth = ref(0)
  const timelineEndMonth = ref(5)
  const loading = ref(false)

  // --- SŁOWNIKI NAPRAWCZE ---
  const MANUAL_FIXES = {
    'piotrowska': 'piotrkowska',
    'wolczanska': 'wolczanska',
    'politechniki': 'przodownikow pracy', 
    'zamenhoffa': 'zamenhofa',
    'rydza smiglego': 'smiglego rydza',
    'komuny paryskiej': 'komuny paryskiej',
    'sienkiewicza': 'sienkiewicza',
    'pilsudskiego': 'pilsudskiego' 
  }

  // --- SŁOWA DO IGNOROWANIA ---
  const IGNORED_TOKENS = new Set([
    'ul', 'ulica', 'al', 'aleja', 'pl', 'plac', 'os', 'osiedle', 'rondo', 'skwer', 'park', 'rynek',
    'gen', 'generala', 'mjr', 'majora', 'plk', 'pulkownika', 'marsz', 'marszalka', 
    'inz', 'inzyniera', 'dr', 'doktora', 'prof', 'profesora', 
    'sw', 'swietego', 'swietej', 'bl', 'blogoslawionego', 'ks', 'ksiedza', 
    'bp', 'biskupa', 'abp', 'kard', 'papieza', 'krola', 'ksiecia', 
    'jana', 'jozefa', 'stefana', 'jerzego', 'tadeusza', 'stanislawa', 
    'wojciecha', 'adama', 'marii', 'piotra', 'andrzeja', 'michala', 'jaroslawa',
    'krzysztofa', 'zuli', 'maksyma', 'bedricha', 'mahatmy', 'rodzenstwa', 'braci',
    'ofiar', 'obroncow', 'bojownikow'
  ])

  // --- ALGORYTMY POMOCNICZE ---
  const removeDiacritics = (str) => {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, "")
      .replace(/ł/g, 'l').replace(/Ł/g, 'L');
  }

  const levenshtein = (a, b) => {
    if (a.length === 0) return b.length; 
    if (b.length === 0) return a.length; 
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        const cost = b.charAt(i - 1) === a.charAt(j - 1) ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }
    return matrix[b.length][a.length];
  }

  const normalizeStreet = (name) => {
    if (!name) return ''
    let clean = name.toString().toLowerCase();
    clean = removeDiacritics(clean);
    return clean
      .replace(/[^a-z0-9]/g, ' ') 
      .replace(/\s+/g, ' ')
      .trim(); 
  }

  // --- GŁÓWNY ALGORYTM ---
  const matchCache = new Map()

  const resolveStreetIds = (excelStreetName, mapLookup) => {
    if (!excelStreetName) return null;
    
    const normExcel = normalizeStreet(excelStreetName);
    if (matchCache.has(normExcel)) return mapLookup[matchCache.get(normExcel)];

    if (MANUAL_FIXES[normExcel]) {
       const fixedName = MANUAL_FIXES[normExcel];
       const mapKeys = Object.keys(mapLookup);
       const foundKey = mapKeys.find(k => normalizeStreet(k).includes(fixedName));
       if (foundKey) {
          matchCache.set(normExcel, foundKey);
          return mapLookup[foundKey];
       }
    }

    const mapKeys = Object.keys(mapLookup);
    if (mapLookup[normExcel]) {
        matchCache.set(normExcel, normExcel);
        return mapLookup[normExcel];
    }

    const tokens = normExcel.split(' ').filter(t => t.length > 2);
    const validTokens = tokens.filter(t => !IGNORED_TOKENS.has(t));
    const searchTokens = validTokens.length > 0 ? validTokens : tokens;
    const keyToken = searchTokens.reduce((a, b) => a.length >= b.length ? a : b, '');

    if (!keyToken || keyToken.length < 3) return null;

    let bestMatchKey = null;

    for (const mapKey of mapKeys) {
        const normMap = normalizeStreet(mapKey);
        
        if (normMap.includes(keyToken)) {
            bestMatchKey = mapKey;
            break; 
        }

        if (keyToken.length > 5) {
             const mapTokens = normMap.split(' ');
             const isFuzzyMatch = mapTokens.some(mt => mt.length > 5 && levenshtein(mt, keyToken) <= 1);
             if (isFuzzyMatch) {
                 bestMatchKey = mapKey;
                 break;
             }
        }
    }

    if (bestMatchKey) {
      matchCache.set(normExcel, bestMatchKey);
      return mapLookup[bestMatchKey];
    }

    matchCache.set(normExcel, null);
    return null;
  }

  // --- GETTERS ---
  // Funkcja pomocnicza używana teraz w gettersach
  const isMatch = (excelName, filterName) => {
     if (!excelName || !filterName) return false;
     const n1 = normalizeStreet(excelName);
     const n2 = normalizeStreet(filterName);
     return n1.includes(n2) || n2.includes(n1);
  }

  const getStreetDetails = (streetName) => {
    return devicesData.value.filter(row => {
      if (selectedInspectors.value.length > 0 && !selectedInspectors.value.includes(row._inspector)) return false;
      // UŻYCIE isMatch - naprawia błąd ESLint i logikę
      return isMatch(row._originalStreet, streetName);
    })
  }

  const getDeadlineDetails = (streetName) => {
    const startDate = new Date(); startDate.setMonth(startDate.getMonth() + timelineStartMonth.value);
    const endDate = new Date(); endDate.setMonth(endDate.getMonth() + timelineEndMonth.value);
    startDate.setDate(1); startDate.setHours(0,0,0,0);
    endDate.setDate(1); endDate.setMonth(endDate.getMonth() + 1); endDate.setDate(0); endDate.setHours(23,59,59,999);

    return devicesData.value.filter(row => {
      if (selectedInspectors.value.length > 0 && !selectedInspectors.value.includes(row._inspector)) return false;
      
      // UŻYCIE isMatch
      if (!isMatch(row._originalStreet, streetName)) return false;
      
      if (row._dateObj) {
         return row._dateObj >= startDate && row._dateObj <= endDate
      }
      return false
    })
  }

  const streetDeviceCounts = computed(() => {
    const counts = {}
    devicesData.value.forEach(row => {
      if (selectedInspectors.value.length > 0 && !selectedInspectors.value.includes(row._inspector)) return;
      const street = row._originalStreet; 
      if (street) counts[street] = (counts[street] || 0) + 1
    })
    return counts
  })

  const deadlineHeatmap = computed(() => {
    const counts = {}
    const startDate = new Date(); startDate.setMonth(startDate.getMonth() + timelineStartMonth.value);
    const endDate = new Date(); endDate.setMonth(endDate.getMonth() + timelineEndMonth.value);
    startDate.setDate(1); startDate.setHours(0,0,0,0);
    endDate.setDate(1); endDate.setMonth(endDate.getMonth() + 1); endDate.setDate(0); endDate.setHours(23,59,59,999);

    devicesData.value.forEach(row => {
      if (selectedInspectors.value.length > 0 && !selectedInspectors.value.includes(row._inspector)) return;
      if (row._dateObj && row._dateObj >= startDate && row._dateObj <= endDate) {
        const street = row._originalStreet;
        if (street) counts[street] = (counts[street] || 0) + 1
      }
    })
    return counts
  })

  // --- ACTIONS ---
  const loadExcel = async (file) => {
    loading.value = true
    devicesData.value = [] 
    inspectors.value = [] 
    matchCache.clear() 

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { range: 1 })
      
      if (jsonData.length === 0) throw new Error("Pusty plik")

      const newInspectors = new Set()
      const findKey = (row, partial) => Object.keys(row).find(k => k.toLowerCase().replace(/\s/g,'').includes(partial.toLowerCase()))

      const processedData = jsonData.map(row => {
        const kSur = findKey(row, 'Opiekun-Nazwisko')
        const kName = findKey(row, 'Opiekun-Imię')
        const kStreet = findKey(row, 'LokalizacjaUT-Ulica') || findKey(row, 'Ulica')
        const kDate = findKey(row, 'Datubadania') || findKey(row, 'Datanajbliższego')
        const kType = findKey(row, 'Typ') || 'UT'
        const kFab = findKey(row, 'Nrfabryczny') || 'Nr'
        const kUser = findKey(row, 'Nazwa użytkownika') || findKey(row, 'Użytkownik')

        let fullName = null
        if (kSur && row[kSur]) {
          fullName = (row[kSur] + ' ' + (kName && row[kName] ? row[kName] : '')).trim()
          newInspectors.add(fullName)
        }

        let dateObj = null
        if (kDate && row[kDate]) {
          if (typeof row[kDate] === 'number') dateObj = new Date(Math.round((row[kDate] - 25569) * 86400 * 1000))
          else dateObj = new Date(row[kDate])
        }

        const rawStreet = row[kStreet] || '';
        return {
          ...row,
          _inspector: fullName,
          _originalStreet: rawStreet,
          _normalizedStreet: rawStreet, 
          _dateObj: dateObj,
          _label: `${row[kType] || ''} ${row[kFab] || ''}`,
          _user: row[kUser] || 'Brak danych'
        }
      })

      devicesData.value = processedData
      inspectors.value = Array.from(newInspectors).filter(Boolean).sort()
      Notify.create({ type: 'positive', message: `Wczytano ${processedData.length} urządzeń.` })
      mode.value = 'HEATMAP'

    } catch (e) {
      console.error(e); Notify.create({ type: 'negative', message: 'Błąd pliku: ' + e.message })
    } finally {
      loading.value = false
    }
  }

  const autoAssignFromExcel = (streetIdLookup, specificInspector = null) => {
    loading.value = true
    let count = 0
    devicesData.value.forEach(row => {
      if (specificInspector && row._inspector !== specificInspector) return;
      if (row._inspector && row._originalStreet) {
        const ids = resolveStreetIds(row._originalStreet, streetIdLookup)
        if (ids) {
          ids.forEach(id => {
            assignments.value[id] = row._inspector
            count++
          })
        }
      }
    })
    loading.value = false
    return count
  }

  const exportAssignments = () => {
    const status = exportFile('przydzialy_mapa.json', JSON.stringify(assignments.value), 'application/json')
    if (status) Notify.create({ type: 'positive', message: 'Eksport udany' })
  }

  const importAssignmentsJSON = async (file) => {
    try {
      const text = await file.text()
      assignments.value = JSON.parse(text)
      Notify.create({ type: 'positive', message: 'Import udany' })
    } catch (e) { Notify.create({ type: 'negative', message: 'Błąd pliku JSON' }); console.error(e) }
  }

  const loadSavedData = async () => {
    if (window.myElectron) {
      const saved = await window.myElectron.loadData()
      if (saved) assignments.value = JSON.parse(saved).assignments || {}
    }
  }

  const saveData = async () => {
    if (window.myElectron) await window.myElectron.saveData(JSON.stringify({ assignments: assignments.value }))
  }

  return {
    currentCity, availableCities, assignments, devicesData, inspectors,
    mode, selectedInspectors, timelineStartMonth, timelineEndMonth, loading,
    streetDeviceCounts, deadlineHeatmap, 
    getStreetDetails, getDeadlineDetails, normalizeStreet, resolveStreetIds,
    loadExcel, autoAssignFromExcel, exportAssignments, importAssignmentsJSON, loadSavedData, saveData
  }
})