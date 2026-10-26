import {isFilingUrl,validateOptions,dimensions,filename} from './common.js';
import {prepareFiling} from './prepare.js';
const status = document.querySelector('#status'), heading = document.querySelector('#heading'), details = document.querySelector('#details');
let objectUrl;
let busy = true;
window.addEventListener('beforeunload',event => {if (busy) {event.preventDefault(); event.returnValue='';}});
async function run() {
  let target, attached = false, stream, key;
  let cleanupWarning = false;
  try {
    const job = JSON.parse(decodeURIComponent(location.hash.slice(1)));
    // Clear the filing URL from this tab's history once read.
    history.replaceState(null,'',location.pathname);
    if (!Number.isInteger(job.tabId) || !isFilingUrl(job.url)) throw new Error('Open a SEC filing and start a new export from the extension.');
    const tab = await chrome.tabs.get(job.tabId);
    if (tab.url !== job.url) throw new Error('The filing tab changed. Open the filing and start a new export.');
    const options = validateOptions(job.options || {}), [width,height] = dimensions(options);
    const printablePixels = Math.floor((width-2*options.margin)*96);
    target = {tabId:job.tabId};
    key = '__secPdf_' + crypto.randomUUID().replaceAll('-','');
    const send = (method,params={}) => chrome.debugger.sendCommand(target,method,params);
    try {await chrome.debugger.attach(target,'1.3'); attached=true;}
    catch (error) {throw new Error('Chrome could not start PDF export. Close DevTools or another debugger on the filing tab, then retry. ' + error.message);}
    status.textContent = 'Loading fonts and images, then fitting the print layout...';
    await send('Emulation.setDeviceMetricsOverride',{width:printablePixels,height:1000,deviceScaleFactor:1,mobile:false});
    await send('Emulation.setEmulatedMedia',{media:'print'});
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result.value;
    };
    const prepared = await evaluate(`(${prepareFiling.toString()})(${JSON.stringify({...options,width,height,sourceUrl:job.url})},${JSON.stringify(key)})`);
    const scale = prepared.nativePages ? 1 : Math.min(1,printablePixels/prepared.width);
    if (scale < .8) throw new Error('The filing still contains content wider than the paper. Export stopped to prevent tiny text. Try landscape; if it persists, save the original HTML for layout inspection.');
    
    const warnings = [...prepared.warnings];
    if (prepared.nativePages) warnings.push('Original page dimensions and margins preserved, including landscape pages.');
    status.textContent = 'Rendering the PDF. Long filings can take a few minutes...';
    const printed = await send('Page.printToPDF',{
      landscape:false, paperWidth:width,paperHeight:height,
      marginTop:options.margin,marginBottom:options.margin,marginLeft:options.margin,marginRight:options.margin,
      displayHeaderFooter:false,printBackground:true,scale,preferCSSPageSize:prepared.nativePages,
      generateTaggedPDF:false,generateDocumentOutline:false,transferMode:'ReturnAsStream'
    });
    stream = printed.stream;
    if (!stream) throw new Error('Chrome did not return a PDF stream. Update Chrome and retry.');
    const chunks = [];
    let total = 0;
    for (;;) {
      const part = await send('IO.read',{handle:stream,size:1024*1024});
      const bytes = part.base64Encoded ? Uint8Array.from(atob(part.data),c=>c.charCodeAt(0)) : new TextEncoder().encode(part.data);
      chunks.push(bytes); total += bytes.length;
      status.textContent = `Receiving PDF: ${(total/1024/1024).toFixed(1)} MB...`;
      if (part.eof) break;
    }
    await send('IO.close',{handle:stream}); stream=null;
    objectUrl = URL.createObjectURL(new Blob(chunks,{type:'application/pdf'}));
    const name = filename(job.url), link = document.querySelector('#download');
    link.href=objectUrl; link.download=name; link.hidden=false;
    heading.textContent = 'Your PDF is ready';
    status.className='success'; status.textContent=`${name} (${(total/1024/1024).toFixed(2)} MB)`;
    details.textContent = `${options.paper === 'a4' ? 'A4' : 'US Letter'}, ${options.orientation}, ${Math.round(scale*100)}% scale. ${prepared.compressed} image(s) compacted. ${prepared.pages} source page panels normalized; ${prepared.emptyPages} empty panels removed.\n${warnings.join('\n')}`;

  } catch (error) {
    heading.textContent='Export could not finish'; status.className='error'; status.textContent=error.message;
    document.querySelector('#note').textContent='Return to the filing, check that it is fully loaded, and start a fresh export. If Chrome reports printing is unavailable, use Chrome’s Print > Save as PDF.';
  } finally {
    if (attached) {
      const send = (method,params={}) => chrome.debugger.sendCommand(target,method,params);
      if (stream) await send('IO.close',{handle:stream}).catch(()=>{});
      if (key) await send('Runtime.evaluate',{expression:`window[${JSON.stringify(key)}]?.restore()`}).catch(()=>{cleanupWarning=true;});
      await send('Emulation.setEmulatedMedia',{media:''}).catch(()=>{cleanupWarning=true;});
      await send('Emulation.clearDeviceMetricsOverride').catch(()=>{cleanupWarning=true;});
      await chrome.debugger.detach(target).catch(()=>{});
    }
    if (cleanupWarning) details.textContent += '\nReload the filing tab to restore its layout.';
    busy=false;
  }
  // Restore the filing before a save dialog can hold this tab open.
  if (objectUrl) {
    try {
      const name = document.querySelector('#download').download;
      await chrome.downloads.download({url:objectUrl,filename:name,saveAs:true});
      document.querySelector('#note').textContent = 'Choose where to save in Chrome’s dialog. If you canceled, use “Save PDF again”.';
    } catch {
      document.querySelector('#note').textContent = 'Automatic save was canceled or unavailable. Use “Save PDF again” to download the generated file.';
    }
  }
}
run();
