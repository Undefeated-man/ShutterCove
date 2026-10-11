const { contextBridge, ipcRenderer } = require('electron');
const methods = ['chooseFolder','chooseEditor','getSettings','saveSettings','scan','update','thumbnail','source','analyzeColors','similar','cancel','importPhotos','syncPreview','syncFavorites','revealDirectory','reveal','openEditor','trash','saveImage','cacheInfo','clearCache'];
const api = Object.fromEntries(methods.map(name => [name, arg => ipcRenderer.invoke(`memory:${name}`, arg)]));
api.onProgress = cb => {
  if (typeof cb !== 'function') return () => {};
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on('memory:progress', listener);
  return () => ipcRenderer.removeListener('memory:progress', listener);
};
contextBridge.exposeInMainWorld('timeMachine', api);
