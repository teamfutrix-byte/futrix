/**
 * FUTRIX Quality Scoring Engine
 */
function calculateQualityScore(question, validation) {
  let score = 0;
  const details = {};

  const qText = question.question_text || '';
  const options = question.options || {
    A: question.option_a,
    B: question.option_b,
    C: question.option_c,
    D: question.option_d
  };

  // 1. Academic & Curriculum Validation (Weight: 20 points)
  if (validation.curriculum && validation.curriculum.success) {
    details.academic = 20;
  } else {
    details.academic = 5;
  }

  // 2. LaTeX and Symbol Formatting (Weight: 15 points)
  if (validation.latex && validation.latex.success) {
    details.latex = 15;
  } else {
    details.latex = 0;
  }

  // 3. Option Symmetry and Distractor Traps (Weight: 15 points)
  if (validation.options && validation.options.success) {
    // Check option lengths balance
    const lengths = [options.A || '', options.B || '', options.C || '', options.D || ''].map(o => o.length);
    const maxLen = Math.max(...lengths);
    const minLen = Math.min(...lengths);
    const ratio = minLen > 0 ? maxLen / minLen : 10;
    
    if (ratio < 2.0) {
      details.options = 15; // highly balanced
    } else if (ratio < 4.0) {
      details.options = 12; // moderately balanced
    } else {
      details.options = 8; // skewed length
    }
  } else {
    details.options = 0;
  }

  // 4. Double-Solve / Factual Correctness (Weight: 25 points)
  if (validation.calculation && validation.calculation.success) {
    details.calculation = 25;
  } else {
    details.calculation = 0;
  }

  // 5. Uniqueness & Jaccard check (Weight: 15 points)
  if (validation.duplicates && validation.duplicates.success) {
    details.uniqueness = 15;
  } else {
    details.uniqueness = 0;
  }

  // 6. Language Quality & Readability (Weight: 10 points)
  if (validation.safety && validation.safety.success) {
    // Simple Flesch-Kincaid / reading ease approximation locally:
    const wordCount = qText.split(/\s+/).filter(Boolean).length;
    const sentenceCount = qText.split(/[.!?]+/).filter(Boolean).length;
    const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
    
    if (avgSentenceLength >= 8 && avgSentenceLength <= 25) {
      details.readability = 10; // optimal readability
    } else {
      details.readability = 7; // slightly wordy or overly terse
    }
  } else {
    details.readability = 0;
  }

  // Calculate sum of weights
  const totalScore = details.academic + details.latex + details.options + details.calculation + details.uniqueness + details.readability;
  
  let qualityTier = 'Reject';
  if (totalScore >= 90) {
    qualityTier = 'Production Ready';
  } else if (totalScore >= 80) {
    qualityTier = 'Minor Review';
  } else if (totalScore >= 60) {
    qualityTier = 'Requires Revision';
  }

  return {
    overallScore: totalScore,
    qualityTier,
    details
  };
}

module.exports = {
  calculateQualityScore
};
