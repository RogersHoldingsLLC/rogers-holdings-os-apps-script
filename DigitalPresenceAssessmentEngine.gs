/**
 * Business Optimization Platform - DigitalPresenceAssessmentEngine.
 * Shared client-facing assessment language for PDFs, previews, and outreach.
 */

function getDigitalPresenceAssessment_(score) {
  const numericScore = parseDigitalPresenceScore_(score);

  if (numericScore === null) {
    return {
      score: null,
      scoreText: 'Not scored',
      title: 'Digital Presence Assessment Pending',
      subtitle: 'A Digital Presence Score is needed before a client-facing assessment can be shown.'
    };
  }

  const roundedScore = Math.max(0, Math.min(100, Math.round(numericScore)));
  let title;
  let subtitle;

  if (roundedScore >= 90) {
    title = 'Excellent Digital Presence';
    subtitle = 'Your business has a strong online presence with only minor optimization opportunities.';
  } else if (roundedScore >= 80) {
    title = 'Strong Digital Foundation';
    subtitle = 'Your business performs well online and has several opportunities to increase visibility and conversions.';
  } else if (roundedScore >= 70) {
    title = 'Healthy Foundation with Improvement Opportunities';
    subtitle = 'Your business has a solid digital presence but several improvements could significantly increase customer engagement.';
  } else if (roundedScore >= 60) {
    title = 'Moderate Improvement Needed';
    subtitle = 'Several areas are limiting visibility, customer trust, and lead generation.';
  } else if (roundedScore >= 50) {
    title = 'Significant Improvement Needed';
    subtitle = 'Important opportunities exist to improve your online presence and customer experience.';
  } else if (roundedScore >= 40) {
    title = 'High Priority for Improvement';
    subtitle = 'Your online presence is preventing potential customers from fully trusting or finding your business.';
  } else {
    title = 'Critical Digital Issues Detected';
    subtitle = 'Immediate improvements are recommended to strengthen visibility, credibility, and lead generation.';
  }

  return {
    score: roundedScore,
    scoreText: `${roundedScore} / 100`,
    title: title,
    subtitle: subtitle
  };
}

function parseDigitalPresenceScore_(score) {
  if (score === '' || score === null || score === undefined) {
    return null;
  }

  const match = String(score).match(/\d+(\.\d+)?/);
  if (!match) {
    return null;
  }

  const numericScore = Number(match[0]);
  return Number.isNaN(numericScore) ? null : numericScore;
}

function getClientFacingServiceName_(service, score) {
  const value = String(service || '').trim();
  const normalized = value.toLowerCase();
  if (!value || normalized === 'website audit' || normalized === 'website and local visibility review') {
    const assessment = getDigitalPresenceAssessment_(score);
    if (assessment.score !== null && assessment.score >= 90) {
      return 'Growth & Optimization Review';
    }
    return 'Digital Visibility & Conversion Improvement Package';
  }
  return value;
}
