/**
 * Normalizes text for text-to-speech by removing unwanted elements
 * @param {string} text - The raw text to normalize
 * @returns {string} - Normalized text
 */
function normalizeText(text) {
  let normalized = text;

  // Remove URLs (http, https, www)
  normalized = normalized.replace(/https?:\/\/[^\s]+/g, '');
  normalized = normalized.replace(/www\.[^\s]+/g, '');

  // Remove "RT" (retweets)
  normalized = normalized.replace(/\bRT\b/g, '');

  // Remove @mentions
  normalized = normalized.replace(/@\w+/g, '');

  // Remove emojis (comprehensive regex for emoji removal)
  normalized = normalized.replace(/[\u{1F600}-\u{1F64F}]/gu, ''); // Emoticons
  normalized = normalized.replace(/[\u{1F300}-\u{1F5FF}]/gu, ''); // Misc Symbols and Pictographs
  normalized = normalized.replace(/[\u{1F680}-\u{1F6FF}]/gu, ''); // Transport and Map
  normalized = normalized.replace(/[\u{1F1E0}-\u{1F1FF}]/gu, ''); // Flags
  normalized = normalized.replace(/[\u{2600}-\u{26FF}]/gu, '');   // Misc symbols
  normalized = normalized.replace(/[\u{2700}-\u{27BF}]/gu, '');   // Dingbats
  normalized = normalized.replace(/[\u{FE00}-\u{FE0F}]/gu, '');   // Variation Selectors
  normalized = normalized.replace(/[\u{1F900}-\u{1F9FF}]/gu, ''); // Supplemental Symbols and Pictographs
  normalized = normalized.replace(/[\u{1FA70}-\u{1FAFF}]/gu, ''); // Symbols and Pictographs Extended-A
  normalized = normalized.replace(/[\u{E0020}-\u{E007F}]/gu, ''); // Tags
  
  // Remove multiple spaces
  normalized = normalized.replace(/\s+/g, ' ');

  // Add natural pauses (convert multiple newlines to periods for better TTS pauses)
  normalized = normalized.replace(/\n+/g, '. ');

  // Clean up punctuation
  normalized = normalized.replace(/\.\s*\./g, '.'); // Remove double periods
  normalized = normalized.replace(/\s+([.,!?])/g, '$1'); // Remove space before punctuation

  // Trim
  normalized = normalized.trim();

  return normalized;
}

module.exports = { normalizeText };
