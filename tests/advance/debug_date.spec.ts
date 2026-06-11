import { test, expect } from '@mobilewright/test';
import { createHelpers, sleep, USER, collectAll } from './utiles';

const APP_ID = 'com.haris.testapp';

test.use({ bundleId: APP_ID, platform: 'android' });

test('debug date picker bounds', async ({ screen, device }) => {
    test.setTimeout(180_000);
    const {
        id, freshLaunchToLogin, registerAndGoToLogin, loginAndGoToProfile,
    } = createHelpers(screen, device, APP_ID);

    await freshLaunchToLogin();
    await screen.getByLabel('Create Account Button').tap();
    await registerAndGoToLogin();
    await loginAndGoToProfile();

    await screen.getByLabel('Update Profile Button').tap();
    await expect(screen.getByLabel('Update Profile Section')).toBeVisible({ timeout: 20_000 });
    await sleep(500);

    await screen.getByTestId(id('et_dob')).tap();
    await sleep(800);

    const dump = async (label: string) => {
        const nodes = collectAll(await screen.viewTree());
        console.log(`\n===== ${label} =====`);
        for (const n of nodes) {
            if (typeof n.text === 'string' && /^(25|2001|OK|Previous month|Next month|previous month|next month)$/.test(n.text.trim())) {
                console.log(JSON.stringify({ text: n.text, isVisible: n.isVisible, bounds: n.bounds }));
            }
            if (typeof n.label === 'string' && /month/i.test(n.label)) {
                console.log(JSON.stringify({ label: n.label, isVisible: n.isVisible, bounds: n.bounds }));
            }
        }
    };

    await dump('After opening DOB picker (default view)');

    // Switch to year-list view by tapping the year header.
    const treeNodes = collectAll(await screen.viewTree());
    const yearHeaderNode = treeNodes.find((n: any) =>
        n.isVisible && typeof n.text === 'string' && /^\d{4}$/.test(n.text.trim())
    );
    console.log('yearHeaderNode:', JSON.stringify({ text: yearHeaderNode?.text, bounds: yearHeaderNode?.bounds }));

    if (yearHeaderNode) {
        const b = yearHeaderNode.bounds;
        const bx = b.x ?? b.left ?? 0;
        const by = b.y ?? b.top ?? 0;
        const bw = b.width ?? ((b.right ?? 0) - bx);
        const bh = b.height ?? ((b.bottom ?? 0) - by);
        await device.driver.tap(Math.round(bx + bw / 2), Math.round(by + bh / 2));
    }
    await sleep(600);

    await dump('After switching to year list view');

    // Scroll to find 2001
    for (let attempt = 0; attempt < 40; attempt++) {
        if (await screen.getByText('2001').isVisible().catch(() => false)) break;
        await device.driver.swipe('down', { distance: 200 });
        await sleep(150);
    }

    await dump('After scrolling to year 2001');
});
