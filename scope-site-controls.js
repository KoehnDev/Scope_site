(() => {
  // Scope Site usability controls — 2026-09-09
  // 1) Project & Client Information > Project Name is the canonical PDF project name.
  // 2) Alternate section heading edits inline like a division heading.
  // 3) Accepted/Kickoff status can be reversed without deleting kickoff work.
  // 4) Proposal + Kickoff previews are manual so PDF generation never runs while typing.

  const style = document.createElement('style');
  style.textContent = `
    .alternate-section-title-inline-control{
      display:block!important;margin:0 0 4px!important;max-width:520px!important;width:100%!important;
      color:inherit!important;font-size:inherit!important;font-weight:inherit!important;
    }
    .alternate-section-title-inline-control>span{display:none!important}
    .alternate-section-title-inline-input{
      width:min(420px,100%)!important;min-width:180px!important;box-sizing:border-box!important;
      padding:7px 10px!important;border:1px solid #d7dadd!important;border-radius:8px!important;
      background:#fff!important;color:#24292d!important;font:700 15px/1.2 Inter,sans-serif!important;
    }
    .proposal-preview-manual-actions{display:flex;align-items:center;gap:8px;margin-left:auto}
    .proposal-preview-refresh,.kickoff-manual-preview-refresh{white-space:nowrap}
    .kickoff-remove-status-btn{margin-left:2px}
    .kickoff-manual-preview-note{max-width:165px!important}
    @media (max-width:700px){
      .alternate-section-title-inline-input{width:100%!important;min-width:0!important}
      .proposal-preview-refresh,.kickoff-manual-preview-refresh{padding:7px 9px!important;font-size:10px!important}
    }
  `;
  document.head.appendChild(style);

  // ---------------------------------------------------------------------------
  // Project Name: make the Project & Client Information field canonical.
  // ---------------------------------------------------------------------------
  let syncingProjectName = false;
  function projectInfoNameInput(){ return document.querySelector('[data-field="projectName"]'); }
  function projectHeaderNameInput(){ return document.getElementById('projectTitleInline'); }

  function syncProjectNameFromInfo(){
    if(syncingProjectName)return;
    const info=projectInfoNameInput(),header=projectHeaderNameInput();
    if(!info||!header)return;
    syncingProjectName=true;
    header.value=info.value;
    syncingProjectName=false;
  }
  function syncProjectNameFromHeader(){
    if(syncingProjectName)return;
    const info=projectInfoNameInput(),header=projectHeaderNameInput();
    if(!info||!header)return;
    syncingProjectName=true;
    info.value=header.value;
    syncingProjectName=false;
  }
  function bindProjectNameSync(){
    const info=projectInfoNameInput(),header=projectHeaderNameInput();
    if(info&&!info.dataset.projectNameCanonicalBound){
      info.dataset.projectNameCanonicalBound='true';
      info.addEventListener('input',syncProjectNameFromInfo);
    }
    if(header&&!header.dataset.projectNameMirrorBound){
      header.dataset.projectNameMirrorBound='true';
      header.addEventListener('input',syncProjectNameFromHeader);
    }
  }
  function wrapProjectCollector(){
    if(typeof collectEditorProject!=='function'||collectEditorProject.__projectInfoNameCanonical)return;
    const original=collectEditorProject;
    const wrapped=function(){
      const project=original.apply(this,arguments);
      if(!project)return project;
      const info=projectInfoNameInput();
      const canonical=String(info?.value??project.projectName??'').trim()||'Untitled Project';
      project.projectName=canonical;
      const header=projectHeaderNameInput();
      if(header&&header.value!==canonical)header.value=canonical;
      const sidebar=document.getElementById('sidebarProjectName');
      if(sidebar)sidebar.textContent=canonical;
      return project;
    };
    wrapped.__projectInfoNameCanonical=true;
    collectEditorProject=wrapped;
    window.collectEditorProject=wrapped;
  }

  // ---------------------------------------------------------------------------
  // Alternate section heading: reuse existing saved field, but place it inline.
  // ---------------------------------------------------------------------------
  function inlineAlternateSectionHeading(){
    const section=document.querySelector('.alternate-scope-section');
    const head=section?.querySelector('.alternate-scope-section-head');
    const headingWrap=head?.querySelector('.section-number')?.nextElementSibling;
    const control=document.getElementById('alternateSectionTitleControl');
    const input=document.getElementById('alternateSectionTitleInput');
    if(!headingWrap||!control||!input)return false;

    headingWrap.querySelector('h3')?.remove();
    control.querySelector(':scope > span')?.remove();
    control.classList.add('alternate-section-title-inline-control');
    input.classList.add('alternate-section-title-inline-input');
    if(headingWrap.firstElementChild!==control)headingWrap.insertBefore(control,headingWrap.firstElementChild);
    return true;
  }
  function wrapAlternateRenderer(){
    if(typeof renderAlternateScopes!=='function'||renderAlternateScopes.__inlineAlternateSectionHeading)return;
    const original=renderAlternateScopes;
    const wrapped=function(){
      const result=original.apply(this,arguments);
      requestAnimationFrame(inlineAlternateSectionHeading);
      return result;
    };
    wrapped.__inlineAlternateSectionHeading=true;
    renderAlternateScopes=wrapped;
    window.renderAlternateScopes=wrapped;
  }

  // ---------------------------------------------------------------------------
  // Reversible Kickoff / Accepted state.
  // ---------------------------------------------------------------------------
  function removeKickoffStatus(){
    if(typeof getCurrentKickoffProject!=='function')return;
    const project=getCurrentKickoffProject();
    if(!project)return;
    const owner=state.currentKickoffOwner||state.user?.username||'';
    if(typeof ownerKey==='function'&&ownerKey(owner)!==ownerKey(state.user?.username)&&!(typeof isAdmin==='function'&&isAdmin())){
      if(typeof toast==='function')toast('You can only change kickoff status on your own projects.');
      return;
    }
    const ok=confirm(`Remove Kickoff status from “${project.projectName||'this project'}”?\n\nThe project will return to the regular Proposal library. Any kickoff information already entered will be retained in case you turn Kickoff back on later.`);
    if(!ok)return;

    try{
      if(typeof saveKickoffInfoFromForm==='function')saveKickoffInfoFromForm();
      if(document.querySelector('.kickoff-division-card')&&typeof collectKickoffDivisionsFromDom==='function')collectKickoffDivisionsFromDom();
    }catch(err){console.warn('Kickoff form save before status removal failed.',err);}

    const familyId=project.familyId||project.id;
    const all=getProjectsForUser(owner,{includeDeleted:true});
    const updated=all.map(raw=>{
      if((raw.familyId||raw.id)!==familyId)return raw;
      return {...raw,accepted:false,acceptedAt:null,updatedAt:typeof nowIso==='function'?nowIso():new Date().toISOString()};
    });
    saveProjectsForUser(owner,updated);
    state.currentKickoffProjectId=null;
    state.currentKickoffOwner=null;
    if(typeof enterDashboard==='function')enterDashboard();
    if(typeof toast==='function')toast('Kickoff removed. Project returned to the Proposal library.');
  }
  function ensureRemoveKickoffButton(){
    const left=document.querySelector('.kickoff-topbar-left');
    if(!left||document.getElementById('removeKickoffStatusBtn'))return;
    const button=document.createElement('button');
    button.id='removeKickoffStatusBtn';
    button.className='btn btn-secondary kickoff-remove-status-btn';
    button.type='button';
    button.textContent='Remove Kickoff';
    button.title='Return this accepted project to the regular Proposal library';
    button.addEventListener('click',removeKickoffStatus);
    left.appendChild(button);
  }

  // ---------------------------------------------------------------------------
  // Proposal PDF preview: manual refresh only.
  // ---------------------------------------------------------------------------
  function installManualProposalPreview(){
    if(typeof state==='undefined'||typeof renderLivePdfPreview!=='function'||updatePreview?.__manualProposalPreview)return false;
    const coreRender=renderLivePdfPreview;

    function setProposalPreviewDirtyMessage(){
      const status=document.getElementById('pdfPreviewStatus');
      if(status&&state.currentProjectId){
        status.textContent='Preview out of date · click Refresh Preview';
        status.classList.remove('hidden');
      }
    }
    function markProposalPreviewDirty(){
      clearTimeout(state.previewRenderTimer);
      state.previewLastEditAt=Date.now();
      state.previewDirty=true;
      state.previewPending=false;
      if(state.previewRendering)state.previewRenderToken+=1;
      setProposalPreviewDirtyMessage();
    }
    markProposalPreviewDirty.__manualProposalPreview=true;

    const manualSchedule=function(){ markProposalPreviewDirty(); };
    manualSchedule.__manualProposalPreview=true;

    async function refreshProposalPreview(){
      if(!state.currentProjectId)return;
      if(!state.previewOpen&&typeof togglePreview==='function')togglePreview(true);
      clearTimeout(state.previewRenderTimer);
      state.previewDirty=false;
      state.previewPending=false;
      if(state.previewRendering){
        state.previewRenderToken+=1;
        const wait=()=>state.previewRendering?setTimeout(wait,40):refreshProposalPreview();
        setTimeout(wait,40);
        return;
      }
      state.previewLastEditAt=0;
      const status=document.getElementById('pdfPreviewStatus');
      if(status){status.textContent='Refreshing PDF preview…';status.classList.remove('hidden');}
      const btn=document.getElementById('refreshProposalPreviewBtn');
      if(btn){btn.disabled=true;btn.textContent='Refreshing…';}
      try{await coreRender();}
      finally{if(btn){btn.disabled=false;btn.textContent='Refresh Preview';}}
    }

    updatePreview=markProposalPreviewDirty;
    schedulePdfPreview=manualSchedule;
    window.updatePreview=markProposalPreviewDirty;
    window.schedulePdfPreview=manualSchedule;
    window.refreshProposalPreview=refreshProposalPreview;

    const toolbar=document.querySelector('#previewPane .preview-toolbar');
    const close=document.getElementById('closePreviewBtn');
    if(toolbar&&!document.getElementById('refreshProposalPreviewBtn')){
      let actions=toolbar.querySelector('.proposal-preview-manual-actions');
      if(!actions){
        actions=document.createElement('div');
        actions.className='proposal-preview-manual-actions';
        if(close)toolbar.insertBefore(actions,close);else toolbar.appendChild(actions);
      }
      const button=document.createElement('button');
      button.id='refreshProposalPreviewBtn';
      button.type='button';
      button.className='btn btn-secondary btn-small proposal-preview-refresh';
      button.textContent='Refresh Preview';
      button.addEventListener('click',refreshProposalPreview);
      actions.appendChild(button);
    }
    setProposalPreviewDirtyMessage();
    return true;
  }

  // ---------------------------------------------------------------------------
  // Kickoff PDF preview: disable the prior live scheduler and provide manual refresh.
  // ---------------------------------------------------------------------------
  function installManualKickoffPreview(){
    if(typeof state==='undefined'||typeof buildKickoffPdf!=='function'||typeof mountLazyPdfPreview!=='function')return false;
    if(window.refreshKickoffPreviewManual?.__koehnManual)return true;
    // Wait until the previous kickoff preview patch has installed its controls so
    // we can safely replace its click handlers and disable its anonymous live listener.
    if(!document.getElementById('kickoffPreviewToggle')||typeof window.toggleKickoffPreview!=='function')return false;

    clearTimeout(state.kickoffPreviewTimer);
    state.kickoffPreviewToken=(state.kickoffPreviewToken||0)+1;
    state.kickoffPreviewPending=false;
    // The old anonymous input listener checks this flag before scheduling. Keep it
    // false permanently; the manual preview uses its own open flag below.
    state.kickoffPreviewOpen=false;
    state.manualKickoffPreviewOpen=true;
    state.kickoffPreviewDirty=true;

    function pane(){return document.getElementById('kickoffLivePreviewPane');}
    function grid(){return document.querySelector('.kickoff-workspace-grid');}
    function status(){return document.getElementById('kickoffLivePreviewStatus');}
    function pages(){return document.getElementById('kickoffLivePreviewPages');}
    function scroll(){return document.getElementById('kickoffLivePreviewScroll');}

    function markKickoffDirty(){
      clearTimeout(state.kickoffPreviewTimer);
      state.kickoffPreviewDirty=true;
      state.kickoffPreviewPending=false;
      if(state.kickoffPreviewRendering)state.kickoffPreviewToken+=1;
      const s=status();
      if(s&&state.currentKickoffProjectId){s.textContent='Preview out of date · click Refresh Preview';s.classList.remove('hidden');}
    }
    markKickoffDirty.__koehnManual=true;

    function syncManualKickoffUi(){
      const open=state.manualKickoffPreviewOpen!==false;
      pane()?.classList.toggle('hidden',!open);
      grid()?.classList.toggle('kickoff-preview-off',!open);
      const toggle=document.getElementById('kickoffPreviewToggle');
      if(toggle)toggle.textContent=open?'Hide Preview':'PDF Preview';
      if(open&&state.kickoffPreviewDirty)markKickoffDirty();
    }

    function toggleManualKickoff(open){
      state.manualKickoffPreviewOpen=open??!state.manualKickoffPreviewOpen;
      if(!state.manualKickoffPreviewOpen&&state.kickoffPreviewRendering)state.kickoffPreviewToken+=1;
      syncManualKickoffUi();
    }

    async function renderManualKickoff(){
      if(state.manualKickoffPreviewOpen===false||!state.currentKickoffProjectId)return;
      if(state.kickoffPreviewRendering)return;
      const liveWrap=pages(),liveScroll=scroll(),liveStatus=status();
      const tabWrap=document.getElementById('kickoffPdfPreviewPages');
      const tabStatus=document.getElementById('kickoffPdfPreviewStatus');
      if(!liveWrap&&!tabWrap)return;

      state.kickoffPreviewRendering=true;
      state.kickoffPreviewPending=false;
      const token=++state.kickoffPreviewToken;
      const isCurrent=()=>token===state.kickoffPreviewToken&&state.manualKickoffPreviewOpen!==false;
      if(liveStatus){liveStatus.textContent='Refreshing kickoff PDF…';liveStatus.classList.remove('hidden');}
      try{
        const doc=await buildKickoffPdf({preview:true});
        if(!doc||!isCurrent())return;
        if(!window.pdfjsLib)throw new Error('Preview renderer unavailable.');
        if(window.pdfjsLib.GlobalWorkerOptions)window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const pdf=await window.pdfjsLib.getDocument({data:doc.output('arraybuffer')}).promise;
        if(!isCurrent()){try{pdf.destroy?.();}catch{}return;}
        if(liveWrap&&liveScroll){await mountLazyPdfPreview(pdf,liveWrap,liveScroll,{token,isCurrent,maxWidth:400,dprCap:1});}
        if(state.currentKickoffTab==='preview'&&tabWrap){await mountLazyPdfPreview(pdf,tabWrap,tabWrap,{token,isCurrent,maxWidth:760,dprCap:1});}
        if(isCurrent()){
          state.kickoffPreviewDirty=false;
          liveStatus?.classList.add('hidden');
          tabStatus?.classList.add('hidden');
        }
      }catch(err){
        console.error(err);
        if(isCurrent()&&liveStatus){liveStatus.textContent='Kickoff preview unavailable. Export PDF is still available.';liveStatus.classList.remove('hidden');}
      }finally{state.kickoffPreviewRendering=false;}
    }

    async function refreshManualKickoff(){
      if(!state.currentKickoffProjectId)return;
      if(state.manualKickoffPreviewOpen===false){state.manualKickoffPreviewOpen=true;syncManualKickoffUi();}
      if(state.kickoffPreviewRendering){
        state.kickoffPreviewToken+=1;
        const wait=()=>state.kickoffPreviewRendering?setTimeout(wait,40):refreshManualKickoff();
        setTimeout(wait,40);return;
      }
      const button=document.getElementById('refreshKickoffManualPreviewBtn');
      if(button){button.disabled=true;button.textContent='Refreshing…';}
      try{await renderManualKickoff();}
      finally{if(button){button.disabled=false;button.textContent='Refresh Preview';}}
    }
    refreshManualKickoff.__koehnManual=true;

    // Replace old buttons to remove the previous live-preview click closures.
    const oldToggle=document.getElementById('kickoffPreviewToggle');
    if(oldToggle){
      const fresh=oldToggle.cloneNode(true);oldToggle.replaceWith(fresh);
      fresh.addEventListener('click',()=>toggleManualKickoff());
    }
    const oldClose=document.getElementById('closeKickoffPreviewBtn');
    if(oldClose){
      const fresh=oldClose.cloneNode(true);oldClose.replaceWith(fresh);
      fresh.addEventListener('click',()=>toggleManualKickoff(false));
    }

    const head=pane()?.querySelector('.kickoff-live-preview-head');
    let actions=head?.querySelector('.kickoff-live-preview-head-actions');
    if(head&&!actions){actions=document.createElement('div');actions.className='kickoff-live-preview-head-actions';head.appendChild(actions);}
    if(actions&&!document.getElementById('refreshKickoffManualPreviewBtn')){
      const note=actions.querySelector('span');
      if(note){note.textContent='Manual preview · refresh after edits';note.classList.add('kickoff-manual-preview-note');}
      const button=document.createElement('button');
      button.id='refreshKickoffManualPreviewBtn';
      button.className='btn btn-secondary btn-small kickoff-manual-preview-refresh';
      button.type='button';button.textContent='Refresh Preview';
      button.addEventListener('click',refreshManualKickoff);
      const close=document.getElementById('closeKickoffPreviewBtn');
      if(close&&close.parentElement===actions)actions.insertBefore(button,close);else actions.appendChild(button);
    }

    scheduleKickoffPdfPreview=markKickoffDirty;
    renderKickoffPdfPreview=refreshManualKickoff;
    window.scheduleKickoffPdfPreview=markKickoffDirty;
    window.renderKickoffPdfPreview=refreshManualKickoff;
    window.toggleKickoffPreview=toggleManualKickoff;
    window.refreshKickoffPreviewManual=refreshManualKickoff;

    document.addEventListener('input',event=>{
      if(event.target?.closest?.('#kickoffView'))markKickoffDirty();
    },true);
    syncManualKickoffUi();
    return true;
  }

  function init(){
    bindProjectNameSync();
    wrapProjectCollector();
    wrapAlternateRenderer();
    inlineAlternateSectionHeading();
    ensureRemoveKickoffButton();
    installManualProposalPreview();
    installManualKickoffPreview();
  }

  init();
  let attempts=0;
  const retry=setInterval(()=>{
    init();
    attempts+=1;
    if(attempts>60)clearInterval(retry);
  },100);
})();
