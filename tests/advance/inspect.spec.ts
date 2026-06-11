import { test, expect } from '@mobilewright/test';
import { createHelpers, collectAll, sleep, getScreenSize, adbExec } from './utiles';

const APP_ID = 'com.haris.testapp';
test.use({ bundleId: APP_ID, platform: 'android' });
// Scrolling to the notification section does many ~2s UI dumps, so these
// inspection dumps need generous headroom on slower devices/emulators.
test.setTimeout(180_000);

test.afterEach(() => {
    // BACK first to dismiss a lingering permission dialog / notification shade,
    // then HOME. Must use adbExec (serial-targeted): with an emulator also
    // connected, raw `adb` errors "more than one device" and the leftover dialog
    // blocks the next test's launchApp.
    try { adbExec('shell input keyevent 4', { stdio: 'ignore' }); } catch {}
    try { adbExec('shell cmd statusbar collapse', { stdio: 'ignore' }); } catch {}
    try { adbExec('shell input keyevent 3', { stdio: 'ignore' }); } catch {}
});

function dumpNodes(nodes: any[], label: string) {
    console.log(`\n=== ${label} ===`);
    for (const n of nodes) {
        if (!n.isVisible) continue;
        if (!n.label && !n.text && !n.resourceId) continue;
        console.log(JSON.stringify({ label: n.label, text: n.text, resourceId: n.resourceId }));
    }
    console.log(`=== END ${label} ===\n`);
}

// The features screen has a nested "Contacts List" scroll container in the middle
// of the page; a centre-anchored swipe scrolls that inner list instead of the
// outer page, so the Notifications section (below Camera & Gallery) is never
// reached. Swipe along the right edge to drive the OUTER page scroll.
// Resolution-relative right-edge swipe — hardcoded pixels only worked on the
// emulator; on a higher-res physical device startX:1040 falls inside the inner
// Contacts List and never scrolls the outer page. `distance` stays in pixels so
// existing call sites keep working; scale it off the screen height for parity.
function pageSwipe(device: any, distance: number) {
    const { width, height } = getScreenSize();
    return device.driver.swipe('up', {
        startX: Math.round(width * 0.96),
        startY: Math.round(height * 0.70),
        distance: Math.round(height * (distance / 2400)), // 2400 = the emulator height these px were tuned for
        duration: 250,
    });
}

test('dump UI after camera capture', async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm grant ${APP_ID} android.permission.CAMERA`);
    await freshLaunchToLogin();
    await screen.getByLabel('Explore Features Button').tap();
    await sleep(500);

    for (let i = 0; i < 10; i++) {
        if (await screen.getByLabel('Camera Button').isVisible().catch(() => false)) break;
        await device.driver.swipe('up', { distance: 400 });
        await sleep(300);
    }

    await screen.getByLabel('Camera Button').tap();
    await sleep(3_000);

    adbShell('input keyevent 27'); // KEYCODE_CAMERA shutter
    await sleep(2_000);

    const okVisible = await screen.getByText('OK').isVisible().catch(() => false);
    if (okVisible) await screen.getByText('OK').tap();
    await sleep(1_000);

    adbShell('input keyevent 4'); // BACK — return to app
    await sleep(1_500);

    dumpNodes(collectAll(await screen.viewTree()), 'UI AFTER CAMERA CAPTURE');
});

test('dump UI after gallery pick', async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    adbShell(`pm grant ${APP_ID} android.permission.READ_MEDIA_IMAGES`);
    adbShell(`pm grant ${APP_ID} android.permission.READ_EXTERNAL_STORAGE`);
    await freshLaunchToLogin();
    await screen.getByLabel('Explore Features Button').tap();
    await sleep(500);

    for (let i = 0; i < 10; i++) {
        if (await screen.getByLabel('Gallery Button').isVisible().catch(() => false)) break;
        await device.driver.swipe('up', { distance: 400 });
        await sleep(300);
    }

    await screen.getByLabel('Gallery Button').tap();
    await sleep(3_000);

    // Tap first visible image in the picker
    const nodes = collectAll(await screen.viewTree());
    const firstImage = nodes.find((n: any) =>
        n.isVisible && (n.type === 'android.widget.ImageView' || n.label?.toLowerCase().includes('photo'))
    );
    if (firstImage) {
        const b = firstImage.bounds;
        const bx = b.x ?? b.left ?? 0;
        const by = b.y ?? b.top ?? 0;
        const bw = b.width ?? ((b.right ?? 100) - bx);
        const bh = b.height ?? ((b.bottom ?? 100) - by);
        await device.driver.tap(Math.round(bx + bw / 2), Math.round(by + bh / 2));
    } else {
        await device.driver.tap(200, 500);
    }
    await sleep(2_000);

    adbShell('input keyevent 4'); // BACK — return to app if picker still open
    // The Android photo picker can stay glued to the foreground after BACK, which
    // would leave the app un-launchable for every following test. Force-stop the
    // picker packages so control returns to the app.
    adbShell('am force-stop com.google.android.apps.photos');
    adbShell('am force-stop com.google.android.providers.media.module');
    await sleep(1_000);

    dumpNodes(collectAll(await screen.viewTree()), 'UI AFTER GALLERY PICK');
});

test('dump UI when notification permission dialog should show', async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // Fresh start — pm clear revokes all permissions
    await freshLaunchToLogin();
    await screen.getByLabel('Explore Features Button').tap();
    await sleep(500);

    // Scroll to notification section
    for (let i = 0; i < 20; i++) {
        if (await screen.getByLabel('Request Notification Permission Button').isVisible().catch(() => false)) break;
        if (await screen.getByLabel('Notifications Section Label').isVisible().catch(() => false)) {
            await pageSwipe(device, 300);
            await sleep(400);
            break;
        }
        await pageSwipe(device, 600);
        await sleep(400);
    }

    adbShell(`pm dump ${APP_ID} | grep -i "POST_NOTIFICATIONS" || true`);
    console.log('[notif] Tapping permission button...');
    await screen.getByLabel('Request Notification Permission Button').tap();
    await sleep(3_000); // wait for dialog or settings to open

    dumpNodes(collectAll(await screen.viewTree()), 'UI AFTER TAPPING NOTIFICATION PERMISSION BUTTON');
    try { adbExec('shell input keyevent 4', { stdio: 'ignore' }); } catch {}
    await sleep(1_000);
    dumpNodes(collectAll(await screen.viewTree()), 'UI AFTER BACK FROM NOTIFICATION DIALOG');
});

test('dump ALL labels in notification section with permission pre-granted', async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    await freshLaunchToLogin();
    adbShell(`pm grant ${APP_ID} android.permission.POST_NOTIFICATIONS`);
    await sleep(500);

    await screen.getByLabel('Explore Features Button').tap();
    await sleep(1_000);

    // Scroll with exact label matching — stop only at the notification section, not contacts/camera
    for (let i = 0; i < 25; i++) {
        if (await screen.getByLabel('Notifications Section Label').isVisible().catch(() => false)) {
            await pageSwipe(device, 350);
            await sleep(500);
            break;
        }
        if (await screen.getByLabel('Request Notification Permission Button').isVisible().catch(() => false)) break;
        await pageSwipe(device, 600);
        await sleep(400);
    }

    // Dump ALL visible nodes at this scroll position to see every button/label
    const tree = collectAll(await screen.viewTree());
    console.log('\n=== ALL VISIBLE NODES AT NOTIFICATION SECTION ===');
    for (const n of tree) {
        if (!n.isVisible) continue;
        if (!n.label && !n.text && !n.resourceId) continue;
        console.log(JSON.stringify({ label: n.label, text: n.text, resourceId: n.resourceId, bounds: n.bounds }));
    }
    console.log('=== END ===\n');
});

test('send notification: restart app with permission active, tap button, read shade', async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // Step 1: clear data + grant permission (pm clear then pm grant — permission survives restart)
    await freshLaunchToLogin();
    adbShell(`pm grant ${APP_ID} android.permission.POST_NOTIFICATIONS`);
    await sleep(300);

    // Step 2: force-stop and relaunch so the app initialises with POST_NOTIFICATIONS already GRANTED
    adbShell(`am force-stop ${APP_ID}`);
    await sleep(1_000);
    await device.launchApp(APP_ID);
    await sleep(2_000);

    // Step 3: navigate to features
    await (expect(screen.getByLabel('Explore Features Button')) as any).toBeVisible({ timeout: 15_000 });
    await screen.getByLabel('Explore Features Button').tap();
    await (expect(screen.getByLabel('Features Toolbar')) as any).toBeVisible({ timeout: 15_000 });

    // Step 4: scroll to notification section
    for (let i = 0; i < 25; i++) {
        if (await screen.getByLabel('Request Notification Permission Button').isVisible().catch(() => false)) {
            await pageSwipe(device, 120);
            await sleep(350);
            break;
        }
        if (await screen.getByLabel('Notifications Section Label').isVisible().catch(() => false)) {
            await pageSwipe(device, 300);
            await sleep(500);
            break;
        }
        await pageSwipe(device, 600);
        await sleep(400);
    }

    // Step 5: dump UI BEFORE tap to see full button state
    dumpNodes(collectAll(await screen.viewTree()), 'NOTIFICATION SECTION BEFORE TAP');

    // Step 6: tap button and wait up to 8s for notification to fire
    console.log('[notif] Tapping button with permission pre-granted and app freshly restarted...');
    await screen.getByLabel('Request Notification Permission Button').tap();
    await sleep(8_000);

    // Step 7: dump app screen
    dumpNodes(collectAll(await screen.viewTree()), 'APP UI 8s AFTER TAP');

    // Step 8: expand notification shade and dump
    adbShell('cmd statusbar expand-notifications');
    await sleep(2_000);
    dumpNodes(collectAll(await screen.viewTree()), 'NOTIFICATION SHADE 8s AFTER TAP');

    // Step 9: also check dumpsys for active notifications from our package
    try {
        const dump = adbExec(
            `shell "dumpsys notification --noredact 2>/dev/null | grep -A 10 '${APP_ID}'"`,
            { encoding: 'utf8' }
        ).trim();
        console.log('[notif] dumpsys for package:', dump.slice(0, 500) || '(none)');
    } catch {}

    adbShell('cmd statusbar collapse');
});

test('dump UI when notification fires with permission granted BEFORE features render', async ({ screen, device }) => {
    const { freshLaunchToLogin, adbShell } = createHelpers(screen, device, APP_ID);

    // freshLaunchToLogin does pm clear + launch; app lands on login screen
    await freshLaunchToLogin();

    // Grant permission NOW — before navigating to features screen so app reads GRANTED at render
    adbShell(`pm grant ${APP_ID} android.permission.POST_NOTIFICATIONS`);
    await sleep(300);

    // Navigate to features screen WITH permission already granted
    await screen.getByLabel('Explore Features Button').tap();
    await sleep(800);

    for (let i = 0; i < 20; i++) {
        if (await screen.getByLabel('Request Notification Permission Button').isVisible().catch(() => false)) break;
        if (await screen.getByLabel('Notifications Section Label').isVisible().catch(() => false)) {
            await pageSwipe(device, 300);
            await sleep(400);
            break;
        }
        await pageSwipe(device, 600);
        await sleep(400);
    }

    console.log('[notif] Tapping button (permission granted BEFORE features screen rendered)...');
    await screen.getByLabel('Request Notification Permission Button').tap();
    await sleep(3_000);

    dumpNodes(collectAll(await screen.viewTree()), 'UI AFTER TAPPING (GRANT BEFORE FEATURES RENDER)');

    // Also expand notification shade to catch any notifications
    try { adbExec('shell cmd statusbar expand-notifications', { stdio: 'ignore' }); } catch {}
    await sleep(2_000);
    dumpNodes(collectAll(await screen.viewTree()), 'NOTIFICATION SHADE AFTER TAP');
    try { adbExec('shell cmd statusbar collapse', { stdio: 'ignore' }); } catch {}
});
