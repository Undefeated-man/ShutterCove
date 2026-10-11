(async () => {
  for (let i = 0; i < 600 && (!window.App?.state.photos.length || App.state.scanning); i++) await new Promise(r => setTimeout(r, 50));
  if (App.state.photos.length !== 3) throw Error('SD sync smoke requires exactly three generated fixtures');
  const photo = App.state.photos.find(item => item.jpegPath && item.rawPath) || App.state.photos[0];
  const paths = item => item.allPaths || [item.jpegPath, item.rawPath].filter(Boolean);
  const totalFiles = new Set(App.state.photos.flatMap(paths)).size;
  const selectedFiles = new Set(paths(photo)).size;
  const root = (await timeMachine.getSettings()).libraryRoot;
  const plan = await timeMachine.syncPreview({ directory: root, ids: [photo.id] });
  if (plan.keepCount !== selectedFiles || plan.moveCount !== totalFiles - selectedFiles) throw Error('Incorrect sync preview counts');
  const result = await timeMachine.syncFavorites({ token: plan.token });
  if (result.movedCount !== plan.moveCount || result.errors.length || result.cancelled) throw Error('Native synchronization failed');
  const remaining = await timeMachine.scan(root);
  if (remaining.photos.length !== 1 || remaining.photos[0].stem !== photo.stem) throw Error('Pending-delete files remained in gallery');
  return { passed: 3, checks: ['Native sync preview keeps selection', 'Unselected fixtures move into recoverable pending-delete batch', 'Pending-delete directory is excluded from gallery'], moved: result.movedCount };
})();
