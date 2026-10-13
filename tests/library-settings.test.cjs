'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { librarySettings, registerLibrary, removeLibrary } = require('../app/library-settings.cjs');

test('old single-folder installation migrates without registering its import destination', () => {
  assert.deepEqual(librarySettings({libraryRoot:'/archive/trip',importDestination:'/archive'}), {libraryRoots:['/archive/trip'],libraryRoot:'/archive/trip',defaultTheme:''});
});
test('multiple scopes and chosen theme survive restart, while explicit empty index stays empty', () => {
  const first = registerLibrary({libraryRoot:'/archive/trip'},'/external/autumn','Autumn');
  assert.deepEqual(librarySettings(first),first);
  assert.equal(registerLibrary(first,'/external/autumn','Autumn').libraryRoots.length,2);
  const removed = removeLibrary(first,'/external/autumn');
  assert.equal(removed.libraryRoot,'/archive/trip');
  assert.equal(removed.defaultTheme,'');
  assert.deepEqual(librarySettings(removeLibrary(removed,'/archive/trip')).libraryRoots,[]);
});
