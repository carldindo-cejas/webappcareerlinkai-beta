import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Logo from '../components/Logo';
import { useAuth } from '../lib/auth';

function ArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform duration-200 group-hover:translate-x-1">
      <path d="M3 7h8m0 0L7 3m4 4L7 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dashLink = user
    ? user.role === 'counselor'
      ? '/portal/counselor'
      : user.onboarded
      ? '/portal/student/dashboard'
      : '/onboarding'
    : '/signup';

  return (
    <div className="grain overflow-x-hidden">
      <nav className={`sticky top-0 z-50 backdrop-blur bg-cream-100/85 transition-colors ${scrolled ? 'border-b border-cream-300' : 'border-b border-transparent'}`}>
        <div className="max-w-[1280px] mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex gap-10 items-center text-[15px]">
            <a href="#process" className="text-ink-900 hover:text-forest-700 transition">How it works</a>
            <a href="#research" className="text-ink-900 hover:text-forest-700 transition">Research</a>
            <a href="#counselors" className="text-ink-900 hover:text-forest-700 transition">For counselors</a>
          </div>
          <div className="flex gap-3 items-center">
            {user ? (
              <Link to={dashLink} className="btn btn-primary btn-sm">Continue</Link>
            ) : (
              <>
                <Link to="/signin" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link to="/signup" className="btn btn-primary btn-sm">Get started</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-[1280px] mx-auto px-4 sm:px-8 pt-16 sm:pt-20 pb-20 sm:pb-24 grid lg:grid-cols-[1.3fr_1fr] gap-10 lg:gap-16 items-center relative">
        <div className="absolute -top-24 -right-40 w-[600px] h-[600px] border border-dashed border-ink-300 rounded-full opacity-40 pointer-events-none hidden lg:block" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 mb-8 reveal reveal-1">
            <span className="w-8 h-px bg-forest-700" />
            <span className="eyebrow">For senior high students</span>
          </div>
          <h1 className="mb-6 reveal reveal-2">
            Find the work<br />
            <span className="italic-serif">you were made</span><br />
            to do.
          </h1>
          <p className="text-xl leading-relaxed text-ink-500 max-w-[540px] mb-10 reveal reveal-3">
            CareerLinkAI pairs the validated RIASEC and Social Cognitive Career frameworks with a thoughtful AI to translate who you are today into the courses and careers where you'll thrive tomorrow.
          </p>
          <div className="flex flex-wrap gap-4 items-center reveal reveal-4">
            <Link to={dashLink} className="btn btn-primary btn-lg">Begin your assessment</Link>
            <a href="#process" className="group inline-flex items-center gap-2 text-forest-700 font-medium text-[15px]">
              Watch how it works <ArrowIcon />
            </a>
          </div>
        </div>

        <div className="relative h-[480px] sm:h-[520px]">
          <div className="absolute top-0 left-0 w-[280px] bg-white border border-cream-300 rounded-lg p-6 shadow -rotate-3 reveal reveal-3">
            <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-3">Holland code</div>
            <div className="font-display text-5xl font-medium leading-none tracking-tight text-forest-700">RIA</div>
            <div className="text-sm text-ink-500 mt-2">Realistic · Investigative · Artistic</div>
            <div className="flex gap-2 mt-4">
              {['R', 'I', 'A', 'S'].map((l, i) => (
                <span
                  key={l}
                  className={`px-3.5 py-1.5 rounded-full text-[13px] font-medium border ${i < 3 ? 'bg-terracotta-600 text-white border-terracotta-600' : 'bg-cream-50 border-cream-300'}`}
                >
                  {l}
                </span>
              ))}
            </div>
          </div>

          <div className="absolute top-20 right-0 w-[260px] bg-forest-700 text-cream-50 border border-forest-700 rounded-lg p-6 shadow rotate-2 reveal reveal-4">
            <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-cream-200 mb-3">Top course matches</div>
            {[['BS Computer Science', '94%'], ['BS Architecture', '88%'], ['BS Industrial Design', '81%']].map(([n, m], i) => (
              <div key={i} className={`flex justify-between py-2.5 text-sm ${i < 2 ? 'border-b border-dashed border-white/15' : ''}`}>
                <span>{n}</span>
                <span className="font-mono text-[13px] text-terracotta-400 font-medium">{m}</span>
              </div>
            ))}
          </div>

          <div className="absolute bottom-0 left-14 w-[300px] bg-white border border-cream-300 rounded-lg p-6 shadow rotate-1 reveal reveal-5">
            <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-300 mb-3">Self-efficacy</div>
            <div className="flex items-baseline gap-3">
              <span className="font-display font-medium text-4xl leading-none tracking-tight text-forest-700">4.2</span>
              <span className="text-ink-500 text-sm">/ 5.0</span>
            </div>
            <div className="text-sm text-ink-500 mt-2">Strong confidence in chosen direction</div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <div className="border-y border-cream-300 mx-4 sm:mx-8 py-8">
        <div className="max-w-[1280px] mx-auto flex flex-wrap justify-between gap-8 items-center">
          <span className="font-mono text-xs tracking-[0.14em] uppercase text-ink-300">
            Trusted by guidance offices across the country
          </span>
          <div className="flex gap-8 sm:gap-12">
            {[['12,400+', 'Students assessed'], ['87', 'Partner schools'], ['94%', 'Counselor satisfaction']].map(([n, l]) => (
              <div key={l} className="flex flex-col">
                <span className="font-display text-[28px] leading-none text-forest-700">{n}</span>
                <span className="text-[13px] text-ink-500 mt-1.5">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Process */}
      <section id="process" className="max-w-[1280px] mx-auto px-4 sm:px-8 py-24 sm:py-32">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-8 lg:gap-16 mb-16 items-end">
          <div>
            <span className="eyebrow block mb-4">The method</span>
            <h2>Four steps from <span className="italic-serif">curious</span> to certain.</h2>
          </div>
          <p className="text-ink-500 text-lg leading-relaxed">
            We don't believe a quiz can tell you who to be. We believe the right questions, asked in the right order, can help you discover what you already know about yourself.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            ['01 / Begin', 'Tell us where\nyou stand today.', 'Share your senior high strand and academic record. Two minutes of context that shapes everything that follows.'],
            ['02 / Discover', 'Forty-eight\nhonest questions.', 'Our RIASEC assessment surfaces the activities, environments and problems where you naturally come alive.'],
            ['03 / Reflect', 'A second look,\ntwelve more.', 'The SCCT framework examines your confidence, your hopes for the future, and the obstacles standing in the way.'],
            ['04 / Direction', 'Personalised\nrecommendations.', 'A clear Holland code, a ranked shortlist of college courses and careers, and an AI counselor ready to discuss any of them.']
          ].map(([num, title, desc]) => (
            <div key={num} className="relative pt-8 border-t border-ink-900">
              <span className="font-mono text-xs tracking-[0.14em] text-terracotta-600 absolute -top-2 left-0 bg-cream-100 pr-3">{num}</span>
              <h3 className="font-display text-2xl mb-4 leading-tight whitespace-pre-line">{title}</h3>
              <p className="text-ink-500 text-[15px] leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI feature */}
      <section className="bg-forest-700 text-cream-100 py-24 sm:py-32 px-4 sm:px-8 my-16 relative overflow-hidden">
        <div className="absolute -top-52 -left-52 w-[500px] h-[500px] border border-cream-100/10 rounded-full pointer-events-none" />
        <div className="absolute -bottom-80 -right-32 w-[700px] h-[700px] border border-cream-100/5 rounded-full pointer-events-none" />
        <div className="max-w-[1280px] mx-auto grid lg:grid-cols-2 gap-16 items-center relative z-10">
          <div>
            <span className="eyebrow !text-terracotta-400">AI guidance</span>
            <h2 className="!text-cream-50 mt-6 mb-6">Not just a result. <span className="italic-serif !text-terracotta-400">A conversation.</span></h2>
            <p className="text-cream-200 text-lg leading-relaxed mb-10">
              Every CareerLinkAI result comes with an AI counselor that knows your specific profile. Ask it anything — why a course was recommended, what subjects to focus on, what a typical day in that career actually looks like.
            </p>
            <a href="#" className="group inline-flex items-center gap-2 text-terracotta-400 font-medium">
              See an example conversation <ArrowIcon />
            </a>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-8 backdrop-blur">
            <div className="font-mono text-xs text-terracotta-400 mb-4 tracking-[0.1em]">— STUDENT</div>
            <p className="text-cream-100 mb-6 text-[15px]">Why was BS Architecture matched higher than BS Engineering when both seem to fit my STEM strand?</p>
            <div className="font-mono text-xs text-terracotta-400 mb-4 tracking-[0.1em]">— CAREERLINKAI</div>
            <p className="font-display italic text-xl leading-snug text-cream-50 mb-6">
              "Your assessment shows a strong Artistic dimension alongside Investigative — Architecture rewards that creative-analytical balance more directly than pure engineering does."
            </p>
            <div className="flex gap-6 pt-6 border-t border-white/10 text-sm text-cream-200">
              <span><strong className="text-cream-50 font-medium">Holland match</strong> · 88%</span>
              <span><strong className="text-cream-50 font-medium">Strand fit</strong> · STEM × Arts boost</span>
            </div>
          </div>
        </div>
      </section>

      {/* Counselors */}
      <section id="counselors" className="max-w-[1280px] mx-auto px-4 sm:px-8 py-24 sm:py-32 grid lg:grid-cols-[1fr_1.2fr] gap-16 items-center">
        <div>
          <span className="eyebrow block mb-6">For guidance counselors</span>
          <h2 className="mb-6">See your students <span className="italic-serif">whole</span>.</h2>
          <p className="text-ink-500 text-[17px] leading-relaxed mb-8 max-w-[480px]">
            Create department groups, share a single join link with your section, and watch results come in across the room. Aggregate analytics for the class. Deep individual profiles for the conversations that matter.
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <Link to="/signup" className="btn btn-outline">Request counselor access</Link>
          </div>
        </div>
        <div className="bg-white border border-cream-300 rounded-lg overflow-hidden shadow-lg">
          <div className="bg-cream-200 px-6 py-4 border-b border-cream-300 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-ink-300 rounded-full" />
            <span className="w-2.5 h-2.5 bg-ink-300 rounded-full" />
            <span className="w-2.5 h-2.5 bg-ink-300 rounded-full" />
            <span className="ml-4 text-[13px] text-ink-500">careerlinkai · counselor dashboard</span>
          </div>
          <div className="p-8">
            <div className="flex justify-between items-baseline mb-6">
              <h3 className="text-lg">My departments</h3>
              <span className="font-mono text-xs text-ink-300 tracking-[0.1em]">SY 2025–2026</span>
            </div>
            {[
              ['Grade 12 STEM — A', '42 students · 38 completed', 90],
              ['Grade 12 ABM', '36 students · 31 completed', 86],
              ['Grade 12 HUMSS', '28 students · 22 completed', 78],
              ['Grade 11 GAS', '31 students · 9 completed', 29]
            ].map(([n, m, p], i) => (
              <div key={i} className="flex items-center justify-between py-4 border-b border-cream-300 last:border-0">
                <div>
                  <div className="font-medium text-[15px]">{n}</div>
                  <div className="text-[13px] text-ink-500 mt-1">{m}</div>
                </div>
                <div className="w-32 h-1.5 bg-cream-200 rounded overflow-hidden">
                  <div className="h-full bg-forest-700 rounded" style={{ width: `${p}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-24 sm:py-32 px-4 sm:px-8 max-w-[900px] mx-auto">
        <h2 className="mb-6">
          Your future is not<br />a multiple choice question.<br />
          <span className="italic-serif">But we can help.</span>
        </h2>
        <p className="text-ink-500 text-xl mb-12">Sixty questions. Twenty minutes. A direction worth pursuing.</p>
        <Link to={dashLink} className="btn btn-primary btn-lg">Begin your assessment</Link>
      </section>

      <footer className="bg-ink-900 text-cream-200 px-4 sm:px-8 pt-16 pb-8">
        <div className="max-w-[1280px] mx-auto grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-10 lg:gap-16 pb-12 border-b border-white/10">
          <div>
            <Logo invert />
            <p className="text-cream-200 text-[15px] mt-6 max-w-[320px] leading-relaxed">
              Career and college course guidance for senior high students, built on validated psychological frameworks and modern AI.
            </p>
          </div>
          {[
            ['Platform', ['For students', 'For counselors', 'For schools', 'Pricing']],
            ['Resources', ['RIASEC explained', 'SCCT framework', 'Research papers', 'Help center']],
            ['Company', ['About', 'Privacy', 'Terms', 'Contact']]
          ].map(([h, links]) => (
            <div key={h as string}>
              <h4 className="font-mono text-xs tracking-[0.14em] uppercase text-cream-50 mb-6 font-medium">{h}</h4>
              {(links as string[]).map(l => (
                <a key={l} href="#" className="block text-cream-200 hover:text-cream-50 text-[15px] py-1.5 transition">{l}</a>
              ))}
            </div>
          ))}
        </div>
        <div className="max-w-[1280px] mx-auto mt-8 flex flex-col sm:flex-row justify-between gap-3 text-[13px] text-ink-300">
          <span>© 2026 CareerLinkAI Inc.</span>
          <span>Made with care for senior high students.</span>
        </div>
      </footer>
    </div>
  );
}
