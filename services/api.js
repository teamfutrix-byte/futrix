// Centralized FUTRIX API & Database Service Layer
window.FUTRIX_API = {
  // ── PROFILES ──
  async getProfile(userId) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) throw error;
    return data;
  },

  async updateProfile(userId, updates) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);
    if (error) throw error;
    return data;
  },

  // ── GOALS ──
  async getUserGoals(userId) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('user_goals')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error; // Allow empty
    return data;
  },

  async saveUserGoals(userId, goals) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('user_goals')
      .upsert({
        user_id: userId,
        ...goals
      }, { onConflict: 'user_id' });
    if (error) throw error;
    return data;
  },

  // ── CATEGORIES ──
  async getExamCategories() {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('exam_categories')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async addExamCategory(name, displayName, active = true) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('exam_categories')
      .insert([{ name, display_name: displayName, is_active: active }]);
    if (error) throw error;
    return data;
  },

  // ── TEST ATTEMPTS ──
  async getAttempts(userId) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('attempts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async insertAttempt(attempt) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('attempts')
      .insert([attempt]);
    if (error) throw error;
    return data;
  },

  // ── REVISION QUEUE & FLASHCARDS ──
  async getRevisionQueue(userId) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('revision_queue')
      .select(`
        *,
        flashcards (*)
      `)
      .eq('user_id', userId)
      .order('next_revision_at', { ascending: true });
    if (error) throw error;
    return data;
  },

  async getFlashcards(limitCount = 20) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('flashcards')
      .select('*')
      .limit(limitCount);
    if (error) throw error;
    return data;
  },

  async addRevisionQueueCard(card) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('revision_queue')
      .insert([card]);
    if (error) throw error;
    return data;
  },

  async updateRevisionCard(cardId, updates) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase
      .from('revision_queue')
      .update(updates)
      .eq('id', cardId);
    if (error) throw error;
    return data;
  },

  async rateRevisionCard(userId, cardId, currentScore, scheduleInterval, confidenceRating) {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    
    // Calculate new parameters based on confidence
    let multiplier = 1.0;
    if (confidenceRating === 'easy') multiplier = 2.0;
    if (confidenceRating === 'medium') multiplier = 1.2;
    if (confidenceRating === 'hard') multiplier = 0.5;

    const nextInterval = Math.max(1, Math.round(scheduleInterval * multiplier));
    const nextScore = Math.max(10, Math.min(100, Math.round(currentScore * multiplier)));
    const nextRevisionDate = new Date();
    nextRevisionDate.setDate(nextRevisionDate.getDate() + nextInterval);

    const { data, error } = await window.supabase
      .from('revision_queue')
      .update({
        retention_score: nextScore,
        interval_days: nextInterval,
        next_revision_at: nextRevisionDate.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId);

    if (error) throw error;
    return { data, nextInterval, nextScore };
  },

  // ── COMMUNITY STATIONS ──
  async getAllAttemptsSummary() {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase.from('attempts').select('correct_answers, wrong_answers');
    if (error) throw error;
    return data;
  },

  async getAllProfilesXp() {
    if (!window.supabase) throw new Error('Supabase client not loaded.');
    const { data, error } = await window.supabase.from('profiles').select('xp_balance');
    if (error) throw error;
    return data;
  }
};
