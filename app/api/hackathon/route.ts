import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const { action, payload } = await req.json();

    if (action === "chat") {
      const { messages, currentDoc } = payload;
      
      const systemPrompt = `You are an AI product manager helping a user define their web application idea for a hackathon. 
Your goal is to extract enough information to build a clear Notion-style spec doc.
The doc needs: Title, Description, Target Audience, Core Features, and Visual Style.
Respond in Romanian. keep it short, 1-2 sentences. Ask one question at a time.

IMPORTANT: You MUST ALWAYS start your response with a conversational reply acknowledging what the user said, and asking the next question.

Only AFTER your conversational reply, if you have gathered new information, provide a JSON block enclosed in \`\`\`json ... \`\`\` that updates the Notion doc.
The JSON format must be EXACTLY: { "title": "...", "description": "...", "audience": "...", "features": ["..."], "style": "..." }
Only fill in what you know, leave the rest empty or as they were in the current doc.
Current doc: ${JSON.stringify(currentDoc)}`;

      const apiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m: any) => ({ role: m.role === "ai" ? "assistant" : m.role, content: m.content }))
      ];

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: apiMessages as any,
      });

      const replyContent = response.choices[0].message.content || "";
      
      // Extract JSON if present robustly
      let newDoc = null;
      let cleanReply = replyContent;
      
      const firstBrace = replyContent.indexOf("{");
      const lastBrace = replyContent.lastIndexOf("}");
      
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        try {
          const jsonStr = replyContent.slice(firstBrace, lastBrace + 1);
          newDoc = JSON.parse(jsonStr);
          // remove the json string and any backticks wrapper
          cleanReply = replyContent.replace(jsonStr, "").replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
        } catch (e) {
          console.error("Failed to parse JSON from AI", e);
        }
      }

      if (!cleanReply) {
        cleanReply = "Am extras notițele din răspuns. Ce alt rol sau funcționalitate adăugăm?";
      }

      return NextResponse.json({ reply: cleanReply, newDoc });
    }

    if (action === "generate_designs") {
      const { currentDoc } = payload;
      
      const systemPrompt = `You are an expert UI/UX designer. Carefully read the application specification below. 
Generate 6 distinct, highly relevant, and creative visual design options specifically tailored for this application's goals and features.
Each option should have a name, a detailed description connecting the design to the app's utility, the primary color palette (using hex codes), and the "vibe".
Respond ONLY with a JSON object containing a "designs" array.
Format: 
{ "designs": [ {"name": "...", "description": "...", "colors": ["#...", "#..."], "vibe": "..."} ] }
Specification: ${JSON.stringify(currentDoc)}`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" }
      });
      
      let designs = [];
      try {
          const content = response.choices[0].message.content || '{"designs":[]}';
          const parsed = JSON.parse(content);
          designs = parsed.designs || parsed;
      } catch (e) {
         console.error("Design parsing error", e);
      }
      
      if (!Array.isArray(designs) || designs.length === 0) {
        designs = [
           { name: "Modern Minimal", description: "Clean lines that let the content breathe.", colors: ["#ffffff", "#000000", "#f3f4f6"], vibe: "Minimalist" },
           { name: "Playful Pop", description: "Bright, fun, and highly engaging UI.", colors: ["#ff5722", "#ffeb3b", "#4caf50"], vibe: "Playful" },
           { name: "Dark Mode Neon", description: "Sleek dark theme with energetic cyberpunk accents.", colors: ["#121212", "#00e5ff", "#e040fb"], vibe: "Cyberpunk" },
           { name: "Elegant Corporate", description: "Trustworthy and professional layout.", colors: ["#1e3a8a", "#f8fafc", "#3b82f6"], vibe: "Professional" },
           { name: "Earthy Organic", description: "Calm, natural, and accessible aesthetics.", colors: ["#78350f", "#fef3c7", "#166534"], vibe: "Organic" },
           { name: "High-Tech Glass", description: "Glassmorphism with blurred backgrounds and icy borders.", colors: ["#0f172a", "#38bdf8", "#818cf8"], vibe: "Glassmorphism" }
         ];
      }

      return NextResponse.json({ designs: designs.slice(0, 6) });
    }
    
    if (action === "generate_code") {
      const { currentDoc, selectedDesign } = payload;
      
      const systemPrompt = `You are an expert Frontend Developer. You build advanced, highly interactive, standalone web applications using ONLY vanilla HTML, CSS, and plain JavaScript. No React, no external libraries unless imported via CDN.

IMPORTANT MULTI-PAGE & DYNAMIC REQUIREMENT:
The user explicitly requested complex, "production-ready" multi-page websites. DO NOT generate simple MVP variants! You MUST:
1. Generate an expansive Multi-Page layout behaving as a Single Page Application (SPA). NEVER use traditional <a href="page.html"> links (they break the iframe). Structure HTML with separate main sections (<section id="page-home">, etc) and use Vanilla JS to hide/show them smoothly on navigation. 
2. Ensure at least 3-4 highly detailed, fully designed views exist (e.g., Home, Shop, Dashboard, Contact).
3. Populate with REALISTIC DUMMY DATA. Avoid generic "Lorem Ipsum". If it's an app, use JS to render items dynamically from an array.
4. Implement RICH INTERACTIVITY: functional modals, working search bars/filters, sliders, working shopping carts, dropdowns, or toast notifications.
5. Use PREMIUM, ultra-modern CSS: smooth transitions, hover effects, glassmorphism, flex/grid complex layouts, and box-shadows.

You will receive an application specification and a selected design direction.
You must output a single JSON object containing exactly 3 keys: "html", "css", and "js". Do not use markdown wrappers.
NEVER truncate or abbreviate the code with comments like "/* rest of the code */". Write the complete logic.

CRITICAL: Validate that any DOM element IDs or classes you use in your JS EXACTLY MATCH the elements you provide in your HTML string.
Specification: ${JSON.stringify(currentDoc)}
Design Option selected: ${JSON.stringify(selectedDesign)}
Remember: Return ONLY valid JSON format: {"html": "...", "css": "...", "js": "..."}.`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      return NextResponse.json(JSON.parse(content || '{"html":"", "css":"", "js":""}'));
    }

    if (action === "refine_code") {
      const { currentDoc, selectedDesign, generatedCode, prompt } = payload;
      
      const systemPrompt = `You are an expert Frontend Developer modifying an existing web application.
The application is built with vanilla HTML, CSS, and plain JavaScript.

IMPORTANT: The application must remain a Multi-Page SPA. Do not use <a href="page.html"> links that reload the document! Always navigate by toggling the CSS display or classes of dedicated page containers (e.g. <div id="page-home">).

Original specification: ${JSON.stringify(currentDoc)}
Design selected: ${JSON.stringify(selectedDesign)}

The user has requested the following modification:
"${prompt}"

Here is the current code:
HTML:
${generatedCode.html}
CSS:
${generatedCode.css}
JS:
${generatedCode.js}

Apply the requested modification to the code.
You must output a single JSON object containing exactly 3 keys: "html", "css", and "js" with the FULL, UPDATED code for all three.
Return ONLY valid JSON format: {"html": "...", "css": "...", "js": "..."}.
CRITICAL: Validate that any DOM element IDs or classes you use in your JS EXACTLY MATCH the elements in your HTML string.`;

      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
        messages: [{ role: "system", content: systemPrompt }],
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      return NextResponse.json(JSON.parse(content || '{"html":"", "css":"", "js":""}'));
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
