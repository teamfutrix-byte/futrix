// Supabase Edge Function: gemini-mentor/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Parse Authorization header to identify user
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace('Bearer ', '')
    let user = null
    let userRole = 'student'

    if (token) {
      const { data: { user: authUser } } = await supabaseClient.auth.getUser(token)
      if (authUser) {
        user = authUser
        // Fetch role from profile
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()
        if (profile) {
          userRole = profile.role
        }
      }
    }

    const { query } = await req.json()
    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // ── KNOWLEDGE RESTRICTION FILTER ──
    const promptLower = query.toLowerCase().trim()

    // Topics to block
    const blockedTopics = [
      'politic', 'religion', 'entertainment', 'movie', 'actor', 'song', 'music', 'game', 
      'coding', 'program', 'python', 'javascript', 'html', 'css', 'coding help', 'code error',
      'legal', 'court', 'lawyer', 'medical advice', 'doctor prescription', 'disease treatment',
      'hello', 'how are you', 'what is your name', 'tell me a joke', 'weather'
    ]

    const allowedKeywords = [
      'neet', 'jee', 'physics', 'chemistry', 'biology', 'mathematics', 'math', 'study', 
      'revision', 'exam', 'schedule', 'planning', 'futrix', 'xp', 'rank', 'test', 'question', 'score'
    ]

    // Strict validation: Block generic chat, politics, religion, coding, legal/medical
    let isAllowed = false

    // Check if query is related to education or FUTRIX
    for (const kw of allowedKeywords) {
      if (promptLower.includes(kw)) {
        isAllowed = true
        break
      }
    }

    // If query contains blocked topics, force block
    for (const bt of blockedTopics) {
      if (promptLower.includes(bt)) {
        // Hello/how are you might be general chat, block unless it contains a science term
        isAllowed = false
        break
      }
    }

    // Default rejection message if blocked
    if (!isAllowed) {
      const fallbackResponse = "I am FUTRIX AI Mentor and can only assist with educational and FUTRIX-related topics."
      
      // Log blocked request
      await supabaseClient.from('ai_logs').insert({
        user_id: user ? user.id : null,
        role: userRole,
        query: query,
        response: fallbackResponse,
        tokens_used: 10
      })

      return new Response(JSON.stringify({ response: fallbackResponse }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // ── GEMINI API CALL ──
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set.')
    }

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${geminiApiKey}`

    const systemPrompt = `You are Futrix AI Mentor, an expert competitive educational counselor for NEET/JEE preparation in India. 
Official Tagline: "Learn. Decide. Grow."
Positioning: India's Competitive Learning & Retention Ecosystem.
You can ONLY answer queries related to NEET, JEE, Physics, Chemistry, Biology, Mathematics, Study Planning, Revision, Exam Strategy, and Futrix Platform. 
Do not answer anything else. If a question is outside these limits, say: "I am FUTRIX AI Mentor and can only assist with educational and FUTRIX-related topics."
Format responses in clean Markdown. Keep responses motivating, educational, and professional.`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${systemPrompt}\n\nStudent Query: ${query}`
              }
            ]
          }
        ]
      })
    })

    const geminiData = await geminiResponse.json()
    const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 
      "I am FUTRIX AI Mentor and can only assist with educational and FUTRIX-related topics."

    // Estimate token usage (roughly 1 token per 4 characters)
    const tokensUsed = Math.ceil((query.length + responseText.length) / 4)

    // Log successful request to Supabase
    await supabaseClient.from('ai_logs').insert({
      user_id: user ? user.id : null,
      role: userRole,
      query: query,
      response: responseText,
      tokens_used: tokensUsed
    })

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})
