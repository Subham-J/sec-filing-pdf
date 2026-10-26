import {isFilingUrl, validateOptions} from './common.js';
const form = document.querySelector('form'), status = document.querySelector('#status'), button = document.querySelector('button');
let tab;
try {
  [tab] = await chrome.tabs.query({active:true,currentWindow:true});
  if (!isFilingUrl(tab?.url)) throw new Error('Open the SEC filing itself on sec.gov, then click this extension. For Inline XBRL, use the viewer’s Open document link first.');
  document.querySelector('#filing').textContent = tab.title || new URL(tab.url).pathname.split('/').pop();
  button.disabled = false;
} catch (error) { status.textContent = error.message; status.className = 'error'; }
form.addEventListener('submit', async event => {
  event.preventDefault(); button.disabled = true;
  try {
    const options = validateOptions({...Object.fromEntries(new FormData(form)), compact:form.elements.compact.checked});
    const job = {tabId:tab.id,url:tab.url,options};
    await chrome.tabs.create({url:chrome.runtime.getURL('export.html')+'#'+encodeURIComponent(JSON.stringify(job))});
    window.close();
  } catch (error) { status.textContent = error.message; button.disabled=false; }
});
