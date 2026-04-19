import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { useAuth } from '../lib/auth';

export default function StartEvaluation() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <TopNav />

      <main className="max-w-[900px] mx-auto px-4 sm:px-8 py-16 sm:py-24">
        <div className="text-center mb-16 sm:mb-20">
          <span className="eyebrow block mb-6">Ready to explore?</span>
          <h1 className="text-4xl sm:text-5xl leading-[1.1] mb-6">
            Welcome, <span className="italic-serif">{user?.name}.</span>
          </h1>
          <p className="text-ink-500 text-lg leading-relaxed max-w-[640px] mx-auto">
            Your profile is set. Now let's discover which college courses and careers are the best fit for who you are.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              num: '01',
              title: 'Answer 48 questions',
              desc: 'Our RIASEC assessment uncovers the activities and environments where you naturally thrive.'
            },
            {
              num: '02',
              title: 'Reflect on your future',
              desc: 'Twelve more questions explore your confidence and the obstacles you might face.'
            },
            {
              num: '03',
              title: 'Get your results',
              desc: 'Discover your Holland code and personalized course and career recommendations.'
            }
          ].map(step => (
            <div key={step.num} className="bg-white border border-cream-300 rounded-lg p-6 sm:p-8">
              <div className="font-display text-5xl leading-none text-terracotta-600 mb-4">{step.num}</div>
              <h3 className="text-lg font-medium mb-2">{step.title}</h3>
              <p className="text-sm text-ink-500 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        <div className="bg-forest-700 text-cream-50 rounded-lg p-8 sm:p-12 relative overflow-hidden mb-12">
          <div className="absolute -top-20 -right-20 w-80 h-80 border border-cream-100/10 rounded-full pointer-events-none" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 border border-cream-100/5 rounded-full pointer-events-none" />
          <div className="relative z-10 max-w-[560px]">
            <h2 className="text-3xl leading-[1.1] mb-4">
              Takes about <span className="italic-serif font-display">20 minutes.</span>
            </h2>
            <p className="text-cream-200 leading-relaxed mb-8">
              Be honest with yourself. There are no right or wrong answers—we're looking for genuine insights into how you think about your future and what matters to you.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/onboarding')}
                className="bg-terracotta-400 hover:bg-terracotta-600 text-ink-900 font-medium px-8 py-4 rounded-lg transition inline-block"
              >
                Begin Evaluation
              </button>
              <button
                type="button"
                onClick={() => navigate('/portal/student/dashboard')}
                className="bg-transparent border border-cream-100/40 hover:border-cream-50 text-cream-50 font-medium px-8 py-4 rounded-lg transition"
              >
                Evaluate Later
              </button>
            </div>
          </div>
        </div>

        <div className="bg-cream-50 border border-cream-300 rounded-lg p-6 sm:p-8">
          <h3 className="font-medium mb-3">Your data is private</h3>
          <p className="text-sm text-ink-500 leading-relaxed">
            Your assessment responses, results, and profile are only visible to you and your school's guidance counselors. We never share your data with third parties.
          </p>
        </div>
      </main>
    </div>
  );
}
