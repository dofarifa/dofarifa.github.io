import {
	getMusicController,
	type MusicControllerReason,
	type MusicControllerState,
	type MusicTrack,
} from './music-controller';

interface LyricLine {
	time: number;
	text: string;
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const parseLyrics = (rawLyrics: string): LyricLine[] => {
	const lines: LyricLine[] = [];
	const timePattern = /\[(\d{1,3}):(\d{1,2}(?:\.\d{1,3})?)\]/g;

	rawLyrics.split(/\r?\n/).forEach((row) => {
		const text = row.replace(timePattern, '').trim();
		if (!text) return;

		for (const match of row.matchAll(timePattern)) {
			const minutes = Number(match[1]);
			const seconds = Number(match[2]);
			if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) continue;
			lines.push({ time: minutes * 60 + seconds, text });
		}
	});

	return lines.sort((a, b) => a.time - b.time);
};

const formatTime = (seconds: number) => {
	if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
	const roundedSeconds = Math.floor(seconds);
	return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, '0')}`;
};

const setBackgroundImage = (element: HTMLElement, source: string) => {
	element.style.backgroundImage = source ? `url(${JSON.stringify(source)})` : '';
};

const initMusicPlayer = (root: HTMLElement) => {
	const playlistId = root.dataset.playlistId;
	if (!playlistId || root.dataset.initialized === 'true') return;

	const query = <T extends Element>(selector: string) => root.querySelector<T>(selector);
	const backdrop = query<HTMLElement>('[data-player-backdrop]');
	const controlsBackdrop = query<HTMLElement>('[data-controls-backdrop]');
	const trackList = query<HTMLElement>('[data-track-list]');
	const trackCount = query<HTMLElement>('[data-track-count]');
	const playlistSearch = query<HTMLInputElement>('[data-playlist-search]');
	const emptySearch = query<HTMLElement>('[data-empty-search]');
	const lyricsScroll = query<HTMLElement>('[data-lyrics-scroll]');
	const activeLyric = query<HTMLElement>('[data-active-lyric]');
	const lyricTitle = query<HTMLElement>('[data-lyric-title]');
	const lyricAuthor = query<HTMLElement>('[data-lyric-author]');
	const lyricCover = query<HTMLElement>('[data-lyric-cover]');
	const nowCover = query<HTMLElement>('[data-now-cover]');
	const nowTitle = query<HTMLElement>('[data-now-title]');
	const nowAuthor = query<HTMLElement>('[data-now-author]');
	const summary = query<HTMLElement>('[data-player-summary]');
	const playerState = query<HTMLElement>('[data-player-state]');
	const stateTitle = query<HTMLElement>('[data-state-title]');
	const stateMessage = query<HTMLElement>('[data-state-message]');
	const retryButton = query<HTMLButtonElement>('[data-player-retry]');
	const playButton = query<HTMLButtonElement>('[data-play-button]');
	const playIcon = query<SVGElement>('[data-play-icon]');
	const pauseIcon = query<SVGElement>('[data-pause-icon]');
	const previousButton = query<HTMLButtonElement>('[data-previous-button]');
	const nextButton = query<HTMLButtonElement>('[data-next-button]');
	const shuffleButton = query<HTMLButtonElement>('[data-shuffle-button]');
	const repeatButton = query<HTMLButtonElement>('[data-repeat-button]');
	const repeatOne = query<HTMLElement>('[data-repeat-one]');
	const progress = query<HTMLInputElement>('[data-progress]');
	const currentTime = query<HTMLTimeElement>('[data-current-time]');
	const duration = query<HTMLTimeElement>('[data-duration]');
	const muteButton = query<HTMLButtonElement>('[data-mute-button]');
	const volume = query<HTMLInputElement>('[data-volume]');
	const volumeIcon = query<SVGElement>('[data-volume-icon]');
	const mutedIcon = query<SVGElement>('[data-muted-icon]');
	const notice = query<HTMLElement>('[data-player-notice]');

	if (
		!backdrop || !controlsBackdrop || !trackList || !trackCount || !playlistSearch || !emptySearch ||
		!lyricsScroll || !activeLyric || !lyricTitle || !lyricAuthor || !lyricCover || !nowCover || !nowTitle ||
		!nowAuthor || !summary || !playerState || !stateTitle || !stateMessage || !retryButton ||
		!playButton || !playIcon || !pauseIcon || !previousButton || !nextButton || !shuffleButton ||
		!repeatButton || !repeatOne || !progress || !currentTime || !duration || !muteButton || !volume ||
		!volumeIcon || !mutedIcon || !notice
	) return;

	root.dataset.initialized = 'true';
	const controller = getMusicController();
	const customBackground = root.dataset.customBackground ?? '';
	const hasBackgroundVideo = root.dataset.hasBackgroundVideo === 'true';
	const lyricsCache = new Map<string, LyricLine[]>();
	let latestState = controller.getState();
	let currentLyrics: LyricLine[] = [];
	let activeLyricIndex = -1;
	let lyricsRequestId = 0;
	let currentTrackKey = '';
	let noticeTimer = 0;

	const showNotice = (message: string) => {
		window.clearTimeout(noticeTimer);
		notice.textContent = message;
		notice.classList.add('visible');
		noticeTimer = window.setTimeout(() => notice.classList.remove('visible'), 3600);
	};

	const setControlsEnabled = (enabled: boolean) => {
		[playButton, previousButton, nextButton, shuffleButton, repeatButton, progress, muteButton, volume]
			.forEach((control) => { control.disabled = !enabled; });
	};

	const renderLyrics = (lines: LyricLine[], placeholder = '暂无可用歌词') => {
		lyricsScroll.replaceChildren();
		activeLyric.textContent = '';
		activeLyricIndex = -1;
		currentLyrics = lines;

		if (!lines.length) {
			const empty = document.createElement('p');
			empty.className = 'lyrics-placeholder';
			empty.textContent = placeholder;
			lyricsScroll.append(empty);
			return;
		}

		const fragment = document.createDocumentFragment();
		lines.forEach((line, index) => {
			const button = document.createElement('button');
			button.type = 'button';
			button.className = 'lyric-line';
			button.dataset.lyricIndex = String(index);
			button.dataset.time = String(line.time);
			button.textContent = line.text;
			fragment.append(button);
		});
		lyricsScroll.append(fragment);
	};

	const loadLyrics = async (track: MusicTrack) => {
		const requestId = ++lyricsRequestId;
		const cachedLyrics = lyricsCache.get(track.lrc);
		if (cachedLyrics) {
			renderLyrics(cachedLyrics);
			return;
		}

		renderLyrics([], '正在读取歌词');
		if (!track.lrc) {
			renderLyrics([]);
			return;
		}

		const requestController = new AbortController();
		const timeout = window.setTimeout(() => requestController.abort(), 12_000);
		try {
			const response = await fetch(track.lrc, { signal: requestController.signal, cache: 'force-cache' });
			if (!response.ok) throw new Error('Lyric request failed');
			const lines = parseLyrics(await response.text());
			if (requestId !== lyricsRequestId) return;
			lyricsCache.set(track.lrc, lines);
			renderLyrics(lines);
		} catch {
			if (requestId === lyricsRequestId) renderLyrics([], '歌词暂时无法加载');
		} finally {
			window.clearTimeout(timeout);
		}
	};

	const renderTrackList = () => {
		const searchText = playlistSearch.value.trim().toLocaleLowerCase('zh-CN');
		const matchingTracks = latestState.tracks
			.map((track, index) => ({ track, index }))
			.filter(({ track }) => !searchText || `${track.title} ${track.author}`.toLocaleLowerCase('zh-CN').includes(searchText));

		trackList.replaceChildren();
		emptySearch.hidden = matchingTracks.length > 0;
		const fragment = document.createDocumentFragment();

		matchingTracks.forEach(({ track, index }) => {
			const item = document.createElement('button');
			item.type = 'button';
			item.className = 'track-item';
			item.dataset.trackIndex = String(index);
			if (index === latestState.currentIndex) item.setAttribute('aria-current', 'true');

			const number = document.createElement('span');
			number.className = 'track-index';
			number.textContent = String(index + 1).padStart(2, '0');
			const copy = document.createElement('span');
			copy.className = 'track-copy';
			const title = document.createElement('strong');
			title.className = 'track-title';
			title.textContent = track.title;
			const author = document.createElement('span');
			author.className = 'track-author';
			author.textContent = track.author || '未知歌手';
			copy.append(title, author);
			item.append(number, copy);
			fragment.append(item);
		});
		trackList.append(fragment);
	};

	const syncLyrics = (playbackTime: number) => {
		if (!currentLyrics.length) return;
		let nextIndex = -1;
		for (let index = currentLyrics.length - 1; index >= 0; index -= 1) {
			if (playbackTime >= currentLyrics[index].time - .08) {
				nextIndex = index;
				break;
			}
		}
		if (nextIndex === activeLyricIndex) return;

		lyricsScroll.querySelector('.lyric-line.active')?.classList.remove('active');
		activeLyricIndex = nextIndex;
		if (nextIndex < 0) return;
		const activeLine = lyricsScroll.querySelector<HTMLElement>(`[data-lyric-index="${nextIndex}"]`);
		if (!activeLine) return;
		activeLine.classList.add('active');
		activeLyric.textContent = activeLine.textContent ?? '';
		lyricsScroll.scrollTo({
			top: Math.max(0, activeLine.offsetTop - lyricsScroll.clientHeight / 2 + activeLine.offsetHeight / 2),
			behavior: prefersReducedMotion.matches ? 'auto' : 'smooth',
		});
	};

	const updateTrackDetails = (track: MusicTrack) => {
		lyricTitle.textContent = track.title;
		lyricAuthor.textContent = track.author || '未知歌手';
		nowTitle.textContent = track.title;
		nowAuthor.textContent = track.author || '未知歌手';
		setBackgroundImage(lyricCover, track.pic);
		setBackgroundImage(nowCover, track.pic);
		setBackgroundImage(controlsBackdrop, track.pic);
		if (!customBackground || hasBackgroundVideo) setBackgroundImage(backdrop, track.pic);
		if (customBackground && !hasBackgroundVideo) setBackgroundImage(backdrop, customBackground);
		void loadLyrics(track);
	};

	const renderControllerState = (state: MusicControllerState, reason: MusicControllerReason) => {
		latestState = state;
		const ready = state.status === 'ready' && state.tracks.length > 0;
		setControlsEnabled(ready);
		trackCount.textContent = `${state.tracks.length} 首`;
		summary.textContent = ready ? `${state.tracks.length} 首收藏 · 点击歌曲开始播放` : '正在读取你的网易云收藏';

		playerState.hidden = ready;
		retryButton.hidden = state.status !== 'error';
		if (state.status === 'loading' || state.status === 'idle') {
			stateTitle.textContent = '正在加载歌单';
			stateMessage.textContent = '第一次读取可能需要一点时间';
		} else if (state.status === 'error') {
			stateTitle.textContent = '歌单暂时无法加载';
			stateMessage.textContent = state.message;
		}

		const track = state.currentTrack;
		const trackKey = track ? `${state.currentIndex}:${track.url}` : '';
		if (track && trackKey !== currentTrackKey) {
			currentTrackKey = trackKey;
			updateTrackDetails(track);
			renderTrackList();
		} else if (reason === 'playlist' || reason === 'init') {
			renderTrackList();
		}

		playIcon.dataset.iconHidden = String(state.playing);
		pauseIcon.dataset.iconHidden = String(!state.playing);
		playButton.setAttribute('aria-label', state.playing ? '暂停' : '播放');
		currentTime.textContent = formatTime(state.currentTime);
		duration.textContent = formatTime(state.duration);
		progress.value = state.duration > 0 ? String((state.currentTime / state.duration) * 100) : '0';
		syncLyrics(state.currentTime);

		shuffleButton.classList.toggle('active', state.shuffleEnabled);
		shuffleButton.setAttribute('aria-pressed', String(state.shuffleEnabled));
		repeatButton.classList.toggle('active', state.repeatSingle);
		repeatButton.setAttribute('aria-pressed', String(state.repeatSingle));
		repeatButton.title = state.repeatSingle ? '单曲循环' : '列表循环';
		repeatOne.hidden = !state.repeatSingle;

		volume.value = String(state.volume);
		const isMuted = state.muted || state.volume === 0;
		volumeIcon.dataset.iconHidden = String(isMuted);
		mutedIcon.dataset.iconHidden = String(!isMuted);
		muteButton.setAttribute('aria-label', isMuted ? '取消静音' : '静音');

		if (reason === 'status' && state.status === 'ready' && state.message) showNotice(state.message);
	};

	const unsubscribe = controller.subscribe(renderControllerState);

	trackList.addEventListener('click', (event) => {
		const item = (event.target as Element).closest<HTMLButtonElement>('[data-track-index]');
		const index = Number(item?.dataset.trackIndex);
		if (Number.isInteger(index)) controller.selectTrack(index, true);
	});
	lyricsScroll.addEventListener('click', (event) => {
		const line = (event.target as Element).closest<HTMLButtonElement>('[data-time]');
		const time = Number(line?.dataset.time);
		if (Number.isFinite(time)) controller.seekToTime(time);
	});
	playlistSearch.addEventListener('input', renderTrackList);
	retryButton.addEventListener('click', () => void controller.loadPlaylist(playlistId, true).catch(() => undefined));
	playButton.addEventListener('click', () => controller.togglePlayback());
	previousButton.addEventListener('click', () => controller.previous());
	nextButton.addEventListener('click', () => controller.next());
	shuffleButton.addEventListener('click', () => {
		const enabled = controller.toggleShuffle();
		showNotice(enabled ? '已开启随机播放' : '已关闭随机播放');
	});
	repeatButton.addEventListener('click', () => {
		const enabled = controller.toggleRepeat();
		showNotice(enabled ? '已开启单曲循环' : '已切换为列表循环');
	});
	progress.addEventListener('input', () => controller.seekToRatio(Number(progress.value) / 100));
	volume.addEventListener('input', () => controller.setVolume(Number(volume.value)));
	muteButton.addEventListener('click', () => controller.toggleMute());

	root.querySelectorAll<HTMLButtonElement>('[data-pane-target]').forEach((button) => {
		button.addEventListener('click', () => {
			const pane = button.dataset.paneTarget;
			if (pane !== 'playlist' && pane !== 'lyrics') return;
			root.dataset.mobilePane = pane;
			root.querySelectorAll<HTMLButtonElement>('[data-pane-target]').forEach((tab) => {
				tab.setAttribute('aria-pressed', String(tab === button));
			});
		});
	});

	document.addEventListener('astro:before-swap', () => {
		unsubscribe();
		window.clearTimeout(noticeTimer);
	}, { once: true });

	void controller.loadPlaylist(playlistId).catch(() => undefined);
};

const initMusicPlayers = () => {
	document.querySelectorAll<HTMLElement>('[data-music-player]').forEach(initMusicPlayer);
};

initMusicPlayers();
document.addEventListener('astro:page-load', initMusicPlayers);
