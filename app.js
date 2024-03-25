const electron = require('electron')
const url = require('url')
const path = require('path')
const fs = require('fs')
const exec = require('child_process').execFile;

const { app, BrowserWindow, Menu, ipcMain, autoUpdater, dialog } = electron

process.env.NODE_ENV = 'development'

let mainWindow = null
let addWindow = null
let settingsWindow = null
let notepadWindow = null

let workPath = fs.readFileSync(path.join(__dirname, '.path'), 'utf-8')

const methods = {
  editWindowTitle: (e) => {
    let windowTitlePath = `${workPath}/Client/ApplicationName.txt`
    fs.readFile(windowTitlePath, 'ucs2', (err, data) => {
      if (err) {
        mainWindow.webContents.send('error', err)
      } else {
        notepadWindow.webContents.send('notepad:data', { data, path: windowTitlePath })
        notepadWindow.setTitle(`Notepad - "${windowTitlePath.replace(workPath, '')}"`)
        notepadWindow.show()
      }
    })
  }
}

const mainMenuTemplate = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Add text',
        accelerator: process.platform === 'darwin' ? 'Command+N' : 'Ctrl+N',
        click: () => createAddWindow()
      }, {
        label: 'Quit',
        accelerator: process.platform === 'darwin' ? 'Command+Q' : 'Ctrl+Q',
        click: () => app.quit()
      }
    ]
  },
  { label: 'Settings', click: () => createSettingsWindow() }
]

// Listen for app to be ready
app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      preload: path.join(__dirname, 'preload.js')
    },
  })

  mainWindow.loadFile(path.join(__dirname, 'public/views/main.html'),{
    query: {
      data: JSON.stringify({ workPath })
    }
  })

  // Quit app when closed
  mainWindow.on('closed', () => app.quit())

  // Build menu from template
  const mainMenu = Menu.buildFromTemplate(mainMenuTemplate)
  Menu.setApplicationMenu(mainMenu)

  if (!workPath) createSettingsWindow()
  createNotepadWindow()
})

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle create add window
const createAddWindow = () => {
  addWindow = new BrowserWindow({
    width: 350,
    height: 500,
    title: 'Add new text in client',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
    },
  })

  addWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'public/views/add.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Handle garbage collection
  addWindow.on('close', function () {
    addWindow = null
  })
}

const createSettingsWindow = () => {
  if (settingsWindow === null) {
    settingsWindow = new BrowserWindow({
      width: 350,
      height: 200,
      title: 'Settings',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    })

    settingsWindow.loadURL(url.format({
      pathname: path.join(__dirname, 'public/views/settings.html'),
      protocol: 'file:',
      slashes: true
    }))

    // Handle garbage collection
    settingsWindow.on('close', function () {
      settingsWindow = null
    })
  }
}

const createNotepadWindow = () => {
  notepadWindow = new BrowserWindow({
    width: 500,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false
  })

  notepadWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'public/views/notepad.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Handle garbage collection
  notepadWindow.on('close', () => {
    notepadWindow = null
    createNotepadWindow()
  })
}

ipcMain.on('edit:version', (e) => {
  let windowTitlePath = `${workPath}/Interface/Wrap/MainMenu/Main2/Version.txt`
  fs.readFile(windowTitlePath, 'UCS-2', (err, data) => {
    if (err) {
      console.log(err.message)
      mainWindow.webContents.send('error', err.message)
    } else {
      notepadWindow.webContents.send('notepad:data', { data, path: windowTitlePath })
      notepadWindow.setTitle(`Notepad - "${windowTitlePath.replace(workPath, '')}"`)
      notepadWindow.show()
    }
  })
})

ipcMain.on('edit:windowTitle', methods.editWindowTitle)

ipcMain.on('settings:edit', (e, folder) => {
  fs.writeFile(`${path.join(__dirname, '.path')}`, folder, (err) => {
    workPath = folder
    mainWindow.webContents.send('settings:set', folder)
    settingsWindow.close()
    settingsWindow = null
  })
})

ipcMain.on('settings:errorMessage', (e, title, error) => {
  dialog.showErrorBox(title, error);
})

ipcMain.on('notepad:save', (e, data) => {
  console.log(data)
  fs.writeFile(data.path, data.data, 'ucs2', (err) => {
    console.log(err)
    mainWindow.webContents.send('notepad:saved', data.path)
    notepadWindow.close()
    createNotepadWindow()
  })
})

ipcMain.on('add:file', (e, data) => {
  fs.mkdir(`${workPath}/${data.path}/`, { recursive: true }, (err) => {
    if (err) dialog.showErrorBox('Error while creating directory', err.message);
  });
  fs.writeFile(`${workPath}/${data.path}/${data.fileName}.txt`, data.text, 'ucs2', (err) => {
    if (err) dialog.showErrorBox('Error while creating file', err.message);
    mainWindow.webContents.send('notepad:saved', `${data.path}/${data.fileName}.txt`)
    addWindow.close()
  })
})

ipcMain.on('create:windowAddFile', (e) => createAddWindow())

ipcMain.on('action:closeWindow', (e, data) => {
  switch (data.window) {
    case 'notepad': notepadWindow.close(); break
    case 'settings': settingsWindow.close(); break
    default:
      console.log('no window set')
  }
})

ipcMain.on('rebuild', (e, data) => {
  exec(`${path.join(__dirname, 'tools/loc.compiler.exe')} ${workPath} release/pack.loc`, function(err, data) {
    console.log(err)
    console.log(data.toString());
  });
})

// Add developer tools option if in dev
if (process.env.NODE_ENV !== 'production') {
  mainMenuTemplate.push({
    label: 'Developer Tools',
    submenu: [
      {
        role: 'reload'
      },
      {
        label: 'Toggle DevTools',
        accelerator: process.platform === 'darwin' ? 'Command+I' : 'Ctrl+I',
        click(item, focusedWindow) {
          focusedWindow.toggleDevTools()
        }
      }
    ]
  })
}
