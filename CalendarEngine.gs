/**
 * Rogers Holdings OS - CalendarEngine.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

function createDiscoveryCall() {
  const context = getSelectedProspectContext_(['Company']);
  if (!context) {
    return;
  }

  const ui = SpreadsheetApp.getUi();
  const prospect = buildSelectedProspectForDiscoveryCall_(context);
  const missing = requiredProspectFieldsMissing_(prospect, [
    ['Company', 'company'],
    ['Contact', 'contact'],
    ['Email', 'email']
  ]);

  if (missing.length) {
    ui.alert(
      'Rogers Holdings OS',
      'Add the missing fields before creating a discovery call: ' + missing.join(', '),
      ui.ButtonSet.OK
    );
    return;
  }

  const status = normalizePipelineStage_(prospect.status) || String(prospect.status || '').trim();
  if (status === 'Client' || status === 'Lost' || status === 'Won') {
    ui.alert(
      'Rogers Holdings OS',
      'Discovery meetings cannot be scheduled for prospects marked Client or Lost.',
      ui.ButtonSet.OK
    );
    return;
  }
  const transitionValidation = validateProspectStageTransition_(status || 'Lead Found', 'Discovery Meeting Scheduled');
  if (!transitionValidation.allowed) {
    ui.alert('Rogers Holdings OS', transitionValidation.message, ui.ButtonSet.OK);
    return;
  }
  if (transitionValidation.idempotent) {
    const existingHeaders = ensureSheetColumns_(context.sheet, LIFECYCLE_RECONCILIATION_COLUMNS).headers;
    context.table.headers = existingHeaders;
    context.table.lastColumn = context.sheet.getLastColumn();
    const existingState = getDiscoveryCalendarOperationState_(context);
    if (existingState.state !== 'Event Verified' || !existingState.eventId) {
      markLifecycleReconciliationRequired_(context.sheet, existingHeaders, context.selectedRow, 'Discovery Meeting Scheduled is confirmed, but the Calendar event ID is not verified. No new invitation was sent.');
      ui.alert('Rogers Holdings OS', 'Discovery Meeting Scheduled is already confirmed, but the Calendar event is not verified. Reconciliation is required; no duplicate invitation was sent.', ui.ButtonSet.OK);
      return;
    }
    applyConfirmedProspectTransition_(context, 'Discovery Meeting Scheduled', 'Discovery Meeting Scheduled', 'Existing Calendar event and lifecycle effects reconciled.');
    ui.alert('Rogers Holdings OS', 'Discovery Meeting Scheduled was already confirmed. The existing event and downstream lifecycle effects were checked; no duplicate event was created.', ui.ButtonSet.OK);
    return;
  }

  const datePrompt = ui.prompt(
    'Rogers Holdings OS',
    'Enter discovery call date as YYYY-MM-DD.',
    ui.ButtonSet.OK_CANCEL
  );
  if (datePrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const timePrompt = ui.prompt(
    'Rogers Holdings OS',
    'Enter discovery call time as HH:MM AM/PM or 24-hour HH:MM.',
    ui.ButtonSet.OK_CANCEL
  );
  if (timePrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const durationPrompt = ui.prompt(
    'Rogers Holdings OS',
    'Enter duration in minutes. Leave blank for 30.',
    ui.ButtonSet.OK_CANCEL
  );
  if (durationPrompt.getSelectedButton() !== ui.Button.OK) {
    return;
  }

  const startDate = parseDiscoveryDateTime_(datePrompt.getResponseText(), timePrompt.getResponseText());
  const durationMinutes = parseDiscoveryDurationMinutes_(durationPrompt.getResponseText());
  if (!startDate) {
    ui.alert('Rogers Holdings OS', 'Enter a valid date and time, then run Create Discovery Call again.', ui.ButtonSet.OK);
    return;
  }
  if (!durationMinutes) {
    ui.alert('Rogers Holdings OS', 'Enter a valid duration in minutes, then run Create Discovery Call again.', ui.ButtonSet.OK);
    return;
  }

  const lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    const headers = ensureSheetColumns_(context.sheet, ['Discovery Date'].concat(LIFECYCLE_RECONCILIATION_COLUMNS)).headers;
    context.table.headers = headers;
    context.table.lastColumn = context.sheet.getLastColumn();
    const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
    const calendarId = 'primary';
    const operationKey = buildDiscoveryCalendarOperationKey_(context, startDate, endDate, calendarId);
    const calendarState = getDiscoveryCalendarOperationState_(context);
    if (calendarState.key && calendarState.key !== operationKey && (calendarState.eventId || calendarState.state)) {
      throw new Error('A discovery Calendar operation already exists for this prospect at a different time. Use an explicit reschedule workflow after reconciling the stored event; no invitation was sent.');
    }
    let event = reconcileDiscoveryCalendarEvent_(prospect, startDate, endDate, operationKey, calendarState.eventId, calendarId);
    const schedulingDecision = getDiscoverySchedulingDecision_(calendarState, operationKey, !!event);
    if (schedulingDecision === 'block-different-operation') {
      throw new Error('A prior discovery Calendar operation already exists for this prospect. Retry with the same date/time or reconcile the stored event before scheduling a different invitation.');
    }
    if (schedulingDecision === 'block-ambiguous') {
      throw new Error('The prior Calendar result remains ambiguous and no matching event could be verified. No new invitation was sent. Reconcile Calendar manually, then record the event ID before retrying.');
    }
    if (!event) {
      setDiscoveryCalendarOperationState_(context, operationKey, '', 'Creating');
      try {
        const createdEvent = createDiscoveryCalendarEvent_(prospect, startDate, durationMinutes, operationKey);
        event = reconcileDiscoveryCalendarEvent_(prospect, startDate, endDate, operationKey, createdEvent.id || '', calendarId);
        if (!event) throw new Error('Created Calendar event could not be re-read with the exact operation key and meeting time.');
      } catch (createError) {
        try {
          event = reconcileDiscoveryCalendarEvent_(prospect, startDate, endDate, operationKey, '', calendarId);
        } catch (reconcileError) {
          setDiscoveryCalendarOperationState_(context, operationKey, '', 'Ambiguous; Reconciliation Required');
          throw new Error(`Calendar reconciliation found conflicting or unverifiable event evidence. No retry insertion was attempted: ${reconcileError && reconcileError.message ? reconcileError.message : String(reconcileError)}`);
        }
        if (!event) {
          setDiscoveryCalendarOperationState_(context, operationKey, '', 'Ambiguous; Reconciliation Required');
          throw new Error(`Calendar creation returned an ambiguous result. No retry insertion was attempted. Reconciliation is required: ${createError && createError.message ? createError.message : String(createError)}`);
        }
      }
    }
    setDiscoveryCalendarOperationState_(context, operationKey, event.id || calendarState.eventId || '', 'Event Verified');
    applyConfirmedProspectTransition_(context, 'Discovery Meeting Scheduled', 'Discovery Meeting Scheduled', `Calendar event successfully verified for ${formatDiscoveryDateTime_(startDate)}: ${event.title}.`, {
      lockHeld: true, operationKey: `LIFECYCLE:${operationKey}`, extraRowValues: { 'Discovery Date': startDate }
    });
    try {
      const folder = getOrCreateAuditPackageFolder_(prospect.company);
      upsertAuditPackageBlobFile_(folder, 'Discovery Call Brief.pdf', buildDiscoveryCallBriefPdfBlob_(prospect, startDate, durationMinutes));
      logPipelineActivity_(context.ss, prospect.company, 'Discovery Call Brief Generated', 'Discovery brief PDF created after Calendar event confirmation.');
    } catch (briefError) {
      console.warn('Discovery Call Brief generation failed after Calendar event creation: ' + (briefError && briefError.message ? briefError.message : String(briefError)));
    }
    refreshSalesOperatingSystem_();

    ui.alert('Rogers Holdings OS', 'Discovery Call Created', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert(
      'Rogers Holdings OS',
      error && error.message ? error.message : String(error),
      ui.ButtonSet.OK
    );
  } finally {
    lock.releaseLock();
  }
}

function getDiscoverySchedulingDecision_(calendarState, operationKey, matchedEvent) {
  const state = calendarState || {};
  if (state.key && state.key !== operationKey && (state.eventId || state.state === 'Event Verified' || state.state === 'Ambiguous; Reconciliation Required')) return 'block-different-operation';
  if (matchedEvent) return 'use-existing';
  if (state.state === 'Ambiguous; Reconciliation Required') return 'block-ambiguous';
  return 'create';
}

function buildDiscoveryCalendarOperationKey_(context, startDate, endDate, calendarId) {
  const values = context.sheet.getRange(context.selectedRow, 1, 1, context.sheet.getLastColumn()).getValues()[0];
  const identity = String(getValueByHeader_(values, context.table.headers, 'Prospect ID') || `${context.sheet.getSheetId()}-ROW-${context.selectedRow}`)
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `DISCOVERY:${identity}:${startDate.toISOString()}:${endDate.toISOString()}:${String(calendarId || 'primary').toLowerCase()}`;
}

function getDiscoveryCalendarOperationState_(context) {
  const headers = ensureLifecycleReconciliationColumns_(context);
  const values = context.sheet.getRange(context.selectedRow, 1, 1, context.table.lastColumn).getValues()[0];
  return {
    key: String(getValueByHeader_(values, headers, 'Calendar Operation Key') || ''),
    eventId: String(getValueByHeader_(values, headers, 'Calendar Event ID') || ''),
    state: String(getValueByHeader_(values, headers, 'Calendar Operation State') || '')
  };
}

function setDiscoveryCalendarOperationState_(context, operationKey, eventId, state) {
  const headers = ensureLifecycleReconciliationColumns_(context);
  setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Calendar Operation Key', operationKey);
  if (eventId) setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Calendar Event ID', eventId);
  setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Calendar Operation State', state);
}

function reconcileDiscoveryCalendarEvent_(prospect, startDate, endDate, operationKey, eventId, calendarId) {
  const targetCalendarId = calendarId || 'primary';
  if (eventId && typeof Calendar !== 'undefined' && Calendar.Events && Calendar.Events.get) {
    try {
      const existing = Calendar.Events.get(targetCalendarId, eventId);
      if (calendarEventMatchesOperation_(existing, startDate, endDate, operationKey)) return calendarEventResult_(existing, `Discovery Call - ${prospect.company}`);
      if (existing && existing.status !== 'cancelled') throw new Error('Stored Calendar event does not match the requested operation key and exact meeting time.');
    } catch (error) {
      if (error && String(error.message || '').indexOf('does not match') !== -1) throw error;
      console.warn('Stored Calendar event ID lookup failed: ' + (error && error.message ? error.message : String(error)));
    }
  }
  if (typeof Calendar !== 'undefined' && Calendar.Events && Calendar.Events.list) {
    try {
      const response = Calendar.Events.list(targetCalendarId, {
        timeMin: new Date(startDate.getTime() - 60000).toISOString(),
        timeMax: new Date(endDate.getTime() + 60000).toISOString(),
        singleEvents: true,
        privateExtendedProperty: `rogersLifecycleOperation=${operationKey}`
      });
      const matches = (response.items || []).filter(function(candidate) { return calendarEventMatchesOperation_(candidate, startDate, endDate, operationKey); });
      if (matches.length > 1) throw new Error('Multiple Calendar events match the same lifecycle operation; reconciliation is required.');
      if (matches.length === 1) return calendarEventResult_(matches[0], `Discovery Call - ${prospect.company}`);
    } catch (error) {
      if (error && String(error.message || '').indexOf('Multiple Calendar events') !== -1) throw error;
      console.warn('Advanced Calendar reconciliation lookup failed: ' + (error && error.message ? error.message : String(error)));
    }
  }
  try {
    const events = CalendarApp.getDefaultCalendar().getEvents(new Date(startDate.getTime() - 60000), new Date(endDate.getTime() + 60000), { search: operationKey })
      .filter(function(candidate) { return calendarAppEventMatchesOperation_(candidate, startDate, endDate, operationKey); });
    if (events.length > 1) throw new Error('Multiple Calendar events match the same lifecycle operation; reconciliation is required.');
    if (events.length === 1) return { id: events[0].getId(), title: events[0].getTitle(), htmlLink: '', meetLink: '' };
  } catch (error) {
    if (error && String(error.message || '').indexOf('Multiple Calendar events') !== -1) throw error;
    console.warn('CalendarApp reconciliation lookup failed: ' + (error && error.message ? error.message : String(error)));
  }
  return null;
}

function calendarEventMatchesOperation_(event, startDate, endDate, operationKey) {
  if (!event || event.status === 'cancelled') return false;
  const eventKey = String(event.extendedProperties && event.extendedProperties.private && event.extendedProperties.private.rogersLifecycleOperation || '');
  const description = String(event.description || '');
  const keyMatches = eventKey === operationKey || description.indexOf(`Lifecycle Operation: ${operationKey}`) !== -1;
  const eventStart = event.start && (event.start.dateTime || event.start.date);
  const eventEnd = event.end && (event.end.dateTime || event.end.date);
  return keyMatches && calendarTimesMatch_(eventStart, eventEnd, startDate, endDate);
}

function calendarAppEventMatchesOperation_(event, startDate, endDate, operationKey) {
  if (!event) return false;
  return String(event.getDescription() || '').indexOf(`Lifecycle Operation: ${operationKey}`) !== -1 &&
    calendarTimesMatch_(event.getStartTime(), event.getEndTime(), startDate, endDate);
}

function calendarTimesMatch_(eventStart, eventEnd, requestedStart, requestedEnd) {
  const start = new Date(eventStart).getTime();
  const end = new Date(eventEnd).getTime();
  return Number.isFinite(start) && Number.isFinite(end) && start === requestedStart.getTime() && end === requestedEnd.getTime();
}

function calendarEventResult_(event, fallbackTitle) {
  return { id: event.id || '', title: event.summary || fallbackTitle, htmlLink: event.htmlLink || '', meetLink: event.hangoutLink || '' };
}

function buildSelectedProspectForDiscoveryCall_(context) {
  const headers = context.table.headers;
  const values = context.values;
  return {
    company: getValueByHeader_(values, headers, 'Company'),
    contact: getValueByHeader_(values, headers, 'Contact'),
    email: getValueByHeader_(values, headers, 'Email'),
    phone: getValueByHeader_(values, headers, 'Phone'),
    website: getValueByHeader_(values, headers, 'Website'),
    auditScore: getValueByHeader_(values, headers, 'Audit Score'),
    auditOutcome: getValueByHeader_(values, headers, 'Audit Outcome'),
    priorityTier: getValueByHeader_(values, headers, 'Priority Tier'),
    offerService: getValueByHeader_(values, headers, 'Offer / Service'),
    notes: getValueByHeader_(values, headers, 'Notes'),
    summary: getValueByHeader_(values, headers, 'Summary'),
    status: getValueByHeader_(values, headers, 'Status')
  };
}

function createDiscoveryCalendarEvent_(prospect, startDate, durationMinutes, operationKey) {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const title = `Discovery Call - ${prospect.company}`;
  const description = buildDiscoveryCallDescription_(prospect) + `\n\nLifecycle Operation: ${operationKey}`;
  const guestEmail = String(prospect.email || '').trim();

  if (typeof Calendar !== 'undefined' && Calendar.Events && Calendar.Events.insert) {
    const calendarEvent = Calendar.Events.insert(
      {
        summary: title,
        description: description,
        start: {
          dateTime: startDate.toISOString()
        },
        end: {
          dateTime: endDate.toISOString()
        },
        attendees: [
          {
            email: guestEmail
          }
        ],
        conferenceData: {
          createRequest: {
            requestId: Utilities.getUuid(),
            conferenceSolutionKey: {
              type: 'hangoutsMeet'
            }
          }
        },
        extendedProperties: { private: { rogersLifecycleOperation: operationKey } }
      },
      'primary',
      {
        sendUpdates: 'all',
        conferenceDataVersion: 1
      }
    );

    return {
      id: calendarEvent.id || '',
      title: calendarEvent.summary || title,
      htmlLink: calendarEvent.htmlLink || '',
      meetLink: calendarEvent.hangoutLink || ''
    };
  }

  const event = CalendarApp.getDefaultCalendar().createEvent(
    title,
    startDate,
    endDate,
    {
      guests: guestEmail,
      sendInvites: true,
      description: description
    }
  );

  console.warn('Create Discovery Call: Advanced Calendar service is not enabled; event was created without automatic Google Meet conference data.');
  return {
    id: event.getId(),
    title: event.getTitle(),
    htmlLink: '',
    meetLink: ''
  };
}

function buildDiscoveryCallDescription_(prospect) {
  return [
    'Rogers Holdings LLC Discovery Call',
    '',
    `Company: ${prospect.company || ''}`,
    `Website: ${prospect.website || ''}`,
    `Audit Score: ${prospect.auditScore || ''}`,
    `Audit Outcome: ${prospect.auditOutcome || ''}`,
    '',
    'Notes:',
    prospect.notes || ''
  ].join('\n');
}

function parseDiscoveryDateTime_(dateText, timeText) {
  const dateValue = String(dateText || '').trim();
  const timeValue = String(timeText || '').trim();
  if (!dateValue || !timeValue) {
    return null;
  }

  const dateTime = new Date(`${dateValue} ${timeValue}`);
  return Number.isNaN(dateTime.getTime()) ? null : dateTime;
}

function parseDiscoveryDurationMinutes_(value) {
  const text = String(value || '').trim();
  const duration = text ? Number(text) : 30;
  return Number.isFinite(duration) && duration > 0 ? duration : null;
}

function formatDiscoveryDateTime_(value) {
  return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
}
