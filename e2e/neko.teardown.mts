import { execFileSync } from 'node:child_process';
import { test as teardown } from '@playwright/test';

teardown('stop the local neko browser container', () => {
  execFileSync('npm', ['run', 'neko:down'], { stdio: 'inherit' });
});
