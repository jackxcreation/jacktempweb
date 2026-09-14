const SupportKnowledge = require('../../models/SupportKnowledge');

/**
 * Searches the knowledge base using MongoDB text search with a robust regex fallback.
 */
const searchKnowledgeBase = async (query) => {
  if (!query || typeof query !== 'string') return [];
  
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];
  
  try {
    // Attempt primary MongoDB text search
    const results = await SupportKnowledge.find(
      { $text: { $search: cleanQuery }, status: 'PUBLISHED' },
      { score: { $meta: 'textScore' } }
    )
    .sort({ score: { $meta: 'textScore' } })
    .limit(3)
    .select('title content category');

    return results;
  } catch (error) {
    console.warn('⚠️ Text search index missing or failed, falling back to regex search:', error.message);
    
    try {
      // 🔥 FIX: Fallback regex search if text index isn't set up on the collection yet
      const regexResults = await SupportKnowledge.find({
        status: 'PUBLISHED',
        $or: [
          { title: { $regex: cleanQuery, $options: 'i' } },
          { content: { $regex: cleanQuery, $options: 'i' } }
        ]
      })
      .limit(3)
      .select('title content category');

      return regexResults;
    } catch (fallbackErr) {
      console.error('Knowledge Service Error (Fallback failed):', fallbackErr);
      return [];
    }
  }
};

module.exports = { searchKnowledgeBase };