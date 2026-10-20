import { LyricsView } from '../hud/lyricsView';
import { positionMs } from '../lyrics/lrc';
import type { PairResult } from '../spotify/pairing';
import type { LyricsProvider, NowPlaying, NowPlayingSource, SourceProblem } from '../lyrics/types';

export interface LyricsOptions {
  /** Where "what is playing" comes from. Undefined when no source is configured (no Spotify Client ID). */
  source: NowPlayingSource | undefined;
  provider: LyricsProvider;
  /** Starts the Spotify login (leaves the app for Spotify's page and returns). */
  connect?: () => void;
  /** Phone-based login (preferred when available): shows a code, the user logs in on their phone. */
  pairing?: { run(onCode: (code: string) => void): Promise<PairResult>; cancel(): void; readonly active: boolean };
  /** Logging in needs typing, so it is blocked while the car moves. */
  canConnect?: () => boolean;
  toast?: (msg: string) => void;
}

const el = (id: string): HTMLElement => document.getElementById(id)!;

/**
 * Lyrics mode: the music button (slot 3) turns the right panel into the lyrics card. We only ask the source what is
 * playing while the card is open, and look up lyrics once per song.
 */
export function setupLyrics(opts: LyricsOptions): {
  tick: (nowMs: number) => void;
  /** Open the card, optionally with a message (e.g. "Login was cancelled") shown if a login is needed. */
  open: (notice?: string) => void;
  readonly active: boolean;
} {
  const view = new LyricsView();
  const btn = el('btn-lyrics');
  const connectBtn = el('lyr-connect');
  const pairBox = el('lyr-pair');
  const pairCode = el('lyr-pair-code');
  let active = false;
  let np: NowPlaying | null = null;
  let loadedId: string | undefined;
  let notice: string | undefined;

  const load = (track: NowPlaying): void => {
    loadedId = track.id;
    view.setSong(track.title, track.artist);
    view.setStatus('Searching lyrics...');
    opts.provider.get(track).then(
      (lyrics) => {
        if (loadedId !== track.id) return; // the song changed while we were waiting
        view.setLyrics(lyrics);
      },
      () => {
        if (loadedId === track.id) view.setStatus('Lyrics service is not answering right now. Try again in a moment.');
      },
    );
  };

  const onNowPlaying = (next: NowPlaying | null): void => {
    connectBtn.hidden = true;
    notice = undefined;
    np = next;
    if (!next) {
      loadedId = undefined;
      view.setSong('', '');
      view.setStatus('Nothing playing. Start a song in Spotify on your phone.');
      return;
    }
    if (next.id !== loadedId) load(next);
  };

  const onProblem = (p: SourceProblem): void => {
    if (p === 'needs-login') {
      np = null;
      loadedId = undefined;
      view.setSong('', '');
      view.setStatus(notice ?? 'Connect your Spotify account to see lyrics.');
      connectBtn.hidden = !opts.connect;
      return;
    }
    // A network blip while lyrics are on screen should not wipe them; only say so if there is nothing to show.
    if (loadedId === undefined) {
      view.setStatus("Can't reach Spotify. Check the internet connection.");
      connectBtn.hidden = true;
    }
  };

  const showPairing = (on: boolean): void => {
    pairBox.hidden = !on;
    connectBtn.textContent = on ? 'Cancel' : 'Connect Spotify';
  };

  const startPairing = (): void => {
    const pairing = opts.pairing!;
    view.setStatus('');
    connectBtn.hidden = false;
    void pairing
      .run((code) => {
        pairCode.textContent = code;
        showPairing(true);
      })
      .then((res) => {
        showPairing(false);
        if (res === 'cancelled') {
          if (active) view.setStatus('Connect your Spotify account to see lyrics.');
          return;
        }
        if (res === 'ok') {
          if (active) {
            opts.source?.stop();
            connectBtn.hidden = true;
            view.setStatus('Looking for the current song...');
            opts.source?.start(onNowPlaying, onProblem);
          }
          return;
        }
        notice = res.error;
        if (active) view.setStatus(res.error);
      });
  };

  const setActive = (on: boolean): void => {
    active = on;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    view.show(on);
    connectBtn.hidden = true;
    if (!on) {
      opts.pairing?.cancel();
      showPairing(false);
      opts.source?.stop();
      return;
    }
    if (!opts.source) {
      view.setSong('', '');
      view.setStatus('Spotify is not set up in this build.');
      return;
    }
    view.setStatus('Looking for the current song...');
    opts.source.start(onNowPlaying, onProblem);
  };

  btn.addEventListener('click', () => setActive(!active));
  connectBtn.addEventListener('click', () => {
    if (opts.pairing?.active) {
      opts.pairing.cancel();
      return;
    }
    if (opts.canConnect && !opts.canConnect()) {
      opts.toast?.('Stop the car to connect Spotify');
      return;
    }
    if (opts.pairing) startPairing();
    else opts.connect?.();
  });

  return {
    get active(): boolean {
      return active;
    },
    open(msg?: string): void {
      notice = msg;
      if (!active) setActive(true);
    },
    tick(nowMs: number): void {
      if (!active || !np) return;
      view.setPosition(positionMs(np.progressMs, np.sampledAt, nowMs, np.isPlaying, np.durationMs));
    },
  };
}
