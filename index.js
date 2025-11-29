import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import Stripe from "stripe";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import crypto from "crypto";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();

// Environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS?.replace(/\s/g, '');
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.EMAIL_USER;

// Initialize Stripe
const stripe = new Stripe(STRIPE_SECRET_KEY);

// Initialize database
const dbPath = process.env.DB_PATH || join(__dirname, "db.json");
console.log(`[Database] Using database at: ${dbPath}`);

const adapter = new JSONFile(dbPath);
const defaultData = { 
  users: [], 
  tokenUsage: [],
  subscriptions: [],
  verificationTokens: []
};
const db = new Low(adapter, defaultData);

// Read database
await db.read();

// Initialize with defaults only if database is empty (first run)
if (!db.data) {
  console.log(`[Database] Initializing new database with default data`);
  db.data = defaultData;
  await db.write();
} else {
  console.log(`[Database] Loaded existing database:`);
  console.log(`  - Users: ${db.data.users?.length || 0}`);
  console.log(`  - Token Usage Records: ${db.data.tokenUsage?.length || 0}`);
  console.log(`  - Subscriptions: ${db.data.subscriptions?.length || 0}`);
  
  // Ensure all required fields exist (backwards compatibility)
  db.data.users = db.data.users || [];
  db.data.tokenUsage = db.data.tokenUsage || [];
  db.data.subscriptions = db.data.subscriptions || [];
  db.data.verificationTokens = db.data.verificationTokens || [];
}

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-User-ID'],
  credentials: true
}));

app.use(express.json({ limit: '200mb' }));

// Stripe webhook parser (raw body)
app.use('/api/webhook', express.raw({ type: 'application/json' }));

console.log("🔑 Gemini API Key exists:", !!GEMINI_API_KEY);
console.log("💳 Stripe Key exists:", !!STRIPE_SECRET_KEY);

// ============================================
// TOKEN SYSTEM CONFIGURATION
// ============================================

const TOKEN_LIMITS = {
  free: {
    tokens: 100000,
    cooldown: 5 * 60 * 60 * 1000
  },
  plus: {
    tokens: 1000000,
    cooldown: 4 * 60 * 60 * 1000
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '30d' });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

function generateVerificationToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function getUserById(userId) {
  await db.read();
  return db.data.users.find(u => u.id === userId);
}

async function getUserByEmail(email) {
  await db.read();
  return db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

// ============================================
// TOKEN-BASED USAGE FUNCTIONS
// ============================================

function calculateTokensUsed(images = [], videos = []) {
  let tokens = 0;
  tokens += images.length * 800;
  tokens += videos.length * 2600;
  console.log(`[Tokens] Calculated: ${images.length} images + ${videos.length} videos = ${tokens} tokens`);
  return tokens;
}

async function getTokenUsage(userId) {
  await db.read();
  
  let usage = db.data.tokenUsage?.find(u => u.userId === userId);
  
  if (!usage) {
    usage = {
      userId,
      tokensUsed: 0,
      cooldownUntil: null,
      sessionStarted: Date.now()
    };
    
    if (!db.data.tokenUsage) {
      db.data.tokenUsage = [];
    }
    db.data.tokenUsage.push(usage);
    await db.write();
  }
  
  return usage;
}

async function getUserTier(userId) {
  const user = await getUserById(userId);
  if (!user) {
    return { 
      tier: 'free', 
      tokenLimit: TOKEN_LIMITS.free.tokens,
      cooldownDuration: TOKEN_LIMITS.free.cooldown,
      features: { doomScroll: false } 
    };
  }
  
  if (user.subscriptionStatus === 'active' && user.subscriptionTier === 'plus') {
    return { 
      tier: 'plus', 
      tokenLimit: TOKEN_LIMITS.plus.tokens,
      cooldownDuration: TOKEN_LIMITS.plus.cooldown,
      features: { doomScroll: true },
      subscriptionId: user.subscriptionId
    };
  }
  
  return { 
    tier: 'free', 
    tokenLimit: TOKEN_LIMITS.free.tokens,
    cooldownDuration: TOKEN_LIMITS.free.cooldown,
    features: { doomScroll: false } 
  };
}

async function checkTokenLimit(userId, requestedTokens) {
  const usage = await getTokenUsage(userId);
  const tierInfo = await getUserTier(userId);
  const now = Date.now();
  
  if (usage.cooldownUntil && now < usage.cooldownUntil) {
    const remainingMs = usage.cooldownUntil - now;
    const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
    const remainingMinutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
    
    return {
      allowed: false,
      inCooldown: true,
      tokensUsed: usage.tokensUsed,
      tokenLimit: tierInfo.tokenLimit,
      cooldownUntil: usage.cooldownUntil,
      remainingTime: {
        hours: remainingHours,
        minutes: remainingMinutes,
        total: remainingMs
      },
      message: `You've reached your usage limit. Your session will reset in ${remainingHours}h ${remainingMinutes}m.`
    };
  }
  
  if (usage.cooldownUntil && now >= usage.cooldownUntil) {
    usage.tokensUsed = 0;
    usage.cooldownUntil = null;
    usage.sessionStarted = now;
    
    const usageIndex = db.data.tokenUsage.findIndex(u => u.userId === userId);
    db.data.tokenUsage[usageIndex] = usage;
    await db.write();
    
    console.log(`[Tokens] Cooldown expired for user ${userId}, session reset`);
  }
  
  const totalTokens = usage.tokensUsed + requestedTokens;
  
  if (totalTokens > tierInfo.tokenLimit) {
    return {
      allowed: false,
      wouldExceed: true,
      tokensUsed: usage.tokensUsed,
      requestedTokens: requestedTokens,
      tokenLimit: tierInfo.tokenLimit,
      remaining: tierInfo.tokenLimit - usage.tokensUsed,
      message: `This request would use ${requestedTokens} tokens, but you only have ${tierInfo.tokenLimit - usage.tokensUsed} tokens remaining.`
    };
  }
  
  return {
    allowed: true,
    tokensUsed: usage.tokensUsed,
    requestedTokens: requestedTokens,
    tokenLimit: tierInfo.tokenLimit,
    remaining: tierInfo.tokenLimit - usage.tokensUsed,
    tier: tierInfo.tier
  };
}

async function incrementTokenUsage(userId, tokensUsed) {
  await db.read();
  
  const usageIndex = db.data.tokenUsage.findIndex(u => u.userId === userId);
  if (usageIndex < 0) {
    console.error(`[Tokens] Usage record not found for user ${userId}`);
    return;
  }
  
  const usage = db.data.tokenUsage[usageIndex];
  const tierInfo = await getUserTier(userId);
  
  usage.tokensUsed += tokensUsed;
  
  console.log(`[Tokens] User ${userId} used ${tokensUsed} tokens (total: ${usage.tokensUsed}/${tierInfo.tokenLimit})`);
  
  if (usage.tokensUsed >= tierInfo.tokenLimit) {
    usage.cooldownUntil = Date.now() + tierInfo.cooldownDuration;
    console.log(`[Tokens] ⚠️ User ${userId} hit token limit! Cooldown until ${new Date(usage.cooldownUntil).toISOString()}`);
  }
  
  db.data.tokenUsage[usageIndex] = usage;
  await db.write();
  
  return {
    tokensUsed: usage.tokensUsed,
    tokenLimit: tierInfo.tokenLimit,
    cooldownStarted: usage.tokensUsed >= tierInfo.tokenLimit,
    cooldownUntil: usage.cooldownUntil
  };
}

async function getUsageStats(userId) {
  const usage = await getTokenUsage(userId);
  const tierInfo = await getUserTier(userId);
  const now = Date.now();
  
  const stats = {
    tokensUsed: usage.tokensUsed,
    tokenLimit: tierInfo.tokenLimit,
    remaining: tierInfo.tokenLimit - usage.tokensUsed,
    tier: tierInfo.tier
  };
  
  if (usage.cooldownUntil && now < usage.cooldownUntil) {
    const remainingMs = usage.cooldownUntil - now;
    stats.inCooldown = true;
    stats.cooldownUntil = usage.cooldownUntil;
    stats.remainingTime = {
      hours: Math.floor(remainingMs / (60 * 60 * 1000)),
      minutes: Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))
    };
  }
  
  return stats;
}

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: "All fields are required" });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    await db.read();
    
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: "Email already registered" });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = 'user_' + Date.now() + '_' + crypto.randomBytes(8).toString('hex');
    
    const user = {
      id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      emailVerified: true,
      createdAt: new Date().toISOString(),
      subscriptionTier: 'free',
      subscriptionStatus: 'inactive',
      subscriptionId: null
    };
    
    db.data.users.push(user);
    await db.write();
    
    console.log(`✅ New user registered: ${email} (auto-verified)`);
    
    res.json({
      success: true,
      message: "Account created! You can now log in.",
      userId
    });
    
  } catch (error) {
    console.error("❌ Registration error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password required" });
    }
    
    await db.read();
    
    const user = await getUserByEmail(email);
    
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    
    const tierInfo = await getUserTier(user.id);
    const usageStats = await getUsageStats(user.id);
    const token = generateToken(user.id);
    
    console.log(`✅ User logged in: ${email}`);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tier: tierInfo.tier,
        features: tierInfo.features
      },
      usage: usageStats
    });
    
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/auth/status", async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    const user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const tierInfo = await getUserTier(user.id);
    const usageStats = await getUsageStats(user.id);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tier: tierInfo.tier,
        features: tierInfo.features
      },
      usage: usageStats
    });
    
  } catch (error) {
    console.error("❌ Status error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// STRIPE CHECKOUT ENDPOINTS
// ============================================

app.post("/api/stripe/create-checkout", async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const { priceId } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    let user = await getUserById(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id }
      });
      
      const userIndex = db.data.users.findIndex(u => u.id === user.id);
      db.data.users[userIndex].stripeCustomerId = customer.id;
      await db.write();
      user.stripeCustomerId = customer.id;
    }
    
    const session = await stripe.checkout.sessions.create({
      customer: user.stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${FRONTEND_URL}?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${FRONTEND_URL}?canceled=true`,
      metadata: {
        userId: user.id
      }
    });
    
    res.json({ sessionId: session.id, url: session.url });
    
  } catch (error) {
    console.error("❌ Checkout error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/stripe/create-portal", async (req, res) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    const user = await getUserById(decoded.userId);
    if (!user || !user.stripeCustomerId) {
      return res.status(404).json({ error: "No subscription found" });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: FRONTEND_URL,
    });
    
    res.json({ url: session.url });
    
  } catch (error) {
    console.error("❌ Portal error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/webhook", async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error(`❌ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata.userId;
        
        console.log(`✅ Checkout completed for user: ${userId}`);
        
        await db.read();
        const userIndex = db.data.users.findIndex(u => u.id === userId);
        if (userIndex >= 0) {
          db.data.users[userIndex].subscriptionTier = 'plus';
          db.data.users[userIndex].subscriptionStatus = 'active';
          db.data.users[userIndex].subscriptionId = session.subscription;
          await db.write();
        }
        break;
      }
      
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customer = subscription.customer;
        
        await db.read();
        const user = db.data.users.find(u => u.stripeCustomerId === customer);
        if (user) {
          const userIndex = db.data.users.findIndex(u => u.id === user.id);
          db.data.users[userIndex].subscriptionStatus = subscription.status;
          db.data.users[userIndex].subscriptionTier = subscription.status === 'active' ? 'plus' : 'free';
          await db.write();
        }
        break;
      }
      
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customer = subscription.customer;
        
        await db.read();
        const user = db.data.users.find(u => u.stripeCustomerId === customer);
        if (user) {
          const userIndex = db.data.users.findIndex(u => u.id === user.id);
          db.data.users[userIndex].subscriptionStatus = 'canceled';
          db.data.users[userIndex].subscriptionTier = 'free';
          await db.write();
          console.log(`✅ Subscription canceled for user: ${user.id}`);
        }
        break;
      }
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GEMINI AI ANALYSIS FUNCTIONS
// ============================================

async function analyzeImageWithGemini(imageUrl) {
  try {
    const prompt = `You are an expert AI-generated content detector. Analyze this image for signs of AI generation.

LOOK FOR THESE AI INDICATORS:

**Hands & Fingers:**
- Extra/missing fingers (common in DALL-E, Midjourney)
- Fused fingers or impossible hand positions
- Inconsistent finger joints or unnatural bending
- Hands with wrong number of digits

**Faces & Eyes:**
- Asymmetrical features (mismatched eyes, ears)
- Uncanny valley expressions or "AI stare"
- Teeth that blend together or wrong number of teeth
- Inconsistent lighting on face vs surroundings
- Hair that merges unnaturally with background

**Text & Lettering:**
- Gibberish text, nonsense letters
- Warped or melted-looking text
- Letters that morph into shapes
- Backwards or mirrored text

**Backgrounds & Details:**
- Blurry or melted backgrounds (Stable Diffusion signature)
- Repeating patterns that don't make sense
- Objects that fade into each other
- Impossible architecture or geometry
- Inconsistent perspective or vanishing points

**Textures & Materials:**
- Overly smooth skin (plastic/waxy look)
- Hair strands that merge unnaturally
- Fabric patterns that morph or distort
- Reflections that don't match the scene

**Lighting & Physics:**
- Multiple conflicting light sources
- Shadows going wrong directions
- Reflections that don't match objects
- Floating objects with no support

**Common AI Model Signatures:**
- DALL-E 3: Smooth, plastic-like textures, perfect symmetry
- Midjourney v6: Overly dramatic lighting, cinematic look
- Stable Diffusion XL: Dreamlike quality, soft edges, color bleeding
- Flux: Hyper-detailed but sometimes uncanny proportions

ALSO CHECK FOR INAPPROPRIATE CONTENT:
- Sexual content, nudity, explicit imagery
- Violence, gore, weapons
- Hate symbols, discriminatory imagery
- Drug paraphernalia

Respond ONLY with valid JSON:
{
  "is_ai": true or false,
  "ai_confidence": 0.0 to 1.0,
  "content_flags": ["safe"] or ["sexual", "violence", "hate", "drugs"],
  "content_severity": "none" or "low" or "medium" or "high",
  "reason": "specific details about what AI artifacts you found OR why you're confident it's real"
}

Be thorough but concise in your reason. Mention SPECIFIC artifacts if AI-generated.`;

    console.log(`  📤 Sending image to Gemini: ${imageUrl.substring(0, 100)}...`);
    
    let imageBase64;
    let mimeType = 'image/jpeg';
    
    if (imageUrl.startsWith('data:')) {
      imageBase64 = imageUrl.split(',')[1];
      if (imageUrl.startsWith('data:image/png')) mimeType = 'image/png';
      else if (imageUrl.startsWith('data:image/gif')) mimeType = 'image/gif';
      else if (imageUrl.startsWith('data:image/webp')) mimeType = 'image/webp';
    } else {
      console.log(`  📥 Fetching image from URL...`);
      const imageResponse = await fetch(imageUrl);
      
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`);
      }
      
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString('base64');
      
      const contentType = imageResponse.headers.get('content-type');
      if (contentType) {
        mimeType = contentType;
      }
      
      console.log(`  ✓ Image fetched and converted to base64 (${(imageBase64.length / 1024).toFixed(2)}KB)`);
    }
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageBase64
                }
              }
            ]
          }]
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Gemini API error: ${response.status}`, errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.error('  ❌ Empty response from Gemini:', JSON.stringify(data));
      throw new Error('Empty response from Gemini API');
    }
    
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonText);
    } catch (parseError) {
      console.error('  ❌ Failed to parse JSON from Gemini image response');
      console.error('  Raw text:', text.substring(0, 300));
      
      return {
        verdict: 'yellow',
        confidence: 0.5,
        score: 0.5,
        reason: 'Unable to parse analysis - response format error',
        content_flags: ['safe'],
        ai_detected: false
      };
    }
    
    let verdict = "green";
    let confidence = analysis.ai_confidence || 0.5;
    
    const hasViolation = analysis.content_flags && 
                        analysis.content_flags.length > 0 && 
                        !analysis.content_flags.includes('safe');
    
    if (hasViolation) {
      verdict = "red";
      confidence = analysis.content_severity === 'high' ? 0.9 : 
                   analysis.content_severity === 'medium' ? 0.7 : 0.5;
    } else if (analysis.is_ai) {
      confidence = analysis.ai_confidence;
      if (confidence >= 0.70) verdict = "red";
      else if (confidence >= 0.45) verdict = "yellow";
      else verdict = "green";
    }
    
    return {
      verdict,
      confidence,
      score: confidence,
      reason: analysis.reason || "No specific reason provided",
      content_flags: analysis.content_flags || ['safe'],
      ai_detected: analysis.is_ai || false
    };
    
  } catch (error) {
    console.error('  ❌ Error analyzing image with Gemini:', error.message);
    throw error;
  }
}

async function analyzeTextWithGemini(textContent, retryCount = 0) {
  const MAX_RETRIES = 2;
  
  try {
    if (!textContent || textContent.trim().length < 50) {
      return {
        verdict: 'none',
        confidence: 0,
        score: 0,
        reason: 'Text content too short for analysis',
        ai_detected: false
      };
    }
    
    if (textContent.length > 30000) {
      console.log(`  ⚠️ Text too long (${textContent.length} chars), truncating to 30000`);
      textContent = textContent.substring(0, 30000) + '... [truncated]';
    }

    const prompt = `You are an expert AI-generated content detector. Analyze this text for signs of AI generation.

LOOK FOR THESE AI TEXT INDICATORS:

**Style & Voice:**
- Overly formal or robotic tone
- Unnatural phrasing or word choices
- Repetitive sentence structures
- Lack of personal voice or style variations

**Common AI Patterns:**
- Generic transitions ("Moreover", "Furthermore", "In conclusion")
- Overuse of adverbs and qualifiers
- Lists and bullet points in conversational contexts
- Perfectly structured paragraphs every time
- Lack of typos or informal language

**ChatGPT/GPT Signatures:**
- "As an AI language model" disclaimers
- Overly balanced perspectives
- Apologetic or overly cautious language
- Tendency to list "pros and cons"
- Starting with "Certainly!" or "Absolutely!"

**Content Issues:**
- Factually incorrect information presented confidently
- Hallucinated sources or citations
- Vague or generic statements
- Lack of specific details or personal anecdotes

CRITICAL: You MUST respond with ONLY valid JSON. No markdown, no code blocks, no explanation.

Format:
{"is_ai":true,"ai_confidence":0.85,"reason":"Brief specific indicators"}

EXAMPLE RESPONSES:
{"is_ai":true,"ai_confidence":0.92,"reason":"Text uses repetitive 'Moreover' transitions, overly formal tone, and perfectly structured paragraphs characteristic of AI writing"}
{"is_ai":false,"ai_confidence":0.15,"reason":"Natural conversational flow with informal language, minor typos, and personal anecdotes indicate human writing"}`;

    console.log(`  📤 Sending text to Gemini (${textContent.length} chars, attempt ${retryCount + 1}/${MAX_RETRIES + 1})...`);
    
    const requestBody = {
      contents: [{
        parts: [
          { text: `${prompt}\n\nTEXT TO ANALYZE:\n${textContent}` }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500
      }
    };
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      }
    );

    console.log(`  📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`  ❌ Gemini API error: ${response.status}`, errorText.substring(0, 200));
      
      if (response.status >= 500 && retryCount < MAX_RETRIES) {
        console.log(`  🔄 Retrying due to server error...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return analyzeTextWithGemini(textContent, retryCount + 1);
      }
      
      return {
        verdict: 'yellow',
        confidence: 0.5,
        score: 0.5,
        reason: `API Error ${response.status}: Unable to analyze text`,
        ai_detected: false
      };
    }

    const responseText = await response.text();
    console.log(`  📄 Response (first 300 chars): ${responseText.substring(0, 300)}`);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('  ❌ Failed to parse outer JSON');
      
      if (retryCount < MAX_RETRIES) {
        console.log(`  🔄 Retrying due to parse error...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return analyzeTextWithGemini(textContent, retryCount + 1);
      }
      
      return {
        verdict: 'yellow',
        confidence: 0.5,
        score: 0.5,
        reason: 'Parse error: Unable to analyze text',
        ai_detected: false
      };
    }
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      console.error('  ❌ Empty response from Gemini');
      
      if (retryCount < MAX_RETRIES) {
        console.log(`  🔄 Retrying due to empty response...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return analyzeTextWithGemini(textContent, retryCount + 1);
      }
      
      return {
        verdict: 'yellow',
        confidence: 0.5,
        score: 0.5,
        reason: 'Empty response: Unable to analyze text',
        ai_detected: false
      };
    }
    
    console.log(`  📄 Gemini text response: ${text.substring(0, 300)}`);
    
    let jsonText = text.trim();
    jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    
    const jsonMatch = jsonText.match(/\{[^}]*"is_ai"[^}]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    let analysis;
    try {
      analysis = JSON.parse(jsonText);
      
      if (typeof analysis.is_ai !== 'boolean' || 
          typeof analysis.ai_confidence !== 'number' ||
          !analysis.reason) {
        throw new Error('Invalid analysis structure');
      }
      
    } catch (parseError) {
      console.error('  ❌ Failed to parse Gemini JSON response');
      console.error('  Raw text:', text.substring(0, 500));
      console.error('  Extracted JSON:', jsonText.substring(0, 500));
      
      if (retryCount < MAX_RETRIES) {
        console.log(`  🔄 Retrying due to JSON parse error (attempt ${retryCount + 2}/${MAX_RETRIES + 1})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return analyzeTextWithGemini(textContent, retryCount + 1);
      }
      
      return {
        verdict: 'yellow',
        confidence: 0.5,
        score: 0.5,
        reason: 'Unable to parse AI analysis after multiple attempts. Please try again.',
        ai_detected: false
      };
    }
    
    let verdict = "green";
    let confidence = analysis.ai_confidence || 0.5;
    
    if (analysis.is_ai) {
      confidence = analysis.ai_confidence;
      if (confidence >= 0.70) verdict = "red";
      else if (confidence >= 0.45) verdict = "yellow";
      else verdict = "green";
    }
    
    console.log(`  ✅ Text analysis successful: ${verdict} (${Math.round(confidence * 100)}%)`);
    
    return {
      verdict,
      confidence,
      score: confidence,
      reason: analysis.reason || "No specific reason provided",
      ai_detected: analysis.is_ai || false
    };
    
  } catch (error) {
    console.error('  ❌ Error analyzing text with Gemini:', error.message);
    
    if (retryCount < MAX_RETRIES) {
      console.log(`  🔄 Retrying due to error: ${error.message}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return analyzeTextWithGemini(textContent, retryCount + 1);
    }
    
    return {
      verdict: 'yellow',
      confidence: 0.5,
      score: 0.5,
      reason: `Analysis error: ${error.message}. Please try again.`,
      ai_detected: false
    };
  }
}

async function analyzeAudioWithGemini(audioBase64, format = 'audio/webm') {
  try {
    if (!GEMINI_API_KEY) {
      console.log('Gemini API key not available for audio analysis');
      return null;
    }

    const prompt = `Analyze this audio for AI-generated speech or sound.

AI indicators: robotic voice, synthetic quality, unnatural rhythm, no breathing sounds
Authentic indicators: natural variations, background noise, speech errors, breathing

Respond with ONLY JSON (no markdown):
{
  "is_ai": true/false,
  "confidence": 0.0-1.0,
  "reason": "Brief explanation (max 2 sentences)"
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: format,
                  data: audioBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 300
          }
        })
      }
    );

    if (!response.ok) {
      console.error('Gemini audio analysis failed:', response.status);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    } else {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonText = jsonMatch[0];
      }
    }

    const analysis = JSON.parse(jsonText);
    
    let verdict = "green";
    let confidence = analysis.confidence;
    
    if (analysis.is_ai) {
      confidence = analysis.confidence;
      if (confidence >= 0.70) verdict = "red";
      else if (confidence >= 0.45) verdict = "yellow";
      else verdict = "green";
    } else {
      confidence = 1.0 - analysis.confidence;
      if (confidence >= 0.60) verdict = "green";
      else if (confidence >= 0.30) verdict = "yellow";
      else verdict = "red";
    }
    
    return {
      verdict,
      confidence: analysis.confidence,
      score: analysis.confidence,
      reason: analysis.reason,
      content_flags: ['safe'],
      ai_detected: analysis.is_ai
    };
    
  } catch (error) {
    console.error('Gemini audio analysis error:', error);
    return null;
  }
}

// ============================================
// COMPREHENSIVE ANALYSIS ENDPOINT
// ============================================

app.post("/api/analyze-comprehensive", async (req, res) => {
  const startTime = Date.now();
  
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    const { screenshot, textContent, wordCount, images, videos, audioRecordings, url, title } = req.body;
    
    if (!token) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    const userId = decoded.userId;
    
    console.log("🔍 Analysis request:");
    console.log("  - User ID:", userId);
    console.log("  - Images:", images?.length || 0);
    console.log("  - Videos:", videos?.length || 0);
    console.log("  - Audio:", audioRecordings?.length || 0);
    
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "No Gemini API key configured" });
    }

    const requestedTokens = calculateTokensUsed(images || [], videos || []);
    console.log(`[Tokens] Request will use ~${requestedTokens} tokens`);

    const limitCheck = await checkTokenLimit(userId, requestedTokens);
    
    if (!limitCheck.allowed) {
      if (limitCheck.inCooldown) {
        return res.status(429).json({
          error: "Usage limit reached",
          message: limitCheck.message,
          inCooldown: true,
          cooldownUntil: limitCheck.cooldownUntil,
          remainingTime: limitCheck.remainingTime,
          tokensUsed: limitCheck.tokensUsed,
          tokenLimit: limitCheck.tokenLimit
        });
      } else if (limitCheck.wouldExceed) {
        return res.status(429).json({
          error: "Insufficient tokens",
          message: limitCheck.message,
          tokensUsed: limitCheck.tokensUsed,
          tokenLimit: limitCheck.tokenLimit,
          remaining: limitCheck.remaining,
          requestedTokens: limitCheck.requestedTokens
        });
      }
    }

    const results = {
      text: null,
      visual: null,
      audio: null,
      images: [],
      videos: [],
      audioFiles: []
    };
    
    if (textContent && textContent.trim().length >= 50) {
      console.log(`📝 Analyzing text content (${textContent.length} chars) with Gemini...`);
      
      try {
        const textAnalysis = await analyzeTextWithGemini(textContent);
        results.text = textAnalysis;
        console.log(`  ✅ Text analyzed: ${textAnalysis.verdict} (${Math.round(textAnalysis.confidence * 100)}%)`);
      } catch (error) {
        console.error(`  ❌ Error analyzing text:`, error.message);
        results.text = {
          verdict: 'none',
          confidence: 0,
          score: 0,
          reason: 'Text analysis failed',
          ai_detected: false
        };
      }
    }
    
    if (images && images.length > 0) {
      console.log(`📸 Analyzing ${images.length} images with Gemini...`);
      
      for (let i = 0; i < Math.min(images.length, 10); i++) {
        const image = images[i];
        try {
          console.log(`  Analyzing image ${i + 1}/${images.length}`);
          
          if (!image.url || image.url.startsWith('data:')) {
            console.log(`  ⚠️ Image ${i + 1} has no URL or is base64, skipping`);
            results.images.push({
              index: image.index,
              verdict: 'none',
              confidence: 0,
              score: 0,
              reason: 'Image URL not available for analysis',
              content_flags: ['safe']
            });
            continue;
          }
          
          const analysis = await analyzeImageWithGemini(image.url);
          
          results.images.push({
            index: image.index,
            ...analysis
          });
          
          console.log(`  ✅ Image ${i + 1} analyzed: ${analysis.verdict} (${Math.round(analysis.confidence * 100)}%) - Flags: ${analysis.content_flags.join(', ')}`);
          
        } catch (error) {
          console.error(`  ❌ Error analyzing image ${i + 1}:`, error.message);
          results.images.push({
            index: image.index,
            verdict: 'yellow',
            confidence: 0.5,
            score: 0.5,
            reason: 'Analysis error',
            content_flags: ['safe']
          });
        }
      }
    }
    
    if (videos && videos.length > 0) {
      console.log(`🎬 Analyzing ${videos.length} video(s) with Gemini...`);
      
      for (const video of videos.slice(0, 2)) {
        try {
          console.log(`  Analyzing video ${video.index}...`);
          
          let analysis;
          
          if (video.isBlob && video.frames && video.frames.length > 0) {
            console.log(`  📸 Blob video with ${video.frames.length} frames - analyzing...`);
            
            const frameAnalyses = [];
            for (let i = 0; i < video.frames.length; i++) {
              try {
                const frameAnalysis = await analyzeImageWithGemini(video.frames[i]);
                frameAnalyses.push(frameAnalysis);
                console.log(`    ✅ Frame ${i + 1}/${video.frames.length}: ${frameAnalysis.verdict} (${Math.round(frameAnalysis.confidence * 100)}%)`);
              } catch (error) {
                console.error(`    ❌ Error analyzing frame ${i + 1}:`, error.message);
              }
            }
            
            let worstVerdict = 'green';
            let highestConfidence = 0;
            const allContentFlags = new Set();
            
            for (const frame of frameAnalyses) {
              if (frame.verdict === 'red') worstVerdict = 'red';
              else if (frame.verdict === 'yellow' && worstVerdict !== 'red') worstVerdict = 'yellow';
              
              if (frame.confidence > highestConfidence) {
                highestConfidence = frame.confidence;
              }
              
              frame.content_flags.forEach(flag => allContentFlags.add(flag));
            }
            
            const aiFrames = frameAnalyses.filter(f => f.ai_detected).length;
            const contentFlags = Array.from(allContentFlags);
            
            let reason = '';
            if (aiFrames > 0) {
              const mostLikelyReason = frameAnalyses
                .filter(f => f.ai_detected)
                .sort((a, b) => b.confidence - a.confidence)[0]?.reason || 'synthetic patterns';
              reason = `This video appears to be AI-generated. ${aiFrames} of ${frameAnalyses.length} frames analyzed showed artificial characteristics including ${mostLikelyReason.toLowerCase()}.`;
            } else {
              reason = `This video appears to be authentic human-generated content. All ${frameAnalyses.length} frames analyzed show natural characteristics with no signs of AI generation.`;
            }
            
            analysis = {
              verdict: worstVerdict,
              confidence: highestConfidence,
              score: highestConfidence,
              reason: reason,
              content_flags: contentFlags.length > 0 ? contentFlags : ['safe'],
              ai_detected: worstVerdict !== 'green',
              startTime: video.startTime || 0,
              endTime: video.endTime || 0
            };
            
          } else if (video.videoBase64 || video.videoUrl) {
            console.log(`  ⚠️ Video ${video.index} has base64/URL but no frames - skipping`);
            results.videos.push({
              index: video.index,
              verdict: 'none',
              confidence: 0,
              score: 0,
              reason: 'Video must be analyzed frame-by-frame',
              content_flags: ['safe'],
              startTime: video.startTime || 0,
              endTime: video.endTime || 0
            });
            continue;
          } else {
            console.log(`  ⚠️ Video ${video.index} has no data, URL, or frames - skipping`);
            results.videos.push({
              index: video.index,
              verdict: 'none',
              confidence: 0,
              score: 0,
              reason: 'Video data not available',
              content_flags: ['safe'],
              startTime: video.startTime || 0,
              endTime: video.endTime || 0
            });
            continue;
          }
          
          results.videos.push({
            index: video.index,
            ...analysis
          });
          
          console.log(`  ✅ Video ${video.index} analyzed: ${analysis.verdict} (${Math.round(analysis.confidence * 100)}%)`);
          
        } catch (error) {
          console.error(`  ❌ Error analyzing video ${video.index}:`, error.message);
          results.videos.push({
            index: video.index,
            verdict: 'yellow',
            confidence: 0.5,
            score: 0.5,
            reason: 'Analysis error',
            content_flags: ['safe'],
            startTime: video.startTime || 0,
            endTime: video.endTime || 0
          });
        }
      }
    }
    
    if (audioRecordings && audioRecordings.length > 0) {
      console.log(`🔊 Analyzing ${audioRecordings.length} audio recording(s) with Gemini...`);
      
      for (const recording of audioRecordings.slice(0, 5)) {
        try {
          console.log(`  Analyzing audio ${recording.index}`);
          
          if (!recording.data) {
            results.audioFiles.push({
              index: recording.index,
              verdict: 'none',
              confidence: 0,
              score: 0,
              reason: 'No audio data available',
              content_flags: ['safe'],
              startTime: recording.startTime || 0,
              endTime: recording.endTime || 0
            });
            continue;
          }
          
          const analysis = await analyzeAudioWithGemini(
            recording.data, 
            recording.format || 'audio/webm'
          );
          
          if (analysis) {
            results.audioFiles.push({
              index: recording.index,
              ...analysis,
              startTime: recording.startTime || 0,
              endTime: recording.endTime || 0
            });
            console.log(`  ✅ Audio ${recording.index} analyzed: ${analysis.verdict} (${Math.round(analysis.confidence * 100)}%)`);
          } else {
            results.audioFiles.push({
              index: recording.index,
              verdict: 'yellow',
              confidence: 0.5,
              score: 0.5,
              reason: 'Audio analysis unavailable',
              content_flags: ['safe'],
              startTime: recording.startTime || 0,
              endTime: recording.endTime || 0
            });
          }
          
        } catch (error) {
          console.error(`  ❌ Error analyzing audio ${recording.index}:`, error.message);
          results.audioFiles.push({
            index: recording.index,
            verdict: 'yellow',
            confidence: 0.5,
            score: 0.5,
            reason: 'Audio analysis error',
            content_flags: ['safe'],
            startTime: recording.startTime || 0,
            endTime: recording.endTime || 0
          });
        }
      }
    }
    
    const usageUpdate = await incrementTokenUsage(userId, requestedTokens);
    console.log(`✅ Token usage updated:`, usageUpdate);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Comprehensive analysis complete in ${elapsed}ms`);

    const usageStats = await getUsageStats(userId);

    res.json({
      ...results,
      usage: usageStats
    });
    
  } catch (err) {
    const elapsed = Date.now() - startTime;
    console.error(`❌ Comprehensive analysis error after ${elapsed}ms:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "CyberBuddy AI Analysis with Token-Based Usage System" 
  });
});

app.get("/api/health", (req, res) => {
  res.json({ 
    ok: true, 
    hasGeminiKey: !!GEMINI_API_KEY,
    hasStripe: !!STRIPE_SECRET_KEY 
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🎯 Token-based usage system active`);
  console.log(`  - Free: 100,000 tokens (5hr cooldown)`);
  console.log(`  - Plus: 1,000,000 tokens (4hr cooldown)`);
  console.log(`🤖 Gemini API enabled for AI detection`);
  console.log(`📡 Stripe webhook endpoint: /api/webhook`);
});
