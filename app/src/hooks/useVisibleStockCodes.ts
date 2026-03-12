import { useEffect, useMemo, useRef, useState } from 'react';

interface UseVisibleStockCodesOptions {
  rootMargin?: string;
  threshold?: number | number[];
  fallbackCount?: number;
}

function areCodeListsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false;
  }

  return true;
}

export function useVisibleStockCodes(
  tsCodes: string[],
  options: UseVisibleStockCodesOptions = {},
) {
  const {
    rootMargin = '120px 0px 120px 0px',
    threshold = 0.2,
    fallbackCount = 12,
  } = options;
  const containerRef = useRef<HTMLElement | null>(null);
  const [visibleCodes, setVisibleCodes] = useState<string[]>([]);
  const codeSignature = tsCodes.join('|');
  const normalizedCodes = useMemo(
    () => Array.from(new Set(tsCodes.filter(Boolean))),
    [codeSignature],
  );

  useEffect(() => {
    setVisibleCodes((previous) => {
      const filtered = previous.filter((code) => normalizedCodes.includes(code));
      return areCodeListsEqual(previous, filtered) ? previous : filtered;
    });
  }, [normalizedCodes]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || normalizedCodes.length === 0) {
      setVisibleCodes((previous) => (previous.length === 0 ? previous : []));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisibleCodes((previous) => {
          const next = new Set(previous);

          entries.forEach((entry) => {
            const code = (entry.target as HTMLElement).dataset.stockCode;
            if (!code) return;

            if (entry.isIntersecting) {
              next.add(code);
            } else {
              next.delete(code);
            }
          });

          const filtered = Array.from(next).filter((code) => normalizedCodes.includes(code));
          return areCodeListsEqual(previous, filtered) ? previous : filtered;
        });
      },
      { root: null, rootMargin, threshold },
    );

    const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-stock-code]'));
    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, [normalizedCodes, rootMargin, threshold]);

  const activeCodes = useMemo(() => {
    if (visibleCodes.length > 0) {
      return visibleCodes;
    }
    return normalizedCodes.slice(0, Math.min(fallbackCount, normalizedCodes.length));
  }, [fallbackCount, normalizedCodes, visibleCodes]);

  return {
    containerRef,
    visibleCodes: activeCodes,
  };
}