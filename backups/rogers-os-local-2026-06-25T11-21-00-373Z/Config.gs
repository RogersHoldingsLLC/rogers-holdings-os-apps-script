/**
 * Rogers Holdings OS - Config.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

/**
 * Rogers Holdings OS prospect automation menu.
 */

var MASTER_PROSPECT_SHEET = 'Master Prospect Tracker';
var ACTIVITY_FEED_SHEET = 'Activity Feed';
var DASHBOARD_METRICS_SHEET = 'Dashboard Metrics';
var CLIENTS_SHEET = 'Clients';
var CLIENT_WORKSPACE_SHEET = 'Client Workspace';

var CLIENT_COLUMNS = [
  'Client ID',
  'Company',
  'Client Name',
  'Contact',
  'Email',
  'Phone',
  'Website',
  'Industry',
  'Service Package',
  'Start Date',
  'Renewal Date',
  'Assigned To',
  'Current Project',
  'Project Status',
  'Due Date',
  'Service',
  'Priority Tier',
  'Contract Value',
  'Client Since',
  'Status',
  'Last Activity',
  'Notes'
];

var PIPELINE_STAGES = [
  'Lead Found',
  'Audit Complete',
  'Draft Created',
  'Discovery Scheduled',
  'Email Sent',
  'Follow Up Due',
  'Proposal Sent',
  'Audit Package Sent',
  'Nurture',
  'Won',
  'Lost'
];

var PIPELINE_STAGE_COLORS = {
  'Lead Found': '#d9d9d9',
  'Audit Complete': '#cfe2f3',
  'Draft Created': '#d9d2e9',
  'Discovery Scheduled': '#d9ead3',
  'Email Sent': '#fce5cd',
  'Follow Up Due': '#fff2cc',
  'Proposal Sent': '#d0e0e3',
  'Audit Package Sent': '#eadcf8',
  'Nurture': '#e6e0d4',
  'Won': '#d9ead3',
  'Lost': '#f4cccc'
};

var DEMO_COMPANY_NAMES = [
  'Bluegrass Roofing Co',
  'Commonwealth Plumbing',
  'Summit HVAC Services',
  'Copper Door Cafe',
  'North Point Fitness',
  'Sterling Family Dental',
  'Main Street Auto Repair',
  'Heritage Lawn Care'
];

var ROGERS_OS_THEME = {
  black: '#111111',
  charcoal: '#1c1c1c',
  gold: '#b88728',
  softGold: '#f4ead7',
  neutral: '#f7f3ea',
  softNeutral: '#fbfaf7',
  border: '#d8c7a4',
  text: '#202020',
  muted: '#6f6a60',
  white: '#ffffff'
};

var MASTER_PROSPECT_STANDARD_ORDER_AFTER_WEBSITE = [
  'City',
  'State',
  'Industry',
  'Source'
];

var SMART_AUDIT_FINDINGS_LIBRARY = [
  {
    key: 'missingWebsite',
    finding: 'Customers may have difficulty finding the business online.',
    matches: function(prospect) {
      return !String(prospect.website || '').trim();
    }
  },
  {
    key: 'missingPhone',
    finding: 'Potential customers may not have an easy way to call the business.',
    matches: function(prospect) {
      return textIncludesAny_(prospect.notes, ['phone_found: no', 'phone number found: no', 'missing phone', 'no phone', 'phone number was not detected']);
    }
  },
  {
    key: 'missingEmail',
    finding: 'The website may be missing a clear contact method.',
    matches: function(prospect) {
      return textIncludesAny_(prospect.notes, ['email_found: no', 'email address found: no', 'missing email', 'no email', 'no visible email']);
    }
  },
  {
    key: 'missingCallToAction',
    finding: 'Visitors may not know the next step to take.',
    matches: function(prospect) {
      return textIncludesAny_(prospect.notes, ['contact_language: no', 'missing call to action', 'missing cta', 'no call to action', 'calls-to-action could be improved']);
    }
  },
  {
    key: 'missingServiceInfo',
    finding: 'Customers may not immediately understand the services offered.',
    matches: function(prospect) {
      return textIncludesAny_(prospect.notes, ['service_language: no', 'missing service', 'services are not clearly', 'services clearly listed', 'services not clearly']);
    }
  },
  {
    key: 'missingMetaDescription',
    finding: 'Search visibility may be limited.',
    matches: function(prospect) {
      return textIncludesAny_(prospect.notes, ['meta_description: not found', 'meta description: not found', 'missing meta', 'no meta description', 'website is missing a meta description']);
    }
  },
  {
    key: 'missingTitleTag',
    finding: 'Search engines may not clearly understand the business.',
    matches: function(prospect) {
      return textIncludesAny_(prospect.notes, ['title: not found', 'page title: not found', 'missing title', 'no title tag', 'title tag']);
    }
  },
  {
    key: 'lowAuditScore',
    finding: 'The business may be losing online opportunities that could turn into calls or customer inquiries.',
    matches: function(prospect) {
      const score = Number(prospect.auditScore);
      return !Number.isNaN(score) && score < 60;
    }
  },
  {
    key: 'needsTrust',
    finding: 'The online presence could do more to build trust before a customer reaches out.',
    matches: function(prospect) {
      return textIncludesAny_(prospect.auditOutcome, ['high opportunity', 'needs improvement', 'critical', 'poor fit', 'needs nurture']);
    }
  },
  {
    key: 'localVisibility',
    finding: 'A few small visibility improvements could make the business easier to find in local search.',
    matches: function(prospect) {
      return true;
    }
  },
  {
    key: 'conversion',
    finding: 'Clearer messaging could help more visitors understand why they should contact the business.',
    matches: function(prospect) {
      return true;
    }
  },
  {
    key: 'nextStep',
    finding: 'A focused first step could improve how quickly customers move from interest to contacting the business.',
    matches: function(prospect) {
      return true;
    }
  }
];

function getRogersContactInfo_() {
  const properties = PropertiesService.getScriptProperties();
  return {
    name: properties.getProperty('ROGERS_CONTACT_NAME') || 'Brian Keith Rogers',
    company: properties.getProperty('ROGERS_CONTACT_COMPANY') || 'Rogers Holdings LLC',
    email: properties.getProperty('ROGERS_CONTACT_EMAIL') || 'briankeith@rogersholdingsllc.com',
    phone: properties.getProperty('ROGERS_CONTACT_PHONE') || '859-404-7300'
  };
}
