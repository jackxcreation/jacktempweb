const SupportKnowledge = require('../../models/SupportKnowledge');

const searchKnowledgeBase = async (query) => {
  if (!query) return [];
  
  try {
    const results = await SupportKnowledge.find(
      { $text: { $search: query }, status: 'PUBLISHED' },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(3)
    .select('title content category');

    return results;
  } catch (error) {
    console.error('Knowledge Service Error:', error);
    return [];
  }
};

module.exports = { searchKnowledgeBase };