import { cn } from '@/lib/utils';

type InkLogoProps = {
  className?: string;
  iconClassName?: string;
};

export function InkLogo({ className, iconClassName }: InkLogoProps) {
  return (
    <span
      className={cn(
        'relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#7337F2] shadow-[0_0_24px_rgba(115,55,242,0.35)]',
        className
      )}
      aria-label="Ink"
      role="img"
    >
      <svg viewBox="0 0 48 48" className={cn('h-7 w-7', iconClassName)} aria-hidden="true">
        <circle cx="24" cy="24" r="17.8" fill="#fff" />
        <path
          d="M14 14.4h12.4c2.9 0 4.5 1.5 4.5 3.5s-1.6 3.5-4.5 3.5h-8.3c-2.6 0-4.1 1.4-4.1 3.2s1.5 3.2 4.1 3.2h12.6c2.8 0 4.4 1.5 4.4 3.4s-1.6 3.4-4.4 3.4H20.4c-2.8 0-4.3 1.5-4.3 3.4 0 1.9 1.5 3.4 4.3 3.4h5.8c2.9 0 4.5 1.5 4.5 3.4 0 1.9-1.6 3.4-4.5 3.4H24c-9.9 0-17.8-8-17.8-17.8S14.1 6.2 24 6.2c2.6 0 4.1 1.4 4.1 3.2s-1.5 3.2-4.1 3.2H14c-2.9 0-4.5.4-4.5 1s1.6 0.8 4.5 0.8Z"
          fill="#7337F2"
          transform="translate(0 0) scale(.93) translate(1.7 1.7)"
        />
      </svg>
    </span>
  );
}
