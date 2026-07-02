/**
 * Rogers Holdings OS - WebsiteFetchEngine.
 * Fetches and normalizes website HTML into a reusable WebsiteDocument object.
 *
 * This module is intentionally not wired into production audit, PDF, Gmail,
 * Drive, dashboard, menu, branding, or scoring workflows.
 */

function fetchWebsiteDocument(url, options) {
  const startedAt = new Date();
  const config = normalizeWebsiteFetchOptions_(url, options || {});
  const document = createEmptyWebsiteDocument_(config.originalUrl, startedAt);

  if (!config.originalUrl) {
    document.fetchStatus = 'Failed';
    document.errors.push('Website URL is required.');
    document.executionMetadata.completedAt = new Date();
    document.executionMetadata.durationMs = document.executionMetadata.completedAt.getTime() - startedAt.getTime();
    return document;
  }

  try {
    const fetchResult = fetchWebsiteHtmlWithRedirects_(config);
    document.finalUrl = fetchResult.finalUrl || config.originalUrl;
    document.fetchStatus = fetchResult.success ? 'Success' : 'Failed';
    document.statusCode = fetchResult.statusCode;
    document.rawHtml = fetchResult.rawHtml || '';
    document.warnings = document.warnings.concat(fetchResult.warnings || []);
    document.errors = document.errors.concat(fetchResult.errors || []);
    document.executionMetadata.redirects = fetchResult.redirects || [];
    document.executionMetadata.fetchAttempts = fetchResult.attempts || 0;

    if (document.rawHtml) {
      populateWebsiteDocumentFromHtml_(document, document.rawHtml, document.finalUrl);
    } else if (!document.errors.length) {
      document.warnings.push('No HTML body was returned from the website fetch.');
    }
  } catch (error) {
    document.fetchStatus = 'Failed';
    document.errors.push(error && error.message ? error.message : String(error));
  }

  document.executionMetadata.completedAt = new Date();
  document.executionMetadata.durationMs = document.executionMetadata.completedAt.getTime() - startedAt.getTime();
  document.executionMetadata.rawHtmlLength = document.rawHtml.length;
  document.executionMetadata.visibleTextLength = document.visibleText.length;
  return document;
}

function normalizeWebsiteFetchOptions_(url, options) {
  const data = options || {};
  const originalUrl = normalizeWebsiteFetchUrl_(url || data.url || data.website || '');
  return {
    originalUrl: originalUrl,
    maxRedirects: Math.max(0, Math.min(Number(data.maxRedirects || 5), 10)),
    timeoutMs: Number(data.timeoutMs || 20000),
    userAgent: data.userAgent || 'RogersHoldingsOS/1.0 WebsiteFetchEngine',
    muteHttpExceptions: data.muteHttpExceptions === undefined ? true : data.muteHttpExceptions !== false
  };
}

function createEmptyWebsiteDocument_(originalUrl, startedAt) {
  return {
    objectType: 'WebsiteDocument',
    version: '1.0',
    originalUrl: originalUrl || '',
    finalUrl: originalUrl || '',
    fetchStatus: 'Pending',
    statusCode: null,
    fetchedAt: startedAt || new Date(),
    rawHtml: '',
    visibleText: '',
    pageTitle: '',
    metaDescription: '',
    headings: [],
    links: [],
    navigationLinks: [],
    footerLinks: [],
    images: [],
    buttons: [],
    forms: [],
    phoneNumbers: [],
    emails: [],
    possibleAddresses: [],
    scripts: [],
    stylesheets: [],
    warnings: [],
    errors: [],
    executionMetadata: {
      engine: 'WebsiteFetchEngine',
      version: '1.0',
      startedAt: startedAt || new Date(),
      completedAt: null,
      durationMs: 0,
      redirects: [],
      fetchAttempts: 0,
      rawHtmlLength: 0,
      visibleTextLength: 0
    }
  };
}

function fetchWebsiteHtmlWithRedirects_(config) {
  let currentUrl = config.originalUrl;
  const redirects = [];
  const warnings = [];
  const errors = [];
  let response = null;
  let statusCode = null;
  let rawHtml = '';
  let attempts = 0;

  for (let redirectIndex = 0; redirectIndex <= config.maxRedirects; redirectIndex++) {
    attempts++;
    response = UrlFetchApp.fetch(currentUrl, {
      method: 'get',
      followRedirects: false,
      muteHttpExceptions: config.muteHttpExceptions,
      validateHttpsCertificates: true,
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    statusCode = response.getResponseCode();

    if (statusCode >= 300 && statusCode < 400) {
      const location = getWebsiteFetchHeader_(response, 'Location');
      if (!location) {
        warnings.push('Redirect response did not include a Location header.');
        break;
      }
      const nextUrl = resolveWebsiteUrl_(currentUrl, location);
      redirects.push({
        from: currentUrl,
        to: nextUrl,
        statusCode: statusCode
      });
      currentUrl = nextUrl;
      continue;
    }

    rawHtml = response.getContentText() || '';
    break;
  }

  if (redirects.length > config.maxRedirects) {
    warnings.push('Maximum redirect count reached.');
  }

  if (statusCode === null) {
    errors.push('No HTTP response was received.');
  } else if (statusCode >= 400) {
    errors.push('Website fetch returned HTTP ' + statusCode + '.');
  }

  return {
    success: statusCode !== null && statusCode < 400 && !!rawHtml,
    statusCode: statusCode,
    finalUrl: currentUrl,
    rawHtml: rawHtml,
    redirects: redirects,
    warnings: warnings,
    errors: errors,
    attempts: attempts
  };
}

function populateWebsiteDocumentFromHtml_(document, html, baseUrl) {
  document.pageTitle = extractWebsitePageTitle_(html);
  document.metaDescription = extractWebsiteMetaDescription_(html);
  document.scripts = extractWebsiteScripts_(html, baseUrl);
  document.stylesheets = extractWebsiteStylesheets_(html, baseUrl);
  document.headings = extractWebsiteHeadings_(html);
  document.links = extractWebsiteLinks_(html, baseUrl);
  document.navigationLinks = extractWebsiteScopedLinks_(html, baseUrl, 'nav');
  document.footerLinks = extractWebsiteScopedLinks_(html, baseUrl, 'footer');
  document.images = extractWebsiteImages_(html, baseUrl);
  document.buttons = extractWebsiteButtons_(html);
  document.forms = extractWebsiteForms_(html, baseUrl);
  document.visibleText = extractWebsiteVisibleText_(html);
  document.phoneNumbers = extractWebsitePhoneNumbers_(document.visibleText + ' ' + html);
  document.emails = extractWebsiteEmails_(document.visibleText + ' ' + html);
  document.possibleAddresses = extractWebsitePossibleAddresses_(document.visibleText);

  if (!document.pageTitle) {
    document.warnings.push('Page title was not detected.');
  }
  if (!document.metaDescription) {
    document.warnings.push('Meta description was not detected.');
  }
}

function normalizeWebsiteFetchUrl_(url) {
  const value = String(url || '').trim();
  if (!value) {
    return '';
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  return 'https://' + value;
}

function getWebsiteFetchHeader_(response, headerName) {
  const headers = response.getAllHeaders ? response.getAllHeaders() : response.getHeaders();
  const target = String(headerName || '').toLowerCase();
  const keys = Object.keys(headers || {});
  for (let index = 0; index < keys.length; index++) {
    if (keys[index].toLowerCase() === target) {
      const value = headers[keys[index]];
      return Array.isArray(value) ? value[0] : value;
    }
  }
  return '';
}

function resolveWebsiteUrl_(baseUrl, nextUrl) {
  const target = String(nextUrl || '').trim();
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  const base = String(baseUrl || '');
  const protocolMatch = base.match(/^(https?:)\/\//i);
  const protocol = protocolMatch ? protocolMatch[1] : 'https:';
  const hostMatch = base.match(/^https?:\/\/([^\/?#]+)/i);
  const host = hostMatch ? hostMatch[1] : '';
  if (target.indexOf('//') === 0) {
    return protocol + target;
  }
  if (target.indexOf('/') === 0) {
    return protocol + '//' + host + target;
  }
  const basePath = base.replace(/[?#].*$/, '').replace(/\/[^\/]*$/, '/');
  return basePath + target;
}

function extractWebsitePageTitle_(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? decodeWebsiteHtmlEntities_(stripWebsiteTags_(match[1])).trim() : '';
}

function extractWebsiteMetaDescription_(html) {
  const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
  for (let index = 0; index < tags.length; index++) {
    const tag = tags[index];
    const name = getWebsiteTagAttribute_(tag, 'name') || getWebsiteTagAttribute_(tag, 'property');
    if (String(name || '').toLowerCase() === 'description' || String(name || '').toLowerCase() === 'og:description') {
      return decodeWebsiteHtmlEntities_(getWebsiteTagAttribute_(tag, 'content')).trim();
    }
  }
  return '';
}

function extractWebsiteHeadings_(html) {
  const headings = [];
  const pattern = /<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    headings.push({
      level: 'h' + match[1],
      text: decodeWebsiteHtmlEntities_(stripWebsiteTags_(match[3])).trim(),
      id: getWebsiteTagAttribute_(match[2], 'id'),
      className: getWebsiteTagAttribute_(match[2], 'class')
    });
  }
  return headings.filter(function(heading) {
    return heading.text;
  }).slice(0, 80);
}

function extractWebsiteLinks_(html, baseUrl) {
  const links = [];
  const pattern = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    const href = getWebsiteTagAttribute_(match[1], 'href');
    const text = decodeWebsiteHtmlEntities_(stripWebsiteTags_(match[2])).trim();
    if (!href && !text) {
      continue;
    }
    links.push({
      text: text,
      href: href || '',
      url: href ? resolveWebsiteUrl_(baseUrl, href) : '',
      title: getWebsiteTagAttribute_(match[1], 'title'),
      target: getWebsiteTagAttribute_(match[1], 'target'),
      rel: getWebsiteTagAttribute_(match[1], 'rel')
    });
  }
  return links.slice(0, 250);
}

function extractWebsiteScopedLinks_(html, baseUrl, tagName) {
  const scopes = extractWebsiteTagBlocks_(html, tagName);
  let links = [];
  scopes.forEach(function(scopeHtml) {
    links = links.concat(extractWebsiteLinks_(scopeHtml, baseUrl));
  });
  return links.slice(0, 120);
}

function extractWebsiteImages_(html, baseUrl) {
  const images = [];
  const pattern = /<img\b([^>]*)>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    const src = getWebsiteTagAttribute_(match[1], 'src') || getWebsiteTagAttribute_(match[1], 'data-src');
    images.push({
      src: src || '',
      url: src ? resolveWebsiteUrl_(baseUrl, src) : '',
      alt: getWebsiteTagAttribute_(match[1], 'alt'),
      title: getWebsiteTagAttribute_(match[1], 'title'),
      width: getWebsiteTagAttribute_(match[1], 'width'),
      height: getWebsiteTagAttribute_(match[1], 'height'),
      className: getWebsiteTagAttribute_(match[1], 'class'),
      id: getWebsiteTagAttribute_(match[1], 'id')
    });
  }
  return images.slice(0, 200);
}

function extractWebsiteButtons_(html) {
  const buttons = [];
  const buttonPattern = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let match;
  while ((match = buttonPattern.exec(String(html || ''))) !== null) {
    buttons.push({
      text: decodeWebsiteHtmlEntities_(stripWebsiteTags_(match[2])).trim(),
      type: getWebsiteTagAttribute_(match[1], 'type'),
      className: getWebsiteTagAttribute_(match[1], 'class'),
      id: getWebsiteTagAttribute_(match[1], 'id')
    });
  }

  const inputPattern = /<input\b([^>]*)>/gi;
  while ((match = inputPattern.exec(String(html || ''))) !== null) {
    const type = String(getWebsiteTagAttribute_(match[1], 'type') || '').toLowerCase();
    if (type === 'submit' || type === 'button') {
      buttons.push({
        text: getWebsiteTagAttribute_(match[1], 'value'),
        type: type,
        className: getWebsiteTagAttribute_(match[1], 'class'),
        id: getWebsiteTagAttribute_(match[1], 'id')
      });
    }
  }

  return buttons.filter(function(button) {
    return button.text || button.type;
  }).slice(0, 100);
}

function extractWebsiteForms_(html, baseUrl) {
  const forms = [];
  const pattern = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    const fields = [];
    const fieldPattern = /<(input|textarea|select)\b([^>]*)>/gi;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(match[2])) !== null) {
      fields.push({
        tag: fieldMatch[1].toLowerCase(),
        type: getWebsiteTagAttribute_(fieldMatch[2], 'type'),
        name: getWebsiteTagAttribute_(fieldMatch[2], 'name'),
        id: getWebsiteTagAttribute_(fieldMatch[2], 'id'),
        placeholder: getWebsiteTagAttribute_(fieldMatch[2], 'placeholder'),
        label: getWebsiteTagAttribute_(fieldMatch[2], 'aria-label')
      });
    }
    const action = getWebsiteTagAttribute_(match[1], 'action');
    forms.push({
      action: action || '',
      url: action ? resolveWebsiteUrl_(baseUrl, action) : '',
      method: getWebsiteTagAttribute_(match[1], 'method') || 'get',
      id: getWebsiteTagAttribute_(match[1], 'id'),
      name: getWebsiteTagAttribute_(match[1], 'name'),
      className: getWebsiteTagAttribute_(match[1], 'class'),
      text: decodeWebsiteHtmlEntities_(stripWebsiteTags_(match[2])).trim().slice(0, 500),
      fields: fields
    });
  }
  return forms.slice(0, 50);
}

function extractWebsiteScripts_(html, baseUrl) {
  const scripts = [];
  const pattern = /<script\b([^>]*)>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    const src = getWebsiteTagAttribute_(match[1], 'src');
    scripts.push({
      src: src || '',
      url: src ? resolveWebsiteUrl_(baseUrl, src) : '',
      type: getWebsiteTagAttribute_(match[1], 'type'),
      async: /\sasync(\s|=|>)/i.test(match[1]),
      defer: /\sdefer(\s|=|>)/i.test(match[1])
    });
  }
  return scripts.slice(0, 150);
}

function extractWebsiteStylesheets_(html, baseUrl) {
  const stylesheets = [];
  const pattern = /<link\b([^>]*)>/gi;
  let match;
  while ((match = pattern.exec(String(html || ''))) !== null) {
    const rel = getWebsiteTagAttribute_(match[1], 'rel');
    const href = getWebsiteTagAttribute_(match[1], 'href');
    if (String(rel || '').toLowerCase().indexOf('stylesheet') === -1 && !/\.css(?:\?|$)/i.test(href)) {
      continue;
    }
    stylesheets.push({
      href: href || '',
      url: href ? resolveWebsiteUrl_(baseUrl, href) : '',
      rel: rel,
      media: getWebsiteTagAttribute_(match[1], 'media')
    });
  }
  return stylesheets.slice(0, 100);
}

function extractWebsiteVisibleText_(html) {
  return decodeWebsiteHtmlEntities_(
    String(html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function extractWebsitePhoneNumbers_(text) {
  const matches = String(text || '').match(/(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/g) || [];
  const seen = {};
  return matches.map(function(match) {
    return match.replace(/\s+/g, ' ').trim();
  }).filter(function(match) {
    const key = match.replace(/\D/g, '');
    if (key.length < 10 || seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  }).slice(0, 50);
}

function extractWebsiteEmails_(text) {
  const matches = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const seen = {};
  return matches.filter(function(match) {
    const key = match.toLowerCase();
    if (seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  }).slice(0, 50);
}

function extractWebsitePossibleAddresses_(text) {
  const matches = String(text || '').match(/\b\d{2,6}\s+[A-Za-z0-9.' -]+\s+(?:Street|St\.?|Avenue|Ave\.?|Road|Rd\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Lane|Ln\.?|Court|Ct\.?|Way|Highway|Hwy\.?|Suite|Ste\.?)\b(?:\s*[A-Za-z .'-]+)?/gi) || [];
  const seen = {};
  return matches.map(function(match) {
    return match.replace(/\s+/g, ' ').trim();
  }).filter(function(match) {
    const key = match.toLowerCase();
    if (seen[key]) {
      return false;
    }
    seen[key] = true;
    return true;
  }).slice(0, 30);
}

function extractWebsiteTagBlocks_(html, tagName) {
  const blocks = [];
  const pattern = new RegExp('<' + tagName + '\\b[^>]*>[\\s\\S]*?<\\/' + tagName + '>', 'gi');
  const matches = String(html || '').match(pattern) || [];
  matches.forEach(function(match) {
    blocks.push(match);
  });
  return blocks;
}

function getWebsiteTagAttribute_(tagText, attributeName) {
  const value = String(tagText || '');
  const name = String(attributeName || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const doubleQuote = new RegExp(name + '\\s*=\\s*"([^"]*)"', 'i').exec(value);
  if (doubleQuote) {
    return decodeWebsiteHtmlEntities_(doubleQuote[1]);
  }
  const singleQuote = new RegExp(name + "\\s*=\\s*'([^']*)'", 'i').exec(value);
  if (singleQuote) {
    return decodeWebsiteHtmlEntities_(singleQuote[1]);
  }
  const unquoted = new RegExp(name + '\\s*=\\s*([^\\s>]+)', 'i').exec(value);
  return unquoted ? decodeWebsiteHtmlEntities_(unquoted[1]) : '';
}

function stripWebsiteTags_(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

function decodeWebsiteHtmlEntities_(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, function(match, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&#x([0-9a-f]+);/gi, function(match, code) {
      return String.fromCharCode(parseInt(code, 16));
    });
}
