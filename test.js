const { execSync } = require('child_process');
execSync('npm run tauri info', { stdio: 'inherit' });
