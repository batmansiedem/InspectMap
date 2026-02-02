import { app, BrowserWindow, ipcMain } from 'electron' // <--- DODANO ipcMain
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs' // <--- DODANO system plików
import { fileURLToPath } from 'node:url'

// needed in case process is undefined under Linux
const platform = process.platform || os.platform()

const currentDir = fileURLToPath(new URL('.', import.meta.url))

// <--- DEFINICJA ŚCIEŻKI DO PLIKU DANYCH --->
const dbPath = path.join(app.getPath('userData'), 'assignments.json')

let mainWindow

async function createWindow () {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    icon: path.resolve(currentDir, 'icons/icon.png'), // tray icon
    width: 1000,
    height: 600,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      // More info: https://v2.quasar.dev/quasar-cli-vite/developing-electron-apps/electron-preload-script
      preload: path.resolve(
        currentDir,
        path.join(process.env.QUASAR_ELECTRON_PRELOAD_FOLDER, 'electron-preload' + process.env.QUASAR_ELECTRON_PRELOAD_EXTENSION)
      )
    }
  })

  mainWindow.setMenu(null)
  if (process.env.DEV) {
    await mainWindow.loadURL(process.env.APP_URL)
  } else {
    await mainWindow.loadFile('index.html')
  }

  if (process.env.DEBUGGING) {
    // if on DEV or Production with debug enabled
    mainWindow.webContents.openDevTools()
  } else {
    // we're on production; no access to devtools pls
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools()
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// <--- TUTAJ JEST KLUCZOWA ZMIANA --->
app.whenReady().then(() => {
  
  // 1. Rejestracja obsługi ODCZYTU
  ipcMain.handle('load-assignments', async () => {
    try {
      console.log('Wczytywanie danych z:', dbPath)
      if (fs.existsSync(dbPath)) {
        return fs.readFileSync(dbPath, 'utf-8')
      }
      return null
    } catch (e) {
      console.error('Błąd odczytu:', e)
      return null
    }
  })

  // 2. Rejestracja obsługi ZAPISU
  ipcMain.handle('save-assignments', async (event, data) => {
    try {
      console.log('Zapisywanie danych do:', dbPath)
      fs.writeFileSync(dbPath, data, 'utf-8')
      return { success: true }
    } catch (e) {
      console.error('Błąd zapisu:', e)
      return { success: false, error: e.message }
    }
  })

  // Dopiero teraz tworzymy okno
  createWindow()
})

app.on('window-all-closed', () => {
  if (platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})