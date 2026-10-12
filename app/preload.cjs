const { contextBridge, ipcRenderer } = require('electron');
const methods = ['previewGif','saveGif','cancelGif','releaseGif','getPhotoFullscreen','setPhotoFullscreen','chooseFolder','chooseEditor','getSettings','saveSettings','getUpdateState','checkForUpdates','downloadUpdate','installUpdate','scan','update','thumbnail','source','analyzeColors','similar','cancel','importPhotos','copySelected','syncPreview','syncFavorites','revealDirectory','reveal','openEditor','trash','saveImage','cacheInfo','clearCache'];
const api = Object.fromEntries(methods.map(name => [name, arg => ipcRenderer.invoke(`memory:${name}`, arg)]));
api.onProgress = cb => {
  if (typeof cb !== 'function') return () => {};
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on('memory:progress', listener);
  return () => ipcRenderer.removeListener('memory:progress', listener);
};
api.onUpdateState = cb => {
  if (typeof cb !== 'function') return () => {};
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on('memory:update-state', listener);
  return () => ipcRenderer.removeListener('memory:update-state', listener);
};
api.onPhotoFullscreen = cb => {
  if (typeof cb !== 'function') return () => {};
  const listener = (_event, payload) => cb(payload);
  ipcRenderer.on('memory:photo-fullscreen', listener);
  return () => ipcRenderer.removeListener('memory:photo-fullscreen', listener);
};
contextBridge.exposeInMainWorld('timeMachine', api);
