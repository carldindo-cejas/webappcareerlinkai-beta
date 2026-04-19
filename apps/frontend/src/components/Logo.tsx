import { Link } from 'react-router-dom';

type Props = {
  to?: string;
  invert?: boolean;
  size?: 'sm' | 'md' | 'lg';
};

export default function Logo({ to = '/', invert = false, size = 'md' }: Props) {
  const mark = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-8 h-8' : 'w-[26px] h-[26px]';
  const text = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-xl';
  const textColor = invert ? 'text-cream-50' : 'text-forest-700';
  const markBg = invert ? 'bg-cream-100' : 'bg-forest-700';
  const innerBg = invert ? 'after:bg-terracotta-400' : 'after:bg-terracotta-600';

  return (
    <Link
      to={to}
      className={`font-display font-medium tracking-tight inline-flex items-center gap-2 ${textColor} ${text} no-underline`}
    >
      <span
        className={`${mark} ${markBg} relative inline-block -rotate-45 rounded-[50%_50%_50%_0] after:content-[''] after:absolute after:inset-[6px] after:rounded-[50%_50%_50%_0] ${innerBg}`}
      />
      CareerLinkAI
    </Link>
  );
}
