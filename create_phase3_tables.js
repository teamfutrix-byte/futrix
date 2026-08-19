const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL database.");

    // 1. Create public.flashcards
    console.log("Creating public.flashcards table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.flashcards (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        category text CHECK (category IN ('Physics', 'Chemistry', 'Biology')),
        type text CHECK (type IN ('formula', 'diagram', 'reaction', 'concept')),
        title text NOT NULL,
        front_content text NOT NULL,
        back_content text NOT NULL,
        image_url text,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    // 2. Create public.revision_queue
    console.log("Creating public.revision_queue table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.revision_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
        card_id uuid REFERENCES public.flashcards(id) ON DELETE CASCADE,
        wrong_question_id uuid,
        question_text text,
        correct_answer text,
        subject text,
        interval_day integer DEFAULT 1,
        next_revision_at timestamp with time zone DEFAULT (now() + interval '1 day'),
        revisions_completed integer DEFAULT 0,
        retention_score integer DEFAULT 100,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    // 3. Create public.user_goals
    console.log("Creating public.user_goals table...");
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_goals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE,
        target_exam text CHECK (target_exam IN ('NEET 2027', 'NEET 2028', 'JEE Main', 'JEE Advanced')),
        target_score integer,
        assessment_score integer,
        recommended_track text,
        badge_awarded boolean DEFAULT false,
        created_at timestamp with time zone DEFAULT now() NOT NULL
      )
    `);

    // Enable RLS
    console.log("Enabling RLS on tables...");
    await client.query(`
      ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.revision_queue ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;
    `);

    // Create RLS Policies
    console.log("Creating RLS policies...");
    await client.query(`
      DROP POLICY IF EXISTS "Allow read all for authenticated users" ON public.flashcards;
      CREATE POLICY "Allow read all for authenticated users" ON public.flashcards
        FOR SELECT TO authenticated USING (true);

      DROP POLICY IF EXISTS "Allow all for owner users" ON public.revision_queue;
      CREATE POLICY "Allow all for owner users" ON public.revision_queue
        FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

      DROP POLICY IF EXISTS "Allow all for owner users" ON public.user_goals;
      CREATE POLICY "Allow all for owner users" ON public.user_goals
        FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    `);

    // 4. Seed sample flashcards
    console.log("Seeding sample flashcards...");
    const { rows: existingCount } = await client.query('SELECT count(*) FROM public.flashcards');
    if (parseInt(existingCount[0].count) === 0) {
      await client.query(`
        INSERT INTO public.flashcards (category, type, title, front_content, back_content, image_url) VALUES
        ('Biology', 'concept', 'Mitosis Stages', 'What are the four main stages of Mitosis in sequence?', 'Prophase, Metaphase, Anaphase, Telophase (PMAT)', NULL),
        ('Biology', 'concept', 'DNA Replication Enzyme', 'Which enzyme is responsible for unwinding the double helix during DNA replication?', 'DNA Helicase', NULL),
        ('Physics', 'formula', 'Ideal Gas Law', 'State the Ideal Gas Law formula.', 'PV = nRT where P=Pressure, V=Volume, n=moles, R=constant, T=Temperature', NULL),
        ('Physics', 'concept', 'Snell Law of Refraction', 'What is Snell Law formula for optics?', 'n1 * sin(theta1) = n2 * sin(theta2)', NULL),
        ('Chemistry', 'reaction', 'Aldol Condensation', 'What are the primary reactants and products of Aldol Condensation?', 'Reactants: Aldehydes/Ketones with alpha-hydrogen in presence of dilute base. Product: beta-hydroxy aldehyde/ketone.', NULL),
        ('Chemistry', 'reaction', 'Wurtz Reaction', 'What is the product formed when alkyl halides react with sodium metal in dry ether?', 'Symmetrical alkanes containing twice the carbon atoms of the alkyl halide.', NULL),
        ('Biology', 'diagram', 'Cell Membrane Structure', 'Identify the main lipid component of the cell membrane diagram.', 'Phospholipids forming a bilayer with hydrophilic heads facing outwards.', NULL),
        ('Physics', 'formula', 'Coulomb Law', 'What is the mathematical equation for Coulomb Force?', 'F = k * (|q1 * q2| / r^2)', NULL),
        ('Chemistry', 'formula', 'Arrhenius Equation', 'What equation models the temperature dependency of reaction rates?', 'k = A * e^(-Ea / RT)', NULL),
        ('Biology', 'concept', 'Mendelian Ratio', 'What is the typical phenotypic ratio of a dihybrid cross?', '9:3:3:1', NULL)
      `);
      console.log("[✓] Pre-seeded 10 high-quality flashcards.");
    } else {
      console.log("Flashcards table already pre-seeded.");
    }

    console.log("\nDATABASE SCHEMA MIGRATION COMPLETED SUCCESSFULLY!");

  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await client.end();
  }
}

main();
