"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";

export function HackathonWorkspace() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [messages, setMessages] = useState<{role: "user" | "ai", content: string}[]>([
    { role: "ai", content: "Salut! Ce fel de aplicație sau site vrei să construim la acest hackathon?" }
  ]);
  const [inputVal, setInputVal] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [isGeneratingDesigns, setIsGeneratingDesigns] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  
  const [currentDoc, setCurrentDoc] = useState<{
    title: string;
    description: string;
    audience: string;
    features: string[];
    style: string;
  }>({
    title: "",
    description: "",
    audience: "",
    features: [],
    style: "",
  });

  const [designs, setDesigns] = useState<{name: string, description: string, colors: string[], vibe: string}[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<any>(null);
  const [generatedCode, setGeneratedCode] = useState<{html: string, css: string, js: string} | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [activeTab, setActiveTab] = useState<"html" | "css" | "js">("html");

  const [refinePrompt, setRefinePrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("hackathon_projects");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch(e) {}
    }
  }, []);

  const saveToHistory = (doc: any, design: any, code: any) => {
    setHistory(prev => {
      let updated;
      const existingIdx = prev.findIndex(p => p.id === activeProjectId);
      if (existingIdx >= 0) {
         updated = [...prev];
         updated[existingIdx] = { ...updated[existingIdx], doc, design, code, date: new Date().toLocaleString() };
      } else {
         const newId = Date.now().toString();
         setActiveProjectId(newId);
         updated = [{ id: newId, date: new Date().toLocaleString(), doc, design, code }, ...prev];
      }
      localStorage.setItem("hackathon_projects", JSON.stringify(updated));
      return updated;
    });
  };

  const loadProject = (proj: any) => {
    setCurrentDoc(proj.doc);
    setSelectedDesign(proj.design);
    setGeneratedCode(proj.code);
    setActiveProjectId(proj.id);
    setStep(3);
    setShowHistory(false);
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const canProceedToDesign = currentDoc.title && currentDoc.description && currentDoc.features.length > 0;

  const sendMessage = async () => {
    if (!inputVal.trim() || isChatting) return;
    
    const userMsg = { role: "user" as const, content: inputVal };
    setMessages(prev => [...prev, userMsg]);
    setInputVal("");
    setIsChatting(true);

    try {
      const res = await fetch("/api/hackathon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          payload: {
            messages: [...messages, userMsg],
            currentDoc
          }
        })
      });
      const data = await res.json();
      
      const newMsg = { role: "ai" as const, content: data.reply || "Am salvat detaliile. Ce altceva ai mai vrea să adaugi?" };
      setMessages(prev => [...prev, newMsg]);

      if (data.newDoc) {
        setCurrentDoc(prev => ({ ...prev, ...data.newDoc }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsChatting(false);
    }
  };

  const generateDesigns = async () => {
    setIsGeneratingDesigns(true);
    setStep(2);
    try {
      const res = await fetch("/api/hackathon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_designs",
          payload: { currentDoc }
        })
      });
      const data = await res.json();
      setDesigns(data.designs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingDesigns(false);
    }
  };

  const generateCode = async (design: any) => {
    setSelectedDesign(design);
    setIsGeneratingCode(true);
    setStep(3);
    try {
      const res = await fetch("/api/hackathon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_code",
          payload: { currentDoc, selectedDesign: design }
        })
      });
      const data = await res.json();
      const codePayload = {
        html: data.html || "<h1>Error generating HTML</h1>",
        css: data.css || "body { background: white; }",
        js: data.js || "console.log('App ready');"
      };
      setGeneratedCode(codePayload);
      saveToHistory(currentDoc, design, codePayload);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const refineCode = async () => {
    if (!refinePrompt.trim() || isRefining || !generatedCode) return;
    setIsRefining(true);
    try {
      const res = await fetch("/api/hackathon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine_code",
          payload: { 
            currentDoc, 
            selectedDesign,
            generatedCode,
            prompt: refinePrompt 
          }
        })
      });
      const data = await res.json();
      if (data.html && data.css && data.js) {
        const codePayload = {
          html: data.html,
          css: data.css,
          js: data.js
        };
        setGeneratedCode(codePayload);
        setRefinePrompt("");
        saveToHistory(currentDoc, selectedDesign, codePayload);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRefining(false);
    }
  };

  const iframeSrcDoc = generatedCode ? `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        ${generatedCode.css}
      </style>
    </head>
    <body>
      ${generatedCode.html}
      <script>
        try {
          ${generatedCode.js}
        } catch(e) {
          console.error(e)
        }
      </script>
    </body>
    </html>
  ` : "";

  return (
    <div className="flex h-screen w-full flex-col bg-background font-sans text-foreground overflow-hidden">
      {/* HEADER */}
      <header className="flex h-16 w-full shrink-0 items-center justify-between border-b px-6 bg-card text-card-foreground">
        <div className="flex items-center gap-4">
          <div className="text-xl font-bold bg-gradient-to-r from-primary to-orange-500 bg-clip-text text-transparent">
            Ideation IDE
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${step >= 1 ? "text-primary" : "text-muted-foreground"}`}>1. Setup</span>
            <span className="text-muted-foreground">&gt;</span>
            <span className={`text-sm font-medium ${step >= 2 ? "text-primary" : "text-muted-foreground"}`}>2. Design</span>
            <span className="text-muted-foreground">&gt;</span>
            <span className={`text-sm font-medium ${step >= 3 ? "text-primary" : "text-muted-foreground"}`}>3. Code</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mounted && (
            <>
              <Button variant="ghost" onClick={() => setShowHistory(true)} className="gap-2 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                Proiecte
                {history.length > 0 && <Badge variant="secondary" className="ml-1 h-5 text-xs">{history.length}</Badge>}
              </Button>
              
              <Button variant="ghost" onClick={() => alert("Echipa ta Virtuală:\\n1x UI Designer\\n1x Product Manager\\n1x Fullstack Engineer")} className="gap-2 font-medium">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Echipa
              </Button>

              <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')} className="rounded-full">
                {resolvedTheme === 'dark' ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M3 12h1"/><path d="M20 12h1"/><path d="m18.36 5.64-.7.7"/><path d="m6.34 18.36-.7.7"/><path d="m5.64 5.64.7.7"/><path d="m18.36 18.36.7.7"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
                )}
              </Button>

              {step === 3 && generatedCode && (
                <div className="flex gap-2 ml-2 pl-2 border-l border-border h-8 items-center">
                  <Button variant="outline" onClick={() => setShowCode(true)} className="gap-2 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    Code
                  </Button>
                  <Button onClick={() => setShowPreview(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                    Preview
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex flex-1 overflow-hidden relative">
        {step === 1 && (
          <div className="flex w-full divide-x">
            {/* LEFT: CHAT */}
            <div className="flex flex-col w-1/2 bg-card/30">
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-[18px] px-5 py-3 text-[15px] leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground border shadow-sm'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                ))}
                {isChatting && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-[18px] px-5 py-3 text-sm bg-muted text-muted-foreground">
                      <span className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce"></span>
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{animationDelay: "150ms"}}></span>
                        <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{animationDelay: "300ms"}}></span>
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-4 bg-background border-t">
                <div className="flex gap-3">
                  <Input 
                    value={inputVal}
                    onChange={(e) => setInputVal(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                    placeholder="Describe your platform, who uses it, etc..." 
                    className="rounded-full shadow-inner bg-secondary/30 border-primary/20"
                  />
                  <Button onClick={sendMessage} disabled={!inputVal.trim() || isChatting} className="rounded-full px-6">Send</Button>
                </div>
              </div>
            </div>

            {/* RIGHT: NOTION DOC */}
            <div className="flex flex-col w-1/2 bg-background p-10 overflow-y-auto relative">
              <div className="max-w-xl mx-auto w-full space-y-8">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight mb-2">
                    {currentDoc.title || <span className="text-muted/40">Untitled App</span>}
                  </h1>
                  <Badge variant="outline" className="text-orange-500 border-orange-500/30 bg-orange-500/10">Live Spec</Badge>
                </div>
                
                <div className="space-y-6">
                  <section>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3">Objective</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {currentDoc.description || <span className="italic opacity-50">AI will fill this in based on chat...</span>}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3">Target Audience</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {currentDoc.audience || <span className="italic opacity-50">Who is this for?</span>}
                    </p>
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3">Core Features</h3>
                    {currentDoc.features.length > 0 ? (
                      <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                        {currentDoc.features.map((f, i) => <li key={i}>{f}</li>)}
                      </ul>
                    ) : (
                      <span className="italic opacity-50 text-muted-foreground">What features should it have?</span>
                    )}
                  </section>

                  <section>
                    <h3 className="text-lg font-semibold border-b pb-2 mb-3">Visual Style</h3>
                    <p className="text-muted-foreground leading-relaxed">
                      {currentDoc.style || <span className="italic opacity-50">E.g., Dark mode, Minimal, Playful...</span>}
                    </p>
                  </section>
                </div>
                
                <div className="pt-10 flex justify-end">
                  <Button 
                    size="lg" 
                    onClick={generateDesigns} 
                    disabled={!canProceedToDesign}
                    className="bg-orange-500 hover:bg-orange-600 text-white rounded-full px-8 shadow-lg shadow-orange-500/20"
                  >
                    Generate Design Variants
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex-1 w-full bg-background flex flex-col items-center p-10 overflow-y-auto">
            <h2 className="text-3xl font-bold mb-4">Choose a Design Direction</h2>
            <p className="text-muted-foreground mb-12">Based on your documentation, here are 6 AI-proposed aesthetic routes for your application.</p>
            
            {isGeneratingDesigns ? (
              <div className="flex flex-col items-center mt-20 gap-4">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-orange-500 font-medium tracking-widest uppercase text-sm">Generating Aesthetic Directions...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                {designs.map((design, i) => (
                  <Card key={i} className="flex flex-col p-6 rounded-3xl overflow-hidden border-border/40 bg-card shadow-xl transition-all hover:scale-[1.02] hover:shadow-2xl">
                    <div className="flex gap-2 mb-6 h-20 rounded-2xl overflow-hidden">
                      {design.colors?.map((c, j) => (
                        <div key={j} className="h-full flex-1" style={{backgroundColor: c}}></div>
                      ))}
                    </div>
                    <Badge className="w-fit mb-3 bg-muted text-muted-foreground">{design.vibe}</Badge>
                    <h3 className="text-2xl font-bold mb-2">{design.name}</h3>
                    <p className="text-muted-foreground leading-relaxed flex-1 mb-8">
                      {design.description}
                    </p>
                    <Button 
                      onClick={() => generateCode(design)} 
                      size="lg"
                      className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-full"
                    >
                      Select & Build
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col items-center justify-center flex-1 w-full bg-background">
            {isGeneratingCode ? (
               <div className="flex flex-col items-center mt-20 gap-6">
                 <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                 <div className="text-center">
                  <p className="text-xl font-bold mb-2">Writing Production Code...</p>
                  <p className="text-muted-foreground text-sm max-w-md">Using OpenAI to assemble HTML, CSS, and interactive JavaScript according to the "{selectedDesign?.name}" design.</p>
                 </div>
               </div>
            ) : (
              <div className="text-center">
                <div className="w-24 h-24 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
                <h2 className="text-3xl font-bold mb-4">Application Ready</h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">HTML, CSS, and JS static assets have been successfully generated for your hackathon pitch.</p>
                <div className="flex gap-4 justify-center">
                  <Button size="lg" onClick={() => setShowCode(true)} variant="outline" className="rounded-full px-8 gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
                    VS Code Viewer
                  </Button>
                  <Button size="lg" onClick={() => setShowPreview(true)} className="rounded-full px-8 bg-primary gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                    Popup Preview
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* POPUP PREVIEW */}
      {showPreview && generatedCode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
          <div className="w-full h-full max-w-7xl max-h-full bg-white rounded-xl overflow-hidden flex flex-col shadow-2xl relative">
            <div className="h-12 border-b bg-gray-100 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="text-xs font-mono text-gray-500 bg-gray-200 px-3 py-1 rounded-md">{currentDoc.title}.app</div>
              <Button size="sm" variant="ghost" onClick={() => setShowPreview(false)}>Close</Button>
            </div>
            <iframe 
              srcDoc={iframeSrcDoc} 
              className="w-full flex-1 border-none"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        </div>
      )}

      {/* VS CODE VIEWER */}
      {showCode && generatedCode && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#1e1e1e] text-[#d4d4d4] font-mono shadow-2xl">
          <div className="h-12 border-b border-[#333] bg-[#252526] flex items-center justify-between px-4 shrink-0">
            <div className="flex gap-1 items-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/></svg>
              <span className="ml-2 text-sm text-[#cccccc]">Generated Source Code</span>
            </div>
            <Button size="sm" variant="ghost" className="hover:bg-[#333] hover:text-white" onClick={() => setShowCode(false)}>Close Editor</Button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <div className="w-64 border-r border-[#333] bg-[#252526] flex flex-col">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[#cccccc] px-4 py-3 shrink-0">Explorer</div>
              <div className="flex-1 overflow-y-auto">
                {["html", "css", "js"].map(tab => (
                  <div 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-6 py-1.5 text-sm cursor-pointer flex items-center gap-2 ${activeTab === tab ? "bg-[#37373d] text-white" : "hover:bg-[#2a2d2e] text-[#cccccc]"}`}
                  >
                    {tab === "html" && <span className="text-orange-500 font-bold">&lt;&gt;</span>}
                    {tab === "css" && <span className="text-blue-400 font-bold">#</span>}
                    {tab === "js" && <span className="text-yellow-400 font-bold">JS</span>}
                    index.{tab}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex-1 bg-[#1e1e1e] overflow-auto relative line-numbers">
                  <style dangerouslySetInnerHTML={{__html: `
                    .line-numbers {
                      counter-reset: line;
                    }
                    .line-numbers code {
                      display: block;
                      padding-left: 3.5em;
                    }
                    .line-numbers code::before {
                      counter-increment: line;
                      content: counter(line);
                      display: inline-block;
                      position: absolute;
                      left: 0;
                      width: 3em;
                      text-align: right;
                      color: #858585;
                      border-right: 1px solid #404040;
                      padding-right: 0.5em;
                    }
                  `}} />
                <pre className="p-4 pt-1 pb-2 text-[13px] leading-snug w-full min-h-full">
                  {generatedCode[activeTab].split('\n').map((line, i) => (
                    <code key={i} className="hover:bg-[#2a2d2e]">{line || " "}</code>
                  ))}
                </pre>
              </div>
              
              <div className="h-28 border-t border-[#333] bg-[#252526] flex flex-col p-4 shrink-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#cccccc] mb-2 flex items-center justify-between">
                  <span>✨ AI Code Refiner</span>
                  {isRefining && <span className="text-orange-500 animate-pulse">Running AI...</span>}
                </div>
                <div className="flex gap-3">
                   <Input 
                      value={refinePrompt} 
                      onChange={e => setRefinePrompt(e.target.value)} 
                      placeholder="Ask AI to modify the code (e.g., 'Make the header sticky', 'Change the main color to red')"
                      className="bg-[#1e1e1e] border-[#333] text-[#d4d4d4] h-10 rounded text-sm focus-visible:ring-1 focus-visible:ring-blue-500"
                      onKeyDown={(e) => e.key === "Enter" && refineCode()}
                   />
                   <Button 
                      onClick={refineCode} 
                      disabled={isRefining || !refinePrompt.trim()}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-10 w-28 shrink-0 rounded"
                   >
                     {isRefining ? "Fixing..." : "Apply Fix"}
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* HISTORY MODAL */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-8">
          <div className="w-full max-w-4xl max-h-full bg-background rounded-xl flex flex-col shadow-2xl overflow-hidden relative border">
            <div className="p-6 border-b flex justify-between items-center bg-muted/40 shrink-0">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
                Project History
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>Close</Button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-secondary/10">
              {history.length === 0 ? (
                 <div className="text-center py-20 text-muted-foreground">No projects saved yet. Generate some code first!</div>
              ) : (
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   {history.map(proj => (
                     <Card key={proj.id} className="p-5 hover:border-primary/50 hover:shadow-lg cursor-pointer transition-all duration-200 bg-card group" onClick={() => loadProject(proj)}>
                       <div className="flex justify-between items-start mb-3">
                         <h3 className="font-bold text-lg truncate pr-4 group-hover:text-primary transition-colors">{proj.doc?.title || "Untitled App"}</h3>
                         <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">{proj.design?.name}</Badge>
                       </div>
                       <p className="text-sm text-muted-foreground line-clamp-3 mb-5 min-h-[60px]">{proj.doc?.description}</p>
                       <div className="text-xs text-muted-foreground/80 font-mono flex items-center justify-between border-t border-border/50 pt-3">
                         <span className="flex items-center gap-1.5"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {proj.date}</span>
                         <span className="text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">Load Project &rarr;</span>
                       </div>
                     </Card>
                   ))}
                 </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
