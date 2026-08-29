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

	if (!cover || !backdrop || !title || !author || !previous || !play || !next || !playIcon || !pauseIcon || !progress) return;

	root.dataset.initialized = 'true';
	const controller = getMusicController();
	let latestState = controller.getState();

	const updateVisibility = () => {
		const onMusicPage = location.pathname === '/music' || location.pathname === '/music/';
		const visible = Boolean(latestState.currentTrack) && !onMusicPage;
		root.dataset.visible = String(visible);
		document.documentElement.dataset.musicCapsuleVisible = String(visible);
		root.inert = !visible;
		root.setAttribute('aria-hidden', String(!visible));
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

		playIcon.toggleAttribute('hidden', state.playing);
		pauseIcon.toggleAttribute('hidden', !state.playing);
		play.setAttribute('aria-label', state.playing ? '暂停' : '播放');
		const ratio = state.duration > 0 ? Math.min(100, (state.currentTime / state.duration) * 100) : 0;
		progress.style.setProperty('--mini-progress', `${ratio}%`);
		updateVisibility();
	};

	const unsubscribe = controller.subscribe((state) => render(state));
	root.addEventListener('click', (event) => {
		if (event.detail === 0 || !window.matchMedia('(hover: none), (pointer: coarse)').matches || root.dataset.expanded === 'true') return;
		if (!(event.target as Element).closest('.mini-track')) return;
		event.preventDefault();
		root.dataset.expanded = 'true';
	});
	const collapseOnOutsidePointer = (event: PointerEvent) => {
		if (!root.contains(event.target as Node)) root.dataset.expanded = 'false';
	};
	document.addEventListener('pointerdown', collapseOnOutsidePointer);
	previous.addEventListener('click', () => controller.previous());
	play.addEventListener('click', () => controller.togglePlayback());
	next.addEventListener('click', () => controller.next());
	document.addEventListener('astro:before-swap', () => {
		unsubscribe();
		document.removeEventListener('pointerdown', collapseOnOutsidePointer);
	}, { once: true });
};

initMiniPlayer();
document.addEventListener('astro:page-load', initMiniPlayer);
