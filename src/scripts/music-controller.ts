export interface MusicTrack {
	title: string;
	author: string;
	url: string;
	pic: string;
	lrc: string;
}

export type MusicControllerStatus = 'idle' | 'loading' | 'ready' | 'error';
export type MusicControllerReason = 'init' | 'status' | 'playlist' | 'track' | 'playback' | 'time' | 'volume' | 'mode';

export interface MusicControllerState {
	status: MusicControllerStatus;
	message: string;
	tracks: MusicTrack[];
	currentIndex: number;
	currentTrack: MusicTrack | null;
	playing: boolean;
	currentTime: number;
	duration: number;
	volume: number;
	muted: boolean;
	shuffleEnabled: boolean;
	repeatSingle: boolean;
}

type MusicSubscriber = (state: MusicControllerState, reason: MusicControllerReason) => void;

interface PlaylistCache {
	expiresAt: number;
	tracks: MusicTrack[];
}

const API_BASE = 'https://api.i-meto.com/meting/api';
const CACHE_TTL = 2 * 60 * 60 * 1000;

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

class MusicController {
	private audio: HTMLAudioElement;
	private playlistId = '';
	private status: MusicControllerStatus = 'idle';
	private message = '';
	private tracks: MusicTrack[] = [];
	private currentIndex = -1;
	private shuffleEnabled = false;
	private repeatSingle = false;
	private loadingPromise: Promise<MusicTrack[]> | null = null;
	private subscribers = new Set<MusicSubscriber>();

	constructor(audio: HTMLAudioElement) {
		this.audio = audio;
		this.audio.volume = Number(audio.dataset.initialVolume ?? .65);
		this.bindAudioEvents();
		this.bindMediaSession();
	}

	getAudio() {
		return this.audio;
	}

	getState(): MusicControllerState {
		return {
			status: this.status,
			message: this.message,
			tracks: this.tracks,
			currentIndex: this.currentIndex,
			currentTrack: this.tracks[this.currentIndex] ?? null,
			playing: !this.audio.paused,
			currentTime: this.audio.currentTime,
			duration: Number.isFinite(this.audio.duration) ? this.audio.duration : 0,
			volume: this.audio.volume,
			muted: this.audio.muted,
			shuffleEnabled: this.shuffleEnabled,
			repeatSingle: this.repeatSingle,
		};
	}

	subscribe(subscriber: MusicSubscriber) {
		this.subscribers.add(subscriber);
		subscriber(this.getState(), 'init');
		return () => this.subscribers.delete(subscriber);
	}

	async loadPlaylist(playlistId: string, forceRefresh = false) {
		if (this.tracks.length && this.playlistId === playlistId && !forceRefresh) {
			this.status = 'ready';
			this.emit('playlist');
			return this.tracks;
		}
		if (this.loadingPromise) return this.loadingPromise;

		this.playlistId = playlistId;
		this.status = 'loading';
		this.message = '第一次读取可能需要一点时间';
		this.emit('status');

		this.loadingPromise = this.fetchPlaylist(playlistId, forceRefresh)
			.then((tracks) => {
				if (!tracks.length) throw new Error('Playlist is empty');
				this.tracks = tracks;
				this.status = 'ready';
				this.message = '';
				if (this.currentIndex < 0 || this.currentIndex >= tracks.length) this.selectTrack(0, false);
				else this.emit('playlist');
				return tracks;
			})
			.catch((error) => {
				this.status = 'error';
				this.message = '请检查网络后重新尝试，或前往网易云查看原歌单。';
				this.emit('status');
				throw error;
			})
			.finally(() => { this.loadingPromise = null; });

		return this.loadingPromise;
	}

	selectTrack(index: number, shouldPlay = true) {
		if (!this.tracks.length) return;
		const normalizedIndex = (index + this.tracks.length) % this.tracks.length;
		const track = this.tracks[normalizedIndex];
		this.currentIndex = normalizedIndex;
		this.audio.src = track.url;
		this.audio.dataset.trackTitle = track.title;
		this.audio.dataset.trackAuthor = track.author;
		this.audio.dataset.trackCover = track.pic;
		this.audio.load();
		this.updateMediaSession(track);
		this.emit('track');
		if (shouldPlay) void this.play();
	}

	async play() {
		try {
			await this.audio.play();
		} catch {
			this.message = '浏览器暂时无法播放这首歌，请尝试切换歌曲。';
			this.emit('status');
		}
	}

	togglePlayback() {
		if (this.audio.paused) void this.play();
		else this.audio.pause();
	}

	previous() {
		this.selectTrack(this.getNextIndex(-1), true);
	}

	next() {
		this.selectTrack(this.getNextIndex(1), true);
	}

	seekToRatio(ratio: number) {
		if (!Number.isFinite(this.audio.duration)) return;
		this.audio.currentTime = Math.max(0, Math.min(1, ratio)) * this.audio.duration;
	}

	seekToTime(time: number) {
		if (Number.isFinite(time)) this.audio.currentTime = Math.max(0, time);
	}

	setVolume(volume: number) {
		this.audio.volume = Math.max(0, Math.min(1, volume));
		this.audio.muted = false;
	}

	toggleMute() {
		this.audio.muted = !this.audio.muted;
	}

	toggleShuffle() {
		this.shuffleEnabled = !this.shuffleEnabled;
		this.emit('mode');
		return this.shuffleEnabled;
	}

	toggleRepeat() {
		this.repeatSingle = !this.repeatSingle;
		this.audio.loop = this.repeatSingle;
		this.emit('mode');
		return this.repeatSingle;
	}

	private emit(reason: MusicControllerReason) {
		const state = this.getState();
		this.subscribers.forEach((subscriber) => subscriber(state, reason));
	}

	private getNextIndex(direction: 1 | -1) {
		if (!this.shuffleEnabled || this.tracks.length < 2) return this.currentIndex + direction;
		let index = this.currentIndex;
		while (index === this.currentIndex) index = Math.floor(Math.random() * this.tracks.length);
		return index;
	}

	private readCache(playlistId: string): MusicTrack[] {
		try {
			const value = localStorage.getItem(`kkkk:music-playlist:${playlistId}`);
			if (!value) return [];
			const parsed = JSON.parse(value) as PlaylistCache;
			if (!parsed || parsed.expiresAt < Date.now()) return [];
			return parseTracks(parsed.tracks);
		} catch {
			return [];
		}
	}

	private writeCache(playlistId: string, tracks: MusicTrack[]) {
		try {
			localStorage.setItem(`kkkk:music-playlist:${playlistId}`, JSON.stringify({
				expiresAt: Date.now() + CACHE_TTL,
				tracks,
			}));
		} catch {
			// Storage is an optional performance enhancement.
		}
	}

	private async fetchPlaylist(playlistId: string, forceRefresh: boolean) {
		const cachedTracks = forceRefresh ? [] : this.readCache(playlistId);
		if (cachedTracks.length) return cachedTracks;

		const endpoint = new URL(API_BASE);
		endpoint.searchParams.set('server', 'netease');
		endpoint.searchParams.set('type', 'playlist');
		endpoint.searchParams.set('id', playlistId);
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 30_000);

		try {
			const response = await fetch(endpoint, { signal: controller.signal, cache: 'no-store' });
			if (!response.ok) throw new Error(`Playlist request failed: ${response.status}`);
			const tracks = parseTracks(await response.json());
			this.writeCache(playlistId, tracks);
			return tracks;
		} finally {
			window.clearTimeout(timeout);
		}
	}

	private updateMediaSession(track: MusicTrack) {
		if (!('mediaSession' in navigator) || !('MediaMetadata' in window)) return;
		navigator.mediaSession.metadata = new MediaMetadata({
			title: track.title,
			artist: track.author,
			artwork: track.pic ? [{ src: track.pic }] : [],
		});
	}

	private bindMediaSession() {
		if (!('mediaSession' in navigator)) return;
		try {
			navigator.mediaSession.setActionHandler('play', () => void this.play());
			navigator.mediaSession.setActionHandler('pause', () => this.audio.pause());
			navigator.mediaSession.setActionHandler('previoustrack', () => this.previous());
			navigator.mediaSession.setActionHandler('nexttrack', () => this.next());
		} catch {
			// Browsers can expose Media Session while supporting only some actions.
		}
	}

	private bindAudioEvents() {
		this.audio.addEventListener('play', () => this.emit('playback'));
		this.audio.addEventListener('pause', () => this.emit('playback'));
		this.audio.addEventListener('loadedmetadata', () => this.emit('time'));
		this.audio.addEventListener('durationchange', () => this.emit('time'));
		this.audio.addEventListener('timeupdate', () => this.emit('time'));
		this.audio.addEventListener('volumechange', () => this.emit('volume'));
		this.audio.addEventListener('ended', () => {
			if (!this.audio.loop) this.next();
		});
		this.audio.addEventListener('error', () => {
			if (!this.audio.src) return;
			this.message = '这首歌暂时无法播放，可以尝试切换到其他歌曲。';
			this.emit('status');
		});
	}
}

let controller: MusicController | null = null;
let resumeAfterSwap = false;

document.addEventListener('astro:before-swap', () => {
	const audio = controller?.getAudio();
	resumeAfterSwap = Boolean(audio && !audio.paused && !audio.ended);
});

document.addEventListener('astro:page-load', () => {
	if (!resumeAfterSwap || !controller) return;
	resumeAfterSwap = false;
	window.requestAnimationFrame(() => {
		const audio = controller?.getAudio();
		if (audio?.paused && !audio.ended) void controller?.play();
	});
});

export const getMusicController = () => {
	const audio = document.querySelector<HTMLAudioElement>('[data-global-audio]');
	if (!audio) throw new Error('Global music audio element is unavailable');
	if (!controller || controller.getAudio() !== audio) controller = new MusicController(audio);
	return controller;
};
