import { useState } from 'react';
import PortalLayout from '../components/PortalLayout';
import { studentNavItems } from '../lib/portalNav';
import { useAuth } from '../lib/auth';

const SUGGESTED_PROMPTS = [
  'What career paths fit my Holland code?',
  'Which strand subjects should I focus on this semester?',
  'How do my SCCT scores affect my college decisions?',
  'Recommend universities in Cebu that match my profile.'
];

type Message = { role: 'user' | 'assistant'; text: string };

export default function StudentAICounselor() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      text: `Hi ${user?.name?.split(' ')[0] || 'there'} — I'm your AI counselor. Ask me about your assessment results, career paths, or your next academic steps.`
    }
  ]);
  const [draft, setDraft] = useState('');

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages(prev => [
      ...prev,
      { role: 'user', text: trimmed },
      {
        role: 'assistant',
        text: 'Thanks for the question. For live result-aware AI explanations, use the Result page chat. External AI responses are optional and controlled by your consent in Settings.'
      }
    ]);
    setDraft('');
  }

  return (
    <PortalLayout
      title="AI Counselor"
      subtitle="Ask anything about your career path"
      navItems={studentNavItems}
    >
      <div className="grid lg:grid-cols-[1fr_300px] gap-6">
        <div className="bg-white border border-cream-300 rounded-lg flex flex-col h-[calc(100vh-220px)] min-h-[480px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[78%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-forest-700 text-cream-50'
                      : 'bg-cream-100 text-ink-900 border border-cream-300'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={e => {
              e.preventDefault();
              send(draft);
            }}
            className="border-t border-cream-300 p-4 flex gap-2"
          >
            <input
              className="input flex-1"
              placeholder="Type your question…"
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
            <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>
              Send
            </button>
          </form>
        </div>

        <aside className="space-y-4">
          <div className="bg-white border border-cream-300 rounded-lg p-5">
            <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-3">
              Suggested prompts
            </div>
            <div className="space-y-2">
              {SUGGESTED_PROMPTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="w-full text-left text-sm border border-cream-300 hover:border-forest-700 hover:text-forest-700 rounded-md px-3 py-2 transition"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-cream-50 border border-cream-300 rounded-lg p-5 text-sm text-ink-500 leading-relaxed">
            External AI use is opt-in. If disabled, responses use built-in local guidance only.
          </div>
        </aside>
      </div>
    </PortalLayout>
  );
}
