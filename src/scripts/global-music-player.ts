import { getMusicController, type MusicControllerState } from './music-controller';

const setBackgroundImage = (element: HTMLElement, source: string) => {
	element.style.backgroundImage = source ? `url(${JSON.stringify(source)})` : '';
};

const initMiniPlayer = () => {
	const root = document.querySelector<HTMLElement>('[data-mini-player]');
	if (!root || root.dataset.initialized === 'true') return;

	const cover = root.querySelector<HTMLElement>('[data-mini-cover]');
	const backdrop = root.querySelector<HTMLElement>('[data-mini-backdrop]');
	const title = root.querySelector<HTMLElement>('[data-mini-title]');
	const author = root.querySelector<HTMLElement>('[data-mini-author]');
	const previous = root.querySelector<HTMLButtonElement>('[data-mini-previous]');
	const play = root.querySelector<HTMLButtonElement>('[data-mini-play]');
	const next = root.querySelector<HTMLButtonElement>('[data-mini-next]');
	const playIcon = root.querySelector<SVGElement>('[data-mini-play-icon]');
	const pauseIcon = root.querySelector<SVGElement>('[data-mini-pause-icon]');
	const progress = root.querySelector<HTMLElement>('[data-mini-progress]');
	const playlistId = root.dataset.playlistId;

	if (!cover || !backdrop || !title || !author || !previous || !play || !next || !playIcon || !pauseIcon || !progress) return;

	root.dataset.initialized = 'true';
	const controller = getMusicController();
	let latestState = controller.getState();
	let preloadRequested = false;

	const updateVisibility = () => {
		const onMusicPage = location.pathname === '/music' || location.pathname === '/music/';
		const visible = latestState.hasPlaybackSession && Boolean(latestState.currentTrack) && !onMusicPage;
		root.dataset.visible = String(visible);
		document.documentElement.dataset.musicCapsuleVisible = String(visible);
		root.inert = !visible;
		root.setAttribute('aria-hidden', String(!visible));
	};

	const preloadPlaylist = () => {
		if (!playlistId || preloadRequested) return;
		preloadRequested = true;
		void controller.loadPlaylist(playlistId).catch(() => undefined);
	};

	const schedulePlaylistPreload = () => {
		const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
		if (connection?.saveData || /2g/.test(connection?.effectiveType ?? '')) return;

		const idle = (window as Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
		const run = () => {
			if (document.hidden) return;
			preloadPlaylist();
		};
		if (idle) {
			idle(run, { timeout: 4200 });
			return;
		}

		window.setTimeout(run, 2600);
	};

	const render = (state: MusicControllerState) => {
		latestState = state;
		const track = state.currentTrack;
		if (track) {
			title.textContent = track.title;
			author.textContent = track.author || '未知歌手';
			setBackgroundImage(cover, track.pic);
			setBackgroundImage(backdrop, track.pic);
		}

		playIcon.dataset.iconHidden = String(state.playing);
		pauseIcon.dataset.iconHidden = String(!state.playing);
		play.setAttribute('aria-label', state.playing ? '暂停' : '播放');
		const ratio = state.duration > 0 ? Math.min(100, (state.currentTime / state.duration) * 100) : 0;
		progress.style.setProperty('--mini-progress', `${ratio}%`);
		updateVisibility();
	};

	const unsubscribe = controller.subscribe((state) => render(state));
	const bindControl = (button: HTMLButtonElement, action: () => void) => {
		button.addEventListener('click', (event) => {
			event.preventDefault();
			event.stopPropagation();
			action();
		});
	};

	bindControl(previous, () => controller.previous());
	bindControl(play, () => controller.togglePlayback());
	bindControl(next, () => controller.next());
	document.addEventListener('astro:before-swap', () => {
		unsubscribe();
	}, { once: true });

	schedulePlaylistPreload();
};

initMiniPlayer();
document.addEventListener('astro:page-load', initMiniPlayer);
