// Runs inside the filing tab via Runtime.evaluate. Keep this function self-contained.
export async function prepareFiling(options, key) {
  if (location.href !== options.sourceUrl) throw new Error('The filing tab navigated during export. Start a fresh export.');
  if (document.querySelector('[data-sec-pdf-export]')) throw new Error('Another export is preparing this filing. Wait for it to finish.');
  const style = document.createElement('style');
  style.dataset.secPdfExport = key;
  const saved = [];
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    style.remove();
    for (const undo of saved.reverse()) undo();
    clearTimeout(timer);
    delete window[key];
  };
  const timer = setTimeout(restore, 10 * 60 * 1000);
  window[key] = {restore};
  const remember = (element, attrs) => {
    const values = attrs.map(name => [name, element.getAttribute(name)]);
    saved.push(() => {for (const [name,value] of values) value === null ? element.removeAttribute(name) : element.setAttribute(name,value);});
  };
  const warnings = [];
  let compressed = 0;
  try {
    const timeout = (promise, ms, message) => {
      let t;
      return Promise.race([promise, new Promise((_,reject) => { t=setTimeout(() => reject(new Error(message)),ms); })]).finally(() => clearTimeout(t));
    };
    if (document.readyState !== 'complete') await timeout(new Promise(resolve => window.addEventListener('load',resolve,{once:true})),45000,'The filing is still loading. Wait for it to finish, then retry.');
    await timeout(document.fonts.ready,30000,'Fonts are still loading. Wait a moment and retry.');
    const images = [...document.images];
    const imageResults = await Promise.all(images.map(async img => {
      remember(img,['loading']);
      img.loading = 'eager';
      if (!img.complete) await timeout(new Promise(resolve => {img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});}),30000,'An image did not finish loading. Retry when the filing is fully loaded.');
      return img.naturalWidth > 0;
    }));
    if (imageResults.some(ok => !ok)) warnings.push('Some source images failed to load and may be missing. Check the filing and PDF.');
    // SEC uses content-visibility:auto for hundreds of positioned source pages.
    // Offscreen descendants must be rendered before measuring or printing them.
    style.textContent = '@media print { * { content-visibility: visible !important; contain: none !important; } }';
    document.head.append(style);
    document.documentElement.getBoundingClientRect();
    // Identify repeated paper-sized panels BEFORE replacing their screen layout.
    // Width alone is not a filing's printable width: screen gutters must not scale text.
    const printableWidth = Math.floor((options.width - 2 * options.margin) * 96);
    const printableHeight = (options.height - 2 * options.margin) * 96;
    const groups = new Map();
    const elements = [...document.querySelectorAll('div,section,article,main')];
    for (const el of elements) {
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      if (r.width < 450 || r.width > 1600 || r.height < 500 || r.height > 2500 || r.height / r.width < .45 || r.height / r.width > 2.2) continue;
      const specifiedHeight = el.computedStyleMap?.().get('height')?.toString();
      const fixedHeight = specifiedHeight && specifiedHeight !== 'auto';
      const namedPage = /(?:^|[\s_-])(?:page|pf|pg)(?:[\s_\d-]|$)/i.test(el.className + ' ' + el.id);
      if (!fixedHeight && !(parseFloat(cs.minHeight) >= 500) && !namedPage) continue;
      const parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, new Map());
      const widthGroup = Math.round(r.width / 16);
      const siblings = groups.get(parent);
      if (!siblings.has(widthGroup)) siblings.set(widthGroup, []);
      siblings.get(widthGroup).push({el,width:r.width - parseFloat(cs.borderLeftWidth) - parseFloat(cs.borderRightWidth),height:r.height - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth)});
    }
    let pages = [...groups.values()].flatMap(groups => [...groups.values()].filter(group => group.length >= 2)).flat();
    const candidates = new Set(pages.map(page => page.el));
    pages = pages.filter(page => {for (let p=page.el.parentElement;p;p=p.parentElement) if(candidates.has(p)) return false; return true;});
    // Image-only panels also have positioned wrappers: inspect their descendants.
    for (const page of pages) page.positioned = [...page.el.querySelectorAll('*')].some(child => ['absolute','fixed'].includes(getComputedStyle(child).position) && (child.textContent.trim() || child.matches('img,svg,canvas') || child.querySelector('img,svg,canvas,object,embed')));
    const nativePages = options.pagination === 'original' && pages.length > 1 && pages.every(page => page.positioned);
    const nativeRules = new Map();
    // EDGAR's transport metadata is text inside custom tags that wrap the filing.
    // Remove only their direct metadata text, never their filing descendants.
    for (const el of document.querySelectorAll('type,sequence,filename,description')) {
      for (const node of el.childNodes) if (node.nodeType === Node.TEXT_NODE && node.data.trim()) {
        const original = node.data; saved.push(() => {node.data=original;}); node.data='';
      }
    }
    const wrappers = new Set();
    let fixedPages = 0, emptyPages = 0;
    for (const page of pages) {
      const el = page.el;
      remember(el,['data-sec-pdf-page','style']);
      el.setAttribute('data-sec-pdf-page',key);
      for (let p=el.parentElement;p && p!==document.body;p=p.parentElement) wrappers.add(p);
      const hasContent = el.textContent.trim() || el.querySelector('img,svg,canvas,object,embed,table') || [...el.querySelectorAll('*')].some(child => getComputedStyle(child).backgroundImage !== 'none');
      if (!hasContent) {el.style.setProperty('display','none','important');emptyPages++;continue;}
      if (page.positioned) {
        // Original SEC panels already encode complete physical page geometry.
        const zoom = nativePages ? 1 : Math.min(1,(printableWidth-1)/page.width,(printableHeight-1)/page.height);
        el.style.setProperty('width',page.width+'px','important');
        el.style.setProperty('height',page.height+'px','important');
        el.style.setProperty('zoom',String(zoom),'important');
        if (nativePages) {
          const name = key+'p'+Math.round(page.width)+'h'+Math.round(page.height);
          nativeRules.set(name,`@page ${name} { size: ${page.width}px ${page.height}px; margin: 0; }`);
          el.style.setProperty('page',name,'important');
        }
        el.setAttribute('data-sec-pdf-page',key+'-fixed');fixedPages++;
      }
    }
    // Also normalize a wide outer wrapper in filings without repeated page panels.
    if (!pages.length) {
      const totalText = document.body.innerText.trim().length;
      for (const el of elements) {
        if (el.innerText.trim().length < totalText * .8 || el.closest('table')) continue;
        const r = el.getBoundingClientRect();
        if (r.width > printableWidth && el.children.length) wrappers.add(el);
      }
    }
    for (const el of wrappers) {remember(el,['data-sec-pdf-wrap']);el.setAttribute('data-sec-pdf-wrap',key);}
    const pageSelector = `[data-sec-pdf-page="${key}"]`;
    const fixedSelector = `[data-sec-pdf-page="${key}-fixed"]`;
    style.textContent = `@media print {
      * { content-visibility: visible !important; contain: none !important; }
      @page { size: ${options.width}in ${options.height}in; margin: ${options.margin}in; }
      ${[...nativeRules.values()].join('\n')}
      html, body { width: auto !important; min-width: 0 !important; max-width: none !important; height: auto !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: visible !important; background: white !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      [data-sec-pdf-wrap="${key}"] { display: block !important; width: auto !important; min-width: 0 !important; max-width: none !important; height: auto !important; min-height: 0 !important; max-height: none !important; margin: 0 !important; padding: 0 !important; border: 0 !important; box-shadow: none !important; background: white !important; overflow: visible !important; position: static !important; transform: none !important; }
      ${pageSelector}, ${fixedSelector} { margin: 0 !important; border: 0 !important; box-shadow: none !important; background-color: white !important; overflow: visible !important; transform: none !important; }
      ${pageSelector} { box-sizing: border-box !important; width: 100% !important; min-width: 0 !important; max-width: none !important; height: auto !important; min-height: 0 !important; max-height: none !important; padding: 0 !important; break-inside: auto !important; }
      ${fixedSelector} { overflow: hidden !important; box-sizing: border-box !important; break-before: page !important; break-inside: avoid !important; }
      img, svg { max-width: 100% !important; }
      /* SEC nests images in zero-width absolute wrappers. Percentage max-width
         would collapse those images to zero, even when their source is loaded. */
      ${fixedSelector} img, ${fixedSelector} svg { max-width: none !important; }
      img { object-fit: contain; }
      tr { break-inside: avoid; page-break-inside: avoid; }
      h1,h2,h3,h4 { break-after: avoid; }
      p { orphans: 2; widows: 2; }
      ${options.pagination === 'continuous' ? `*:not(${fixedSelector}) { page-break-before: auto !important; page-break-after: auto !important; break-before: auto !important; break-after: auto !important; }` : `${pageSelector} ~ ${pageSelector} { break-before: page !important; }`}
    }`;
    if (fixedPages && options.pagination === 'continuous') warnings.push('Fixed-position source pages retain their original pagination to prevent overlapping text.');
    document.head.append(style);
    // Read the actual print layout, including fixed-width financial tables.
    // Force layout synchronously: background tabs may suspend animation frames.
    document.documentElement.getBoundingClientRect();
    if (options.compact) {
      for (const img of images) {
        const rect = img.getBoundingClientRect();
        if (!rect.width || !rect.height || img.naturalWidth * img.naturalHeight < 1000000) continue;
        const targetWidth = Math.max(600, Math.ceil(rect.width * 150 / 96));
        if (targetWidth >= img.naturalWidth * .9) continue;
        const savedCount = saved.length;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = targetWidth;
          canvas.height = Math.max(1,Math.round(img.naturalHeight * targetWidth / img.naturalWidth));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = 'white'; ctx.fillRect(0,0,canvas.width,canvas.height);
          ctx.drawImage(img,0,0,canvas.width,canvas.height);
          const jpeg = canvas.toDataURL('image/jpeg',.82), png = canvas.toDataURL('image/png');
          const data = jpeg.length < png.length * .85 ? jpeg : png;
          const originalBytes = performance.getEntriesByName(img.currentSrc).find(e => e.decodedBodySize > 0)?.decodedBodySize;
          if (originalBytes && data.length * .75 >= originalBytes) continue;
          const computed = getComputedStyle(img);
          const cssWidth = computed.width, cssHeight = computed.height;
          remember(img,['src','srcset','sizes','style']);
          // CSS sizes exclude the page's zoom, unlike getBoundingClientRect().
          img.style.width = cssWidth; img.style.height = cssHeight;
          img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = data;
          await img.decode();
          compressed++;
        } catch {
          while (saved.length > savedCount) saved.pop()();
          warnings.push('An image could not be compacted; its original quality is retained.');
        }
      }
    }
    let width = Math.max(document.documentElement.scrollWidth,document.body.scrollWidth);
    // scrollWidth misses some positioned elements and transformed tables.
    const origin = document.body.getBoundingClientRect().left;
    for (const el of document.querySelectorAll('table, img, svg, pre')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) width = Math.max(width,r.right - Math.min(0,origin));
    }
    return {width:Math.ceil(width),nativePages,compressed,pages:pages.length,fixedPages,emptyPages,warnings:[...new Set(warnings)]};
  } catch (error) { restore(); throw error; }
}
