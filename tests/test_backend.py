"""No models are run. Check lossless edits, local storage and trust boundaries."""
import http.client
import json
from pathlib import Path
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch
import urllib.error
import urllib.parse
import urllib.request

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from server import CanvasApp, HTTPProblem, MAX_STAGE_VIDEO, make_server, validate_comfy_url
from video_edit import recording_duration
from workflows import apply_params, fields_for


DOCUMENT = {'last_node_id': 2, 'unknown': {'preserve': [1, 2, '你好']},
            'nodes': [{'id': 1, 'type': 'KSampler', 'title': '生成图片',
                       'widgets_values': [101, 'randomize', 40, 1.0, 'euler', 'simple', 1.0],
                       'inputs': [{'name': 'seed', 'widget': {'name': 'seed'}, 'link': None},
                                  {'name': 'steps', 'widget': {'name': 'steps'}, 'link': None}]},
                      {'id': 2, 'type': 'UnknownCustom', 'widgets_values': ['keep me'], 'custom': {'a': 3}}],
            'links': [[1, 1, 0, 2, 0, 'IMAGE']],
            'definitions': {'subgraphs': [{'id': 'opaque-subgraph', 'nodes': [], 'unknown': [9]}]}}


class BackendCheck(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.source = self.root / 'source'
        self.source.mkdir()
        self.app = CanvasApp(self.root, self.source)

    def tearDown(self):
        self.temporary.cleanup()

    def test_import_preserves_unknown_fields_and_subgraphs(self):
        result = self.app.library.import_document(DOCUMENT, '../自定义/流程')
        self.assertEqual(result['workflow'], DOCUMENT)
        self.assertEqual(self.app.library.get(result['id'])['workflow'], DOCUMENT)
        self.assertFalse(list(self.source.iterdir()))

    def test_patch_changes_only_the_audited_widget(self):
        field = next(f for f in fields_for(DOCUMENT) if f['key'] == 'steps')
        edited = apply_params(DOCUMENT, {field['id']: 25})
        edited['nodes'][0]['widgets_values'][2] = 40
        self.assertEqual(edited, DOCUMENT)
        self.assertEqual(DOCUMENT['nodes'][0]['widgets_values'][2], 40)
        with self.assertRaises(ValueError):
            apply_params(DOCUMENT, {'nodes/1:unknown': 'overwrite'})
        with self.assertRaises(ValueError):
            apply_params(DOCUMENT, {field['id']: 0})

    def test_connected_input_is_not_overwritten(self):
        imported = json.loads(json.dumps(DOCUMENT))
        imported['nodes'][0]['inputs'][1]['link'] = 52
        field = next(f for f in fields_for(imported) if f['key'] == 'steps')
        with self.assertRaises(ValueError):
            apply_params(imported, {field['id']: 25})

    def test_project_conflict_keeps_first_save(self):
        saved = self.app.save_project({'revision': 0, 'cards': [{'id': 'a'}], 'custom': 42})
        self.assertEqual(saved['revision'], 1)
        with self.assertRaises(HTTPProblem) as raised:
            self.app.save_project({'revision': 0, 'cards': []})
        self.assertEqual(raised.exception.status, 409)
        self.assertEqual(self.app.project()['cards'], [{'id': 'a'}])

    def test_professional_snapshot_survives_app_restart(self):
        state = {'workflow': DOCUMENT, 'workflowId': '../opaque-card', 'revision': 7}
        filename = self.app.snapshot_bridge(state, 'load前备份')
        restarted = CanvasApp(self.root, self.source)
        saved = json.loads((restarted.data / 'snapshots' / filename).read_text(encoding='utf-8'))
        self.assertEqual(saved['workflow'], DOCUMENT)
        self.assertEqual(saved['workflowId'], '../opaque-card')
        self.assertEqual(saved['revision'], 7)

    def test_reference_allocation_reserves_explicit_slots_before_auto(self):
        document = {'nodes': [
            {'id': 1, 'type': 'LoadImage', 'widgets_values': ['old1.png', 'image']},
            {'id': 2, 'type': 'LoadImage', 'widgets_values': ['old2.png', 'image']}],
            'unknown': {'keep': ['原始文档']}}
        original = json.loads(json.dumps(document))
        uploads = []
        self.app.reference_asset = lambda ref: {'id': ref['assetId'], 'type': ref.get('type', 'image')}
        def upload(asset_id):
            uploads.append(asset_id)
            return asset_id + '.png'
        self.app.upload_to_comfy = upload
        prepared = self.app.prepare_workflow({'workflow': document, 'references': [
            {'assetId': 'auto-A'}, {'assetId': 'explicit-B', 'fieldId': 'nodes/0:image'}]})
        self.assertEqual([n['widgets_values'][0] for n in prepared['nodes']], ['explicit-B.png', 'auto-A.png'])
        self.assertEqual(document, original)
        self.assertEqual(set(uploads), {'auto-A', 'explicit-B'})
        invalid_cases = [
            ([{'assetId': 'A', 'fieldId': 'nodes/0:image'}, {'assetId': 'B', 'fieldId': 'nodes/0:image'}], '重复'),
            ([{'assetId': 'A', 'fieldId': 'nodes/404:image'}], '不存在'),
            ([{'assetId': 'A', 'fieldId': 'nodes/0:image', 'type': 'video'}], '类型'),
            ([{'assetId': 'A'}, {'assetId': 'B'}, {'assetId': 'C'}], '匹配输入'),
        ]
        for references, message in invalid_cases:
            with self.subTest(references=references):
                uploads.clear()
                with self.assertRaisesRegex(ValueError, message):
                    self.app.prepare_workflow({'workflow': document, 'references': references})
                self.assertEqual(uploads, [])
                self.assertEqual(document, original)

    def test_upload_opaque_path_and_content_validation(self):
        data = b'\x89PNG\r\n\x1a\n' + b'test-data'
        asset = self.app.store_asset('../../outside.png', 'image/png', data)
        path, metadata = self.app.asset(asset['id'])
        self.assertEqual(path.parent, self.app.assets)
        self.assertEqual(path.read_bytes(), data)
        self.assertEqual(metadata['name'], 'outside.png')
        with self.assertRaises(HTTPProblem):
            self.app.asset('../outside.png')
        with self.assertRaises(ValueError):
            self.app.store_asset('fake.png', 'image/png', b'<html>bad</html>')

    def test_stage_rejects_invalid_duration_signature_and_size_before_encoding(self):
        mp4 = b'\0\0\0\x18ftypmp42' + b'\0' * 12
        with patch('video_edit.normalize_recording') as encode:
            for duration in (None, '', 'oops', 'NaN', 'Infinity', '-Infinity', 0, .99, 30.01, -1, True, [], {}):
                with self.subTest(duration=duration), self.assertRaises(ValueError):
                    self.app.store_stage_video('recording.mp4', mp4, duration)
            for name, data in (('x.mp4', b'not a video'), ('x.mp4', b'xxxftypmp42'),
                               ('x.mp4', b'\0\0\0\x18ftypqt  ' + b'\0' * 12),
                               ('x.webm', mp4), ('x.mov', mp4), ('x.mkv', b'\x1aE\xdf\xa3'),
                               ('x.webm', b'\x1aE\xdf\xa3matroska'), ('', mp4)):
                with self.subTest(name=name, data=data), self.assertRaises(ValueError):
                    self.app.store_stage_video(name, data, 1)
            self.assertEqual(MAX_STAGE_VIDEO, 64 * 1024 * 1024)
            with patch('server.MAX_STAGE_VIDEO', len(mp4) - 1), self.assertRaises(HTTPProblem) as error:
                self.app.store_stage_video('x.mp4', mp4, 1)
            self.assertEqual(error.exception.status, 413)
            encode.assert_not_called()
        self.assertEqual([recording_duration(x) for x in ('1', '1.25', '30')], [1, 1.25, 30])
        self.assertFalse(self.app.asset_metadata())
        self.assertFalse(list(self.app.assets.iterdir()))
        self.assertFalse(self.app.jobs)

    def test_stage_failure_cleans_temporary_and_unindexed_files_and_releases_lock(self):
        mp4 = b'\0\0\0\x18ftypmp42' + b'\0' * 12
        original = self.app.store_asset('original.mp4', 'video/mp4', mp4)
        metadata = self.app.asset_metadata()
        temporary = []
        info = {'duration': 1.0, 'width': 160, 'height': 90, 'fps': '24', 'audio': False}
        def encode(source, output, duration):
            self.assertTrue(self.app.video_lock.locked())
            self.assertEqual(source.read_bytes(), mp4)
            self.assertEqual(duration, 1)
            temporary.append(source.parent)
            output.write_bytes(mp4)
            return info
        def broken_encode(*args):
            encode(*args)
            raise ValueError('incomplete recording')
        with patch('video_edit.normalize_recording', side_effect=broken_encode), self.assertRaises(ValueError):
            self.app.store_stage_video('recording.mp4', mp4, 1)
        with patch('video_edit.normalize_recording', side_effect=encode):
            with patch('server.atomic_json', side_effect=OSError('disk failure')), self.assertRaises(OSError):
                self.app.store_stage_video('recording.mp4', mp4, 1)
        self.assertFalse(self.app.video_lock.locked())
        self.assertTrue(temporary)
        self.assertTrue(all(not folder.exists() for folder in temporary))
        self.assertEqual(self.app.asset_metadata(), metadata)
        self.assertEqual([p.name for p in self.app.assets.iterdir()], [original['id']])
        self.assertEqual((self.app.assets / original['id']).read_bytes(), mp4)
        self.assertFalse(self.app.jobs)
        with self.app.video_lock, patch('video_edit.normalize_recording') as encode:
            with self.assertRaises(HTTPProblem) as error:
                self.app.store_stage_video('recording.mp4', mp4, 1)
            self.assertEqual(error.exception.status, 409)
            encode.assert_not_called()

    def test_stage_http_reuses_origin_body_guards_and_accepts_optional_content_type(self):
        server = make_server(port=0, root=self.root, source=self.source)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        mp4 = b'\0\0\0\x18ftypmp42' + b'\0' * 12
        base = 'http://127.0.0.1:' + str(server.server_port)
        headers = {'X-Filename': urllib.parse.quote('../预演.mp4'), 'X-Duration': '1'}
        def post(extra=None, data=mp4):
            connection = http.client.HTTPConnection('127.0.0.1', server.server_port, timeout=5)
            try:
                connection.request('POST', '/api/stage/video', body=data, headers={**headers, **(extra or {})})
                response = connection.getresponse()
                return response.status, json.loads(response.read())
            finally:
                connection.close()
        def encode(source, output, duration):
            output.write_bytes(mp4)
            return {'duration': 1.0, 'width': 160, 'height': 90, 'fps': '24', 'audio': False}
        try:
            with patch('video_edit.normalize_recording', side_effect=encode) as normalize:
                for extra, data, status in (({'Origin': 'https://bad.example'}, mp4, 403),
                                             ({'Origin': 'null'}, mp4, 403),
                                             ({'Host': 'bad.example'}, mp4, 403),
                                             ({'X-Duration': ''}, mp4, 400),
                                             ({'X-Duration': 'NaN'}, mp4, 400),
                                             ({'Content-Length': str(MAX_STAGE_VIDEO + 1)}, b'', 413),
                                             ({'Content-Length': 'invalid'}, b'', 400),
                                             ({}, b'', 413)):
                    with self.subTest(extra=extra):
                        self.assertEqual(post(extra, data)[0], status)
                normalize.assert_not_called()
                with server.app.video_lock:
                    self.assertEqual(post()[0], 409)
                for extra in ({'Origin': base}, {'Content-Type': 'video/mp4'}):
                    status, asset = post(extra)
                    self.assertEqual(status, 201)
                    self.assertEqual(asset['name'], '预演.mp4')
                    self.assertEqual(asset['mime'], 'video/mp4')
                    self.assertEqual(asset['duration'], 1)
                    self.assertEqual(server.app.reference_asset({'assetId': asset['id']}), asset)
                self.assertEqual(normalize.call_count, 2)
                self.assertEqual(len(server.app.asset_metadata()), 2)
                self.assertFalse(server.app.jobs)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()

    def test_only_loopback_engine_addresses(self):
        self.assertEqual(validate_comfy_url('http://127.0.0.1:8000/'), 'http://127.0.0.1:8000')
        for invalid in ('https://api.example.com:443', 'http://192.168.1.2:8000',
                        'http://127.0.0.1:8000/secret', 'http://user@localhost:8000'):
            with self.assertRaises(ValueError):
                validate_comfy_url(invalid)

    def test_http_roundtrip_range_and_conflict(self):
        (self.source / '测试工作流.json').write_text(json.dumps(DOCUMENT, ensure_ascii=False), encoding='utf-8')
        server = make_server(port=0, root=self.root, source=self.source)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        try:
            with urllib.request.urlopen(base + '/api/health') as response:
                self.assertEqual(json.load(response)['app'], 'creation-canvas')
            request = urllib.request.Request(base + '/api/project', data=b'{"revision":0,"cards":[]}',
                                             method='PUT', headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(request) as response:
                self.assertEqual(json.load(response)['revision'], 1)
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(request)
            self.assertEqual(error.exception.code, 409)
            upload = urllib.request.Request(base + '/api/assets', data=b'\x89PNG\r\n\x1a\n123456', method='POST',
                                             headers={'Content-Type': 'image/png', 'X-Filename': '../../safe.png'})
            with urllib.request.urlopen(upload) as response:
                self.assertEqual(response.status, 201)
                asset = json.load(response)
            self.assertEqual(asset['name'], 'safe.png')
            range_request = urllib.request.Request(base + asset['url'], headers={'Range': 'bytes=8-10'})
            with urllib.request.urlopen(range_request) as response:
                self.assertEqual(response.status, 206)
                self.assertEqual(response.read(), b'123')
            with urllib.request.urlopen(base + '/api/catalog') as response:
                catalog = json.load(response)['items']
            self.assertEqual(len(catalog), 1)
            with urllib.request.urlopen(base + '/api/workflows/' + catalog[0]['id']) as response:
                detail = json.load(response)
            field = next(f for f in detail['fields'] if f['key'] == 'steps')
            prepare = urllib.request.Request(base + '/api/prepare-workflow', method='POST',
                                               data=json.dumps({'workflow_id': detail['id'], 'values': {field['id']: 25}}).encode(),
                                               headers={'Content-Type': 'application/json'})
            with urllib.request.urlopen(prepare) as response:
                prepared = json.load(response)['workflow']
            self.assertEqual(prepared['nodes'][0]['widgets_values'][2], 25)
            prepared['nodes'][0]['widgets_values'][2] = 40
            self.assertEqual(prepared, DOCUMENT)
            settings = urllib.request.Request(base + '/api/settings', method='PUT',
                                                data=b'{"comfy_url":"http://192.168.1.9:8000"}',
                                                headers={'Content-Type': 'application/json'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(settings)
            self.assertEqual(error.exception.code, 400)
            with urllib.request.urlopen(base + '/api/settings') as response:
                self.assertEqual(json.load(response)['comfy_url'], 'auto')
            malicious = urllib.request.Request(base + '/api/project', data=b'{"revision":1}', method='PUT',
                                               headers={'Content-Type': 'application/json', 'Origin': 'https://bad.example'})
            with self.assertRaises(urllib.error.HTTPError) as error:
                urllib.request.urlopen(malicious)
            self.assertEqual(error.exception.code, 403)
        finally:
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == '__main__':
    unittest.main()
