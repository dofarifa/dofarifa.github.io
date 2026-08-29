import avatarImage from './assets/avatar.jpg';

export const SITE_TITLE = 'kkkk';
export const SITE_DESCRIPTION = 'kkkk 的个人博客，记录技术、阅读与生活。';
export const SITE_AUTHOR = 'kkkk';
export const SITE_TAGLINE = '把复杂的事想清楚，把值得的事写下来。';
// 网易云公开歌单分享链接中的 id，用于独立音乐播放器页面。
export const NETEASE_PLAYLIST_ID = '3058435980';
// 音乐页背景支持 public 目录路径或完整 URL。视频优先于图片；都留空时使用当前歌曲专辑封面。
export const MUSIC_BACKGROUND_IMAGE = '';
export const MUSIC_BACKGROUND_VIDEO = '';
// 首页顶部 Banner 支持 public 目录路径或完整 URL。留空时使用内置轻量动画背景。
export const HOME_BANNER_VIDEO = '/media/home-banner.webm';
// 头像卡片上半部分背景。支持完整 CSS background 值，例如渐变或 url('/images/avatar-bg.jpg') center / cover no-repeat。
export const AVATAR_CARD_BACKGROUND = 'linear-gradient(135deg, #f1efff 0%, #f4f6ff 48%, #eaf7ff 100%)';

// 更换图片时，将新文件放入 src/assets 并修改上方导入路径。
export const SITE_ICON = avatarImage;
export const SITE_AVATAR = avatarImage;
