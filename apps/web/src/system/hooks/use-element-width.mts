import { useEffect, useState } from 'react';

/**
 * Measures an element's width and keeps measuring as it resizes (for example to fit PDF pages to
 * the Quick Look window).
 * @returns A ref callback for the element, and its width in whole pixels (undefined until known).
 */
export function useElementWidth(): [(element: HTMLElement | null) => void, number | undefined] {
  const [measuredElement, setMeasuredElement] = useState<HTMLElement | null>(null);
  const [elementWidth, setElementWidth] = useState<number>();

  useEffect(() => {
    if (measuredElement === null) {
      return undefined;
    }
    const widthObserver = new ResizeObserver((observedEntries) => {
      const observedWidth = observedEntries[0]?.contentRect.width;
      if (observedWidth !== undefined && observedWidth > 0) {
        setElementWidth(Math.round(observedWidth));
      }
    });
    widthObserver.observe(measuredElement);
    return () => {
      widthObserver.disconnect();
    };
  }, [measuredElement]);

  return [setMeasuredElement, elementWidth];
}
