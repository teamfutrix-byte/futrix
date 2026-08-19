const { Client } = require('pg');

async function main() {
  const client = new Client({
    host: 'db.dsduytkikxfgiyptdwex.supabase.co',
    port: 5432,
    user: 'postgres',
    password: '$anjana@123man',
    database: 'postgres'
  });

  await client.connect();
  
  const { rows: wf } = await client.query("SELECT * FROM public.approval_workflow");
  const { rows: q } = await client.query("SELECT id, question_text, series_id FROM public.questions WHERE series_id = 'AI-GENERATED-POOL'");
  const { rows: ver } = await client.query("SELECT * FROM public.question_versions");

  console.log("--- APPROVAL WORKFLOWS ---");
  console.log(wf);
  console.log("--- QUESTIONS ---");
  console.log(q);
  console.log("--- QUESTION VERSIONS ---");
  console.log(ver);

  await client.end();
}

main();
