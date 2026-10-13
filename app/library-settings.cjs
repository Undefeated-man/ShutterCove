'use strict';
const path = require('node:path');

// Persist user-selected scopes separately from temporary search authorization.
function librarySettings(saved = {}) {
  const candidates = Array.isArray(saved.libraryRoots) ? saved.libraryRoots : [saved.libraryRoot];
  const libraryRoots = [...new Set(candidates.filter(root => typeof root === 'string' && path.isAbsolute(root)).map(root => path.resolve(root)))];
  return { libraryRoots, libraryRoot: libraryRoots.includes(saved.libraryRoot) ? saved.libraryRoot : libraryRoots[0] || '', defaultTheme: typeof saved.defaultTheme === 'string' ? saved.defaultTheme : '' };
}
function registerLibrary(settings, root, theme = '') {
  const current = librarySettings(settings);
  return { ...current, libraryRoots: [...new Set([...current.libraryRoots, root])], libraryRoot: root, defaultTheme: theme };
}
function removeLibrary(settings, root) {
  const current = librarySettings(settings);
  const libraryRoots = current.libraryRoots.filter(value => value !== root);
  return { ...current, libraryRoots, libraryRoot: libraryRoots.includes(current.libraryRoot) ? current.libraryRoot : libraryRoots[0] || '', defaultTheme: '' };
}
module.exports = { librarySettings, registerLibrary, removeLibrary };
