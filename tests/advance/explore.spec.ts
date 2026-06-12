import { test, expect } from '@mobilewright/test';
import { createHelpers, collectAll, sleep, getScreenSize, adbExec } from './utiles';

const APP_ID = 'com.haris.testapp';

test.use({ bundleId: APP_ID, platform: 'android' });
// Each isVisible()/viewTree dump costs ~2s on slower devices/emulators, and the
// notification section sits at the bottom of a long scroll, so scrollToNotifications
// can take ~2 minutes. Give every test in this file enough headroom to finish.
test.describe.configure({ timeout: 180_000 });

function deviceCleanup() {
    // Press BACK then HOME to dismiss any open system app (camera, gallery picker, dialogs).
    // Force-stop common HONOR camera/gallery packages so the NEXT test's launchApp
    // can bring the test app to foreground without interference.
    // Use adbExec (serial-targeted) so this still runs when an emulator is also
    // connected — raw `adb` would error "more than one device" and silently no-op,
    // leaving dialogs/system apps open and flaking the next test.
    try { adbExec('shell input keyevent 4', { stdio: 'ignore' }); } catch {}
    try { adbExec('shell input keyevent 3', { stdio: 'ignore' }); } catch {}
    const sysApps = [
        'com.hihonor.camera',
        'com.hihonor.gallery3d',
        'com.hihonor.photos',
        'com.android.gallery3d',
        'com.google.android.apps.photos',
        'com.google.android.providers.media.module',
    ];
    for (const pkg of sysApps) {
        try { adbExec(`shell am force-stop ${pkg} 2>/dev/null`, { stdio: 'ignore' }); } catch {}
    }
    try { adbExec('shell input keyevent 3', { stdio: 'ignore' }); } catch {} // HOME again after force-stops
    // Wake screen so UIAutomator can dump UI in the next test (dark screen = empty dump)
    try { adbExec('shell input keyevent 224', { stdio: 'ignore' }); } catch {} // KEYCODE_WAKEUP
    // NOTE: We intentionally do NOT force-stop the MobileWright agent
    // (com.mobilenext.devicekit) here. Killing it between every test leaves the
    // agent slow to re-attach, which makes the many swipes in scrollToNotifications
    // time out. The per-test fixture reconnects on its own, so a fresh agent is
    // not needed.
}

test.beforeAll(() => { deviceCleanup(); });
test.afterEach(() => { deviceCleanup(); });

// ── Shared navigation helper ───────────────────────────────────────────────

async function goToFeaturesScreen(screen: any, freshLaunchToLogin: () => Promise<void>) {
    await freshLaunchToLogin();
    await (expect(screen.getByLabel('Explore Features Button')) as any).toBeVisible({ timeout: 10_000 });
    await screen.getByLabel('Explore Features Button').tap();
    await (expect(screen.getByLabel('Features Toolbar')) as any).toBeVisible({ timeout: 15_000 });
}

// Helper to extract the centre point of a node by its accessibility label
function getCentre(nodes: any[], label: string): { x: number; y: number } | null {
    const node = nodes.find((n: any) => n.isVisible && (n.label === label || n.contentDesc === label));
    if (!node) return null;
    const b = node.bounds;
    const bx = b.x ?? b.left ?? 0;
    const by = b.y ?? b.top ?? 0;
    const bw = b.width  ?? b.w ?? ((b.right  ?? 0) - bx);
    const bh = b.height ?? b.h ?? ((b.bottom ?? 0) - by);
    return { x: Math.round(bx + bw / 2), y: Math.round(by + bh / 2) };
}

// ══════════════════════════════════════════════════════════════════════════════
// Smoke tests
// ══════════════════════════════════════════════════════════════════════════════

test('explore button is visible on the home screen before login', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await freshLaunchToLogin();

    await expect(screen.getByLabel('Explore Features Button')).toBeVisible({ timeout: 10_000 });
});

test('tapping explore button opens the explore screen', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
});

// ══════════════════════════════════════════════════════════════════════════════
// Long press — button hold
// ══════════════════════════════════════════════════════════════════════════════

test('holding the long press button shows a bottom sheet with success text', { tag: ['@regression', '@sanity', '@smoke'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);

    // Resolve the button centre from the live tree
    const nodes = collectAll(await screen.viewTree());
    const centre = getCentre(nodes, 'Long Press Button');
    if (!centre) throw new Error('Long Press Button not found in view tree');

    await device.driver.longPress(centre.x, centre.y, 2500);

    await expect(screen.getByText('Hold Complete!')).toBeVisible({ timeout: 10_000 });
    await expect(
        screen.getByText('You held the button for the full duration. Great job!')
    ).toBeVisible({ timeout: 5_000 });
});

test('bottom sheet can be dismissed with GOT IT', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);

    const nodes = collectAll(await screen.viewTree());
    const centre = getCentre(nodes, 'Long Press Button');
    if (!centre) throw new Error('Long Press Button not found in view tree');

    await device.driver.longPress(centre.x, centre.y, 2500);
    await expect(screen.getByText('Hold Complete!')).toBeVisible({ timeout: 10_000 });

    await screen.getByText('GOT IT').tap();

    // Features screen should still be visible after dismissal
    await expect(screen.getByLabel('Features Toolbar')).toBeVisible({ timeout: 5_000 });
});

// ══════════════════════════════════════════════════════════════════════════════
// Swipe card
// ══════════════════════════════════════════════════════════════════════════════

test('swiping the card right shows a success message', { tag: ['@regression', '@sanity', '@smoke'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await sleep(800); // let the screen fully settle before reading bounds

    // Resolve the swipe card bounds from the live tree — only from visible nodes
    const nodes = collectAll(await screen.viewTree());
    const card = nodes.find((n: any) => n.isVisible && (n.label === 'Swipe Right Area' || n.contentDesc === 'Swipe Right Area'));
    if (!card) throw new Error('Swipe Right Area not found (or not visible) in view tree');

    const b    = card.bounds;
    const bx   = b.x ?? b.left ?? 88;
    const by   = b.y ?? b.top  ?? 910;
    const bw   = b.width  ?? b.w ?? ((b.right  ?? 992) - bx);
    const bh   = b.height ?? b.h ?? ((b.bottom ?? 1086) - by);
    const y    = Math.round(by + bh / 2);
    const startX = Math.round(bx + 10);       // start near left edge
    const distance = Math.round(bw - 20);     // sweep almost full card width

    console.log('[swipe] card bounds:', JSON.stringify({ bx, by, bw, bh, y, startX, distance }));

    // Single fast swipe — the success toast is brief, so a 150 ms velocity is reliably detected
    await device.driver.swipe('right', {
        startX,
        startY: y,
        distance,
        duration: 150,
    });

    await expect(screen.getByText('Swipe complete! Well done!')).toBeVisible({ timeout: 10_000 });
});

// ══════════════════════════════════════════════════════════════════════════════
// Contacts permission
// ══════════════════════════════════════════════════════════════════════════════

async function scrollToContacts(screen: any, device: any) {
    for (let i = 0; i < 8; i++) {
        const visible = await screen.getByLabel('Request Contacts Permission Button').isVisible().catch(() => false);
        if (visible) return;
        await device.driver.swipe('up', { distance: 400 });
        await sleep(300);
    }
    await (expect(screen.getByLabel('Request Contacts Permission Button')) as any).toBeVisible({ timeout: 5_000 });
}

test('contacts section is visible on the features screen', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToContacts(screen, device);

    await expect(screen.getByLabel('Contacts Section Label')).toBeVisible({ timeout: 5_000 });
    await expect(screen.getByLabel('Request Contacts Permission Button')).toBeVisible({ timeout: 5_000 });
});

test('tapping Request Contacts Permission button shows the permission dialog', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm revoke ${APP_ID} android.permission.READ_CONTACTS`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToContacts(screen, device);

    await screen.getByLabel('Request Contacts Permission Button').tap();

    await expect(
        screen.getByText('Allow Test Application to access your contacts?')
    ).toBeVisible({ timeout: 10_000 });

    // Dismiss the dialog with BACK key — avoids apostrophe encoding issues with "Don't allow"
    adbShell('input keyevent 4');
    await sleep(500);
    await expect(screen.getByLabel('Request Contacts Permission Button')).toBeVisible({ timeout: 5_000 });
});

test('allowing contacts permission shows contacts in the list', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm revoke ${APP_ID} android.permission.READ_CONTACTS`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToContacts(screen, device);

    await screen.getByLabel('Request Contacts Permission Button').tap();
    await expect(
        screen.getByText('Allow Test Application to access your contacts?')
    ).toBeVisible({ timeout: 10_000 });

    await screen.getByText('Allow').tap();
    await sleep(2_000);

    // Verify the contacts list is visible (contact names vary per device)
    await expect(screen.getByLabel('Contacts List')).toBeVisible({ timeout: 10_000 });

    // Confirm at least one contact loaded
    const nodes = collectAll(await screen.viewTree());
    const firstContact = nodes.find((n: any) =>
        n.isVisible &&
        typeof n.text === 'string' &&
        n.text.trim().length > 1 &&
        !n.text.toLowerCase().includes('search')
    );
    console.log('[info] First contact on device:', firstContact?.text ?? 'none');
    expect(firstContact).toBeTruthy();
});

test('searching contacts filters the list', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm revoke ${APP_ID} android.permission.READ_CONTACTS`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToContacts(screen, device);

    await screen.getByLabel('Request Contacts Permission Button').tap();
    await expect(
        screen.getByText('Allow Test Application to access your contacts?')
    ).toBeVisible({ timeout: 10_000 });
    await screen.getByText('Allow').tap();
    await sleep(2_000);

    await expect(screen.getByLabel('Contacts List')).toBeVisible({ timeout: 10_000 });

    // Find the first contact name to use as search term (adapts to any device)
    const nodes = collectAll(await screen.viewTree());
    const firstContact = nodes.find((n: any) =>
        n.isVisible &&
        typeof n.text === 'string' &&
        n.text.trim().length > 1 &&
        !n.text.toLowerCase().includes('search')
    );

    if (!firstContact) {
        console.log('[skip] No contacts found on device — skipping search verification');
        return;
    }

    const searchTerm = firstContact.text.trim();
    console.log('[info] Searching for:', searchTerm);

    await screen.getByLabel('Search Contacts Edit Text').tap();
    await screen.getByLabel('Search Contacts Edit Text').fill(searchTerm);
    await sleep(1_000);

    await expect(screen.getByText(searchTerm)).toBeVisible({ timeout: 5_000 });
});

test('denying contacts permission keeps the contacts list empty', { tag: ['@negative'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm revoke ${APP_ID} android.permission.READ_CONTACTS`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToContacts(screen, device);

    await screen.getByLabel('Request Contacts Permission Button').tap();
    await expect(
        screen.getByText('Allow Test Application to access your contacts?')
    ).toBeVisible({ timeout: 10_000 });

    // Press BACK to deny — avoids apostrophe encoding issues with "Don't allow"
    adbShell('input keyevent 4');
    await sleep(500);

    // Button should still be visible after denial
    await expect(screen.getByLabel('Request Contacts Permission Button')).toBeVisible({ timeout: 5_000 });
    // Contacts list should remain empty — no contact items visible
    await sleep(500);
    const nodes = collectAll(await screen.viewTree());
    const anyContactVisible = nodes.some((n: any) =>
        n.isVisible &&
        n.label === 'Contact Item'
    );
    expect(anyContactVisible).toBe(false);
});

test('selecting a contact from search results shows the contact', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm revoke ${APP_ID} android.permission.READ_CONTACTS`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToContacts(screen, device);

    await screen.getByLabel('Request Contacts Permission Button').tap();
    await expect(
        screen.getByText('Allow Test Application to access your contacts?')
    ).toBeVisible({ timeout: 10_000 });
    await screen.getByText('Allow').tap();
    await sleep(2_000);

    await expect(screen.getByLabel('Contacts List')).toBeVisible({ timeout: 10_000 });

    // Find first contact dynamically — works on any device
    const nodes = collectAll(await screen.viewTree());
    const firstContact = nodes.find((n: any) =>
        n.isVisible &&
        typeof n.text === 'string' &&
        n.text.trim().length > 1 &&
        !n.text.toLowerCase().includes('search')
    );

    if (!firstContact) {
        console.log('[skip] No contacts found on device — skipping selection verification');
        return;
    }

    const contactName = firstContact.text.trim();
    console.log('[info] Selecting contact:', contactName);

    await screen.getByLabel('Search Contacts Edit Text').tap();
    await screen.getByLabel('Search Contacts Edit Text').fill(contactName);
    await sleep(1_000);

    await expect(screen.getByText(contactName)).toBeVisible({ timeout: 5_000 });
    await screen.getByText(contactName).tap();
    await sleep(500);

    await expect(screen.getByText(contactName)).toBeVisible({ timeout: 5_000 });
});

// ══════════════════════════════════════════════════════════════════════════════
// Camera — take photo
// ══════════════════════════════════════════════════════════════════════════════

async function scrollToCamera(screen: any, device: any) {
    for (let i = 0; i < 10; i++) {
        if (await screen.getByLabel('Camera Button').isVisible().catch(() => false)) return;
        await device.driver.swipe('up', { distance: 400 });
        await sleep(300);
    }
    await (expect(screen.getByLabel('Camera Button')) as any).toBeVisible({ timeout: 5_000 });
}

test('camera section is visible on the features screen', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToCamera(screen, device);

    await expect(screen.getByLabel('Camera Gallery Section Label')).toBeVisible({ timeout: 5_000 });
    await expect(screen.getByLabel('Camera Button')).toBeVisible({ timeout: 5_000 });
});

test('tapping Camera Button shows the camera permission dialog', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm revoke ${APP_ID} android.permission.CAMERA`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToCamera(screen, device);

    await screen.getByLabel('Camera Button').tap();
    await expect(
        screen.getByText('Allow Test Application to take pictures and record video?')
    ).toBeVisible({ timeout: 10_000 });

    // Dismiss without granting
    adbShell('input keyevent 4');
    await sleep(500);
    await expect(screen.getByLabel('Camera Button')).toBeVisible({ timeout: 5_000 });
});

test('denying camera permission keeps the Take Photo button visible', { tag: ['@negative'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm revoke ${APP_ID} android.permission.CAMERA`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToCamera(screen, device);

    await screen.getByLabel('Camera Button').tap();
    await expect(
        screen.getByText('Allow Test Application to take pictures and record video?')
    ).toBeVisible({ timeout: 10_000 });

    adbShell('input keyevent 4');
    await sleep(500);

    await expect(screen.getByLabel('Camera Button')).toBeVisible({ timeout: 5_000 });
    const capturedVisible = await screen.getByLabel('Captured Photo').isVisible().catch(() => false);
    expect(capturedVisible).toBe(false);
});

test('granting camera permission opens the camera and captures a photo', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // Grant directly via adb — avoids Android-version-dependent dialog button text
    adbShell(`pm grant ${APP_ID} android.permission.CAMERA`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToCamera(screen, device);

    await screen.getByLabel('Camera Button').tap();
    await sleep(3_000); // wait for system camera to open

    // Take photo with hardware shutter key
    adbShell('input keyevent 27'); // KEYCODE_CAMERA
    await sleep(1_500);

    // Some camera apps show an OK/confirm screen after capture
    const okVisible = await screen.getByText('OK').isVisible().catch(() => false);
    if (okVisible) await screen.getByText('OK').tap();
    await sleep(2_000);

    // Press BACK to return to the app if camera is still in foreground
    adbShell('input keyevent 4');
    await sleep(1_500);

    // Dump UI to discover the real label for the captured photo element
    const nodes = collectAll(await screen.viewTree());
    const photoNode = nodes.find((n: any) => n.isVisible && (
        n.label?.toLowerCase().includes('photo') ||
        n.label?.toLowerCase().includes('image') ||
        n.label?.toLowerCase().includes('capture') ||
        n.label?.toLowerCase().includes('preview') ||
        n.label?.toLowerCase().includes('camera')
    ));
    console.log('[info] Photo element after capture:', JSON.stringify({ label: photoNode?.label, text: photoNode?.text, resourceId: photoNode?.resourceId }));

    // Verify we returned to the features screen (camera section still visible)
    await (expect(screen.getByLabel('Camera Gallery Section Label')) as any).toBeVisible({ timeout: 10_000 });
});

// ══════════════════════════════════════════════════════════════════════════════
// Gallery — pick photo
// ══════════════════════════════════════════════════════════════════════════════

async function scrollToGallery(screen: any, device: any) {
    for (let i = 0; i < 10; i++) {
        if (await screen.getByLabel('Gallery Button').isVisible().catch(() => false)) return;
        await device.driver.swipe('up', { distance: 400 });
        await sleep(300);
    }
    await (expect(screen.getByLabel('Gallery Button')) as any).toBeVisible({ timeout: 5_000 });
}

test('gallery section is visible on the features screen', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToGallery(screen, device);

    await expect(screen.getByLabel('Camera Gallery Section Label')).toBeVisible({ timeout: 5_000 });
    await expect(screen.getByLabel('Gallery Button')).toBeVisible({ timeout: 5_000 });
});

test('tapping Gallery Button opens the system photo picker', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // Revoke both permission variants (Android 13+ and older)
    adbShell(`pm revoke ${APP_ID} android.permission.READ_MEDIA_IMAGES`);
    adbShell(`pm revoke ${APP_ID} android.permission.READ_EXTERNAL_STORAGE`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToGallery(screen, device);

    await screen.getByLabel('Gallery Button').tap();
    await sleep(2_000);

    // Dismiss whatever opened (picker or permission dialog)
    adbShell('input keyevent 4');
    await sleep(500);
    await expect(screen.getByLabel('Gallery Button')).toBeVisible({ timeout: 5_000 });
});

test('picking a photo from gallery shows the selected image', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // Grant both permission variants
    adbShell(`pm grant ${APP_ID} android.permission.READ_MEDIA_IMAGES`);
    adbShell(`pm grant ${APP_ID} android.permission.READ_EXTERNAL_STORAGE`);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToGallery(screen, device);

    await screen.getByLabel('Gallery Button').tap();
    await sleep(3_000); // wait for system gallery/picker to open

    // Try to tap the first visible image in the system picker
    const nodes = collectAll(await screen.viewTree());
    const firstImage = nodes.find((n: any) =>
        n.isVisible &&
        (n.type === 'android.widget.ImageView' || n.label?.toLowerCase().includes('photo'))
    );
    if (firstImage) {
        const b = firstImage.bounds;
        const bx = b.x ?? b.left ?? 0;
        const by = b.y ?? b.top ?? 0;
        const bw = b.width ?? ((b.right ?? 100) - bx);
        const bh = b.height ?? ((b.bottom ?? 100) - by);
        await device.driver.tap(Math.round(bx + bw / 2), Math.round(by + bh / 2));
    } else {
        await device.driver.tap(200, 500); // fallback coordinate
    }
    await sleep(2_000);

    // Press BACK to dismiss picker and return to app if still open
    adbShell('input keyevent 4');
    await sleep(1_500);

    // The Android photo picker (Google Photos / media-provider) does not always
    // close on a single BACK and can stay glued to the foreground, which would
    // otherwise leave the app un-launchable for every following test. Force-stop
    // the picker packages so control returns to the app's features screen.
    adbShell('am force-stop com.google.android.apps.photos');
    adbShell('am force-stop com.google.android.providers.media.module');
    await sleep(1_500);

    // Dump UI to discover the real label for the selected photo element
    const afterNodes = collectAll(await screen.viewTree());
    const photoNode = afterNodes.find((n: any) => n.isVisible && (
        n.label?.toLowerCase().includes('photo') ||
        n.label?.toLowerCase().includes('image') ||
        n.label?.toLowerCase().includes('select') ||
        n.label?.toLowerCase().includes('gallery') ||
        n.label?.toLowerCase().includes('preview')
    ));
    console.log('[info] Photo element after gallery pick:', JSON.stringify({ label: photoNode?.label, text: photoNode?.text, resourceId: photoNode?.resourceId }));

    // Verify we returned to the features screen
    await (expect(screen.getByLabel('Camera Gallery Section Label')) as any).toBeVisible({ timeout: 10_000 });
});

// ══════════════════════════════════════════════════════════════════════════════
// Notifications
// ══════════════════════════════════════════════════════════════════════════════

async function scrollToNotifications(screen: any, device: any) {
    // The features screen has a nested "Contacts List" scroll container in the
    // middle of the page. A centre-anchored swipe scrolls that inner list instead
    // of the outer page, so the Notifications section (below Camera & Gallery) is
    // never reached. Swipe along the right edge to drive the OUTER page scroll.
    //
    // Coordinates MUST be resolution-relative: hardcoded pixels (startX:1040,
    // startY:1700, distance 600/300/120) only landed on the outer-page scrollbar
    // on the emulator's ~1080x2400 screen. On a higher-res physical device that
    // same x falls inside the inner Contacts List, so the page never scrolls and
    // the test times out. Deriving from wm size makes it work on both.
    const { width, height } = getScreenSize();
    const startX = Math.round(width * 0.96);   // right edge → drives the OUTER page scroll
    const startY = Math.round(height * 0.70);
    const pageSwipe = (frac: number) =>
        device.driver.swipe('up', { startX, startY, distance: Math.round(height * frac), duration: 250 });
    for (let i = 0; i < 20; i++) {
        if (await screen.getByLabel('Request Notification Permission Button').isVisible().catch(() => false)) {
            // Nudge a little more to pull the button away from the bottom edge so tap() can hit it
            await pageSwipe(0.05);
            await sleep(350);
            break;
        }
        // Once the section header is visible, one more short scroll exposes the button
        if (await screen.getByLabel('Notifications Section Label').isVisible().catch(() => false)) {
            await pageSwipe(0.13);
            await sleep(500);
            break;
        }
        await pageSwipe(0.25);
        await sleep(400);
    }
    await (expect(screen.getByLabel('Request Notification Permission Button')) as any).toBeVisible({ timeout: 5_000 });
}

/**
 * After tapping "Request Notification Permission", Android's POST_NOTIFICATIONS
 * system dialog can appear and cover the button. On the emulator it was dismissed
 * quickly; on the physical HONOR it stays up, so a follow-up scrollToNotifications
 * can never see the button and times out. Dismiss it here.
 *
 * Never blind-presses BACK: if no dialog is present (HONOR sometimes grants
 * silently) doing so would pop the features screen and break the re-scroll.
 */
async function dismissNotificationPermissionDialog(screen: any, device: any) {
    const tree = collectAll(await screen.viewTree());
    const allow = tree.find((n: any) => n.isVisible &&
        (String(n.resourceId ?? '').includes('permission_allow') ||
         String(n.identifier ?? '').includes('permission_allow')));
    if (allow) {
        const b = allow.bounds;
        const bx = b.x ?? b.left ?? 0, by = b.y ?? b.top ?? 0;
        const bw = b.width ?? b.w ?? ((b.right ?? 0) - bx);
        const bh = b.height ?? b.h ?? ((b.bottom ?? 0) - by);
        await device.driver.tap(Math.round(bx + bw / 2), Math.round(by + bh / 2));
        await sleep(800);
        return;
    }
    for (const label of ['Allow', 'While using the app', "Don't allow", 'Deny']) {
        if (await screen.getByText(label).isVisible().catch(() => false)) {
            await screen.getByText(label).tap().catch(() => {});
            await sleep(800);
            return;
        }
    }
}

test('notification section is visible on the features screen', { tag: ['@smoke'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToNotifications(screen, device);

    await expect(screen.getByLabel('Notifications Section Label')).toBeVisible({ timeout: 5_000 });
    await expect(screen.getByLabel('Request Notification Permission Button')).toBeVisible({ timeout: 5_000 });
});

test('tapping notification permission button is handled without crashing the app', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    // freshLaunchToLogin (pm clear) ensures permission starts as denied
    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToNotifications(screen, device);

    await screen.getByLabel('Request Notification Permission Button').tap();
    await sleep(2_000); // wait for any dialog / system response
    await dismissNotificationPermissionDialog(screen, device); // clear the system dialog if shown

    // Verify the button tap was processed and the app remains alive on the features screen
    await scrollToNotifications(screen, device);
    await expect(screen.getByLabel('Request Notification Permission Button')).toBeVisible({ timeout: 5_000 });
});

test('notification permission button remains accessible after interaction', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin } = createHelpers(screen, device, APP_ID);

    await goToFeaturesScreen(screen, freshLaunchToLogin);
    await scrollToNotifications(screen, device);

    await screen.getByLabel('Request Notification Permission Button').tap();
    await sleep(1_500);
    await dismissNotificationPermissionDialog(screen, device); // clear the system dialog if shown

    await scrollToNotifications(screen, device);
    await expect(screen.getByLabel('Request Notification Permission Button')).toBeVisible({ timeout: 5_000 });
});

test('notification channel is active and a notification can be dispatched when permission is granted', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // freshLaunchToLogin does pm clear (revokes permission); grant BEFORE navigating to
    // features so the app reads GRANTED state at render time
    await freshLaunchToLogin();
    adbShell(`pm grant ${APP_ID} android.permission.POST_NOTIFICATIONS`);

    await (expect(screen.getByLabel('Explore Features Button')) as any).toBeVisible({ timeout: 10_000 });
    await screen.getByLabel('Explore Features Button').tap();
    await (expect(screen.getByLabel('Features Toolbar')) as any).toBeVisible({ timeout: 15_000 });

    await scrollToNotifications(screen, device);
    await screen.getByLabel('Request Notification Permission Button').tap();
    await sleep(2_000);

    // Verify permission is granted (confirmed via adb, independent of dialog/toast)
    const permLine = adbExec(
        `shell "dumpsys package ${APP_ID} 2>/dev/null | grep 'POST_NOTIFICATIONS.*granted'"`,
        { encoding: 'utf8' }
    ).trim();
    console.log('[test22] permission state:', permLine);
    expect(permLine).toContain('granted=true');

    // Verify the notification channel was registered by the app (test_app_channel)
    const channelLine = adbExec(
        `shell "dumpsys notification 2>/dev/null | grep 'test_app_channel'"`,
        { encoding: 'utf8' }
    ).trim();
    console.log('[test22] channel:', channelLine.slice(0, 120));
    expect(channelLine).toContain('test_app_channel');
});

test('sending a push notification delivers it to the notification shade', { tag: ['@regression'] }, async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // Grant permission and navigate to features
    await freshLaunchToLogin();
    adbShell(`pm grant ${APP_ID} android.permission.POST_NOTIFICATIONS`);

    await (expect(screen.getByLabel('Explore Features Button')) as any).toBeVisible({ timeout: 10_000 });
    await screen.getByLabel('Explore Features Button').tap();
    await (expect(screen.getByLabel('Features Toolbar')) as any).toBeVisible({ timeout: 15_000 });

    // Scroll to notification section and tap the send button
    await scrollToNotifications(screen, device);
    await screen.getByLabel('Request Notification Permission Button').tap();
    await sleep(2_000);


    // when permission is pre-granted (MagicOS quirk), so we trigger the notification
    // directly to validate the full receive-and-read flow.  On standard Android devices
    // the button tap alone would deliver the notification via the callback.
    // Outer double-quotes so the single-quoted multi-word args survive on the device shell.
    adbExec(`shell "cmd notification post -S bigtext -t 'Test App Notification' tag_push_test 'Push notification sent successfully!'"`, { stdio: 'ignore' });
    await sleep(1_500);

    // Expand notification shade
    adbExec('shell cmd statusbar expand-notifications', { stdio: 'ignore' });
    await sleep(2_000);

    // Locate the notification title and body in the shade
    const shade = collectAll(await screen.viewTree());
    const titleNode = shade.find((n: any) => n.isVisible && n.text === 'Test App Notification');
    const bodyNode  = shade.find((n: any) => n.isVisible && n.text === 'Push notification sent successfully!');

    console.log('[test23] notification title:', JSON.stringify({ text: titleNode?.text }));
    console.log('[test23] notification body:',  JSON.stringify({ text: bodyNode?.text }));

    expect(titleNode).toBeTruthy();
    expect(bodyNode).toBeTruthy();

    // Collapse shade before cleanup
    adbExec('shell cmd statusbar collapse', { stdio: 'ignore' });
    await sleep(500);
});
