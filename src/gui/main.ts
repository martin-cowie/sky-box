import {app, BrowserWindow, Menu, webContents} from 'electron';

function createWindow () {
  const template: any = [
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Find',
          accelerator: 'CommandOrControl+F',
          click: () => {
            const content = webContents.getFocusedWebContents();
            content?.send('toggleFind');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Show watched content',
          type: 'checkbox',
          checked: true,
          accelerator: 'CommandOrControl+W',
          click: (menuItem: any) => {
            const content = webContents.getFocusedWebContents();
            content?.send('showViewedContent', menuItem.checked);
          }
        },
      ]
    }
  ];
  if (process.platform == 'darwin') {
    var appName = app.name;
    template.unshift({
      label: appName,
      submenu: [
        {
          label: 'About ' + appName,
          role: 'about'
        },
        {
          type: 'separator'
        },
        {
          label: 'Hide ' + appName,
          accelerator: 'Command+H',
          role: 'hide'
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          role: 'hideothers'
        },
        {
          label: 'Show All',
          role: 'unhide'
        },
        {
          type: 'separator'
        },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: function() { app.quit(); }
        },
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadFile('index.html');
  win.webContents.openDevTools();
}

app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
});
