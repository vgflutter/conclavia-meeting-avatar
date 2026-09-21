import { expect, test } from '@playwright/test';
import type { AssistantProfileResponse } from '../../src/types/assistant-profile';

function identity(profile: AssistantProfileResponse) {
  return { displayName: profile.displayName, role: profile.role, appearance: profile.appearance,
    visualStyle: profile.visualStyle || 'editorial', responseStyle: profile.personality.responseStyle,
    attitude: profile.personality.attitude, voiceStyle: profile.voice.style,
    inworldVoiceIdIt: profile.voice.inworldVoiceIdIt, inworldVoiceIdEn: profile.voice.inworldVoiceIdEn };
}

test.beforeEach(async ({ page }) => {
  expect(process.env.MONGODB_URI).toBe('mongodb://127.0.0.1:27018');
  expect(process.env.MONGODB_DB_NAME).toMatch(/^conclavia_e2e_/);
  await page.context().addCookies([{ name: 'conclavia_locale', value: 'en', url: 'http://127.0.0.1:3101' }]);
});

test('catalog: style-specific identities, reversible choices and no implicit saves', async ({ page, request }) => {
  const original = (await (await request.get('/api/avatar')).json()).profile;
  const writes: string[] = [];
  page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await page.goto('/avatar/test');
  const style = page.getByLabel('Avatar style', { exact: true });
  const appearance = page.getByLabel('Avatar appearance', { exact: true });
  await style.selectOption('portrait_2_5d');
  await expect(appearance.locator('option')).toHaveCount(4);
  await appearance.selectOption('portrait_natural_female');
  await expect(page.getByTestId('portrait-canvas')).toHaveAttribute('data-renderer-ready', 'true');
  const voice = await page.getByTestId('preview-voices').textContent();
  await style.selectOption('stylized_3d');
  await expect(appearance).toHaveValue('business_clay_female');
  await expect(appearance.locator('option')).toHaveCount(2);
  await expect(page.getByTestId('avatar-3d-canvas')).toHaveAttribute('data-renderer-ready', 'true');
  await style.selectOption('portrait_2_5d');
  await expect(appearance).toHaveValue('portrait_natural_female');
  await expect(page.getByTestId('preview-voices')).toHaveText(voice || '');
  // A remembered portrait from another identity must not change gender or voice
  // when the user only changes the rendering style.
  await style.selectOption('stylized_3d');
  await appearance.selectOption('business_clay');
  const maleVoice = await page.getByTestId('preview-voices').textContent();
  await style.selectOption('portrait_2_5d');
  await expect(appearance).toHaveValue('business_clay');
  await expect(page.getByTestId('preview-voices')).toHaveText(maleVoice || '');
  await page.getByRole('button', { name: 'Discard changes' }).click();
  await expect(appearance).toHaveValue(original.appearance);
  await expect(style).toHaveValue(original.visualStyle || 'editorial');
  expect(writes).toEqual([]);
  expect((await (await request.get('/api/avatar')).json()).profile).toEqual(original);
});

test('catalog: explicit photographic save, legacy partial edit and incompatible pair rejection', async ({ page, request }) => {
  const original = (await (await request.get('/api/avatar')).json()).profile;
  try {
    await page.goto('/avatar');
    await page.getByLabel('Avatar style', { exact: true }).selectOption('portrait_2_5d');
    await page.getByLabel('Avatar appearance').selectOption('portrait_natural_female');
    await page.getByRole('button', { name: 'Save avatar', exact: true }).click();
    await expect(page.getByText('Avatar updated.', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Avatar appearance')).toHaveValue('portrait_natural_female');
    const saved = (await (await request.get('/api/avatar')).json()).profile;
    expect(saved.voice.inworldVoiceIdIt).toBeTruthy();
    expect(saved.displayName).toBe(original.displayName);
    const { appearance: omittedAppearance, visualStyle: omittedStyle, ...partial } = identity(saved);
    expect(omittedAppearance).toBe('portrait_natural_female');
    expect(omittedStyle).toBe('portrait_2_5d');
    expect((await request.patch('/api/avatar', { data: partial })).status()).toBe(200);
    const preserved = (await (await request.get('/api/avatar')).json()).profile;
    expect(preserved.appearance).toBe(saved.appearance);
    expect(preserved.visualStyle).toBe(saved.visualStyle);
    expect(preserved.voice).toEqual(saved.voice);
    expect((await request.patch('/api/avatar', { data: { ...identity(saved), visualStyle: 'stylized_3d' } })).status()).toBe(400);
    expect((await request.patch('/api/avatar', { data: { ...partial, visualStyle: 'editorial' } })).status()).toBe(400);
    expect((await (await request.get('/api/avatar')).json()).profile).toEqual(preserved);
  } finally {
    await page.goto('about:blank');
    expect((await request.patch('/api/avatar', { data: identity(original) })).status()).toBe(200);
  }
});

test('catalog: profiles stored before visualStyle existed can still be edited', async ({ request }) => {
  const { default: mongoose } = await import('mongoose');
  const original = (await (await request.get('/api/avatar')).json()).profile;
  const connection = await mongoose.createConnection(process.env.MONGODB_URI!, { dbName: process.env.MONGODB_DB_NAME }).asPromise();
  try {
    expect((await request.patch('/api/avatar', { data: { ...identity(original), appearance: 'business_clay', visualStyle: 'editorial' } })).status()).toBe(200);
    await connection.collection('assistantprofiles').updateOne({ key: 'default' }, { $unset: { visualStyle: '' } });
    const legacy = (await (await request.get('/api/avatar')).json()).profile;
    expect(legacy.visualStyle).toBe('editorial');
    const { visualStyle, ...partial } = identity(legacy);
    expect(visualStyle).toBe('editorial');
    expect((await request.patch('/api/avatar', { data: { ...partial, role: 'Legacy profile updated' } })).status()).toBe(200);
    expect((await (await request.get('/api/avatar')).json()).profile.role).toBe('Legacy profile updated');
  } finally {
    await connection.close();
    expect((await request.patch('/api/avatar', { data: identity(original) })).status()).toBe(200);
  }
});
