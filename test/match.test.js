'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const { rankSkills, tokenize } = require('../src/lib/match');

const skills = [
  { name: 'embedded-captions', description: 'Add captions or subtitles to a talking-head video' },
  { name: 'gsap-scrolltrigger', description: 'Scroll-linked animations, pinning, and scrub' },
  { name: 'banner-design', description: 'Design banners for social media and ads' },
  { name: 'ppt-master', description: 'Create editable PPTX decks and slides' },
  { name: 'hyperframes-audio', description: 'Mix music and voiceover in a video' },
];

test('rankSkills: English queries hit names and descriptions', () => {
  assert.equal(rankSkills('add captions to a video', skills)[0].name, 'embedded-captions');
  assert.equal(rankSkills('scroll animation', skills)[0].name, 'gsap-scrolltrigger');
});

test('rankSkills: Chinese synonyms reach English names', () => {
  assert.equal(rankSkills('给视频加字幕', skills)[0].name, 'embedded-captions');
  assert.equal(rankSkills('设计一个广告横幅', skills)[0].name, 'banner-design');
  assert.equal(rankSkills('做一份 PPT', skills)[0].name, 'ppt-master');
  assert.equal(rankSkills('视频混音', skills)[0].name, 'hyperframes-audio');
});

test('tokenize: plural normalization and CJK bigrams', () => {
  const tokens = tokenize('captions 视频');
  assert.ok(tokens.has('captions'));
  assert.ok(tokens.has('caption'));
  assert.ok(tokens.has('视频'));
  assert.ok(tokens.has('video'));
});
