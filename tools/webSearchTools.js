/**
 * Controlled Web Search (Stubbed safely for Production)
 * If you integrate Google Custom Search API, the fetch call goes here.
 * Currently returns a controlled message to ensure AI relies on internal data first.
 */
const searchWeb = async (args) => {
  if (!args.query) return { error: 'Search query missing.' };

  try {
    // If you have an external API key (like SerpAPI or Google Search):
    // const response = await fetch(`https://api.some-search.com?q=${args.query}&key=${process.env.SEARCH_KEY}`);
    // return await response.json();

    return {
      success: true,
      data: {
        notice: "External web search is restricted. Please rely on internal knowledge base or escalate to a human."
      }
    };
  } catch (error) {
    return { error: 'Web search failed.' };
  }
};

module.exports = { searchWeb };