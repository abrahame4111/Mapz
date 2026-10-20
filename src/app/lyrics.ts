import { LyricsView } from '../hud/lyricsView';
import { positionMs } from '../lyrics/lrc';
import type { LyricsProvider, NowPlaying, NowPlayingSource } from '../lyrics/types';

export interface LyricsOptions {
  /** Where "what is playing" comes from. Undefined until a real source (Spotify) is connected. */
  source: NowPlayingSource | undefined;
  provider: LyricsProvider;
}

const el = (id: string): HTMLElement => document.getElementById(id)!;

/**
 * Lyrics mode: the music button (slot 3) turns the right panel into the lyrics card. We only ask the source what is
 * playing while the card is open, and look up lyrics once per song.
 */
export function setupLyrics(opts: LyricsOptions): { tick: (nowMs: number) => void; readonly active: boolean } {
  const view = new LyricsView();
  const btn = el('btn-lyrics');
  let active = false;
  let np: NowPlaying | null = null;
  let loadedId: string | undefined;

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
        if (loadedId === track.id) view.setStatus('Lyrics unavailable. Check the internet connection.');
      },
    );
  };

  const onNowPlaying = (next: NowPlaying | null): void => {
    np = next;
    if (!next) {
      loadedId = undefined;
      view.setSong('', '');
      view.setStatus('Nothing playing. Start a song in Spotify on your phone.');
      return;
    }
    if (next.id !== loadedId) load(next);
  };

  const setActive = (on: boolean): void => {
    active = on;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', String(on));
    view.show(on);
    if (!on) {
      opts.source?.stop();
      return;
    }
    if (!opts.source) {
      view.setSong('', '');
      view.setStatus('Spotify is not connected yet.');
      return;
    }
    view.setStatus('Looking for the current song...');
    opts.source.start(onNowPlaying);
  };

  btn.addEventListener('click', () => setActive(!active));

  return {
    get active(): boolean {
      return active;
    },
    tick(nowMs: number): void {
      if (!active || !np) return;
      view.setPosition(positionMs(np.progressMs, np.sampledAt, nowMs, np.isPlaying, np.durationMs));
    },
  };
}
