(() => {
  // Durable archive tombstones for Scope Site.
  //
  // Older archive behavior removed a project locally and attempted to delete the
  // cloud rows. A stale tab/device or a failed/late cloud sync could then upload an
  // old active copy and make the project reappear. This patch keeps an archived
  // project row as a cloud tombstone. The tombstone always wins over ordinary stale
  // active copies. Only an explicit .koehn import can clear the tombstone.

  const PATCH_VERSION = '2026-09-11-1';
  let installed = false;
  let rawGetProjectsForUser = null;

  const timeValue = value => {
    const parsed = Date.parse(value || '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const editTime = project => timeValue(project?.updatedAt || project?.createdAt);
  const archiveTime = project => timeValue(project?.archivedAt || (project?.archived ? project?.updatedAt : ''));
  const restoreTime = project => timeValue(project?.archiveRestoredAt);
  const familyKey = project => String(project?.familyId || project?.id || '');

  const completenessScore = project => {
    if (!project) return 0;
    let score = 0;
    const nonEmpty = value => Boolean(String(value || '').trim());
    if (nonEmpty(project.projectName)) score += 1;
    if (nonEmpty(project.clientName)) score += 1;
    if (nonEmpty(project.projectAddress)) score += 1;
    if (nonEmpty(project.introNote)) score += 2;
    if (nonEmpty(project.clarifications)) score += 2;
    if (nonEmpty(project.exclusions)) score += 2;
    Object.values(project.divisions || {}).forEach(division => {
      const text = String(division?.text || '').trim();
      const rich = String(division?.richText || '').replace(/<[^>]*>/g, '').trim();
      if (division?.enabled && (text || rich)) score += 10;
      else if (text || rich) score += 3;
    });
    (project.alternateScopes || []).forEach(alternate => {
      const text = String(alternate?.text || '').trim();
      const rich = String(alternate?.richText || '').replace(/<[^>]*>/g, '').trim();
      if (text || rich) score += 8;
    });
    (project.priceItems || []).forEach(item => {
      if (nonEmpty(item?.name) || nonEmpty(item?.price) || nonEmpty(item?.description)) score += 5;
    });
    if ((project.kickoff?.divisions || []).length) score += 2;
    if ((project.kickoff?.quotes || []).length) score += 2;
    return score;
  };

  function normalizeArchiveFields(project) {
    if (!project) return project;
    project.archived = Boolean(project.archived);
    project.archivedAt = project.archivedAt || null;
    project.archivedBy = project.archivedBy || null;
    project.archiveTombstone = Boolean(project.archiveTombstone || project.archived);
    project.archiveRestoredAt = project.archiveRestoredAt || null;
    return project;
  }

  function cloudWinsAgainstLocal(local, cloud, rowUpdatedAt = '') {
    normalizeArchiveFields(local);
    normalizeArchiveFields(cloud);

    if (local.archived !== cloud.archived) {
      if (cloud.archived) {
        // A normal edit on an old device must never revive an archived project.
        // Only an explicit import carries archiveRestoredAt and may beat it.
        return !(restoreTime(local) > archiveTime(cloud));
      }
      // Local archive beats a normal cloud copy unless the cloud copy was
      // explicitly restored after that archive event.
      return restoreTime(cloud) > archiveTime(local);
    }

    if (local.archived && cloud.archived) {
      return archiveTime(cloud) > archiveTime(local);
    }

    const localTime = editTime(local);
    const cloudTime = editTime(cloud) || timeValue(rowUpdatedAt);
    if (cloudTime !== localTime) return cloudTime > localTime;
    return completenessScore(cloud) > completenessScore(local);
  }

  function installProjectVisibilityFilter() {
    if (typeof getProjectsForUser !== 'function') return false;
    if (getProjectsForUser.__archiveTombstoneVisibility) return true;
    rawGetProjectsForUser = getProjectsForUser;
    const wrapped = function(username, options = {}) {
      const projects = rawGetProjectsForUser.apply(this, arguments);
      // Internal callers that ask for deleted rows still need tombstones for sync,
      // archive import, and collision handling. Normal project-home calls do not.
      if (options?.includeArchived === true || options?.includeDeleted === true) return projects;
      return projects.filter(project => !project.archived);
    };
    wrapped.__archiveTombstoneVisibility = true;
    getProjectsForUser = wrapped;
    window.getProjectsForUser = wrapped;
    return true;
  }

  function rawProjects(username) {
    const getter = rawGetProjectsForUser || getProjectsForUser;
    return getter(username, { includeDeleted: true });
  }

  function installDashboardArchiveFilter() {
    if (typeof renderProjects !== 'function') return false;
    if (renderProjects.__archiveTombstoneVisibility) return true;
    const source = renderProjects.toString();
    const needle = 'entries=entries.filter(({p})=>[p.projectName,p.clientName,p.projectNumber].join(" ").toLowerCase().includes(q));';
    if (!source.includes(needle)) return false;
    const patchedSource = source.replace(
      needle,
      'entries=entries.filter(({p})=>!p.archived);\n  ' + needle
    );
    try {
      const patched = eval(`(${patchedSource})`);
      patched.__archiveTombstoneVisibility = true;
      renderProjects = patched;
      window.renderProjects = patched;
      // Some core controls captured the original function directly. Run the final
      // filtered renderer after those handlers so archived rows cannot reappear.
      ['projectSearch','projectSort','adminUserFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.dataset.archiveFilterBound === 'true') return;
        el.dataset.archiveFilterBound = 'true';
        const eventName = id === 'projectSearch' ? 'input' : 'change';
        el.addEventListener(eventName, () => queueMicrotask(() => renderProjects()));
      });
      return true;
    } catch (error) {
      console.error('Could not install archived-project dashboard filter.', error);
      return false;
    }
  }

  function installMergeProtection() {
    mergeCloudAndLocalProjects = function(localProjects, cloudRows, ownerUsername) {
      const map = new Map();
      (localProjects || []).forEach(raw => {
        const project = normalizeArchiveFields(normalizeProject(raw, ownerUsername));
        map.set(project.id, project);
      });

      (cloudRows || []).forEach(row => {
        if (!row?.project_data) return;
        const cloud = normalizeArchiveFields(normalizeProject({ ...row.project_data, ownerUsername }, ownerUsername));
        const local = map.get(cloud.id);
        if (!local || cloudWinsAgainstLocal(local, cloud, row.updated_at)) map.set(cloud.id, cloud);
      });

      return [...map.values()].sort((a, b) => editTime(b) - editTime(a));
    };
    mergeCloudAndLocalProjects.__archiveTombstoneProtection = true;
    window.mergeCloudAndLocalProjects = mergeCloudAndLocalProjects;
  }

  function installSyncProtection() {
    syncProjectsToCloudNow = async function(username, projects) {
      if (!authBackendConfigured || !authClient || !state.user || !username) return;
      const ownerId = await resolveCloudOwnerId(username);
      if (!ownerId) throw new Error(`Could not resolve the cloud owner for ${username}.`);

      const list = (projects || []).map(project => normalizeArchiveFields(normalizeProject(project, username)));
      if (!list.length) return;

      const { data: existingRows, error: readError } = await authClient
        .from('projects')
        .select('id,project_data,updated_at')
        .eq('owner_id', ownerId);
      if (readError) throw readError;

      const existingById = new Map((existingRows || []).map(row => [row.id, row]));
      const rowsToWrite = [];

      list.forEach(project => {
        const existing = existingById.get(project.id);
        if (!existing?.project_data) {
          rowsToWrite.push(cloudProjectRow(project, ownerId, username));
          return;
        }
        const cloud = normalizeArchiveFields(normalizeProject({ ...existing.project_data, ownerUsername: username }, username));

        if (project.archived !== cloud.archived) {
          if (project.archived) {
            if (!(restoreTime(cloud) > archiveTime(project))) rowsToWrite.push(cloudProjectRow(project, ownerId, username));
          } else if (restoreTime(project) > archiveTime(cloud)) {
            rowsToWrite.push(cloudProjectRow(project, ownerId, username));
          }
          return;
        }

        if (project.archived && cloud.archived) {
          if (archiveTime(project) > archiveTime(cloud)) rowsToWrite.push(cloudProjectRow(project, ownerId, username));
          return;
        }

        const localTime = editTime(project);
        const cloudTime = editTime(cloud);
        const localIsNewer = localTime > cloudTime;
        const sameTimeButMoreComplete = localTime === cloudTime && completenessScore(project) > completenessScore(cloud);
        if (localIsNewer || sameTimeButMoreComplete) rowsToWrite.push(cloudProjectRow(project, ownerId, username));
      });

      if (!rowsToWrite.length) return;
      const { error } = await authClient.from('projects').upsert(rowsToWrite, { onConflict: 'id' });
      if (error) throw error;
    };
    syncProjectsToCloudNow.__archiveTombstoneProtection = true;
    window.syncProjectsToCloudNow = syncProjectsToCloudNow;
  }

  async function cloudFamilyRowsSafe(ownerUsername, familyId) {
    if (!authBackendConfigured || !authClient || !state.user) return [];
    const ownerId = await resolveCloudOwnerId(ownerUsername);
    if (!ownerId) return [];
    const { data, error } = await authClient
      .from('projects')
      .select('id,family_id,owner_id,project_data,workflow_status,updated_at')
      .eq('owner_id', ownerId)
      .eq('family_id', familyId);
    if (error) throw error;
    return data || [];
  }

  async function verifyCloudArchived(ownerUsername, familyId, expectedIds) {
    if (!authBackendConfigured || !authClient || !state.user) return;
    const rows = await cloudFamilyRowsSafe(ownerUsername, familyId);
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const id of expectedIds) {
      const row = byId.get(id);
      if (!row?.project_data || row.project_data.archived !== true) {
        throw new Error('Cloud archive marker verification failed.');
      }
    }
  }

  async function verifyCloudRestored(ownerUsername, familyId, expectedProjects) {
    if (!authBackendConfigured || !authClient || !state.user) return;
    const rows = await cloudFamilyRowsSafe(ownerUsername, familyId);
    const byId = new Map(rows.map(row => [row.id, row]));
    for (const expected of expectedProjects) {
      const row = byId.get(expected.id);
      if (!row?.project_data) throw new Error(`Cloud restore verification failed for ${expected.projectName || 'project'}.`);
      const cloud = normalizeArchiveFields(normalizeProject({ ...row.project_data, ownerUsername }, ownerUsername));
      if (cloud.archived || restoreTime(cloud) < restoreTime(expected) || completenessScore(cloud) < completenessScore(expected)) {
        throw new Error(`Cloud restore verification found an incomplete copy of ${expected.projectName || 'project'}.`);
      }
    }
  }

  function installArchiveHandler() {
    archiveFamilyToKoehn = async function(familyId, ownerUsername) {
      if (ownerKey(ownerUsername) !== ownerKey(state.user.username) && !isAdmin()) {
        return toast('You can only archive your own projects.');
      }

      let all = rawProjects(ownerUsername);
      let family = all.filter(project => familyKey(project) === familyId && !project.archived);
      if (!family.length) return toast('Project not found or already archived.');

      try {
        const rows = await cloudFamilyRowsSafe(ownerUsername, familyId);
        if (rows.length) {
          const merged = mergeCloudAndLocalProjects(family, rows, ownerUsername);
          // Do not allow a stale cloud tombstone to replace the active project being
          // intentionally archived here; the UI only exposes non-archived families.
          family = merged.filter(project => !project.archived);
          const familyIds = new Set(family.map(project => project.id));
          all = [
            ...family,
            ...all.filter(project => !familyIds.has(project.id) && familyKey(project) !== familyId)
          ];
        }
      } catch (error) {
        console.warn('Could not refresh the project family from cloud before archiving.', error);
      }

      if (!family.length) return toast('Project is already archived.');
      const latest = [...family].sort((a, b) => (b.version || 0) - (a.version || 0))[0];
      const ok = confirm(`Archive ${latest.projectName || 'this project'}?\n\nA .koehn archive file will download. The project will stay hidden from Scope Site until that archive is imported again.`);
      if (!ok) return;

      const menuBtn = document.querySelector(`[data-archive-family="${CSS.escape(familyId)}"]`);
      if (menuBtn) menuBtn.disabled = true;

      try {
        const allAssets = await getFamilyQuoteAssets(familyId);
        const referencedKeys = new Set();
        (latest.kickoff?.quotes || []).forEach(quote => (quote.pages || []).forEach(key => referencedKeys.add(key)));
        (latest.kickoff?.divisions || []).forEach(division => kickoffImageKeysFromHtml(division.notesHtml || '').forEach(key => referencedKeys.add(key)));
        const assets = allAssets.filter(asset => referencedKeys.has(asset.key));
        const packedAssets = [];

        for (const asset of assets) {
          packedAssets.push({
            key: asset.key,
            familyId: asset.familyId,
            quoteId: asset.quoteId,
            divisionId: asset.divisionId,
            assetType: asset.assetType,
            pageIndex: asset.pageIndex,
            name: asset.name,
            mime: asset.mime,
            width: asset.width,
            height: asset.height,
            createdAt: asset.createdAt,
            data: await blobToBase64(asset.blob)
          });
        }

        const terms = [...new Set(family.map(project => project.disclaimerId).filter(Boolean))]
          .map(id => getDisclaimer(id))
          .filter(Boolean);
        const payload = {
          schema: 'koehn-project-archive',
          version: 3,
          createdAt: nowIso(),
          ownerUsername,
          projectName: latest.projectName || 'Project',
          familyId,
          projects: family,
          termsAndConditions: terms,
          assets: packedAssets,
          assetPolicy: {
            sourcePdfsRetained: false,
            quoteStorage: 'compressed-page-snapshots',
            divisionImages: 'compressed-inline-images'
          }
        };

        const archiveBlob = await gzipJsonBlob(payload);
        const fileName = `${safeFilePart(latest.projectNumber || latest.projectName || 'Project')}_${safeFilePart(latest.projectName || 'Archive')}.koehn`;
        downloadBlob(archiveBlob, fileName);

        // The archive file is complete before the workspace is changed.
        await deleteFamilyQuoteAssets(familyId);

        const archivedAt = nowIso();
        const archivedBy = state.user?.username || ownerUsername;
        const tombstones = family.map(project => normalizeArchiveFields(normalizeProject({
          ...project,
          archived: true,
          archivedAt,
          archivedBy,
          archiveTombstone: true,
          archiveRestoredAt: null,
          accepted: false,
          acceptedAt: null,
          updatedAt: archivedAt
        }, ownerUsername)));
        const otherProjects = all.filter(project => familyKey(project) !== familyId);
        const nextProjects = [...tombstones, ...otherProjects];
        saveProjectsForUser(ownerUsername, nextProjects);

        const syncKey = ownerKey(ownerUsername);
        clearTimeout(cloudProjectSyncTimers.get(syncKey));
        cloudProjectSyncTimers.delete(syncKey);

        if (authBackendConfigured && authClient) {
          try {
            await syncProjectsToCloudNow(ownerUsername, nextProjects);
            await verifyCloudArchived(ownerUsername, familyId, tombstones.map(project => project.id));
          } catch (cloudError) {
            console.error('Immediate archive tombstone sync failed; scheduling retry.', cloudError);
            if (typeof scheduleCloudProjectSync === 'function') scheduleCloudProjectSync(ownerUsername, nextProjects);
            toast('Archive downloaded and hidden locally. Cloud archive marker will retry automatically.');
          }
        }

        refreshDashboardNav();
        renderProjects();
        toast(`Archived to ${fileName}. It will remain hidden until reimported.`);
      } catch (error) {
        console.error('Project archive failed.', error);
        toast(error?.message || 'Could not create the project archive.');
      } finally {
        if (menuBtn) menuBtn.disabled = false;
      }
    };
    archiveFamilyToKoehn.__archiveTombstoneProtection = true;
    window.archiveFamilyToKoehn = archiveFamilyToKoehn;
  }

  function installImportHandler() {
    importKoehnProjectArchive = async function(file) {
      if (!file) return;
      try {
        const payload = await readKoehnArchiveFile(file);
        const originalOwner = String(payload.ownerUsername || '');
        let targetOwner = state.user.username;
        if (isAdmin() && originalOwner && getUserRecord(originalOwner)) targetOwner = originalOwner;

        const restoredAt = nowIso();
        const incoming = payload.projects.map(raw => normalizeArchiveFields(normalizeProject({
          ...raw,
          ownerUsername: targetOwner,
          archived: false,
          archivedAt: null,
          archivedBy: null,
          archiveTombstone: false,
          archiveRestoredAt: restoredAt,
          updatedAt: restoredAt
        }, targetOwner)));

        const familyId = familyKey(incoming[0]);
        if (!familyId) throw new Error('Archive has no project family ID.');

        let existing = rawProjects(targetOwner);
        const existingFamily = existing.filter(project => familyKey(project) === familyId);
        const hasLiveCollision = existingFamily.some(project => !project.archived);
        if (hasLiveCollision && !confirm('This project already exists in the workspace. Replace the existing copy with the archived copy?')) return;
        if (existingFamily.length) {
          existing = existing.filter(project => familyKey(project) !== familyId);
          await deleteFamilyQuoteAssets(familyId);
        }

        (payload.termsAndConditions || []).forEach(term => {
          if (term?.id && !getDisclaimers().some(disclaimer => disclaimer.id === term.id)) {
            const allTerms = getDisclaimers();
            allTerms.push(term);
            saveDisclaimers(allTerms);
          }
        });

        const nextProjects = [...incoming, ...existing];
        saveProjectsForUser(targetOwner, nextProjects);
        const syncKey = ownerKey(targetOwner);
        clearTimeout(cloudProjectSyncTimers.get(syncKey));
        cloudProjectSyncTimers.delete(syncKey);

        if (authBackendConfigured && authClient) {
          await syncProjectsToCloudNow(targetOwner, nextProjects);
          await verifyCloudRestored(targetOwner, familyId, incoming);
        }

        for (const asset of payload.assets || []) {
          if (!asset?.key || !asset?.data) continue;
          await putQuoteAsset({
            key: asset.key,
            familyId: asset.familyId || familyId,
            quoteId: asset.quoteId,
            divisionId: asset.divisionId,
            assetType: asset.assetType,
            pageIndex: asset.pageIndex,
            name: asset.name,
            mime: asset.mime || 'image/webp',
            blob: base64ToBlob(asset.data, asset.mime || 'image/webp'),
            width: asset.width,
            height: asset.height,
            createdAt: asset.createdAt || nowIso()
          });
        }

        state.dashboardMode = 'active';
        refreshDashboardNav();
        renderProjects();
        toast(`Imported ${payload.projectName || 'project'} with full scope and pricing restored.`);
      } catch (error) {
        console.error('Project archive import failed.', error);
        toast(error?.message || 'Could not import that .koehn archive.');
      }
    };
    importKoehnProjectArchive.__archiveTombstoneProtection = true;
    window.importKoehnProjectArchive = importKoehnProjectArchive;
  }

  async function persistExistingArchivedMarkers() {
    if (!state.user) return;
    const owners = isAdmin() ? getAllUsers().map(user => user.username) : [state.user.username];
    for (const owner of owners) {
      const projects = rawProjects(owner);
      const archived = projects.filter(project => project.archived);
      if (!archived.length) continue;
      const stamp = nowIso();
      let changed = false;
      projects.forEach(project => {
        if (!project.archived) return;
        normalizeArchiveFields(project);
        if (!project.archivedAt) { project.archivedAt = project.updatedAt || stamp; changed = true; }
        if (!project.archiveTombstone) { project.archiveTombstone = true; changed = true; }
      });
      if (changed) saveProjectsForUser(owner, projects);
      if (authBackendConfigured && authClient) {
        try { await syncProjectsToCloudNow(owner, projects); }
        catch (error) { console.warn(`Could not persist existing archived markers for ${owner}.`, error); }
      }
    }
  }

  function readyForInstall() {
    if (typeof normalizeProject !== 'function' || typeof ownerKey !== 'function') return false;
    if (typeof archiveFamilyToKoehn !== 'function' || typeof importKoehnProjectArchive !== 'function') return false;
    if (typeof syncProjectsToCloudNow !== 'function' || typeof mergeCloudAndLocalProjects !== 'function') return false;
    // Wait for the prior archive-sync stability patch so this becomes the final layer.
    return archiveFamilyToKoehn.toString().includes('remainingCloudRows') || archiveFamilyToKoehn.__archiveTombstoneProtection;
  }

  function install() {
    if (installed || !readyForInstall()) return false;
    installProjectVisibilityFilter();
    installDashboardArchiveFilter();
    installMergeProtection();
    installSyncProtection();
    installArchiveHandler();
    installImportHandler();
    installed = true;
    window.__scopeArchiveTombstoneVersion = PATCH_VERSION;
    persistExistingArchivedMarkers().catch(error => console.warn('Existing archive marker migration failed.', error));
    try { refreshDashboardNav(); renderProjects(); } catch {}
    console.info(`Scope Builder durable archive tombstones loaded (${PATCH_VERSION}).`);
    return true;
  }

  install();
  let attempts = 0;
  const timer = setInterval(() => {
    if (install() || installed || ++attempts > 100) clearInterval(timer);
  }, 100);
})();
