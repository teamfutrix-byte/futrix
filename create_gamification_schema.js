const { Client } = require('pg');

const dbConfig = {
  host: 'db.dsduytkikxfgiyptdwex.supabase.co',
  port: 5432,
  user: 'postgres',
  password: '$anjana@123man',
  database: 'postgres'
};

async function migrate() {
  console.log("Starting Gamification Platform DB Migrations...");
  const client = new Client(dbConfig);
  await client.connect();

  try {
    // 1. Create xp_rules
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.xp_rules (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        xp_amount INT NOT NULL,
        multiplier NUMERIC DEFAULT 1.0,
        cooldown_seconds INT DEFAULT 0,
        daily_limit INT DEFAULT 0,
        active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log("- Table 'xp_rules' created.");

    // 2. Create levels
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.levels (
        level_number INT PRIMARY KEY,
        xp_requirement INT NOT NULL,
        badge VARCHAR,
        coin_reward INT DEFAULT 0,
        unlocked_privileges TEXT
      )
    `);
    console.log("- Table 'levels' created.");

    // 3. Create store_items
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.store_items (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        category VARCHAR NOT NULL,
        price_coins INT NOT NULL,
        active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log("- Table 'store_items' created.");

    // 4. Create store_purchases
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.store_purchases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id UUID NOT NULL,
        item_id VARCHAR NOT NULL REFERENCES public.store_items(id),
        price_paid INT NOT NULL,
        purchased_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log("- Table 'store_purchases' created.");

    // 5. Create achievements
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.achievements (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        category VARCHAR,
        difficulty VARCHAR,
        xp_reward INT NOT NULL,
        coin_reward INT NOT NULL,
        badge VARCHAR,
        requirements_json JSONB,
        active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log("- Table 'achievements' created.");

    // 6. Create student_achievements
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.student_achievements (
        student_id UUID NOT NULL,
        achievement_id VARCHAR NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
        unlocked_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (student_id, achievement_id)
      )
    `);
    console.log("- Table 'student_achievements' created.");

    // 7. Create missions
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.missions (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        description TEXT,
        mission_type VARCHAR NOT NULL,
        xp_reward INT NOT NULL,
        coin_reward INT NOT NULL,
        target_count INT NOT NULL,
        action_key VARCHAR NOT NULL,
        active BOOLEAN DEFAULT TRUE
      )
    `);
    console.log("- Table 'missions' created.");

    // 8. Create student_missions
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.student_missions (
        student_id UUID NOT NULL,
        mission_id VARCHAR NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
        date DATE DEFAULT CURRENT_DATE,
        current_count INT DEFAULT 0,
        completed BOOLEAN DEFAULT FALSE,
        PRIMARY KEY (student_id, mission_id, date)
      )
    `);
    console.log("- Table 'student_missions' created.");

    // 9. Create leagues
    await client.query(`
      DROP TABLE IF EXISTS public.gamification_profiles CASCADE;
      DROP TABLE IF EXISTS public.leagues CASCADE;
      CREATE TABLE public.leagues (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        division INT NOT NULL,
        entry_xp INT NOT NULL,
        promotion_rules TEXT,
        demotion_rules TEXT,
        season_rewards_coins INT DEFAULT 0
      )
    `);
    console.log("- Table 'leagues' created.");

    // 10. Create gamification_profiles
    await client.query(`
      CREATE TABLE public.gamification_profiles (
        student_id UUID PRIMARY KEY,
        coins INT DEFAULT 0,
        energy INT DEFAULT 100,
        lives INT DEFAULT 5,
        current_streak INT DEFAULT 0,
        longest_streak INT DEFAULT 0,
        current_league_id VARCHAR DEFAULT 'league_beginner' REFERENCES public.leagues(id),
        last_active_date DATE DEFAULT CURRENT_DATE
      )
    `);
    console.log("- Table 'gamification_profiles' created.");

    // --- SEED DEFAULT GAMIFICATION METADATA ---
    console.log("Seeding levels, xp_rules, store_items, achievements, missions, leagues...");

    // Seed XP Rules
    await client.query(`
      INSERT INTO public.xp_rules (id, name, description, xp_amount, multiplier, cooldown_seconds, daily_limit)
      VALUES
        ('question_correct', 'Correct Question Solve', 'Earn XP for selecting correct conceptual options.', 10, 1.0, 0, 500),
        ('question_incorrect', 'Incorrect Question Solve Attempt', 'Learn from mistakes with small participation XP awards.', 2, 1.0, 0, 100),
        ('mock_test_completion', 'Mock Exam Paper Completed', 'Complete standard 3-hour exam test series.', 100, 1.0, 0, 1000),
        ('perfect_score', 'Perfect Mock Score', 'Achieve 100% correct answers in practice mock series.', 150, 1.0, 0, 1500),
        ('daily_login', 'Daily Habit Check-in', 'Keep the learning habit consistent.', 20, 1.0, 86400, 20),
        ('revision', 'Flashcard Deck Reviewed', 'Completed revision scheduled decay interval sets.', 30, 1.0, 0, 300),
        ('ai_tutor_session', 'AI Mentor Conversation Doubt Cleared', 'Engage in academic mentor conversations.', 15, 1.0, 0, 150)
      ON CONFLICT (id) DO UPDATE SET xp_amount = EXCLUDED.xp_amount;
    `);

    // Seed Levels
    for (let i = 1; i <= 50; i++) {
      const xpReq = 100 * Math.pow(i - 1, 2);
      const coinReward = i * 50;
      const badge = i >= 40 ? 'Grandmaster' : i >= 25 ? 'Expert' : i >= 10 ? 'Aspirant' : 'Novice';
      await client.query(`
        INSERT INTO public.levels (level_number, xp_requirement, badge, coin_reward, unlocked_privileges)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (level_number) DO UPDATE SET xp_requirement = EXCLUDED.xp_requirement;
      `, [i, xpReq, `${badge} Lvl ${i}`, coinReward, `Level ${i} avatar border unlock`]);
    }

    // Seed Store Items
    await client.query(`
      INSERT INTO public.store_items (id, name, category, price_coins)
      VALUES
        ('cosmetic_gold_frame', 'Shiny Golden Avatar Frame', 'Cosmetic', 300),
        ('cosmetic_neon_theme', 'Cyberpunk Neon App Theme', 'Cosmetic', 600),
        ('powerup_streak_freeze', 'Daily Streak Freeze Token', 'Power-up', 150),
        ('powerup_lives_refill', 'Instant Hearts Life Refill (+5 Lives)', 'Power-up', 100),
        ('powerup_energy_boost', 'Double Energy Refuel Drink', 'Power-up', 50)
      ON CONFLICT (id) DO UPDATE SET price_coins = EXCLUDED.price_coins;
    `);

    // Seed Achievements
    await client.query(`
      INSERT INTO public.achievements (id, name, description, category, difficulty, xp_reward, coin_reward, badge, requirements_json)
      VALUES
        ('streak_3_days', 'Sustained Momentum', 'Solve questions consistently for 3 straight days.', 'Consistency', 'Bronze', 50, 100, 'Consistency Badge', '{"streak_days":3}'),
        ('accuracy_master_10', 'Precision Striker', 'Complete 10 correct question answers in the system.', 'Accuracy', 'Silver', 150, 300, 'Precision Badge', '{"correct_solves":10}'),
        ('ai_explorer_3', 'Doubt Crusher', 'Conduct 3 dynamic doubt sessions with the AI Mentor.', 'AI Usage', 'Bronze', 30, 60, 'AI Explorer Badge', '{"ai_sessions":3}'),
        ('perfect_mock_1', 'Summit Climber', 'Achieve a 100% perfect score in any mock exam paper.', 'Mock Tests', 'Legendary', 500, 1000, 'Perfect Score Badge', '{"perfect_mocks":1}')
      ON CONFLICT (id) DO UPDATE SET xp_reward = EXCLUDED.xp_reward, coin_reward = EXCLUDED.coin_reward;
    `);

    // Seed Missions
    await client.query(`
      INSERT INTO public.missions (id, name, description, mission_type, xp_reward, coin_reward, target_count, action_key)
      VALUES
        ('mission_daily_solve', 'Daily Practice Drill', 'Solve 5 practice question items.', 'Daily', 30, 60, 5, 'solve_question'),
        ('mission_daily_ai', 'AI Consultation Habit', 'Ask AI Mentor 2 conceptual doubts.', 'Daily', 20, 40, 2, 'use_ai'),
        ('mission_weekly_mock', 'Weekly Mock Assessment Marathon', 'Complete 2 full mock exams.', 'Weekly', 150, 300, 2, 'complete_mock')
      ON CONFLICT (id) DO UPDATE SET xp_reward = EXCLUDED.xp_reward, coin_reward = EXCLUDED.coin_reward;
    `);

    // Seed Leagues
    await client.query(`
      INSERT INTO public.leagues (id, name, division, entry_xp, promotion_rules, demotion_rules, season_rewards_coins)
      VALUES
        ('league_beginner', 'Beginner Training Camp', 1, 0, 'Top 50% enter Bronze League', 'No demotion', 100),
        ('league_bronze', 'Bronze Contenders Division', 2, 500, 'Top 30% enter Silver League', 'Bottom 20% demote to Beginner', 250),
        ('league_silver', 'Silver Scholar Assembly', 3, 1500, 'Top 25% enter Gold League', 'Bottom 15% demote to Bronze', 500),
        ('league_gold', 'Gold Honors League', 4, 4000, 'Top 20% enter Platinum League', 'Bottom 10% demote to Silver', 1000),
        ('league_platinum', 'Platinum Champion League', 5, 10000, 'Top 10% enter Legend League', 'Bottom 10% demote to Gold', 2500),
        ('league_legend', 'Legendary Hall of Fame', 6, 25000, 'Highest Rank Honors', 'Bottom 5% demote to Platinum', 5000)
      ON CONFLICT (id) DO UPDATE SET entry_xp = EXCLUDED.entry_xp;
    `);

    console.log("Seeding complete. Gamification schema migrations finished.");

  } catch (err) {
    console.error("Gamification migration failed:", err);
    throw err;
  } finally {
    await client.end();
  }
}

migrate();
