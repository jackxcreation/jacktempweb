const SupportKnowledge = require('../models/SupportKnowledge');

/**
 * Searches the FAQ/Knowledge base.
 * Enhanced with a robust regex fallback if the text index is missing, and strict regex escaping.
 */
const searchFAQ = async (args) => {
  if (!args || !args.query || typeof args.query !== 'string') {
    return { error: 'Search query is required.' };
  }

  const cleanQuery = args.query.trim();
  if (!cleanQuery) return { error: 'Search query cannot be empty.' };

  try {
    // Attempt primary MongoDB text search
    // 🔥 MEMORY FIX: Added .lean() to prevent memory bloat
    const results = await SupportKnowledge.find(
      { $text: { $search: cleanQuery }, status: 'PUBLISHED' },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(3)
    .select('title content')
    .lean();

    if (results.length === 0) {
      return { success: true, data: { message: 'No relevant FAQ found for this query.' } };
    }

    return {
      success: true,
      data: {
        articles: results.map(r => ({ title: r.title, content: r.content }))
      }
    };
  } catch (error) {
    console.warn('⚠️ FAQ Text search index missing or failed, falling back to regex search.');
    
    try {
      // 🔥 SECURITY FIX: Safely escape special characters to prevent Regex crashes/ReDoS attacks
      const escapedQuery = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 🔥 MEMORY FIX: Added .lean() to fallback query as well
      const regexResults = await SupportKnowledge.find({
        status: 'PUBLISHED',
        $or: [
          { title: { $regex: escapedQuery, $options: 'i' } },
          { content: { $regex: escapedQuery, $options: 'i' } }
        ]
      })
      .limit(3)
      .select('title content')
      .lean();

      if (regexResults.length === 0) {
        return { success: true, data: { message: 'No relevant FAQ found for this query.' } };
      }

      return {
        success: true,
        data: {
          articles: regexResults.map(r => ({ title: r.title, content: r.content }))
        }
      };
    } catch (fallbackErr) {
      console.error('FAQ Tool Error (Fallback failed):', fallbackErr.message);
      return { error: 'Database search failed.' };
    }
  }
};

module.exports = { searchFAQ };