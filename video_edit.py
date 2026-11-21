"""Local clip assembly with FFmpeg. No network calls, GPU or model execution."""
from __future__ import annotations
from fractions import Fraction
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import tempfile


def tool(name):
    found = shutil.which(name)
    if found:
        return found
    packages = Path(os.environ.get('LOCALAPPDATA', '')) / 'Microsoft' / 'WinGet' / 'Packages'
    candidates = sorted(packages.glob('Gyan.FFmpeg*/ffmpeg*/bin/' + name + '.exe'))
    if candidates:
        return str(candidates[-1])
    raise ValueError('本机未找到 FFmpeg 视频工具，请安装后重试。')


def run(arguments, timeout=1800):
    try:
        result = subprocess.run(arguments, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                stderr=subprocess.PIPE, timeout=timeout, encoding='utf-8', errors='replace',
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    except subprocess.TimeoutExpired:
        raise ValueError('视频处理超时，请缩短片段后重试。')
    if result.returncode:
        raise ValueError('视频处理失败：' + result.stderr.strip()[-1200:])
    return result.stdout


def probe(path):
    info = json.loads(run([tool('ffprobe'), '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_streams', '-show_format',
                           '-of', 'json', str(path)], timeout=30))
    video = next((stream for stream in info.get('streams', []) if stream.get('codec_type') == 'video'), None)
    if not video:
        raise ValueError('所选素材没有可读取的视频画面。')
    try:
        duration = float(info.get('format', {}).get('duration') or video.get('duration') or 0)
        fps = Fraction(video.get('avg_frame_rate') or video.get('r_frame_rate') or '24')
        width, height = int(video['width']), int(video['height'])
        rotation = float(video.get('tags', {}).get('rotate', 0))
        for side in video.get('side_data_list', []):
            if 'rotation' in side:
                rotation = float(side['rotation'])
        if round(rotation) % 180:
            width, height = height, width
    except (ValueError, TypeError, KeyError, ZeroDivisionError):
        raise ValueError('视频尺寸、帧率或时长无法读取。')
    if not math.isfinite(duration) or duration <= 0 or not 1 <= width <= 4096 or not 1 <= height <= 4096:
        raise ValueError('视频时长无效或尺寸超过 4096 像素，请先缩小素材。')
    if fps <= 0:
        fps = Fraction(24)
    return {'duration': duration, 'width': width + width % 2, 'height': height + height % 2,
            'fps': str(min(fps, Fraction(60))),
            'audio': any(stream.get('codec_type') == 'audio' for stream in info.get('streams', []))}


def recording_duration(value):
    try:
        duration = float(value)
    except (TypeError, ValueError, OverflowError):
        raise ValueError('预演时长必须是 1 到 30 秒的有限数字。') from None
    if isinstance(value, bool) or not math.isfinite(duration) or not 1 <= duration <= 30:
        raise ValueError('预演时长必须是 1 到 30 秒的有限数字。')
    return duration


def normalize_recording(source, destination, duration):
    """Decode browser recordings without trusting their optional container duration."""
    duration = recording_duration(duration)
    ffprobe = [tool('ffprobe'), '-v', 'error', '-protocol_whitelist', 'file,pipe', '-threads', '2']
    info = json.loads(run(ffprobe + ['-show_streams', '-of', 'json', str(source)], timeout=30))
    videos = [stream for stream in info.get('streams', []) if stream.get('codec_type') == 'video']
    if len(videos) != 1 or videos[0].get('disposition', {}).get('attached_pic'):
        raise ValueError('预演录制必须包含单个有效视频流。')
    if not all(2 <= int(videos[0].get(key) or 0) <= 2560 for key in ('width', 'height')):
        raise ValueError('预演录制尺寸无效或超过 2560 像素。')
    frames = json.loads(run(ffprobe + ['-select_streams', 'v:0', '-read_intervals', f'%+{duration + .1}',
                            '-show_frames', '-show_entries', 'frame=width,height,best_effort_timestamp_time',
                            '-of', 'json', str(source)], timeout=30)).get('frames', [])
    try:
        times = [float(frame['best_effort_timestamp_time']) for frame in frames]
        valid_sizes = all(2 <= int(frame[key]) <= 2560 for frame in frames for key in ('width', 'height'))
    except (KeyError, TypeError, ValueError, OverflowError):
        raise ValueError('预演录制没有可读取的有效画面。') from None
    # Do not let fps conversion stretch a damaged tail or a long timestamp gap into still frames.
    if (len(times) < 2 or not valid_sizes or not all(math.isfinite(t) for t in times)
            or times[-1] - times[0] + 1 / 24 < duration - 2 / 24 - .001
            or any(not 0 < b - a <= .5 for a, b in zip(times, times[1:]))):
        raise ValueError('预演录制画面不足或中断，请重新录制。')
    frame_count = math.floor(duration * 24 + .5)
    video = ("setpts=PTS-STARTPTS,scale=w='min(1280,iw)':h='min(1280,ih)':"
             'force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1,fps=24:eof_action=pass')
    run([tool('ffmpeg'), '-v', 'error', '-nostdin', '-y', '-xerror', '-protocol_whitelist', 'file,pipe',
         '-threads', '2', '-i', str(source), '-map', '0:v:0', '-an', '-sn', '-dn', '-vf', video,
         '-t', str(frame_count / 24), '-frames:v', str(frame_count), '-c:v', 'libx264',
         '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2',
         '-map_metadata', '-1', '-map_chapters', '-1', '-movflags', '+faststart', '-f', 'mp4',
         str(destination)], timeout=120)
    result = probe(destination)
    if (abs(result['duration'] - duration) > 2 / 24 + .001 or result['duration'] > 30.001
            or max(result['width'], result['height']) > 1280 or result['fps'] != '24' or result['audio']):
        raise ValueError('预演视频标准化结果无效或时长不符，请重新录制。')
    return result


def clip_range(clip, duration):
    try:
        start = float(clip.get('start') or 0)
        end = float(clip['end']) if clip.get('end') not in (None, '') else duration
    except (TypeError, ValueError):
        raise ValueError('片段起止时间必须是秒数。')
    if not math.isfinite(start) or not math.isfinite(end) or start < 0 or start >= duration or end <= start or end > duration + .1:
        raise ValueError('片段起止时间无效，请确保结束时间大于开始时间且不超过视频时长。')
    return start, min(end, duration) - start


def extract_segment(source, destination, start, end):
    """Materialize exactly the selected 24fps frames, with no source mutation."""
    info = probe(source)
    start, length = clip_range({'start': start, 'end': end}, info['duration'])
    first_frame = math.floor(start * 24 + .5)
    last_frame = math.floor((start + length) * 24 + .5)
    frame_count = last_frame - first_frame
    if not 1 <= frame_count <= 3592:
        raise ValueError('所选片段帧数无效，请缩短片段后重试。')
    run([tool('ffmpeg'), '-v', 'error', '-nostdin', '-y', '-ss', str(first_frame / 24),
         '-protocol_whitelist', 'file,pipe', '-i', str(source), '-map', '0:v:0', '-an',
         '-vf', 'fps=24,setpts=PTS-STARTPTS', '-frames:v', str(frame_count),
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p',
         '-threads', '2', '-map_metadata', '-1', '-movflags', '+faststart', str(destination)], timeout=120)
    result = probe(destination)
    if abs(result['duration'] - frame_count / 24) > .05:
        raise ValueError('截取的视频帧数不足，请调整结束秒数后重试。')
    return result


def join(paths, clips, destination, progress=lambda value: None):
    """Normalize each source, then concatenate in the supplied order without editing it."""
    if not 2 <= len(paths) <= 20 or len(paths) != len(clips):
        raise ValueError('请选择 2 到 20 段视频进行拼接。')
    infos = [probe(path) for path in paths]
    ranges = [clip_range(clip, info['duration']) for clip, info in zip(clips, infos)]
    if sum(length for _, length in ranges) > 1800:
        raise ValueError('一次拼接总时长最多 30 分钟，请分批处理。')
    first, ffmpeg = infos[0], tool('ffmpeg')
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='canvas-video-') as folder:
        temporary = Path(folder)
        for index, (path, info, (start, length)) in enumerate(zip(paths, infos, ranges)):
            output = temporary / ('segment-%02d.mp4' % index)
            arguments = [ffmpeg, '-v', 'error', '-nostdin', '-y', '-ss', str(start), '-protocol_whitelist', 'file,pipe', '-i', str(path)]
            if not info['audio']:
                arguments += ['-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo']
            width, height, fps = first['width'], first['height'], first['fps']
            video = (f'scale={width}:{height}:force_original_aspect_ratio=decrease,'
                     f'pad={width}:{height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps={fps},setpts=PTS-STARTPTS')
            audio = f'aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration={length},asetpts=PTS-STARTPTS'
            arguments += ['-map', '0:v:0', '-map', '0:a:0' if info['audio'] else '1:a:0',
                          '-vf', video, '-af', audio, '-t', str(length), '-c:v', 'libx264',
                          '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-threads', '2',
                          '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-map_metadata', '-1', str(output)]
            run(arguments)
            progress((index + 1) / (len(paths) + 1))
        manifest = temporary / 'clips.txt'
        manifest.write_text(''.join("file 'segment-%02d.mp4'\n" % index for index in range(len(paths))), encoding='utf-8')
        run([ffmpeg, '-v', 'error', '-nostdin', '-y', '-f', 'concat', '-safe', '1', '-protocol_whitelist', 'file,pipe',
             '-i', str(manifest), '-c', 'copy', '-movflags', '+faststart', str(destination)])
    result = probe(destination)
    progress(1)
    return result
