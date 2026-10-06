const paths = {
  board: ['M3 3h18v18H3Z', 'M3 9h18M3 15h18M9 3v18M15 3v18'],
  history: ['M3 12a9 9 0 1 0 3-6', 'M3 3v6h6', 'M12 7v5l3 2'],
  chart: ['M4 4v16h17', 'm7 15 4-5 4 2 5-7'],
  chat: ['M4 4h16v12H9l-5 4Z', 'M8 8h8M8 12h5'],
  settings: [
    'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1Z',
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  ],
  plus: ['M12 5v14M5 12h14'],
  undo: ['M9 4 4 9l5 5', 'M4 9h10a6 6 0 0 1 0 12'],
  flip: ['M7 3v18m-4-4 4 4 4-4', 'M17 21V3m-4 4 4-4 4 4'],
  close: ['m6 6 12 12M18 6 6 18'],
  refresh: ['M20 7v5h-5', 'M20 12a8 8 0 1 0-2 5'],
  arrow: ['M12 20V4m-6 6 6-6 6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-up': ['m6 15 6-6 6 6'],
  panel: ['M3 4h18v16H3Z', 'M9 4v16'],
  check: ['m5 12 4 4L19 6'],
  book: ['M3 4h6l3 2 3-2h6v15h-6l-3 2-3-2H3Z', 'M12 6v15'],
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="icon"
    >
      {paths[name].map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
