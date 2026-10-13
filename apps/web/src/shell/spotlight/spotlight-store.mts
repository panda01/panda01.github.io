import { create } from 'zustand';

/** Whether Spotlight is open, and the actions that open and close it. */
export interface SpotlightState {
  isSpotlightOpen: boolean;
  openSpotlight: () => void;
  closeSpotlight: () => void;
  /** What ⌥Space does: opens Spotlight, or closes it when it is open. */
  toggleSpotlight: () => void;
}

/** Global store for Spotlight, shared by the menu bar button and the keyboard shortcut. */
export const useSpotlightStore = create<SpotlightState>()((setState) => ({
  isSpotlightOpen: false,
  /**
   * Opens Spotlight.
   */
  openSpotlight: () => {
    setState({ isSpotlightOpen: true });
  },
  /**
   * Closes Spotlight.
   */
  closeSpotlight: () => {
    setState({ isSpotlightOpen: false });
  },
  /**
   * Opens Spotlight, or closes it when it is open.
   */
  toggleSpotlight: () => {
    setState((currentState) => ({ isSpotlightOpen: !currentState.isSpotlightOpen }));
  },
}));
