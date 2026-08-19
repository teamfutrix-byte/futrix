export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbysnDWGpDmNvSYvnl9o_SezWAijjXYcV2Vp-47MxmYY3z8pXTLGP82DO3xg1wQ9iQs1/exec';
export const FORM_ACTION = 'https://docs.google.com/forms/d/e/1FAIpQLSf-7Suj6ShEl0ckmRVzF83S3mrC_dYB2RCh61pCm4QSy27Aug/formResponse';

export const ENTRY = {
  fullName: 'entry.532084623',
  email: 'entry.83129113',
  phone: 'entry.1959093475',
  preparation: 'entry.1154882550',
  preparationOther: 'entry.1154882550.other_option_response',
};

// JSONP request helper
export function jsonpRequest(baseUrl, params) {
  return new Promise((resolve, reject) => {
    const cbName = 'ftx_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('timeout'));
    }, 15000);

    window[cbName] = (data) => {
      cleanup();
      resolve(data);
    };

    function cleanup() {
      clearTimeout(timer);
      delete window[cbName];
      const el = document.getElementById('_ftxjsonp');
      if (el) el.remove();
    }

    const qs = Object.keys(params)
      .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
      .join('&');
    const script = document.createElement('script');
    script.id = '_ftxjsonp';
    script.src = baseUrl + '?' + qs + '&callback=' + cbName;
    script.onerror = () => {
      cleanup();
      reject(new Error('network'));
    };
    document.head.appendChild(script);
  });
}

// Plain Fetch helper
export async function plainFetch(url, options = {}) {
  const res = await fetch(url, { redirect: 'follow', ...options });
  const text = await res.text();
  // Clean JSONP if returned as callback function
  const cleaned = text.trim()
    .replace(/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/, '')
    .replace(/\)\s*;?\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    return { success: false, message: 'JSON parse error: ' + e.message };
  }
}
