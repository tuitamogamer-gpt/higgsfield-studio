import test from 'node:test';
import assert from 'node:assert/strict';
import { isActiveStatus, isFailedStatus, isTerminalStatus, mediaKind, mediaUrls } from '../src/lib/media.ts';

test('mediaUrls collects nested provider outputs once, with type hints', () => {
  const output = {
    media_type: 'video',
    video: { url: 'https://cdn.pika.art/a.mp4' },
    images: ['https://cdn.pika.art/b.png', 'https://cdn.pika.art/b.png'],
    files: [{ url: 'https://cdn.pika.art/c.zip', content_type: 'application/zip' }],
    ignored: 'https://cdn.pika.art/not-a-result.mp4',
    prompt: 'not a url',
  };
  assert.deepEqual(mediaUrls(output), [
    { url: 'https://cdn.pika.art/a.mp4', type: 'video' },
    { url: 'https://cdn.pika.art/b.png', type: 'image' },
    { url: 'https://cdn.pika.art/c.zip', type: 'application/zip' },
  ]);
});

test('mediaUrls ignores non-http values and empty outputs', () => {
  assert.deepEqual(mediaUrls(null), []);
  assert.deepEqual(mediaUrls({ url: 'javascript:alert(1)' }), []);
  assert.deepEqual(mediaUrls({ video: { url: 'data:video/mp4;base64,AAAA' } }), []);
});

test('mediaKind uses the content type first, then the file extension', () => {
  assert.equal(mediaKind({ url: 'https://x/result', type: 'image/png' }), 'image');
  assert.equal(mediaKind({ url: 'https://x/a.webm?sig=1', type: '' }), 'video');
  assert.equal(mediaKind({ url: 'https://x/a.flac', type: '' }), 'audio');
  assert.equal(mediaKind({ url: 'https://x/a.zip', type: 'application/zip' }), 'file');
});

test('status helpers agree on active, failed, and terminal jobs', () => {
  for (const status of ['queued', 'running', 'pending', 'processing']) {
    assert.equal(isActiveStatus(status), true);
    assert.equal(isTerminalStatus(status), false);
  }
  for (const status of ['failed', 'cancelled', 'canceled']) {
    assert.equal(isFailedStatus(status), true);
    assert.equal(isTerminalStatus(status), true);
  }
  assert.equal(isTerminalStatus('completed'), true);
  assert.equal(isActiveStatus(undefined), false);
});
