import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Languages, 
  Mic, 
  MicOff, 
  ArrowRight, 
  RefreshCw, 
  MessageSquare, 
  Settings,
  Volume2,
  VolumeX,
  History,
  Info
} from 'lucide-react';
import { LANGUAGES, Language, Message, AppState } from './types';
import { cn } from './lib/utils';
import { getChatResponse } from './services/gemini';
import Markdown from 'react-markdown';
import confetti from 'canvas-confetti';

export default function App() {
  const [state, setState] = useState<AppState>('landing');
  const [selectedLang, setSelectedLang] = useState<Language | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [userLevel, setUserLevel] = useState('beginner');
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Handle Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognitionRef.current = recognition;
    }
  }, []);

  const handleStartPractice = (lang: Language) => {
    setSelectedLang(lang);
    setState('practicing');
    const welcomeMsg: Message = {
      id: '1',
      role: 'assistant',
      content: `Hello! I'm your language partner. Let's practice ${lang.name}! I'll help you with grammar and pronunciation. How are you today?`,
      timestamp: Date.now(),
    };
    setMessages([welcomeMsg]);
    // Small delay to ensure synthesis works after transition
    setTimeout(() => speak(welcomeMsg.content, lang.code), 500);
  };

  const speak = (text: string, langCode: string) => {
    if (isMuted) return;
    window.speechSynthesis.cancel(); // Stop any current speech
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.9; // Slightly slower for better clarity
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const aiResponse = await getChatResponse([...messages, userMsg], selectedLang!.name, userLevel);
      
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse || "I'm not sure how to respond to that.",
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, botMsg]);
      speak(botMsg.content, selectedLang!.code);
    } catch (err) {
      console.error("Failed to get chat response:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleRecording = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      console.warn("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      return;
    }

    // Stop synthesis before starting recognition to avoid feedback loop
    window.speechSynthesis.cancel();

    recognition.lang = selectedLang?.code || 'en-US';
    
    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        handleSendMessage(transcript);
      }
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("Failed to start recognition:", err);
      setIsRecording(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col max-w-lg mx-auto bg-slate-950 shadow-2xl relative overflow-hidden text-slate-200">
      {/* Header */}
      <header className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <Languages size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">LinguAI</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Conversational Mastery</p>
          </div>
        </div>
        
        {state === 'practicing' && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 rounded-xl hover:bg-slate-800 transition-colors text-slate-400"
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} className="text-indigo-400" />}
            </button>
            <button 
              onClick={() => {
                confetti({
                  particleCount: 100,
                  spread: 70,
                  origin: { y: 0.6 },
                  colors: ['#4f46e5', '#6366f1', '#1e293b']
                });
                setState('summary');
              }}
              className="px-3 py-1 bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
            >
              Finish
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {state === 'landing' && (
            <LandingView key="landing" onStart={handleStartPractice} />
          )}
          
          {state === 'practicing' && (
            <PracticeView 
              key="practice"
              selectedLang={selectedLang!}
              messages={messages}
              isLoading={isLoading}
              isRecording={isRecording}
              toggleRecording={toggleRecording}
              onSendMessage={handleSendMessage}
              scrollRef={scrollRef}
              userLevel={userLevel}
              setUserLevel={setUserLevel}
            />
          )}

          {state === 'summary' && (
            <SummaryView key="summary" messageCount={messages.length} />
          )}
        </AnimatePresence>
      </main>
      
      {/* Footer Info */}
      <footer className="p-4 text-center text-[10px] text-slate-500 font-bold tracking-widest uppercase bg-slate-900/50 backdrop-blur-sm border-t border-slate-800">
        © 2026 LinguAI • AI Conversational Partner
      </footer>
    </div>
  );
}

function LandingView({ onStart }: { onStart: (lang: Language) => void }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-6 flex flex-col h-full overflow-y-auto"
    >
      <div className="mb-10 text-center relative pt-8">
        <motion.div 
          animate={{ 
            boxShadow: ["0 0 40px rgba(79, 70, 229, 0.1)", "0 0 80px rgba(79, 70, 229, 0.2)", "0 0 40px rgba(79, 70, 229, 0.1)"] 
          }}
          transition={{ repeat: Infinity, duration: 4 }}
          className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-indigo-600/5 rounded-full blur-3xl -z-10" 
        />
        <h2 className="text-4xl font-bold tracking-tight mb-3">Master any language through <span className="text-indigo-500 italic">conversation.</span></h2>
        <div className="w-12 h-1 bg-indigo-500 mx-auto mb-6 rounded-full opacity-30" />
        <p className="text-sm text-slate-400 max-w-[280px] mx-auto leading-relaxed font-medium">Break the language barrier with your modular AI-powered speech partner.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-10">
        {LANGUAGES.map((lang, idx) => (
          <motion.button
            key={lang.code}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onStart(lang)}
            className="flex flex-col items-start gap-2 p-5 bg-slate-900 border border-slate-800 rounded-3xl hover:border-indigo-500/50 hover:bg-slate-800/50 transition-all group text-left relative overflow-hidden shadow-lg shadow-black/20"
          >
            <div className="absolute top-0 right-0 w-12 h-12 bg-slate-800 -mr-4 -mt-4 rotate-45 group-hover:bg-indigo-500/10 transition-colors" />
            <span className="text-3xl mb-1 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">{lang.flag}</span>
            <div>
              <div className="font-bold text-[15px] group-hover:text-indigo-400 transition-colors">{lang.name}</div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">{lang.nativeName}</div>
            </div>
          </motion.button>
        ))}
      </div>

      <div className="bg-slate-900 rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl mt-auto relative overflow-hidden">
        <div className="absolute -bottom-10 -right-10 p-4 opacity-5 pointer-events-none">
          <MessageSquare size={160} className="rotate-[-15deg] text-indigo-500" />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
            <Info size={18} />
          </div>
          <h3 className="font-bold text-base uppercase tracking-wider text-slate-100">Modular Learning</h3>
        </div>
        <ul className="space-y-4 text-xs text-slate-400 font-bold relative z-10 uppercase tracking-wide">
          <li className="flex gap-4 items-center">
            <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-indigo-400 flex-shrink-0 border border-slate-700">01</span>
            <p>Real-time speech analysis & feedback</p>
          </li>
          <li className="flex gap-4 items-center">
            <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-indigo-400 flex-shrink-0 border border-slate-700">02</span>
            <p>Contextual vocabulary suggestions</p>
          </li>
          <li className="flex gap-4 items-center">
            <span className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-[10px] text-indigo-400 flex-shrink-0 border border-slate-700">03</span>
            <p>Dynamic difficulty scaling</p>
          </li>
        </ul>
      </div>
    </motion.div>
  );
}

function PracticeView({ 
  selectedLang, 
  messages, 
  isLoading, 
  isRecording, 
  toggleRecording, 
  onSendMessage,
  scrollRef,
  userLevel,
  setUserLevel
}: any) {
  const [inputValue, setInputValue] = useState('');

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue);
      setInputValue('');
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      {/* Settings bar */}
      <div className="px-6 py-3 bg-slate-900/50 backdrop-blur-md border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl filter drop-shadow-md">{selectedLang.flag}</span>
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{selectedLang.name}</span>
        </div>
        <div className="flex bg-slate-800 rounded-xl p-1 gap-1 border border-slate-700/50">
          {['beginner', 'intermediate', 'advanced'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setUserLevel(lvl)}
              className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
                userLevel === lvl ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "text-slate-500 hover:text-slate-300"
              )}
            >
              {lvl.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-slate-950/50"
      >
        {messages.map((msg: Message) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "flex flex-col max-w-[85%]",
              msg.role === 'user' ? "ml-auto items-end" : "items-start"
            )}
          >
            <div className={cn(
              "p-4 rounded-2xl shadow-xl relative text-sm font-medium",
              msg.role === 'user' 
                ? "bg-indigo-600 text-white rounded-br-none shadow-indigo-500/10" 
                : "bg-slate-900 text-slate-100 rounded-bl-none border border-slate-800"
            )}>
              <div className="prose prose-sm leading-relaxed">
                <Markdown>{msg.content}</Markdown>
              </div>
              <div className={cn(
                "text-[9px] mt-2 font-bold uppercase tracking-[0.2em]",
                msg.role === 'user' ? "text-indigo-200" : "text-slate-500"
              )}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-2">
            <div className="bg-slate-900 p-4 rounded-2xl rounded-bl-none border border-slate-800 flex gap-1.5 shadow-xl">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-8 bg-slate-900 border-t border-slate-800 shadow-2xl rounded-t-[40px] z-20">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative group">
            <input 
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Speak your mind..."
              className="w-full bg-slate-800 border-slate-700/50 border rounded-2xl px-5 py-4 pr-12 text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 outline-none placeholder:text-slate-500 font-medium transition-all text-white shadow-inner"
            />
            <button 
              onClick={handleSend}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-colors disabled:opacity-30"
              disabled={isLoading}
            >
              <ArrowRight size={20} />
            </button>
          </div>
          
          <button 
            onClick={toggleRecording}
            disabled={isLoading || !isSpeechSupported}
            className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center transition-all relative overflow-hidden flex-shrink-0 border-2",
              isLoading || !isSpeechSupported ? "opacity-30 cursor-not-allowed" : "",
              isRecording 
                ? "bg-red-500/10 border-red-500 text-red-500 animate-pulse scale-110 shadow-lg shadow-red-500/20" 
                : "bg-indigo-600 border-transparent text-white shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95"
            )}
          >
            {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
            {isRecording && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-full bg-red-500/20 blur-xl opacity-50" />
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0.5 }}
                    animate={{ scale: 1.5, opacity: 0 }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 bg-red-500 rounded-full"
                  />
                </div>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}


function SummaryView({ messageCount }: { messageCount: number }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-10 flex flex-col items-center justify-center text-center h-full bg-slate-950"
    >
      <motion.div 
        animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="w-24 h-24 bg-indigo-600/10 text-indigo-500 rounded-3xl flex items-center justify-center mb-8 border border-indigo-500/20 shadow-2xl shadow-indigo-500/10"
      >
        <RefreshCw size={40} className="animate-spin-slow text-indigo-400" />
      </motion.div>
      <h2 className="text-4xl font-bold mb-4 leading-tight tracking-tight">Modular <br/><span className="text-indigo-500 italic">Success.</span></h2>
      <p className="text-sm text-slate-400 mb-10 max-w-[240px] font-medium leading-relaxed uppercase tracking-wider">
        Analytics signal significant progress in conversational fluency.
      </p>
      
      <div className="grid grid-cols-2 gap-4 w-full mb-10">
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
          <div className="text-3xl font-bold text-indigo-400 mb-1 font-mono">{messageCount}</div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Exchanges</div>
        </div>
        <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl">
          <div className="text-3xl font-bold text-indigo-400 mb-1 font-mono">15m</div>
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">Duration</div>
        </div>
      </div>

      <button 
        onClick={() => window.location.reload()}
        className="w-full py-5 bg-indigo-600 text-white rounded-3xl font-bold shadow-2xl shadow-indigo-600/40 hover:bg-indigo-500 active:scale-95 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
      >
        Initialize Reset
        <ArrowRight size={18} />
      </button>
    </motion.div>
  );
}

