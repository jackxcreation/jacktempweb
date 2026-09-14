/**
 * Controlled Web Search (Stubbed safely for Production)
 * Enhanced with argument safety, strict query sanitization, and extensibility.
 */
const searchWeb = async (args = {}) => {
  if (!args.query || typeof args.query !== 'string') {
    return { error: 'Search query missing or invalid.' };
  }

  // SECURITY FIX: Strip dangerous characters to prevent URL parameter injection if live search is enabled
  const cleanQuery = args.query.trim().replace(/[^\w\s\.\-\?]/gi, '');
  
  if (!cleanQuery) {
    return { error: 'Search query cannot be empty or contain only invalid characters.' };
  }

  try {
    // If you have an external API key (like SerpAPI or Google Custom Search) and enable it:
    // if (process.env.SEARCH_API_KEY && process.env.ENABLE_LIVE_SEARCH === 'true') {
    //   const response = await fetch(`https://api.some-search.com?q=${encodeURIComponent(cleanQuery)}&key=${process.env.SEARCH_API_KEY}`);
    //   if (!response.ok) throw new Error('Search API returned an error status.');
    //   return { success: true, data: await response.json() };
    // }

    return {
      success: true,
      data: {
        query: cleanQuery,
        notice: "External web search is restricted. Please rely on internal knowledge base, FAQ, or escalate to a human.",
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('Web Search Tool Error:', error.message);
    return { error: 'Web search failed due to an internal server error.' };
  }
};

/**
 * Validates whether a search result payload returned the restriction notice.
 */
const isSearchRestricted = (toolResult) => {
  if (!toolResult || !toolResult.success || !toolResult.data) return false;
  return Boolean(toolResult.data.notice);
};

module.exports = { 
  searchWeb, 
  isSearchRestricted 
};