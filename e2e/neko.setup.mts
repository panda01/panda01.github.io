import { execFileSync } from 'node:child_process';
import { test as setup } from '@playwright/test';

// Building the image and pulling the ~650 MB neko base can take several minutes on first run.
setup.setTimeout(15 * 60 * 1000);

setup('start the local neko browser container', () => {
  execFileSync('npm', ['run', 'neko:up'], { stdio: 'inherit' });
});
