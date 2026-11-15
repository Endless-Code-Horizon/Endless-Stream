const packager = require('@electron/packager');
console.log('Packaging latest desktop EXE...');
packager.packager({
  dir: '.',
  name: 'Endless Stream',
  platform: 'win32',
  arch: 'x64',
  icon: 'Assets/favicon.ico',
  out: 'release-builds',
  overwrite: true,
  ignore: [
    /^\/\.git/,
    /^\/Report/,
    /^\/recording_/,
    /^\/scratch/,
    /^\/release-builds/,
    /^\/android/,
  ],
  prune: false,
}).then(paths => {
  console.log('Successfully packaged updated desktop EXE to:', paths);
}).catch(err => {
  console.error('Packaging error:', err);
});
