interface MusicTrack {
	title: string;
	author: string;
	url: string;
	pic: string;
	lrc: string;
}

interface LyricLine {
	time: number;
	text: string;
}

interface PlaylistCache {
	expiresAt: number;
	tracks: MusicTrack[];
}

const API_BASE = 'https://api.i-meto.com/meting/api';
const CACHE_TTL = 2 * 60 * 60 * 1000;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const asString = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const parseTracks = (value: unknown): MusicTrack[] => {
	if (!Array.isArray(value)) return [];

	return value.flatMap((item) => {
		if (!item || typeof item !== 'object') return [];
		const data = item as Record<string, unknown>;
		const track = {
			title: asString(data.title),
			author: asString(data.author),
			url: asString(data.url),
			pic: asString(data.pic),
			lrc: asString(data.lrc),
		};

		return track.title && track.url ? [track] : [];
	});
};

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
	if (!playlistId) return;

	const query = <T extends Element>(selector: string) => root.querySelector<T>(selector);
	const audio = query<HTMLAudioElement>('[data-audio]');
	const backdrop = query<HTMLElement>('[data-player-backdrop]');
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
		!audio || !backdrop || !trackList || !trackCount || !playlistSearch || !emptySearch ||
		!lyricsScroll || !activeLyric || !lyricTitle || !lyricAuthor || !lyricCover || !nowCover || !nowTitle ||
		!nowAuthor || !summary || !playerState || !stateTitle || !stateMessage || !retryButton ||
		!playButton || !playIcon || !pauseIcon || !previousButton || !nextButton || !shuffleButton ||
		!repeatButton || !repeatOne || !progress || !currentTime || !duration || !muteButton || !volume ||
		!volumeIcon || !mutedIcon || !notice
	) return;

	const customBackground = root.dataset.customBackground ?? '';
	const hasBackgroundVideo = root.dataset.hasBackgroundVideo === 'true';
	const lyricsCache = new Map<string, LyricLine[]>();
	const cacheKey = `kkkk:music-playlist:${playlistId}`;
	let tracks: MusicTrack[] = [];
	let currentTrackIndex = 0;
	let currentLyrics: LyricLine[] = [];
	let activeLyricIndex = -1;
	let lyricsRequestId = 0;
	let loadingPlaylist = false;
	let shuffleEnabled = false;
	let repeatSingle = false;
	let noticeTimer = 0;

	const showNotice = (message: string) => {
		window.clearTimeout(noticeTimer);
		notice.textContent = message;
		notice.classList.add('visible');
		noticeTimer = window.setTimeout(() => notice.classList.remove('visible'), 3600);
	};

	const setPlayerState = (state: 'loading' | 'ready' | 'error', title = '', message = '') => {
		root.dataset.state = state;
		playerState.hidden = state === 'ready';
		retryButton.hidden = state !== 'error';
		if (title) stateTitle.textContent = title;
		if (message) stateMessage.textContent = message;
	};

	const setControlsEnabled = (enabled: boolean) => {
		[playButton, previousButton, nextButton, shuffleButton, repeatButton, progress, muteButton, volume]
			.forEach((control) => { control.disabled = !enabled; });
	};

	const readCache = (): MusicTrack[] => {
		try {
			const value = localStorage.getItem(cacheKey);
			if (!value) return [];
			const parsed = JSON.parse(value) as PlaylistCache;
			if (!parsed || parsed.expiresAt < Date.now()) return [];
			return parseTracks(parsed.tracks);
		} catch {
			return [];
		}
	};

	const writeCache = (playlistTracks: MusicTrack[]) => {
		try {
			localStorage.setItem(cacheKey, JSON.stringify({ expiresAt: Date.now() + CACHE_TTL, tracks: playlistTracks }));
		} catch {
			// Local storage is an optional performance enhancement.
		}
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

		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 12_000);
		try {
			const response = await fetch(track.lrc, { signal: controller.signal, cache: 'force-cache' });
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

	const updateMediaSession = (track: MusicTrack) => {
		if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.author,
			artwork: track.pic ? [{ src: track.pic }] : [],
		});
	};

	const renderTrackList = () => {
		const searchText = playlistSearch.value.trim().toLocaleLowerCase('zh-CN');
		const matchingTracks = tracks
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
			if (index === currentTrackIndex) item.setAttribute('aria-current', 'true');

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

	const updatePlayState = (playing: boolean) => {
		playIcon.hidden = playing;
		pauseIcon.hidden = !playing;
		playButton.setAttribute('aria-label', playing ? '暂停' : '播放');
		root.dataset.playing = String(playing);
	};

	const syncLyrics = () => {
		if (!currentLyrics.length) return;
		let nextIndex = -1;
		for (let index = currentLyrics.length - 1; index >= 0; index -= 1) {
			if (audio.currentTime >= currentLyrics[index].time - .08) {
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

	const playCurrentTrack = async () => {
		try {
			await audio.play();
		} catch {
			showNotice('浏览器暂时无法播放这首歌，请尝试切换歌曲。');
		}
	};

	const selectTrack = (index: number, shouldPlay: boolean) => {
		if (!tracks.length) return;
		const normalizedIndex = (index + tracks.length) % tracks.length;
		const track = tracks[normalizedIndex];
		currentTrackIndex = normalizedIndex;
		audio.src = track.url;
		audio.load();
		lyricTitle.textContent = track.title;
		lyricAuthor.textContent = track.author || '未知歌手';
		nowTitle.textContent = track.title;
		nowAuthor.textContent = track.author || '未知歌手';
		setBackgroundImage(lyricCover, track.pic);
		setBackgroundImage(nowCover, track.pic);
		if (!customBackground || hasBackgroundVideo) setBackgroundImage(backdrop, track.pic);
		if (customBackground && !hasBackgroundVideo) setBackgroundImage(backdrop, customBackground);
		progress.value = '0';
		currentTime.textContent = '0:00';
		duration.textContent = '0:00';
		renderTrackList();
		loadLyrics(track);
		updateMediaSession(track);
		if (shouldPlay) playCurrentTrack();
	};

	const getNextIndex = (direction: 1 | -1) => {
		if (!shuffleEnabled || tracks.length < 2) return currentTrackIndex + direction;
		let index = currentTrackIndex;
		while (index === currentTrackIndex) index = Math.floor(Math.random() * tracks.length);
		return index;
	};

	const hydratePlaylist = (playlistTracks: MusicTrack[]) => {
		tracks = playlistTracks;
		trackCount.textContent = `${tracks.length} 首`;
		summary.textContent = `${tracks.length} 首收藏 · 点击歌曲开始播放`;
		setControlsEnabled(true);
		setPlayerState('ready');
		selectTrack(0, false);
	};

	const loadPlaylist = async (forceRefresh = false) => {
		if (loadingPlaylist) return;
		loadingPlaylist = true;
		setControlsEnabled(false);
		setPlayerState('loading', '正在加载歌单', '第一次读取可能需要一点时间');

		try {
			const cachedTracks = forceRefresh ? [] : readCache();
			if (cachedTracks.length) {
				hydratePlaylist(cachedTracks);
				return;
			}

			const endpoint = new URL(API_BASE);
			endpoint.searchParams.set('server', 'netease');
			endpoint.searchParams.set('type', 'playlist');
			endpoint.searchParams.set('id', playlistId);
			const controller = new AbortController();
			const timeout = window.setTimeout(() => controller.abort(), 30_000);
			let response: Response;
			try {
				response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
			} finally {
				window.clearTimeout(timeout);
			}
			if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
			const playlistTracks = parseTracks(await response.json());
			if (!playlistTracks.length) throw new Error('Playlist is empty');
			writeCache(playlistTracks);
			hydratePlaylist(playlistTracks);
		} catch {
			setPlayerState('error', '歌单暂时无法加载', '请检查网络后重新尝试，或前往网易云查看原歌单。');
		} finally {
			loadingPlaylist = false;
		}
	};

	trackList.addEventListener('click', (event) => {
		const item = (event.target as Element).closest<HTMLButtonElement>('[data-track-index]');
		if (!item) return;
		const index = Number(item.dataset.trackIndex);
		if (Number.isInteger(index)) selectTrack(index, true);
	});

	lyricsScroll.addEventListener('click', (event) => {
		const line = (event.target as Element).closest<HTMLButtonElement>('[data-time]');
		if (!line) return;
		const time = Number(line.dataset.time);
		if (Number.isFinite(time)) audio.currentTime = time;
	});

	playlistSearch.addEventListener('input', renderTrackList);
	retryButton.addEventListener('click', () => loadPlaylist(true));
	playButton.addEventListener('click', () => audio.paused ? playCurrentTrack() : audio.pause());
	previousButton.addEventListener('click', () => selectTrack(getNextIndex(-1), true));
	nextButton.addEventListener('click', () => selectTrack(getNextIndex(1), true));

	shuffleButton.addEventListener('click', () => {
		shuffleEnabled = !shuffleEnabled;
		shuffleButton.classList.toggle('active', shuffleEnabled);
		shuffleButton.setAttribute('aria-pressed', String(shuffleEnabled));
		showNotice(shuffleEnabled ? '已开启随机播放' : '已关闭随机播放');
	});

	repeatButton.addEventListener('click', () => {
		repeatSingle = !repeatSingle;
		audio.loop = repeatSingle;
		repeatButton.classList.toggle('active', repeatSingle);
		repeatButton.setAttribute('aria-pressed', String(repeatSingle));
		repeatOne.hidden = !repeatSingle;
		repeatButton.title = repeatSingle ? '单曲循环' : '列表循环';
		showNotice(repeatSingle ? '已开启单曲循环' : '已切换为列表循环');
	});

	progress.addEventListener('input', () => {
		if (!Number.isFinite(audio.duration)) return;
		audio.currentTime = (Number(progress.value) / 100) * audio.duration;
	});

	volume.addEventListener('input', () => {
		audio.volume = Number(volume.value);
		audio.muted = false;
	});

	muteButton.addEventListener('click', () => { audio.muted = !audio.muted; });

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

	audio.addEventListener('play', () => updatePlayState(true));
	audio.addEventListener('pause', () => updatePlayState(false));
	audio.addEventListener('loadedmetadata', () => { duration.textContent = formatTime(audio.duration); });
	audio.addEventListener('durationchange', () => { duration.textContent = formatTime(audio.duration); });
	audio.addEventListener('timeupdate', () => {
		currentTime.textContent = formatTime(audio.currentTime);
		progress.value = Number.isFinite(audio.duration) && audio.duration > 0
			? String((audio.currentTime / audio.duration) * 100)
			: '0';
		syncLyrics();
	});
	audio.addEventListener('volumechange', () => {
		const isMuted = audio.muted || audio.volume === 0;
		volume.value = String(audio.volume);
		volumeIcon.hidden = isMuted;
		mutedIcon.hidden = !isMuted;
		muteButton.setAttribute('aria-label', isMuted ? '取消静音' : '静音');
	});
	audio.addEventListener('ended', () => {
		if (!audio.loop) selectTrack(getNextIndex(1), true);
	});
	audio.addEventListener('error', () => {
		if (audio.src) showNotice('这首歌暂时无法播放，可以尝试切换到其他歌曲。');
	});

	if ('mediaSession' in navigator) {
		try {
			navigator.mediaSession.setActionHandler('play', playCurrentTrack);
			navigator.mediaSession.setActionHandler('pause', () => audio.pause());
			navigator.mediaSession.setActionHandler('previoustrack', () => selectTrack(getNextIndex(-1), true));
			navigator.mediaSession.setActionHandler('nexttrack', () => selectTrack(getNextIndex(1), true));
		} catch {
			// Some browsers expose Media Session but support only a subset of actions.
		}
	}

	audio.volume = Number(volume.value);
	if (customBackground) setBackgroundImage(backdrop, customBackground);
	loadPlaylist();
};

document.querySelectorAll<HTMLElement>('[data-music-player]').forEach(initMusicPlayer);
