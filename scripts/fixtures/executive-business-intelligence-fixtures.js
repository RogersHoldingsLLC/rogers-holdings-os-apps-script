'use strict';

function evidence(id, category, observation, options = {}) {
  return Object.assign({
    id,
    source: 'Deterministic fixture',
    pageUrl: options.pageUrl || 'https://example.test/',
    pageType: options.pageType || 'Homepage',
    category,
    observation,
    rawValue: observation,
    confidence: options.confidence === undefined ? 0.9 : options.confidence,
    supportsStrength: Boolean(options.supportsStrength),
    supportsOpportunity: Boolean(options.supportsOpportunity),
    requiresReview: Boolean(options.requiresReview),
    status: options.status || (options.supportsStrength ? 'PASS' : (options.supportsOpportunity ? 'FAIL' : 'UNKNOWN')),
    observed: options.observed !== undefined ? Boolean(options.observed) : Boolean(options.supportsStrength || options.supportsOpportunity)
  }, options);
}

module.exports = {
  plumbing: {
    prospect: { company: 'Rapid Relief Plumbing', website: 'https://plumbing.example.test', industry: 'Plumbing', city: 'Dayton', state: 'OH', primaryServices: ['Emergency plumbing', 'Drain cleaning'] },
    evidence: [
      evidence('PL-1', 'Trust', 'Licensed and insured technicians are stated on the homepage.', { supportsStrength: true }),
      evidence('PL-2', 'Service', '24/7 emergency plumbing and drain cleaning are visible above the fold.', { supportsStrength: true }),
      evidence('PL-3', 'Conversion', 'The emergency phone number is not visible beside the first-screen service message.', { supportsOpportunity: true }),
      evidence('PL-4', 'Visibility', 'The homepage does not clearly state the Dayton service area.', { supportsOpportunity: true })
    ]
  },
  roofing: {
    prospect: { company: 'Heritage Family Roofing', website: 'https://roofing.example.test', industry: 'Roofing', city: 'Knoxville', state: 'TN', primaryServices: ['Roof repair', 'Roof replacement'] },
    evidence: [
      evidence('RF-1', 'Brand', 'The company identifies itself as family-owned since 1987.', { supportsStrength: true }),
      evidence('RF-2', 'Trust', 'A workmanship warranty is explained on the roof replacement page.', { supportsStrength: true, pageType: 'Service' }),
      evidence('RF-3', 'Trust', 'Completed roofing projects are not visible near the estimate request.', { supportsOpportunity: true }),
      evidence('RF-4', 'Conversion', 'The roof inspection request form does not explain what happens after submission.', { supportsOpportunity: true })
    ]
  },
  logistics: {
    prospect: { company: 'Northline Industrial Logistics', website: 'https://logistics.example.test', industry: 'Logistics and Industrial Services', primaryServices: ['Freight services', 'Warehousing'] },
    evidence: [
      evidence('LG-1', 'Operations', 'The site lists dedicated freight and temperature-controlled warehousing capabilities.', { supportsStrength: true }),
      evidence('LG-2', 'Trust', 'A case study describes reduced dock delays for a regional manufacturer.', { supportsStrength: true }),
      evidence('LG-3', 'Conversion', 'The contact form does not ask about shipment volume, lanes, or storage requirements.', { supportsOpportunity: true }),
      evidence('LG-4', 'Brand', 'The homepage headline is unclear about whether Northline serves manufacturers or consumers.', { supportsOpportunity: true })
    ]
  },
  nonprofit: {
    prospect: { company: 'River City Community Church', website: 'https://church.example.test', industry: 'Church or Nonprofit', city: 'Richmond', state: 'VA', primaryServices: ['Worship services', 'Community outreach'] },
    evidence: [
      evidence('NP-1', 'Brand', 'The homepage states a mission centered on neighborhood food access and family support.', { supportsStrength: true }),
      evidence('NP-2', 'Customer Experience', 'Sunday service times and a first-visit guide are visible from the homepage.', { supportsStrength: true }),
      evidence('NP-3', 'Conversion', 'The volunteer page does not show a clear signup path.', { supportsOpportunity: true, pageType: 'Volunteer' }),
      evidence('NP-4', 'Trust', 'The donation page lacks a visible explanation of how contributions support programs.', { supportsOpportunity: true, pageType: 'Donation' })
    ]
  },
  insufficient: {
    prospect: { company: 'Unknown Venture', website: 'https://unknown.example.test' },
    evidence: [evidence('IN-1', 'Website', 'A website URL was supplied.', { confidence: 0.5, requiresReview: true })]
  },
  metadataOnly: {
    prospect: { company: 'Directory Listing LLC', website: 'https://directory.example.test', industry: 'Plumbing', primaryServices: ['Plumbing'] },
    evidence: []
  },
  malformedLiveAcceptance: {
    prospect: {
      company: 'Rogers Holdings LLC', website: 'https://rogersholdingsllc.com', industry: '', city: 'Mount Sterling', state: 'KY',
      offerService: 'Website Audit', auditScore: 0, summary: 'requires consultant review',
      notes: 'Business consulting, digital optimization, automation, AI-powered tools, Google Workspace solutions, websites, audits, and operational consulting. No reviews detected. Google Business Profile link not detected. Contact visibility not verified.'
    },
    reportFile: {
      inspectionComplete: false,
      findings: [
        evidence('RH-1', 'Service', 'Business consulting, digital optimization, automation, AI-powered tools, Google Workspace solutions, websites, audits, and operational consulting are described.', { supportsStrength: true }),
      evidence('RH-2', 'Trust', 'No reviews were detected in the inspected content.', { supportsOpportunity: true, status: 'UNKNOWN', observed: false }),
        evidence('RH-3', 'Contact', 'Contact visibility was not verified because inspection evidence was incomplete.', { supportsOpportunity: true, confidence: 0.4, requiresReview: true })
      ],
      inspectionResult: { complete: false, inspectorResults: [{ name: 'Trust Signals Inspector', status: 'Unavailable' }] }
    }
  }
};
