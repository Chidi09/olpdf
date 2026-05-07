'use client'

export function PluginWorkerShell() {
  const initWorker = (bundleUrl: string) => {
    const workerBlob = new Blob([`
      self.onmessage = async (e) => {
        const { type, bundleUrl } = e.data;
        if (type === 'INIT') {
          try {
            importScripts(bundleUrl);
            self.postMessage({ type: 'READY' });
          } catch (err) {
            self.postMessage({ type: 'ERROR', error: err.message });
          }
        }
      };
    `], { type: 'application/javascript' });
    
    const worker = new Worker(URL.createObjectURL(workerBlob));
    worker.postMessage({ type: 'INIT', bundleUrl });
    
    worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'READY') {
        console.log('Plugin worker operational');
      } else if (type === 'ERROR') {
        console.error('Plugin worker error:', payload);
      }
    };
    
    return worker;
  };

  return { initWorker };
}
