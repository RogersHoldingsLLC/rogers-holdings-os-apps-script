/**
 * Headquarters Sales Feed v1.
 *
 * Read-only boundary owned by Business Optimization Platform. Headquarters
 * receives only the deterministic, privacy-minimized contract below.
 */

var HEADQUARTERS_SALES_FEED_VERSION = '1.0';
var HEADQUARTERS_SALES_FEED_TOKEN_PROPERTY = 'HEADQUARTERS_SALES_FEED_TOKEN';
var HEADQUARTERS_SALES_FEED_FRESHNESS_MINUTES = 5;

function doPost(e) {
  const unauthorized = function() {
    return createHeadquartersSalesFeedJsonResponse_({ error: 'unauthorized' });
  };
  let requestedVersion = '';

  try {
    const body = parseHeadquartersSalesFeedRequest_(e);
    requestedVersion = body && String(body.version || '');
    const tokenProperty = getHeadquartersRequestTokenProperty_(requestedVersion);
    if (!body || !tokenProperty) {
      return unauthorized();
    }
    const configuredToken = PropertiesService.getScriptProperties()
      .getProperty(tokenProperty);

    if (!configuredToken || !body.token ||
        !constantTimeStringEquals_(body.token, configuredToken)) {
      return unauthorized();
    }

    const response = requestedVersion === HEADQUARTERS_SALES_FEED_VERSION
      ? buildHeadquartersSalesFeedV1_()
      : buildHeadquartersIdentityExportV1_();
    return createHeadquartersSalesFeedJsonResponse_(response);
  } catch (error) {
    // Deliberately do not log the request, token, or exception detail here.
    if (isHeadquartersIdentityExportVersion_(requestedVersion)) {
      return createHeadquartersSalesFeedJsonResponse_({
        version: HEADQUARTERS_IDENTITY_EXPORT_VERSION,
        complete: false,
        error: 'unavailable'
      });
    }
    return createHeadquartersSalesFeedJsonResponse_({
      version: HEADQUARTERS_SALES_FEED_VERSION,
      status: { healthy: false, partial: false },
      error: 'unavailable'
    });
  }
}

function getHeadquartersRequestTokenProperty_(version) {
  if (version === HEADQUARTERS_SALES_FEED_VERSION) {
    return HEADQUARTERS_SALES_FEED_TOKEN_PROPERTY;
  }
  if (isHeadquartersIdentityExportVersion_(version)) {
    return HEADQUARTERS_IDENTITY_EXPORT_TOKEN_PROPERTY;
  }
  return '';
}

function isHeadquartersIdentityExportVersion_(version) {
  return typeof HEADQUARTERS_IDENTITY_EXPORT_VERSION !== 'undefined' &&
    version === HEADQUARTERS_IDENTITY_EXPORT_VERSION;
}

function buildHeadquartersSalesFeedV1_() {
  return buildHeadquartersSalesFeedV1FromSource_(
    readHeadquartersSalesFeedSourceV1_(),
    new Date()
  );
}

function readHeadquartersSalesFeedSourceV1_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Sales feed source is unavailable.');
  }

  return {
    prospects: readHeadquartersProspectsV1_(ss),
    followUps: readHeadquartersFollowUpsV1_(ss),
    clients: readHeadquartersClientsV1_(ss),
    projects: readHeadquartersProjectsV1_(ss)
  };
}

function readHeadquartersProspectsV1_(ss) {
  const sheet = getRequiredSheet_(ss, MASTER_PROSPECT_SHEET);
  const table = getHeaderTable_(sheet, ['Company', 'Status']);
  return readHeadquartersRows_(sheet, table).filter(function(row) {
    return String(getValueByHeader_(row, table.headers, 'Company') || '').trim() !== '';
  }).map(function(row) {
    return {
      id: String(getValueByHeader_(row, table.headers, 'Prospect ID') || '').trim(),
      status: normalizePipelineStage_(getValueByHeader_(row, table.headers, 'Status')),
      nextAction: String(getValueByHeader_(row, table.headers, 'Next Action') || '').trim(),
      dueAt: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Follow-Up Date')),
      lastActivityAt: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Last Activity'))
    };
  });
}

function readHeadquartersFollowUpsV1_(ss) {
  const sheet = getRequiredSheet_(ss, FOLLOW_UPS_SHEET);
  const table = getHeaderTable_(sheet, ['Follow-Up ID', 'Current Status', 'Follow-Up Type', 'Due Date', 'Completed']);
  return readHeadquartersRows_(sheet, table).map(function(row) {
    return {
      id: String(getValueByHeader_(row, table.headers, 'Follow-Up ID') || '').trim(),
      relatedProspectId: String(getValueByHeader_(row, table.headers, 'Related Prospect ID') || '').trim(),
      relatedClientId: String(getValueByHeader_(row, table.headers, 'Related Client ID') || '').trim(),
      stage: String(getValueByHeader_(row, table.headers, 'Current Status') || '').trim(),
      type: String(getValueByHeader_(row, table.headers, 'Follow-Up Type') || '').trim(),
      dueAt: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Due Date')),
      completed: isFollowUpCompletedValue_(getValueByHeader_(row, table.headers, 'Completed'))
    };
  }).filter(function(item) {
    return item.id || item.relatedProspectId || item.relatedClientId;
  });
}

function readHeadquartersClientsV1_(ss) {
  const sheet = getRequiredSheet_(ss, CLIENTS_SHEET);
  const table = getHeaderTable_(sheet, ['Client ID', 'Status']);
  return readHeadquartersRows_(sheet, table).map(function(row) {
    return {
      id: String(getValueByHeader_(row, table.headers, 'Client ID') || '').trim(),
      companyPresent: String(
        getValueByHeader_(row, table.headers, 'Company') ||
        getValueByHeader_(row, table.headers, 'Client Name') || ''
      ).trim() !== '',
      status: String(getValueByHeader_(row, table.headers, 'Status') || '').trim()
    };
  }).filter(function(item) {
    return item.id && item.companyPresent;
  });
}

function readHeadquartersProjectsV1_(ss) {
  const sheet = getRequiredSheet_(ss, PROJECTS_SHEET);
  const table = getHeaderTable_(sheet, ['Project ID', 'Status', 'Due Date']);
  return readHeadquartersRows_(sheet, table).map(function(row) {
    return {
      id: String(getValueByHeader_(row, table.headers, 'Project ID') || '').trim(),
      status: String(getValueByHeader_(row, table.headers, 'Status') || '').trim(),
      dueAt: dateValueOrNull_(getValueByHeader_(row, table.headers, 'Due Date'))
    };
  }).filter(function(item) {
    return item.id;
  });
}

function readHeadquartersRows_(sheet, table) {
  const rowCount = Math.max(sheet.getLastRow() - table.headerRow, 0);
  return rowCount
    ? sheet.getRange(table.headerRow + 1, 1, rowCount, table.lastColumn).getValues()
    : [];
}

function buildHeadquartersSalesFeedV1FromSource_(source, generatedAt) {
  const now = new Date(generatedAt);
  if (isNaN(now.getTime())) {
    throw new Error('Feed generation time is invalid.');
  }

  const today = startOfDay_(now);
  const prospects = source.prospects || [];
  const followUps = source.followUps || [];
  const clients = source.clients || [];
  const projects = source.projects || [];
  const openFollowUps = followUps.filter(function(item) { return !item.completed; });
  const activeProjects = projects.filter(isHeadquartersActiveProjectV1_);
  let actions = [];
  let partial = false;

  try {
    actions = buildHeadquartersActionsV1_(prospects, openFollowUps, today);
  } catch (error) {
    partial = true;
    // Section name only; never record source data, identifiers, or error detail.
    console.warn('Headquarters Sales Feed optional actions section unavailable.');
  }

  const expiresAt = new Date(now.getTime() + HEADQUARTERS_SALES_FEED_FRESHNESS_MINUTES * 60000);
  return {
    version: HEADQUARTERS_SALES_FEED_VERSION,
    generatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source: {
      system: 'business-optimization-platform',
      environment: 'production'
    },
    status: {
      healthy: true,
      partial: partial
    },
    sales: {
      prospects: prospects.length,
      followUpsDue: countHeadquartersFollowUpsByDateV1_(openFollowUps, today, false),
      overdueFollowUps: countHeadquartersFollowUpsByDateV1_(openFollowUps, today, true),
      meetingsScheduled: countHeadquartersProspectsByStageV1_(prospects, 'Discovery Meeting Scheduled'),
      assessmentsPresented: countHeadquartersProspectsByStageV1_(prospects, 'Digital Business Assessment'),
      plansSent: countHeadquartersProspectsByStageV1_(prospects, 'Improvement Plan Sent'),
      clients: clients.filter(function(item) { return item.status === 'Active'; }).length,
      activeProjects: activeProjects.length,
      lostOpportunities: countHeadquartersProspectsByStageV1_(prospects, 'Lost')
    },
    actions: actions,
    delivery: {
      activeClients: clients.filter(function(item) { return item.status === 'Active'; }).length,
      activeProjects: activeProjects.length,
      dueSoon: activeProjects.filter(function(item) {
        if (!item.dueAt) return false;
        const days = Math.round((startOfDay_(item.dueAt).getTime() - today.getTime()) / 86400000);
        return days >= 0 && days <= 7;
      }).length,
      overdue: activeProjects.filter(function(item) {
        return item.dueAt && startOfDay_(item.dueAt).getTime() < today.getTime();
      }).length
    },
    revenue: {
      connected: false
    }
  };
}

function buildHeadquartersActionsV1_(prospects, openFollowUps, today) {
  const actions = [];
  const prospectFollowUpIds = {};

  openFollowUps.forEach(function(item) {
    if (!item.dueAt) return;
    const due = startOfDay_(item.dueAt);
    if (due.getTime() > today.getTime()) return;
    const safeId = item.id || item.relatedProspectId || item.relatedClientId;
    if (!safeId) return;
    if (item.relatedProspectId) prospectFollowUpIds[item.relatedProspectId] = true;
    actions.push({
      id: createHeadquartersOpaqueIdV1_('follow-up', safeId),
      kind: 'follow-up',
      stage: isHeadquartersSafeStageV1_(item.stage) ? item.stage : 'Follow-Up',
      nextAction: due.getTime() < today.getTime() ? 'Complete overdue follow-up' : 'Complete follow-up due today',
      dueAt: item.dueAt.toISOString(),
      waitingDays: Math.max(Math.round((today.getTime() - due.getTime()) / 86400000), 0),
      needsBrian: true,
      lastActivityAt: null,
      priority: due.getTime() < today.getTime() ? 1 : 2
    });
  });

  prospects.forEach(function(item) {
    if (!item.id || !isHeadquartersSafeNextActionV1_(item.nextAction) || prospectFollowUpIds[item.id] ||
        item.status === 'Client' || item.status === 'Lost' || item.status === 'Nurture') return;
    const lastActivity = item.lastActivityAt ? startOfDay_(item.lastActivityAt) : null;
    actions.push({
      id: createHeadquartersOpaqueIdV1_('prospect', item.id),
      kind: 'prospect-next-action',
      stage: isHeadquartersSafeStageV1_(item.status) ? item.status : 'Prospect',
      nextAction: item.nextAction,
      dueAt: item.dueAt ? item.dueAt.toISOString() : null,
      waitingDays: lastActivity ? Math.max(Math.round((today.getTime() - lastActivity.getTime()) / 86400000), 0) : 0,
      needsBrian: true,
      lastActivityAt: item.lastActivityAt ? item.lastActivityAt.toISOString() : null,
      priority: 3
    });
  });

  return actions.sort(function(a, b) {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const dueA = a.dueAt || '9999';
    const dueB = b.dueAt || '9999';
    if (dueA !== dueB) return dueA < dueB ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }).map(function(item) {
    delete item.priority;
    return item;
  });
}

function isHeadquartersSafeNextActionV1_(value) {
  const allowed = PROSPECT_DROPDOWN_DEFAULTS && PROSPECT_DROPDOWN_DEFAULTS['Next Action'] || [];
  return allowed.indexOf(String(value || '').trim()) !== -1;
}

function isHeadquartersSafeStageV1_(value) {
  return value === 'Follow-Up' || PIPELINE_STAGES.indexOf(String(value || '').trim()) !== -1;
}

function countHeadquartersFollowUpsByDateV1_(items, today, overdue) {
  return items.filter(function(item) {
    if (!item.dueAt) return false;
    const dueTime = startOfDay_(item.dueAt).getTime();
    return overdue ? dueTime < today.getTime() : dueTime === today.getTime();
  }).length;
}

function countHeadquartersProspectsByStageV1_(prospects, stage) {
  return prospects.filter(function(item) { return item.status === stage; }).length;
}

function isHeadquartersActiveProjectV1_(project) {
  return project.status !== '' && ['Completed', 'Cancelled', 'Maintenance'].indexOf(project.status) === -1;
}

function createHeadquartersOpaqueIdV1_(kind, identifier) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${kind}:${String(identifier)}`,
    Utilities.Charset.UTF_8
  );
  return 'hq_' + bytes.map(function(value) {
    return ((value < 0 ? value + 256 : value) + 256).toString(16).slice(-2);
  }).join('').slice(0, 24);
}

function parseHeadquartersSalesFeedRequest_(e) {
  if (!e || !e.postData || typeof e.postData.contents !== 'string') return null;
  try {
    const body = JSON.parse(e.postData.contents);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch (error) {
    return null;
  }
}

function constantTimeStringEquals_(candidate, configured) {
  const left = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(candidate),
    Utilities.Charset.UTF_8
  );
  const right = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(configured),
    Utilities.Charset.UTF_8
  );
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index % left.length] || 0) ^ (right[index % right.length] || 0);
  }
  return difference === 0;
}

function createHeadquartersSalesFeedJsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
