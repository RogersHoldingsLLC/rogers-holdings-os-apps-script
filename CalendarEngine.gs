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

  try {
    const event = createDiscoveryCalendarEvent_(prospect, startDate, durationMinutes);
    const folder = getOrCreateAuditPackageFolder_(prospect.company);
    upsertAuditPackageBlobFile_(
      folder,
      'Discovery Call Brief.pdf',
      buildDiscoveryCallBriefPdfBlob_(prospect, startDate, durationMinutes)
    );
    const headers = ensureSheetColumns_(context.sheet, ['Discovery Date']).headers;

    setProspectStatusIfHeader_(context.sheet, headers, context.selectedRow, 'Discovery Meeting Scheduled');
    setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Next Action', 'Present Digital Business Assessment');
    setIfHeaderCell_(context.sheet, headers, context.selectedRow, 'Discovery Date', startDate);
    syncFollowUpForProspectRow_(context.sheet, headers, context.selectedRow, 'Discovery Meeting Scheduled');
    updateSelectedProspectLastActivity_(context.sheet, headers, context.selectedRow);
    logPipelineActivity_(
      context.ss,
      prospect.company,
      'Discovery Meeting Scheduled',
      `Discovery call scheduled for ${formatDiscoveryDateTime_(startDate)}. Calendar event: ${event.title}. Discovery brief PDF created.`
    );
    refreshSalesOperatingSystem_();

    ui.alert('Rogers Holdings OS', 'Discovery Call Created', ui.ButtonSet.OK);
  } catch (error) {
    ui.alert(
      'Rogers Holdings OS',
      error && error.message ? error.message : String(error),
      ui.ButtonSet.OK
    );
  }
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

function createDiscoveryCalendarEvent_(prospect, startDate, durationMinutes) {
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const title = `Discovery Call - ${prospect.company}`;
  const description = buildDiscoveryCallDescription_(prospect);
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
        }
      },
      'primary',
      {
        sendUpdates: 'all',
        conferenceDataVersion: 1
      }
    );

    return {
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
