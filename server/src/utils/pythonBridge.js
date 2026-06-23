const { spawn } = require('child_process');
const path = require('path');

function runPythonScript(scriptName, payload, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
    const proc = spawn(pyCmd, [scriptPath, JSON.stringify(payload)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Python script timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      clearTimeout(timer);
      const trimmed = stdout.trim();
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python exited with code ${code}`));
        return;
      }
      try {
        const jsonLine = trimmed.split('\n').filter(Boolean).pop();
        resolve(JSON.parse(jsonLine));
      } catch (e) {
        reject(new Error(`Invalid JSON from Python: ${trimmed.slice(0, 200)}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

module.exports = { runPythonScript };
