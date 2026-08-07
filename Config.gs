/**
 * Business Optimization Platform - Config.
 * Split from the stable Code.gs monolith without changing function names or behavior.
 */

/**
 * Business Optimization Platform prospect automation menu.
 */

var MASTER_PROSPECT_SHEET = 'Master Prospect Tracker';
var ACTIVITY_FEED_SHEET = 'Activity Feed';
var DASHBOARD_METRICS_SHEET = 'Dashboard Metrics';
var CLIENTS_SHEET = 'Clients';
var CLIENT_WORKSPACE_SHEET = 'Client Workspace';
var FOLLOW_UPS_SHEET = 'Follow-Ups';
var PROJECTS_SHEET = 'Projects';
var DAILY_FRICTION_LOG_SHEET = "Brian's Daily Friction Log";
var PRODUCT_FEEDBACK_SHEET = 'Product Feedback';
var PRODUCT_NAME = 'Business Optimization Platform';
var PRODUCT_VERSION = '1.0.0-rc';
var PRODUCT_BUILD = '2026.07.20-rc';

var PRODUCT_FEEDBACK_COLUMNS = [
  'Feedback ID',
  'Date Logged',
  'Source',
  'Priority',
  'Type',
  'Area',
  'Description',
  'Business Impact',
  'Status',
  'Target Version',
  'Notes'
];

var PRODUCT_FEEDBACK_PRIORITIES = [
  'P0 Must Fix',
  'P1 Workflow',
  'P2 Polish',
  'P3 Future'
];

var PRODUCT_FEEDBACK_TYPES = [
  'Bug',
  'UX Issue',
  'Automation',
  'Data',
  'Polish',
  'Future Feature'
];

var PRODUCT_FEEDBACK_STATUSES = [
  'Open',
  'Reviewing',
  'Planned',
  'In Progress',
  'Done',
  'Deferred'
];

var DAILY_FRICTION_LOG_COLUMNS = [
  'Date',
  'Area',
  'Issue / Observation',
  'Type',
  'Priority',
  'Impact',
  'Possible Fix',
  'Status',
  'Notes'
];

var DAILY_FRICTION_LOG_TYPES = [
  'Bug',
  'Too Many Clicks',
  'Confusing',
  'Missing Field',
  'Visual Issue',
  'Automation Idea',
  'Feature Request',
  'Future Idea'
];

var DAILY_FRICTION_LOG_PRIORITIES = [
  'Must Fix',
  'Important',
  'Nice to Have',
  'Future'
];

var DAILY_FRICTION_LOG_STATUSES = [
  'New',
  'Reviewing',
  'Planned',
  'Fixed',
  'Deferred'
];

var PROJECT_COLUMNS = [
  'Project ID',
  'Client ID',
  'Client',
  'Service',
  'Package',
  'Status',
  'Priority',
  'Start Date',
  'Due Date',
  'Progress %',
  'Assigned To',
  'Current Phase',
  'Deliverables',
  'Folder',
  'Notes',
  'Last Updated'
];

var PROJECT_STATUSES = [
  'Planning',
  'Discovery',
  'In Progress',
  'Waiting on Client',
  'Review',
  'Completed',
  'Maintenance',
  'Cancelled'
];

var PROJECT_DELIVERABLE_TYPES = [
  'Website',
  'SEO',
  'Google Business',
  'Automation',
  'Consulting',
  'Training',
  'Other'
];

var FOLLOW_UP_COLUMNS = [
  'Follow-Up ID',
  'Company',
  'Contact',
  'Email',
  'Related Prospect ID',
  'Related Client ID',
  'Current Status',
  'Follow-Up Type',
  'Due Date',
  'Days Until Due',
  'Priority',
  'Assigned To',
  'Notes',
  'Completed',
  'Completed Date'
];

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
  'Executive Brief Sent',
  'Discovery Meeting Scheduled',
  'Digital Business Assessment',
  'Improvement Plan Sent',
  'Project Started',
  'Client',
  'Nurture',
  'Lost'
];

// Stored workbooks may still contain pre-v1.0 lifecycle values. Keep these
// aliases readable, but write and display only the canonical stage names above.
var LEGACY_PIPELINE_STAGE_ALIASES = {
  'Executive Snapshot Sent': 'Executive Brief Sent',
  'Digital Business Assessment Presented': 'Digital Business Assessment'
};

var LIFECYCLE_RECONCILIATION_COLUMNS = [
  'Lifecycle Operation Key',
  'Lifecycle Operation State',
  'Lifecycle Operation Details',
  'Lifecycle Confirmed At',
  'Calendar Operation Key',
  'Calendar Event ID',
  'Calendar Operation State'
];

var PROSPECT_REVENUE_WORKFLOW_COLUMNS = [
  'Prospect ID', 'Validation Status', 'Validation Details',
  'Inspection Status', 'Inspection Attempted At', 'Inspection Completed At',
  'Workflow Status', 'Workflow Operation Key', 'Workflow Details',
  'Review Status', 'Reviewed At', 'Review Notes',
  'Audit Package Generated', 'Audit Package Date',
  'Proposal Generated', 'Gmail Draft Created'
];

var PROSPECT_REVENUE_ACTIVITY_COLUMNS = ['Prospect ID', 'Operation Key'];

var PIPELINE_STAGE_COLORS = {
  'Lead Found': '#d9d9d9',
  'Executive Brief Sent': '#d9d2e9',
  'Discovery Meeting Scheduled': '#fff2cc',
  'Digital Business Assessment': '#cfe2f3',
  'Improvement Plan Sent': '#d0e0e3',
  'Project Started': '#eadcf8',
  'Client': '#d9ead3',
  'Nurture': '#e6e0d4',
  'Lost': '#f4cccc'
};

var PROSPECT_DROPDOWN_DEFAULTS = {
  'Audit Outcome': [
    'Strong Fit',
    'Good Fit',
    'Needs Nurture',
    'Poor Fit',
    'Not Audited'
  ],
  'Priority Tier': [
    'A - Hot',
    'B - Good',
    'C - Later',
    'D - Nurture'
  ],
  Status: PIPELINE_STAGES,
  'Next Action': [
    'Generate Executive Brief',
    'Create Outreach Draft',
    'Review Outreach',
    'Confirm Executive Brief Sent',
    'Schedule Discovery Meeting',
    'Present Digital Business Assessment',
    'Confirm Digital Business Assessment',
    'Generate Improvement Plan',
    'Confirm Improvement Plan Sent',
    'Record Improvement Plan Outcome',
    'Complete Client Onboarding',
    'Reactivate Nurtured Prospect',
    'Follow Up',
    'Nurture',
    'Archived'
  ],
  'Offer / Service': [
    'Business Snapshot',
    'Google Business Optimization',
    'Local SEO',
    'AI Automation',
    'Business Systems',
    'Client Website',
    'Monthly Support',
    'One-Time Project',
    'Consulting'
  ],
  'Moved to CRM': [
    'Yes',
    'No'
  ]
};

var AUDIT_SOURCE_VALUES = [
  'Website Audit Tool API',
  'Website Audit Tool',
  'Quick Internal Audit'
];

var VERIFIED_CLIENT_FACING_AUDIT_SOURCES = [
  'Website Audit Tool API',
  'Website Audit Tool'
];

var VERIFIED_CLIENT_FACING_AUDIT_OUTCOMES = [
  'Strong Fit',
  'Good Fit',
  'Needs Nurture',
  'Poor Fit'
];

var VERIFIED_CLIENT_FACING_PRIORITY_TIERS = [
  'A - Hot',
  'B - Good',
  'C - Later'
];

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

var BUSINESS_OPTIMIZATION_PLATFORM_THEME = {
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
