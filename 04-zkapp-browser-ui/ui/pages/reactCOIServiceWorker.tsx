
export function loadCOISerivceWorker() {
  if (typeof window !== 'undefined' && window.location.hostname != 'localhost') {
    const coi = window.document.createElement('script');
    coi.setAttribute('src','/zkApp-examples/coi-serviceworker.min.js');
    window.document.head.appendChild(coi);
  }
}
