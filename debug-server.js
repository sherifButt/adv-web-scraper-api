// Debug script to run the server with debug output
import { spawn } from 'child_process';

const debug = spawn('npx', ['tsx', 'src/server.ts'], {
  env: {
    ...process.env,
    DEBUG: '*',
    NODE_DEBUG: 'module,loader',
  },
  stdio: 'inherit',
});

debug.on('error', (err) => {
  console.error('Failed to start debug process:', err);
});

debug.on('exit', (code, signal) => {
  console.log(`Debug process exited with code ${code} and signal ${signal}`);
});
