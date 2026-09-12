const SupportKnowledge = require('../models/SupportKnowledge');

const searchFAQ = async (args) => {
  if (!args.query) return { error: 'Search query is required.' };

  try {
    const results = await SupportKnowledge.find(
      { $text: { $search: args.query }, status: 'PUBLISHED' },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(3)
    .select('title content');

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
    return { error: 'Database search failed.' };
  }
};

module.exports = { searchFAQ };