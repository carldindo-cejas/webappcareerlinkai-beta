import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { studentNavItems } from '../lib/portalNav';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';

type Session = {
  id: number;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
};

type Message = {
  id?: number;
  role: 'user' | 'assistant';
  content: string;
  clientId?: string;
  typing?: boolean;
};

const SUGGESTED_PROMPTS = [
  'What career paths fit my Holland code?',
  'Which strand should I take for computer science?',
  'How do my SCCT scores affect my college decisions?',
  'What courses are available in Philippine universities for my profile?',
];

function formatDate(unixSec: number): string {
  const d = new Date(unixSec * 1000);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function renderInlineFormatting(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={`bold-${match.index}`} className="font-semibold text-ink-900">
        {match[1]}
      </strong>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function renderAssistantContent(content: string): ReactNode {
  const lines = content.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const current = lines[i].trim();
    if (!current) {
      i += 1;
      continue;
    }

    if (/^[-*]\s+/.test(current)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${key++}`} className="list-disc pl-5 space-y-1 marker:text-forest-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(current)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${key++}`} className="list-decimal pl-5 space-y-1 marker:font-medium marker:text-forest-700">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [current];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paragraphLines.push(lines[i].trim());
      i += 1;
    }
    blocks.push(
      <p key={`p-${key++}`} className="leading-relaxed">
        {renderInlineFormatting(paragraphLines.join(' '))}
      </p>
    );
  }

  if (!blocks.length) {
    return <p className="leading-relaxed">{content}</p>;
  }

  return <div className="space-y-2">{blocks}</div>;
}

function AssistantBubbleContent({
  content,
  typing,
  onTypingDone
}: {
  content: string;
  typing: boolean;
  onTypingDone: () => void;
}) {
  const tokens = content.match(/\S+\s*/g) ?? [];
  const [visibleTokenCount, setVisibleTokenCount] = useState(typing ? 0 : tokens.length);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    setVisibleTokenCount(typing ? 0 : tokens.length);
  }, [typing, content, tokens.length]);

  useEffect(() => {
    if (!typing) return;

    if (visibleTokenCount >= tokens.length) {
      if (!doneRef.current) {
        doneRef.current = true;
        onTypingDone();
      }
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleTokenCount(prev => Math.min(prev + 1, tokens.length));
    }, 45);
    return () => window.clearTimeout(timer);
  }, [typing, visibleTokenCount, tokens.length, onTypingDone]);

  const visibleContent = typing
    ? tokens.slice(0, visibleTokenCount).join('')
    : content;

  return <>{renderAssistantContent(visibleContent)}</>;
}

export default function StudentAICounselor() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatLoading]);

  async function loadSessions() {
    setLoading(true);
    try {
      const rows = await api<Session[]>('/ai/sessions');
      setSessions(rows);
      if (rows.length > 0) {
        await selectSession(rows[0].id);
      }
    } catch {
      setSessions([]);
      showToast('error', 'Could not load your chat sessions.');
    } finally {
      setLoading(false);
    }
  }

  async function selectSession(id: number) {
    setActiveSessionId(id);
    setShowSidebar(false);
    setMessagesLoading(true);
    try {
      const msgs = await api<Message[]>(`/ai/sessions/${id}/messages`);
      const loadedAt = Date.now();
      setMessages(
        msgs.map((m, index) => ({
          ...m,
          clientId: m.id ? `msg-${m.id}` : `msg-${loadedAt}-${index}`,
          typing: false
        }))
      );
    } catch {
      setMessages([]);
      showToast('error', 'Could not load this conversation.');
    } finally {
      setMessagesLoading(false);
    }
  }

  async function createSession() {
    try {
      const session = await api<Session>('/ai/sessions', { method: 'POST' });
      setSessions(prev => [{ ...session, messageCount: 0 }, ...prev]);
      setActiveSessionId(session.id);
      setMessages([]);
      setShowSidebar(false);
    } catch {
      showToast('error', 'Could not start a new chat.');
    }
  }

  async function deleteSession(id: number) {
    try {
      await api(`/ai/sessions/${id}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (activeSessionId === id) {
        const remaining = sessions.filter(s => s.id !== id);
        if (remaining.length > 0) {
          await selectSession(remaining[0].id);
        } else {
          setActiveSessionId(null);
          setMessages([]);
        }
      }
    } catch {
      showToast('error', 'Could not delete this conversation.');
    }
  }

  async function send(e: FormEvent | null, overrideText?: string) {
    if (e) e.preventDefault();
    const text = (overrideText ?? draft).trim();
    if (!text || chatLoading || activeSessionId === null) return;
    setDraft('');
    setMessages(prev => [
      ...prev,
      { role: 'user', content: text, clientId: `local-user-${Date.now()}`, typing: false }
    ]);
    setChatLoading(true);
    try {
      const res = await api<{ reply: string; source: string; sessionTitle: string }>(
        `/ai/sessions/${activeSessionId}/chat`,
        { method: 'POST', body: JSON.stringify({ message: text }) }
      );
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          clientId: `local-assistant-${Date.now()}`,
          typing: true
        }
      ]);
      setSessions(prev => prev.map(s =>
        s.id === activeSessionId
          ? { ...s, title: res.sessionTitle, updatedAt: Math.floor(Date.now() / 1000), messageCount: s.messageCount + 2 }
          : s
      ));
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: err?.message || 'Could not get a reply. Please try again.',
          clientId: `local-assistant-error-${Date.now()}`,
          typing: false
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function markMessageTypingDone(clientId: string) {
    setMessages(prev => prev.map(m => (
      m.clientId === clientId ? { ...m, typing: false } : m
    )));
  }

  function sendSuggested(prompt: string) {
    if (activeSessionId === null) {
      createSession().then(() => {
        // send after session is created — handled via activeSessionId effect
      });
      setDraft(prompt);
      return;
    }
    send(null, prompt);
  }

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const sessionsSidebar = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-cream-300">
        <button
          type="button"
          onClick={createSession}
          className="btn btn-primary w-full flex items-center justify-center gap-1.5 text-sm"
        >
          <PlusIcon /> New conversation
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-sm text-ink-500">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-sm text-ink-500">No conversations yet.</div>
        ) : (
          sessions.map(s => (
            <div
              key={s.id}
              className={`group flex items-start gap-1 px-3 py-2.5 border-b border-cream-100 cursor-pointer hover:bg-cream-50 ${activeSessionId === s.id ? 'bg-cream-100' : ''}`}
              onClick={() => selectSession(s.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink-900 truncate leading-snug">{s.title}</div>
                <div className="text-xs text-ink-400 mt-0.5">{formatDate(s.updatedAt)}</div>
              </div>
              <button
                type="button"
                onClick={ev => { ev.stopPropagation(); deleteSession(s.id); }}
                className="opacity-0 group-hover:opacity-100 shrink-0 mt-0.5 p-1 rounded text-ink-400 hover:text-terracotta-600 hover:bg-terracotta-50 transition"
                title="Delete conversation"
                aria-label="Delete conversation"
              >
                <TrashIcon />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <PortalLayout
      title="AI Counselor"
      subtitle="Career and academic guidance"
      navItems={studentNavItems}
    >
      <div className="flex gap-0 rounded-lg overflow-hidden border border-cream-300" style={{ height: 'calc(100vh - 220px)', minHeight: '520px' }}>
        {/* Sessions sidebar — desktop */}
        <aside className="hidden sm:flex flex-col w-64 shrink-0 border-r border-cream-300 bg-white">
          {sessionsSidebar}
        </aside>

        {/* Sessions sidebar — mobile overlay */}
        {showSidebar && (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-30 sm:hidden"
              onClick={() => setShowSidebar(false)}
            />
            <div className="fixed inset-y-0 left-0 w-72 z-40 bg-white border-r border-cream-300 sm:hidden">
              {sessionsSidebar}
            </div>
          </>
        )}

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {/* Chat header */}
          <div className="px-4 py-3 border-b border-cream-300 flex items-center gap-3 shrink-0">
            <button
              type="button"
              className="sm:hidden inline-flex w-8 h-8 items-center justify-center rounded border border-cream-300 text-ink-700"
              onClick={() => setShowSidebar(true)}
              aria-label="Show conversations"
            >
              <MenuIcon />
            </button>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-ink-900 truncate">
                {activeSession ? activeSession.title : 'AI Counselor'}
              </div>
              <div className="text-xs text-ink-400">Career · Academic · Philippine higher education</div>
            </div>
            {activeSessionId !== null && (
              <button
                type="button"
                onClick={() => deleteSession(activeSessionId)}
                className="shrink-0 inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-terracotta-600 transition px-2 py-1 rounded hover:bg-terracotta-50"
              >
                <TrashIcon /> Delete
              </button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {activeSessionId === null ? (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center px-4">
                <div>
                  <div className="font-display text-2xl text-forest-700 mb-1">
                    Hi {user?.name?.split(' ')[0] || 'there'}
                  </div>
                  <div className="text-sm text-ink-500">
                    Ask me anything about your career path, course choices, or academic strands.
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTED_PROMPTS.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => sendSuggested(p)}
                      className="text-left text-sm border border-cream-300 hover:border-forest-700 hover:text-forest-700 rounded-lg px-3 py-2.5 transition bg-white"
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={createSession} className="btn btn-primary">
                  Start a conversation
                </button>
              </div>
            ) : messagesLoading ? (
              <div className="text-sm text-ink-500">Loading messages…</div>
            ) : (
              <>
                {messages.length === 0 && (
                  <div className="space-y-4">
                    <div className="flex justify-start">
                      <div className="max-w-[82%] rounded-lg px-4 py-3 text-sm leading-relaxed bg-cream-100 text-ink-900 border border-cream-300">
                        Hi {user?.name?.split(' ')[0] || 'there'} — I'm your AI counselor. Ask me about career paths, courses, strands, or how your assessment results connect to your future.
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {SUGGESTED_PROMPTS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => send(null, p)}
                          className="text-left text-sm border border-cream-300 hover:border-forest-700 hover:text-forest-700 rounded-lg px-3 py-2.5 transition bg-white"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={m.clientId || `${m.role}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-forest-700 text-cream-50'
                          : 'bg-cream-100 text-ink-900 border border-cream-300'
                      }`}
                    >
                      {m.role === 'assistant' ? (
                        <AssistantBubbleContent
                          content={m.content}
                          typing={Boolean(m.typing)}
                          onTypingDone={() => {
                            if (m.clientId) markMessageTypingDone(m.clientId);
                          }}
                        />
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-cream-100 border border-cream-300 rounded-lg px-4 py-3 text-sm text-ink-500">
                      Thinking…
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          {activeSessionId !== null && (
            <form
              onSubmit={send}
              className="border-t border-cream-300 p-3 flex gap-2 shrink-0"
            >
              <input
                className="input flex-1"
                placeholder="Ask about your career path…"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                disabled={chatLoading}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!draft.trim() || chatLoading}
              >
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </PortalLayout>
  );
}
