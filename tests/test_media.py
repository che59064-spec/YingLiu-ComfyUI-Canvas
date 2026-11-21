"""Media shelf and real local video assembly; no engine or model is used."""
import hashlib
import json
import math
from pathlib import Path
import subprocess
import struct
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import CanvasApp, make_server
from video_edit import clip_range, normalize_recording, probe, run, tool


class MediaCheck(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.app = CanvasApp(self.root, self.root / 'source')

    def tearDown(self):
        self.temporary.cleanup()

    def test_shelf_keeps_removed_canvas_results_and_deduplicates_cached_outputs(self):
        image = self.app.store_asset('参考图.png', 'image/png', b'\x89PNG\r\n\x1a\nreference')
        original = '/api/comfy/view?filename=result.mp4&type=output&subfolder=clips'
        cached = self.app.store_asset('result.mp4', 'video/mp4', b'\0\0\0\x18ftypmp42cached',
                                      source='generated', sourceUrl=original)
        self.app.jobs['old'] = {'id': 'old', 'status': 'completed', 'outputs': [
            {'name': 'result.mp4', 'type': 'video', 'url': '/api/comfy/view?subfolder=clips&type=output&filename=result.mp4'}]}
        self.app.jobs['bad'] = {'id': 'bad', 'status': 'completed', 'outputs': [
            {'name': 'outside', 'type': 'video', 'url': 'https://example.com/movie.mp4'}]}
        items = self.app.media()
        self.assertEqual(len(items), 2)
        result = next(item for item in items if item['source'] == 'generated')
        self.assertEqual(result['key'], 'old:0')
        self.assertEqual(result['assetId'], cached['id'])
        self.assertEqual(result['url'], cached['url'])
        self.assertEqual(next(item for item in items if item['source'] == 'upload')['assetId'], image['id'])
        self.assertFalse(self.app.project()['cards'])

    def test_join_rejects_external_addresses_and_invalid_ranges(self):
        for bad in ('https://example.com/x.mp4', 'file:///C:/secret.mp4', '/assets/../../secret.mp4',
                    '/api/comfy/view?filename=../secret.mp4&type=output'):
            with self.subTest(bad=bad), self.assertRaises(ValueError):
                self.app.join_videos({'clips': [{'url': bad}, {'url': bad}]})
        self.assertFalse(self.app.jobs)
        for clip in ({'start': -1}, {'start': 1, 'end': .5}, {'end': float('nan')}, {'start': 2.05, 'end': 2.1}):
            with self.subTest(clip=clip), self.assertRaises(ValueError):
                clip_range(clip, 2)

    def make_clip(self, name, color, size, audio=False):
        path = self.root / name
        arguments = [tool('ffmpeg'), '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
                     f'color={color}:s={size}:r=24:d=1']
        if audio:
            arguments += ['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=1']
        arguments += ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-threads', '1']
        if audio:
            arguments += ['-c:a', 'aac', '-shortest']
        run(arguments + [str(path)])
        return self.app.store_asset(name, 'video/mp4', path.read_bytes())

    def test_http_join_crops_preserves_order_adds_audio_and_retains_sources(self):
        try:
            tool('ffmpeg')
            tool('ffprobe')
        except ValueError:
            self.skipTest('FFmpeg is not installed')
        red = self.make_clip('红色带声音.mp4', 'red', '160x90', audio=True)
        blue = self.make_clip('蓝色静音.mp4', 'blue', '320x240')
        source_hashes = {entry['id']: hashlib.sha256((self.app.assets / entry['id']).read_bytes()).hexdigest()
                         for entry in (red, blue)}
        server = make_server(port=0, root=self.root, source=self.root / 'source')
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            body = {'name': '动作拼接', 'clips': [
                {'assetId': red['id'], 'start': .2, 'end': .7},
                {'url': blue['url'], 'start': .1, 'end': .85}]}
            request = urllib.request.Request(base + '/api/videos/join', method='POST',
                                              data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
            with opener.open(request, timeout=5) as response:
                self.assertEqual(response.status, 202)
                job_id = json.load(response)['job_id']
            deadline = time.monotonic() + 35
            while time.monotonic() < deadline:
                with opener.open(base + '/api/jobs', timeout=5) as response:
                    job = next(job for job in json.load(response)['items'] if job['id'] == job_id)
                if job['status'] in ('completed', 'failed'):
                    break
                time.sleep(.05)
            self.assertEqual(job['status'], 'completed', job.get('error'))
            self.assertEqual(job['kind'], 'video-join')
            output = job['outputs'][0]
            path = self.app.assets / output['assetId']
            info = probe(path)
            self.assertAlmostEqual(info['duration'], 1.25, delta=.1)
            self.assertEqual((info['width'], info['height']), (160, 90))
            self.assertTrue(info['audio'])
            for moment, channel in ((.15, 0), (.9, 2)):
                pixels = subprocess.check_output([tool('ffmpeg'), '-v', 'error', '-ss', str(moment), '-i', str(path),
                                                   '-frames:v', '1', '-vf', 'scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'])
                self.assertGreater(pixels[channel], 180, (moment, list(pixels)))
                self.assertLess(pixels[2 if channel == 0 else 0], 35, (moment, list(pixels)))
            volumes = []
            for moment in (.2, .9):
                pcm = subprocess.check_output([tool('ffmpeg'), '-v', 'error', '-ss', str(moment), '-i', str(path),
                                               '-t', '0.1', '-vn', '-ac', '1', '-ar', '48000', '-f', 's16le', '-'])
                samples = struct.unpack('<' + 'h' * (len(pcm) // 2), pcm)
                volumes.append(math.sqrt(sum(sample * sample for sample in samples) / len(samples)))
            self.assertGreater(volumes[0], 500, 'the first clip must retain its original tone')
            self.assertLess(volumes[1], 50, 'the silent second clip must receive silence')
            with opener.open(base + '/api/media', timeout=5) as response:
                items = json.load(response)['items']
            joined = [item for item in items if item['source'] == 'joined']
            self.assertEqual(len(joined), 1)
            self.assertEqual(joined[0]['jobId'], job_id)
            self.assertEqual(joined[0]['key'], job_id + ':0')
            for asset_id, digest in source_hashes.items():
                self.assertEqual(hashlib.sha256((self.app.assets / asset_id).read_bytes()).hexdigest(), digest)
            restarted = CanvasApp(self.root, self.root / 'source')
            self.assertEqual(restarted.jobs[job_id]['status'], 'completed')
            self.assertEqual(len([item for item in restarted.media() if item['source'] == 'joined']), 1)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


class StageRecordingCheck(unittest.TestCase):
    def setUp(self):
        try:
            tool('ffmpeg')
            tool('ffprobe')
        except ValueError:
            self.skipTest('FFmpeg is not installed')
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.app = CanvasApp(self.root, self.root / 'source')

    def recording(self, name='recording.webm', *, live=False, size='160x90', seconds=1, audio=False, filters=None):
        path = self.root / name
        arguments = [tool('ffmpeg'), '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i',
                     f'color=red:s={size}:r=24:d={seconds}']
        if audio:
            arguments += ['-f', 'lavfi', '-i', f'sine=frequency=440:duration={seconds}']
        if filters:
            arguments += ['-vf', filters]
        arguments += ['-c:v', 'libvpx' if path.suffix == '.webm' else 'libx264', '-threads', '2',
                      '-metadata', 'title=private recording metadata']
        if audio:
            arguments += ['-c:a', 'libopus' if path.suffix == '.webm' else 'aac', '-shortest']
        if live:
            arguments += ['-live', '1']
        run(arguments + [str(path)], timeout=30)
        return path

    def test_recordings_with_and_without_duration_become_reusable_mp4(self):
        for name, live in (('normal.webm', False), ('live.webm', True), ('normal.mp4', False)):
            with self.subTest(name=name):
                source = self.recording(name, live=live, audio=not live)
                data = source.read_bytes()
                if live:
                    with self.assertRaisesRegex(ValueError, '时长'):
                        probe(source)
                else:
                    self.assertGreater(probe(source)['duration'], 0)
                entry = self.app.store_stage_video(name, data, '1')
                output, stored = self.app.asset(entry['id'])
                info = probe(output)
                self.assertEqual(stored, entry)
                self.assertEqual(entry['name'], Path(name).stem + '.mp4')
                self.assertEqual(entry['type'], 'video')
                self.assertEqual(entry['mime'], 'video/mp4')
                for key, value in info.items():
                    self.assertEqual(entry[key], value)
                self.assertAlmostEqual(info['duration'], 1, delta=2 / 24)
                self.assertEqual((info['width'], info['height'], info['fps'], info['audio']), (160, 90, '24', False))
                actual = json.loads(run([tool('ffprobe'), '-v', 'error', '-count_frames', '-show_streams',
                                         '-show_format', '-of', 'json', str(output)], timeout=30))
                self.assertEqual(len(actual['streams']), 1)
                video = actual['streams'][0]
                self.assertEqual((video['codec_name'], video['pix_fmt'], video['nb_read_frames']), ('h264', 'yuv420p', '24'))
                self.assertNotIn('title', actual['format'].get('tags', {}))
                binary = output.read_bytes()
                self.assertLess(binary.index(b'moov'), binary.index(b'mdat'))
                self.assertEqual(self.app.reference_asset({'assetId': entry['id']}), entry)
                self.assertEqual(source.read_bytes(), data)
        self.assertEqual(len(self.app.asset_metadata()), 3)
        self.assertEqual(len(list(self.app.assets.glob('*.mp4'))), 3)
        self.assertFalse(list(self.app.assets.glob('*.webm')))
        self.assertFalse(self.app.jobs)

    def test_http_live_recording_can_prepare_motion_reference_without_engine(self):
        source = self.recording(live=True, filters='setpts=PTS+5/TB')
        server = make_server(port=0, root=self.root, source=self.root / 'source')
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        try:
            request = urllib.request.Request(base + '/api/stage/video', method='POST', data=source.read_bytes(),
                      headers={'Origin': base, 'X-Filename': urllib.parse.quote('导演预演.webm'), 'X-Duration': '1'})
            with opener.open(request, timeout=30) as response:
                self.assertEqual(response.status, 201)
                entry = json.load(response)
            self.assertEqual(entry['name'], '导演预演.mp4')
            self.assertAlmostEqual(probe(server.app.assets / entry['id'])['duration'], 1, delta=2 / 24)
            document = {'timing': {'class_type': 'H3SegmentTiming', 'inputs': {'start_seconds': .25, 'end_seconds': .75}},
                        'loader': {'class_type': 'VHS_LoadVideoFFmpeg', 'inputs': {'video': 'old.mp4',
                                   'start_time': ['timing', 0], 'frame_load_cap': ['timing', 1]}}}
            with patch.object(server.app, 'upload_comfy_media', side_effect=lambda name, mime, data: name) as upload:
                prepared = server.app.prepare_workflow({'workflow': document, 'references': [{'assetId': entry['id']}]})
            upload.assert_called_once()
            name, mime, data = upload.call_args.args
            self.assertEqual(mime, 'video/mp4')
            self.assertTrue(data)
            self.assertEqual(prepared['loader']['inputs']['video'], name)
            self.assertEqual(prepared['loader']['inputs']['start_time'], 0)
            segments = list((server.app.data / 'segments').glob('*.mp4'))
            self.assertEqual(len(segments), 1)
            self.assertAlmostEqual(probe(segments[0])['duration'], .5, delta=1 / 24)
            self.assertFalse(server.app.jobs)
            self.assertIsNone(server.app.engine_thread)
            self.assertEqual(len(server.app.asset_metadata()), 1)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_normalization_scales_and_rounds_dimensions_and_duration(self):
        for size, filters, expected in (('2560x1440', None, (1280, 720)),
                                        ('162x94', 'format=yuv444p,crop=161:91', (160, 90))):
            with self.subTest(size=size):
                source = self.recording('size.mp4', size=size, seconds=1.5, filters=filters)
                entry = self.app.store_stage_video('预演.mp4', source.read_bytes(), 1.27)
                self.assertEqual((entry['width'], entry['height']), expected)
                self.assertAlmostEqual(entry['duration'], round(1.27 * 24) / 24, delta=.001)
                self.assertEqual(probe(self.app.assets / entry['id'])['fps'], '24')

    def test_short_damaged_large_gapped_and_nonvideo_recordings_never_enter_shelf(self):
        short = self.recording('short.webm', live=True, seconds=.25)
        large = self.recording('large.mp4', size='2562x16')
        gapped = self.recording('gapped.webm', live=True, seconds=.125, filters='setpts=PTS*24')
        broken = self.root / 'broken.webm'
        broken.write_bytes(short.read_bytes()[:80])
        audio = self.root / 'audio.webm'
        run([tool('ffmpeg'), '-v', 'error', '-nostdin', '-y', '-f', 'lavfi', '-i', 'sine=duration=1',
             '-c:a', 'libopus', str(audio)], timeout=30)
        multi = self.root / 'multi.mp4'
        run([tool('ffmpeg'), '-v', 'error', '-nostdin', '-y', '-i', str(large), '-map', '0:v', '-map', '0:v',
             '-c', 'copy', str(multi)], timeout=30)
        for source in (short, large, gapped, broken, audio, multi):
            with self.subTest(source=source.name):
                data = source.read_bytes()
                with self.assertRaises(ValueError):
                    self.app.store_stage_video(source.name, data, 1)
                self.assertFalse(self.app.asset_metadata())
                self.assertFalse(list(self.app.assets.iterdir()))
                self.assertFalse(self.app.video_lock.locked())
                self.assertEqual(source.read_bytes(), data)
        self.assertFalse(self.app.jobs)

    def test_normalizer_bounds_commands_and_verifies_output_before_storage(self):
        source = self.recording(live=True)
        calls = []
        def checked_run(arguments, timeout=1800):
            calls.append((arguments, timeout))
            self.assertIsInstance(arguments, list)
            self.assertLessEqual(timeout, 120)
            self.assertEqual(arguments[arguments.index('-protocol_whitelist') + 1], 'file,pipe')
            return run(arguments, timeout=timeout)
        with patch('video_edit.run', side_effect=checked_run):
            result = normalize_recording(source, self.root / 'checked.mp4', 1)
        self.assertEqual(result['fps'], '24')
        encode = next(arguments for arguments, timeout in calls if '-c:v' in arguments)
        self.assertEqual(encode[encode.index('-frames:v') + 1], '24')
        self.assertEqual(encode[encode.index('-threads') + 1], '2')
        self.assertNotIn('-loop', encode)
        self.assertNotIn('tpad', ' '.join(encode))
        for bad_info in ({**result, 'duration': .5}, {**result, 'duration': 30.1},
                         {**result, 'fps': '30'}, {**result, 'width': 1282}, {**result, 'audio': True}):
            with self.subTest(info=bad_info), patch('video_edit.probe', return_value=bad_info):
                with self.assertRaisesRegex(ValueError, '标准化结果'):
                    self.app.store_stage_video(source.name, source.read_bytes(), 1)
        self.assertFalse(self.app.asset_metadata())
        self.assertFalse(list(self.app.assets.iterdir()))


if __name__ == '__main__':
    unittest.main()
