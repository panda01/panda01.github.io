import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Typography } from '@mui/material';
import { formatMenuBarClock } from './menu-bar-clock-format.mts';

/**
 * The menu bar clock ("Sun Oct 11 9:41 AM"), refreshed every second so the minute flips on time.
 * @returns The clock.
 */
export function MenuBarClock(): JSX.Element {
  const [currentTime, setCurrentTime] = useState(() => new Date());

  useEffect(() => {
    const clockTimerId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => {
      clearInterval(clockTimerId);
    };
  }, []);

  return (
    <Typography
      component="time"
      dateTime={currentTime.toISOString()}
      sx={{ fontSize: 13, px: 1, whiteSpace: 'nowrap' }}
    >
      {formatMenuBarClock(currentTime)}
    </Typography>
  );
}
