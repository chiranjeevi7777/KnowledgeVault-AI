import { useState, useCallback, useEffect, useRef } from 'react';
import AuthScreen from './components/auth/AuthScreen';
import Sidebar from './components/layout/Sidebar';
import Header from './components/layout/Header';
import WelcomeState from './components/chat/WelcomeState';
import ChatView from './components/chat/ChatView';
import ChatInput from './components/chat/ChatInput';
import AdminDashboard from './components/admin/AdminDashboard';
import { Message, Source } from './components/chat/ChatMessage';

type AppMode   = 'user' | 'developer';
type AuthState = 'none' | 'user_authenticated' | 'dev_authenticated';

export default function App() {
  const [authState,    setAuthState]    = useState<AuthState>('dev_authenticated');
  const [mode,         setMode]         = useState<AppMode>('user');

  // Trigger dynamic ingestion on app load since we bypassed login
  useEffect(() => {
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: '' }),
    }).catch(console.error);
  }, []);
  const [messages,     setMessages]     = useState<Message[]>([]);
  const [isLoading,    setIsLoading]    = useState(false);
  const [convId,       setConvId]       = useState<string>(Math.random().toString(36).slice(2));
  const [prefillQuery, setPrefillQuery] = useState<string>('');

  const handleUserAuth = () => setAuthState('user_authenticated');
  const handleDevAuth  = () => { setAuthState('dev_authenticated'); setMode('developer'); };
  const handleLogout   = () => { setAuthState('none'); setMode('user'); setMessages([]); setPrefillQuery(''); };

  const handleSendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    setPrefillQuery(''); // clear prefill after sending

    const userMsg: Message = {
      id:        Math.random().toString(36).slice(2),
      role:      'user',
      content:   text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: text.trim(), conversation_id: convId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Server error');
      }

      const data = await res.json();

      const assistantMsg: Message = {
        id:        Math.random().toString(36).slice(2),
        role:      'assistant',
        content:   data.answer,
        sources:   data.sources as Source[],
        timestamp: new Date(),
      };

      setConvId(data.conversation_id || convId);
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      const errorMsg: Message = {
        id:        Math.random().toString(36).slice(2),
        role:      'assistant',
        content:   err instanceof Error ? err.message : 'An unexpected error occurred. Is the backend running?',
        timestamp: new Date(),
        isError:   true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, convId]);

  const handleNewChat = () => {
    setMessages([]);
    setConvId(Math.random().toString(36).slice(2));
    setPrefillQuery('');
  };

  // When a history item is clicked in the sidebar, prefill the chat input
  const handleSelectQuery = (query: string) => {
    setMode('user'); // switch to user mode if in developer mode
    setPrefillQuery(query);
  };

  if (authState === 'none') {
    return <AuthScreen onUserAuth={handleUserAuth} onDevAuth={handleDevAuth} />;
  }

  const isAuthorized = true;

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-800">
      <Sidebar
        mode={mode}
        onLogout={handleLogout}
        onNewChat={handleNewChat}
        onSelectQuery={handleSelectQuery}
      />

      <main className="flex-1 relative flex flex-col h-screen overflow-hidden">
        <Header mode={mode} setMode={setMode} isDevLocked={false} />

        {isAuthorized ? (
          mode === 'user' ? (
            <>
              {messages.length === 0 ? <WelcomeState /> : (
                <ChatView messages={messages} isLoading={isLoading} />
              )}
              <ChatInput
                onSend={handleSendMessage}
                isLoading={isLoading}
                prefillValue={prefillQuery}
              />
            </>
          ) : (
            <AdminDashboard />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m-3-3h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800">Developer Access Required</h2>
              <p className="text-slate-500 max-w-sm">Authenticate with developer credentials to access the Ellucian Agent Dashboard.</p>
              <button onClick={handleLogout} className="text-box-blue font-bold hover:underline">Return to Login</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
