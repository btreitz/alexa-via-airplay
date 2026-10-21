const BAR_DELAYS = [0, 0.2, 0.4];

export function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-0.5" aria-hidden>
      {BAR_DELAYS.map((delay) => (
        <span
          key={delay}
          className="h-full w-0.5 origin-bottom rounded-full bg-current"
          style={{ animation: `equalizer 0.9s ease-in-out ${delay}s infinite` }}
        />
      ))}
    </span>
  );
}
